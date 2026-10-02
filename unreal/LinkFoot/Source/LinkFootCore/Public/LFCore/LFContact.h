// LinkFoot, cœur portable : le ballon et le joueur (§22 à §24, §82 du cahier AAA).
//
// §82 : « l'IA choisit une passe → calculer la cible → l'orientation du corps → la position du
// ballon → le pied → choisir l'animation → Motion Matching → IK → contact ». L'IA, la cible et
// l'issue sont dans le moteur. Ce fichier calcule le reste, pour chaque contact à venir d'un
// joueur : quand (dans combien de secondes), où est le ballon par rapport à son corps (devant,
// à droite, à quelle hauteur), avec quelle surface (pied droit, pied gauche, tête, poitrine,
// mains), à quelle vitesse part ou arrive le ballon, et, pour une réception, la qualité du
// premier contrôle que le moteur a tirée (§23).
//
// Le pied : le moteur pénalise la précision d'un joueur qui frappe de son côté faible (sa
// règle weakFoot : un droitier sur le côté gauche du terrain, vu de son camp). Le rendu
// utilise donc ce pied-là, et pas un autre : sinon l'écran montrerait un geste du bon pied
// pour une passe que le moteur a ratée parce qu'elle était du mauvais. Un ambidextre (ou un
// pied faible noté 5) prend le pied du côté où arrive le ballon.
//
// Côté Unreal : l'AnimBP choisit la base de gestes (Pose Search) d'après le genre, la
// surface et le temps restant, et pose le pied sur le ballon à l'instant du contact par l'IK
// (le point est connu dans le repère du corps). Rien ici ne change le match.
#pragma once

#include "LFCore/LFCinematique.h"

#include <cstdint>
#include <string>

namespace lf
{
	enum class GenreContact : std::uint8_t
	{
		Aucun,
		Passe,			// passe au sol
		PasseAerienne,	// passe longue, dans la profondeur par-dessus, relance longue
		Centre,
		Tir,
		Tete,			// tir, passe ou dégagement de la tête
		Degagement,
		Touche,			// à deux mains
		Controle,		// réception d'une passe
		Interception,
		Tacle,
		Contre,			// tir contré
		Arret,			// gardien : parade, prise
		PriseAerienne,	// gardien : centre capté
		SortiePieds		// gardien : dans les pieds de l'attaquant
	};

	enum class Surface : std::uint8_t
	{
		Aucune,
		PiedDroit,
		PiedGauche,
		Tete,
		Poitrine,
		Mains
	};

	// §23 : la qualité du premier contrôle, telle que le moteur l'a tirée (champ niveau).
	enum class QualiteControle : std::uint8_t
	{
		Aucune,
		Parfait,		// elite : orienté, il prend le dos de son adversaire
		Propre,			// oriente : la touche le met dans le sens du jeu
		Controle,		// correct
		Lourd,			// long : le ballon s'échappe d'un mètre
		Rate			// rate : le ballon lui échappe
	};

	struct Contact
	{
		bool valide = false;
		int action = -1;			// index dans DocumentMatch::actions
		double t = 0.0;				// l'instant du contact (secondes du moteur)
		double dans = 0.0;			// t − maintenant : positif avant le contact, négatif après
		GenreContact genre = GenreContact::Aucun;
		Surface surface = Surface::Aucune;
		QualiteControle qualite = QualiteControle::Aucune;
		bool piedFaible = false;	// frappe du côté où le moteur a pénalisé le joueur
		bool uneTouche = false;		// contrôle : le moteur l'a fait jouer en une touche
		bool sousPression = false;	// contrôle : un adversaire à moins de 2 m
		double x = 0.0, y = 0.0, z = 0.0;	// le ballon au contact, repère du moteur (m)
		double avant = 0.0;			// le ballon dans le repère du corps au contact : devant (m)
		double droite = 0.0;		// à droite du regard (m), le sens du lacet d'Unreal
		double distance = 0.0;		// distance horizontale corps-ballon (m)
		double vitesseBallon = 0.0;	// départ (frappe) ou arrivée (réception), m/s
		double vitesseJoueur = 0.0;	// m/s au contact
		double distanceFrappe = 0.0;	// frappe : jusqu'au point visé (m)
		std::string variante;		// tir : puissant, enroule, volee... ; passe : pass, through, long, cross...
	};

	struct ParametresContact
	{
		double horizon = 1.2;		// s : on annonce un contact jusqu'à cette avance
		double apres = 0.25;		// s : on le garde après, pour le geste qui suit la frappe
	};

	// Le prochain contact du joueur (code) avec le ballon, vu de l'instant t ; le plus proche
	// si deux se suivent (une passe en une touche suit le contrôle au même instant : c'est le
	// contrôle d'abord). Invalide s'il n'y en a pas dans [t − apres, t + horizon].
	LFCORE_API Contact prochainContact(const Cinematique& c, int code, double t, const ParametresContact& p = {});
	// Le contact d'une action donnée (index dans DocumentMatch::actions), vu de l'instant t.
	LFCORE_API Contact contactDeAction(const Cinematique& c, int action, double t);

	// Le pied que le moteur fait utiliser pour frapper (sa règle weakFoot) : pied « Droit »,
	// « Gauche » ou « Ambidextre », pied faible de 1 à 5, camp 'H' ou 'A', x en mètres ;
	// droiteBallon départage l'ambidextre (> 0 : le ballon est à sa droite).
	LFCORE_API Surface piedDeFrappe(const std::string& pied, int piedFaible, char camp, double x, double droiteBallon, bool& piedFaibleUtilise);
	LFCORE_API QualiteControle qualiteControle(const std::string& niveau);

	LFCORE_API const char* nomGenreContact(GenreContact g);
	LFCORE_API const char* nomSurface(Surface s);
	LFCORE_API const char* nomQualite(QualiteControle q);
}
