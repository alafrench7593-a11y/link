#include "LFCore/LFRegard.h"

#include "LFCore/LFRepere.h"

#include <algorithm>
#include <cmath>

namespace lf
{
	OrientationRegard orienterRegard(double x, double y, double angleCorps, double hauteurYeuxM, double cx, double cy, double cz, const LimitesRegard& l)
	{
		OrientationRegard o;
		const double dx = cx - x, dy = cy - y;
		const double devant = dx * std::cos(angleCorps) + dy * std::sin(angleCorps);
		const double droite = -dx * std::sin(angleCorps) + dy * std::cos(angleCorps);
		const double horizontal = std::hypot(dx, dy);
		if (horizontal < 1e-6 && std::fabs(cz - hauteurYeuxM) < 1e-6)
		{
			return o;
		}
		o.valide = true;
		o.lacetCibleDeg = std::atan2(droite, devant) * kDegParRad;
		o.tangageCibleDeg = std::atan2(cz - hauteurYeuxM, horizontal) * kDegParRad;
		// le lacet : les yeux seuls, puis la tête prend sa part, puis les yeux finissent
		const double a = std::fabs(o.lacetCibleDeg), signe = o.lacetCibleDeg < 0.0 ? -1.0 : 1.0;
		const double tete = std::min(l.lacetTeteMaxDeg, std::max(0.0, a - l.seuilYeuxDeg) * l.partTete);
		o.lacetTeteDeg = signe * tete;
		o.lacetYeuxDeg = std::clamp(o.lacetCibleDeg - o.lacetTeteDeg, -l.lacetYeuxMaxDeg, l.lacetYeuxMaxDeg);
		// le tangage : la même règle, avec un seuil plus court (on baisse les yeux avant la tête)
		const double seuilT = l.seuilYeuxDeg * 0.67;
		const double b = std::fabs(o.tangageCibleDeg), signeT = o.tangageCibleDeg < 0.0 ? -1.0 : 1.0;
		o.tangageTeteDeg = std::clamp(signeT * std::max(0.0, b - seuilT) * l.partTete, l.tangageTeteMinDeg, l.tangageTeteMaxDeg);
		o.tangageYeuxDeg = std::clamp(o.tangageCibleDeg - o.tangageTeteDeg, -l.tangageYeuxMaxDeg, l.tangageYeuxMaxDeg);
		o.horsDeVue = std::fabs(o.lacetTeteDeg + o.lacetYeuxDeg - o.lacetCibleDeg) > 0.5
			|| std::fabs(o.tangageTeteDeg + o.tangageYeuxDeg - o.tangageCibleDeg) > 0.5;
		return o;
	}

	double periodeBalayage(int decision, const ParametresRegard& p)
	{
		const double s = std::clamp((decision - 40.0) / 50.0, 0.0, 1.0);
		return p.periodeBalayageLente + (p.periodeBalayageRapide - p.periodeBalayageLente) * s;
	}

	Regard cibleRegard(const Cinematique& c, int code, double t, const ParametresRegard& p)
	{
		Regard r;
		const EtatCinematique e = c.etat(code, t);
		if (!e.valide)
		{
			return r;
		}
		const DocumentMatch& doc = c.document();
		const EtatBallon b = c.ballon(t);
		r.valide = true;
		r.x = b.x;
		r.y = b.y;
		r.z = b.z;
		r.source = SourceRegard::Ballon;

		// 1. Une passe lui est destinée : il suit le ballon qui arrive.
		if (const Vol* v = c.volA(t); v && v->vers == code)
		{
			r.source = SourceRegard::PasseAttendue;
			return r;
		}

		// 2. Il va frapper : il regarde sa cible.
		for (const int ia : c.actionsDe(code))
		{
			const Action& a = doc.actions[static_cast<std::size_t>(ia)];
			if (a.t <= t)
			{
				continue;
			}
			if (a.t > t + p.anticipationFrappe)
			{
				break;
			}
			if (!a.estFrappe())
			{
				continue;
			}
			const int vers = static_cast<int>(std::lround(a.nombre("vers", -1.0)));
			if (a.type == TypeAction::Tir)
			{
				r.x = a.nombre("x1", r.x);
				r.y = a.nombre("y1", r.y);
				r.z = 1.0;
				r.source = SourceRegard::CibleTir;
				return r;
			}
			if (vers >= 0)
			{
				const EtatCinematique q = c.etat(vers, a.t);
				if (q.valide)
				{
					r.x = q.x;
					r.y = q.y;
					r.z = 1.6;
					r.source = SourceRegard::CiblePasse;
					return r;
				}
			}
			r.x = a.nombre("x1", r.x);
			r.y = a.nombre("y1", r.y);
			r.z = 0.0;
			r.source = SourceRegard::CiblePasse;
			return r;
		}

		// 3. Il conduit le ballon : tête relevée vers où il va.
		if (b.porteur == code)
		{
			if (e.vitesse > 1.0)
			{
				r.x = e.x + e.vx / e.vitesse * p.distanceDevant;
				r.y = e.y + e.vy / e.vitesse * p.distanceDevant;
				r.z = 0.3;
				r.source = SourceRegard::Devant;
			}
			return r;
		}

		// 4. Le coup d'œil par-dessus l'épaule, s'il est près du jeu.
		const FicheJoueur* f = doc.ficheA(code, t);
		const bool gardien = f && f->estGardien();
		const double dBallon = std::hypot(b.x - e.x, b.y - e.y);
		if (!gardien && f && f->aMoteur && dBallon < p.distanceBalayage)
		{
			const double periode = periodeBalayage(f->moteur.decision, p);
			const double decalage = std::fmod(code * 0.37 * periode, periode);
			if (std::fmod(t + decalage, periode) < p.dureeBalayage)
			{
				const int premierAdverse = code < 11 ? 11 : 0;
				double meilleur = 1e9;
				for (int q = premierAdverse; q < premierAdverse + 11; ++q)
				{
					const EtatCinematique o = c.etat(q, t);
					if (!o.valide)
					{
						continue;
					}
					const double d = std::hypot(o.x - e.x, o.y - e.y);
					if (d < meilleur)
					{
						meilleur = d;
						r.x = o.x;
						r.y = o.y;
						r.z = 1.6;
					}
				}
				if (meilleur < 1e9)
				{
					r.source = SourceRegard::Balayage;
				}
			}
		}
		return r;
	}

	const char* nomSourceRegard(SourceRegard s)
	{
		switch (s)
		{
		case SourceRegard::Ballon: return "ballon";
		case SourceRegard::PasseAttendue: return "passe_attendue";
		case SourceRegard::CiblePasse: return "cible_passe";
		case SourceRegard::CibleTir: return "cible_tir";
		case SourceRegard::Devant: return "devant";
		case SourceRegard::Balayage: return "balayage";
		}
		return "?";
	}
}
