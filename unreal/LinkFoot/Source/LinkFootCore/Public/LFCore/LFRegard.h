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
	// La période de balayage d'un joueur, d'après son attribut de décision (0 : jamais).
	LFCORE_API double periodeBalayage(int decision, const ParametresRegard& p = {});
	LFCORE_API const char* nomSourceRegard(SourceRegard s);
}
