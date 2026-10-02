#include "LFCore/LFScene.h"

#include "LFCore/LFRepere.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <utility>

namespace lf
{
	namespace
	{
		std::string fmtScene(double v, int decimales = 1)
		{
			char tampon[48];
			std::snprintf(tampon, sizeof(tampon), "%.*f", decimales, v);
			return tampon;
		}

		const Action* actionScene(const DocumentMatch& doc, int code, TypeAction type, double instant, double tolerance)
		{
			const Action* meilleure = nullptr;
			for (const Action& a : doc.actions)
			{
				if (a.code == code && a.type == type && std::fabs(a.t - instant) <= tolerance)
				{
					if (!meilleure || std::fabs(a.t - instant) < std::fabs(meilleure->t - instant))
					{
						meilleure = &a;
					}
				}
			}
			return meilleure;
		}

		double vitesseScene(const Cinematique& c, int code, double t)
		{
			const EtatCinematique e = c.etat(code, t);
			return e.valide ? e.vitesse : 0.0;
		}

		VerdictScene verdict(bool ok, std::string detail)
		{
			VerdictScene v;
			v.ok = ok;
			v.detail = std::move(detail);
			return v;
		}

		// Les joueurs d'un camp qui pressent, et la distance du plus proche au porteur adverse,
		// en moyenne sur les images où l'adversaire a le ballon en jeu.
		void pressingScene(const DocumentMatch& doc, char camp, double t0, double t1, double& presseurs, double& distance, int& images)
		{
			presseurs = 0.0;
			distance = 0.0;
			images = 0;
			const int premier = camp == 'H' ? 0 : 11;
			for (const Image& im : doc.images)
			{
				if (im.temps() < t0 || im.temps() > t1 || im.porteur < 0 || im.cpa != Cpa::Aucun)
				{
					continue;
				}
				const bool adverse = camp == 'H' ? im.porteur >= 11 : im.porteur < 11;
				if (!adverse)
				{
					continue;
				}
				const JoueurImage& p = im.joueurs[static_cast<std::size_t>(im.porteur)];
				double proche = 1e9;
				int n = 0;
				for (int k = premier + 1; k < premier + 11; ++k)
				{
					const JoueurImage& q = im.joueurs[static_cast<std::size_t>(k)];
					if (!q.present)
					{
						continue;
					}
					n += (q.etats & etat::Presse) ? 1 : 0;
					proche = std::min(proche, std::hypot(static_cast<double>(q.x - p.x), static_cast<double>(q.y - p.y)));
				}
				presseurs += n;
				distance += proche;
				++images;
			}
			if (images > 0)
			{
				presseurs /= images;
				distance /= images;
			}
		}
	}

	double changementCapDeg(const Cinematique& c, int code, double t0, double t1)
	{
		const EtatCinematique a = c.etat(code, t0), b = c.etat(code, t1);
		if (!a.valide || !b.valide || a.vitesse < 0.5 || b.vitesse < 0.5)
		{
			return 0.0;
		}
		return angleNormaliseDeg((std::atan2(b.vy, b.vx) - std::atan2(a.vy, a.vx)) * kDegParRad);
	}

