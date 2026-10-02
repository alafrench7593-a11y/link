#include "LFCore/LFVisage.h"

#include <algorithm>
#include <cmath>
#include <string>

namespace lf
{
	namespace
	{
		std::size_t indiceExpression(Expression e)
		{
			return static_cast<std::size_t>(e);
		}

		int campVisage(int code)
		{
			return code < 11 ? 0 : 1;
		}

		const std::vector<double>* listeAction(const Action& a, std::string_view cle)
		{
			for (const auto& l : a.listes)
			{
				if (l.first == cle)
				{
					return &l.second;
				}
			}
			return nullptr;
		}
	}

	ChroniqueVisages::ChroniqueVisages(const Cinematique& c, const ParametresVisage& p)
		: c_(c)
		, p_(p)
	{
		const DocumentMatch& doc = c.document();
		const auto present = [&](int k, double t) { return c.etat(k, t).valide; };
		const auto gardienDe = [&](int equipe, double t)
		{
			for (int k = equipe * 11; k < equipe * 11 + 11; ++k)
			{
				const FicheJoueur* f = doc.ficheA(k, t);
				if (f && f->estGardien() && present(k, t))
				{
					return k;
				}
			}
			return -1;
		};
		const auto autour = [&](int code, double t, double rayon, auto&& faire)
		{
			const EtatCinematique e = c.etat(code, t);
			if (!e.valide)
			{
				return;
			}
			for (int k = 0; k < kJoueurs; ++k)
			{
				const EtatCinematique q = c.etat(k, t);
				if (q.valide && std::hypot(q.x - e.x, q.y - e.y) <= rayon)
				{
					faire(k);
				}
			}
		};

		for (const Action& a : doc.actions)
		{
			const double t = a.t;
			const int code = a.code;
			if (code < 0 || code >= kJoueurs)
			{
				continue;
			}
			switch (a.type)
			{
			case TypeAction::But:
			{
				// l'équipe qui marque : celle de l'auteur, sauf contre son camp
				const bool csc = a.vrai("csc");
				const int marque = csc ? 1 - campVisage(code) : campVisage(code);
				for (int k = 0; k < kJoueurs; ++k)
				{
					if (!present(k, t))
					{
						continue;
					}
					if (campVisage(k) == marque)
					{
						if (!csc && k == code)
						{
							ajouter(k, t, Expression::Joie, 1.0, 12.0);	// son geste : la célébration, plus bas
						}
						else
						{
							ajouter(k, t, Expression::Joie, 0.75, 10.0, Geste::Applaudir, 3.0);
						}
					}
					else if (csc && k == code)
					{
						ajouter(k, t, Expression::Frustration, 0.95, 15.0, Geste::MainsSurLaTete, 3.0);
					}
					else if (k == gardienDe(campVisage(k), t))
					{
						ajouter(k, t, Expression::Frustration, 0.85, 15.0, Geste::MainsSurLaTete, 2.5);
					}
					else
					{
						ajouter(k, t, Expression::Frustration, 0.6, 12.0);
					}
				}
				break;
			}
			case TypeAction::Celebration:
				ajouter(code, t, Expression::Joie, 1.0, 12.0, Geste::Celebration, std::max(2.0, a.nombre("fin", t + 6.0) - t));
				break;
			case TypeAction::Tir:
			{
				const double xg = a.nombre("xg", 0.1);
				if (a.vrai("poteau"))
				{
					autour(code, t, 20.0, [&](int k) { ajouter(k, t, Expression::Surprise, 0.8, 2.0); });
				}
				if (a.texteVaut("issue", "miss"))
				{
					ajouter(code, t, Expression::Frustration, 0.55 + 0.4 * std::min(1.0, xg / 0.3), 4.0, xg >= 0.12 ? Geste::MainsSurLaTete : Geste::Aucun, 1.8);
				}
				else if (a.texteVaut("issue", "save"))
				{
					ajouter(code, t, Expression::Frustration, 0.45, 3.5);
				}
				else if (a.texteVaut("issue", "block"))
				{
					ajouter(code, t, Expression::Frustration, 0.3, 2.5);
				}
				break;
			}
			case TypeAction::Arret:
				ajouter(code, t, Expression::Soulagement, 0.65, 5.0, Geste::Consigne, 2.0);
				break;
			case TypeAction::Faute:
			{
				const std::string* carton = a.texte("carton");
				if (carton && !carton->empty())
				{
					ajouter(code, t, Expression::Colere, 0.65, 6.0, Geste::Protestation, 3.0);
				}
				else
				{
					ajouter(code, t, Expression::Frustration, 0.25, 2.0);
				}
				const int victime = static_cast<int>(std::lround(a.nombre("victime", -1.0)));
				if (victime >= 0 && victime < kJoueurs)
				{
					ajouter(victime, t, Expression::Douleur, 0.85, 3.5);
					// ses partenaires proches protestent, s'ils en ont le caractère
					autour(victime, t, 15.0, [&](int k)
					{
						if (k != victime && campVisage(k) == campVisage(victime))
						{
							ajouter(k, t, Expression::Colere, 0.35, 3.0, Geste::Protestation, 2.0);
						}
					});
				}
				break;
			}
			case TypeAction::Tacle:
			{
				const int cible = static_cast<int>(std::lround(a.nombre("cible", -1.0)));
				if (a.vrai("reussi"))
				{
					ajouter(code, t, Expression::Joie, 0.35, 3.0, Geste::PoingSerre, 1.2);
					if (cible >= 0 && cible < kJoueurs)
					{
						ajouter(cible, t, Expression::Frustration, 0.4, 3.0);
					}
				}
				else
				{
					ajouter(code, t, Expression::Frustration, 0.25, 2.0);
				}
				break;
			}
			case TypeAction::Dribble:
			{
				const int contre = static_cast<int>(std::lround(a.nombre("contre", -1.0)));
				if (a.vrai("reussi"))
				{
					ajouter(code, t, Expression::Joie, 0.25, 2.5);
					if (contre >= 0 && contre < kJoueurs)
					{
						ajouter(contre, t, Expression::Frustration, 0.45, 3.0);
					}
				}
				break;
			}
			case TypeAction::Interception:
			{
				ajouter(code, t, Expression::Joie, 0.2, 2.0);
				const int de = static_cast<int>(std::lround(a.nombre("de", -1.0)));
				if (de >= 0 && de < kJoueurs)
				{
					ajouter(de, t, Expression::Frustration, 0.4, 3.0);
				}
				break;
			}
			case TypeAction::Controle:
				if (a.texteVaut("niveau", "rate"))
				{
					ajouter(code, t, Expression::Frustration, 0.35, 2.5);
				}
				break;
			case TypeAction::HorsJeu:
				ajouter(code, t, Expression::Frustration, 0.4, 3.0, Geste::Protestation, 1.8);
				break;
			case TypeAction::Contre:
				ajouter(code, t, Expression::Joie, 0.3, 2.0, Geste::PoingSerre, 1.0);
				break;
			case TypeAction::DuelAerien:
			{
				ajouter(code, t, Expression::Joie, 0.15, 1.5);
				if (const std::vector<double>* autres = listeAction(a, "autres"))
				{
					for (const double v : *autres)
					{
						const int k = static_cast<int>(std::lround(v));
						if (k >= 0 && k < kJoueurs)
						{
							ajouter(k, t, Expression::Frustration, 0.2, 1.5);
						}
					}
				}
				break;
			}
			default:
				break;
			}
		}
		for (std::vector<Stimulus>& s : stimuli_)
		{
			std::stable_sort(s.begin(), s.end(), [](const Stimulus& a, const Stimulus& b) { return a.t < b.t; });
		}
	}

