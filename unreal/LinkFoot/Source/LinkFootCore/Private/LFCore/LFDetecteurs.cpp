#include "LFCore/LFDetecteurs.h"

#include "LFCore/LFRepere.h"

#include <algorithm>
#include <cmath>

namespace lf
{
	const char* nomStatut(Statut s)
	{
		switch (s)
		{
		case Statut::Ok: return "OK";
		case Statut::Alerte: return "ALERTE";
		case Statut::Desynchro: return "DESYNC";
		}
		return "?";
	}

	const char* nomDefautPied(DefautPied d)
	{
		switch (d)
		{
		case DefautPied::Aucun: return "aucun";
		case DefautPied::Glissement: return "FOOT SLIDE WARNING";
		case DefautPied::Flottement: return "pied flottant";
		case DefautPied::Penetration: return "pied dans le sol";
		}
		return "?";
	}

	const char* nomAnomalie(Anomalie a)
	{
		switch (a)
		{
		case Anomalie::Aucune: return "aucune";
		case Anomalie::AccelerationInstantanee: return "acceleration instantanee";
		case Anomalie::FreinageInstantane: return "freinage instantane";
		case Anomalie::Teleportation: return "teleportation";
		case Anomalie::PicVitesse: return "pic de vitesse";
		case Anomalie::VitesseImpossible: return "vitesse impossible";
		case Anomalie::RotationImpossible: return "rotation impossible";
		case Anomalie::PiedsCorps: return "pieds et corps opposes";
		}
		return "?";
	}

	// ---------------------------------------------------------------- §72
	DetecteurDesynchro::DetecteurDesynchro(const SeuilsDesynchro& s)
		: s_(s)
	{
	}

	Statut DetecteurDesynchro::ajouter(double t, double simX, double simY, double vuX, double vuY)
	{
		ecart_ = std::hypot(vuX - simX, vuY - simY);
		if (ecart_ > ecartMax_)
		{
			ecartMax_ = ecart_;
		}
		if (ecart_ <= s_.toleranceM)
		{
			debutHors_ = -1.0;
			statut_ = Statut::Ok;
			return statut_;
		}
		if (debutHors_ < 0.0)
		{
			debutHors_ = t;
		}
		if (t - debutHors_ >= s_.dureeS - 1e-9)
		{
			if (statut_ != Statut::Desynchro)
			{
				++desynchros_;
			}
			statut_ = Statut::Desynchro;
		}
		else
		{
			statut_ = Statut::Alerte;
		}
		return statut_;
	}

	void DetecteurDesynchro::reinitialiser()
	{
		statut_ = Statut::Ok;
		ecart_ = 0.0;
		debutHors_ = -1.0;
	}

	// ---------------------------------------------------------------- §73
	DetecteurDesynchroAnimation::DetecteurDesynchroAnimation(double dureeS)
		: duree_(dureeS)
	{
	}

	Statut DetecteurDesynchroAnimation::ajouter(double t, Famille attendue, Famille vue)
	{
		attendue_ = attendue;
		vue_ = vue;
		const double dt = dernierT_ >= 0.0 && t > dernierT_ ? t - dernierT_ : 0.0;
		dernierT_ = t;
		tempsTotal_ += dt;
		if (famillesCompatibles(attendue, vue))
		{
			debutHors_ = -1.0;
			statut_ = Statut::Ok;
			return statut_;
		}
		tempsHors_ += dt;
		if (debutHors_ < 0.0)
		{
			debutHors_ = t;
		}
		if (t - debutHors_ >= duree_ - 1e-9)
		{
			if (statut_ != Statut::Desynchro)
			{
				++desynchros_;
			}
			statut_ = Statut::Desynchro;
		}
		else
		{
			statut_ = Statut::Alerte;
		}
		return statut_;
	}

	void DetecteurDesynchroAnimation::reinitialiser()
	{
		statut_ = Statut::Ok;
		debutHors_ = -1.0;
		dernierT_ = -1.0;
	}

	// ---------------------------------------------------------------- §74
	DetecteurPied::DetecteurPied(const SeuilsPied& s)
		: s_(s)
	{
	}

