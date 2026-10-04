#include "LFCore/LFDocument.h"

#include <algorithm>
#include <cmath>

namespace lf
{
	namespace
	{
		struct NomTypeAction
		{
			std::string_view nom;
			TypeAction type;
		};

		constexpr NomTypeAction kNomsActions[] = {
			{ "passe", TypeAction::Passe },
			{ "tir", TypeAction::Tir },
			{ "degagement", TypeAction::Degagement },
			{ "touche", TypeAction::Touche },
			{ "controle", TypeAction::Controle },
			{ "interception", TypeAction::Interception },
			{ "hors_jeu", TypeAction::HorsJeu },
			{ "prise_aerienne", TypeAction::PriseAerienne },
			{ "duel_aerien", TypeAction::DuelAerien },
			{ "plongeon", TypeAction::Plongeon },
			{ "arret", TypeAction::Arret },
			{ "poteau", TypeAction::Poteau },
			{ "contre", TypeAction::Contre },
			{ "but", TypeAction::But },
			{ "celebration", TypeAction::Celebration },
			{ "faute", TypeAction::Faute },
			{ "dribble", TypeAction::Dribble },
			{ "tacle", TypeAction::Tacle },
			{ "sortie_pieds", TypeAction::SortiePieds },
			{ "remplacement", TypeAction::Remplacement },
			{ "conduite", TypeAction::Conduite } };

		constexpr std::string_view kTete[kChampsTete] = {
			"t", "horloge", "mi_temps", "coupe", "bx", "by", "bz", "porteur", "score_d", "score_e", "cpa", "tireur" };
		constexpr std::string_view kJoueur[kChampsJoueur] = { "x", "y", "angle", "energie", "etats", "intention" };

		ResultatChargement erreurDocument(std::string message)
		{
			ResultatChargement r;
			r.ok = false;
			r.erreur = std::move(message);
			return r;
		}

		int entierOu(const json::Valeur& objet, std::string_view cle, int defaut)
		{
			const json::Valeur* v = objet.champ(cle);
			if (!v || v->genre != json::Genre::Nombre)
			{
				return defaut;
			}
			return static_cast<int>(std::lround(v->nombre));
		}

		std::string texteDe(const json::Valeur& objet, std::string_view cle)
		{
			return objet.texteOu(cle, "");
		}

		OptionDecision lireOptionDecision(const json::Valeur& o)
		{
			OptionDecision r;
			r.k = texteDe(o, "k");
			r.genre = texteDe(o, "genre");
			r.vers = entierOu(o, "vers", -1);
			r.ev = o.nombreOu("ev", 0.0);
			return r;
		}

		// Les champs plats d'un objet, rangés par genre : c'est ainsi que se lisent les
		// actions, la tactique d'une équipe et les mesures d'une scène.
		void champsPlats(const json::Valeur& objet, std::vector<std::pair<std::string, double>>* nombres,
			std::vector<std::pair<std::string, std::string>>* textes,
			std::vector<std::pair<std::string, std::vector<double>>>* listes)
		{
			for (const json::Membre& m : objet.membres)
			{
				const json::Valeur& v = m.valeur;
				if (nombres && v.genre == json::Genre::Nombre)
				{
					nombres->emplace_back(m.cle, v.nombre);
				}
				else if (nombres && v.genre == json::Genre::Booleen)
				{
					nombres->emplace_back(m.cle, v.booleen ? 1.0 : 0.0);
				}
				else if (textes && v.genre == json::Genre::Texte)
				{
					textes->emplace_back(m.cle, v.texte);
				}
				else if (listes && v.genre == json::Genre::Nombres)
				{
					listes->emplace_back(m.cle, v.nombres);
				}
				else if (listes && v.genre == json::Genre::Tableau && v.elements.empty())
				{
					listes->emplace_back(m.cle, std::vector<double>{});
				}
			}
		}

