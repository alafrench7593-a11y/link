#include "LFCore/LFCinematique.h"

#include "LFCore/LFRepere.h"

#include <algorithm>
#include <cmath>

namespace lf
{
	namespace
	{
		double bornerCinematique(double v, double lo, double hi)
		{
			return v < lo ? lo : (v > hi ? hi : v);
		}

		// Tolérance entre la formule de vol et la position écrite dans l'image (arrondie au cm).
		constexpr double kEcartVolMax = 0.25;
	}

	Cinematique::Cinematique(const DocumentMatch& doc, const ParametresCinematique& parametres)
		: doc_(doc)
		, p_(parametres)
	{
		const int n = nombreImages();
		const std::size_t taille = static_cast<std::size_t>(n) * static_cast<std::size_t>(kJoueurs);
		ruptures_.assign(taille, 0);
		positions_.assign(taille * 2, 0.f);
		vitesses_.assign(taille * 2, 0.f);
		accelerations_.assign(taille * 2, 0.f);
		actionsParJoueur_.assign(static_cast<std::size_t>(kJoueurs), {});

		// 1. Les ruptures : coupe, trou dans le temps, entrée ou sortie du terrain.
		for (int i = 0; i < n; ++i)
		{
			const Image& b = doc_.images[static_cast<std::size_t>(i)];
			const bool globale = i == 0 || b.coupe || b.t10 - doc_.images[static_cast<std::size_t>(i - 1)].t10 != 1;
			for (int k = 0; k < kJoueurs; ++k)
			{
				const bool present = b.joueurs[static_cast<std::size_t>(k)].present;
				const bool etaitPresent = i > 0 && doc_.images[static_cast<std::size_t>(i - 1)].joueurs[static_cast<std::size_t>(k)].present;
				ruptures_[indice(i, k)] = (globale || !present || !etaitPresent) ? 1 : 0;
			}
		}
		// Un remplacement : la personne change sous le même code. Comme la vérification du
		// moteur (verifierPont), on coupe l'image de l'action et la suivante.
		for (const Remplacement& r : doc_.remplacements)
		{
			const int t10 = static_cast<int>(std::lround(r.t * 10.0));
			for (int i = std::max(0, doc_.indexImageA(r.t) - 1); i < n && doc_.images[static_cast<std::size_t>(i)].t10 <= t10 + 1; ++i)
			{
				const int ti = doc_.images[static_cast<std::size_t>(i)].t10;
				if (ti == t10 || ti == t10 + 1)
				{
					ruptures_[indice(i, r.code)] = 1;
				}
			}
		}

		// 2. Positions (lissées si demandé), vitesses puis accélérations, segment par segment.
		for (int i = 0; i < n; ++i)
		{
			for (int k = 0; k < kJoueurs; ++k)
			{
				const JoueurImage& q = doc_.images[static_cast<std::size_t>(i)].joueurs[static_cast<std::size_t>(k)];
				positions_[indice(i, k) * 2] = q.x;
				positions_[indice(i, k) * 2 + 1] = q.y;
			}
		}
		const double dt = kPasMoteur;
		for (int k = 0; k < kJoueurs; ++k)
		{
			int i = 0;
			while (i < n)
			{
				if (!doc_.images[static_cast<std::size_t>(i)].joueurs[static_cast<std::size_t>(k)].present)
				{
					++i;
					continue;
				}
				const int p = i;
				int d = i;
				while (d + 1 < n && ruptures_[indice(d + 1, k)] == 0)
				{
					++d;
				}
				if (p_.lissageS > 0.0 && d > p)
				{
					// noyau gaussien centré, tronqué au segment, puis ramené à ecartMaxM du moteur
					const int rayon = static_cast<int>(std::ceil(3.0 * p_.lissageS / dt));
					std::vector<float> lisse(static_cast<std::size_t>(d - p + 1) * 2);
					for (int j = p; j <= d; ++j)
					{
						double sx = 0.0, sy = 0.0, sw = 0.0;
						for (int m = std::max(p, j - rayon); m <= std::min(d, j + rayon); ++m)
						{
							const double u = (m - j) * dt / p_.lissageS;
							const double w = std::exp(-0.5 * u * u);
							const JoueurImage& q = doc_.images[static_cast<std::size_t>(m)].joueurs[static_cast<std::size_t>(k)];
							sx += w * static_cast<double>(q.x);
							sy += w * static_cast<double>(q.y);
							sw += w;
						}
						const JoueurImage& brut = doc_.images[static_cast<std::size_t>(j)].joueurs[static_cast<std::size_t>(k)];
						double lx = sx / sw, ly = sy / sw;
						const double ex = lx - static_cast<double>(brut.x), ey = ly - static_cast<double>(brut.y);
						const double ecart = std::sqrt(ex * ex + ey * ey);
						if (ecart > p_.ecartMaxM)
						{
							lx = static_cast<double>(brut.x) + ex * p_.ecartMaxM / ecart;
							ly = static_cast<double>(brut.y) + ey * p_.ecartMaxM / ecart;
						}
						lisse[static_cast<std::size_t>(j - p) * 2] = static_cast<float>(lx);
						lisse[static_cast<std::size_t>(j - p) * 2 + 1] = static_cast<float>(ly);
					}
					for (int j = p; j <= d; ++j)
					{
						positions_[indice(j, k) * 2] = lisse[static_cast<std::size_t>(j - p) * 2];
						positions_[indice(j, k) * 2 + 1] = lisse[static_cast<std::size_t>(j - p) * 2 + 1];
					}
				}
				auto pos = [&](int j, int axe) -> double
				{
					return static_cast<double>(positions_[indice(j, k) * 2 + static_cast<std::size_t>(axe)]);
				};
				for (int j = p; j <= d; ++j)
				{
					for (int axe = 0; axe < 2; ++axe)
					{
						double v = 0.0;
						if (d > p)
						{
							if (j == p)
							{
								v = (pos(j + 1, axe) - pos(j, axe)) / dt;
							}
							else if (j == d)
							{
								v = (pos(j, axe) - pos(j - 1, axe)) / dt;
							}
							else
							{
								v = (pos(j + 1, axe) - pos(j - 1, axe)) / (2.0 * dt);
							}
						}
						vitesses_[indice(j, k) * 2 + static_cast<std::size_t>(axe)] = static_cast<float>(v);
					}
				}
				for (int j = p; j <= d; ++j)
				{
					for (int axe = 0; axe < 2; ++axe)
					{
						auto vit = [&](int jj) -> double { return static_cast<double>(vitesses_[indice(jj, k) * 2 + static_cast<std::size_t>(axe)]); };
						double a = 0.0;
						if (d > p)
						{
							if (j == p)
							{
								a = (vit(j + 1) - vit(j)) / dt;
							}
							else if (j == d)
							{
								a = (vit(j) - vit(j - 1)) / dt;
							}
							else
							{
								a = (vit(j + 1) - vit(j - 1)) / (2.0 * dt);
							}
						}
						accelerations_[indice(j, k) * 2 + static_cast<std::size_t>(axe)] = static_cast<float>(a);
					}
				}
				i = d + 1;
			}
		}

		// 3. Les actions par joueur.
		for (std::size_t a = 0; a < doc_.actions.size(); ++a)
		{
			const int c = doc_.actions[a].code;
			if (c >= 0 && c < kJoueurs)
			{
				actionsParJoueur_[static_cast<std::size_t>(c)].push_back(static_cast<int>(a));
			}
		}

		// 4. Les vols du ballon, et jusqu'où ils ont réellement suivi la formule.
		for (std::size_t a = 0; a < doc_.actions.size(); ++a)
		{
			const Action& ac = doc_.actions[a];
			if (!ac.estFrappe())
			{
				continue;
			}
			Vol v;
			v.action = static_cast<int>(a);
			v.t0 = ac.t;
			// Une frappe jouée pendant le pas du ballon (dégagement ou déviation de la tête après un
			// duel aérien) : le contact est à la fin du pas (t), la formule du moteur part du début
			// (champ t0 de l'action).
			v.tFormule = std::min(ac.t, ac.nombre("t0", ac.t));
			v.duree = std::max(0.05, ac.nombre("dur", 0.5));
			v.x0 = ac.nombre("x0");
			v.y0 = ac.nombre("y0");
			v.z0 = ac.nombre("z0");
			v.x1 = ac.nombre("x1");
			v.y1 = ac.nombre("y1");
			v.apex = ac.nombre("apex");
			v.lineaire = ac.vrai("aerien") || ac.texteVaut("genre", "shot");
			v.vers = static_cast<int>(std::lround(ac.nombre("vers", -1.0)));
			v.de = ac.code;
			// Le vol dure jusqu'à la dernière image qui suit la formule : au-delà, le moteur a pu
			// changer le ballon entre deux images (sorti, au fond, repoussé, contrôlé), et ce sont
			// les images qui le disent.
			v.tFin = v.t0;
			const int premiere = doc_.indexImageA(v.t0) + 1;
			for (int j = std::max(0, premiere); j < n; ++j)
			{
				const Image& im = doc_.images[static_cast<std::size_t>(j)];
				const double tj = im.temps();
				if (tj > v.tFormule + v.duree + 1e-6 || im.coupe || (j > 0 && im.t10 - doc_.images[static_cast<std::size_t>(j - 1)].t10 != 1))
				{
					break;
				}
				EtatBallon f;
				positionBallonVol(v, tj, f);
				const double ex = f.x - static_cast<double>(im.ballon[0]);
				const double ey = f.y - static_cast<double>(im.ballon[1]);
				const double ez = f.z - static_cast<double>(im.ballon[2]);
				if (std::sqrt(ex * ex + ey * ey + ez * ez) > kEcartVolMax)
				{
					break;
				}
				v.tFin = tj;
				if (im.porteur >= 0)
				{
					break;
				}
			}
			// Aucune image n'a suivi la formule : le moteur a gardé le ballon où il était pendant
			// un pas (une tête après un duel aérien). On suit alors les images, pas la formule.
			v.utilisable = v.tFin > v.t0 + 1e-6;
			vols_.push_back(v);
		}
		std::stable_sort(vols_.begin(), vols_.end(), [](const Vol& a, const Vol& b) { return a.t0 < b.t0; });
		// Une nouvelle frappe termine le vol précédent.
		for (std::size_t i = 0; i + 1 < vols_.size(); ++i)
		{
			if (vols_[i + 1].t0 < vols_[i].tFin)
			{
				vols_[i].tFin = vols_[i + 1].t0;
			}
		}
	}

