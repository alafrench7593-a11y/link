// LinkFoot, cœur portable : la trajectoire que Motion Matching doit suivre (§15).
//
// Dans un jeu où l'on tient la manette, Unreal PRÉDIT la trajectoire du personnage à partir
// de l'entrée du joueur. Ici personne ne tient de manette : le moteur a déjà joué le match.
// Le passé ET le futur sont connus. La trajectoire donnée à Motion Matching (le nœud Pose
// History, broche « Trajectory », type FTransformTrajectory depuis UE 5.6) est donc la vraie :
// positions et orientations du corps aux instants demandés, lues dans le moteur.
//
// Convention d'Unreal (Pose History) : l'échantillon de temps 0 est l'image précédente de la
// simulation, puisque Motion Matching compare avec la pose précédente. La couche Unreal
// passe donc tReference = temps rendu − DeltaSeconds.
//
// Au bord d'un segment (coupe, entrée, sortie), on prolonge à vitesse décroissante plutôt
// que d'inventer : Unreal téléportera le personnage au moment de la coupe.
#pragma once

#include "LFCore/LFCinematique.h"

#include <vector>

namespace lf
{
	struct EchantillonTrajectoire
	{
		double decalage = 0.0;		// secondes par rapport à tReference
		double x = 0.0, y = 0.0;	// mètres, repère du moteur
		double angleCorps = 0.0;	// radians, repère du moteur
		bool extrapole = false;		// hors du segment : prolongé, pas lu
	};

	struct ParametresTrajectoire
	{
		// Les valeurs par défaut de UPoseSearchTrajectoryLibrary (UE 5.8) : 10 échantillons
		// d'historique toutes les 0,04 s, 8 de prédiction toutes les 0,2 s (1,6 s).
		int historique = 10;
		double pasHistorique = 0.04;
		int prediction = 8;
		double pasPrediction = 0.2;
		double amortissement = 0.6;	// s : au-delà du segment, la vitesse s'éteint sur cette durée
	};

	// Les échantillons dans l'ordre du temps : historique, présent (décalage 0), prédiction.
	// Vide si le joueur n'est pas sur le terrain à tReference.
	LFCORE_API std::vector<EchantillonTrajectoire> trajectoire(const Cinematique& c, int code, double tReference,
		const ParametresTrajectoire& p = {});
}