		void lireFiche(const json::Valeur& o, FicheJoueur& f)
		{
			f.code = entierOu(o, "code", -1);
			const std::string camp = texteDe(o, "camp");
			f.camp = camp == "A" ? 'A' : 'H';
			const json::Valeur* carte = o.champ("carte");
			f.carte = carte && carte->genre == json::Genre::Nombre ? static_cast<std::int64_t>(std::llround(carte->nombre)) : -1;
			f.personnage = texteDe(o, "personnage");
			f.nom = texteDe(o, "nom");
			f.poste = texteDe(o, "poste");
			f.ligne = texteDe(o, "ligne");
			f.posteTactique = texteDe(o, "poste_tactique");
			f.role = texteDe(o, "role");
			f.devoir = texteDe(o, "devoir");
			f.rarete = texteDe(o, "rarete");
			f.pied = texteDe(o, "pied");
			f.numero = entierOu(o, "numero", 0);
			f.note = entierOu(o, "note", 0);
			f.niveau = entierOu(o, "niveau", 0);
			f.piedFaible = entierOu(o, "pied_faible", 3);
			if (const json::Valeur* st = o.champ("stats"); st && st->estObjet())
			{
				for (const json::Membre& m : st->membres)
				{
					if (m.valeur.estNombre())
					{
						f.stats.emplace_back(m.cle, static_cast<int>(std::lround(m.valeur.nombre)));
					}
				}
			}
			if (const json::Valeur* mo = o.champ("moteur"); mo && mo->estObjet())
			{
				f.aMoteur = true;
				AttributsMoteur& a = f.moteur;
				a.vitesseMax = mo->nombreOu("vitesse_max", 0.0);
				a.acceleration = mo->nombreOu("acceleration", 0.0);
				a.agilite = mo->nombreOu("agilite", 0.0);
				a.equilibre = mo->nombreOu("equilibre", 0.0);
				a.vitesse = entierOu(*mo, "vitesse", 0);
				a.tir = entierOu(*mo, "tir", 0);
				a.passe = entierOu(*mo, "passe", 0);
				a.dribble = entierOu(*mo, "dribble", 0);
				a.defense = entierOu(*mo, "defense", 0);
				a.physique = entierOu(*mo, "physique", 0);
				a.decision = entierOu(*mo, "decision", 0);
				if (const json::Valeur* g = mo->champ("gardien"); g && g->estObjet())
				{
					a.gardien = true;
					a.reflexes = entierOu(*g, "reflexes", 0);
					a.prise = entierOu(*g, "prise", 0);
					a.plongeon = entierOu(*g, "plongeon", 0);
					a.degagement = entierOu(*g, "degagement", 0);
					a.placement = entierOu(*g, "placement", 0);
				}
			}
			if (const json::Valeur* cs = o.champ("competences"); cs && cs->genre == json::Genre::Tableau)
			{
				for (const json::Valeur& c : cs->elements)
				{
					if (!c.estObjet())
					{
						continue;
					}
					Competence k;
					k.effet = texteDe(c, "effet");
					k.nom = texteDe(c, "nom");
					k.categorie = texteDe(c, "categorie");
					k.rarete = texteDe(c, "rarete");
					k.puissance = c.nombreOu("puissance", 0.0);
					k.condition = entierOu(c, "condition", 0);
					f.competences.push_back(std::move(k));
				}
			}
			if (const json::Valeur* e = o.champ("etat"); e && e->estObjet())
			{
				f.etat.forme = entierOu(*e, "forme", 70);
				f.etat.moral = entierOu(*e, "moral", 72);
				f.etat.energie = entierOu(*e, "energie", 100);
				f.etat.blessure = entierOu(*e, "blessure", 0);
			}
			if (const json::Valeur* m = o.champ("morphologie"); m && m->estObjet())
			{
				Morphologie& mo = f.morphologie;
				mo.tailleCm = entierOu(*m, "taille_cm", 180);
				mo.poidsKg = entierOu(*m, "poids_kg", 75);
				mo.carrure = texteDe(*m, "carrure");
				mo.epaules = m->nombreOu("epaules", 0.5);
				mo.poitrine = m->nombreOu("poitrine", 0.5);
				mo.ventre = m->nombreOu("ventre", 0.5);
				mo.bassin = m->nombreOu("bassin", 0.5);
				mo.bras = m->nombreOu("bras", 0.5);
				mo.mains = m->nombreOu("mains", 0.5);
				mo.jambes = m->nombreOu("jambes", 0.5);
				mo.cuisses = m->nombreOu("cuisses", 0.5);
				mo.mollets = m->nombreOu("mollets", 0.5);
				mo.cou = m->nombreOu("cou", 0.5);
				mo.tete = m->nombreOu("tete", 0.5);
				mo.pieds = m->nombreOu("pieds", 0.5);
				mo.muscles = m->nombreOu("muscles", 0.5);
				mo.masse = m->nombreOu("masse", 0.5);
				mo.masseGrasse = m->nombreOu("masse_grasse", 0.5);
				mo.masseGrassePct = m->nombreOu("masse_grasse_pct", 10.0);
				mo.envergureCm = entierOu(*m, "envergure_cm", mo.tailleCm);
				mo.pointure = entierOu(*m, "pointure", 43);
				mo.posture = m->nombreOu("posture", 0.5);
			}
			if (const json::Valeur* a = o.champ("apparence"); a && a->estObjet())
			{
				Apparence& ap = f.apparence;
				ap.graine = static_cast<std::int64_t>(std::llround(a->nombreOu("graine", 0.0)));
				if (const json::Valeur* vi = a->champ("visage"); vi && vi->estTableau())
				{
					for (std::size_t i = 0; i < ap.visage.size(); ++i)
					{
						ap.visage[i] = vi->nombreA(i, 0.5);
					}
				}
				ap.teint = entierOu(*a, "teint", 0);
				ap.textureCheveux = texteDe(*a, "texture_cheveux");
				ap.coiffure = texteDe(*a, "coiffure");
				ap.cheveux = texteDe(*a, "cheveux");
				ap.barbe = texteDe(*a, "barbe");
				ap.sourcils = entierOu(*a, "sourcils", 0);
				ap.yeux = entierOu(*a, "yeux", 0);
			}
			if (const json::Valeur* pe = o.champ("personnalite"); pe && pe->estObjet())
			{
				Personnalite& k = f.personnalite;
				k.type = pe->texteOu("type", "calme");
				k.agressivite = pe->nombreOu("agressivite", 0.5);
				k.calme = pe->nombreOu("calme", 0.5);
				k.expressivite = pe->nombreOu("expressivite", 0.5);
				k.energie = pe->nombreOu("energie", 0.5);
				k.confiance = pe->nombreOu("confiance", 0.5);
			}
		}

