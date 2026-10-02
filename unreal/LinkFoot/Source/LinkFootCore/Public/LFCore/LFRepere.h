// LinkFoot, cœur portable : du repère du moteur à celui d'Unreal.
//
// Moteur : mètres ; x en largeur (0 à 68), y en longueur (0 à 105) ; orientation du corps en
// radians (le vecteur (cos a, sin a)).
// Unreal : centimètres ; X vers le but que le domicile attaque au coup d'envoi, Y vers la
// droite vue de dessus, Z vers le haut ; lacet en degrés.
// Le contrat (docs/passerelle-ue5.md, §3) : X = (52,5 − y) × 100 ; Y = (x − 34) × 100 ;
// Z = z × 100 ; lacet = atan2(cos a, −sin a). C'est une rotation, sans miroir : la vue de
// dessus du moteur et celle d'Unreal se superposent. Les mêmes formules que versUnreal() et
// lacetUnreal() de src/passerelle.js, au bit près (vérifié par les tests du cœur).
#pragma once

#include <cmath>

namespace lf
{
	constexpr double kPiLF = 3.14159265358979323846;
	constexpr double kDegParRad = 180.0 / kPiLF;

	// Un ballon de taille 5 : 22 cm de diamètre. Le moteur donne son point bas (z = 0 au sol) ;
	// son centre est un rayon plus haut.
	constexpr double kRayonBallonM = 0.11;

	struct PointUE
	{
		double X = 0.0;
		double Y = 0.0;
		double Z = 0.0;
	};

	// Un point du moteur (mètres) dans Unreal (centimètres).
	inline PointUE versUnreal(double x, double y, double z = 0.0)
	{
		return { (52.5 - y) * 100.0, (x - 34.0) * 100.0, z * 100.0 };
	}

	// L'inverse : un point d'Unreal (centimètres) dans le repère du moteur (mètres).
	inline void depuisUnreal(const PointUE& p, double& x, double& y, double& z)
	{
		x = p.Y / 100.0 + 34.0;
		y = 52.5 - p.X / 100.0;
		z = p.Z / 100.0;
	}

	// Un vecteur (vitesse, accélération) : la même rotation, sans décalage d'origine.
	inline PointUE vecteurVersUnreal(double vx, double vy, double vz = 0.0)
	{
		return { -vy * 100.0, vx * 100.0, vz * 100.0 };
	}

	// L'orientation du moteur (radians) en lacet Unreal (degrés, −180 à 180).
	inline double lacetUnrealRad(double angle)
	{
		return std::atan2(std::cos(angle), -std::sin(angle)) * kDegParRad;
	}

	// L'orientation telle qu'écrite dans les images (milliradians).
	inline double lacetUnreal(double angleMrad)
	{
		return lacetUnrealRad(angleMrad / 1000.0);
	}

	// La direction d'un vecteur du moteur, en lacet Unreal (degrés).
	inline double lacetDirection(double vx, double vy)
	{
		return std::atan2(vx, -vy) * kDegParRad;
	}

	// Ramène un angle en degrés dans ]−180, 180].
	inline double angleNormaliseDeg(double a)
	{
		a = std::fmod(a, 360.0);
		if (a <= -180.0)
		{
			a += 360.0;
		}
		else if (a > 180.0)
		{
			a -= 360.0;
		}
		return a;
	}

	// Ramène un angle en radians dans ]−π, π].
	inline double angleNormaliseRad(double a)
	{
		a = std::fmod(a, 2.0 * kPiLF);
		if (a <= -kPiLF)
		{
			a += 2.0 * kPiLF;
		}
		else if (a > kPiLF)
		{
			a -= 2.0 * kPiLF;
		}
		return a;
	}
}
