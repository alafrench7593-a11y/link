#include "LFCore/LFPhysiologie.h"

#include <algorithm>
#include <cmath>

namespace lf
{
	double ChroniquePhysiologie::effort(double vitesse, double vitesseMax)
	{
		if (vitesse < 2.0)
		{
			return 0.05;
		}
		const double r = vitesse / std::max(1.0, vitesseMax);
		return std::min(1.5, r * r * 1.25);
	}

	ChroniquePhysiologie::ChroniquePhysiologie(const Cinematique& c, const ParametresPhysiologie& p)
		: c_(c)
		, p_(p)
	{
		const DocumentMatch& doc = c.document();
		if (doc.meteo == "pluie")
		{
			humidite_ = 1.0;
		}
		else if (doc.meteo == "neige")
		{
			humidite_ = 0.4;
			facteurMeteo_ = 0.75;
		}
		else if (doc.meteo == "soleil")
		{
			facteurMeteo_ = 1.15;
		}
		else if (doc.meteo == "nuit")
		{
			facteurMeteo_ = 0.95;
		}
		const std::size_t n = doc.images.size();
		for (int code = 0; code < kJoueurs; ++code)
		{
			std::vector<float>& S = souffle_[static_cast<std::size_t>(code)];
			std::vector<float>& W = travail_[static_cast<std::size_t>(code)];
			S.assign(n, 0.f);
			W.assign(n, 0.f);
			double souffle = 0.0, travail = 0.0;
			for (std::size_t i = 0; i < n; ++i)
			{
				const Image& im = doc.images[i];
				const JoueurImage& j = im.joueurs[static_cast<std::size_t>(code)];
				const double dt = i == 0 ? 0.0 : std::min(0.5, im.temps() - doc.images[i - 1].temps());
				if (i > 0 && im.miTemps == 2 && doc.images[i - 1].miTemps == 1)
				{
					travail *= 0.6;	// la mi-temps : on s'essuie, on se change parfois
				}
				if (j.present && dt > 0.0)
				{
					double vx = 0.0, vy = 0.0;
					c.vitesseImage(code, static_cast<int>(i), vx, vy);
					const double e = effort(std::hypot(vx, vy), doc.vitesseMax(code, im.temps()));
					const double tau = e > souffle ? p_.tauMontee : p_.tauDescente * (1.0 + (1.0 - j.energie / 100.0));
					souffle += (e - souffle) * (1.0 - std::exp(-dt / tau));
					travail += e * dt;
				}
				S[i] = static_cast<float>(souffle);
				W[i] = static_cast<float>(travail);
			}
		}
	}

	EtatPhysiologique ChroniquePhysiologie::etat(int code, double t) const
	{
		EtatPhysiologique r;
		if (code < 0 || code >= kJoueurs)
		{
			return r;
		}
		const EtatCinematique e = c_.etat(code, t);
		const DocumentMatch& doc = c_.document();
		const int i = doc.indexImageA(t);
		if (!e.valide || i < 0)
		{
			return r;
		}
		r.valide = true;
		const std::vector<float>& S = souffle_[static_cast<std::size_t>(code)];
		const std::vector<float>& W = travail_[static_cast<std::size_t>(code)];
		const std::size_t a = static_cast<std::size_t>(i), b = std::min(a + 1, S.size() - 1);
		const double ta = doc.images[a].temps(), tb = doc.images[b].temps();
		const double u = tb > ta ? std::clamp((t - ta) / (tb - ta), 0.0, 1.0) : 0.0;
		const double souffle = S[a] + (S[b] - S[a]) * u;
		const double travail = W[a] + (W[b] - W[a]) * u;
		const double fatigue = 1.0 - e.energie / 100.0;
		r.essoufflement = souffle;
		r.frequenceRespiration = p_.respirationRepos + (p_.respirationEffort - p_.respirationRepos) * std::min(1.0, souffle) + 6.0 * fatigue;
		r.amplitudeRespiration = 0.2 + 0.8 * std::min(1.0, souffle);
		r.transpiration = std::clamp(0.08 + 0.92 * travail * facteurMeteo_ / p_.travailSaturation, 0.0, 1.0);
		r.humidite = humidite_;
		r.postureFatigue = std::clamp((70.0 - e.energie) / 40.0 + 0.3 * std::max(0.0, souffle - 0.6), 0.0, 1.0);
		return r;
	}
}
