// LinkFoot, cœur portable : la cinématique, lue dans les images du moteur.
//
// Le moteur donne dix positions par seconde. Unreal en affiche soixante ou plus, et la
// locomotion (Motion Matching, warping, pieds) a besoin d'une vitesse et d'une accélération
// continues. On interpole donc entre deux images (Hermite cubique, tangentes = vitesses aux
// images) : la courbe passe exactement par chaque position du moteur, elle ne s'en écarte
// que de quelques millimètres entre deux images, et elle ne fabrique aucun mouvement que
// le moteur n'a pas joué.
//
// Un segment est une suite d'images où un joueur bouge sans coupure. On ne l'interpole
// jamais à travers :
//   - une coupe (le moteur a replacé tout le monde : coup d'envoi, mise en place) ;
//   - un trou dans le temps (le moteur saute des pas pendant une célébration) ;
//   - une entrée ou une sortie (remplacement, expulsion).
// Unreal téléporte le personnage à ces instants (et remet sa pose à zéro) au lieu de le
// faire glisser.
//
// Le ballon : pendant un vol, sa position est celle de la formule même du moteur (le vol
// est une courbe connue, pas une suite de points) ; hors vol, entre deux images. Quand le
// moteur pose le ballon pour un coup de pied arrêté, il le téléporte : on ne le fait pas
// voler jusqu'au point de remise en jeu, on le pose aussi.
#pragma once

#include "LFCore/LFDocument.h"

#include <cstdint>
#include <vector>

namespace lf
{
	struct EtatCinematique
	{
		bool valide = false;		// faux : le joueur n'est pas sur le terrain à cet instant
		double t = 0.0;
		double x = 0.0, y = 0.0;	// mètres, repère du moteur
		double vx = 0.0, vy = 0.0;	// m/s
		double ax = 0.0, ay = 0.0;	// m/s²
		double vitesse = 0.0;		// |v|
		double accelerationLongitudinale = 0.0;	// le long du mouvement : + accélère, − freine
		double accelerationLaterale = 0.0;		// signée : + vers la droite du mouvement (le sens du lacet d'Unreal)
		double angleCorps = 0.0;	// radians, repère du moteur (orientation du corps)
		double energie = 100.0;		// 0 à 100
		std::uint8_t etats = 0;		// bits lf::etat
		std::uint8_t intention = 0;
		int image = -1;				// l'image de départ de l'intervalle
		bool horsSegment = false;	// tenu (pas d'interpolation) : bord d'un segment
	};

	struct EtatBallon
	{
		bool valide = false;
		double x = 0.0, y = 0.0, z = 0.0;		// mètres
		double vx = 0.0, vy = 0.0, vz = 0.0;	// m/s
		int porteur = -1;
		bool enVol = false;
		int frappe = -1;			// index de l'action de frappe en vol (dans DocumentMatch::actions)
	};

	// Un vol du ballon tel que le moteur l'a joué : de la frappe jusqu'à son arrivée, ou
	// jusqu'à ce qu'il soit intercepté, contrôlé, dévié (le ballon quitte alors la formule).
	struct Vol
	{
		int action = -1;
		double t0 = 0.0;			// l'instant du contact : le ballon part de (x0, y0, z0)
		double tFormule = 0.0;		// l'origine de la formule du moteur (= t0, sauf pour une frappe
									// jouée pendant le pas du ballon : un dixième de seconde avant)
		double duree = 0.0;
		double tFin = 0.0;			// fin du vol tel qu'il a eu lieu (≤ t0 + duree)
		double x0 = 0.0, y0 = 0.0, z0 = 0.0, x1 = 0.0, y1 = 0.0;
		double apex = 0.0;
		bool utilisable = true;		// faux : le moteur a tenu le ballon un pas de plus (tête contestée) ; on suit les images
		bool lineaire = false;		// aérien ou tir : avance régulière ; sinon le ballon ralentit
		int vers = -1;				// le destinataire, -1 : aucun
		int de = -1;				// le frappeur
	};

	struct ParametresCinematique
	{
		// Lissage centré des positions du moteur (écart type en secondes ; 0 : aucun).
		// Le moteur règle les contacts en poussant les joueurs de quelques centimètres d'un pas
		// à l'autre : à l'écran, ce sont des à-coups (verifierPont en compte des milliers par
		// match au-delà de 14 m/s²). Le lissage les étale sans retard, puisque le futur est
		// connu, et ne s'écarte jamais du moteur de plus de ecartMaxM : le contrat de la
		// passerelle tolère 30 cm, et le détecteur de désynchronisation le vérifie.
		double lissageS = 0.0;
		double ecartMaxM = 0.25;
	};

	class LFCORE_API Cinematique
	{
	public:
		explicit Cinematique(const DocumentMatch& doc, const ParametresCinematique& p = {});

		const DocumentMatch& document() const { return doc_; }
		int nombreImages() const { return static_cast<int>(doc_.images.size()); }

		// L'état d'un joueur (code 0 à 21) à l'instant t, en secondes du moteur.
		EtatCinematique etat(int code, double t) const;
		// Le ballon à l'instant t.
		EtatBallon ballon(double t) const;

		// L'image i ouvre-t-elle un nouveau segment pour ce joueur ?
		bool rupture(int code, int image) const;
		// Les bornes (indices d'images) du segment qui contient l'image.
		void segment(int code, int image, int& premier, int& dernier) const;
		// Position (lissée si demandé), vitesse et accélération aux images (différences finies
		// dans le segment).
		void positionImage(int code, int image, double& x, double& y) const;
		void vitesseImage(int code, int image, double& vx, double& vy) const;
		void accelerationImage(int code, int image, double& ax, double& ay) const;

		const std::vector<Vol>& vols() const { return vols_; }
		// Le vol en cours à l'instant t, ou nullptr.
		const Vol* volA(double t) const;
		// Les actions d'un joueur, par index dans DocumentMatch::actions (temps croissant).
		const std::vector<int>& actionsDe(int code) const;

	private:
		const DocumentMatch& doc_;
		ParametresCinematique p_;
		std::vector<std::uint8_t> ruptures_;	// [image × 22 + code]
		std::vector<float> positions_;			// [(image × 22 + code) × 2], lissées si demandé
		std::vector<float> vitesses_;			// idem
		std::vector<float> accelerations_;		// idem
		std::vector<Vol> vols_;					// triés par t0
		std::vector<std::vector<int>> actionsParJoueur_;

		std::size_t indice(int image, int code) const
		{
			return static_cast<std::size_t>(image) * static_cast<std::size_t>(kJoueurs) + static_cast<std::size_t>(code);
		}
		void positionBallonVol(const Vol& v, double t, EtatBallon& b) const;
	};
}
