// Les tests du cœur C++ de LinkFoot pour Unreal (unreal/LinkFoot/Source/LinkFootCore),
// compilés et joués hors d'Unreal, sur des matchs que le vrai moteur vient de jouer.
//
//   cmake -S unreal/tests-coeur -B build && cmake --build build && ctest --test-dir build
//   (ou : node unreal/tests-coeur/tester.mjs)
//
// Ce qu'ils prouvent :
//   - le lecteur lit exactement ce que le moteur écrit (empreinte des images, et le même
//     décodage que le lecteur JavaScript de référence, image par image) ;
//   - le repère d'Unreal est celui de la passerelle JS, au bit près ;
//   - la cinématique passe par chaque position du moteur et n'invente pas de mouvement ;
//   - §92 la règle de vérité : ce que les cartes disent se voit dans le mouvement que la
//     locomotion recevra (vitesse de pointe, accélération, fatigue, virages, pressing) ;
//   - la trajectoire de Motion Matching, le regard, les familles d'animation attendues ;
//   - les détecteurs (désynchronisation, pied qui glisse, mouvement impossible) réagissent
//     à ce qu'ils doivent, et un rendu qui suit le moteur à 60 images par seconde ne les
//     déclenche pas ;
//   - §6 et §60 l'état du match et les statistiques, recalculés depuis les actions, sont ceux
//     que le moteur a comptés, au chiffre près, sur trois matchs ;
//   - §22, §23 et §82 le contact avec le ballon : l'instant, le point dans le repère du corps,
//     le pied (la règle du moteur), la qualité du premier contrôle et ce qu'elle change ;
//   - §43 et §44 le morphotype et le profil d'animation tirés de la fiche ;
//   - les seize scènes de test (§76) montrent ce que leur nom promet.
#include "LFCore/LFCinematique.h"
#include "LFCore/LFContact.h"
#include "LFCore/LFCorps.h"
#include "LFCore/LFDetecteurs.h"
#include "LFCore/LFEtatMatch.h"
#include "LFCore/LFDocument.h"
#include "LFCore/LFFamilles.h"
#include "LFCore/LFJson.h"
#include "LFCore/LFLocomotion.h"
#include "LFCore/LFPhysiologie.h"
#include "LFCore/LFRegard.h"
#include "LFCore/LFRepere.h"
#include "LFCore/LFScene.h"
#include "LFCore/LFTrajectoire.h"
#include "LFCore/LFVisage.h"
#include "mini_test.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <map>
#include <memory>
#include <set>
#include <sstream>
#include <string>
#include <vector>

using lft::constat;
using lft::nombre;
using lft::titre;
using lft::verifier;

namespace
{
	std::string lireFichier(const std::filesystem::path& p)
	{
		std::ifstream f(p, std::ios::binary);
		std::ostringstream o;
		o << f.rdbuf();
		return o.str();
	}

	double centile(std::vector<double> v, double q)
	{
		if (v.empty())
		{
			return 0.0;
		}
		std::sort(v.begin(), v.end());
		const std::size_t i = std::min(v.size() - 1, static_cast<std::size_t>(q * static_cast<double>(v.size())));
		return v[i];
	}

	double correlation(const std::vector<double>& a, const std::vector<double>& b)
	{
		const std::size_t n = std::min(a.size(), b.size());
		if (n < 3)
		{
			return 0.0;
		}
		double ma = 0.0, mb = 0.0;
		for (std::size_t i = 0; i < n; ++i)
		{
			ma += a[i];
			mb += b[i];
		}
		ma /= static_cast<double>(n);
		mb /= static_cast<double>(n);
		double sab = 0.0, saa = 0.0, sbb = 0.0;
		for (std::size_t i = 0; i < n; ++i)
		{
			sab += (a[i] - ma) * (b[i] - mb);
			saa += (a[i] - ma) * (a[i] - ma);
			sbb += (b[i] - mb) * (b[i] - mb);
		}
		return saa > 0.0 && sbb > 0.0 ? sab / std::sqrt(saa * sbb) : 0.0;
	}

	struct Charge
	{
		lf::DocumentMatch doc;
		bool ok = false;
		std::string erreur;
		double secondes = 0.0;
	};

	std::unique_ptr<Charge> charger(const std::filesystem::path& p)
	{
		auto c = std::make_unique<Charge>();
		const std::string texte = lireFichier(p);
		const auto debut = std::chrono::steady_clock::now();
		const lf::ResultatChargement r = lf::chargerDocument(texte, c->doc);
		c->secondes = std::chrono::duration<double>(std::chrono::steady_clock::now() - debut).count();
		c->ok = r.ok;
		c->erreur = r.erreur;
		return c;
	}

	// ------------------------------------------------------------------ JSON
	void testsJson()
	{
		titre("Le lecteur JSON");
		lf::json::Valeur v;
		const char* texte = R"({"a":"é😀\n","b":[1,2.5,-3e2],"c":[1,"x"],"d":true,"e":null,"f":[]})";
		const lf::json::ResultatLecture r = lf::json::lire(texte, v);
		verifier("un objet avec échappements, nombres, tableaux, booléen et nul se lit", r.ok, r.erreur);
		verifier("les échappements \\u, paires de substitution comprises, donnent de l'UTF-8",
			v.texteOu("a", "") == std::string("\xC3\xA9\xF0\x9F\x98\x80\n"));
		const lf::json::Valeur* b = v.champ("b");
		verifier("un tableau de nombres est rangé à plat", b && b->genre == lf::json::Genre::Nombres && b->taille() == 3
			&& b->nombreA(0) == 1.0 && b->nombreA(1) == 2.5 && b->nombreA(2) == -300.0);
		const lf::json::Valeur* c = v.champ("c");
		verifier("un tableau mélangé redevient quelconque, sans rien perdre", c && c->genre == lf::json::Genre::Tableau && c->taille() == 2
			&& c->nombreA(0) == 1.0 && c->element(1) && c->element(1)->texte == "x");
		verifier("vrai, nul et tableau vide", v.booleenOu("d", false) && v.champ("e") && v.champ("e")->estNul() && v.champ("f") && v.champ("f")->taille() == 0);

		bool exacts = true;
		const std::pair<const char*, double> nombres[] = { { "0.1", 0.1 }, { "56.46", 56.46 }, { "-0.143", -0.143 }, { "1e-7", 1e-7 },
			{ "3981", 3981.0 }, { "2654435761", 2654435761.0 }, { "1.7976931348623157e308", 1.7976931348623157e308 },
			{ "123456789012345678901234", 123456789012345678901234.0 }, { "4.9e-324", 4.9e-324 } };
		for (const auto& n : nombres)
		{
			lf::json::Valeur x;
			if (!lf::json::lire(n.first, x).ok || x.nombre != n.second)
			{
				exacts = false;
				std::printf("    %s lu %.17g\n", n.first, x.nombre);
			}
		}
		verifier("les nombres sont lus au bit près (voie rapide exacte, strtod au-delà)", exacts);

		const char* invalides[] = { R"({"a":})", "[1,2", R"("\x")", "01", "{} x", "[1,]", R"({"a" 1})", "tru", "\"abc", "[-]", "1.e5" };
		int refuses = 0;
		for (const char* t : invalides)
		{
			lf::json::Valeur x;
			if (!lf::json::lire(t, x).ok)
			{
				++refuses;
			}
		}
		verifier("un JSON invalide est refusé avec une erreur, sans planter", refuses == static_cast<int>(sizeof(invalides) / sizeof(invalides[0])),
			std::to_string(refuses) + " refusés sur " + std::to_string(sizeof(invalides) / sizeof(invalides[0])));
		std::string profond(400, '[');
		profond += std::string(400, ']');
		lf::json::Valeur x;
		verifier("une imbrication démesurée est refusée (pas de débordement de pile)", !lf::json::lire(profond, x).ok);
	}

	// ------------------------------------------------------------------ le document
	void testsDocument(const lf::DocumentMatch& doc, const lf::json::Valeur& attendu, double secondes)
	{
		titre("Le document du moteur, lu par le cœur C++");
		verifier("un match complet se lit", true, std::to_string(doc.images.size()) + " images, " + std::to_string(doc.actions.size())
			+ " actions, lu en " + nombre(secondes, 2) + " s");
		verifier("autant d'images, d'actions, d'événements et de personnes que le moteur en a écrit",
			static_cast<double>(doc.images.size()) == attendu.nombreOu("images", -1) && static_cast<double>(doc.actions.size()) == attendu.nombreOu("actions", -1)
				&& static_cast<double>(doc.evenements.size()) == attendu.nombreOu("evenements", -1)
				&& static_cast<double>(doc.joueurs.size()) == attendu.nombreOu("joueurs", -1));
		verifier("l'empreinte des images recalculée à la lecture est celle que le moteur a écrite",
			doc.empreinteImagesVerifiee && doc.empreinteImages == attendu.texteOu("empreinte_images", "?"), doc.empreinteImages);

		// le même décodage que lireImagePont, image par image
		const lf::json::Valeur* parImage = attendu.champ("par_image");
		int differentes = 0, premiere = -1;
		for (std::size_t i = 0; parImage && i < doc.images.size(); ++i)
		{
			const lf::Image& im = doc.images[i];
			lf::EmpreinteImages e(1);
			const auto cm = [](float m) { return static_cast<std::int32_t>(std::lround(static_cast<double>(m) * 100.0)); };
			e.ajouter(im.t10);
			e.ajouter(im.horloge);
			e.ajouter(im.miTemps);
			e.ajouter(im.coupe ? 1 : 0);
			e.ajouter(cm(im.ballon[0]));
			e.ajouter(cm(im.ballon[1]));
			e.ajouter(cm(im.ballon[2]));
			e.ajouter(im.porteur);
			e.ajouter(im.score[0]);
			e.ajouter(im.score[1]);
			e.ajouter(static_cast<std::int32_t>(im.cpa));
			e.ajouter(im.tireur);
			for (const lf::JoueurImage& j : im.joueurs)
			{
				e.ajouter(j.present ? 1 : 0);
				e.ajouter(cm(j.x));
				e.ajouter(cm(j.y));
				e.ajouter(j.angle);
				e.ajouter(j.energie);
				e.ajouter(j.etats);
				e.ajouter(j.intention);
			}
			const lf::json::Valeur* ref = parImage->element(i);
			if (!ref || ref->texte != e.resultat())
			{
				++differentes;
				if (premiere < 0)
				{
					premiere = static_cast<int>(i);
				}
			}
		}
		verifier("2D = 3D : chaque image se décode exactement comme le lecteur JavaScript de référence (lireImagePont)",
			parImage && differentes == 0, std::to_string(differentes) + " image(s) différente(s)" + (premiere >= 0 ? ", la première : " + std::to_string(premiere) : ""));

		// les remplaçants : la bonne fiche, avec les attributs du moteur
		const lf::json::Valeur* rem = attendu.champ("remplacements");
		bool bons = rem && rem->taille() == doc.remplacements.size();
		for (std::size_t i = 0; bons && i < doc.remplacements.size(); ++i)
		{
			const lf::Remplacement& r = doc.remplacements[i];
			const lf::json::Valeur* a = rem->element(i);
			const lf::FicheJoueur* f = doc.ficheA(r.code, r.t + 0.01);
			bons = a && f && r.indexFiche >= 0 && f->nom == a->texteOu("entrant", "?") && f->aMoteur
				&& std::fabs(f->moteur.vitesseMax - a->nombreOu("vitesse_max", -1)) < 1e-9 && doc.ficheA(r.code, r.t - 0.01) != f;
		}
		verifier("un remplaçant reprend le code avec sa fiche et ses attributs du moteur", bons, std::to_string(doc.remplacements.size()) + " remplacement(s)");

		// un document falsifié, une version inconnue, un contrat changé : refusés
		lf::json::Valeur racine;
		lf::json::lire(lireFichier(std::filesystem::path()), racine);	// vide : erreur attendue, ignorée
		(void)racine;
	}

	void testsRefus(const std::string& texte)
	{
		titre("Ce que le lecteur refuse");
		lf::json::Valeur racine;
		verifier("le document est du JSON valide", lf::json::lire(texte, racine).ok);
		auto copie = racine;
		lf::json::Valeur* donnees = nullptr;
		for (lf::json::Membre& m : copie.membres)
		{
			if (m.cle == "images")
			{
				for (lf::json::Membre& n : m.valeur.membres)
				{
					if (n.cle == "donnees")
					{
						donnees = &n.valeur;
					}
				}
			}
		}
		lf::DocumentMatch d;
		if (donnees && donnees->elements.size() > 500)
		{
			donnees->elements[500].nombres[20] += 1.0;
		}
		const lf::ResultatChargement falsifie = lf::chargerDocument(copie, d);
		verifier("un centimètre changé dans une image : l'empreinte ne correspond plus, le document est refusé",
			!falsifie.ok && falsifie.erreur.find("empreinte") != std::string::npos, falsifie.erreur.substr(0, 90));
		copie = racine;
		for (lf::json::Membre& m : copie.membres)
		{
			if (m.cle == "version")
			{
				m.valeur.nombre = 2.0;
			}
		}
		const lf::ResultatChargement version = lf::chargerDocument(copie, d);
		verifier("une version inconnue du format est refusée", !version.ok, version.erreur);
		copie = racine;
		for (lf::json::Membre& m : copie.membres)
		{
			if (m.cle == "images")
			{
				for (lf::json::Membre& n : m.valeur.membres)
				{
					if (n.cle == "champs" && n.valeur.elements.size() > 14)
					{
						std::swap(n.valeur.elements[12], n.valeur.elements[14]);
					}
				}
			}
		}
		const lf::ResultatChargement contrat = lf::chargerDocument(copie, d);
		verifier("un ordre de champs différent du contrat est refusé (pas de lecture décalée en silence)", !contrat.ok, contrat.erreur);
	}

