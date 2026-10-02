#include "LFCore/LFEtatMatch.h"

#include <algorithm>
#include <cmath>
#include <string>

namespace lf
{
	namespace
	{
		constexpr double kEps = 1e-9;

		bool estFrappeAction(const Action& a)
		{
			return a.estFrappe();
		}

		bool sansCoupDePiedArrete(const Action& a)
		{
			return a.texte("cpa") == nullptr;
		}

		std::string genreDe(const Action& a)
		{
			const std::string* g = a.texte("genre");
			return g ? *g : std::string();
		}

		// Une passe choisie par le porteur, comptée par le moteur (W.st.pa) : pas un coup de pied
		// arrêté, pas la déviation de la tête qui suit un duel aérien (même joueur, même instant).
		bool estPasseComptee(const std::vector<Action>& A, std::size_t i)
		{
			const Action& a = A[i];
			if (a.type != TypeAction::Passe || !sansCoupDePiedArrete(a))
			{
				return false;
			}
			if (i > 0)
			{
				const Action& p = A[i - 1];
				if (p.type == TypeAction::DuelAerien && p.code == a.code && std::fabs(p.t - a.t) < kEps)
				{
					return false;
				}
			}
			return true;
		}

		// Un duel aérien gagné en défense sur un centre (corner, coup franc centré compris) : le
		// moteur le compte comme un ballon gagné, sauf quand le duel finit en faute.
		bool estDuelAerienDefensifGagne(const std::vector<Action>& A, std::size_t i, int frappe)
		{
			const Action& a = A[i];
			if (a.type != TypeAction::DuelAerien || frappe < 0 || a.code < 0)
			{
				return false;
			}
			const Action& f = A[static_cast<std::size_t>(frappe)];
			const std::string g = genreDe(f);
			if (g != "cross" && g != "corner" && g != "fkc")
			{
				return false;
			}
			if (f.code < 0 || equipeDe(f.code) == equipeDe(a.code))
			{
				return false;
			}
			if (i + 1 < A.size())
			{
				const Action& s = A[i + 1];
				if (s.type == TypeAction::Faute && std::fabs(s.t - a.t) < kEps)
				{
					return false;
				}
			}
			return true;
		}
	}

	ChroniqueMatch::ChroniqueMatch(const Cinematique& c)
		: c_(c)
	{
		const DocumentMatch& doc = c.document();
		const std::vector<Action>& A = doc.actions;

		// 1. Frappe et contrôle précédents, pour chaque action.
		frappePrecedente_.assign(A.size(), -1);
		controlePrecedent_.assign(A.size(), -1);
		int frappe = -1, controle = -1;
		for (std::size_t i = 0; i < A.size(); ++i)
		{
			frappePrecedente_[i] = frappe;
			controlePrecedent_[i] = controle;
			if (estFrappeAction(A[i]))
			{
				frappe = static_cast<int>(i);
			}
			if (A[i].type == TypeAction::Controle)
			{
				controle = static_cast<int>(i);
			}
		}

		// 2. La possession, image par image (règle du moteur : le porteur, sinon le passeur tant
		// que son ballon roule au sol ; un ballon aérien, une passe longue ou un centre ne
		// comptent pour personne).
		const std::vector<Vol>& vols = c.vols();
		const std::size_t n = doc.images.size();
		possessionCumul_[0].assign(n, 0);
		possessionCumul_[1].assign(n, 0);
		std::size_t iv = 0;
		int cumul[2] = { 0, 0 };
		for (std::size_t i = 0; i < n; ++i)
		{
			const Image& im = doc.images[i];
			const double t = im.temps();
			int equipe = -1;
			if (im.porteur >= 0 && im.porteur < kJoueurs)
			{
				equipe = equipeDe(im.porteur);
			}
			else
			{
				while (iv < vols.size() && vols[iv].tFin < t - kEps)
				{
					++iv;
				}
				for (std::size_t k = iv; k < vols.size() && vols[k].t0 <= t + kEps; ++k)
				{
					const Vol& v = vols[k];
					if (t > v.tFin + kEps || v.action < 0 || v.de < 0)
					{
						continue;
					}
					const Action& a = A[static_cast<std::size_t>(v.action)];
					const std::string g = genreDe(a);
					if (!a.vrai("aerien") && g != "long" && g != "cross")
					{
						equipe = equipeDe(v.de);
					}
				}
			}
			if (equipe >= 0)
			{
				++cumul[equipe];
			}
			possessionCumul_[0][i] = cumul[0];
			possessionCumul_[1][i] = cumul[1];
		}

		// 3. Qui est sur le terrain, et quand : titulaires du coup d'envoi jusqu'à leur sortie,
		// remplaçants de leur entrée à leur sortie, l'expulsé jusqu'à son carton rouge.
		const std::size_t nf = doc.joueurs.size();
		const double debut = doc.images.empty() ? doc.debut : doc.images.front().temps();
		const double inf = 1e18;
		entree_.assign(nf, inf);
		sortie_.assign(nf, inf);
		for (std::size_t i = 0; i < nf; ++i)
		{
			if (doc.joueurs[i].code >= 0)
			{
				entree_[i] = debut;
			}
		}
		for (const Remplacement& r : doc.remplacements)
		{
			const int avant = ficheDe(r.code, r.t - 1e-6);
			if (avant >= 0)
			{
				sortie_[static_cast<std::size_t>(avant)] = std::min(sortie_[static_cast<std::size_t>(avant)], r.t);
			}
			if (r.indexFiche >= 0)
			{
				entree_[static_cast<std::size_t>(r.indexFiche)] = r.t;
			}
		}
		for (const Action& a : A)
		{
			if (a.type != TypeAction::Faute || a.code < 0)
			{
				continue;
			}
			const std::string* carton = a.texte("carton");
			if (carton && (*carton == "R" || *carton == "R2"))
			{
				const int f = ficheDe(a.code, a.t);
				if (f >= 0)
				{
					sortie_[static_cast<std::size_t>(f)] = std::min(sortie_[static_cast<std::size_t>(f)], a.t);
				}
			}
		}
	}

