// LinkFoot, cœur portable : le souffle, la sueur, la posture de fatigue (cahier « qualité
// visuelle » §3, §24, §26 et §32 : « quand il transpire, je vois un joueur qui vient de courir »).
//
// Le moteur fait déjà courir moins vite, accélérer moins fort et tourner moins vite un joueur
// fatigué (§37 du premier cahier, vérifié par les tests du moteur). Ce qui manque à l'écran,
// c'est ce que le corps en montre, et ici tout se déduit de ce que le joueur a couru :
//   - l'essoufflement : il monte en quelques secondes d'effort (sprint, pressing), redescend
//     en une trentaine de secondes de marche, plus lentement chez un joueur à bout ;
//   - la respiration : sa fréquence (de 14 cycles par minute au repos à plus de 50 après un
//     sprint) et son amplitude, pour une couche d'animation du buste ;
//   - la transpiration : elle s'accumule avec le travail fourni pendant le match, plus vite
//     au soleil, moins vite dans le froid, et la mi-temps en efface une partie ;
//   - l'humidité : la pluie mouille tout le monde ;
//   - la posture de fatigue : épaules qui tombent, tête plus basse.
// Rien ne change le match : tout se lit dans le document.
#pragma once

#include "LFCore/LFCinematique.h"

#include <array>
#include <vector>

namespace lf
{
	struct EtatPhysiologique
	{
		bool valide = false;
		double essoufflement = 0.0;			// 0 à 1 (au-delà de 1 : dans le rouge)
		double frequenceRespiration = 14.0;	// cycles par minute
		double amplitudeRespiration = 0.2;	// 0 à 1
		double transpiration = 0.0;			// 0 à 1
		double humidite = 0.0;				// 0 à 1 : la pluie
		double postureFatigue = 0.0;		// 0 à 1
	};

	struct ParametresPhysiologie
	{
		double tauMontee = 4.0;				// s : l'essoufflement monte
		double tauDescente = 25.0;			// s : il redescend (frais), jusqu'au double à bout de forces
		double respirationRepos = 14.0;		// cycles par minute
		double respirationEffort = 50.0;	// cycles par minute, essoufflement 1
		double travailSaturation = 1500.0;	// travail (effort × s) qui trempe un maillot
	};

	class LFCORE_API ChroniquePhysiologie
	{
	public:
		explicit ChroniquePhysiologie(const Cinematique& c, const ParametresPhysiologie& p = {});

		EtatPhysiologique etat(int code, double t) const;

		// L'effort instantané à une vitesse : 0,05 en marchant, (v / vmax)² × 1,25 au-delà de 2 m/s.
		static double effort(double vitesse, double vitesseMax);

	private:
		const Cinematique& c_;
		ParametresPhysiologie p_;
		std::array<std::vector<float>, kJoueurs> souffle_;	// par image : l'essoufflement
		std::array<std::vector<float>, kJoueurs> travail_;	// par image : le travail qui mouille le maillot
		double facteurMeteo_ = 1.0;
		double humidite_ = 0.0;
	};
}