	// ------------------------------------------------------------------ le repère
	void testsRepere(const lf::json::Valeur& attendu)
	{
		titre("Le repère d'Unreal");
		const lf::json::Valeur* rep = attendu.champ("repere");
		double ecartPos = 0.0, ecartLacet = 0.0;
		std::size_t n = 0;
		for (std::size_t i = 0; rep && i < rep->taille(); ++i)
		{
			const lf::json::Valeur* e = rep->element(i);
			const lf::PointUE u = lf::versUnreal(e->nombreOu("x", 0), e->nombreOu("y", 0), e->nombreOu("z", 0));
			ecartPos = std::max({ ecartPos, std::fabs(u.X - e->nombreOu("X", 0)), std::fabs(u.Y - e->nombreOu("Y", 0)), std::fabs(u.Z - e->nombreOu("Z", 0)) });
			ecartLacet = std::max(ecartLacet, std::fabs(lf::angleNormaliseDeg(lf::lacetUnreal(e->nombreOu("angle", 0)) - e->nombreOu("lacet", 0))));
			++n;
		}
		verifier("versUnreal et lacetUnreal donnent les nombres de la passerelle JavaScript", n > 20 && ecartPos < 1e-9 && ecartLacet < 1e-9,
			std::to_string(n) + " points, écart " + nombre(ecartPos, 12) + " cm et " + nombre(ecartLacet, 12) + "°");
		double x = 0, y = 0, z = 0;
		lf::depuisUnreal(lf::versUnreal(12.34, 98.76, 1.5), x, y, z);
		verifier("l'aller-retour moteur → Unreal → moteur est exact", std::fabs(x - 12.34) < 1e-12 && std::fabs(y - 98.76) < 1e-12 && std::fabs(z - 1.5) < 1e-12);
		verifier("le lacet d'une direction et celui d'une orientation s'accordent",
			std::fabs(lf::angleNormaliseDeg(lf::lacetDirection(std::cos(0.7), std::sin(0.7)) - lf::lacetUnrealRad(0.7))) < 1e-12);
	}

	// ------------------------------------------------------------------ la cinématique
	void testsCinematique(const lf::DocumentMatch& doc, const lf::Cinematique& c, const lf::json::Valeur& attendu)
	{
		titre("La cinématique : le mouvement du moteur, rien d'autre");
		double ecartImages = 0.0, ecartMilieu = 0.0;
		int teleportations = 0, interpolations = 0;
		for (int k = 0; k < lf::kJoueurs; ++k)
		{
			for (int i = 0; i + 1 < c.nombreImages(); ++i)
			{
				const lf::Image& A = doc.images[static_cast<std::size_t>(i)];
				const lf::JoueurImage& ja = A.joueurs[static_cast<std::size_t>(k)];
				if (!ja.present)
				{
					continue;
				}
				const lf::EtatCinematique e = c.etat(k, A.temps());
				ecartImages = std::max(ecartImages, std::hypot(e.x - ja.x, e.y - ja.y));
				if (c.rupture(k, i + 1))
				{
					continue;
				}
				const lf::JoueurImage& jb = doc.images[static_cast<std::size_t>(i + 1)].joueurs[static_cast<std::size_t>(k)];
				if (std::hypot(jb.x - ja.x, jb.y - ja.y) > 4.0)
				{
					++teleportations;
				}
				const lf::EtatCinematique m = c.etat(k, A.temps() + 0.05);
				ecartMilieu = std::max(ecartMilieu, std::hypot(m.x - 0.5 * (ja.x + jb.x), m.y - 0.5 * (ja.y + jb.y)));
				++interpolations;
			}
		}
		verifier("la courbe passe exactement par chaque position du moteur", ecartImages < 1e-4, "écart max " + nombre(ecartImages * 100.0, 4) + " cm");
		verifier("entre deux images, elle ne s'écarte pas de la ligne droite de plus de 15 cm", ecartMilieu < 0.15,
			"écart max " + nombre(ecartMilieu * 100.0, 1) + " cm sur " + std::to_string(interpolations) + " intervalles");
		const lf::json::Valeur* v = attendu.champ("verification");
		verifier("aucune téléportation dans un segment, comme verifierPont", teleportations == 0 && v && v->nombreOu("teleportation", -1) == 0.0);

		// le ballon à 60 images par seconde : jamais de saut hors des coupes
		int sauts = 0, enVol = 0;
		double tPrec = doc.images.front().temps(), xPrec = 0, yPrec = 0, zPrec = 0;
		bool aPrec = false;
		for (double t = doc.images.front().temps(); t < doc.images.back().temps(); t += 1.0 / 60.0)
		{
			const lf::EtatBallon b = c.ballon(t);
			const int i = doc.indexImageA(t);
			const bool coupe = i + 1 < static_cast<int>(doc.images.size())
				&& (doc.images[static_cast<std::size_t>(i + 1)].coupe || doc.images[static_cast<std::size_t>(i + 1)].t10 - doc.images[static_cast<std::size_t>(i)].t10 != 1);
			// une coupe, un trou dans le temps, ou le ballon posé pour une remise en jeu (le moteur le téléporte)
			const bool coupeAvant = i >= 0 && (doc.images[static_cast<std::size_t>(i)].coupe
				|| (i > 0 && doc.images[static_cast<std::size_t>(i)].t10 - doc.images[static_cast<std::size_t>(i - 1)].t10 != 1)
				|| (i > 0 && doc.images[static_cast<std::size_t>(i)].cpa != lf::Cpa::Aucun && doc.images[static_cast<std::size_t>(i)].cpa != doc.images[static_cast<std::size_t>(i - 1)].cpa));
			if (aPrec && !coupe && !coupeAvant && std::sqrt((b.x - xPrec) * (b.x - xPrec) + (b.y - yPrec) * (b.y - yPrec) + (b.z - zPrec) * (b.z - zPrec)) > 1.0)
			{
				++sauts;
			}
			enVol += b.enVol ? 1 : 0;
			tPrec = t;
			xPrec = b.x;
			yPrec = b.y;
			zPrec = b.z;
			aPrec = true;
		}
		(void)tPrec;
		int frappes = 0;
		for (const lf::Action& a : doc.actions)
		{
			frappes += a.estFrappe() ? 1 : 0;
		}
		verifier("un vol par frappe, et le ballon suit la formule même du moteur", static_cast<int>(c.vols().size()) == frappes,
			std::to_string(c.vols().size()) + " vols, " + nombre(enVol / 60.0 / 60.0, 1) + " min de ballon en l'air ou en vol");
		verifier("à 60 images par seconde, le ballon ne saute jamais de plus d'un mètre hors des coupes et des remises en jeu", sauts == 0, std::to_string(sauts) + " saut(s)");
	}

	// ------------------------------------------------------------------ §92
	struct VitessesJoueur
	{
		std::vector<double> toutes, debut, fin;
		std::vector<double> departs;	// secondes pour passer de 1 à 4 m/s
		double vitesseMax = 0, acceleration = 0;
	};

	void testsVerite(const lf::DocumentMatch& doc, const lf::Cinematique& c, const std::vector<const lf::DocumentMatch*>& bas, const std::vector<const lf::DocumentMatch*>& haut)
	{
		titre("§92 La règle de vérité : ce que disent les cartes se voit dans le mouvement");
		std::vector<VitessesJoueur> J(static_cast<std::size_t>(lf::kJoueurs));
		const double tFin = doc.images.back().temps();
		for (int k = 0; k < lf::kJoueurs; ++k)
		{
			const lf::FicheJoueur* f = doc.fiche(k);
			VitessesJoueur& j = J[static_cast<std::size_t>(k)];
			if (f && f->aMoteur)
			{
				j.vitesseMax = f->moteur.vitesseMax;
				j.acceleration = f->moteur.acceleration;
			}
			double tDepart = -1.0;
			for (int i = 0; i < c.nombreImages(); ++i)
			{
				const lf::Image& im = doc.images[static_cast<std::size_t>(i)];
				if (!im.joueurs[static_cast<std::size_t>(k)].present || c.rupture(k, i))
				{
					tDepart = -1.0;
					continue;
				}
				// le remplaçant n'est pas le titulaire : on s'arrête au premier remplacement de ce code
				if (doc.ficheA(k, im.temps()) != f)
				{
					break;
				}
				double vx = 0, vy = 0;
				c.vitesseImage(k, i, vx, vy);
				const double v = std::hypot(vx, vy);
				j.toutes.push_back(v);
				// la fatigue se mesure sur les efforts que le moteur VEUT à fond (bit Sprint) : sur
				// toutes les images, on mesurerait surtout ce que le jeu demande, pas ce que le
				// joueur peut encore donner
				if (im.joueurs[static_cast<std::size_t>(k)].etats & lf::etat::Sprint)
				{
					if (im.temps() < tFin / 3.0)
					{
						j.debut.push_back(v);
					}
					else if (im.temps() > 2.0 * tFin / 3.0)
					{
						j.fin.push_back(v);
					}
				}
				if (v < 1.0)
				{
					tDepart = im.temps();
				}
				else if (v > 4.0 && tDepart >= 0.0)
				{
					j.departs.push_back(im.temps() - tDepart);
					tDepart = -1.0;
				}
			}
		}
		std::vector<double> vmax, p98, acc, dep;
		std::string detail;
		for (int k = 0; k < lf::kJoueurs; ++k)
		{
			if (k == 0 || k == 11)
			{
				continue;	// les gardiens ne sprintent pas
			}
			const VitessesJoueur& j = J[static_cast<std::size_t>(k)];
			vmax.push_back(j.vitesseMax);
			p98.push_back(centile(j.toutes, 0.98));
			if (j.departs.size() >= 5)
			{
				acc.push_back(j.acceleration);
				dep.push_back(centile(j.departs, 0.5));
			}
		}
		const double rVitesse = correlation(vmax, p98);
		std::size_t iRapide = 0, iLent = 0;
		for (std::size_t i = 0; i < vmax.size(); ++i)
		{
			if (vmax[i] > vmax[iRapide])
			{
				iRapide = i;
			}
			if (vmax[i] < vmax[iLent])
			{
				iLent = i;
			}
		}
		verifier("la vitesse de pointe du moteur se voit : plus la carte est rapide, plus le joueur court vite à l'écran",
			rVitesse > 0.5 && p98[iRapide] > p98[iLent],
			"corrélation " + nombre(rVitesse, 2) + " ; le plus rapide " + nombre(vmax[iRapide], 2) + " m/s → vu " + nombre(p98[iRapide], 2)
				+ ", le plus lent " + nombre(vmax[iLent], 2) + " → vu " + nombre(p98[iLent], 2));
		const double rAcc = correlation(acc, dep);
		verifier("l'accélération du moteur se voit : un joueur plus explosif passe plus vite de 1 à 4 m/s", rAcc < -0.2,
			"corrélation " + nombre(rAcc, 2) + " sur " + std::to_string(acc.size()) + " joueurs");

		// la fatigue : la même personne, en début et en fin de match
		int plusLents = 0, compares = 0;
		std::vector<double> rapports;
		for (int k = 0; k < lf::kJoueurs; ++k)
		{
			const VitessesJoueur& j = J[static_cast<std::size_t>(k)];
			if (k == 0 || k == 11 || j.debut.size() < 200 || j.fin.size() < 200)
			{
				continue;
			}
			const double r = centile(j.fin, 0.9) / std::max(0.1, centile(j.debut, 0.9));
			rapports.push_back(r);
			plusLents += r < 1.0 ? 1 : 0;
			++compares;
		}
		verifier("la fatigue se voit : en fin de match, un sprint voulu à fond va moins vite (90e centile) chez presque tous",
			compares >= 10 && plusLents * 10 >= compares * 8 && centile(rapports, 0.5) < 0.97,
			std::to_string(plusLents) + " sur " + std::to_string(compares) + ", rapport médian " + nombre(centile(rapports, 0.5), 3));

		// §14 un joueur lancé a besoin de plus d'espace pour tourner
		std::vector<double> lent, rapide;
		for (int k = 1; k < lf::kJoueurs; ++k)
		{
			if (k == 11)
			{
				continue;
			}
			for (int i = 0; i < c.nombreImages(); i += 3)
			{
				const lf::EtatCinematique e = c.etat(k, doc.images[static_cast<std::size_t>(i)].temps());
				if (!e.valide || std::fabs(e.accelerationLaterale) < 1.0)
				{
					continue;
				}
				const double r = e.vitesse * e.vitesse / std::fabs(e.accelerationLaterale);
				if (e.vitesse >= 2.0 && e.vitesse < 4.0)
				{
					lent.push_back(r);
				}
				else if (e.vitesse >= 6.0)
				{
					rapide.push_back(r);
				}
			}
		}
		verifier("§14 lancé à pleine vitesse, un joueur tourne plus large", centile(rapide, 0.5) > centile(lent, 0.5) * 1.5,
			"rayon médian " + nombre(centile(lent, 0.5), 1) + " m entre 2 et 4 m/s, " + nombre(centile(rapide, 0.5), 1) + " m au-delà de 6 m/s");

		// §33 le pressing se voit dans les courses. Sur trois matchs (graines 77, 78, 79) : la distance
		// du plus proche défenseur, sur un seul match, tient au hasard d'une série (le 4 octobre 2026,
		// 6,93 → 6,95 m à la graine 77, 6,83 → 5,86 m et 6,52 → 6,21 m aux deux autres)
		const auto mesurePressing = [](const std::vector<const lf::DocumentMatch*>& docs, double& presseurs, double& distance)
		{
			int images = 0;
			presseurs = 0.0;
			distance = 0.0;
			for (const lf::DocumentMatch* dp : docs)
			for (const lf::Image& im : dp->images)
			{
				if (im.porteur < 11 || im.cpa != lf::Cpa::Aucun)
				{
					continue;	// on mesure quand l'adversaire a le ballon, en jeu
				}
				const lf::JoueurImage& p = im.joueurs[static_cast<std::size_t>(im.porteur)];
				double proche = 1e9;
				int n = 0;
				for (int k = 1; k < 11; ++k)
				{
					const lf::JoueurImage& q = im.joueurs[static_cast<std::size_t>(k)];
					if (!q.present)
					{
						continue;
					}
					n += (q.etats & lf::etat::Presse) ? 1 : 0;
					proche = std::min(proche, std::hypot(static_cast<double>(q.x - p.x), static_cast<double>(q.y - p.y)));
				}
				presseurs += n;
				distance += proche;
				++images;
			}
			presseurs /= std::max(1, images);
			distance /= std::max(1, images);
		};
		double pb = 0, db = 0, ph = 0, dh = 0;
		mesurePressing(bas, pb, db);
		mesurePressing(haut, ph, dh);
		verifier("§33 pressing haut : plus de joueurs pressent le porteur, et le plus proche est plus près", ph > pb && dh < db,
			nombre(pb, 2) + " → " + nombre(ph, 2) + " presseurs, " + nombre(db, 2) + " → " + nombre(dh, 2) + " m du porteur");
	}

