#include "LFCore/LFLocomotion.h"

#include "LFCore/LFRepere.h"

#include <cmath>

namespace lf
{
	BandeVitesse bandeVitesse(double vitesse, double seuilArret)
	{
		if (vitesse < seuilArret)
		{
			return BandeVitesse::Arret;
		}
		if (vitesse < 2.0)
		{
			return BandeVitesse::Marche;
		}
		if (vitesse < 4.0)
		{
			return BandeVitesse::Trot;
		}
		if (vitesse < 6.0)
		{
			return BandeVitesse::Course;
		}
		if (vitesse < 8.0)
		{
			return BandeVitesse::Rapide;
		}
		return BandeVitesse::Sprint;
	}

	ClasseVirage classeVirage(double angleDeg)
	{
		const double a = std::fabs(angleDeg);
		if (a < 10.0)
		{
			return ClasseVirage::Aucun;
		}
		if (a < 22.5)
		{
			return ClasseVirage::Correction;
		}
		if (a < 37.5)
		{
			return ClasseVirage::V30;
		}
		if (a < 52.5)
		{
			return ClasseVirage::V45;
		}
		if (a < 75.0)
		{
			return ClasseVirage::V60;
		}
		if (a < 112.5)
		{
			return ClasseVirage::V90;
		}
		if (a < 157.5)
		{
			return ClasseVirage::V135;
		}
		return ClasseVirage::V180;
	}

	DescriptionLocomotion decrireLocomotion(const Cinematique& c, int code, double t, const ParametresLocomotion& p)
	{
		DescriptionLocomotion d;
		const EtatCinematique e = c.etat(code, t);
		if (!e.valide)
		{
			return d;
		}
		d.valide = true;
		d.vitesse = e.vitesse;
		d.vitesseMax = c.document().vitesseMax(code, t);
		d.effort = d.vitesseMax > 0.0 ? e.vitesse / d.vitesseMax : 0.0;
		d.accelerationLongitudinale = e.accelerationLongitudinale;
		d.energie = e.energie;
		d.sprintVoulu = (e.etats & etat::Sprint) != 0;
		d.fatigue = e.energie < p.energieFatigue;
		d.bande = bandeVitesse(e.vitesse, p.seuilArret);

		// L'allure : où va le mouvement par rapport au corps. Le même signe que le lacet
		// d'Unreal (+ : le mouvement part à droite du regard), puisque la conversion du repère
		// est une rotation pure.
		if (e.vitesse > 0.5)
		{
			const double cap = std::atan2(e.vy, e.vx);
			d.angleLocomotionDeg = angleNormaliseDeg((cap - e.angleCorps) * kDegParRad);
			const double ecart = std::fabs(d.angleLocomotionDeg);
			d.allure = ecart < 50.0 ? Allure::Avant : (ecart <= 130.0 ? Allure::Lateral : Allure::Recul);
		}

		if (std::fabs(e.accelerationLaterale) > 0.05)
		{
			d.rayonVirage = e.vitesse * e.vitesse / std::fabs(e.accelerationLaterale);
		}

		// Le segment : on ne compare jamais à travers une coupe.
		int premier = 0, dernier = 0;
		c.segment(code, e.image, premier, dernier);
		const auto memeSegment = [&](const EtatCinematique& autre)
		{
			return autre.valide && !autre.horsSegment && autre.image >= premier && autre.image <= dernier;
		};

		const EtatCinematique futur = c.etat(code, t + p.horizonVirage);
		if (memeSegment(futur) && e.vitesse > p.vitesseMiniVirage && futur.vitesse > p.vitesseMiniVirage)
		{
			d.virageDeg = angleNormaliseDeg((std::atan2(futur.vy, futur.vx) - std::atan2(e.vy, e.vx)) * kDegParRad);
			d.virage = classeVirage(d.virageDeg);
		}

		const double aL = e.accelerationLongitudinale;
		if (e.vitesse < p.seuilArret)
		{
			const EtatCinematique bientot = c.etat(code, t + 0.3);
			d.phase = memeSegment(bientot) && bientot.vitesse > 1.0 ? PhaseVitesse::Demarrage : PhaseVitesse::Stable;
		}
		else if (aL > p.seuilAcceleration)
		{
			const EtatCinematique avant = c.etat(code, t - 0.4);
			d.phase = memeSegment(avant) && avant.vitesse < 0.5 && e.vitesse < 3.0 ? PhaseVitesse::Demarrage : PhaseVitesse::Acceleration;
		}
		else if (aL < -p.seuilFreinage)
		{
			const EtatCinematique apres = c.etat(code, t + 0.5);
			d.phase = memeSegment(apres) && apres.vitesse < p.seuilArret ? PhaseVitesse::Arret : PhaseVitesse::Freinage;
		}
		return d;
	}

	const char* nomBande(BandeVitesse b)
	{
		switch (b)
		{
		case BandeVitesse::Arret: return "arret";
		case BandeVitesse::Marche: return "marche";
		case BandeVitesse::Trot: return "trot";
		case BandeVitesse::Course: return "course";
		case BandeVitesse::Rapide: return "rapide";
		case BandeVitesse::Sprint: return "sprint";
		}
		return "?";
	}

	const char* nomPhase(PhaseVitesse p)
	{
		switch (p)
		{
		case PhaseVitesse::Stable: return "stable";
		case PhaseVitesse::Demarrage: return "demarrage";
		case PhaseVitesse::Acceleration: return "acceleration";
		case PhaseVitesse::Freinage: return "freinage";
		case PhaseVitesse::Arret: return "arret";
		}
		return "?";
	}

	const char* nomAllure(Allure a)
	{
		switch (a)
		{
		case Allure::Avant: return "avant";
		case Allure::Lateral: return "lateral";
		case Allure::Recul: return "recul";
		}
		return "?";
	}

	const char* nomVirage(ClasseVirage v)
	{
		switch (v)
		{
		case ClasseVirage::Aucun: return "aucun";
		case ClasseVirage::Correction: return "correction";
		case ClasseVirage::V30: return "30";
		case ClasseVirage::V45: return "45";
		case ClasseVirage::V60: return "60";
		case ClasseVirage::V90: return "90";
		case ClasseVirage::V135: return "135";
		case ClasseVirage::V180: return "180";
		}
		return "?";
	}
}
