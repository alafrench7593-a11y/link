// Un cadre de test minuscule : des vérifications nommées, comptées, lisibles d'un coup
// d'œil (le même style que test/*.js côté JavaScript).
#pragma once

#include <cstdio>
#include <string>

namespace lft
{
	inline int& reussies()
	{
		static int n = 0;
		return n;
	}

	inline int& echouees()
	{
		static int n = 0;
		return n;
	}

	inline void titre(const std::string& s)
	{
		std::printf("\n%s\n", s.c_str());
	}

	inline bool verifier(const std::string& nom, bool condition, const std::string& detail = std::string())
	{
		const std::string suite = detail.empty() ? std::string() : "  (" + detail + ")";
		std::printf("%s %s%s\n", condition ? "  ok   " : "  ÉCHEC", nom.c_str(), suite.c_str());
		if (condition)
		{
			++reussies();
		}
		else
		{
			++echouees();
		}
		return condition;
	}

	inline void constat(const std::string& nom, const std::string& detail = std::string())
	{
		const std::string suite = detail.empty() ? std::string() : "  (" + detail + ")";
		std::printf("  constat %s%s\n", nom.c_str(), suite.c_str());
	}

	inline std::string nombre(double v, int decimales = 2)
	{
		char tampon[64];
		std::snprintf(tampon, sizeof(tampon), "%.*f", decimales, v);
		return tampon;
	}
}
