#include "LFCore/LFFamilles.h"

#include "LFCore/LFLocomotion.h"

#include <cmath>
#include <cstdlib>
#include <string>

namespace lf
{
	namespace
	{
		struct MotFamille
		{
			std::string_view mot;
			Famille famille;
		};

		// Dans l'ordre de priorité : le premier mot trouvé dans le nom l'emporte. Les gestes
		// avant les transitions, les transitions avant les allures (« Run_Stops » est un freinage).
		constexpr MotFamille kMotsFamilles[] = {
			{ "celebr", Famille::Celebration },
			{ "getup", Famille::Chute },
			{ "get_up", Famille::Chute },
			{ "ragdoll", Famille::Chute },
			{ "fall", Famille::Chute },
			{ "chute", Famille::Chute },
			{ "stumble", Famille::Desequilibre },
			{ "stagger", Famille::Desequilibre },
			{ "desequilibre", Famille::Desequilibre },
			{ "dive", Famille::Plongeon },
			{ "plongeon", Famille::Plongeon },
			{ "claim", Famille::Prise },
			{ "catch", Famille::Prise },
			{ "prise", Famille::Prise },
			{ "sortiepieds", Famille::SortiePieds },
			{ "sortie_pieds", Famille::SortiePieds },
			{ "parade", Famille::Arret },
			{ "save", Famille::Arret },
			{ "slide", Famille::TacleGlisse },
			{ "glisse", Famille::TacleGlisse },
			{ "tackle", Famille::Tacle },
			{ "tacle", Famille::Tacle },
			{ "intercept", Famille::Interception },
			{ "header", Famille::Tete },
			{ "tete", Famille::Tete },
			{ "volley", Famille::Tir },
			{ "shoot", Famille::Tir },
			{ "shot", Famille::Tir },
			{ "tir", Famille::Tir },
			{ "cross", Famille::Centre },
			{ "centre", Famille::Centre },
			{ "throw", Famille::Touche },
			{ "touche", Famille::Touche },
			{ "clear", Famille::Degagement },
			{ "degagement", Famille::Degagement },
			{ "pass", Famille::Passe },
			{ "receive", Famille::Reception },
			{ "reception", Famille::Reception },
			{ "control", Famille::Reception },
			{ "first_touch", Famille::Reception },
			{ "shield", Famille::Protection },
			{ "protect", Famille::Protection },
			{ "dribble", Famille::Dribble },
			{ "crochet", Famille::Dribble },
			{ "feint", Famille::Dribble },
			{ "pivot", Famille::Pivot },
			{ "turn", Famille::Pivot },
			{ "virage", Famille::Pivot },
			{ "start", Famille::Demarrage },
			{ "demarrage", Famille::Demarrage },
			{ "stop", Famille::Freinage },
			{ "brake", Famille::Freinage },
			{ "freinage", Famille::Freinage },
			{ "backpedal", Famille::Recul },
			{ "recul", Famille::Recul },
			{ "strafe", Famille::Lateral },
			{ "shuffle", Famille::Lateral },
			{ "lateral", Famille::Lateral },
			{ "sprint", Famille::Sprint },
			{ "run", Famille::Course },
			{ "course", Famille::Course },
			{ "jog", Famille::Trot },
			{ "trot", Famille::Trot },
			{ "walk", Famille::Marche },
			{ "marche", Famille::Marche },
			{ "idle", Famille::Immobile },
			{ "stand", Famille::Immobile },
			{ "immobile", Famille::Immobile } };

		int rangAllure(Famille f)
		{
			switch (f)
			{
			case Famille::Immobile: return 0;
			case Famille::Marche: return 1;
			case Famille::Trot: return 2;
			case Famille::Course: return 3;
			case Famille::Sprint: return 4;
			default: return -1;
			}
		}

		struct PaireProche
		{
			Famille a;
			Famille b;
		};

