#include "LFCore/LFTrajectoire.h"

#include <algorithm>
#include <cmath>

namespace lf
{
	std::vector<EchantillonTrajectoire> trajectoire(const Cinematique& c, int code, double tReference, const ParametresTrajectoire& p)
	{
		std::vector<EchantillonTrajectoire> sortie;
		const EtatCinematique present = c.etat(code, tReference);
		if (!present.valide)
		{
			return sortie;
		}
		const DocumentMatch& doc = c.document();
		int premier = 0, dernier = 0;
		c.segment(code, present.image, premier, dernier);
		const double tPremier = doc.images[static_cast<std::size_t>(premier)].temps();
		const double tDernier = doc.images[static_cast<std::size_t>(dernier)].temps();
		const EtatCinematique debut = c.etat(code, tPremier);
		const EtatCinematique fin = c.etat(code, tDernier);

		// Au-delà du segment : la vitesse du bord s'éteint sur « amortissement » secondes.
		const auto prolonge = [&](const EtatCinematique& bord, double ecart)
		{
			const double tau = std::max(1e-6, p.amortissement);
			const double e = std::min(std::fabs(ecart), tau);
			const double parcours = e - e * e / (2.0 * tau);	// intégrale de v·(1 − s/τ)
			const double signe = ecart < 0.0 ? -1.0 : 1.0;
			EchantillonTrajectoire s;
			s.x = bord.x + bord.vx * parcours * signe;
			s.y = bord.y + bord.vy * parcours * signe;
			s.angleCorps = bord.angleCorps;
			s.extrapole = true;
			return s;
		};

		const auto echantillon = [&](double decalage)
		{
			const double ts = tReference + decalage;
			EchantillonTrajectoire s;
			if (present.horsSegment)
			{
				// tenu en place jusqu'à la coupe : rien à prédire
				s.x = present.x;
				s.y = present.y;
				s.angleCorps = present.angleCorps;
				s.extrapole = decalage != 0.0;
			}
			else if (ts > tDernier + 1e-9)
			{
				s = prolonge(fin, ts - tDernier);
			}
			else if (ts < tPremier - 1e-9)
			{
				s = prolonge(debut, ts - tPremier);
			}
			else
			{
				const EtatCinematique e = c.etat(code, ts);
				s.x = e.x;
				s.y = e.y;
				s.angleCorps = e.angleCorps;
			}
			s.decalage = decalage;
			return s;
		};

		sortie.reserve(static_cast<std::size_t>(std::max(0, p.historique) + 1 + std::max(0, p.prediction)));
		for (int i = p.historique; i >= 1; --i)
		{
			sortie.push_back(echantillon(-i * p.pasHistorique));
		}
		sortie.push_back(echantillon(0.0));
		for (int i = 1; i <= p.prediction; ++i)
		{
			sortie.push_back(echantillon(i * p.pasPrediction));
		}
		return sortie;
	}
}
