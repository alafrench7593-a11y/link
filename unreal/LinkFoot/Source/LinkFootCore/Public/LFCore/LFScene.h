// LinkFoot, cœur portable : les seize scènes de test (§76 du cahier AAA).
//
// Une scène est une fenêtre d'un vrai match joué par le moteur (tools/scenes-ue5.mjs les
// extrait), au format de la passerelle, avec un bloc « scene » : son numéro, le joueur à
// regarder (focus), l'instant clé, et ce que l'extraction a mesuré. Ce fichier vérifie,
// avec la cinématique C++, que la scène montre bien ce que son nom promet. Les mêmes
// vérifications tournent dans les tests compilés hors d'Unreal et dans les tests
// d'automatisation d'Unreal (LinkFoot.Coeur.Scenes) : une scène qui ne montre plus ce
// qu'elle promet, après un changement du moteur, se voit tout de suite.
//
//   1 sprint droit                 9 centre et tête
//   2 sprint puis virage à 90°    10 un contre un face au gardien
//   3 sprint puis arrêt           11 pressing haut
//   4 réception en course         12 bloc bas
//   5 réception sous pression     13 contre-attaque
//   6 dribble et changement de    14 joueur épuisé
//     direction                   15 pluie
//   7 duel d'épaule               16 match de nuit
//   8 tacle glissé
#pragma once

#include "LFCore/LFCinematique.h"

#include <string>

namespace lf
{
	struct VerdictScene
	{
		bool ok = false;
		std::string detail;
	};

	LFCORE_API VerdictScene verifierScene(const DocumentMatch& doc, const Cinematique& c);

	// Le cap du mouvement d'un joueur (radians, repère du moteur) et le changement de cap
	// entre deux instants (degrés, signé). Utilisé par les scènes et par l'extraction.
	LFCORE_API double changementCapDeg(const Cinematique& c, int code, double t0, double t1);
}
