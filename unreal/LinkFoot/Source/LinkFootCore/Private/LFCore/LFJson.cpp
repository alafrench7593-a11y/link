#include "LFCore/LFJson.h"

#include <cstdlib>
#include <utility>

namespace lf::json
{
	std::size_t Valeur::taille() const
	{
		switch (genre)
		{
		case Genre::Tableau: return elements.size();
		case Genre::Nombres: return nombres.size();
		case Genre::Objet: return membres.size();
		default: return 0;
		}
	}

	const Valeur* Valeur::champ(std::string_view cle) const
	{
		if (genre != Genre::Objet)
		{
			return nullptr;
		}
		for (const Membre& m : membres)
		{
			if (m.cle == cle)
			{
				return &m.valeur;
			}
		}
		return nullptr;
	}

	const Valeur* Valeur::element(std::size_t i) const
	{
		if (genre != Genre::Tableau || i >= elements.size())
		{
			return nullptr;
		}
		return &elements[i];
	}

	double Valeur::nombreA(std::size_t i, double defaut) const
	{
		if (genre == Genre::Nombres)
		{
			return i < nombres.size() ? nombres[i] : defaut;
		}
		if (genre == Genre::Tableau && i < elements.size() && elements[i].genre == Genre::Nombre)
		{
			return elements[i].nombre;
		}
		return defaut;
	}

	double Valeur::nombreOu(std::string_view cle, double defaut) const
	{
		const Valeur* v = champ(cle);
		if (!v)
		{
			return defaut;
		}
		if (v->genre == Genre::Nombre)
		{
			return v->nombre;
		}
		if (v->genre == Genre::Booleen)
		{
			return v->booleen ? 1.0 : 0.0;
		}
		return defaut;
	}

	bool Valeur::booleenOu(std::string_view cle, bool defaut) const
	{
		const Valeur* v = champ(cle);
		if (!v)
		{
			return defaut;
		}
		if (v->genre == Genre::Booleen)
		{
			return v->booleen;
		}
		if (v->genre == Genre::Nombre)
		{
			return v->nombre != 0.0;
		}
		return defaut;
	}

	std::string Valeur::texteOu(std::string_view cle, std::string_view defaut) const
	{
		const Valeur* v = champ(cle);
		if (v && v->genre == Genre::Texte)
		{
			return v->texte;
		}
		return std::string(defaut);
	}

	namespace
	{
		constexpr int kProfondeurMaxJson = 256;

		// 10^0 à 10^22 sont exacts en double : multiplier ou diviser une mantisse entière
		// d'au plus 2^53 par l'un d'eux donne le double le plus proche (voie rapide de Clinger).
		constexpr double kPuissancesDixJson[23] = {
			1e0, 1e1, 1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11,
			1e12, 1e13, 1e14, 1e15, 1e16, 1e17, 1e18, 1e19, 1e20, 1e21, 1e22 };