		void lireEquipe(const json::Valeur& o, Equipe& e)
		{
			e.club = texteDe(o, "club");
			e.formation = texteDe(o, "formation");
			e.style = texteDe(o, "style");
			e.mentalite = entierOu(o, "mentalite", 3);
			if (const json::Valeur* m = o.champ("maillot"); m && m->estObjet())
			{
				e.maillotC1 = texteDe(*m, "c1");
				e.maillotC2 = texteDe(*m, "c2");
				e.motif = texteDe(*m, "motif");
			}
			if (const json::Valeur* t = o.champ("tactique"); t && t->estObjet())
			{
				champsPlats(*t, &e.tactique, nullptr, nullptr);
			}
		}
	}

	TypeAction typeAction(std::string_view nom)
	{
		for (const NomTypeAction& n : kNomsActions)
		{
			if (n.nom == nom)
			{
				return n.type;
			}
		}
		return TypeAction::Inconnue;
	}

	const char* nomTypeAction(TypeAction type)
	{
		for (const NomTypeAction& n : kNomsActions)
		{
			if (n.type == type)
			{
				return n.nom.data();
			}
		}
		return "inconnue";
	}

	double Action::nombre(std::string_view cle, double defaut) const
	{
		for (const auto& n : nombres)
		{
			if (n.first == cle)
			{
				return n.second;
			}
		}
		return defaut;
	}

	bool Action::aNombre(std::string_view cle) const
	{
		for (const auto& n : nombres)
		{
			if (n.first == cle)
			{
				return true;
			}
		}
		return false;
	}

	const std::string* Action::texte(std::string_view cle) const
	{
		for (const auto& champ : textes)
		{
			if (champ.first == cle)
			{
				return &champ.second;
			}
		}
		return nullptr;
	}

	bool Action::texteVaut(std::string_view cle, std::string_view valeur) const
	{
		const std::string* trouve = texte(cle);
		return trouve && *trouve == valeur;
	}

	bool Action::estFrappe() const
	{
		return type == TypeAction::Passe || type == TypeAction::Tir || type == TypeAction::Degagement || type == TypeAction::Touche;
	}