	void ChroniqueVisages::ajouter(int code, double t, Expression e, double force, double duree, Geste g, double dureeGeste)
	{
		if (code < 0 || code >= kJoueurs)
		{
			return;
		}
		const FicheJoueur* f = c_.document().ficheA(code, t);
		const Personnalite k = f ? f->personnalite : Personnalite{};
		// §27 le caractère règle l'amplitude, subtilement
		double m = 1.0;
		switch (e)
		{
		case Expression::Joie:
		case Expression::Surprise:
		case Expression::Soulagement:
			m = 0.6 + 0.8 * k.expressivite;
			break;
		case Expression::Frustration:
			m = (0.6 + 0.8 * k.expressivite) * (1.2 - 0.5 * k.calme) * (1.1 - 0.3 * k.confiance);
			break;
		case Expression::Colere:
			m = (0.5 + 1.0 * k.agressivite) * (1.2 - 0.5 * k.calme);
			break;
		case Expression::Douleur:
			m = 0.8 + 0.4 * k.expressivite;
			break;
		case Expression::Concentration:
		case Expression::Fatigue:
			break;
		}
		// les gestes qui tiennent au caractère (la célébration du buteur, jamais retenue)
		if ((g == Geste::Protestation && k.agressivite < 0.35 && force < 0.6) || (g == Geste::Applaudir && k.expressivite < 0.3)
			|| (g == Geste::MainsSurLaTete && k.expressivite < 0.25 && force < 0.8) || (g == Geste::PoingSerre && k.confiance < 0.45 && k.energie < 0.55))
		{
			g = Geste::Aucun;
		}
		Stimulus s;
		s.t = t;
		s.expression = e;
		s.force = std::clamp(force * m, 0.0, 1.0);
		s.duree = std::max(0.1, duree);
		s.geste = g;
		s.dureeGeste = g == Geste::Aucun ? 0.0 : dureeGeste;
		stimuli_[static_cast<std::size_t>(code)].push_back(s);
	}

