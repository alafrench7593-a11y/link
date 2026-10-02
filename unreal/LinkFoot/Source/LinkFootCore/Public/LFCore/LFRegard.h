// LinkFoot, cœur portable : où regarde un joueur (§26 et §27 : le mouvement, le buste, la
// tête et le regard sont séparés).
//
// Le corps va où le moteur l'envoie ; la tête, elle, suit ce que le joueur a besoin de voir :
//   - le ballon, par défaut ;
//   - le ballon qui arrive, quand une passe lui est destinée ;
//   - sa cible, juste avant de frapper (le partenaire de la passe, le but du tir) ;
//   - devant lui quand il conduit le ballon ;
//   - un coup d'œil par-dessus l'épaule (vers l'adversaire le plus proche), d'autant plus
//     souvent que son attribut de décision est haut : c'est le scanning (§27). Il ne change
//     pas le match (le moteur a déjà décidé avec cet attribut) ; il le montre.
// Tout se lit dans le document : en relecture, la frappe à venir est connue d'avance. En
// direct, la couche Unreal joue avec un retard fixe (docs/ue5/animation.md) pour avoir ce
// même temps d'avance.
#pragma once

#include "LFCore/LFCinematique.h"

#include <cstdint>

namespace lf
{
	enum class SourceRegard : std::uint8_t
	{
		Ballon,
		PasseAttendue,	// le ballon qui lui est destiné
		CiblePasse,		// le partenaire qu'il va servir
		CibleTir,		// le but qu'il va viser
		Devant,			// il conduit : la tête relevée vers où il va
		Balayage		// coup d'œil par-dessus l'épaule
	};

	struct Regard
	{
		bool valide = false;
		double x = 0.0, y = 0.0, z = 0.0;	// mètres, repère du moteur
		SourceRegard source = SourceRegard::Ballon;
	};

	struct ParametresRegard
	{
		double anticipationFrappe = 0.7;	// s : on regarde sa cible avant de frapper
		double periodeBalayageLente = 6.0;	// s entre deux coups d'œil, décision 40
		double periodeBalayageRapide = 2.5;	// s, décision 90
		double dureeBalayage = 0.35;		// s
		double distanceBalayage = 25.0;		// m : au-delà, le jeu est loin, on suit le ballon
		double distanceDevant = 6.0;		// m devant le porteur
	};

	LFCORE_API Regard cibleRegard(const Cinematique& c, int code, double t, const ParametresRegard& p = {});

	// §4 du cahier « qualité visuelle » : le corps, la tête et les yeux ne visent pas la même
	// chose. Le corps court où le moteur l'envoie ; les yeux vont seuls vers la cible jusqu'à
	// seuilYeux, puis la tête prend une part de l'angle jusqu'à ses limites, et les yeux font
	// le reste jusqu'aux leurs. Au-delà, la cible est hors de vue (il faudrait tourner le corps,
	// ou jeter un coup d'œil par-dessus l'épaule). Les angles suivent le lacet d'Unreal :
	// + à droite, et + vers le haut pour le tangage.
	struct LimitesRegard
	{
		double seuilYeuxDeg = 15.0;			// en deçà, les yeux seuls
		double partTete = 0.75;				// au-delà, la part de la tête
		double lacetTeteMaxDeg = 70.0;
		double tangageTeteMinDeg = -40.0;
		double tangageTeteMaxDeg = 30.0;
		double lacetYeuxMaxDeg = 35.0;
		double tangageYeuxMaxDeg = 25.0;
	};

	struct OrientationRegard
	{
		bool valide = false;
		double lacetCibleDeg = 0.0;		// la cible par rapport au corps
		double tangageCibleDeg = 0.0;
		double lacetTeteDeg = 0.0;		// la tête par rapport au corps
		double tangageTeteDeg = 0.0;
		double lacetYeuxDeg = 0.0;		// les yeux par rapport à la tête
		double tangageYeuxDeg = 0.0;
		bool horsDeVue = false;			// tête et yeux au bout de leur course sans l'atteindre
	};

	// La tête à hauteurYeuxM du sol, le corps en (x, y) orienté selon angleCorps (radians,
	// repère du moteur), la cible en (cx, cy, cz).
	LFCORE_API OrientationRegard orienterRegard(double x, double y, double angleCorps, double hauteurYeuxM, double cx, double cy, double cz,
		const LimitesRegard& l = {});
	// La période de balayage d'un joueur, d'après son attribut de décision (0 : jamais).
	LFCORE_API double periodeBalayage(int decision, const ParametresRegard& p = {});
	LFCORE_API const char* nomSourceRegard(SourceRegard s);
}