	int FicheJoueur::stat(std::string_view cle, int defaut) const
	{
		for (const auto& s : stats)
		{
			if (s.first == cle)
			{
				return s.second;
			}
		}
		return defaut;
	}

	bool FicheJoueur::aCompetence(std::string_view effet) const
	{
		for (const Competence& c : competences)
		{
			if (c.effet == effet)
			{
				return true;
			}
		}
		return false;
	}

	double Equipe::reglage(std::string_view cle, double defaut) const
	{
		for (const auto& r : tactique)
		{
			if (r.first == cle)
			{
				return r.second;
			}
		}
		return defaut;
	}

	double InfoScene::mesure(std::string_view cle, double defaut) const
	{
		for (const auto& m : mesures)
		{
			if (m.first == cle)
			{
				return m.second;
			}
		}
		return defaut;
	}

	const FicheJoueur* DocumentMatch::fiche(int code) const
	{
		if (code < 0 || code >= kJoueurs)
		{
			return nullptr;
		}
		const int i = indexFiche[static_cast<std::size_t>(code)];
		return i >= 0 ? &joueurs[static_cast<std::size_t>(i)] : nullptr;
	}

	int DocumentMatch::indexImageA(double t) const
	{
		if (images.empty() || images.front().temps() > t + 1e-9)
		{
			return -1;
		}
		std::size_t bas = 0, haut = images.size() - 1;
		while (bas < haut)
		{
			const std::size_t milieu = (bas + haut + 1) / 2;
			if (images[milieu].temps() <= t + 1e-9)
			{
				bas = milieu;
			}
			else
			{
				haut = milieu - 1;
			}
		}
		return static_cast<int>(bas);
	}

	const FicheJoueur* DocumentMatch::ficheA(int code, double t) const
	{
		const FicheJoueur* f = fiche(code);
		for (const Remplacement& r : remplacements)
		{
			if (r.code == code && r.t <= t + 1e-9 && r.indexFiche >= 0)
			{
				f = &joueurs[static_cast<std::size_t>(r.indexFiche)];
			}
		}
		return f;
	}

	double DocumentMatch::vitesseMax(int code, double t) const
	{
		const FicheJoueur* f = ficheA(code, t);
		return f && f->aMoteur && f->moteur.vitesseMax > 0.0 ? f->moteur.vitesseMax : 9.0;
	}

	const Decision* DocumentMatch::derniereDecision(int code, double t, double fenetreS) const
	{
		// la première décision après t, puis on remonte jusqu'à une décision de ce joueur
		auto it = std::upper_bound(decisions.begin(), decisions.end(), t + 1e-9, [](double v, const Decision& d) { return v < d.t; });
		while (it != decisions.begin())
		{
			--it;
			if (t - it->t > fenetreS + 1e-9)
			{
				return nullptr;
			}
			if (it->code == code)
			{
				return &*it;
			}
		}
		return nullptr;
	}

	std::string texteOption(const OptionDecision& o)
	{
		struct Mot
		{
			std::string_view cle, texte;
		};
		static constexpr Mot kGenres[] = {
			{ "pass:pass", "passe" }, { "pass:through", "passe en profondeur" }, { "pass:space", "passe dans l'espace" },
			{ "pass:long", "passe longue" }, { "pass:switch", "renversement" },
			{ "carry:goal", "conduite vers le but" }, { "carry:fwd", "conduite vers l'avant" }, { "carry:in", "conduite vers l'axe" },
			{ "carry:line", "conduite le long de la ligne" }, { "carry:side", "conduite de côté" },
			{ "cross:near", "centre au premier poteau" }, { "cross:far", "centre au second poteau" },
			{ "cross:spot", "centre au point de penalty" }, { "cross:six", "centre dans les six mètres" } };
		static constexpr Mot kGestes[] = {
			{ "pass", "passe" }, { "shot", "frappe" }, { "carry", "conduite" }, { "cross", "centre" }, { "hold", "garder le ballon" }, { "clear", "dégagement" } };
		std::string texte = o.k;
		const std::string cle = o.k + ":" + o.genre;
		bool trouve = false;
		for (const Mot& m : kGenres)
		{
			if (m.cle == cle)
			{
				texte = std::string(m.texte);
				trouve = true;
			}
		}
		if (!trouve)
		{
			for (const Mot& m : kGestes)
			{
				if (m.cle == o.k)
				{
					texte = std::string(m.texte);
				}
			}
		}
		if (o.k == "pass" && o.vers >= 0)
		{
			texte += " vers #" + std::to_string(o.vers);
		}
		return texte;
	}