	DefautPied DetecteurPied::ajouter(double t, double xCm, double yCm, double zCm, double solCm, int contactAnnonce)
	{
		const double h = zCm - solCm;
		const bool auSol = contactAnnonce == 1 || (contactAnnonce < 0 && h < s_.hauteurContactCm);
		DefautPied d = DefautPied::Aucun;
		if (h < -s_.penetrationCm)
		{
			d = DefautPied::Penetration;
		}
		else if (contactAnnonce == 1 && h > s_.flottementCm)
		{
			d = DefautPied::Flottement;
		}
		vitesseAuSol_ = 0.0;
		if (auSol && aPrecedent_ && precedentAuSol_ && t > tPrec_)
		{
			vitesseAuSol_ = std::hypot(xCm - xPrec_, yCm - yPrec_) / (t - tPrec_);
			if (vitesseAuSol_ > s_.glissementCmS)
			{
				if (debutGlisse_ < 0.0)
				{
					debutGlisse_ = tPrec_;
				}
				if (t - debutGlisse_ >= s_.dureeS - 1e-9 && d == DefautPied::Aucun)
				{
					d = DefautPied::Glissement;
				}
			}
			else
			{
				debutGlisse_ = -1.0;
			}
		}
		else
		{
			debutGlisse_ = -1.0;
		}
		if (d != DefautPied::Aucun && d != defaut_)
		{
			++comptes_[static_cast<std::size_t>(d)];
		}
		defaut_ = d;
		aPrecedent_ = true;
		precedentAuSol_ = auSol;
		tPrec_ = t;
		xPrec_ = xCm;
		yPrec_ = yCm;
		return d;
	}

	void DetecteurPied::reinitialiser()
	{
		defaut_ = DefautPied::Aucun;
		aPrecedent_ = false;
		precedentAuSol_ = false;
		debutGlisse_ = -1.0;
		vitesseAuSol_ = 0.0;
	}

	// ---------------------------------------------------------------- §75
	DetecteurMouvement::DetecteurMouvement(const SeuilsMouvement& s)
		: s_(s)
	{
	}

	int DetecteurMouvement::total() const
	{
		int n = 0;
		for (std::size_t i = 1; i < comptes_.size(); ++i)
		{
			n += comptes_[i];
		}
		return n;
	}

	Anomalie DetecteurMouvement::signaler(Anomalie a, double t)
	{
		++comptes_[static_cast<std::size_t>(a)];
		derniere_ = a;
		instantDerniere_ = t;
		return a;
	}

	void DetecteurMouvement::couper()
	{
		n_ = 0;
		debutPieds_ = -1.0;
		piedsSignales_ = false;
	}

	Anomalie DetecteurMouvement::ajouter(double t, double x, double y, double lacetDeg)
	{
		if (n_ > 0 && t <= t_[0] + 1e-6)
		{
			return Anomalie::Aucune;	// même instant : rien de neuf
		}
		// on décale : [0] le plus récent
		for (int i = 2; i > 0; --i)
		{
			t_[i] = t_[i - 1];
			x_[i] = x_[i - 1];
			y_[i] = y_[i - 1];
			lacet_[i] = lacet_[i - 1];
		}
		t_[0] = t;
		x_[0] = x;
		y_[0] = y;
		lacet_[0] = lacetDeg;
		if (n_ < 3)
		{
			++n_;
		}
		if (n_ < 2)
		{
			return Anomalie::Aucune;
		}
		const double dt1 = t_[0] - t_[1];
		const double vx1 = (x_[0] - x_[1]) / dt1, vy1 = (y_[0] - y_[1]) / dt1;
		const double v1 = std::hypot(vx1, vy1);
		Anomalie trouvee = Anomalie::Aucune;
		if (v1 > s_.teleportationMS)
		{
			trouvee = signaler(Anomalie::Teleportation, t);
			couper();	// la suite repart de cette position
			t_[0] = t;
			x_[0] = x;
			y_[0] = y;
			lacet_[0] = lacetDeg;
			n_ = 1;
			return trouvee;
		}
		if (v1 > s_.vitesseMax)
		{
			trouvee = signaler(Anomalie::VitesseImpossible, t);
		}
		const double rotation = std::fabs(angleNormaliseDeg(lacet_[0] - lacet_[1])) / dt1;
		if (trouvee == Anomalie::Aucune && rotation > s_.rotationMaxDegS && v1 > s_.vitesseRotation)
		{
			trouvee = signaler(Anomalie::RotationImpossible, t);
		}
		if (n_ >= 3 && trouvee == Anomalie::Aucune)
		{
			const double dt0 = t_[1] - t_[2];
			const double vx0 = (x_[1] - x_[2]) / dt0, vy0 = (y_[1] - y_[2]) / dt0;
			const double v0 = std::hypot(vx0, vy0);
			const double a = std::hypot(vx1 - vx0, vy1 - vy0) / (0.5 * (dt0 + dt1));
			if (a > s_.accelerationMax)
			{
				trouvee = signaler(v1 >= v0 ? Anomalie::AccelerationInstantanee : Anomalie::FreinageInstantane, t);
			}
		}
		return trouvee;
	}