	bool Cinematique::rupture(int code, int image) const
	{
		if (code < 0 || code >= kJoueurs || image < 0 || image >= nombreImages())
		{
			return true;
		}
		return ruptures_[indice(image, code)] != 0;
	}

	void Cinematique::segment(int code, int image, int& premier, int& dernier) const
	{
		premier = image;
		dernier = image;
		if (code < 0 || code >= kJoueurs || image < 0 || image >= nombreImages())
		{
			return;
		}
		while (premier > 0 && ruptures_[indice(premier, code)] == 0)
		{
			--premier;
		}
		while (dernier + 1 < nombreImages() && ruptures_[indice(dernier + 1, code)] == 0)
		{
			++dernier;
		}
	}

	void Cinematique::positionImage(int code, int image, double& x, double& y) const
	{
		x = 0.0;
		y = 0.0;
		if (code < 0 || code >= kJoueurs || image < 0 || image >= nombreImages())
		{
			return;
		}
		x = static_cast<double>(positions_[indice(image, code) * 2]);
		y = static_cast<double>(positions_[indice(image, code) * 2 + 1]);
	}

	void Cinematique::vitesseImage(int code, int image, double& vx, double& vy) const
	{
		vx = 0.0;
		vy = 0.0;
		if (code < 0 || code >= kJoueurs || image < 0 || image >= nombreImages())
		{
			return;
		}
		vx = static_cast<double>(vitesses_[indice(image, code) * 2]);
		vy = static_cast<double>(vitesses_[indice(image, code) * 2 + 1]);
	}

