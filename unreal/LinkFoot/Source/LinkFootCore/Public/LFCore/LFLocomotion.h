// LinkFoot, cœur portable : ce que le mouvement d'un joueur EST, en mots de locomotion.
//
// Le moteur a décidé le mouvement ; ici on le décrit pour l'animation : à quelle vitesse
// (§11), est-ce qu'il démarre, accélère, freine, s'arrête (§12, §13), est-ce qu'il tourne
// et de combien (§14), court-il en avant, en pas chassés ou à reculons (§17, §26), avec
// quel effort par rapport à SA vitesse de pointe, et dans quel état physique (§37).
//
// Unreal s'en sert pour choisir la base de mouvements à chercher (Chooser), pour régler le
// warping (angle de locomotion, vitesse) et pour vérifier que l'animation jouée correspond
// à ce que fait le moteur (LFFamilles.h). Rien ici ne change le match.
#pragma once

#include "LFCore/LFCinematique.h"

#include <cstdint>

namespace lf
{
	// §11 : 0, 0-2, 2-4, 4-6, 6-8, 8+ m/s.
	enum class BandeVitesse : std::uint8_t
	{
		Arret,		// < 0,3 m/s
		Marche,		// 0,3 à 2
		Trot,		// 2 à 4
		Course,		// 4 à 6
		Rapide,		// 6 à 8
		Sprint		// 8 et plus
	};

	enum class PhaseVitesse : std::uint8_t
	{
		Stable,
		Demarrage,		// part d'un arrêt
		Acceleration,
		Freinage,
		Arret			// finit de s'arrêter
	};

	// La direction du mouvement par rapport au corps (§17, §26).
	enum class Allure : std::uint8_t
	{
		Avant,
		Lateral,		// pas chassés, course latérale
		Recul			// course à reculons
	};

	// §14 : correction, 30, 45, 60, 90, 135, 180 degrés.
	enum class ClasseVirage : std::uint8_t
	{
		Aucun,
		Correction,
		V30,
		V45,
		V60,
		V90,
		V135,
		V180
	};

	struct ParametresLocomotion
	{
		double seuilArret = 0.3;			// m/s
		double seuilAcceleration = 1.0;		// m/s², le long du mouvement
		double seuilFreinage = 1.5;			// m/s²
		double horizonVirage = 0.6;			// s : on regarde le cap de maintenant à maintenant + horizon
		double vitesseMiniVirage = 1.0;		// m/s aux deux bouts pour parler de virage
		double energieFatigue = 60.0;		// en dessous : joueur marqué fatigué (§37)
	};

	struct DescriptionLocomotion
	{
		bool valide = false;
		BandeVitesse bande = BandeVitesse::Arret;
		PhaseVitesse phase = PhaseVitesse::Stable;
		Allure allure = Allure::Avant;
		ClasseVirage virage = ClasseVirage::Aucun;
		double vitesse = 0.0;					// m/s
		double vitesseMax = 9.0;				// celle du moteur pour ce joueur
		double effort = 0.0;					// vitesse / vitesse max
		double accelerationLongitudinale = 0.0;	// m/s²
		double angleLocomotionDeg = 0.0;		// mouvement par rapport au corps, ]−180, 180] (0 : vers l'avant)
		double virageDeg = 0.0;					// changement de cap sur l'horizon (signé, degrés)
		double rayonVirage = 1e9;				// m : v² / |a latérale| (1e9 : ligne droite)
		double energie = 100.0;
		bool sprintVoulu = false;				// le moteur veut sprinter (bit Sprint)
		bool fatigue = false;
	};

	LFCORE_API DescriptionLocomotion decrireLocomotion(const Cinematique& c, int code, double t, const ParametresLocomotion& p = {});

	LFCORE_API BandeVitesse bandeVitesse(double vitesse, double seuilArret = 0.3);
	LFCORE_API ClasseVirage classeVirage(double angleDeg);

	LFCORE_API const char* nomBande(BandeVitesse b);
	LFCORE_API const char* nomPhase(PhaseVitesse p);
	LFCORE_API const char* nomAllure(Allure a);
	LFCORE_API const char* nomVirage(ClasseVirage v);
}