	EmpreinteImages::EmpreinteImages(std::uint32_t nombreDeLignes)
		: h1_(0xdeadbeefu ^ nombreDeLignes)
		, h2_(0x41c6ce57u ^ nombreDeLignes)
	{
	}

	void EmpreinteImages::ajouter(std::int32_t valeur)
	{
		const std::uint32_t c = static_cast<std::uint32_t>(valeur);
		h1_ = (h1_ ^ c) * 2654435761u;
		h2_ = (h2_ ^ c) * 1597334677u;
	}

	std::string EmpreinteImages::resultat() const
	{
		std::uint32_t h1 = h1_, h2 = h2_;
		h1 = ((h1 ^ (h1 >> 16)) * 2246822507u) ^ ((h2 ^ (h2 >> 13)) * 3266489909u);
		h2 = ((h2 ^ (h2 >> 16)) * 2246822507u) ^ ((h1 ^ (h1 >> 13)) * 3266489909u);
		const std::uint64_t r = 4294967296ull * static_cast<std::uint64_t>(2097151u & h2) + h1;
		return std::to_string(r);
	}

	ResultatChargement chargerDocument(std::string_view texte, DocumentMatch& doc)
	{
		json::Valeur racine;
		const json::ResultatLecture lu = json::lire(texte, racine);
		if (!lu.ok)
		{
			return erreurDocument("JSON illisible à l'octet " + std::to_string(lu.position) + " : " + lu.erreur);
		}
		return chargerDocument(racine, doc);
	}