	void Cinematique::accelerationImage(int code, int image, double& ax, double& ay) const
	{
		ax = 0.0;
		ay = 0.0;
		if (code < 0 || code >= kJoueurs || image < 0 || image >= nombreImages())
		{
			return;
		}
		ax = static_cast<double>(accelerations_[indice(image, code) * 2]);
		ay = static_cast<double>(accelerations_[indice(image, code) * 2 + 1]);
	}

	const std::vector<int>& Cinematique::actionsDe(int code) const
	{
		static const std::vector<int> kAucune;
		if (code < 0 || code >= kJoueurs)
		{
			return kAucune;
		}
		return actionsParJoueur_[static_cast<std::size_t>(code)];
	}

	EtatCinematique Cinematique::etat(int code, double t) const
	{
		EtatCinematique e;
		e.t = t;
		const int n = nombreImages();
		if (code < 0 || code >= kJoueurs || n == 0)
		{
			return e;
		}
		int i = doc_.indexImageA(t);
		const bool avant = i < 0;
		if (avant)
		{
			i = 0;
		}
		const Image& A = doc_.images[static_cast<std::size_t>(i)];
		const JoueurImage& ja = A.joueurs[static_cast<std::size_t>(code)];
		if (!ja.present)
		{
			return e;
		}
		e.valide = true;
		e.image = i;
		double vxA = 0.0, vyA = 0.0, axA = 0.0, ayA = 0.0;
		vitesseImage(code, i, vxA, vyA);
		accelerationImage(code, i, axA, ayA);
		const double tA = A.temps();
		const bool interpole = !avant && i + 1 < n && ruptures_[indice(i + 1, code)] == 0 && t > tA;
		if (interpole)
		{
			const Image& B = doc_.images[static_cast<std::size_t>(i + 1)];
			const JoueurImage& jb = B.joueurs[static_cast<std::size_t>(code)];
			double vxB = 0.0, vyB = 0.0, axB = 0.0, ayB = 0.0;
			vitesseImage(code, i + 1, vxB, vyB);
			accelerationImage(code, i + 1, axB, ayB);
			const double h = B.temps() - tA;
			const double s = bornerCinematique((t - tA) / h, 0.0, 1.0);
			const double s2 = s * s, s3 = s2 * s;
			const double h00 = 2.0 * s3 - 3.0 * s2 + 1.0, h10 = s3 - 2.0 * s2 + s, h01 = -2.0 * s3 + 3.0 * s2, h11 = s3 - s2;
			const double d00 = 6.0 * s2 - 6.0 * s, d10 = 3.0 * s2 - 4.0 * s + 1.0, d01 = -6.0 * s2 + 6.0 * s, d11 = 3.0 * s2 - 2.0 * s;
			double xa = 0.0, ya = 0.0, xb = 0.0, yb = 0.0;
			positionImage(code, i, xa, ya);
			positionImage(code, i + 1, xb, yb);
			e.x = h00 * xa + h10 * h * vxA + h01 * xb + h11 * h * vxB;
			e.y = h00 * ya + h10 * h * vyA + h01 * yb + h11 * h * vyB;
			e.vx = (d00 * xa + d10 * h * vxA + d01 * xb + d11 * h * vxB) / h;
			e.vy = (d00 * ya + d10 * h * vyA + d01 * yb + d11 * h * vyB) / h;
			e.ax = axA + (axB - axA) * s;
			e.ay = ayA + (ayB - ayA) * s;
			const double aA = ja.angle / 1000.0, aB = jb.angle / 1000.0;
			e.angleCorps = angleNormaliseRad(aA + angleNormaliseRad(aB - aA) * s);
			e.energie = ja.energie + (static_cast<double>(jb.energie) - ja.energie) * s;
			e.etats = jb.etats;
			e.intention = jb.intention;
		}
		else
		{
			positionImage(code, i, e.x, e.y);
			e.vx = vxA;
			e.vy = vyA;
			e.ax = axA;
			e.ay = ayA;
			e.angleCorps = ja.angle / 1000.0;
			e.energie = ja.energie;
			e.etats = ja.etats;
			e.intention = ja.intention;
			e.horsSegment = avant || t > tA + 1e-9;
			if (e.horsSegment)
			{
				// tenu en place : pas de vitesse inventée
				e.vx = 0.0;
				e.vy = 0.0;
				e.ax = 0.0;
				e.ay = 0.0;
			}
		}
		e.vitesse = std::sqrt(e.vx * e.vx + e.vy * e.vy);
		if (e.vitesse > 0.05)
		{
			const double ux = e.vx / e.vitesse, uy = e.vy / e.vitesse;
			e.accelerationLongitudinale = e.ax * ux + e.ay * uy;
			e.accelerationLaterale = ux * e.ay - uy * e.ax;
		}
		return e;
	}

