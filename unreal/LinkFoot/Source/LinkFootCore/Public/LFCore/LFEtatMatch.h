// LinkFoot, cœur portable : l'état du match à un instant donné (§6 du cahier AAA,
// FLinkFootMatchState) et les statistiques (§60).
//
// Il n'y a qu'une simulation : le moteur LinkFoot. Cet état n'en est pas une seconde. Il se
// LIT dans ce que le moteur a joué : le score et l'horloge dans les images, la possession
// dans les images et les vols du ballon, les statistiques dans les actions. Les règles de
// comptage sont celles du moteur (src/engine.js), et les tests le prouvent : à la fin du
// match, chaque statistique recalculée ici est celle que le moteur a comptée, au chiffre près.
// La 2D, la 3D de l'app et Unreal affichent donc les mêmes nombres, à chaque instant.
//
// Les statistiques des joueurs (§60) suivent les mêmes règles, attribuées à chacun :
//   - passes : celles que le porteur a choisies (pas les coups de pied arrêtés, pas les
//     déviations de la tête), et réussies quand un partenaire les reçoit ;
//   - passe décisive : la règle du moteur (la dernière passe reçue par le buteur, moins de 12 s
//     avant le but) ; passe clé et xA : la règle qui classe un tir « sur passe » (moins de 5 s) ;
//   - ballons gagnés (tacles) : interceptions, tacles réussis, tirs contrés, duels aériens
//     gagnés en défense sur un centre, comme le compteur tk du moteur ;
//   - duels : aériens (le vainqueur et les autres sauteurs), au sol (dribble contre défenseur,
//     tacle contre porteur, compté une fois quand le tacle suit un dribble raté) ;
//   - pertes : contrôle raté, dribble raté, passe interceptée, ballon perdu sur un tacle ;
//   - la note est celle du moteur, connue au coup de sifflet final.
#pragma once

#include "LFCore/LFCinematique.h"

#include <array>
#include <vector>

namespace lf
{
	struct StatsJoueur
	{
		double minutes = 0.0;		// à l'horloge du match
		int buts = 0;
		int passesDecisives = 0;
		int tirs = 0;
		int tirsCadres = 0;
		int passes = 0;
		int passesReussies = 0;
		int passesCles = 0;
		int dribbles = 0;
		int dribblesReussis = 0;
		int tacles = 0;				// ballons gagnés (la règle tk du moteur)
		int interceptions = 0;
		int duels = 0;
		int duelsGagnes = 0;
		int fautes = 0;
		int pertes = 0;
		int arrets = 0;
		int jaunes = 0;
		bool exclu = false;
		double xg = 0.0;
		double xa = 0.0;
		double note = -1.0;			// la note du moteur, au coup de sifflet final (-1 avant)
		bool aJoue = false;			// est entré sur le terrain avant cet instant
	};

	struct EtatMatch
	{
		bool valide = false;
		double t = 0.0;				// temps du moteur (secondes)
		int horloge = 0;			// l'horloge affichée (secondes)
		int miTemps = 1;
		std::array<int, 2> score{};	// lu dans les images
		double possessionDomicile = 50.0;	// % du temps de possession jusqu'à t
		int porteur = -1;
		Cpa cpa = Cpa::Aucun;
		EtatBallon ballon;
		std::array<StatsEquipe, 2> equipes;	// 0 : domicile, 1 : extérieur
		std::vector<StatsJoueur> joueurs;	// une par fiche (DocumentMatch::joueurs), remplaçants compris
		int actionsJouees = 0;		// actions du moteur à t ou avant
		bool termine = false;		// t est au coup de sifflet final
	};

	class LFCORE_API ChroniqueMatch
	{
	public:
		explicit ChroniqueMatch(const Cinematique& c);

		// L'état du match à l'instant t (secondes du moteur).
		EtatMatch etat(double t) const;
		// L'index (dans DocumentMatch::joueurs) de la fiche qui porte ce code à l'instant t.
		int ficheDe(int code, double t) const;
		// La possession du domicile jusqu'à t, en % (règle du moteur : porteur, ou passe au sol en vol).
		double possessionDomicile(double t) const;

	private:
		const Cinematique& c_;
		std::vector<int> possessionCumul_[2];	// par image : nombre d'images en possession, cumulé
		std::vector<int> frappePrecedente_;		// par action : la dernière frappe avant elle (-1)
		std::vector<int> controlePrecedent_;	// par action : le dernier contrôle avant elle (-1)
		std::vector<double> entree_, sortie_;	// par fiche : sur le terrain dans [entree, sortie)
		int horlogeA(double t) const;
	};

	// L'équipe d'un code (0 : domicile, codes 0 à 10 ; 1 : extérieur, codes 11 à 21).
	inline int equipeDe(int code)
	{
		return code < 11 ? 0 : 1;
	}
}
