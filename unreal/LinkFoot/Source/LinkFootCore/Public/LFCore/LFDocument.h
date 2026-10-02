// LinkFoot, cœur portable : le document « linkfoot-match » version 1, lu tel que le moteur
// LinkFoot l'écrit (src/passerelle.js, contrat dans docs/passerelle-ue5.md).
//
// Le moteur LinkFoot est la seule autorité du match. Ce document est ce qu'il a joué : qui
// est qui (la feuille), dix images par seconde, les actions horodatées, les événements, le
// résultat. Unreal ne décide rien : il lit ceci et l'incarne. C'est la seule source de
// vérité (§6 du cahier AAA) ; la 2D, la 3D de l'app et Unreal lisent les mêmes nombres.
//
// Repère du moteur : mètres, x en largeur (0 à 68), y en longueur (0 à 105).
// Le passage au repère d'Unreal est dans LFRepere.h.
#pragma once

#include "LFCore/LFJson.h"

#include <array>
#include <cstdint>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace lf
{
	constexpr int kJoueurs = 22;			// codes 0 à 10 : domicile (H) ; 11 à 21 : extérieur (A)
	constexpr int kChampsTete = 12;			// t, horloge, mi_temps, coupe, bx, by, bz, porteur, score_d, score_e, cpa, tireur
	constexpr int kChampsJoueur = 6;		// x, y, angle, energie, etats, intention
	constexpr int kChampsImage = kChampsTete + kJoueurs * kChampsJoueur;
	constexpr int kChampsCibles = kJoueurs * 2;	// cx, cy : seulement en mode débogage
	constexpr double kPasMoteur = 0.1;		// secondes entre deux images

	// Les bits d'état d'un joueur dans une image.
	namespace etat
	{
		constexpr std::uint8_t AuSol = 1;
		constexpr std::uint8_t Desequilibre = 2;
		constexpr std::uint8_t Porteur = 4;
		constexpr std::uint8_t Exclu = 8;
		constexpr std::uint8_t Sprint = 16;		// le moteur veut sprinter (urgence)
		constexpr std::uint8_t Presse = 32;		// presse le porteur
		constexpr std::uint8_t Appel = 64;		// fait un appel
		constexpr std::uint8_t Dribble = 128;	// conduit en dribble
	}

	// L'intention de l'IA du moteur (code 1 à 9 ; 0 : aucune).
	enum class Intention : std::uint8_t
	{
		Aucune = 0,
		Hold,
		Support,
		BuildUp,
		AttackSpace,
		Drop,
		Overlap,
		Recover,
		Mark,
		Cover
	};

	// Les coups de pied arrêtés en cours (champ cpa).
	enum class Cpa : std::uint8_t
	{
		Aucun = 0,
		CoupEnvoi,
		Corner,
		CoupFrancCentre,
		CoupFrancDirect,
		CoupFranc,
		Touche,
		SixMetres,
		Penalty
	};

	struct JoueurImage
	{
		float x = 0.f;					// mètres, repère du moteur
		float y = 0.f;
		std::int16_t angle = 0;			// orientation du corps, milliradians, repère du moteur
		std::uint8_t energie = 100;		// 0 à 100
		std::uint8_t etats = 0;			// bits lf::etat
		std::uint8_t intention = 0;		// lf::Intention
		bool present = false;			// faux : exclu, ou pas sur le terrain
	};

	struct Image
	{
		std::int32_t t10 = 0;			// temps du moteur × 10 (fin du pas)
		std::int32_t horloge = 0;		// horloge du match, en secondes
		std::int8_t miTemps = 1;
		bool coupe = false;				// le moteur a replacé tout le monde avant cette image
		std::array<float, 3> ballon{};	// mètres (z vers le haut)
		std::int8_t porteur = -1;		// code du porteur, -1 : personne
		std::array<std::uint8_t, 2> score{};
		Cpa cpa = Cpa::Aucun;
		std::int8_t tireur = -1;		// le tireur du coup de pied arrêté
		std::array<JoueurImage, kJoueurs> joueurs{};

		double temps() const { return t10 / 10.0; }
	};

	enum class TypeAction : std::uint8_t
	{
		Inconnue,
		Passe,
		Tir,
		Degagement,
		Touche,
		Controle,
		Interception,
		HorsJeu,
		PriseAerienne,
		DuelAerien,
		Plongeon,
		Arret,
		Poteau,
		Contre,
		But,
		Celebration,
		Faute,
		Dribble,
		Tacle,
		SortiePieds,
		Remplacement
	};

	LFCORE_API TypeAction typeAction(std::string_view nom);
	LFCORE_API const char* nomTypeAction(TypeAction type);

	// Une action horodatée du moteur : à l'instant du geste (le ballon part de x0, y0 à t).
	struct LFCORE_API Action
	{
		double t = 0.0;
		int code = -1;				// qui fait l'action
		TypeAction type = TypeAction::Inconnue;
		std::string nom;			// le champ « a » tel quel
		std::vector<std::pair<std::string, double>> nombres;	// champs numériques (booléens : 0 ou 1)
		std::vector<std::pair<std::string, std::string>> textes;
		std::vector<std::pair<std::string, std::vector<double>>> listes;	// ex. « autres »

		double nombre(std::string_view cle, double defaut = 0.0) const;
		bool aNombre(std::string_view cle) const;
		const std::string* texte(std::string_view cle) const;
		bool texteVaut(std::string_view cle, std::string_view valeur) const;
		bool vrai(std::string_view cle) const { return nombre(cle, 0.0) != 0.0; }
		// Le ballon part du pied (ou de la main) : passe, tir, dégagement, touche.
		bool estFrappe() const;
		// Durée du vol du ballon pour une frappe, 0 sinon.
		double duree() const { return estFrappe() ? nombre("dur", 0.0) : 0.0; }
	};

	struct Evenement
	{
		double t = 0.0;
		std::string genre;		// champ « k »
		std::string texte;		// champ « text »
	};

	struct Competence
	{
		std::string effet, nom, categorie, rarete;
		double puissance = 0.0;
		int condition = 0;
	};

	// Les attributs que le moteur tire des statistiques de la carte : c'est avec eux qu'il
	// fait courir, accélérer, tourner et frapper le joueur (une seule formule, celle du moteur).
	struct AttributsMoteur
	{
		double vitesseMax = 0.0;	// m/s
		double acceleration = 0.0;	// sans unité, gain d'accélération du moteur
		double agilite = 0.0;
		double equilibre = 0.0;
		int vitesse = 0, tir = 0, passe = 0, dribble = 0, defense = 0, physique = 0, decision = 0;
		bool gardien = false;
		int reflexes = 0, prise = 0, plongeon = 0, degagement = 0, placement = 0;
	};

	struct Morphologie
	{
		int tailleCm = 180;
		int poidsKg = 75;
		std::string carrure;	// massive, athletique, fine, equilibree
		double epaules = 0.5, muscles = 0.5, masse = 0.5, jambes = 0.5, bras = 0.5, bassin = 0.5, posture = 0.5;
	};

	struct Apparence
	{
		std::int64_t graine = 0;
		std::array<double, 8> visage{};
		int teint = 0;
		std::string coiffure, cheveux, barbe;
		int sourcils = 0, yeux = 0;
	};

	struct EtatFiche
	{
		int forme = 70, moral = 72, energie = 100, blessure = 0;
	};

	// Une ligne de la feuille de match : de la carte au personnage (§36 de la passerelle).
	struct LFCORE_API FicheJoueur
	{
		int code = -1;			// -1 : sur le banc au coup d'envoi
		char camp = 'H';
		std::int64_t carte = -1;	// -1 : pas de carte (adversaire)
		std::string personnage;	// LF-00012, ADV-12345-03 : le même de bout en bout
		std::string nom, poste, ligne, posteTactique, role, devoir, rarete, pied;
		int numero = 0, note = 0, niveau = 0, piedFaible = 3;
		std::vector<std::pair<std::string, int>> stats;	// VIT, TIR, PAS, DRI, DÉF, PHY... tels qu'affichés
		bool aMoteur = false;
		AttributsMoteur moteur;
		std::vector<Competence> competences;
		EtatFiche etat;
		Morphologie morphologie;
		Apparence apparence;

		int stat(std::string_view cle, int defaut) const;
		bool aCompetence(std::string_view effet) const;
		bool estGardien() const { return poste == "GB"; }
	};

	struct LFCORE_API Equipe
	{
		std::string club, maillotC1, maillotC2, motif, formation, style;
		int mentalite = 3;
		std::vector<std::pair<std::string, double>> tactique;
		double reglage(std::string_view cle, double defaut) const;
	};

	// Les informations d'une scène de test (unreal/LinkFoot/Content/LinkFoot/Scenes) :
	// une fenêtre d'un vrai match, avec ce qu'elle doit montrer.
	struct LFCORE_API InfoScene
	{
		std::string id, titre, raison;
		int numero = 0;
		int focus = -1;				// le joueur à regarder
		double t0 = 0.0, t1 = 0.0;	// la fenêtre
		double instant = 0.0;		// le moment clé (frappe, virage, contrôle...)
		std::vector<std::pair<std::string, double>> mesures;	// ce que l'extraction a mesuré (JS)
		double mesure(std::string_view cle, double defaut) const;
	};

	// §60 Les statistiques d'une équipe, telles que le moteur les compte (resultat.stats du
	// document, et LFEtatMatch.h qui les recalcule depuis les actions, à n'importe quel instant).
	struct StatsEquipe
	{
		int tirs = 0;				// sh
		int tirsCadres = 0;			// on : but ou arrêt
		double xg = 0.0;			// xg
		int corners = 0;			// cor
		int fautes = 0;				// fou
		int jaunes = 0;				// yc (un second jaune compte aussi un rouge)
		int rouges = 0;				// rc
		int passes = 0;				// pa : passes et centres choisis par le porteur
		int passesReussies = 0;		// pc : ballons reçus d'un partenaire
		int horsJeu = 0;			// off
		int tacles = 0;				// tk : ballons gagnés (interceptions, tacles réussis, tirs contrés, duels aériens gagnés en défense sur centre)
		int buts = 0;
	};

	// Un remplacement : à partir de t, le code est porté par une autre fiche (un remplaçant).
	struct Remplacement
	{
		double t = 0.0;
		int code = -1;
		int indexFiche = -1;	// index dans DocumentMatch::joueurs, -1 si le remplaçant est introuvable
	};

	struct LFCORE_API DocumentMatch
	{
		int version = 0;
		double hz = 10.0;
		double pas = kPasMoteur;
		std::int64_t graine = -1;
		std::string competition, meteo;
		bool domicile = true;
		double debut = 0.0, fin = 0.0;
		std::array<Equipe, 2> equipes;		// 0 : H, 1 : A
		std::vector<FicheJoueur> joueurs;	// titulaires puis remplaçants
		std::array<int, kJoueurs> indexFiche{};	// code → index dans joueurs (-1 : aucun)
		std::vector<Image> images;
		std::vector<float> cibles;			// kChampsCibles par image en mode débogage, vide sinon
		std::vector<Action> actions;		// dans l'ordre du moteur (temps croissant)
		std::vector<Evenement> evenements;
		std::vector<Remplacement> remplacements;
		std::string empreinte;				// cyrb53 du texte (calculée par le moteur)
		std::string empreinteImages;		// cyrb53 des entiers des images (vérifiée à la lecture)
		bool empreinteImagesVerifiee = false;
		bool aResultat = false;
		std::array<int, 2> scoreFinal{};
		// Ce que le moteur a compté (bloc resultat) : la référence des statistiques recalculées.
		bool aStatsFinales = false;
		std::array<StatsEquipe, 2> statsFinales;
		int possessionFinale = -1;			// % du domicile, arrondi par le moteur
		std::array<std::vector<double>, 2> notesFinales;	// la note du moteur, par code (0 à 10, puis 11 à 21)
		bool estScene = false;
		InfoScene scene;

		// La fiche du titulaire qui portait ce code au coup d'envoi.
		const FicheJoueur* fiche(int code) const;
		// La fiche de celui qui porte ce code à l'instant t (après les remplacements).
		const FicheJoueur* ficheA(int code, double t) const;
		// La dernière image dont le temps est ≤ t (-1 avant la première).
		int indexImageA(double t) const;
		double vitesseMax(int code, double t) const;	// celle du moteur, 9 m/s sans attributs
	};

	struct ResultatChargement
	{
		bool ok = false;
		std::string erreur;
	};

	LFCORE_API ResultatChargement chargerDocument(const json::Valeur& racine, DocumentMatch& doc);
	LFCORE_API ResultatChargement chargerDocument(std::string_view texte, DocumentMatch& doc);

	// L'empreinte des images (cyrb53 sur les entiers, ligne par ligne) : la même formule que
	// empreinteImagesPont() dans src/passerelle.js. La recalculer en lisant prouve qu'on a lu
	// les mêmes nombres que ceux que le moteur a écrits.
	class LFCORE_API EmpreinteImages
	{
	public:
		explicit EmpreinteImages(std::uint32_t nombreDeLignes);
		void ajouter(std::int32_t valeur);
		std::string resultat() const;

	private:
		std::uint32_t h1_;
		std::uint32_t h2_;
	};
}