		void ajouterUtf8Json(std::string& s, std::uint32_t cp)
		{
			if (cp < 0x80)
			{
				s.push_back(static_cast<char>(cp));
			}
			else if (cp < 0x800)
			{
				s.push_back(static_cast<char>(0xC0 | (cp >> 6)));
				s.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
			}
			else if (cp < 0x10000)
			{
				s.push_back(static_cast<char>(0xE0 | (cp >> 12)));
				s.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3F)));
				s.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
			}
			else
			{
				s.push_back(static_cast<char>(0xF0 | (cp >> 18)));
				s.push_back(static_cast<char>(0x80 | ((cp >> 12) & 0x3F)));
				s.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3F)));
				s.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
			}
		}

		class LecteurJson
		{
		public:
			LecteurJson(const char* debut, const char* fin) : debut_(debut), p_(debut), fin_(fin) {}

			bool document(Valeur& v)
			{
				if (fin_ - p_ >= 3 && static_cast<unsigned char>(p_[0]) == 0xEF && static_cast<unsigned char>(p_[1]) == 0xBB
					&& static_cast<unsigned char>(p_[2]) == 0xBF)
				{
					p_ += 3;
				}
				if (!valeur(v, 0))
				{
					return false;
				}
				blancs();
				if (p_ != fin_)
				{
					return echec("texte après la fin du document");
				}
				return true;
			}

			std::size_t position() const { return static_cast<std::size_t>(p_ - debut_); }
			const std::string& erreur() const { return erreur_; }

		private:
			const char* debut_;
			const char* p_;
			const char* fin_;
			std::string erreur_;

			bool echec(const char* message)
			{
				if (erreur_.empty())
				{
					erreur_ = message;
				}
				return false;
			}

			void blancs()
			{
				while (p_ < fin_ && (*p_ == ' ' || *p_ == '\n' || *p_ == '\r' || *p_ == '\t'))
				{
					++p_;
				}
			}

			static bool estChiffre(char c) { return c >= '0' && c <= '9'; }
			static bool debutNombre(char c) { return c == '-' || estChiffre(c); }

			bool mot(const char* attendu, std::size_t n)
			{
				if (static_cast<std::size_t>(fin_ - p_) < n)
				{
					return echec("mot-clé tronqué");
				}
				for (std::size_t i = 0; i < n; ++i)
				{
					if (p_[i] != attendu[i])
					{
						return echec("mot-clé inconnu");
					}
				}
				p_ += n;
				return true;
			}

			bool valeur(Valeur& v, int profondeur)
			{
				if (profondeur > kProfondeurMaxJson)
				{
					return echec("imbrication trop profonde");
				}
				blancs();
				if (p_ >= fin_)
				{
					return echec("valeur attendue");
				}
				const char c = *p_;
				if (c == '{')
				{
					return objet(v, profondeur);
				}
				if (c == '[')
				{
					return tableau(v, profondeur);
				}
				if (c == '"')
				{
					v.genre = Genre::Texte;
					return texte(v.texte);
				}
				if (c == 't')
				{
					v.genre = Genre::Booleen;
					v.booleen = true;
					return mot("true", 4);
				}
				if (c == 'f')
				{
					v.genre = Genre::Booleen;
					v.booleen = false;
					return mot("false", 5);
				}
				if (c == 'n')
				{
					v.genre = Genre::Nul;
					return mot("null", 4);
				}
				if (debutNombre(c))
				{
					v.genre = Genre::Nombre;
					return nombre(v.nombre);
				}
				return echec("caractère inattendu");
			}

			bool nombre(double& d)
			{
				const char* depart = p_;
				bool negatif = false;
				if (*p_ == '-')
				{
					negatif = true;
					++p_;
				}
				if (p_ >= fin_)
				{
					return echec("nombre tronqué");
				}
				std::uint64_t mantisse = 0;
				int chiffres = 0;
				int exposant = 0;
				bool tropDeChiffres = false;
				if (*p_ == '0')
				{
					++p_;
				}
				else if (estChiffre(*p_))
				{
					while (p_ < fin_ && estChiffre(*p_))
					{
						if (chiffres < 19)
						{
							mantisse = mantisse * 10u + static_cast<std::uint64_t>(*p_ - '0');
							++chiffres;
						}
						else
						{
							++exposant;
							tropDeChiffres = true;
						}
						++p_;
					}
				}
				else
				{
					return echec("nombre invalide");
				}
				if (p_ < fin_ && *p_ == '.')
				{
					++p_;
					if (p_ >= fin_ || !estChiffre(*p_))
					{
						return echec("décimales manquantes");
					}
					while (p_ < fin_ && estChiffre(*p_))
					{
						if (chiffres < 19)
						{
							mantisse = mantisse * 10u + static_cast<std::uint64_t>(*p_ - '0');
							++chiffres;
							--exposant;
						}
						else
						{
							tropDeChiffres = true;
						}
						++p_;
					}
				}
				if (p_ < fin_ && (*p_ == 'e' || *p_ == 'E'))
				{
					++p_;
					bool exposantNegatif = false;
					if (p_ < fin_ && (*p_ == '+' || *p_ == '-'))
					{
						exposantNegatif = *p_ == '-';
						++p_;
					}
					if (p_ >= fin_ || !estChiffre(*p_))
					{
						return echec("exposant invalide");
					}
					int e = 0;
					while (p_ < fin_ && estChiffre(*p_))
					{
						if (e < 100000)
						{
							e = e * 10 + (*p_ - '0');
						}
						++p_;
					}
					exposant += exposantNegatif ? -e : e;
				}
				if (!tropDeChiffres && mantisse <= (std::uint64_t(1) << 53) && exposant >= -22 && exposant <= 22)
				{
					double r = static_cast<double>(mantisse);
					if (exposant < 0)
					{
						r /= kPuissancesDixJson[-exposant];
					}
					else
					{
						r *= kPuissancesDixJson[exposant];
					}
					d = negatif ? -r : r;
					return true;
				}
				// Rare dans un document LinkFoot : on laisse strtod arrondir.
				const std::string copie(depart, static_cast<std::size_t>(p_ - depart));
				d = std::strtod(copie.c_str(), nullptr);
				return true;
			}

			bool hex4(std::uint32_t& sortie)
			{
				if (fin_ - p_ < 4)
				{
					return echec("échappement \\u tronqué");
				}
				std::uint32_t v = 0;
				for (int i = 0; i < 4; ++i)
				{
					const char c = *p_++;
					v <<= 4;
					if (c >= '0' && c <= '9')
					{
						v |= static_cast<std::uint32_t>(c - '0');
					}
					else if (c >= 'a' && c <= 'f')
					{
						v |= static_cast<std::uint32_t>(c - 'a' + 10);
					}
					else if (c >= 'A' && c <= 'F')
					{
						v |= static_cast<std::uint32_t>(c - 'A' + 10);
					}
					else
					{
						return echec("chiffre hexadécimal attendu");
					}
				}
				sortie = v;
				return true;
			}

			bool texte(std::string& s)
			{
				++p_;	// le guillemet ouvrant
				const char* morceau = p_;
				while (true)
				{
					if (p_ >= fin_)
					{
						return echec("texte non terminé");
					}
					const unsigned char c = static_cast<unsigned char>(*p_);
					if (c == '"')
					{
						s.append(morceau, p_);
						++p_;
						return true;
					}
					if (c < 0x20)
					{
						return echec("caractère de contrôle dans un texte");
					}
					if (c != '\\')
					{
						++p_;
						continue;
					}
					s.append(morceau, p_);
					++p_;
					if (p_ >= fin_)
					{
						return echec("échappement tronqué");
					}
					const char e = *p_++;
					switch (e)
					{
					case '"': s.push_back('"'); break;
					case '\\': s.push_back('\\'); break;
					case '/': s.push_back('/'); break;
					case 'b': s.push_back('\b'); break;
					case 'f': s.push_back('\f'); break;
					case 'n': s.push_back('\n'); break;
					case 'r': s.push_back('\r'); break;
					case 't': s.push_back('\t'); break;
					case 'u':
					{
						std::uint32_t cp = 0;
						if (!hex4(cp))
						{
							return false;
						}
						if (cp >= 0xD800 && cp <= 0xDBFF)
						{
							if (fin_ - p_ < 6 || p_[0] != '\\' || p_[1] != 'u')
							{
								return echec("paire de substitution incomplète");
							}
							p_ += 2;
							std::uint32_t bas = 0;
							if (!hex4(bas))
							{
								return false;
							}
							if (bas < 0xDC00 || bas > 0xDFFF)
							{
								return echec("paire de substitution invalide");
							}
							cp = 0x10000 + ((cp - 0xD800) << 10) + (bas - 0xDC00);
						}
						else if (cp >= 0xDC00 && cp <= 0xDFFF)
						{
							return echec("substitution isolée");
						}
						ajouterUtf8Json(s, cp);
						break;
					}
					default:
						return echec("échappement inconnu");
					}
					morceau = p_;
				}
			}

			// La suite d'un tableau quelconque : des valeurs jusqu'au crochet fermant.
			bool suiteTableau(Valeur& v, int profondeur)
			{
				while (true)
				{
					Valeur e;
					if (!valeur(e, profondeur + 1))
					{
						return false;
					}
					v.elements.push_back(std::move(e));
					blancs();
					if (p_ >= fin_)
					{
						return echec("tableau non terminé");
					}
					if (*p_ == ']')
					{
						++p_;
						return true;
					}
					if (*p_ != ',')
					{
						return echec("virgule attendue dans un tableau");
					}
					++p_;
				}
			}

			bool tableau(Valeur& v, int profondeur)
			{
				++p_;	// le crochet ouvrant
				blancs();
				v.genre = Genre::Tableau;
				if (p_ < fin_ && *p_ == ']')
				{
					++p_;
					return true;
				}
				if (p_ >= fin_ || !debutNombre(*p_))
				{
					return suiteTableau(v, profondeur);
				}
				// Rangé à plat tant que tout est nombre : c'est le cas des images du match.
				v.genre = Genre::Nombres;
				while (true)
				{
					double d = 0.0;
					if (!nombre(d))
					{
						return false;
					}
					v.nombres.push_back(d);
					blancs();
					if (p_ >= fin_)
					{
						return echec("tableau non terminé");
					}
					if (*p_ == ']')
					{
						++p_;
						return true;
					}
					if (*p_ != ',')
					{
						return echec("virgule attendue dans un tableau");
					}
					++p_;
					blancs();
					if (p_ < fin_ && debutNombre(*p_))
					{
						continue;
					}
					// Un élément qui n'est pas un nombre : le tableau redevient quelconque.
					v.genre = Genre::Tableau;
					v.elements.reserve(v.nombres.size() + 4);
					for (const double n : v.nombres)
					{
						Valeur e;
						e.genre = Genre::Nombre;
						e.nombre = n;
						v.elements.push_back(std::move(e));
					}
					v.nombres.clear();
					v.nombres.shrink_to_fit();
					return suiteTableau(v, profondeur);
				}
			}

			bool objet(Valeur& v, int profondeur)
			{
				++p_;	// l'accolade ouvrante
				v.genre = Genre::Objet;
				blancs();
				if (p_ < fin_ && *p_ == '}')
				{
					++p_;
					return true;
				}
				while (true)
				{
					blancs();
					if (p_ >= fin_ || *p_ != '"')
					{
						return echec("clé attendue");
					}
					Membre m;
					if (!texte(m.cle))
					{
						return false;
					}
					blancs();
					if (p_ >= fin_ || *p_ != ':')
					{
						return echec("deux-points attendus");
					}
					++p_;
					if (!valeur(m.valeur, profondeur + 1))
					{
						return false;
					}
					v.membres.push_back(std::move(m));
					blancs();
					if (p_ >= fin_)
					{
						return echec("objet non terminé");
					}
					if (*p_ == '}')
					{
						++p_;
						return true;
					}
					if (*p_ != ',')
					{
						return echec("virgule attendue dans un objet");
					}
					++p_;
				}
			}
		};
	}

	ResultatLecture lire(std::string_view texte, Valeur& sortie)
	{
		ResultatLecture r;
		sortie = Valeur{};
		LecteurJson lecteur(texte.data(), texte.data() + texte.size());
		r.ok = lecteur.document(sortie);
		r.position = lecteur.position();
		if (!r.ok)
		{
			r.erreur = lecteur.erreur();
		}
		return r;
	}
}
