// LinkFoot, cœur portable : de la carte au corps (§43 et §44 du cahier AAA).
//
// §43 : PlayerData → VisualProfile → CharacterDefinition → SkeletalMesh → IK Rig → Control Rig
// → AnimationProfile → MotionDatabase → GameplayProfile. Ce fichier fait les deux premiers
// pas, sans rien inventer : le morphotype (§44) et le profil d'animation se lisent dans la
// fiche que le moteur envoie (taille, morphologie tirée de la carte, attributs du moteur,
// poste) et, pour la largeur de jeu, dans le match lui-même. Unreal associe ensuite chaque
// morphotype à un personnage (un MetaHuman au corps paramétrique, ou un maillage du
// Game Animation Sample), et le profil règle l'animation :
//   - echelle : la taille du squelette ;
//   - foulee : la longueur de foulée relative (Stride Warping, cadence) ;
//   - explosivite, agilite, equilibre : les attributs du moteur (accélération, changement de
//     direction, résistance au contact) ramenés de 0 à 1 : démarrages explosifs, appuis,
//     réactions aux contacts (§36, §38) ;
//   - carrure, inclinaison : la silhouette et la posture de course.
// Le moteur fait déjà courir le joueur avec ces attributs ; le profil montre la même chose
// dans le corps. Rien ici ne change le match.
#pragma once

#include "LFCore/LFCinematique.h"

#include <cstdint>

namespace lf
{
	// §44
	enum class TypeCorps : std::uint8_t
	{
		AilierFin,					// lean winger
		AilierExplosif,				// explosive winger
		MilieuCompact,				// compact midfielder
		MilieuGrand,				// tall midfielder
		AttaquantPuissant,			// strong striker
		AttaquantGrand,				// tall striker
		DefenseurCentralPuissant,	// powerful centre-back
		LateralFin,					// slim fullback
		GardienAthletique,			// athletic goalkeeper
		GardienGrand				// tall goalkeeper
	};

	constexpr int kTypesCorps = 10;

	struct ProfilCorps
	{
		TypeCorps type = TypeCorps::MilieuCompact;
		double echelle = 1.0;		// taille / 1,80 m
		double foulee = 1.0;		// foulée relative à un joueur de 1,80 m aux jambes moyennes
		double explosivite = 0.5;	// 0 à 1, de l'accélération du moteur
		double agilite = 0.5;		// 0 à 1, de l'agilité du moteur
		double equilibre = 0.5;		// 0 à 1, de l'équilibre du moteur
		double carrure = 0.5;		// 0 à 1 : épaules, muscles, masse
		double inclinaison = 0.5;	// 0 à 1 : posture de course
		double largeur = -1.0;		// distance moyenne à l'axe du terrain (m), -1 : inconnue
		double longueurJambeM = 0.87;	// du sol à la hanche (§21 du cahier « qualité visuelle »)
	};

	// §19 et §21 du cahier « qualité visuelle » : la foulée de CE corps à cette vitesse. Une
	// jambe plus longue fait des pas plus longs et une cadence plus basse ; un joueur explosif
	// qui accélère fait des pas plus courts et plus rapides, le buste penché ; un joueur qui
	// freine se redresse en arrière. De quoi régler le Stride Warping, la vitesse de lecture et
	// l'inclinaison du buste, pour que deux corps ne courent pas pareil à la même vitesse.
	struct Foulee
	{
		double longueurPasM = 0.0;		// d'un appui à l'autre
		double cadenceHz = 0.0;			// pas par seconde (0 à l'arrêt)
		double inclinaisonDeg = 0.0;	// le buste : + vers l'avant, − en arrière
	};

	// vitesse en m/s, accelerationLongitudinale en m/s² (+ accélère, − freine)
	LFCORE_API Foulee foulee(double longueurJambeM, double explosivite, double vitesse, double accelerationLongitudinale);

	// largeurMoyenne : la distance moyenne du joueur à l'axe du terrain pendant le match
	// (largeurDeJeu), ou -1 si on ne la connaît pas (le rôle tactique décide alors).
	LFCORE_API ProfilCorps profilCorps(const FicheJoueur& f, double largeurMoyenne = -1.0);
	// La distance moyenne à l'axe (x = 34 m) du joueur qui porte ce code, sur tout le document.
	LFCORE_API double largeurDeJeu(const Cinematique& c, int code);
	LFCORE_API const char* nomTypeCorps(TypeCorps t);
	LFCORE_API bool typeCompatibleAvecPoste(TypeCorps t, const std::string& poste);
}
