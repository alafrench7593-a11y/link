#include "LFCore/LFContact.h"

#include <cmath>
#include <string>

namespace lf
{
	namespace
	{
		constexpr double kEps = 1e-9;

		std::string texteOuVide(const Action& a, std::string_view cle)
		{
			const std::string* s = a.texte(cle);
			return s ? *s : std::string();
		}

		bool estDeviationDeLaTete(const std::vector<Action>& A, int i)
		{
			if (i <= 0)
			{
				return false;
			}
			const Action& a = A[static_cast<std::size_t>(i)];
			const Action& p = A[static_cast<std::size_t>(i - 1)];
			return p.type == TypeAction::DuelAerien && p.code == a.code && std::fabs(p.t - a.t) < kEps;
		}

		GenreContact genreDe(const std::vector<Action>& A, int i)
		{
			const Action& a = A[static_cast<std::size_t>(i)];
			switch (a.type)
			{
			case TypeAction::Passe:
			{
				if (estDeviationDeLaTete(A, i))
				{
					return GenreContact::Tete;
				}
				const std::string g = texteOuVide(a, "genre");
				if (g == "cross" || g == "corner" || g == "fkc")
				{
					return GenreContact::Centre;
				}
				if (g == "long" || g == "gkl" || a.vrai("aerien"))
				{
					return GenreContact::PasseAerienne;
				}
				return GenreContact::Passe;
			}
			case TypeAction::Tir:
				return a.vrai("tete") ? GenreContact::Tete : GenreContact::Tir;
			case TypeAction::Degagement:
				// Un dégagement qui part de plus d'un mètre suit un duel aérien : de la tête.
				return a.nombre("z0", 0.0) > 1.0 ? GenreContact::Tete : GenreContact::Degagement;
			case TypeAction::Touche: return GenreContact::Touche;
			case TypeAction::Controle: return GenreContact::Controle;
			case TypeAction::Interception: return GenreContact::Interception;
			case TypeAction::Tacle: return GenreContact::Tacle;
			case TypeAction::Contre: return GenreContact::Contre;
			case TypeAction::Arret: return GenreContact::Arret;
			case TypeAction::PriseAerienne: return GenreContact::PriseAerienne;
			case TypeAction::SortiePieds: return GenreContact::SortiePieds;
			default: return GenreContact::Aucun;
			}
		}

		Surface piedDuCote(double droite)
		{
			return droite >= 0.0 ? Surface::PiedDroit : Surface::PiedGauche;
		}
	}

	Surface piedDeFrappe(const std::string& pied, int piedFaible, char camp, double x, double droiteBallon, bool& piedFaibleUtilise)
	{
		piedFaibleUtilise = false;
		if (pied == "Ambidextre" || piedFaible >= 5)
		{
			return piedDuCote(droiteBallon);
		}
		const bool gaucher = pied == "Gauche";
		const Surface fort = gaucher ? Surface::PiedGauche : Surface::PiedDroit;
		const Surface faible = gaucher ? Surface::PiedDroit : Surface::PiedGauche;
		// La règle weakFoot de src/engine.js : x vu du camp du joueur (xl), côté gauche sous
		// 30 m, côté droit au-delà de 38 m, l'axe entre les deux.
		const double lx = camp == 'A' ? 68.0 - x : x;
		const bool aGauche = lx < 30.0, aDroite = lx > 38.0;
		const bool coteFort = gaucher ? aGauche : aDroite;
		if (coteFort || (!aGauche && !aDroite))
		{
			return fort;
		}
		piedFaibleUtilise = true;
		return faible;
	}

	QualiteControle qualiteControle(const std::string& niveau)
	{
		if (niveau == "elite") return QualiteControle::Parfait;
		if (niveau == "oriente") return QualiteControle::Propre;
		if (niveau == "correct") return QualiteControle::Controle;
		if (niveau == "long") return QualiteControle::Lourd;
		if (niveau == "rate") return QualiteControle::Rate;
		return QualiteControle::Aucune;
	}