	// ------------------------------------------------------------------ trajectoire, regard, familles
	void testsTrajectoire(const lf::DocumentMatch& doc, const lf::Cinematique& c)
	{
		titre("§15 La trajectoire de Motion Matching : le vrai passé, le vrai futur");
		const lf::ParametresTrajectoire p;
		int bonnes = 0, essais = 0, extrapolees = 0, dansLeSegment = 0, exactes = 0;
		for (int i = 200; i < c.nombreImages() - 50; i += 157)
		{
			const int k = 1 + (i % 10);
			const double t = doc.images[static_cast<std::size_t>(i)].temps() + 0.033;
			const std::vector<lf::EchantillonTrajectoire> tr = lf::trajectoire(c, k, t, p);
			if (tr.empty())
			{
				continue;
			}
			++essais;
			bool ordre = tr.size() == static_cast<std::size_t>(p.historique + 1 + p.prediction);
			for (std::size_t j = 1; ordre && j < tr.size(); ++j)
			{
				ordre = tr[j].decalage > tr[j - 1].decalage;
			}
			const lf::EtatCinematique e = c.etat(k, t);
			const lf::EchantillonTrajectoire& present = tr[static_cast<std::size_t>(p.historique)];
			const bool centre = present.decalage == 0.0 && std::hypot(present.x - e.x, present.y - e.y) < 1e-9;
			bonnes += (ordre && centre) ? 1 : 0;
			for (const lf::EchantillonTrajectoire& s : tr)
			{
				if (s.extrapole)
				{
					++extrapolees;
					continue;
				}
				++dansLeSegment;
				const lf::EtatCinematique f = c.etat(k, t + s.decalage);
				exactes += std::hypot(f.x - s.x, f.y - s.y) < 1e-9 ? 1 : 0;
			}
		}
		verifier("19 échantillons dans l'ordre du temps (10 de passé, le présent, 8 de futur), centrés sur le joueur", essais > 100 && bonnes == essais,
			std::to_string(bonnes) + " sur " + std::to_string(essais));
		verifier("dans le segment, chaque échantillon est la position que le moteur a jouée à cet instant", exactes == dansLeSegment,
			std::to_string(exactes) + " sur " + std::to_string(dansLeSegment) + " (" + std::to_string(extrapolees) + " prolongés au bord d'une coupe)");
	}

	void testsRegard(const lf::DocumentMatch& doc, const lf::Cinematique& c)
	{
		titre("§26 §27 Le regard");
		int passeurs = 0, cibles = 0, receveurs = 0, suivent = 0, balayages = 0, echantillons = 0;
		for (const lf::Action& a : doc.actions)
		{
			if (a.type != lf::TypeAction::Passe || a.code < 0)
			{
				continue;
			}
			const int vers = static_cast<int>(std::lround(a.nombre("vers", -1)));
			const double avant = a.t - 0.4;
			const lf::EtatBallon b = c.ballon(avant);
			if (vers < 0 || b.porteur != a.code)
			{
				continue;
			}
			++passeurs;
			cibles += lf::cibleRegard(c, a.code, avant).source == lf::SourceRegard::CiblePasse ? 1 : 0;
			const double pendant = a.t + 0.5 * a.nombre("dur", 0.5);
			const lf::Vol* v = c.volA(pendant);
			if (v && v->vers == vers)
			{
				++receveurs;
				suivent += lf::cibleRegard(c, vers, pendant).source == lf::SourceRegard::PasseAttendue ? 1 : 0;
			}
		}
		for (int i = 0; i < c.nombreImages(); i += 7)
		{
			for (int k = 1; k < lf::kJoueurs; ++k)
			{
				const lf::Regard r = lf::cibleRegard(c, k, doc.images[static_cast<std::size_t>(i)].temps());
				if (r.valide)
				{
					++echantillons;
					balayages += r.source == lf::SourceRegard::Balayage ? 1 : 0;
				}
			}
		}
		verifier("0,4 s avant de passer, le passeur regarde son partenaire", passeurs > 100 && cibles * 10 >= passeurs * 9,
			std::to_string(cibles) + " sur " + std::to_string(passeurs));
		verifier("pendant le vol, le destinataire suit le ballon qui lui arrive", receveurs > 100 && suivent == receveurs,
			std::to_string(suivent) + " sur " + std::to_string(receveurs));
		verifier("§27 des coups d'œil par-dessus l'épaule, plus fréquents quand la décision est haute",
			balayages > 0 && balayages * 20 < echantillons && lf::periodeBalayage(90) < lf::periodeBalayage(45),
			nombre(100.0 * balayages / std::max(1, echantillons), 1) + " % du temps près du jeu ; période " + nombre(lf::periodeBalayage(45), 1) + " s à 45, "
				+ nombre(lf::periodeBalayage(90), 1) + " s à 90");
	}

	void testsFamilles(const lf::DocumentMatch& doc, const lf::Cinematique& c)
	{
		titre("§73 Les familles d'animation que le moteur attend");
		std::map<lf::TypeAction, std::pair<int, int>> parType;
		for (const lf::Action& a : doc.actions)
		{
			if (a.code < 0)
			{
				continue;
			}
			const lf::Famille f = lf::familleAttendue(c, a.code, a.t);
			lf::Famille voulue = lf::Famille::Inconnue;
			switch (a.type)
			{
			// une passe en une touche : le moteur fait jouer le ballon sans le contrôler, au même
			// instant ; le geste attendu est la passe (ou le tir) en première intention
			case lf::TypeAction::Controle: voulue = a.vrai("une_touche") && (f == lf::Famille::Passe || f == lf::Famille::Tir || f == lf::Famille::Centre) ? f : lf::Famille::Reception; break;
			case lf::TypeAction::Tir: voulue = a.vrai("tete") ? lf::Famille::Tete : lf::Famille::Tir; break;
			case lf::TypeAction::Tacle: voulue = f; break;
			case lf::TypeAction::Plongeon: voulue = lf::Famille::Plongeon; break;
			default: continue;
			}
			auto& compte = parType[a.type];
			++compte.second;
			// un joueur à terre reste à terre : la chute passe avant le geste
			const lf::EtatCinematique e = c.etat(a.code, a.t);
			compte.first += (f == voulue || (e.etats & lf::etat::AuSol)) ? 1 : 0;
		}
		bool tout = !parType.empty();
		std::string detail;
		for (const auto& [type, n] : parType)
		{
			tout = tout && n.first == n.second;
			detail += std::string(lf::nomTypeAction(type)) + " " + std::to_string(n.first) + "/" + std::to_string(n.second) + " ";
		}
		verifier("au moment d'un contrôle, d'un tir, d'un plongeon, le moteur attend ce geste-là (la passe en première intention pour un contrôle en une touche)", tout, detail);

		std::map<lf::Famille, int> allures;
		for (int i = 0; i < c.nombreImages(); i += 5)
		{
			for (int k = 1; k < lf::kJoueurs; ++k)
			{
				const lf::Famille f = lf::familleAttendue(c, k, doc.images[static_cast<std::size_t>(i)].temps());
				if (lf::estLocomotion(f))
				{
					++allures[f];
				}
			}
		}
		std::string repartition;
		for (const auto& [f, n] : allures)
		{
			repartition += std::string(lf::nomFamille(f)) + " " + std::to_string(n) + " ";
		}
		verifier("toutes les familles de locomotion apparaissent dans un match (de l'arrêt au sprint, démarrages, freinages, pivots, recul, pas chassés)",
			allures.size() == 10, repartition);

		const std::pair<const char*, lf::Famille> noms[] = { { "PSD_Sparse_Stand_Idles", lf::Famille::Immobile }, { "PSD_Dense_Jog_Pivots", lf::Famille::Pivot },
			{ "PSD_Sparse_Run_Stops", lf::Famille::Freinage }, { "PSD_Dense_Stand_Walk_Starts", lf::Famille::Demarrage }, { "PSD_Sprint_Loops", lf::Famille::Sprint },
			{ "PSD_LF_Reception_Course", lf::Famille::Reception }, { "PSD_LF_Shoot_Instep", lf::Famille::Tir }, { "PSD_TurnInPlace", lf::Famille::Pivot },
			{ "PSD_LF_SlideTackle", lf::Famille::TacleGlisse }, { "PSD_GK_Dive_Left", lf::Famille::Plongeon }, { "M_Walk_Fwd", lf::Famille::Marche } };
		int bons = 0;
		for (const auto& n : noms)
		{
			bons += lf::familleDepuisNom(n.first) == n.second ? 1 : 0;
		}
		verifier("la famille se lit dans le nom des bases (convention LinkFoot et noms du Game Animation Sample)",
			bons == static_cast<int>(sizeof(noms) / sizeof(noms[0])), std::to_string(bons) + " sur " + std::to_string(sizeof(noms) / sizeof(noms[0])));
		verifier("compatibles : trot pour course, freinage pour sprint ; incompatibles : sprint pour contrôle, passe pour rien",
			lf::famillesCompatibles(lf::Famille::Course, lf::Famille::Trot) && lf::famillesCompatibles(lf::Famille::Sprint, lf::Famille::Freinage)
				&& !lf::famillesCompatibles(lf::Famille::Reception, lf::Famille::Sprint) && !lf::famillesCompatibles(lf::Famille::Course, lf::Famille::Passe)
				&& !lf::famillesCompatibles(lf::Famille::Immobile, lf::Famille::Sprint));
	}