	Anomalie DetecteurMouvement::ajouterPieds(double t, double vCorpsX, double vCorpsY, double vPiedGX, double vPiedGY, double vPiedDX, double vPiedDY)
	{
		const double v = std::hypot(vCorpsX, vCorpsY);
		bool oppose = false;
		if (v > 2.0)
		{
			const double ux = vCorpsX / v, uy = vCorpsY / v;
			const double g = vPiedGX * ux + vPiedGY * uy, d = vPiedDX * ux + vPiedDY * uy;
			oppose = g < -0.5 && d < -0.5;
		}
		if (!oppose)
		{
			debutPieds_ = -1.0;
			piedsSignales_ = false;
			return Anomalie::Aucune;
		}
		if (debutPieds_ < 0.0)
		{
			debutPieds_ = t;
		}
		if (!piedsSignales_ && t - debutPieds_ >= s_.piedsCorpsS - 1e-9)
		{
			piedsSignales_ = true;
			return signaler(Anomalie::PiedsCorps, t);
		}
		return Anomalie::Aucune;
	}

	const char* nomVerdictContact(VerdictContact v)
	{
		switch (v)
		{
		case VerdictContact::Rien: return "rien";
		case VerdictContact::Touche: return "touche";
		case VerdictContact::Manque: return "CONTACT MANQUÉ";
		case VerdictContact::NonJuge: return "non jugé";
		}
		return "?";
	}

	DetecteurContact::DetecteurContact(const SeuilsContact& s)
		: s_(s)
	{
	}

	VerdictContact DetecteurContact::clore()
	{
		if (action_ < 0 || clos_)
		{
			return VerdictContact::Rien;
		}
		clos_ = true;
		if (!vu_)
		{
			++nonJuges_;
			return VerdictContact::NonJuge;
		}
		++juges_;
		dernierEcart_ = meilleur_;
		pireEcart_ = std::max(pireEcart_, meilleur_);
		if (meilleur_ > s_.ecartCm)
		{
			++manques_;
			return VerdictContact::Manque;
		}
		return VerdictContact::Touche;
	}

	VerdictContact DetecteurContact::ajouter(int action, double dans, double ecartCm)
	{
		VerdictContact v = VerdictContact::Rien;
		if (action != action_)
		{
			v = clore();
			action_ = action;
			vu_ = false;
			clos_ = action < 0;
			meilleur_ = 0.0;
		}
		if (clos_)
		{
			return v;
		}
		if (std::fabs(dans) <= s_.fenetreS + 1e-9)
		{
			meilleur_ = vu_ ? std::min(meilleur_, ecartCm) : ecartCm;
			vu_ = true;
		}
		if (dans < -s_.fenetreS - 1e-9)
		{
			const VerdictContact w = clore();
			// deux verdicts à la même image (un contact neuf découvert déjà passé) : le pire
			if (w == VerdictContact::Manque || v == VerdictContact::Rien || (w == VerdictContact::NonJuge && v == VerdictContact::Touche))
			{
				v = w;
			}
		}
		return v;
	}

	VerdictContact DetecteurContact::aucun()
	{
		const VerdictContact v = clore();
		action_ = -1;
		return v;
	}

	void DetecteurContact::reinitialiser()
	{
		action_ = -1;
		vu_ = false;
		clos_ = true;
		meilleur_ = 0.0;
	}
}