	int ChroniqueMatch::ficheDe(int code, double t) const
	{
		const DocumentMatch& doc = c_.document();
		const FicheJoueur* f = doc.ficheA(code, t);
		if (!f || doc.joueurs.empty())
		{
			return -1;
		}
		return static_cast<int>(f - doc.joueurs.data());
	}

	int ChroniqueMatch::horlogeA(double t) const
	{
		const DocumentMatch& doc = c_.document();
		if (doc.images.empty())
		{
			return 0;
		}
		const int i = doc.indexImageA(t);
		return doc.images[static_cast<std::size_t>(std::max(0, i))].horloge;
	}

	double ChroniqueMatch::possessionDomicile(double t) const
	{
		const DocumentMatch& doc = c_.document();
		const int i = doc.indexImageA(t);
		if (i < 0)
		{
			return 50.0;
		}
		const int h = possessionCumul_[0][static_cast<std::size_t>(i)];
		const int a = possessionCumul_[1][static_cast<std::size_t>(i)];
		return h + a > 0 ? 100.0 * h / (h + a) : 50.0;
	}

	EtatMatch ChroniqueMatch::etat(double t) const
	{
		const DocumentMatch& doc = c_.document();
		const std::vector<Action>& A = doc.actions;
		EtatMatch e;
		e.t = t;
		e.joueurs.assign(doc.joueurs.size(), StatsJoueur{});
		const int im = doc.indexImageA(t);
		if (im < 0)
		{
			return e;
		}
		e.valide = true;
		const Image& image = doc.images[static_cast<std::size_t>(im)];
		e.horloge = image.horloge;
		e.miTemps = image.miTemps;
		e.score = { image.score[0], image.score[1] };
		e.porteur = image.porteur;
		e.cpa = image.cpa;
		e.ballon = c_.ballon(t);
		e.possessionDomicile = possessionDomicile(t);
		e.termine = im + 1 == static_cast<int>(doc.images.size());

		auto stats = [&](int code, double ta) -> StatsJoueur*
		{
			const int f = code >= 0 && code < kJoueurs ? ficheDe(code, ta) : -1;
			return f >= 0 ? &e.joueurs[static_cast<std::size_t>(f)] : nullptr;
		};

		for (std::size_t i = 0; i < A.size() && A[i].t <= t + kEps; ++i)
		{
			const Action& a = A[i];
			e.actionsJouees = static_cast<int>(i) + 1;
			if (a.code < 0 || a.code >= kJoueurs)
			{
				continue;
			}
			const int eq = equipeDe(a.code);
			StatsEquipe& se = e.equipes[static_cast<std::size_t>(eq)];
			StatsJoueur* sj = stats(a.code, a.t);
			const int frappe = frappePrecedente_[i];
			switch (a.type)
			{
			case TypeAction::Tir:
			{
				const std::string* issue = a.texte("issue");
				const bool cadre = issue && (*issue == "goal" || *issue == "save");
				const double xg = a.nombre("xg", 0.0);
				++se.tirs;
				se.tirsCadres += cadre ? 1 : 0;
				se.xg += xg;
				if (sj)
				{
					++sj->tirs;
					sj->tirsCadres += cadre ? 1 : 0;
					sj->xg += xg;
				}
				// La passe clé : le tireur a reçu la dernière passe du match moins de 5 s plus tôt
				// (la règle qui classe un tir « sur passe » dans le moteur).
				const int lc = controlePrecedent_[i];
				if (lc >= 0)
				{
					const Action& ctl = A[static_cast<std::size_t>(lc)];
					const int fp = frappePrecedente_[static_cast<std::size_t>(lc)];
					if (ctl.code == a.code && a.t - ctl.t < 5.0 && fp >= 0)
					{
						const Action& passe = A[static_cast<std::size_t>(fp)];
						if (passe.code >= 0 && passe.code != a.code && equipeDe(passe.code) == eq)
						{
							if (StatsJoueur* passeur = stats(passe.code, passe.t))
							{
								++passeur->passesCles;
								passeur->xa += xg;
							}
						}
					}
				}
				if (const std::string* cpa = a.texte("cpa"); cpa && *cpa == "corner")
				{
					++se.corners;
				}
				break;
			}
			case TypeAction::Passe:
			{
				if (const std::string* cpa = a.texte("cpa"); cpa && *cpa == "corner")
				{
					++se.corners;
				}
				if (estPasseComptee(A, i))
				{
					++se.passes;
					if (sj)
					{
						++sj->passes;
					}
				}
				break;
			}
			case TypeAction::Controle:
			{
				// Tout contrôle du moteur est la réception d'un ballon frappé par un partenaire
				// (receive) : une passe réussie pour l'équipe (W.st.pc).
				++se.passesReussies;
				const std::string* niveau = a.texte("niveau");
				if (niveau && *niveau == "rate" && sj)
				{
					++sj->pertes;
				}
				if (frappe >= 0 && estPasseComptee(A, static_cast<std::size_t>(frappe)))
				{
					const Action& passe = A[static_cast<std::size_t>(frappe)];
					if (passe.code >= 0 && equipeDe(passe.code) == eq)
					{
						if (StatsJoueur* passeur = stats(passe.code, passe.t))
						{
							++passeur->passesReussies;
						}
					}
				}
				break;
			}
			case TypeAction::Faute:
			{
				++se.fautes;
				const std::string* carton = a.texte("carton");
				const bool jaune = carton && (*carton == "Y" || *carton == "R2");
				const bool rouge = carton && (*carton == "R" || *carton == "R2");
				se.jaunes += jaune ? 1 : 0;
				se.rouges += rouge ? 1 : 0;
				if (sj)
				{
					++sj->fautes;
					sj->jaunes += jaune ? 1 : 0;
					sj->exclu = sj->exclu || rouge;
				}
				break;
			}
			case TypeAction::HorsJeu:
				++se.horsJeu;
				break;
			case TypeAction::Interception:
			{
				++se.tacles;
				if (sj)
				{
					++sj->tacles;
					++sj->interceptions;
				}
				const int de = static_cast<int>(std::lround(a.nombre("de", -1.0)));
				if (de >= 0 && de < kJoueurs)
				{
					if (StatsJoueur* perdant = stats(de, a.t))
					{
						++perdant->pertes;
					}
				}
				break;
			}
			case TypeAction::Contre:
				++se.tacles;
				if (sj)
				{
					++sj->tacles;
				}
				break;
			case TypeAction::Tacle:
			{
				const bool reussi = a.vrai("reussi");
				const int cible = static_cast<int>(std::lround(a.nombre("cible", -1.0)));
				if (reussi)
				{
					++se.tacles;
					if (sj)
					{
						++sj->tacles;
					}
				}
				// Le tacle qui suit un dribble raté (même instant, même duel) est déjà compté.
				bool suiteDeDribble = false;
				if (i > 0)
				{
					const Action& p = A[i - 1];
					suiteDeDribble = p.type == TypeAction::Dribble && std::fabs(p.t - a.t) < kEps && p.code == cible;
				}
				if (!suiteDeDribble)
				{
					if (sj)
					{
						++sj->duels;
						sj->duelsGagnes += reussi ? 1 : 0;
					}
					if (cible >= 0 && cible < kJoueurs)
					{
						if (StatsJoueur* sc = stats(cible, a.t))
						{
							++sc->duels;
							sc->duelsGagnes += reussi ? 0 : 1;
							sc->pertes += reussi ? 1 : 0;
						}
					}
				}
				break;
			}
			case TypeAction::Dribble:
			{
				const bool reussi = a.vrai("reussi");
				const int contre = static_cast<int>(std::lround(a.nombre("contre", -1.0)));
				if (sj)
				{
					++sj->dribbles;
					++sj->duels;
					sj->dribblesReussis += reussi ? 1 : 0;
					sj->duelsGagnes += reussi ? 1 : 0;
					sj->pertes += reussi ? 0 : 1;
				}
				if (contre >= 0 && contre < kJoueurs)
				{
					if (StatsJoueur* sc = stats(contre, a.t))
					{
						++sc->duels;
						sc->duelsGagnes += reussi ? 0 : 1;
					}
				}
				break;
			}
			case TypeAction::DuelAerien:
			{
				if (estDuelAerienDefensifGagne(A, i, frappe))
				{
					++se.tacles;
					if (sj)
					{
						++sj->tacles;
					}
				}
				if (sj)
				{
					++sj->duels;
					++sj->duelsGagnes;
				}
				for (const auto& liste : a.listes)
				{
					if (liste.first != "autres")
					{
						continue;
					}
					for (double v : liste.second)
					{
						const int autre = static_cast<int>(std::lround(v));
						if (autre >= 0 && autre < kJoueurs)
						{
							if (StatsJoueur* sa = stats(autre, a.t))
							{
								++sa->duels;
							}
						}
					}
				}
				break;
			}
			case TypeAction::Arret:
				if (sj)
				{
					++sj->arrets;
				}
				break;
			case TypeAction::But:
			{
				const bool contreSonCamp = a.vrai("csc");
				++e.equipes[static_cast<std::size_t>(contreSonCamp ? 1 - eq : eq)].buts;
				if (!contreSonCamp)
				{
					if (sj)
					{
						++sj->buts;
					}
					// La passe décisive, règle du moteur : la dernière passe reçue du match l'a été
					// par le buteur, moins de 12 s avant le but, d'un partenaire.
					const int lc = controlePrecedent_[i];
					if (lc >= 0)
					{
						const Action& ctl = A[static_cast<std::size_t>(lc)];
						const int fp = frappePrecedente_[static_cast<std::size_t>(lc)];
						if (ctl.code == a.code && a.t - ctl.t < 12.0 && fp >= 0)
						{
							const Action& passe = A[static_cast<std::size_t>(fp)];
							if (passe.code >= 0 && passe.code != a.code && equipeDe(passe.code) == eq)
							{
								if (StatsJoueur* passeur = stats(passe.code, passe.t))
								{
									++passeur->passesDecisives;
								}
							}
						}
					}
				}
				break;
			}
			default:
				break;
			}
		}

		// Les minutes, à l'horloge du match, et la note du moteur au coup de sifflet final.
		const int horloge = e.horloge;
		for (std::size_t f = 0; f < e.joueurs.size(); ++f)
		{
			StatsJoueur& sj = e.joueurs[f];
			if (entree_[f] > t + kEps)
			{
				continue;
			}
			sj.aJoue = true;
			const int h0 = horlogeA(entree_[f]);
			const int h1 = sortie_[f] <= t + kEps ? horlogeA(sortie_[f]) : horloge;
			sj.minutes = std::max(0, h1 - h0) / 60.0;
		}
		if (e.termine)
		{
			for (int code = 0; code < kJoueurs; ++code)
			{
				const std::vector<double>& notes = doc.notesFinales[static_cast<std::size_t>(equipeDe(code))];
				const std::size_t k = static_cast<std::size_t>(code < 11 ? code : code - 11);
				const int f = ficheDe(code, t);
				if (f >= 0 && k < notes.size() && notes[k] >= 0.0)
				{
					e.joueurs[static_cast<std::size_t>(f)].note = notes[k];
				}
			}
		}
		return e;
	}
}