	ResultatChargement chargerDocument(const json::Valeur& racine, DocumentMatch& doc)
	{
		doc = DocumentMatch{};
		doc.indexFiche.fill(-1);
		if (!racine.estObjet())
		{
			return erreurDocument("le document n'est pas un objet JSON");
		}
		if (racine.texteOu("format", "") != "linkfoot-match")
		{
			return erreurDocument("ce n'est pas un document linkfoot-match");
		}
		doc.version = static_cast<int>(racine.nombreOu("version", 0.0));
		if (doc.version != 1)
		{
			return erreurDocument("version " + std::to_string(doc.version) + " inconnue (ce lecteur lit la version 1)");
		}
		if (const json::Valeur* m = racine.champ("moteur"); m && m->estObjet())
		{
			doc.hz = m->nombreOu("hz", 10.0);
			doc.pas = m->nombreOu("pas", kPasMoteur);
			const json::Valeur* g = m->champ("graine");
			doc.graine = g && g->estNombre() ? static_cast<std::int64_t>(std::llround(g->nombre)) : -1;
		}
		if (doc.hz != 10.0)
		{
			return erreurDocument("le contrat fixe dix images par seconde");
		}
		if (const json::Valeur* m = racine.champ("match"); m && m->estObjet())
		{
			doc.competition = m->texteOu("competition", "");
			doc.meteo = m->texteOu("meteo", "soleil");
			doc.domicile = m->booleenOu("domicile", true);
			doc.debut = m->nombreOu("debut", 0.0);
			doc.fin = m->nombreOu("fin", 0.0);
		}
		if (const json::Valeur* e = racine.champ("equipes"); e && e->estObjet())
		{
			if (const json::Valeur* h = e->champ("H"); h && h->estObjet())
			{
				lireEquipe(*h, doc.equipes[0]);
			}
			if (const json::Valeur* a = e->champ("A"); a && a->estObjet())
			{
				lireEquipe(*a, doc.equipes[1]);
			}
		}
		if (const json::Valeur* js = racine.champ("joueurs"); js && js->genre == json::Genre::Tableau)
		{
			doc.joueurs.reserve(js->elements.size());
			for (const json::Valeur& o : js->elements)
			{
				if (!o.estObjet())
				{
					continue;
				}
				FicheJoueur f;
				lireFiche(o, f);
				if (f.code >= 0 && f.code < kJoueurs)
				{
					doc.indexFiche[static_cast<std::size_t>(f.code)] = static_cast<int>(doc.joueurs.size());
				}
				doc.joueurs.push_back(std::move(f));
			}
		}

		// Les images : le contrat d'abord (l'ordre exact des champs), puis les nombres.
		const json::Valeur* images = racine.champ("images");
		if (!images || !images->estObjet())
		{
			return erreurDocument("pas d'images");
		}
		const json::Valeur* champs = images->champ("champs");
		if (!champs || champs->genre != json::Genre::Tableau)
		{
			return erreurDocument("images.champs manquant");
		}
		const std::size_t nChamps = champs->elements.size();
		if (nChamps != static_cast<std::size_t>(kChampsImage) && nChamps != static_cast<std::size_t>(kChampsImage + kChampsCibles))
		{
			return erreurDocument("images.champs : " + std::to_string(nChamps) + " champs, le contrat en fixe "
				+ std::to_string(kChampsImage) + " (ou " + std::to_string(kChampsImage + kChampsCibles) + " en débogage)");
		}
		for (std::size_t i = 0; i < nChamps; ++i)
		{
			std::string attendu;
			if (i < static_cast<std::size_t>(kChampsTete))
			{
				attendu = std::string(kTete[i]);
			}
			else if (i < static_cast<std::size_t>(kChampsImage))
			{
				const std::size_t j = i - static_cast<std::size_t>(kChampsTete);
				attendu = std::string(kJoueur[j % kChampsJoueur]) + std::to_string(j / kChampsJoueur);
			}
			else
			{
				const std::size_t j = i - static_cast<std::size_t>(kChampsImage);
				attendu = std::string(j % 2 == 0 ? "cx" : "cy") + std::to_string(j / 2);
			}
			const json::Valeur& c = champs->elements[i];
			if (!c.estTexte() || c.texte != attendu)
			{
				return erreurDocument("images.champs[" + std::to_string(i) + "] devrait être « " + attendu + " »");
			}
		}
		const bool avecCibles = nChamps == static_cast<std::size_t>(kChampsImage + kChampsCibles);
		const json::Valeur* donnees = images->champ("donnees");
		if (!donnees || donnees->genre != json::Genre::Tableau)
		{
			return erreurDocument("images.donnees manquant");
		}
		EmpreinteImages empreinte(static_cast<std::uint32_t>(donnees->elements.size()));
		doc.images.resize(donnees->elements.size());
		if (avecCibles)
		{
			doc.cibles.resize(donnees->elements.size() * static_cast<std::size_t>(kChampsCibles));
		}
		for (std::size_t i = 0; i < donnees->elements.size(); ++i)
		{
			const json::Valeur& ligne = donnees->elements[i];
			if (ligne.genre != json::Genre::Nombres || ligne.nombres.size() != nChamps)
			{
				return erreurDocument("l'image " + std::to_string(i) + " n'a pas " + std::to_string(nChamps) + " nombres");
			}
			const std::vector<double>& r = ligne.nombres;
			for (const double v : r)
			{
				if (v != std::floor(v) || v < -2147483648.0 || v > 2147483647.0)
				{
					return erreurDocument("l'image " + std::to_string(i) + " contient un nombre qui n'est pas un entier");
				}
				empreinte.ajouter(static_cast<std::int32_t>(v));
			}
			Image& im = doc.images[i];
			im.t10 = static_cast<std::int32_t>(r[0]);
			im.horloge = static_cast<std::int32_t>(r[1]);
			im.miTemps = static_cast<std::int8_t>(r[2]);
			im.coupe = r[3] != 0.0;
			im.ballon = { static_cast<float>(r[4] / 100.0), static_cast<float>(r[5] / 100.0), static_cast<float>(r[6] / 100.0) };
			im.porteur = static_cast<std::int8_t>(r[7]);
			im.score = { static_cast<std::uint8_t>(r[8]), static_cast<std::uint8_t>(r[9]) };
			im.cpa = static_cast<Cpa>(static_cast<std::uint8_t>(r[10]));
			im.tireur = static_cast<std::int8_t>(r[11]);
			for (int k = 0; k < kJoueurs; ++k)
			{
				const std::size_t b = static_cast<std::size_t>(kChampsTete + k * kChampsJoueur);
				JoueurImage& j = im.joueurs[static_cast<std::size_t>(k)];
				j.present = r[b] > -500.0;
				j.x = static_cast<float>(r[b] / 100.0);
				j.y = static_cast<float>(r[b + 1] / 100.0);
				j.angle = static_cast<std::int16_t>(r[b + 2]);
				j.energie = static_cast<std::uint8_t>(r[b + 3]);
				j.etats = static_cast<std::uint8_t>(r[b + 4]);
				j.intention = static_cast<std::uint8_t>(r[b + 5]);
			}
			if (avecCibles)
			{
				for (int c = 0; c < kChampsCibles; ++c)
				{
					doc.cibles[i * static_cast<std::size_t>(kChampsCibles) + static_cast<std::size_t>(c)] =
						static_cast<float>(r[static_cast<std::size_t>(kChampsImage + c)] / 100.0);
				}
			}
		}
		doc.empreinteImages = empreinte.resultat();
		const std::string annoncee = racine.texteOu("empreinte_images", "");
		if (!annoncee.empty())
		{
			if (annoncee != doc.empreinteImages)
			{
				return erreurDocument("empreinte des images différente (" + annoncee + " annoncée, " + doc.empreinteImages
					+ " lue) : document modifié ou mal lu");
			}
			doc.empreinteImagesVerifiee = true;
		}
		doc.empreinte = racine.texteOu("empreinte", "");

		if (const json::Valeur* as = racine.champ("actions"); as && as->genre == json::Genre::Tableau)
		{
			doc.actions.reserve(as->elements.size());
			for (const json::Valeur& o : as->elements)
			{
				if (!o.estObjet())
				{
					continue;
				}
				Action a;
				for (const json::Membre& m : o.membres)
				{
					if (m.cle == "t" && m.valeur.estNombre())
					{
						a.t = m.valeur.nombre;
					}
					else if (m.cle == "c" && m.valeur.estNombre())
					{
						a.code = static_cast<int>(std::lround(m.valeur.nombre));
					}
					else if (m.cle == "a" && m.valeur.estTexte())
					{
						a.nom = m.valeur.texte;
					}
				}
				a.type = typeAction(a.nom);
				champsPlats(o, &a.nombres, &a.textes, &a.listes);
				doc.actions.push_back(std::move(a));
			}
		}
		// Les remplacements : le remplaçant (une fiche du banc, même camp) reprend le code. Ses
		// attributs du moteur voyagent avec l'action, puisqu'il n'en avait pas au coup d'envoi.
		std::vector<bool> ficheUtilisee(doc.joueurs.size(), false);
		for (const Action& a : doc.actions)
		{
			if (a.type != TypeAction::Remplacement || a.code < 0 || a.code >= kJoueurs)
			{
				continue;
			}
			Remplacement r;
			r.t = a.t;
			r.code = a.code;
			const std::string* entrant = a.texte("entrant");
			const char camp = a.code < 11 ? 'H' : 'A';
			for (std::size_t i = 0; entrant && i < doc.joueurs.size(); ++i)
			{
				FicheJoueur& f = doc.joueurs[i];
				if (f.code < 0 && !ficheUtilisee[i] && f.camp == camp && f.nom == *entrant)
				{
					ficheUtilisee[i] = true;
					r.indexFiche = static_cast<int>(i);
					if (!f.aMoteur && a.aNombre("vitesse_max"))
					{
						f.aMoteur = true;
						f.moteur.vitesseMax = a.nombre("vitesse_max");
						f.moteur.acceleration = a.nombre("acceleration");
						f.moteur.agilite = a.nombre("agilite");
						f.moteur.equilibre = a.nombre("equilibre");
					}
					break;
				}
			}
			doc.remplacements.push_back(r);
		}
		if (const json::Valeur* es = racine.champ("evenements"); es && es->genre == json::Genre::Tableau)
		{
			doc.evenements.reserve(es->elements.size());
			for (const json::Valeur& o : es->elements)
			{
				if (!o.estObjet())
				{
					continue;
				}
				Evenement e;
				e.t = o.nombreOu("t", 0.0);
				e.genre = texteDe(o, "k");
				e.texte = texteDe(o, "text");
				doc.evenements.push_back(std::move(e));
			}
		}
		if (const json::Valeur* ds = racine.champ("decisions"); ds && ds->genre == json::Genre::Tableau)
		{
			doc.decisions.reserve(ds->elements.size());
			for (const json::Valeur& o : ds->elements)
			{
				if (!o.estObjet())
				{
					continue;
				}
				Decision d;
				d.t = o.nombreOu("t", 0.0);
				d.code = static_cast<int>(o.nombreOu("c", -1.0));
				d.rang = static_cast<int>(o.nombreOu("rang", 0.0));
				d.bascule = o.booleenOu("bascule", false);
				if (const json::Valeur* ch = o.champ("choix"); ch && ch->estObjet())
				{
					d.choix = lireOptionDecision(*ch);
				}
				if (const json::Valeur* as2 = o.champ("autres"); as2 && as2->genre == json::Genre::Tableau)
				{
					for (const json::Valeur& a : as2->elements)
					{
						if (a.estObjet())
						{
							d.autres.push_back(lireOptionDecision(a));
						}
					}
				}
				if (d.code < 0 || d.code >= kJoueurs)
				{
					return erreurDocument("une décision désigne le code " + std::to_string(d.code));
				}
				if (!doc.decisions.empty() && d.t < doc.decisions.back().t - 1e-9)
				{
					return erreurDocument("des décisions hors de l'ordre du temps");
				}
				doc.decisions.push_back(std::move(d));
			}
		}
		if (const json::Valeur* res = racine.champ("resultat"); res && res->estObjet())
		{
			if (const json::Valeur* s = res->champ("score"); s && s->estTableau() && s->taille() == 2)
			{
				doc.aResultat = true;
				doc.scoreFinal = { static_cast<int>(s->nombreA(0)), static_cast<int>(s->nombreA(1)) };
			}
			if (const json::Valeur* st = res->champ("stats"); st && st->estObjet())
			{
				const char* camps[2] = { "H", "A" };
				for (int e = 0; e < 2; ++e)
				{
					const json::Valeur* o = st->champ(camps[e]);
					if (!o || !o->estObjet())
					{
						continue;
					}
					doc.aStatsFinales = true;
					StatsEquipe& se = doc.statsFinales[static_cast<std::size_t>(e)];
					se.tirs = entierOu(*o, "sh", 0);
					se.tirsCadres = entierOu(*o, "on", 0);
					se.xg = o->nombreOu("xg", 0.0);
					se.corners = entierOu(*o, "cor", 0);
					se.fautes = entierOu(*o, "fou", 0);
					se.jaunes = entierOu(*o, "yc", 0);
					se.rouges = entierOu(*o, "rc", 0);
					se.passes = entierOu(*o, "pa", 0);
					se.passesReussies = entierOu(*o, "pc", 0);
					se.horsJeu = entierOu(*o, "off", 0);
					se.tacles = entierOu(*o, "tk", 0);
				}
				doc.statsFinales[0].buts = doc.scoreFinal[0];
				doc.statsFinales[1].buts = doc.scoreFinal[1];
			}
			doc.possessionFinale = entierOu(*res, "possession", -1);
			if (const json::Valeur* no = res->champ("notes"); no && no->estObjet())
			{
				const char* camps[2] = { "H", "A" };
				for (int e = 0; e < 2; ++e)
				{
					const json::Valeur* l = no->champ(camps[e]);
					if (l && l->estTableau())
					{
						for (std::size_t i = 0; i < l->taille(); ++i)
						{
							doc.notesFinales[static_cast<std::size_t>(e)].push_back(l->nombreA(i, -1.0));
						}
					}
				}
			}
		}
		if (const json::Valeur* sc = racine.champ("scene"); sc && sc->estObjet())
		{
			doc.estScene = true;
			InfoScene& s = doc.scene;
			s.id = texteDe(*sc, "id");
			s.titre = texteDe(*sc, "titre");
			s.raison = texteDe(*sc, "raison");
			s.numero = entierOu(*sc, "numero", 0);
			s.focus = entierOu(*sc, "focus", -1);
			s.t0 = sc->nombreOu("t0", 0.0);
			s.t1 = sc->nombreOu("t1", 0.0);
			s.instant = sc->nombreOu("instant", s.t0);
			if (const json::Valeur* me = sc->champ("mesures"); me && me->estObjet())
			{
				champsPlats(*me, &s.mesures, nullptr, nullptr);
			}
		}
		ResultatChargement ok;
		ok.ok = true;
		return ok;
	}
}