	VerdictScene verifierScene(const DocumentMatch& doc, const Cinematique& c)
	{
		if (!doc.estScene)
		{
			return verdict(false, "ce document n'est pas une scène");
		}
		const InfoScene& s = doc.scene;
		const int f = s.focus;
		const double ti = s.instant;
		const std::string& id = s.id;
		if (f < 0 || f >= kJoueurs || !c.etat(f, ti).valide)
		{
			return verdict(false, "le joueur à regarder n'est pas sur le terrain à l'instant clé");
		}

		if (id == "sprint_droit")
		{
			double pointe = 0.0;
			for (double t = ti - 1.0; t <= ti + 1.0; t += 0.05)
			{
				pointe = std::max(pointe, vitesseScene(c, f, t));
			}
			const double vmax = doc.vitesseMax(f, ti);
			const double cap = changementCapDeg(c, f, ti - 1.0, ti + 1.0);
			return verdict(pointe >= 0.85 * vmax && std::fabs(cap) < 15.0,
				"pointe " + fmtScene(pointe, 2) + " m/s pour une vitesse max de " + fmtScene(vmax, 2) + ", cap " + fmtScene(cap, 0) + "° en 2 s");
		}
		if (id == "sprint_virage_90")
		{
			const double v0 = vitesseScene(c, f, ti), v1 = vitesseScene(c, f, ti + 1.2);
			const double cap = changementCapDeg(c, f, ti, ti + 1.2);
			return verdict(v0 >= 4.0 && v1 >= 3.0 && std::fabs(cap) >= 70.0 && std::fabs(cap) <= 110.0,
				fmtScene(v0, 1) + " m/s, virage de " + fmtScene(cap, 0) + "° en 1,2 s, " + fmtScene(v1, 1) + " m/s en sortie");
		}
		if (id == "sprint_arret")
		{
			const double v0 = vitesseScene(c, f, ti);
			double arret = -1.0, freinMax = 0.0;
			for (double t = ti; t <= ti + 3.0; t += 0.05)
			{
				const EtatCinematique e = c.etat(f, t);
				freinMax = std::max(freinMax, -e.accelerationLongitudinale);
				if (e.vitesse < 0.5)
				{
					arret = t;
					break;
				}
			}
			const bool ok = v0 >= 6.0 && arret > 0.0 && arret - ti >= 0.6 && freinMax <= 14.0;
			return verdict(ok, "de " + fmtScene(v0, 1) + " m/s à l'arrêt en " + (arret > 0.0 ? fmtScene(arret - ti, 2) + " s" : "jamais")
				+ ", freinage max " + fmtScene(freinMax, 1) + " m/s² (§13 pas de freinage instantané)");
		}
		if (id == "reception_course" || id == "reception_pression")
		{
			const Action* a = actionScene(doc, f, TypeAction::Controle, ti, 0.15);
			if (!a)
			{
				return verdict(false, "aucun contrôle du joueur à l'instant clé");
			}
			const double v = vitesseScene(c, f, a->t);
			const std::string* niveau = a->texte("niveau");
			if (id == "reception_course")
			{
				return verdict(v >= 4.0, "contrôle à " + fmtScene(v, 1) + " m/s" + (niveau ? ", " + *niveau : ""));
			}
			return verdict(a->vrai("presse"), std::string("contrôle avec un adversaire à moins de 2 m") + (niveau ? ", " + *niveau : ""));
		}
		if (id == "dribble_changement")
		{
			const Action* a = actionScene(doc, f, TypeAction::Dribble, ti, 0.15);
			const double cap = changementCapDeg(c, f, ti - 0.5, ti + 0.7);
			const std::string* g = a ? a->texte("geste") : nullptr;
			return verdict(a && std::fabs(cap) >= 45.0, (g ? *g : std::string("pas de dribble")) + ", changement de direction de " + fmtScene(cap, 0) + "°");
		}
		if (id == "duel_epaule")
		{
			const Action* a = actionScene(doc, f, TypeAction::Dribble, ti, 0.15);
			if (!a || !a->texteVaut("geste", "protect"))
			{
				return verdict(false, "pas de protection de balle à l'instant clé");
			}
			const int contre = static_cast<int>(std::lround(a->nombre("contre", -1)));
			const EtatCinematique e = c.etat(f, ti), o = c.etat(contre, ti);
			const double d = o.valide ? std::hypot(o.x - e.x, o.y - e.y) : 1e9;
			return verdict(o.valide && d <= 1.6, "protection de balle, le défenseur à " + fmtScene(d, 2) + " m");
		}
		if (id == "tacle_glisse")
		{
			const Action* a = actionScene(doc, f, TypeAction::Tacle, ti, 0.15);
			return verdict(a && a->texteVaut("genre", "glisse"), a ? std::string(a->vrai("reussi") ? "tacle glissé réussi" : "tacle glissé manqué") : "pas de tacle");
		}
		if (id == "centre_tete")
		{
			const Action* tete = actionScene(doc, f, TypeAction::Tir, ti, 0.15);
			const bool deTete = (tete && tete->vrai("tete")) || actionScene(doc, f, TypeAction::DuelAerien, ti, 0.15);
			const Action* centre = nullptr;
			for (const Action& a : doc.actions)
			{
				const std::string* g = a.texte("genre");
				if (a.type == TypeAction::Passe && g && (*g == "cross" || *g == "corner" || *g == "fkc") && a.t >= ti - 3.0 && a.t <= ti - 0.2)
				{
					centre = &a;
				}
			}
			return verdict(deTete && centre != nullptr, centre ? "centre (" + *centre->texte("genre") + ") puis tête " + fmtScene(ti - centre->t, 1) + " s après" : "pas de centre");
		}
		if (id == "un_contre_un")
		{
			const Action* a = actionScene(doc, f, TypeAction::Tir, ti, 0.15);
			const int gardien = f < 11 ? 11 : 0;
			const EtatCinematique e = c.etat(f, ti), g = c.etat(gardien, ti);
			const double d = g.valide ? std::hypot(g.x - e.x, g.y - e.y) : 1e9;
			return verdict(a && d <= 9.0, std::string(a ? "tir" : "pas de tir") + ", le gardien à " + fmtScene(d, 1) + " m"
				+ (a && a->texte("issue") ? ", " + *a->texte("issue") : ""));
		}
		if (id == "pressing_haut")
		{
			double presseurs = 0, distance = 0;
			int images = 0;
			pressingScene(doc, 'H', s.t0, s.t1, presseurs, distance, images);
			const double reglage = doc.equipes[0].reglage("press", -1);
			const bool accord = std::fabs(presseurs - s.mesure("presseurs", -99)) < 0.01;
			return verdict(reglage == 2.0 && presseurs >= 1.5 && images >= 20 && accord,
				"pressing réglé à " + fmtScene(reglage, 0) + ", " + fmtScene(presseurs, 2) + " presseur(s) en moyenne, le plus proche à " + fmtScene(distance, 1)
					+ " m du porteur (" + std::to_string(images) + " images)" + (accord ? "" : ", différent de la mesure JS"));
		}
		if (id == "bloc_bas")
		{
			const char camp = f < 11 ? 'H' : 'A';
			const int premier = camp == 'H' ? 0 : 11;
			int images = 0, groupes = 0;
			for (const Image& im : doc.images)
			{
				if (im.temps() < s.t0 || im.temps() > s.t1 || im.porteur < 0 || im.cpa != Cpa::Aucun)
				{
					continue;
				}
				if ((camp == 'H') == (im.porteur < 11))
				{
					continue;	// on regarde quand l'adversaire a le ballon
				}
				const JoueurImage& gb = im.joueurs[static_cast<std::size_t>(premier)];
				const double but = gb.y < 52.5f ? 0.0 : 105.0;
				int bas = 0;
				for (int k = premier + 1; k < premier + 11; ++k)
				{
					const JoueurImage& q = im.joueurs[static_cast<std::size_t>(k)];
					bas += q.present && std::fabs(static_cast<double>(q.y) - but) <= 35.0 ? 1 : 0;
				}
				groupes += bas >= 8 ? 1 : 0;
				++images;
			}
			const double part = images ? static_cast<double>(groupes) / images : 0.0;
			return verdict(images >= 30 && part >= 0.6, fmtScene(100.0 * part, 0) + " % des images avec au moins 8 joueurs dans leurs 35 derniers mètres ("
				+ std::to_string(images) + " images)");
		}
		if (id == "contre_attaque")
		{
			const Action* tir = actionScene(doc, f, TypeAction::Tir, ti, 0.15);
			if (!tir)
			{
				return verdict(false, "pas de tir à l'instant clé");
			}
			const bool nous = f < 11;
			const Action* recup = nullptr;
			for (const Action& a : doc.actions)
			{
				if (a.t < ti - 15.0 || a.t > ti - 2.0 || a.code < 0 || (a.code < 11) != nous)
				{
					continue;
				}
				if (a.type == TypeAction::Interception || (a.type == TypeAction::Tacle && a.vrai("reussi")))
				{
					recup = &a;
				}
			}
			if (!recup)
			{
				return verdict(false, "pas de récupération dans les 15 s avant le tir");
			}
			const double but = tir->nombre("y1", 0) < 52.5 ? 0.0 : 105.0;
			const EtatBallon b0 = c.ballon(recup->t), b1 = c.ballon(tir->t);
			const double gain = std::fabs(b0.y - but) - std::fabs(b1.y - but);
			return verdict(gain >= 35.0, std::string(nomTypeAction(recup->type)) + " puis tir " + fmtScene(ti - recup->t, 1) + " s plus tard, "
				+ fmtScene(gain, 0) + " m gagnés vers le but");
		}
		if (id == "joueur_epuise")
		{
			const EtatCinematique e = c.etat(f, ti);
			double pointe = 0.0;
			for (double t = s.t0; t <= s.t1; t += 0.05)
			{
				pointe = std::max(pointe, vitesseScene(c, f, t));
			}
			const double frais = s.mesure("p95_frais", -1);
			return verdict(e.energie < 45.0 && pointe >= 3.0 && frais > 0.0 && pointe < frais,
				"énergie " + fmtScene(e.energie, 0) + ", pointe " + fmtScene(pointe, 2) + " m/s contre " + fmtScene(frais, 2) + " m/s frais (95e centile du premier quart d'heure)");
		}
		if (id == "pluie" || id == "nuit")
		{
			const std::string voulu = id;
			int passesAuSol = 0, tirs = 0;
			for (const Action& a : doc.actions)
			{
				if (a.t < s.t0 || a.t > s.t1)
				{
					continue;
				}
				passesAuSol += a.type == TypeAction::Passe && !a.vrai("aerien") ? 1 : 0;
				tirs += a.type == TypeAction::Tir ? 1 : 0;
			}
			const bool action = id == "pluie" ? passesAuSol > 0 : tirs > 0;
			return verdict(doc.meteo == voulu && action, "météo « " + doc.meteo + " », " + std::to_string(passesAuSol) + " passe(s) au sol, " + std::to_string(tirs) + " tir(s)");
		}
		return verdict(false, "scène inconnue : " + id);
	}
}