	Contact contactDeAction(const Cinematique& c, int action, double t)
	{
		Contact k;
		const DocumentMatch& doc = c.document();
		if (action < 0 || action >= static_cast<int>(doc.actions.size()))
		{
			return k;
		}
		const Action& a = doc.actions[static_cast<std::size_t>(action)];
		const GenreContact genre = genreDe(doc.actions, action);
		if (genre == GenreContact::Aucun || a.code < 0 || a.code >= kJoueurs)
		{
			return k;
		}
		const EtatCinematique corps = c.etat(a.code, a.t);
		if (!corps.valide)
		{
			return k;
		}
		k.valide = true;
		k.action = action;
		k.t = a.t;
		k.dans = a.t - t;
		k.genre = genre;
		k.vitesseJoueur = corps.vitesse;

		// Le ballon au contact : le point de départ du vol pour une frappe (le moteur l'écrit),
		// la position lue dans la cinématique sinon.
		if (a.estFrappe())
		{
			k.x = a.nombre("x0", corps.x);
			k.y = a.nombre("y0", corps.y);
			k.z = a.nombre("z0", 0.0);
			const double x1 = a.nombre("x1", k.x), y1 = a.nombre("y1", k.y), dur = a.nombre("dur", 0.0);
			k.distanceFrappe = std::hypot(x1 - k.x, y1 - k.y);
			const bool lineaire = a.vrai("aerien") || a.type == TypeAction::Tir;
			// la vitesse de départ : constante pour un vol aérien ou un tir, sinon le ballon
			// part 1,35 fois plus vite que sa moyenne et ralentit (la formule du moteur)
			k.vitesseBallon = dur > 0.0 ? k.distanceFrappe / dur * (lineaire ? 1.0 : 1.35) : 0.0;
			const std::string* g = a.type == TypeAction::Tir ? a.texte("variante") : a.texte("genre");
			k.variante = g ? *g : std::string();
		}
		else
		{
			const EtatBallon b = c.ballon(a.t);
			k.x = b.x;
			k.y = b.y;
			k.z = b.z;
			const EtatBallon avant = c.ballon(a.t - 0.05);
			k.vitesseBallon = std::sqrt(avant.vx * avant.vx + avant.vy * avant.vy + avant.vz * avant.vz);
		}

		// Le ballon dans le repère du corps : devant, et à droite au sens du lacet d'Unreal.
		const double dx = k.x - corps.x, dy = k.y - corps.y;
		const double ca = std::cos(corps.angleCorps), sa = std::sin(corps.angleCorps);
		k.avant = dx * ca + dy * sa;
		k.droite = -dx * sa + dy * ca;
		k.distance = std::hypot(dx, dy);

		const FicheJoueur* fiche = doc.ficheA(a.code, a.t);
		const char camp = a.code < 11 ? 'H' : 'A';
		switch (genre)
		{
		case GenreContact::Tete:
			k.surface = Surface::Tete;
			break;
		case GenreContact::Touche:
		case GenreContact::PriseAerienne:
		case GenreContact::SortiePieds:
			k.surface = Surface::Mains;
			break;
		case GenreContact::Arret:
			k.surface = texteOuVide(a, "geste") == "pied" ? piedDuCote(k.droite) : Surface::Mains;
			break;
		case GenreContact::Controle:
		{
			k.qualite = qualiteControle(texteOuVide(a, "niveau"));
			k.uneTouche = a.vrai("une_touche");
			k.sousPression = a.vrai("presse");
			if (k.z >= 1.5)
			{
				k.surface = Surface::Tete;
			}
			else if (k.z >= 0.8)
			{
				k.surface = Surface::Poitrine;
			}
			else
			{
				// au sol : le pied du côté où arrive le ballon ; dans l'axe, le pied fort
				const bool gaucher = fiche && fiche->pied == "Gauche";
				k.surface = std::fabs(k.droite) < 0.15 ? (gaucher ? Surface::PiedGauche : Surface::PiedDroit) : piedDuCote(k.droite);
			}
			break;
		}
		case GenreContact::Passe:
		case GenreContact::PasseAerienne:
		case GenreContact::Centre:
		case GenreContact::Tir:
		case GenreContact::Degagement:
			k.surface = fiche ? piedDeFrappe(fiche->pied, fiche->piedFaible, camp, corps.x, k.droite, k.piedFaible) : piedDuCote(k.droite);
			break;
		default:
			k.surface = piedDuCote(k.droite);
			break;
		}
		return k;
	}

	Contact prochainContact(const Cinematique& c, int code, double t, const ParametresContact& p)
	{
		if (code < 0 || code >= kJoueurs)
		{
			return Contact{};
		}
		const DocumentMatch& doc = c.document();
		const std::vector<int>& mesActions = c.actionsDe(code);
		for (int i : mesActions)
		{
			const Action& a = doc.actions[static_cast<std::size_t>(i)];
			if (a.t < t - p.apres - kEps)
			{
				continue;
			}
			if (a.t > t + p.horizon + kEps)
			{
				break;
			}
			if (genreDe(doc.actions, i) == GenreContact::Aucun)
			{
				continue;
			}
			// L'action doit être celle du joueur qui porte ce code maintenant (pas celle d'un
			// remplacé, au moment d'un changement).
			if (doc.ficheA(code, a.t) != doc.ficheA(code, t))
			{
				continue;
			}
			Contact k = contactDeAction(c, i, t);
			if (k.valide)
			{
				return k;
			}
		}
		return Contact{};
	}

	const char* nomGenreContact(GenreContact g)
	{
		switch (g)
		{
		case GenreContact::Aucun: return "aucun";
		case GenreContact::Passe: return "passe";
		case GenreContact::PasseAerienne: return "passe_aerienne";
		case GenreContact::Centre: return "centre";
		case GenreContact::Tir: return "tir";
		case GenreContact::Tete: return "tete";
		case GenreContact::Degagement: return "degagement";
		case GenreContact::Touche: return "touche";
		case GenreContact::Controle: return "controle";
		case GenreContact::Interception: return "interception";
		case GenreContact::Tacle: return "tacle";
		case GenreContact::Contre: return "contre";
		case GenreContact::Arret: return "arret";
		case GenreContact::PriseAerienne: return "prise_aerienne";
		case GenreContact::SortiePieds: return "sortie_pieds";
		}
		return "aucun";
	}

	const char* nomSurface(Surface s)
	{
		switch (s)
		{
		case Surface::Aucune: return "aucune";
		case Surface::PiedDroit: return "pied_droit";
		case Surface::PiedGauche: return "pied_gauche";
		case Surface::Tete: return "tete";
		case Surface::Poitrine: return "poitrine";
		case Surface::Mains: return "mains";
		}
		return "aucune";
	}

	const char* nomQualite(QualiteControle q)
	{
		switch (q)
		{
		case QualiteControle::Aucune: return "aucune";
		case QualiteControle::Parfait: return "parfait";
		case QualiteControle::Propre: return "propre";
		case QualiteControle::Controle: return "controle";
		case QualiteControle::Lourd: return "lourd";
		case QualiteControle::Rate: return "rate";
		}
		return "aucune";
	}
}