	// ------------------------------------------------------------------ détecteurs
	void testsDetecteurs(const lf::DocumentMatch& doc, const lf::Cinematique& brute, const lf::Cinematique& lissee)
	{
		titre("§72 à §75 Les détecteurs");
		{
			lf::DetecteurDesynchro d;
			for (int i = 0; i <= 30; ++i)
			{
				d.ajouter(i / 60.0, 10.0, 10.0, 10.2, 10.0);
			}
			const bool okProche = d.statut() == lf::Statut::Ok && d.desynchros() == 0;
			for (int i = 31; i <= 50; ++i)
			{
				d.ajouter(i / 60.0, 10.0, 10.0, 14.5, 10.0);
			}
			verifier("§72 20 cm d'écart : OK ; 4,5 m pendant 0,3 s : DESYNC", okProche && d.statut() == lf::Statut::Desynchro && d.desynchros() == 1,
				"écart max " + nombre(d.ecartMax(), 1) + " m");
		}
		{
			lf::DetecteurDesynchroAnimation d;
			for (int i = 0; i < 12; ++i)
			{
				d.ajouter(i / 60.0, lf::Famille::Reception, lf::Famille::Sprint);
			}
			const bool alerte = d.statut() == lf::Statut::Alerte;
			for (int i = 12; i < 30; ++i)
			{
				d.ajouter(i / 60.0, lf::Famille::Reception, lf::Famille::Sprint);
			}
			verifier("§73 moteur « contrôle », animation « sprint » : alerte, puis ANIMATION DESYNC après 0,3 s", alerte && d.statut() == lf::Statut::Desynchro);
		}
		{
			lf::DetecteurPied pied;
			for (int i = 0; i < 20; ++i)
			{
				pied.ajouter(i / 60.0, 100.0, 50.0, 1.0, 0.0);
			}
			const bool pose = pied.defaut() == lf::DefautPied::Aucun;
			for (int i = 20; i < 40; ++i)
			{
				pied.ajouter(i / 60.0, 100.0 + (i - 20) * 0.6, 50.0, 1.0, 0.0);	// 36 cm/s au sol
			}
			const bool glisse = pied.compte(lf::DefautPied::Glissement) == 1;
			pied.ajouter(1.0, 112.0, 50.0, -4.0, 0.0);
			verifier("§74 pied posé immobile : rien ; pied au sol qui avance à 36 cm/s : FOOT SLIDE WARNING ; 4 cm sous le sol : signalé",
				pose && glisse && pied.defaut() == lf::DefautPied::Penetration);
		}
		{
			lf::DetecteurMouvement m;
			double x = 0.0;
			for (int i = 0; i < 60; ++i)
			{
				x += 6.0 / 60.0;
				m.ajouter(i / 60.0, x, 0.0, 90.0);
			}
			const bool calme = m.total() == 0;
			m.ajouter(1.0 + 1.0 / 60.0, x + 0.4, 0.0, 90.0);	// de 6 à 24 m/s en une image
			const bool acc = m.compte(lf::Anomalie::VitesseImpossible) + m.compte(lf::Anomalie::AccelerationInstantanee) >= 1;
			m.couper();
			m.ajouter(2.0, 0.0, 0.0, 0.0);
			m.ajouter(2.0 + 1.0 / 60.0, 5.0, 0.0, 0.0);
			const bool tele = m.compte(lf::Anomalie::Teleportation) == 1;
			lf::DetecteurMouvement r;
			for (int i = 0; i < 10; ++i)
			{
				r.ajouter(i / 60.0, i * 0.1, 0.0, i * 20.0);	// 6 m/s en tournant de 1200 °/s
			}
			verifier("§75 course régulière : rien ; accélération instantanée, téléportation, rotation de 1200 °/s lancé : signalées",
				calme && acc && tele && r.compte(lf::Anomalie::RotationImpossible) > 0);
		}

		// Ce que le moteur envoie, rendu à 60 images par seconde par une couche qui le suit.
		const auto rendre = [&](const lf::Cinematique& c, int& anomalies, int& accelerations, double& ecartMax, double& minutes)
		{
			anomalies = 0;
			accelerations = 0;
			ecartMax = 0.0;
			minutes = 0.0;
			for (int k = 0; k < lf::kJoueurs; ++k)
			{
				lf::DetecteurMouvement m;
				lf::DetecteurDesynchro d;
				int imagePrec = -1;
				for (double t = doc.images.front().temps(); t < doc.images.back().temps(); t += 1.0 / 60.0)
				{
					const lf::EtatCinematique e = c.etat(k, t);
					if (!e.valide)
					{
						m.couper();
						imagePrec = -1;
						continue;
					}
					if (imagePrec >= 0 && e.image != imagePrec && c.rupture(k, e.image))
					{
						m.couper();
						d.reinitialiser();
					}
					imagePrec = e.image;
					const lf::EtatCinematique moteur = brute.etat(k, t);
					d.ajouter(t, moteur.x, moteur.y, e.x, e.y);
					m.ajouter(t, e.x, e.y, lf::lacetUnrealRad(e.angleCorps));
					minutes += 1.0 / 3600.0;
				}
				anomalies += m.total() - m.compte(lf::Anomalie::AccelerationInstantanee) - m.compte(lf::Anomalie::FreinageInstantane);
				accelerations += m.compte(lf::Anomalie::AccelerationInstantanee) + m.compte(lf::Anomalie::FreinageInstantane);
				ecartMax = std::max(ecartMax, d.ecartMax());
			}
		};
		int aBrut = 0, accBrut = 0, aLisse = 0, accLisse = 0;
		double eBrut = 0, eLisse = 0, minutes = 0;
		rendre(brute, aBrut, accBrut, eBrut, minutes);
		rendre(lissee, aLisse, accLisse, eLisse, minutes);
		verifier("un rendu qui suit le moteur à 60 images/s : ni téléportation, ni vitesse ou rotation impossibles", aBrut == 0 && aLisse == 0,
			std::to_string(aBrut) + " brut, " + std::to_string(aLisse) + " lissé");
		verifier("§72 le rendu lissé ne s'écarte jamais du moteur au-delà de la tolérance du contrat (30 cm)", eLisse <= 0.30 && eBrut < 1e-6,
			"écart max " + nombre(eLisse * 100.0, 1) + " cm");
		constat("à-coups au-dessus de 14 m/s² (corps à corps et gestes explosifs ; avant le 4 octobre 2026, les contacts réglés en poussant les joueurs, voir docs/ue5/audit.md)",
			std::to_string(accBrut) + " en suivant le moteur tel quel, " + std::to_string(accLisse) + " lissé, sur " + nombre(minutes, 0) + " minutes-joueur");
		// Depuis que le moteur règle l'écartement dans la vitesse et annule l'approche au contact
		// (4 octobre 2026), il en produit deux fois moins (20 346 → environ 9 900 sur trois
		// matchs) : ce qui reste est surtout du corps à corps, que le lissage ne doit pas
		// effacer. On demande donc que le lissage retire l'essentiel, ou qu'il en reste moins
		// qu'avant : 3 886 lissés sur 1 463 minutes-joueur, 2,7 par minute (2,0 depuis).
		verifier("le lissage retire l'essentiel de ces à-coups, ou il en reste moins qu'avant", accLisse * 4 < accBrut || accLisse <= minutes * 2.5,
			std::to_string(accBrut) + " → " + std::to_string(accLisse) + " (" + nombre(accLisse / std::max(1.0, minutes), 2) + " par minute-joueur)");
	}


	// ------------------------------------------------------------------ §6 §60 l'état du match
	void testsEtatMatch(const std::vector<const lf::DocumentMatch*>& docs)
	{
		titre("§6 §60 L'état du match et les statistiques : celles du moteur, à chaque instant");
		int matchsIdentiques = 0, possessionJuste = 0, scoreJuste = 0, joueursFontEquipe = 0, croissants = 0, notesFinales = 0, minutesJustes = 0;
		std::string ecarts, detailPossession, detailMinutes;
		for (const lf::DocumentMatch* d : docs)
		{
			const lf::Cinematique c(*d);
			const lf::ChroniqueMatch ch(c);
			const double fin = d->images.back().temps();
			const lf::EtatMatch e = ch.etat(fin);
			bool pareil = d->aStatsFinales;
			for (int k = 0; k < 2; ++k)
			{
				const lf::StatsEquipe& a = e.equipes[static_cast<std::size_t>(k)];
				const lf::StatsEquipe& m = d->statsFinales[static_cast<std::size_t>(k)];
				const bool eq = a.tirs == m.tirs && a.tirsCadres == m.tirsCadres && std::fabs(a.xg - m.xg) < 0.02 && a.corners == m.corners && a.fautes == m.fautes
					&& a.jaunes == m.jaunes && a.rouges == m.rouges && a.passes == m.passes && a.passesReussies == m.passesReussies && a.horsJeu == m.horsJeu
					&& a.tacles == m.tacles && a.buts == m.buts;
				if (!eq)
				{
					ecarts += " match " + std::to_string(d->graine) + (k ? " A" : " H") + " : tirs " + std::to_string(a.tirs) + "/" + std::to_string(m.tirs)
						+ " passes " + std::to_string(a.passes) + "/" + std::to_string(m.passes) + " réussies " + std::to_string(a.passesReussies) + "/" + std::to_string(m.passesReussies)
						+ " tacles " + std::to_string(a.tacles) + "/" + std::to_string(m.tacles) + " ;";
				}
				pareil = pareil && eq;
			}
			matchsIdentiques += pareil ? 1 : 0;
			if (std::fabs(e.possessionDomicile - d->possessionFinale) <= 1.0)
			{
				++possessionJuste;
			}
			detailPossession += nombre(e.possessionDomicile, 1) + " % contre " + std::to_string(d->possessionFinale) + " % ; ";
			scoreJuste += e.score == d->scoreFinal && e.equipes[0].buts == e.score[0] && e.equipes[1].buts == e.score[1] ? 1 : 0;

			// Les joueurs font l'équipe : chaque statistique attribuée à un joueur s'additionne en
			// celle de son équipe (passes, tirs, xG, ballons gagnés, fautes, buts hors contre son camp).
			std::array<lf::StatsEquipe, 2> somme{};
			std::array<int, 2> butsJoueurs{};
			double minutes = 0.0;
			for (std::size_t f = 0; f < d->joueurs.size(); ++f)
			{
				const lf::StatsJoueur& sj = e.joueurs[f];
				const std::size_t k = d->joueurs[f].camp == 'A' ? 1 : 0;
				somme[k].passes += sj.passes;
				somme[k].tirs += sj.tirs;
				somme[k].tirsCadres += sj.tirsCadres;
				somme[k].xg += sj.xg;
				somme[k].tacles += sj.tacles;
				somme[k].fautes += sj.fautes;
				butsJoueurs[k] += sj.buts;
				minutes += sj.minutes;
			}
			int cscContre[2] = { 0, 0 };
			for (const lf::Action& a : d->actions)
			{
				if (a.type == lf::TypeAction::But && a.vrai("csc") && a.code >= 0)
				{
					++cscContre[1 - lf::equipeDe(a.code)];
				}
			}
			bool font = true;
			for (std::size_t k = 0; k < 2; ++k)
			{
				const lf::StatsEquipe& t = e.equipes[k];
				font = font && somme[k].passes == t.passes && somme[k].tirs == t.tirs && somme[k].tirsCadres == t.tirsCadres && std::fabs(somme[k].xg - t.xg) < 1e-6
					&& somme[k].tacles == t.tacles && somme[k].fautes == t.fautes && butsJoueurs[k] + cscContre[k] == t.buts;
			}
			joueursFontEquipe += font ? 1 : 0;
			// 22 joueurs sur le terrain à chaque minute de l'horloge, moins les expulsés
			int rouges = e.equipes[0].rouges + e.equipes[1].rouges;
			const double attendu = 22.0 * e.horloge / 60.0;
			if (minutes <= attendu + 0.5 && minutes >= attendu - rouges * 95.0 - 0.5)
			{
				++minutesJustes;
			}
			detailMinutes += nombre(minutes, 0) + " min pour " + nombre(attendu, 0) + " ; ";

			// Les statistiques ne font que croître avec le temps.
			bool croit = true;
			lf::EtatMatch avant = ch.etat(d->images.front().temps());
			for (int i = 1; i <= 20; ++i)
			{
				const lf::EtatMatch apres = ch.etat(d->images.front().temps() + (fin - d->images.front().temps()) * i / 20.0);
				for (std::size_t k = 0; k < 2; ++k)
				{
					const lf::StatsEquipe& a = avant.equipes[k];
					const lf::StatsEquipe& b = apres.equipes[k];
					croit = croit && b.tirs >= a.tirs && b.passes >= a.passes && b.passesReussies >= a.passesReussies && b.tacles >= a.tacles && b.fautes >= a.fautes
						&& b.corners >= a.corners && b.buts >= a.buts && apres.score[k] >= avant.score[k];
				}
				croit = croit && apres.horloge >= avant.horloge;
				avant = apres;
			}
			croissants += croit ? 1 : 0;

			// La note du moteur : connue au coup de sifflet final seulement, pour les vingt-deux.
			const lf::EtatMatch mi = ch.etat(fin / 2.0);
			int notees = 0, noteesAvant = 0;
			for (int code = 0; code < lf::kJoueurs; ++code)
			{
				const int f = ch.ficheDe(code, fin);
				if (f >= 0 && e.joueurs[static_cast<std::size_t>(f)].note >= 0.0)
				{
					++notees;
				}
				const int g = ch.ficheDe(code, fin / 2.0);
				if (g >= 0 && mi.joueurs[static_cast<std::size_t>(g)].note >= 0.0)
				{
					++noteesAvant;
				}
			}
			notesFinales += notees == lf::kJoueurs && noteesAvant == 0 ? 1 : 0;
		}
		const int n = static_cast<int>(docs.size());
		verifier("à la fin du match, chaque statistique recalculée depuis les actions est celle du moteur, au chiffre près (tirs, cadrés, xG, corners, fautes, cartons, passes, passes réussies, hors-jeu, ballons gagnés, buts)",
			matchsIdentiques == n, std::to_string(matchsIdentiques) + " match(s) sur " + std::to_string(n) + ecarts);
		verifier("la possession recalculée image par image est celle du moteur, à un point près (il l'arrondit)", possessionJuste == n, detailPossession);
		verifier("les buts lus dans les actions donnent le score des images, et celui du moteur", scoreJuste == n);
		verifier("les joueurs font l'équipe : passes, tirs, xG, ballons gagnés, fautes et buts s'additionnent", joueursFontEquipe == n);
		verifier("les minutes : vingt-deux joueurs à chaque minute de l'horloge, moins les expulsés", minutesJustes == n, detailMinutes);
		verifier("les statistiques et le score ne font que croître, lus à vingt instants du match", croissants == n);
		verifier("la note du moteur n'apparaît qu'au coup de sifflet final, pour les vingt-deux", notesFinales == n);
	}