	const Vol* Cinematique::volA(double t) const
	{
		if (vols_.empty())
		{
			return nullptr;
		}
		auto it = std::upper_bound(vols_.begin(), vols_.end(), t, [](double tt, const Vol& v) { return tt < v.t0 - 1e-9; });
		if (it == vols_.begin())
		{
			return nullptr;
		}
		--it;
		return it->utilisable && t <= it->tFin + 1e-9 ? &*it : nullptr;
	}

	void Cinematique::positionBallonVol(const Vol& v, double t, EtatBallon& b) const
	{
		// Une frappe jouée pendant le pas du ballon : au contact, le ballon est encore au point de
		// frappe ; la formule ne le rejoint qu'à l'image suivante. On va de l'un à l'autre.
		if (v.tFormule < v.t0 - 1e-9 && t < v.t0 + kPasMoteur)
		{
			Vol suite = v;
			suite.tFormule = v.tFormule;
			suite.t0 = v.tFormule;	// la formule seule
			EtatBallon fin;
			positionBallonVol(suite, v.t0 + kPasMoteur, fin);
			const double s = bornerCinematique((t - v.t0) / kPasMoteur, 0.0, 1.0);
			b.x = v.x0 + (fin.x - v.x0) * s;
			b.y = v.y0 + (fin.y - v.y0) * s;
			b.z = v.z0 + (fin.z - v.z0) * s;
			b.vx = (fin.x - v.x0) / kPasMoteur;
			b.vy = (fin.y - v.y0) / kPasMoteur;
			b.vz = (fin.z - v.z0) / kPasMoteur;
			return;
		}
		const double u = bornerCinematique((t - v.tFormule) / v.duree, 0.0, 1.0);
		const double e = v.lineaire ? u : 1.0 - std::pow(1.0 - u, 1.35);
		const double de = v.lineaire ? 1.0 : 1.35 * std::pow(1.0 - u, 0.35);
		b.x = v.x0 + (v.x1 - v.x0) * e;
		b.y = v.y0 + (v.y1 - v.y0) * e;
		b.z = v.z0 * (1.0 - u) + (v.apex > 0.0 ? 4.0 * v.apex * u * (1.0 - u) : 0.0);
		const bool dansLeVol = t > v.tFormule && t < v.tFormule + v.duree;
		b.vx = dansLeVol ? (v.x1 - v.x0) * de / v.duree : 0.0;
		b.vy = dansLeVol ? (v.y1 - v.y0) * de / v.duree : 0.0;
		b.vz = dansLeVol ? (-v.z0 + (v.apex > 0.0 ? 4.0 * v.apex * (1.0 - 2.0 * u) : 0.0)) / v.duree : 0.0;
	}

