// LinkFoot, cœur portable : la famille d'animation que le moteur attend, et celle qu'Unreal
// joue (§73, désynchronisation d'animation).
//
// Le moteur dit ce que fait le joueur (il court, il freine, il contrôle, il frappe, il
// tombe). Unreal choisit une animation dans ses bases de mouvements (Motion Matching). Si le
// moteur dit « contrôle » et qu'Unreal joue un sprint, l'écran ment : c'est une
// désynchronisation d'animation.
//
// La famille vue côté Unreal se déduit du nom de la base Pose Search (ou de l'animation)
// choisie. La convention de nommage (docs/ue5/animation.md) : un mot-clé de la liste
// ci-dessous dans le nom, par exemple PSD_LF_Sprint, PSD_LF_Freinage, PSD_Reception_Course.
// Les noms des bases du Game Animation Sample (Starts, Stops, Pivots, Idles, Walk, Jog,
// Run...) sont reconnus tels quels.
#pragma once

#include "LFCore/LFCinematique.h"

#include <cstdint>
#include <string_view>

namespace lf
{
	enum class Famille : std::uint8_t
	{
		Inconnue,
		// la locomotion
		Immobile,
		Marche,
		Trot,
		Course,
		Sprint,
		Demarrage,
		Freinage,
		Pivot,
		Lateral,
		Recul,
		// le ballon
		Reception,
		Passe,
		Centre,
		Tir,
		Tete,
		Degagement,
		Touche,
		Dribble,
		Protection,
		// la défense
		Tacle,
		TacleGlisse,
		Interception,
		// le gardien
		Plongeon,
		Arret,
		Prise,
		SortiePieds,
		// le corps
		Chute,
		Desequilibre,
		Celebration
	};

	// Ce que le moteur fait faire au joueur à l'instant t.
	LFCORE_API Famille familleAttendue(const Cinematique& c, int code, double t);
	// La famille d'une base ou d'une animation, d'après son nom.
	LFCORE_API Famille familleDepuisNom(std::string_view nom);
	// L'animation vue est-elle acceptable pour ce que fait le moteur ?
	LFCORE_API bool famillesCompatibles(Famille attendue, Famille vue);
	LFCORE_API bool estLocomotion(Famille f);
	LFCORE_API const char* nomFamille(Famille f);
}
