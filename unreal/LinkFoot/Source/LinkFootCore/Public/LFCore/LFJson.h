// LinkFoot, cœur portable : un lecteur JSON sans dépendance.
//
// Pourquoi pas FJsonSerializer : un match complet pèse une vingtaine de mégaoctets, dont
// presque tout est un tableau de nombres (dix images par seconde, 144 entiers par image).
// FJsonObject alloue une valeur partagée par nombre, soit des millions d'allocations. Ici,
// un tableau qui ne contient que des nombres est rangé à plat (Genre::Nombres) : le
// document entier se lit en une fraction de seconde. Et le même code tourne dans Unreal et
// dans les tests compilés hors d'Unreal : une seule façon de lire le match.
//
// Pas d'exception, pas de RTTI, pas d'en-tête d'Unreal : ce fichier compile tel quel dans
// un module Unreal (C++20) comme avec g++ ou clang.
#pragma once

#include "LFCore/LFExport.h"

#include <cstddef>
#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

namespace lf::json
{
	enum class Genre : std::uint8_t
	{
		Nul,
		Booleen,
		Nombre,
		Texte,
		Tableau,	// tableau quelconque : elements
		Objet,		// membres, dans l'ordre du texte
		Nombres		// tableau qui ne contient que des nombres : nombres, rangés à plat
	};

	struct Membre;

	struct LFCORE_API Valeur
	{
		Genre genre = Genre::Nul;
		bool booleen = false;
		double nombre = 0.0;
		std::string texte;
		std::vector<Valeur> elements;
		std::vector<Membre> membres;
		std::vector<double> nombres;

		bool estNul() const { return genre == Genre::Nul; }
		bool estNombre() const { return genre == Genre::Nombre; }
		bool estTexte() const { return genre == Genre::Texte; }
		bool estObjet() const { return genre == Genre::Objet; }
		bool estBooleen() const { return genre == Genre::Booleen; }
		bool estTableau() const { return genre == Genre::Tableau || genre == Genre::Nombres; }

		// Nombre d'éléments d'un tableau (rangé à plat ou non), de membres d'un objet.
		std::size_t taille() const;
		// Le membre « cle » d'un objet, ou nullptr.
		const Valeur* champ(std::string_view cle) const;
		// L'élément i d'un tableau quelconque, ou nullptr (un tableau de nombres se lit avec nombreA).
		const Valeur* element(std::size_t i) const;
		// L'élément i d'un tableau de nombres, rangé à plat ou non.
		double nombreA(std::size_t i, double defaut = 0.0) const;

		double nombreOu(std::string_view cle, double defaut) const;
		bool booleenOu(std::string_view cle, bool defaut) const;
		std::string texteOu(std::string_view cle, std::string_view defaut) const;
	};

	struct Membre
	{
		std::string cle;
		Valeur valeur;
	};

	struct ResultatLecture
	{
		bool ok = false;
		std::string erreur;
		std::size_t position = 0;	// octet où la lecture s'est arrêtée
	};

	// Lit un texte JSON (UTF-8, RFC 8259). Un BOM en tête est ignoré.
	LFCORE_API ResultatLecture lire(std::string_view texte, Valeur& sortie);
}