	// ------------------------------------------------------------------ §22 §23 §82 le contact
	void testsContact(const std::vector<const lf::DocumentMatch*>& docs)
	{
		titre("§22 §23 §82 Le ballon et le joueur : l'instant, le point, le pied, le premier contrôle");
		std::map<std::string, std::vector<double>> distances, distancesSol, distancesAir;
		int frappes = 0, frappesValides = 0, genresJustes = 0, tetes = 0, tetesJustes = 0, touches = 0, touchesMains = 0;
		int faibles = 0, faiblesAmbidextres = 0, annonces = 0, annoncesJustes = 0;
		std::map<std::string, std::vector<double>> delais;
		int rates = 0, ratesRepris = 0;
		for (const lf::DocumentMatch* d : docs)
		{
			const lf::Cinematique c(*d);
			for (std::size_t i = 0; i < d->actions.size(); ++i)
			{
				const lf::Action& a = d->actions[i];
				const lf::Contact k = lf::contactDeAction(c, static_cast<int>(i), a.t);
				if (k.valide)
				{
					distances[lf::nomGenreContact(k.genre)].push_back(k.distance);
					(k.z < 0.5 ? distancesSol : distancesAir)[lf::nomGenreContact(k.genre)].push_back(k.distance);
				}
				if (a.estFrappe())
				{
					++frappes;
					frappesValides += k.valide && std::fabs(k.dans) < 1e-9 ? 1 : 0;
					const bool genreOk = (a.type == lf::TypeAction::Tir && (k.genre == lf::GenreContact::Tir || k.genre == lf::GenreContact::Tete))
						|| (a.type == lf::TypeAction::Touche && k.genre == lf::GenreContact::Touche)
						|| (a.type == lf::TypeAction::Degagement && (k.genre == lf::GenreContact::Degagement || k.genre == lf::GenreContact::Tete))
						|| (a.type == lf::TypeAction::Passe && (k.genre == lf::GenreContact::Passe || k.genre == lf::GenreContact::PasseAerienne || k.genre == lf::GenreContact::Centre || k.genre == lf::GenreContact::Tete));
					genresJustes += genreOk ? 1 : 0;
					if (k.genre == lf::GenreContact::Tete)
					{
						++tetes;
						tetesJustes += k.surface == lf::Surface::Tete && k.z > 0.5 ? 1 : 0;
					}
					if (a.type == lf::TypeAction::Touche)
					{
						++touches;
						touchesMains += k.surface == lf::Surface::Mains ? 1 : 0;
					}
					if (k.piedFaible)
					{
						++faibles;
						const lf::FicheJoueur* f = d->ficheA(a.code, a.t);
						faiblesAmbidextres += f && (f->pied == "Ambidextre" || f->piedFaible >= 5) ? 1 : 0;
					}
					// 0,5 s avant une passe, le contact annoncé est cette passe (ou le contrôle qui la
					// précède au même instant, quand le moteur la fait jouer en une touche)
					if (a.type == lf::TypeAction::Passe)
					{
						// seulement si le joueur n'a pas d'autre contact entre-temps (sinon c'est lui
						// qu'on annonce d'abord : un contrôle juste avant la passe, par exemple)
						bool autreContact = false;
						for (int j : c.actionsDe(a.code))
						{
							const lf::Action& b = d->actions[static_cast<std::size_t>(j)];
							if (j != static_cast<int>(i) && b.t >= a.t - 0.5 - 0.25 - 1e-9 && b.t <= a.t + 1e-9 && lf::contactDeAction(c, j, a.t).valide)
							{
								autreContact = true;
							}
						}
						if (!autreContact)
						{
							++annonces;
							const lf::Contact avant = lf::prochainContact(c, a.code, a.t - 0.5);
							const bool juste = avant.valide && std::fabs(avant.t - a.t) < 1e-9 && avant.dans > 0.45 && avant.dans < 0.55;
							annoncesJustes += juste ? 1 : 0;
						}
					}
				}
				if (a.type == lf::TypeAction::Controle)
				{
					const std::string* niveau = a.texte("niveau");
					const std::string nv = niveau ? *niveau : std::string("?");
					// le geste suivant du receveur (passe, tir, dribble, dégagement), avant un autre contrôle
					for (int j : c.actionsDe(a.code))
					{
						const lf::Action& b = d->actions[static_cast<std::size_t>(j)];
						if (j <= static_cast<int>(i))
						{
							continue;
						}
						if (b.type == lf::TypeAction::Controle)
						{
							break;
						}
						if (b.type == lf::TypeAction::Passe || b.type == lf::TypeAction::Tir || b.type == lf::TypeAction::Dribble || b.type == lf::TypeAction::Degagement)
						{
							if (b.t - a.t < 8.0)
							{
								delais[nv].push_back(b.t - a.t);
							}
							break;
						}
					}
					if (nv == "rate")
					{
						++rates;
						const int im = d->indexImageA(a.t);
						bool repris = im >= 0 && im + 1 < static_cast<int>(d->images.size()) && d->images[static_cast<std::size_t>(im + 1)].porteur == a.code;
						ratesRepris += repris ? 1 : 0;
					}
				}
			}
		}
		auto q = [&](const std::string& g, double p) { return centile(distances[g], p); };
		verifier("chaque frappe du moteur donne un contact, à son instant, du bon genre (passe, centre, tir, tête, dégagement, touche)",
			frappes > 2000 && frappesValides == frappes && genresJustes == frappes, std::to_string(frappes) + " frappes sur trois matchs");
		std::vector<double> sol = distancesSol["passe"];
		sol.insert(sol.end(), distancesSol["tir"].begin(), distancesSol["tir"].end());
		const auto horsPortee = std::count_if(sol.begin(), sol.end(), [](double v) { return v > 1.2; });
		verifier("§82 au contact, le ballon est à portée du pied : 99 % des passes et des tirs au sol à moins de 1,2 m du corps",
			sol.size() > 2000 && centile(sol, 0.99) <= 1.2,
			"passes " + nombre(centile(distancesSol["passe"], 0.5)) + " m en médiane, tirs " + nombre(centile(distancesSol["tir"], 0.5)) + " m ; 99e centile "
			+ nombre(centile(sol, 0.99)) + " m sur " + std::to_string(sol.size()) + " frappes");
		constat("frappes au sol hors de portée du pied (au-delà de 1,2 m)",
			std::to_string(horsPortee) + " sur " + std::to_string(sol.size()) + ", jusqu'à " + nombre(centile(sol, 1.0)) + " m : surtout en une touche, le moteur accepte la réception à 1,7 m (arrive) et frappe de là au pas suivant");
		std::vector<double> air = distancesAir["tete"];
		for (const char* g : { "tir", "passe", "passe_aerienne", "degagement" })
		{
			air.insert(air.end(), distancesAir[g].begin(), distancesAir[g].end());
		}
		constat("frappes en l'air (têtes, volées, reprises après un duel aérien) : le corps va chercher le ballon",
			std::to_string(air.size()) + " frappes au-dessus de 50 cm, " + nombre(centile(air, 0.5)) + " m du corps en médiane, jusqu'à " + nombre(centile(air, 1.0)) + " m");
		verifier("§23 au contrôle, le ballon arrive au receveur : 9 sur 10 à moins de 1,2 m (l'instant de l'image où il arrive)",
			q("controle", 0.90) <= 1.2, nombre(q("controle", 0.5)) + " m en médiane, " + nombre(q("controle", 0.9)) + " m au 9e décile");
		verifier("une tête se joue de la tête, au-dessus de 50 cm ; une touche, des deux mains", tetes > 30 && tetesJustes == tetes && touches > 10 && touchesMains == touches,
			std::to_string(tetes) + " têtes, " + std::to_string(touches) + " touches");
		verifier("le pied : la règle du moteur (pied faible du côté faible), jamais pour un ambidextre", faibles > 0 && faiblesAmbidextres == 0);
		constat("frappes du pied faible, selon la règle du moteur (le côté du terrain décide, pas le corps)",
			nombre(100.0 * faibles / std::max(1, frappes), 0) + " % des frappes : à l'écran, trop de droitiers frappent du gauche ; à revoir dans le moteur, voir docs/ue5/audit.md");
		verifier("0,5 s avant une passe, le contact annoncé est cette passe, avec le temps qu'il reste", annonces > 1000 && annoncesJustes * 100 >= annonces * 95,
			std::to_string(annoncesJustes) + " sur " + std::to_string(annonces));
		const double dLong = centile(delais["long"], 0.5), dCorrect = centile(delais["correct"], 0.5);
		verifier("§23 un contrôle long retarde le geste suivant (le moteur ajoute 0,42 s et laisse revenir le défenseur)", dLong > dCorrect,
			"médiane " + nombre(dLong, 1) + " s après un contrôle long, " + nombre(dCorrect, 1) + " s après un contrôle correct");
		constat("§23 contrôle raté : le receveur reprend le ballon au pas suivant (le moteur ne le protège qu'un pas : beat 0,35 s, ramassage permis sous 0,3 s)",
			std::to_string(ratesRepris) + " fois sur " + std::to_string(rates) + " : le raté ne coûte presque rien ; à revoir dans le moteur, voir docs/ue5/audit.md");
	}

	// ------------------------------------------------------------------ §82 le détecteur de contact

	void testsDetecteurContact(const std::vector<const lf::DocumentMatch*>& docs)
	{
		titre("§82 Le détecteur de contact : la partie du corps au ballon, à 15 cm et 0,05 s du moteur");
		constexpr double kImage = 1.0 / 60.0;
		// un pied qui arrive au ballon et repart : 2 cm au plus près, à l'instant du contact
		{
			lf::DetecteurContact d;
			lf::VerdictContact v = lf::VerdictContact::Rien;
			for (double dans = 0.5; dans > -0.3; dans -= kImage)
			{
				const lf::VerdictContact w = d.ajouter(7, dans, 2.0 + 300.0 * std::fabs(dans));
				v = w != lf::VerdictContact::Rien ? w : v;
			}
			verifier("un pied qui va au ballon : touché, une seule fois, avec l'écart le plus petit de la fenêtre",
				v == lf::VerdictContact::Touche && d.juges() == 1 && d.manques() == 0 && d.dernierEcartCm() < 7.0,
				"écart retenu " + nombre(d.dernierEcartCm(), 1) + " cm");
		}
		// un pied qui reste à 40 cm : manqué
		{
			lf::DetecteurContact d;
			lf::VerdictContact v = lf::VerdictContact::Rien;
			for (double dans = 0.3; dans > -0.3; dans -= kImage)
			{
				const lf::VerdictContact w = d.ajouter(3, dans, 40.0);
				v = w != lf::VerdictContact::Rien ? w : v;
			}
			verifier("un pied resté à 40 cm du ballon : CONTACT MANQUÉ", v == lf::VerdictContact::Manque && d.manques() == 1 && d.pireEcartCm() > 39.0);
		}
		// aucune image dans la fenêtre : on ne sait pas, on ne juge pas
		{
			lf::DetecteurContact d;
			d.ajouter(4, 0.08, 1.0);
			const lf::VerdictContact v = d.ajouter(4, -0.08, 1.0);
			verifier("des images trop espacées pour voir l'instant du contact : non jugé, jamais manqué",
				v == lf::VerdictContact::NonJuge && d.juges() == 0 && d.manques() == 0 && d.nonJuges() == 1);
		}
		// le contact suivi change pendant la fenêtre : le premier est jugé sur ce qu'on a vu
		{
			lf::DetecteurContact d;
			d.ajouter(5, 0.01, 3.0);
			const lf::VerdictContact v = d.ajouter(6, 0.6, 50.0);
			const lf::VerdictContact apres = d.aucun();
			verifier("le contact suivant arrive : le précédent est jugé avec ce qu'on a vu ; le suivant, pas encore vu, n'est pas inventé",
				v == lf::VerdictContact::Touche && apres == lf::VerdictContact::NonJuge && d.juges() == 1 && d.manques() == 0);
		}
		// une coupe (coup d'envoi, remplacement) : le contact en cours est oublié
		{
			lf::DetecteurContact d;
			d.ajouter(9, 0.0, 60.0);
			d.reinitialiser();
			const lf::VerdictContact v = d.aucun();
			verifier("après une coupe, le contact en cours n'est pas jugé", v == lf::VerdictContact::Rien && d.juges() == 0 && d.nonJuges() == 0);
		}
		// sur trois vrais matchs : le ballon rendu (Cinematique::ballon, la position de ALFBallon)
		// passe par chaque point de contact à son instant, vu à 60 images par seconde
		int contacts = 0, manques = 0, nonJuges = 0;
		double pire = 0.0;
		for (const lf::DocumentMatch* doc : docs)
		{
			const lf::Cinematique c(*doc);
			for (std::size_t i = 0; i < doc->actions.size(); ++i)
			{
				const lf::Contact k = lf::contactDeAction(c, static_cast<int>(i), doc->actions[i].t);
				if (!k.valide || k.surface == lf::Surface::Aucune)
				{
					continue;
				}
				lf::DetecteurContact d;
				for (double t = k.t - 0.2; t <= k.t + 0.2; t += kImage)
				{
					const lf::EtatBallon b = c.ballon(t);
					const double ecart = b.valide ? 100.0 * std::sqrt((b.x - k.x) * (b.x - k.x) + (b.y - k.y) * (b.y - k.y) + (b.z - k.z) * (b.z - k.z)) : 1e9;
					d.ajouter(static_cast<int>(i), k.t - t, ecart);
				}
				d.aucun();
				++contacts;
				manques += d.manques();
				nonJuges += d.nonJuges();
				pire = std::max(pire, d.pireEcartCm());
			}
		}
		verifier("§82 le ballon rendu passe par chaque point de contact du moteur à son instant : un pied qui va à ce point touche le ballon",
			contacts > 5000 && manques == 0 && nonJuges == 0,
			std::to_string(contacts) + " contacts sur trois matchs, écart max " + nombre(pire, 1) + " cm");
	}