		// Les familles voisines : l'une peut montrer l'autre sans mentir.
		constexpr PaireProche kProches[] = {
			{ Famille::Demarrage, Famille::Immobile }, { Famille::Demarrage, Famille::Marche }, { Famille::Demarrage, Famille::Trot },
			{ Famille::Demarrage, Famille::Course }, { Famille::Demarrage, Famille::Pivot },
			{ Famille::Freinage, Famille::Immobile }, { Famille::Freinage, Famille::Marche }, { Famille::Freinage, Famille::Trot },
			{ Famille::Freinage, Famille::Course }, { Famille::Freinage, Famille::Sprint }, { Famille::Freinage, Famille::Pivot },
			{ Famille::Pivot, Famille::Immobile }, { Famille::Pivot, Famille::Marche }, { Famille::Pivot, Famille::Trot },
			{ Famille::Lateral, Famille::Immobile }, { Famille::Lateral, Famille::Marche }, { Famille::Lateral, Famille::Trot },
			{ Famille::Lateral, Famille::Recul },
			{ Famille::Recul, Famille::Immobile }, { Famille::Recul, Famille::Marche }, { Famille::Recul, Famille::Trot },
			{ Famille::Passe, Famille::Centre }, { Famille::Passe, Famille::Degagement }, { Famille::Passe, Famille::Touche },
			{ Famille::Centre, Famille::Degagement },
			{ Famille::Reception, Famille::Protection }, { Famille::Reception, Famille::Interception },
			{ Famille::Dribble, Famille::Protection },
			{ Famille::Tacle, Famille::TacleGlisse }, { Famille::Tacle, Famille::Interception },
			{ Famille::Plongeon, Famille::Arret }, { Famille::Arret, Famille::Prise }, { Famille::SortiePieds, Famille::Plongeon },
			{ Famille::SortiePieds, Famille::TacleGlisse },
			{ Famille::Chute, Famille::Desequilibre } };

		bool proches(Famille a, Famille b)
		{
			for (const PaireProche& p : kProches)
			{
				if ((p.a == a && p.b == b) || (p.a == b && p.b == a))
				{
					return true;
				}
			}
			return false;
		}

		struct FenetreAction
		{
			double avant;	// s avant l'instant de l'action
			double apres;	// s après
		};

		bool fenetreDe(const Action& a, FenetreAction& f, Famille& fam)
		{
			switch (a.type)
			{
			case TypeAction::Passe:
			{
				const std::string* g = a.texte("genre");
				const bool centre = g && (*g == "cross" || *g == "corner" || *g == "fkc");
				fam = centre ? Famille::Centre : Famille::Passe;
				f = { 0.30, 0.25 };
				return true;
			}
			case TypeAction::Touche: fam = Famille::Touche; f = { 0.40, 0.25 }; return true;
			case TypeAction::Degagement: fam = Famille::Degagement; f = { 0.30, 0.25 }; return true;
			case TypeAction::Tir: fam = a.vrai("tete") ? Famille::Tete : Famille::Tir; f = { 0.35, 0.30 }; return true;
			case TypeAction::Controle: fam = Famille::Reception; f = { 0.25, 0.30 }; return true;
			case TypeAction::Interception: fam = Famille::Interception; f = { 0.30, 0.30 }; return true;
			case TypeAction::Dribble:
				fam = a.texteVaut("geste", "protect") ? Famille::Protection : Famille::Dribble;
				f = { 0.30, 0.50 };
				return true;
			case TypeAction::Tacle:
			{
				const std::string* g = a.texte("genre");
				fam = g && *g == "glisse" ? Famille::TacleGlisse : (g && *g == "interception" ? Famille::Interception : Famille::Tacle);
				f = { 0.40, 0.60 };
				return true;
			}
			case TypeAction::Faute: fam = Famille::Tacle; f = { 0.40, 0.40 }; return true;
			case TypeAction::DuelAerien: fam = Famille::Tete; f = { 0.40, 0.30 }; return true;
			case TypeAction::PriseAerienne: fam = Famille::Prise; f = { 0.40, 0.50 }; return true;
			case TypeAction::Plongeon: fam = Famille::Plongeon; f = { 0.0, a.nombre("dur", 0.6) + 0.6 }; return true;
			case TypeAction::Arret: fam = Famille::Arret; f = { 0.20, 0.60 }; return true;
			case TypeAction::SortiePieds: fam = Famille::SortiePieds; f = { 0.30, 0.80 }; return true;
			case TypeAction::Celebration: fam = Famille::Celebration; f = { 0.0, 3.0 }; return true;
			default: return false;
			}
		}
	}

	bool estLocomotion(Famille f)
	{
		switch (f)
		{
		case Famille::Immobile:
		case Famille::Marche:
		case Famille::Trot:
		case Famille::Course:
		case Famille::Sprint:
		case Famille::Demarrage:
		case Famille::Freinage:
		case Famille::Pivot:
		case Famille::Lateral:
		case Famille::Recul:
			return true;
		default:
			return false;
		}
	}

