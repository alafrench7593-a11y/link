// LinkFoot, cœur portable : ce que montre le visage, et le geste du haut du corps (cahier
// « qualité visuelle » §25 à §27).
//
// Le moteur a joué le match ; on lit ici, pour chaque joueur et à chaque instant, ce que ses
// événements lui font : la joie du buteur et de ses partenaires, la frustration de ceux qui
// encaissent, du tireur qui manque, du défenseur éliminé, du passeur intercepté ; la colère du
// joueur averti, la douleur de celui qu'on a fauché ou qui est au sol, la surprise d'un poteau,
// le soulagement du gardien après un arrêt ; la concentration autour du ballon et avant un coup
// de pied arrêté ; la fatigue quand l'énergie baisse. Et le geste qui va avec : réclamer le
// ballon, protester, les mains sur la tête, applaudir, célébrer, donner une consigne, serrer
// le poing.
//
// La personnalité de la fiche (§27) règle l'amplitude, subtilement : un expressif montre plus,
// un calme encaisse mieux, un agressif proteste, un réservé n'applaudit pas toujours.
// Rien ne change le match : tout se lit dans le document.
#pragma once

#include "LFCore/LFCinematique.h"

#include <array>
#include <cstdint>
#include <vector>

namespace lf
{
	enum class Expression : std::uint8_t
	{
		Concentration,
		Frustration,
		Joie,
		Colere,
		Douleur,
		Surprise,
		Soulagement,
		Fatigue
	};

	constexpr int kExpressions = 8;

	enum class Geste : std::uint8_t
	{
		Aucun,
		Appel,			// réclame le ballon, le bras levé
		Protestation,	// les bras ouverts vers l'arbitre
		MainsSurLaTete,	// l'occasion manquée, le but encaissé
		Applaudir,		// le but d'un partenaire
		Celebration,	// son but
		Consigne,		// replace, organise (le gardien après un arrêt)
		PoingSerre		// le tacle gagné, le tir contré
	};

	struct EtatVisage
	{
		bool valide = false;
		std::array<double, kExpressions> poids{};	// 0 à 1, par Expression
		Expression dominante = Expression::Concentration;
		Geste geste = Geste::Aucun;
		double poidsGeste = 0.0;	// 0 à 1 : monte, tient, retombe
		double tempsGeste = 0.0;	// secondes depuis le début du geste
	};

	struct ParametresVisage
	{
		double montee = 0.15;			// s : une émotion monte en 0,15 s
		double rayonJeu = 15.0;			// m du ballon : on est dans le jeu, concentré
		double rayonArrete = 25.0;		// m du ballon arrêté : concentré avant le coup de pied
	};

	class LFCORE_API ChroniqueVisages
	{
	public:
		explicit ChroniqueVisages(const Cinematique& c, const ParametresVisage& p = {});

		EtatVisage etat(int code, double t) const;

	private:
		struct Stimulus
		{
			double t = 0.0;
			Expression expression = Expression::Concentration;
			double force = 0.0;		// déjà réglée par la personnalité
			double duree = 1.0;		// s : constante de décroissance
			Geste geste = Geste::Aucun;
			double dureeGeste = 0.0;
		};

		const Cinematique& c_;
		ParametresVisage p_;
		std::array<std::vector<Stimulus>, kJoueurs> stimuli_;

		void ajouter(int code, double t, Expression e, double force, double duree, Geste g = Geste::Aucun, double dureeGeste = 0.0);
	};

	LFCORE_API const char* nomExpression(Expression e);
	LFCORE_API const char* nomGeste(Geste g);
}