	// ------------------------------------------------------------------ §43 §44 le corps
	void testsCorps(const std::vector<const lf::DocumentMatch*>& docs)
	{
		titre("§43 §44 De la carte au corps : morphotype et profil d'animation");
		int joueurs = 0, compatibles = 0, gardiens = 0, gardiensJustes = 0;
		std::map<std::string, int> types;
		std::vector<double> tailles, echelles, accelerations, explosivites;
		for (const lf::DocumentMatch* d : docs)
		{
			const lf::Cinematique c(*d);
			for (int code = 0; code < lf::kJoueurs; ++code)
			{
				const lf::FicheJoueur* f = d->fiche(code);
				if (!f)
				{
					continue;
				}
				const lf::ProfilCorps p = lf::profilCorps(*f, lf::largeurDeJeu(c, code));
				++joueurs;
				compatibles += lf::typeCompatibleAvecPoste(p.type, f->poste) ? 1 : 0;
				if (f->estGardien())
				{
					++gardiens;
					gardiensJustes += p.type == lf::TypeCorps::GardienAthletique || p.type == lf::TypeCorps::GardienGrand ? 1 : 0;
				}
				++types[lf::nomTypeCorps(p.type)];
				tailles.push_back(f->morphologie.tailleCm);
				echelles.push_back(p.echelle);
				if (f->aMoteur)
				{
					accelerations.push_back(f->moteur.acceleration);
					explosivites.push_back(p.explosivite);
				}
			}
		}
		std::string liste;
		for (const auto& t : types)
		{
			liste += t.first + " " + std::to_string(t.second) + ", ";
		}
		verifier("chaque joueur reçoit un morphotype de son poste ; chaque gardien, un corps de gardien", joueurs == 66 && compatibles == joueurs && gardiens == 6 && gardiensJustes == gardiens,
			std::to_string(joueurs) + " joueurs");
		verifier("§44 les morphotypes varient : au moins sept des dix sur trois matchs", types.size() >= 7, liste);
		verifier("l'échelle du squelette suit la taille de la fiche", correlation(tailles, echelles) > 0.999);
		verifier("l'explosivité du corps est l'accélération du moteur, rien d'autre", correlation(accelerations, explosivites) > 0.99,
			"corrélation " + nombre(correlation(accelerations, explosivites), 3));
	}

	// ------------------------------------------------------------------ §71 les délibérations
	void testsDecisions(const lf::DocumentMatch& debug, const lf::DocumentMatch& normal, const std::string& texteDebug)
	{
		titre("§71 Les délibérations du moteur (mode débogage) : ce que le porteur a choisi, et ce qu'il a écarté");
		const std::vector<lf::Decision>& D = debug.decisions;
		bool ordre = true, codes = true;
		int rang0 = 0, bascules = 0;
		for (std::size_t i = 0; i < D.size(); ++i)
		{
			ordre = ordre && (i == 0 || D[i].t >= D[i - 1].t);
			codes = codes && D[i].code >= 0 && D[i].code < lf::kJoueurs && !D[i].choix.k.empty();
			rang0 += D[i].rang == 0 ? 1 : 0;
			bascules += D[i].bascule ? 1 : 0;
		}
		verifier("chaque décision se lit, dans l'ordre du temps, avec son choix et ses options écartées", D.size() > 1000 && ordre && codes,
			std::to_string(D.size()) + " décisions, " + std::to_string(rang0) + " au premier rang des options du joueur");
		verifier("sans le mode débogage, aucune", normal.decisions.empty());
		// le choix se joue au même instant : une passe, une frappe, un centre, un dégagement
		std::map<std::pair<int, long>, std::vector<lf::TypeAction>> actions;
		for (const lf::Action& a : debug.actions)
		{
			actions[{ a.code, std::lround(a.t * 10.0) }].push_back(a.type);
		}
		int jouees = 0, justes = 0;
		for (const lf::Decision& d : D)
		{
			lf::TypeAction attendue = lf::TypeAction::Inconnue;
			if (d.choix.k == "pass" || d.choix.k == "cross")
			{
				attendue = lf::TypeAction::Passe;
			}
			else if (d.choix.k == "shot")
			{
				attendue = lf::TypeAction::Tir;
			}
			else if (d.choix.k == "clear")
			{
				attendue = lf::TypeAction::Degagement;
			}
			if (attendue == lf::TypeAction::Inconnue)
			{
				continue;
			}
			++jouees;
			const auto it = actions.find({ d.code, std::lround(d.t * 10.0) });
			bool trouve = false;
			if (it != actions.end())
			{
				for (lf::TypeAction t : it->second)
				{
					trouve = trouve || t == attendue || (attendue == lf::TypeAction::Degagement && t == lf::TypeAction::Passe);
				}
			}
			justes += trouve ? 1 : 0;
		}
		verifier("chaque passe, frappe, centre ou dégagement choisi est joué au même instant", jouees > 500 && justes == jouees,
			std::to_string(justes) + " sur " + std::to_string(jouees));
		// le panneau du §71 retrouve la décision qui a lancé chaque passe ou frappe en jeu
		int enJeu = 0, retrouvees = 0;
		for (const lf::Action& a : debug.actions)
		{
			if ((a.type != lf::TypeAction::Passe && a.type != lf::TypeAction::Tir) || a.texte("cpa") || a.aNombre("t0"))
			{
				continue;
			}
			++enJeu;
			const lf::Decision* d = debug.derniereDecision(a.code, a.t);
			retrouvees += d && std::fabs(d->t - a.t) < 1e-6 ? 1 : 0;
		}
		verifier("derniereDecision retrouve, à l'instant de chaque passe ou frappe en jeu, la décision qui l'a lancée", enJeu > 500 && retrouvees == enJeu,
			std::to_string(retrouvees) + " sur " + std::to_string(enJeu));
		verifier("hors de la fenêtre (3 s), pas de décision", !debug.derniereDecision(D.front().code, D.front().t - 0.05) && !debug.derniereDecision(D.back().code, D.back().t + 3.5));
		lf::OptionDecision o;
		o.k = "pass";
		o.genre = "through";
		o.vers = 9;
		lf::OptionDecision f;
		f.k = "shot";
		verifier("l'option en mots pour le panneau", lf::texteOption(o) == "passe en profondeur vers #9" && lf::texteOption(f) == "frappe", lf::texteOption(o));
		constat("décisions que la compétence d'un joueur a fait basculer, dans ce match", std::to_string(bascules));
		// un document dont les décisions remontent le temps ment : il est refusé
		std::string faux = texteDebug;
		const std::size_t p = faux.find("\"decisions\":[{\"t\":");
		bool refuse = false;
		if (p != std::string::npos)
		{
			faux.insert(p + std::string("\"decisions\":[").size(), "{\"t\":99999,\"c\":0,\"choix\":{\"k\":\"hold\",\"ev\":0},\"rang\":0,\"autres\":[]},");
			lf::DocumentMatch d2;
			refuse = !lf::chargerDocument(faux, d2).ok;
		}
		verifier("des décisions hors de l'ordre du temps : document refusé", refuse);
	}


	// ------------------------------------------------------------------ cahier « qualité visuelle »
	void testsQualiteFiche(const std::vector<const lf::DocumentMatch*>& docs)
	{
		titre("Qualité visuelle §5 à §10, §27 : le corps, le visage et le caractère, lus dans la feuille");
		const std::set<std::string> coiffures = { "ras", "court", "degrade", "boucles", "frises", "afro", "dreadlocks", "tresses", "long", "attache" };
		const std::set<std::string> barbes = { "aucune", "tres_courte", "courte", "moyenne", "longue", "moustache", "bouc" };
		const std::set<std::string> types = { "agressif", "calme", "expressif", "reserve", "energique", "confiant" };
		int fiches = 0, justes = 0;
		for (const lf::DocumentMatch* d : docs)
		{
			for (const lf::FicheJoueur& f : d->joueurs)
			{
				++fiches;
				const lf::Morphologie& m = f.morphologie;
				const bool corps = m.tailleCm >= 160 && m.tailleCm <= 210 && m.pointure >= 38 && m.pointure <= 50 && m.masseGrassePct >= 6.0 && m.masseGrassePct <= 15.0
					&& std::abs(m.envergureCm - m.tailleCm) < m.tailleCm * 0.08 && m.cuisses >= 0.0 && m.cuisses <= 1.0 && m.mollets >= 0.0 && m.mollets <= 1.0;
				const bool visage = coiffures.count(f.apparence.coiffure) == 1 && barbes.count(f.apparence.barbe) == 1 && !f.apparence.textureCheveux.empty()
					&& f.apparence.teint >= 0 && f.apparence.teint <= 9;
				const lf::Personnalite& k = f.personnalite;
				const bool caractere = types.count(k.type) == 1 && k.agressivite >= 0.1 && k.agressivite <= 0.9 && k.expressivite >= 0.1 && k.expressivite <= 0.9;
				justes += corps && visage && caractere ? 1 : 0;
			}
		}
		verifier("chaque fiche porte ses seize mesures, son visage et son caractère, dans les bornes", fiches > 60 && justes == fiches,
			std::to_string(justes) + " sur " + std::to_string(fiches));
	}

	void testsRegardTete(const std::vector<const lf::DocumentMatch*>& docs)
	{
		titre("Qualité visuelle §4 : le corps court, la tête suit en partie, les yeux vont au ballon");
		// le corps regarde x croissant (angle 0) ; la cible tout droit, à 10°, à 80°, derrière
		const auto vers = [](double angleDeg, double distance) { const double a = angleDeg / lf::kDegParRad; return std::pair<double, double>{ distance * std::cos(a), distance * std::sin(a) }; };
		const auto [x1, y1] = vers(0.0, 10.0);
		const lf::OrientationRegard droit = lf::orienterRegard(0.0, 0.0, 0.0, 1.68, x1, y1, 1.68);
		const auto [x2, y2] = vers(10.0, 10.0);
		const lf::OrientationRegard petit = lf::orienterRegard(0.0, 0.0, 0.0, 1.68, x2, y2, 1.68);
		const auto [x3, y3] = vers(80.0, 10.0);
		const lf::OrientationRegard cote = lf::orienterRegard(0.0, 0.0, 0.0, 1.68, x3, y3, 1.68);
		const auto [x4, y4] = vers(-150.0, 10.0);
		const lf::OrientationRegard derriere = lf::orienterRegard(0.0, 0.0, 0.0, 1.68, x4, y4, 1.68);
		verifier("tout droit : ni la tête ni les yeux ne bougent", std::fabs(droit.lacetTeteDeg) < 1e-9 && std::fabs(droit.lacetYeuxDeg) < 1e-9);
		verifier("à 10° : les yeux seuls", std::fabs(petit.lacetTeteDeg) < 1e-9 && std::fabs(std::fabs(petit.lacetYeuxDeg) - 10.0) < 1e-6);
		verifier("à 80° : la tête en partie, les yeux finissent, la cible est vue", std::fabs(cote.lacetTeteDeg) > 40.0 && std::fabs(cote.lacetTeteDeg) < 60.0 && !cote.horsDeVue
			&& std::fabs(cote.lacetTeteDeg + cote.lacetYeuxDeg - cote.lacetCibleDeg) < 1e-6, "tête " + nombre(cote.lacetTeteDeg, 1) + "°, yeux " + nombre(cote.lacetYeuxDeg, 1) + "°");
		verifier("derrière (150°) : tête et yeux au bout de leur course, cible hors de vue", std::fabs(std::fabs(derriere.lacetTeteDeg) - 70.0) < 1e-9 && std::fabs(std::fabs(derriere.lacetYeuxDeg) - 35.0) < 1e-9 && derriere.horsDeVue);
		const auto [x5, y5] = vers(-80.0, 10.0);
		const lf::OrientationRegard autreCote = lf::orienterRegard(0.0, 0.0, 0.0, 1.68, x5, y5, 1.68);
		verifier("la droite et la gauche (au sens du lacet d'Unreal) ne se confondent pas", cote.lacetTeteDeg > 0.0 && autreCote.lacetTeteDeg < 0.0
			&& std::fabs(cote.lacetTeteDeg + autreCote.lacetTeteDeg) < 1e-9);
		const lf::OrientationRegard sol = lf::orienterRegard(0.0, 0.0, 0.0, 1.68, 2.0, 0.0, 0.11);
		verifier("un ballon au sol à 2 m : la tête baisse, les yeux plus encore", sol.tangageTeteDeg < -10.0 && sol.tangageYeuxDeg < 0.0 && !sol.horsDeVue,
			"tête " + nombre(sol.tangageTeteDeg, 1) + "°, yeux " + nombre(sol.tangageYeuxDeg, 1) + "°");
		// sur de vrais matchs : jamais au-delà des limites, et les yeux sur la cible quand elle est visible
		int n = 0, horsLimites = 0, ratees = 0, horsVue = 0;
		for (const lf::DocumentMatch* d : docs)
		{
			const lf::Cinematique c(*d);
			for (double t = d->images.front().temps(); t < d->images.back().temps(); t += 2.0)
			{
				for (int k = 0; k < lf::kJoueurs; ++k)
				{
					const lf::Regard r = lf::cibleRegard(c, k, t);
					const lf::EtatCinematique e = c.etat(k, t);
					if (!r.valide || !e.valide)
					{
						continue;
					}
					const lf::OrientationRegard o = lf::orienterRegard(e.x, e.y, e.angleCorps, 1.68, r.x, r.y, r.z + lf::kRayonBallonM);
					if (!o.valide)
					{
						continue;
					}
					++n;
					horsLimites += std::fabs(o.lacetTeteDeg) > 70.0 + 1e-9 || std::fabs(o.lacetYeuxDeg) > 35.0 + 1e-9 || o.tangageTeteDeg < -40.0 - 1e-9 || o.tangageTeteDeg > 30.0 + 1e-9 ? 1 : 0;
					if (o.horsDeVue)
					{
						++horsVue;
					}
					else if (std::fabs(o.lacetTeteDeg + o.lacetYeuxDeg - o.lacetCibleDeg) > 0.5)
					{
						++ratees;
					}
				}
			}
		}
		verifier("sur trois matchs : jamais au-delà des limites du cou et des yeux ; quand la cible est visible, les yeux sont dessus (à 0,5° près)", n > 10000 && horsLimites == 0 && ratees == 0,
			std::to_string(n) + " regards");
		constat("cible du regard hors de vue (derrière lui : il faudra tourner le buste ou jeter un coup d'œil)", nombre(100.0 * horsVue / std::max(1, n), 1) + " % des regards");
	}

