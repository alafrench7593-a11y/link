#include "LFCore/LFCorps.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <string>

namespace lf
{
	namespace
	{
		double borner01(double v)
		{
			return std::max(0.0, std::min(1.0, v));
		}

		bool contient(const std::string& texte, const char* mot)
		{
			return texte.find(mot) != std::string::npos;
		}

		// Les attributs du moteur (src/engine.js, setAttr) ramenés de 0 à 1 sur l'étendue que
		// donnent des statistiques de 30 à 99.
		double explosiviteDe(double acc) { return borner01((acc - 0.25) / 0.36); }
		double agiliteDe(double agi) { return borner01((agi - 0.37) / 0.64); }
		double equilibreDe(double bal) { return borner01((bal - 0.46) / 0.41); }

		// Les mêmes formules que le moteur, quand la fiche n'a pas (encore) ses attributs.
		void attributsDepuisStats(const FicheJoueur& f, double& acc, double& agi, double& bal)
		{
			const double vit = f.stat("VIT", 60), dri = f.stat("DRI", 55), phy = f.stat("PHY", 60);
			acc = 0.30 + (dri * 0.5 + vit * 0.5 - 40.0) * 0.0052;
			agi = 0.55 + (dri - 45.0) * 0.007 - (phy - 65.0) * 0.0022;
			bal = 0.55 + (phy - 45.0) * 0.006;
		}

		// La largeur selon le rôle tactique, quand le match ne l'a pas encore dite (0 à 1).
		double largeurDuRole(const FicheJoueur& f)
		{
			const std::string& r = f.role;
			if (contient(r, "Latéral") || contient(r, "Piston") || contient(r, "Ailier") || contient(r, "excentré"))
			{
				return 0.9;
			}
			if (contient(r, "central") || contient(r, "Avant-centre") || contient(r, "Libéro") || contient(r, "Sentinelle") || contient(r, "Meneur"))
			{
				return 0.2;
			}
			return 0.5;
		}

		struct Prototype
		{
			TypeCorps type;
			double taille, carrure, explosivite, largeur;
		};

		// Les morphotypes du cahier, placés dans l'espace (taille, carrure, explosivité, largeur).
		constexpr std::array<Prototype, 8> kPrototypes = { {
			{ TypeCorps::AilierFin, 0.35, 0.30, 0.50, 0.90 },
			{ TypeCorps::AilierExplosif, 0.35, 0.45, 0.85, 0.90 },
			{ TypeCorps::MilieuCompact, 0.30, 0.50, 0.50, 0.25 },
			{ TypeCorps::MilieuGrand, 0.75, 0.50, 0.45, 0.25 },
			{ TypeCorps::AttaquantPuissant, 0.50, 0.75, 0.60, 0.25 },
			{ TypeCorps::AttaquantGrand, 0.85, 0.55, 0.45, 0.20 },
			{ TypeCorps::DefenseurCentralPuissant, 0.75, 0.70, 0.40, 0.20 },
			{ TypeCorps::LateralFin, 0.40, 0.35, 0.60, 0.90 },
		} };
	}

	bool typeCompatibleAvecPoste(TypeCorps t, const std::string& poste)
	{
		if (poste == "GB")
		{
			return t == TypeCorps::GardienAthletique || t == TypeCorps::GardienGrand;
		}
		if (poste == "DEF")
		{
			return t == TypeCorps::DefenseurCentralPuissant || t == TypeCorps::LateralFin;
		}
		if (poste == "MIL")
		{
			return t == TypeCorps::MilieuCompact || t == TypeCorps::MilieuGrand || t == TypeCorps::AilierFin || t == TypeCorps::AilierExplosif;
		}
		if (poste == "ATT")
		{
			return t == TypeCorps::AttaquantPuissant || t == TypeCorps::AttaquantGrand || t == TypeCorps::AilierFin || t == TypeCorps::AilierExplosif;
		}
		return t != TypeCorps::GardienAthletique && t != TypeCorps::GardienGrand;
	}

	ProfilCorps profilCorps(const FicheJoueur& f, double largeurMoyenne)
	{
		ProfilCorps p;
		const Morphologie& m = f.morphologie;
		p.echelle = m.tailleCm / 180.0;
		p.foulee = p.echelle * (0.93 + 0.15 * m.jambes);
		p.carrure = borner01((m.epaules + m.muscles + m.masse) / 3.0);
		p.inclinaison = borner01(m.posture);
		p.largeur = largeurMoyenne;

		double acc = 0.0, agi = 0.0, bal = 0.0;
		if (f.aMoteur && f.moteur.acceleration > 0.0)
		{
			acc = f.moteur.acceleration;
			agi = f.moteur.agilite;
			bal = f.moteur.equilibre;
		}
		else
		{
			attributsDepuisStats(f, acc, agi, bal);
		}
		p.explosivite = explosiviteDe(acc);
		p.agilite = agiliteDe(agi);
		p.equilibre = equilibreDe(bal);

		if (f.estGardien())
		{
			p.type = m.tailleCm >= 192 ? TypeCorps::GardienGrand : TypeCorps::GardienAthletique;
			return p;
		}

		// Le prototype le plus proche, parmi ceux que le poste admet.
		const double taille = borner01((m.tailleCm - 165.0) / 35.0);
		const double largeur = largeurMoyenne >= 0.0 ? borner01(largeurMoyenne / 22.0) : largeurDuRole(f);
		double meilleur = 1e9;
		for (const Prototype& pr : kPrototypes)
		{
			if (!typeCompatibleAvecPoste(pr.type, f.poste))
			{
				continue;
			}
			const double d = 1.0 * (taille - pr.taille) * (taille - pr.taille)
				+ 1.0 * (p.carrure - pr.carrure) * (p.carrure - pr.carrure)
				+ 0.8 * (p.explosivite - pr.explosivite) * (p.explosivite - pr.explosivite)
				+ 1.5 * (largeur - pr.largeur) * (largeur - pr.largeur);
			if (d < meilleur)
			{
				meilleur = d;
				p.type = pr.type;
			}
		}
		return p;
	}

	double largeurDeJeu(const Cinematique& c, int code)
	{
		const DocumentMatch& doc = c.document();
		if (code < 0 || code >= kJoueurs)
		{
			return -1.0;
		}
		double somme = 0.0;
		int n = 0;
		for (const Image& im : doc.images)
		{
			const JoueurImage& j = im.joueurs[static_cast<std::size_t>(code)];
			if (j.present)
			{
				somme += std::fabs(j.x - 34.0);
				++n;
			}
		}
		return n > 0 ? somme / n : -1.0;
	}

	const char* nomTypeCorps(TypeCorps t)
	{
		switch (t)
		{
		case TypeCorps::AilierFin: return "ailier_fin";
		case TypeCorps::AilierExplosif: return "ailier_explosif";
		case TypeCorps::MilieuCompact: return "milieu_compact";
		case TypeCorps::MilieuGrand: return "milieu_grand";
		case TypeCorps::AttaquantPuissant: return "attaquant_puissant";
		case TypeCorps::AttaquantGrand: return "attaquant_grand";
		case TypeCorps::DefenseurCentralPuissant: return "defenseur_central_puissant";
		case TypeCorps::LateralFin: return "lateral_fin";
		case TypeCorps::GardienAthletique: return "gardien_athletique";
		case TypeCorps::GardienGrand: return "gardien_grand";
		}
		return "milieu_compact";
	}
}