	EtatBallon Cinematique::ballon(double t) const
	{
		EtatBallon b;
		const int n = nombreImages();
		if (n == 0)
		{
			return b;
		}
		if (const Vol* v = volA(t))
		{
			positionBallonVol(*v, t, b);
			b.valide = true;
			b.enVol = true;
			b.frappe = v->action;
			b.porteur = -1;
			return b;
		}
		int i = doc_.indexImageA(t);
		if (i < 0)
		{
			i = 0;
		}
		const Image& A = doc_.images[static_cast<std::size_t>(i)];
		b.valide = true;
		b.porteur = A.porteur;
		b.x = static_cast<double>(A.ballon[0]);
		b.y = static_cast<double>(A.ballon[1]);
		b.z = static_cast<double>(A.ballon[2]);
		const double tA = A.temps();
		if (i + 1 < n && t > tA)
		{
			const Image& B = doc_.images[static_cast<std::size_t>(i + 1)];
			const bool pose = B.cpa != Cpa::Aucun && B.cpa != A.cpa;	// le moteur pose le ballon pour la remise en jeu
			if (!B.coupe && B.t10 - A.t10 == 1 && !pose)
			{
				const double tB = B.temps();
				double cx = static_cast<double>(B.ballon[0]), cy = static_cast<double>(B.ballon[1]), cz = static_cast<double>(B.ballon[2]);
				double tC = tB;
				// une frappe entre les deux images : le ballon va d'abord jusqu'au point de frappe
				auto it = std::upper_bound(vols_.begin(), vols_.end(), tA, [](double tt, const Vol& v) { return tt < v.t0; });
				if (it != vols_.end() && it->utilisable && it->t0 <= tB && it->t0 > tA)
				{
					cx = it->x0;
					cy = it->y0;
					cz = it->z0;	// une tête, une volée : le point de frappe est en l'air
					tC = it->t0;
				}
				const double s = bornerCinematique((t - tA) / std::max(1e-6, tC - tA), 0.0, 1.0);
				b.vx = (cx - b.x) / std::max(1e-6, tC - tA);
				b.vy = (cy - b.y) / std::max(1e-6, tC - tA);
				b.vz = (cz - b.z) / std::max(1e-6, tC - tA);
				b.x += (cx - b.x) * s;
				b.y += (cy - b.y) * s;
				b.z += (cz - b.z) * s;
				b.porteur = B.porteur;
			}
		}
		return b;
	}
}