	void testsVisage(const std::vector<const lf::DocumentMatch*>& docs)
	{
		titre("Qualité visuelle §25 à §27 : le visage et le geste suivent le match, la personnalité règle l'amplitude");
		int buts = 0, buteursJoie = 0, encaisseursFrustres = 0, decrues = 0, sansAutreBut = 0;
		int rates = 0, ratesFrustres = 0, fautes = 0, victimes = 0, cartons = 0, colereCartons = 0, protestations = 0;
		std::vector<double> expressivite, joie, energies, fatigues;
		for (const lf::DocumentMatch* d : docs)
		{
			const lf::Cinematique c(*d);
			const lf::ChroniqueVisages V(c);
			for (const lf::Action& a : d->actions)
			{
				if (a.type == lf::TypeAction::But && !a.vrai("csc"))
				{
					++buts;
					const lf::EtatVisage v = V.etat(a.code, a.t + 1.0);
					// §27 le caractère règle l'amplitude : un buteur très réservé (expressivité 0,1)
					// montre une joie de 0,6 à 0,7 ; le seuil de 0,75 vaut pour un caractère moyen
					const lf::FicheJoueur* fb = d->ficheA(a.code, a.t);
					const double seuilJoie = 0.75 * std::min(1.0, 0.6 + 0.8 * (fb ? fb->personnalite.expressivite : 0.5));
					buteursJoie += v.poids[static_cast<std::size_t>(lf::Expression::Joie)] >= seuilJoie && v.dominante == lf::Expression::Joie && v.geste == lf::Geste::Celebration ? 1 : 0;
					double fr = 0.0, jo = 0.0;
					int n = 0;
					for (int k = 0; k < lf::kJoueurs; ++k)
					{
						const lf::EtatVisage w = V.etat(k, a.t + 2.0);
						if (!w.valide)
						{
							continue;
						}
						if (lf::equipeDe(k) != lf::equipeDe(a.code))
						{
							fr += w.poids[static_cast<std::size_t>(lf::Expression::Frustration)];
							jo += w.poids[static_cast<std::size_t>(lf::Expression::Joie)];
							++n;
						}
						else if (k != a.code)
						{
							const lf::FicheJoueur* f = d->ficheA(k, a.t);
							if (f)
							{
								expressivite.push_back(f->personnalite.expressivite);
								joie.push_back(V.etat(k, a.t + 1.0).poids[static_cast<std::size_t>(lf::Expression::Joie)]);
							}
						}
					}
					encaisseursFrustres += n > 0 && fr / n >= 0.25 && fr > jo ? 1 : 0;
					// (sauf si un autre but tombe dans les quarante secondes : la joie repart, avec raison)
					bool autreBut = false;
					for (const lf::Action& b2 : d->actions)
					{
						autreBut = autreBut || (b2.type == lf::TypeAction::But && b2.t > a.t + 1e-9 && b2.t <= a.t + 40.0);
					}
					if (!autreBut)
					{
						++sansAutreBut;
						decrues += V.etat(a.code, a.t + 40.0).poids[static_cast<std::size_t>(lf::Expression::Joie)] < 0.2 ? 1 : 0;
					}
				}
				if (a.type == lf::TypeAction::Tir && a.texteVaut("issue", "miss") && a.nombre("xg", 0.0) >= 0.12)
				{
					++rates;
					const double avant = V.etat(a.code, a.t - 0.5).poids[static_cast<std::size_t>(lf::Expression::Frustration)];
					const double apres = V.etat(a.code, a.t + 0.5).poids[static_cast<std::size_t>(lf::Expression::Frustration)];
					ratesFrustres += apres >= 0.25 && apres > avant ? 1 : 0;
				}
				if (a.type == lf::TypeAction::Faute)
				{
					++fautes;
					const int victime = static_cast<int>(std::lround(a.nombre("victime", -1.0)));
					if (victime >= 0 && V.etat(victime, a.t + 0.5).poids[static_cast<std::size_t>(lf::Expression::Douleur)] >= 0.4)
					{
						++victimes;
					}
					const std::string* carton = a.texte("carton");
					// un carton jaune : un rouge le sort du terrain, son visage n'est plus à l'écran
					if (carton && *carton == "Y")
					{
						++cartons;
						const lf::EtatVisage v = V.etat(a.code, a.t + 0.5);
						colereCartons += v.poids[static_cast<std::size_t>(lf::Expression::Colere)] > 0.2 ? 1 : 0;
						protestations += v.geste == lf::Geste::Protestation ? 1 : 0;
					}
				}
			}
			for (double t = d->images.front().temps(); t < d->images.back().temps(); t += 30.0)
			{
				for (int k = 0; k < lf::kJoueurs; ++k)
				{
					const lf::EtatVisage v = V.etat(k, t);
					const lf::EtatCinematique e = c.etat(k, t);
					if (v.valide && e.valide)
					{
						energies.push_back(e.energie);
						fatigues.push_back(v.poids[static_cast<std::size_t>(lf::Expression::Fatigue)]);
					}
				}
			}
		}
		verifier("§25 un but : la joie du buteur, sa célébration, une seconde après", buts > 5 && buteursJoie == buts, std::to_string(buteursJoie) + " buts sur " + std::to_string(buts));
		verifier("   ceux qui encaissent : la frustration l'emporte sur la joie", encaisseursFrustres == buts);
		verifier("   et la joie retombe : moins de 0,2 quarante secondes plus tard", sansAutreBut > 5 && decrues == sansAutreBut,
			std::to_string(decrues) + " sur " + std::to_string(sansAutreBut) + " (les buts suivis d'un autre dans les 40 s mis à part)");
		verifier("une grosse occasion manquée : le tireur se frustre", rates > 3 && ratesFrustres == rates, std::to_string(ratesFrustres) + " sur " + std::to_string(rates));
		verifier("une faute : la douleur de la victime", fautes > 10 && victimes == fautes, std::to_string(victimes) + " sur " + std::to_string(fautes));
		verifier("un carton jaune : la colère de l'averti, qui proteste", cartons > 0 && colereCartons == cartons && protestations > 0,
			std::to_string(protestations) + " protestations sur " + std::to_string(cartons) + " cartons");
		// la fatigue n'apparaît qu'en dessous de 75 d'énergie, puis grandit à mesure qu'elle baisse
		std::vector<double> eBas, fBas;
		bool fraisSansFatigue = true;
		double fatigueMax = 0.0;
		for (std::size_t i = 0; i < energies.size(); ++i)
		{
			fatigueMax = std::max(fatigueMax, fatigues[i]);
			if (energies[i] >= 75.0)
			{
				fraisSansFatigue = fraisSansFatigue && fatigues[i] == 0.0;
			}
			else
			{
				eBas.push_back(energies[i]);
				fBas.push_back(fatigues[i]);
			}
		}
		verifier("§24 la fatigue se lit sur le visage : rien quand il est frais, puis de plus en plus à mesure que l'énergie baisse",
			fraisSansFatigue && eBas.size() > 50 && correlation(eBas, fBas) < -0.99 && fatigueMax > 0.3,
			std::to_string(eBas.size()) + " mesures sous 75 d'énergie, fatigue jusqu'à " + nombre(fatigueMax, 2));
		verifier("§27 un partenaire plus expressif montre plus de joie au même but", expressivite.size() > 20 && correlation(expressivite, joie) > 0.8,
			"corrélation " + nombre(correlation(expressivite, joie), 2) + " sur " + std::to_string(expressivite.size()) + " partenaires");
	}

	void testsPhysiologie(const std::vector<const lf::DocumentMatch*>& docs, const std::filesystem::path& scenes)
	{
		titre("Qualité visuelle §3 §24 : le souffle, la sueur, la pluie, la posture de fatigue");
		std::vector<double> souffles, efforts;
		int recuperations = 0, recuperees = 0, joueurs = 0, monotones = 0, plusTrempes = 0;
		for (const lf::DocumentMatch* d : docs)
		{
			const lf::Cinematique c(*d);
			const lf::ChroniquePhysiologie P(c);
			const double t0 = d->images.front().temps(), t1 = d->images.back().temps();
			for (int k = 0; k < lf::kJoueurs; ++k)
			{
				// l'essoufflement suit l'effort des dernières secondes
				for (double t = t0 + 10.0; t < t1; t += 7.0)
				{
					const lf::EtatPhysiologique s = P.etat(k, t);
					if (!s.valide)
					{
						continue;
					}
					double effort = 0.0;
					int n = 0;
					for (double u = t - 8.0; u <= t; u += 0.5)
					{
						const lf::EtatCinematique e = c.etat(k, u);
						if (e.valide)
						{
							effort += lf::ChroniquePhysiologie::effort(e.vitesse, d->vitesseMax(k, u));
							++n;
						}
					}
					souffles.push_back(s.essoufflement);
					efforts.push_back(n ? effort / n : 0.0);
					// et redescend quand il souffle : 20 s sans courir après un gros effort (dans le
					// match : après le coup de sifflet final, l'état ne bouge plus). La fenêtre était
					// de 30 s ; les cas venaient surtout des tireurs de corner qui attendaient 15 s
					// (corrigé le 4 octobre 2026), et le jeu n'offre presque plus 30 s de repos.
					// La décroissance est la même : 0,65 → 0,36 en 20 s, → 0,27 en 30 s.
					if (s.essoufflement > 0.6 && t + 20.0 <= t1)
					{
						bool calme = true;
						for (double u = t; u <= t + 20.0 && calme; u += 0.5)
						{
							const lf::EtatCinematique e = c.etat(k, u);
							calme = e.valide && e.vitesse < 2.5;
						}
						if (calme)
						{
							++recuperations;
							recuperees += P.etat(k, t + 20.0).essoufflement < 0.6 * s.essoufflement ? 1 : 0;
						}
					}
				}
				// la sueur s'accumule pendant une mi-temps, et plus à la 80e qu'à la 10e
				const lf::EtatPhysiologique a = P.etat(k, t0 + 600.0), b = P.etat(k, t0 + 4800.0);
				if (a.valide && b.valide)
				{
					++joueurs;
					plusTrempes += b.transpiration > a.transpiration ? 1 : 0;
					bool monotone = true;
					double prec = -1.0;
					int miTemps = 1;
					for (std::size_t i = 0; i < d->images.size(); i += 50)
					{
						const lf::Image& im = d->images[i];
						const lf::EtatPhysiologique s = P.etat(k, im.temps());
						if (!s.valide)
						{
							continue;
						}
						if (im.miTemps != miTemps)
						{
							miTemps = im.miTemps;
							prec = -1.0;
						}
						monotone = monotone && s.transpiration >= prec - 1e-6;
						prec = s.transpiration;
					}
					monotones += monotone ? 1 : 0;
				}
			}
		}
		verifier("§24 l'essoufflement suit l'effort des huit dernières secondes", correlation(souffles, efforts) > 0.6,
			"corrélation " + nombre(correlation(souffles, efforts), 2) + " sur " + std::to_string(souffles.size()) + " mesures");
		// (rare depuis que les remises en jeu ne figent plus personne : 1 cas sur cinq matchs,
		// 24 avant ; la loi elle-même est suivie par la corrélation ci-dessus)
		verifier("   et redescend nettement en vingt secondes sans courir", recuperations >= 1 && recuperees == recuperations,
			std::to_string(recuperees) + " sur " + std::to_string(recuperations));
		verifier("§3 la sueur s'accumule pendant chaque mi-temps, et plus à la 80e qu'à la 10e", joueurs > 40 && monotones == joueurs && plusTrempes == joueurs,
			std::to_string(joueurs) + " joueurs");
		// la pluie, une scène qui l'a, une qui ne l'a pas
		auto pluie = charger(scenes / "15-pluie.json"), soleil = charger(scenes / "01-sprint_droit.json");
		if (pluie->ok && soleil->ok)
		{
			const lf::Cinematique cp(pluie->doc), cs(soleil->doc);
			const lf::ChroniquePhysiologie pp(cp), ps(cs);
			const int fp = pluie->doc.scene.focus, fs = soleil->doc.scene.focus;
			verifier("la pluie mouille (« " + pluie->doc.meteo + " »), le soleil non (« " + soleil->doc.meteo + " »)",
				pp.etat(fp, pluie->doc.scene.instant).humidite > 0.99 && ps.etat(fs, soleil->doc.scene.instant).humidite < 0.01);
			// le sprint de la scène 1 : il s'essouffle
			const lf::EtatPhysiologique debut = ps.etat(fs, soleil->doc.scene.t0 + 0.5), fin = ps.etat(fs, soleil->doc.scene.instant + 1.5);
			verifier("le sprint de la scène 1 l'essouffle", fin.essoufflement > debut.essoufflement + 0.1 && fin.frequenceRespiration > debut.frequenceRespiration + 5.0,
				nombre(debut.frequenceRespiration, 0) + " → " + nombre(fin.frequenceRespiration, 0) + " cycles par minute");
		}
	}