	Famille familleAttendue(const Cinematique& c, int code, double t)
	{
		const EtatCinematique e = c.etat(code, t);
		if (!e.valide)
		{
			return Famille::Inconnue;
		}
		if (e.etats & etat::AuSol)
		{
			return Famille::Chute;
		}
		// Une action dont la fenêtre couvre t : la plus proche dans le temps.
		const DocumentMatch& doc = c.document();
		Famille meilleure = Famille::Inconnue;
		double ecartMin = 1e9;
		for (const int ia : c.actionsDe(code))
		{
			const Action& a = doc.actions[static_cast<std::size_t>(ia)];
			if (a.t > t + 1.0)
			{
				break;
			}
			FenetreAction f{};
			Famille fam = Famille::Inconnue;
			if (!fenetreDe(a, f, fam))
			{
				continue;
			}
			if (t < a.t - f.avant || t > a.t + f.apres)
			{
				continue;
			}
			const double ecart = std::fabs(t - a.t);
			if (ecart <= ecartMin)
			{
				ecartMin = ecart;
				meilleure = fam;
			}
		}
		if (meilleure != Famille::Inconnue)
		{
			return meilleure;
		}
		if (e.etats & etat::Desequilibre)
		{
			return Famille::Desequilibre;
		}
		const DescriptionLocomotion d = decrireLocomotion(c, code, t);
		if (d.phase == PhaseVitesse::Demarrage)
		{
			return Famille::Demarrage;
		}
		if (d.phase == PhaseVitesse::Arret || (d.phase == PhaseVitesse::Freinage && d.vitesse > 4.0))
		{
			return Famille::Freinage;
		}
		if ((d.virage == ClasseVirage::V135 || d.virage == ClasseVirage::V180) && d.vitesse < 3.0)
		{
			return Famille::Pivot;
		}
		if (d.allure == Allure::Recul)
		{
			return Famille::Recul;
		}
		if (d.allure == Allure::Lateral)
		{
			return Famille::Lateral;
		}
		switch (d.bande)
		{
		case BandeVitesse::Arret: return Famille::Immobile;
		case BandeVitesse::Marche: return Famille::Marche;
		case BandeVitesse::Trot: return Famille::Trot;
		case BandeVitesse::Course: return Famille::Course;
		case BandeVitesse::Rapide: return (d.effort > 0.9 || d.sprintVoulu) ? Famille::Sprint : Famille::Course;
		case BandeVitesse::Sprint: return Famille::Sprint;
		}
		return Famille::Inconnue;
	}

	Famille familleDepuisNom(std::string_view nom)
	{
		std::string bas(nom);
		for (char& ch : bas)
		{
			if (ch >= 'A' && ch <= 'Z')
			{
				ch = static_cast<char>(ch - 'A' + 'a');
			}
		}
		for (const MotFamille& m : kMotsFamilles)
		{
			if (bas.find(m.mot) != std::string::npos)
			{
				return m.famille;
			}
		}
		return Famille::Inconnue;
	}

	bool famillesCompatibles(Famille attendue, Famille vue)
	{
		if (attendue == vue || attendue == Famille::Inconnue)
		{
			return true;
		}
		if (vue == Famille::Inconnue)
		{
			return false;
		}
		const int ra = rangAllure(attendue), rv = rangAllure(vue);
		if (ra >= 0 && rv >= 0)
		{
			return std::abs(ra - rv) <= 1;
		}
		if (attendue == Famille::Desequilibre && rv >= 0)
		{
			return true;	// on trébuche en courant
		}
		return proches(attendue, vue);
	}

	const char* nomFamille(Famille f)
	{
		switch (f)
		{
		case Famille::Inconnue: return "inconnue";
		case Famille::Immobile: return "immobile";
		case Famille::Marche: return "marche";
		case Famille::Trot: return "trot";
		case Famille::Course: return "course";
		case Famille::Sprint: return "sprint";
		case Famille::Demarrage: return "demarrage";
		case Famille::Freinage: return "freinage";
		case Famille::Pivot: return "pivot";
		case Famille::Lateral: return "lateral";
		case Famille::Recul: return "recul";
		case Famille::Reception: return "reception";
		case Famille::Passe: return "passe";
		case Famille::Centre: return "centre";
		case Famille::Tir: return "tir";
		case Famille::Tete: return "tete";
		case Famille::Degagement: return "degagement";
		case Famille::Touche: return "touche";
		case Famille::Dribble: return "dribble";
		case Famille::Protection: return "protection";
		case Famille::Tacle: return "tacle";
		case Famille::TacleGlisse: return "tacle_glisse";
		case Famille::Interception: return "interception";
		case Famille::Plongeon: return "plongeon";
		case Famille::Arret: return "arret";
		case Famille::Prise: return "prise";
		case Famille::SortiePieds: return "sortie_pieds";
		case Famille::Chute: return "chute";
		case Famille::Desequilibre: return "desequilibre";
		case Famille::Celebration: return "celebration";
		}
		return "?";
	}
}