	EtatVisage ChroniqueVisages::etat(int code, double t) const
	{
		EtatVisage r;
		if (code < 0 || code >= kJoueurs)
		{
			return r;
		}
		const EtatCinematique e = c_.etat(code, t);
		if (!e.valide)
		{
			return r;
		}
		r.valide = true;
		const std::vector<Stimulus>& S = stimuli_[static_cast<std::size_t>(code)];
		const auto debut = std::lower_bound(S.begin(), S.end(), t - 90.0, [](const Stimulus& s, double v) { return s.t < v; });
		const Stimulus* geste = nullptr;
		for (auto it = debut; it != S.end() && it->t <= t + 1e-9; ++it)
		{
			const double age = t - it->t;
			const double rampe = std::min(1.0, (age + 0.05) / p_.montee);
			double& w = r.poids[indiceExpression(it->expression)];
			w = std::max(w, it->force * rampe * std::exp(-age / it->duree));
			if (it->geste != Geste::Aucun && age <= it->dureeGeste)
			{
				geste = &*it;	// le plus récent l'emporte
			}
		}

		// ce que dit l'instant lui-même : le jeu autour de lui, le sol, l'énergie
		const DocumentMatch& doc = c_.document();
		const EtatBallon b = c_.ballon(t);
		const double auBallon = b.valide ? std::hypot(b.x - e.x, b.y - e.y) : 1e9;
		const int im = doc.indexImageA(t);
		const bool arrete = im >= 0 && doc.images[static_cast<std::size_t>(im)].cpa != Cpa::Aucun;
		double concentration = 0.25;
		if ((e.etats & etat::Porteur) != 0)
		{
			concentration = 0.6;
		}
		else if (auBallon < p_.rayonJeu)
		{
			concentration = 0.45;
		}
		if (arrete && auBallon < p_.rayonArrete)
		{
			concentration = 0.75;
		}
		double& c = r.poids[indiceExpression(Expression::Concentration)];
		c = std::max(c, concentration);
		if ((e.etats & etat::AuSol) != 0)
		{
			double& d = r.poids[indiceExpression(Expression::Douleur)];
			d = std::max(d, 0.6);
		}
		r.poids[indiceExpression(Expression::Fatigue)] = std::clamp((75.0 - e.energie) / 45.0, 0.0, 1.0);

		// la dominante : la plus forte (la concentration à égalité)
		r.dominante = Expression::Concentration;
		for (int i = 0; i < kExpressions; ++i)
		{
			if (r.poids[static_cast<std::size_t>(i)] > r.poids[indiceExpression(r.dominante)] + 1e-9)
			{
				r.dominante = static_cast<Expression>(i);
			}
		}

		if (geste)
		{
			r.geste = geste->geste;
			r.tempsGeste = t - geste->t;
			const double reste = geste->dureeGeste - r.tempsGeste;
			r.poidsGeste = std::clamp(std::min(r.tempsGeste / 0.2, reste / 0.4), 0.0, 1.0);
		}
		else if ((e.etats & etat::Appel) != 0 && (e.etats & etat::Porteur) == 0)
		{
			r.geste = Geste::Appel;
			r.poidsGeste = 0.8;
		}
		return r;
	}

	const char* nomExpression(Expression e)
	{
		switch (e)
		{
		case Expression::Concentration: return "concentration";
		case Expression::Frustration: return "frustration";
		case Expression::Joie: return "joie";
		case Expression::Colere: return "colère";
		case Expression::Douleur: return "douleur";
		case Expression::Surprise: return "surprise";
		case Expression::Soulagement: return "soulagement";
		case Expression::Fatigue: return "fatigue";
		}
		return "?";
	}

	const char* nomGeste(Geste g)
	{
		switch (g)
		{
		case Geste::Aucun: return "aucun";
		case Geste::Appel: return "appel";
		case Geste::Protestation: return "protestation";
		case Geste::MainsSurLaTete: return "mains sur la tête";
		case Geste::Applaudir: return "applaudir";
		case Geste::Celebration: return "célébration";
		case Geste::Consigne: return "consigne";
		case Geste::PoingSerre: return "poing serré";
		}
		return "?";
	}
}