	void testsTypesCourse(const std::vector<const lf::DocumentMatch*>& docs)
	{
		titre("Qualité visuelle §17 §18 : la bibliothèque de locomotion, et les virages de 10° à 180°");
		std::map<lf::TypeCourse, int> comptes;
		int incoherents = 0, echantillons = 0;
		for (const lf::DocumentMatch* d : docs)
		{
			const lf::Cinematique c(*d);
			for (double t = d->images.front().temps(); t < d->images.back().temps(); t += 0.7)
			{
				for (int k = 0; k < lf::kJoueurs; ++k)
				{
					const lf::DescriptionLocomotion D = lf::decrireLocomotion(c, k, t);
					if (!D.valide)
					{
						continue;
					}
					++echantillons;
					++comptes[D.type];
					const lf::EtatCinematique e = c.etat(k, t);
					const bool faux = (D.type == lf::TypeCourse::Pressing && (e.etats & lf::etat::Presse) == 0)
						|| (D.type == lf::TypeCourse::Repli && e.intention != static_cast<std::uint8_t>(lf::Intention::Recover))
						|| (D.type == lf::TypeCourse::Sprint && D.vitesse < 6.0)
						|| (D.type == lf::TypeCourse::Recul && D.allure != lf::Allure::Recul);
					incoherents += faux ? 1 : 0;
				}
			}
		}
		std::string liste;
		for (int i = 0; i < lf::kTypesCourse; ++i)
		{
			liste += std::string(lf::nomTypeCourse(static_cast<lf::TypeCourse>(i))) + " " + std::to_string(comptes[static_cast<lf::TypeCourse>(i)]) + ", ";
		}
		int presents = 0;
		for (int i = 0; i < lf::kTypesCourse; ++i)
		{
			presents += comptes[static_cast<lf::TypeCourse>(i)] >= 20 ? 1 : 0;
		}
		verifier("§17 les quinze types de course se rencontrent sur trois matchs", presents == lf::kTypesCourse, liste);
		verifier("   et chacun dit vrai (pressing : il presse ; repli : l'IA le replie ; sprint : 6 m/s et plus ; recul : il recule)", incoherents == 0,
			std::to_string(echantillons) + " échantillons");
		verifier("§18 les virages ont leurs classes : 10° (correction), 30°, 45°, 60°, 90°, 135°, 180°",
			lf::classeVirage(15.0) == lf::ClasseVirage::Correction && lf::classeVirage(30.0) == lf::ClasseVirage::V30 && lf::classeVirage(45.0) == lf::ClasseVirage::V45
			&& lf::classeVirage(60.0) == lf::ClasseVirage::V60 && lf::classeVirage(-90.0) == lf::ClasseVirage::V90 && lf::classeVirage(135.0) == lf::ClasseVirage::V135
			&& lf::classeVirage(180.0) == lf::ClasseVirage::V180);
	}

	void testsFoulee(const std::vector<const lf::DocumentMatch*>& docs)
	{
		titre("Qualité visuelle §19 §21 : la foulée de CE corps (jambes, explosivité), le buste qui penche");
		const lf::Foulee marche = lf::foulee(0.9, 0.5, 1.4, 0.0), course = lf::foulee(0.9, 0.5, 6.0, 0.0), sprint = lf::foulee(0.9, 0.5, 9.0, 0.0);
		verifier("des cadences humaines : marche, course, sprint", marche.cadenceHz > 1.6 && marche.cadenceHz < 2.2 && course.cadenceHz > 3.2 && course.cadenceHz < 4.0
			&& sprint.cadenceHz > 3.8 && sprint.cadenceHz < 4.8, nombre(marche.cadenceHz, 2) + ", " + nombre(course.cadenceHz, 2) + ", " + nombre(sprint.cadenceHz, 2) + " pas par seconde");
		const lf::Foulee longues = lf::foulee(0.97, 0.5, 6.0, 0.0), courtes = lf::foulee(0.83, 0.5, 6.0, 0.0);
		verifier("§21 à la même vitesse, des jambes plus longues : des pas plus longs, une cadence plus basse", longues.longueurPasM > courtes.longueurPasM && longues.cadenceHz < courtes.cadenceHz,
			nombre(courtes.longueurPasM, 2) + " m contre " + nombre(longues.longueurPasM, 2) + " m");
		const lf::Foulee explosif = lf::foulee(0.9, 0.9, 4.0, 5.0), lourd = lf::foulee(0.9, 0.1, 4.0, 5.0), freine = lf::foulee(0.9, 0.5, 6.0, -5.0);
		verifier("§19 en pleine accélération, l'explosif : buste plus penché, appuis plus rapides", explosif.inclinaisonDeg > lourd.inclinaisonDeg && explosif.cadenceHz > lourd.cadenceHz
			&& explosif.inclinaisonDeg > 20.0 && explosif.inclinaisonDeg < 40.0, nombre(lourd.inclinaisonDeg, 1) + "° contre " + nombre(explosif.inclinaisonDeg, 1) + "°");
		verifier("   au freinage, le buste se redresse en arrière", freine.inclinaisonDeg < 0.0, nombre(freine.inclinaisonDeg, 1) + "°");
		// sur un vrai match : la longueur de jambe vient de la fiche
		const lf::Cinematique c(*docs.front());
		std::vector<double> jambes, pas;
		for (int k = 0; k < lf::kJoueurs; ++k)
		{
			const lf::FicheJoueur* f = docs.front()->fiche(k);
			if (f)
			{
				const lf::ProfilCorps p = lf::profilCorps(*f);
				jambes.push_back(p.longueurJambeM);
				pas.push_back(lf::foulee(p.longueurJambeM, p.explosivite, 6.0, 0.0).longueurPasM);
			}
		}
		verifier("   chaque joueur du match a sa foulée : la jambe vient de sa taille et de ses proportions", correlation(jambes, pas) > 0.999 && *std::max_element(jambes.begin(), jambes.end()) - *std::min_element(jambes.begin(), jambes.end()) > 0.08,
			"jambes de " + nombre(*std::min_element(jambes.begin(), jambes.end()), 2) + " à " + nombre(*std::max_element(jambes.begin(), jambes.end()), 2) + " m");
	}

	void testsPorteQualite()
	{
		titre("Qualité visuelle §20 §31 : la porte de qualité d'une scène");
		lf::BilanQualite propre;
		propre.contactsJuges = 4;
		verifier("rien à redire : VALIDE", lf::porteQualite(propre).verdict == lf::VerdictQualite::Valide);
		lf::BilanQualite pied = propre;
		pied.glissementsPied = 1;
		verifier("un seul pied qui glisse : NE PAS LIVRER (porte dure du §20)", lf::porteQualite(pied).verdict == lf::VerdictQualite::NePasLivrer, lf::porteQualite(pied).raisons);
		lf::BilanQualite contact = propre;
		contact.contactsManques = 2;
		verifier("des contacts manqués : À REPRENDRE", lf::porteQualite(contact).verdict == lf::VerdictQualite::AReprendre, lf::porteQualite(contact).raisons);
		lf::BilanQualite somme = contact;
		somme += pied;
		verifier("deux bilans s'additionnent, et le pire verdict l'emporte", somme.glissementsPied == 1 && somme.contactsManques == 2 && lf::porteQualite(somme).verdict == lf::VerdictQualite::NePasLivrer);
		lf::BilanQualite aveugle = propre;
		aveugle.animationSignalee = false;
		verifier("sans savoir quelle animation est jouée, le contrôle est incomplet : À REPRENDRE", lf::porteQualite(aveugle).verdict == lf::VerdictQualite::AReprendre);
	}

	// ------------------------------------------------------------------ §76 les scènes
	void testsScenes(const std::filesystem::path& dossier)
	{
		titre("§76 Les scènes de test, extraites de vrais matchs");
		if (!std::filesystem::exists(dossier))
		{
			verifier("le dossier des scènes existe", false, dossier.string());
			return;
		}
		std::vector<std::filesystem::path> fichiers;
		for (const auto& e : std::filesystem::directory_iterator(dossier))
		{
			if (e.path().extension() == ".json" && e.path().filename() != "index.json")
			{
				fichiers.push_back(e.path());
			}
		}
		std::sort(fichiers.begin(), fichiers.end());
		int lues = 0, avecCibles = 0, avecDecisions = 0;
		for (const auto& p : fichiers)
		{
			auto ch = charger(p);
			if (!ch->ok)
			{
				verifier(p.filename().string() + " se lit", false, ch->erreur);
				continue;
			}
			++lues;
			avecCibles += ch->doc.cibles.size() == ch->doc.images.size() * static_cast<std::size_t>(lf::kChampsCibles) ? 1 : 0;
			avecDecisions += ch->doc.decisions.empty() ? 0 : 1;
			const lf::Cinematique c(ch->doc);
			const lf::VerdictScene v = lf::verifierScene(ch->doc, c);
			verifier(std::to_string(ch->doc.scene.numero) + ". " + ch->doc.scene.titre, v.ok, v.detail);
		}
		verifier("les seize scènes sont là", lues == 16, std::to_string(lues) + " scènes");
		verifier("§71 chaque scène porte la cible que l'IA du moteur donne à chaque joueur, image par image", avecCibles == lues);
		verifier("§71 et les délibérations du moteur dans sa fenêtre", avecDecisions == lues, std::to_string(avecDecisions) + " scènes sur " + std::to_string(lues));
	}
}

int main(int argc, char** argv)
{
	if (argc < 2)
	{
		std::printf("usage : tests_coeur <dossier des fixtures> [<dossier des scènes>]\n");
		return 2;
	}
	const std::filesystem::path fixtures = argv[1];
	std::printf("LinkFoot · le cœur C++ d'Unreal lit le match que le moteur a joué\n");

	testsJson();

	auto match = charger(fixtures / "match-77.json");
	if (!match->ok)
	{
		verifier("le match du moteur se lit", false, match->erreur);
		return 1;
	}
	lf::json::Valeur attendu;
	lf::json::lire(lireFichier(fixtures / "match-77-attendu.json"), attendu);
	testsDocument(match->doc, attendu, match->secondes);
	testsRefus(lireFichier(fixtures / "match-77.json"));
	testsRepere(attendu);

	const lf::Cinematique brute(match->doc);
	lf::ParametresCinematique pl;
	pl.lissageS = 0.08;
	const lf::Cinematique lissee(match->doc, pl);
	testsCinematique(match->doc, brute, attendu);

	std::vector<std::unique_ptr<Charge>> pressings;
	std::vector<const lf::DocumentMatch*> bas, haut;
	std::string erreursPressing;
	for (const char* suffixe : { "", "-78", "-79" })
	{
		for (const char* reglage : { "bas", "haut" })
		{
			pressings.push_back(charger(fixtures / (std::string("press-") + reglage + suffixe + ".json")));
			if (!pressings.back()->ok)
			{
				erreursPressing += pressings.back()->erreur + " ";
			}
			else
			{
				(std::string(reglage) == "bas" ? bas : haut).push_back(&pressings.back()->doc);
			}
		}
	}
	if (!erreursPressing.empty())
	{
		verifier("les six matchs de pressing se lisent", false, erreursPressing);
	}
	else
	{
		testsVerite(match->doc, brute, bas, haut);
	}
	testsTrajectoire(match->doc, brute);
	testsRegard(match->doc, brute);
	testsFamilles(match->doc, brute);
	testsDetecteurs(match->doc, brute, lissee);

	auto m78 = charger(fixtures / "match-78.json");
	auto m79 = charger(fixtures / "match-79.json");
	if (!m78->ok || !m79->ok)
	{
		verifier("les matchs 78 et 79 se lisent", false, m78->erreur + " " + m79->erreur);
	}
	else
	{
		const std::vector<const lf::DocumentMatch*> trois = { &match->doc, &m78->doc, &m79->doc };
		testsEtatMatch(trois);
		testsContact(trois);
		testsDetecteurContact(trois);
		testsCorps(trois);
		testsQualiteFiche(trois);
		testsRegardTete(trois);
		testsVisage(trois);
		// la physiologie lit aussi les deux matchs de pressing : la récupération après un gros
		// effort (30 s sans courir) est rare, trois matchs ne la montrent pas toujours
		std::vector<const lf::DocumentMatch*> cinq = trois;
		if (erreursPressing.empty())
		{
			cinq.push_back(bas.front());	// les deux matchs de pressing de la graine 77
			cinq.push_back(haut.front());
		}
		testsPhysiologie(cinq, argc >= 3 ? std::filesystem::path(argv[2]) : std::filesystem::path());
		testsTypesCourse(trois);
		testsFoulee(trois);
	}
	testsPorteQualite();
	const std::string texteDebug = lireFichier(fixtures / "match-77-debug.json");
	lf::DocumentMatch debug;
	const lf::ResultatChargement rd = lf::chargerDocument(texteDebug, debug);
	if (!rd.ok)
	{
		verifier("le match en mode débogage se lit", false, rd.erreur);
	}
	else
	{
		testsDecisions(debug, match->doc, texteDebug);
	}
	if (argc >= 3)
	{
		testsScenes(argv[2]);
	}

	std::printf("\n%s : %d vérifications, %d échec(s)\n", lft::echouees() ? "ÉCHEC" : "OK", lft::reussies() + lft::echouees(), lft::echouees());
	return lft::echouees() ? 1 : 0;
}
