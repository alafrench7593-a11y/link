// LinkFoot, cœur portable : les détecteurs qui disent quand l'écran ment (§72 à §75).
//
//   - DetecteurDesynchro : la position du personnage dans Unreal contre celle du moteur.
//     Le contrat de la passerelle tolère 30 cm pendant 0,2 s ; au-delà, DESYNC.
//   - DetecteurDesynchroAnimation : la famille d'animation jouée contre celle que le moteur
//     attend (le moteur dit « contrôle », Unreal joue un sprint : ANIMATION DESYNC).
//   - DetecteurPied : un pied posé qui glisse, flotte ou s'enfonce (FOOT SLIDE WARNING).
//   - DetecteurMouvement : accélération ou freinage instantanés, téléportation, pic de
//     vitesse, rotation impossible, pieds qui reculent quand le corps avance.
//   - DetecteurContact : au contact du moteur, la partie du corps qui joue (pied, tête, mains)
//     touche-t-elle le ballon (§82) ? Sinon : CONTACT MANQUÉ.
//
// Ils ne savent rien d'Unreal : on leur donne des nombres à chaque image rendue. La couche
// Unreal (module LinkFootDebug) les nourrit et affiche leur verdict ; les tests du cœur les
// nourrissent avec le moteur lui-même, pour vérifier que ce que le moteur envoie ne déclenche
// pas d'alerte à lui seul.
#pragma once

#include "LFCore/LFFamilles.h"

#include <array>
#include <cstdint>
#include <string>

namespace lf
{
	enum class Statut : std::uint8_t
	{
		Ok,
		Alerte,		// hors tolérance, pas encore assez longtemps
		Desynchro	// hors tolérance assez longtemps : l'écran ne montre plus le match
	};

	LFCORE_API const char* nomStatut(Statut s);

	struct SeuilsDesynchro
	{
		double toleranceM = 0.30;
		double dureeS = 0.20;
	};

	// §72 Positions en mètres, repère du moteur (convertir avec depuisUnreal).
	class LFCORE_API DetecteurDesynchro
	{
	public:
		explicit DetecteurDesynchro(const SeuilsDesynchro& s = {});
		Statut ajouter(double t, double simX, double simY, double vuX, double vuY);
		void reinitialiser();
		Statut statut() const { return statut_; }
		double ecart() const { return ecart_; }
		double ecartMax() const { return ecartMax_; }
		int desynchros() const { return desynchros_; }

	private:
		SeuilsDesynchro s_;
		Statut statut_ = Statut::Ok;
		double ecart_ = 0.0;
		double ecartMax_ = 0.0;
		double debutHors_ = -1.0;
		int desynchros_ = 0;
	};

	// §73
	class LFCORE_API DetecteurDesynchroAnimation
	{
	public:
		explicit DetecteurDesynchroAnimation(double dureeS = 0.30);
		Statut ajouter(double t, Famille attendue, Famille vue);
		void reinitialiser();
		Statut statut() const { return statut_; }
		Famille attendue() const { return attendue_; }
		Famille vue() const { return vue_; }
		int desynchros() const { return desynchros_; }
		double tempsHorsAccord() const { return tempsHors_; }
		double tempsTotal() const { return tempsTotal_; }

	private:
		double duree_;
		Statut statut_ = Statut::Ok;
		Famille attendue_ = Famille::Inconnue;
		Famille vue_ = Famille::Inconnue;
		double debutHors_ = -1.0;
		double dernierT_ = -1.0;
		double tempsHors_ = 0.0;
		double tempsTotal_ = 0.0;
		int desynchros_ = 0;
	};

	struct SeuilsPied
	{
		double hauteurContactCm = 3.0;	// sous cette hauteur, le pied est au sol
		double glissementCmS = 15.0;	// un pied au sol qui va plus vite glisse
		double dureeS = 0.10;			// pendant au moins cette durée
		double penetrationCm = 2.0;		// sous le sol
		double flottementCm = 4.0;		// annoncé posé par l'animation mais au-dessus du sol
	};

	enum class DefautPied : std::uint8_t
	{
		Aucun,
		Glissement,
		Flottement,
		Penetration
	};

	LFCORE_API const char* nomDefautPied(DefautPied d);

	// §74 Positions en centimètres (Unreal). contactAnnonce : -1 inconnu, 0 levé, 1 posé
	// (d'après une courbe de l'animation, si elle en a une).
	class LFCORE_API DetecteurPied
	{
	public:
		explicit DetecteurPied(const SeuilsPied& s = {});
		DefautPied ajouter(double t, double xCm, double yCm, double zCm, double solCm, int contactAnnonce = -1);
		void reinitialiser();
		DefautPied defaut() const { return defaut_; }
		double vitesseAuSolCmS() const { return vitesseAuSol_; }
		int compte(DefautPied d) const { return comptes_[static_cast<std::size_t>(d)]; }

	private:
		SeuilsPied s_;
		DefautPied defaut_ = DefautPied::Aucun;
		bool aPrecedent_ = false;
		bool precedentAuSol_ = false;
		double tPrec_ = 0.0, xPrec_ = 0.0, yPrec_ = 0.0;
		double debutGlisse_ = -1.0;
		double vitesseAuSol_ = 0.0;
		std::array<int, 4> comptes_{};
	};

	struct SeuilsMouvement
	{
		double accelerationMax = 14.0;	// m/s², le seuil de verifierPont (contrat §55)
		double teleportationMS = 40.0;	// m/s : 4 m en un pas de 0,1 s, comme verifierPont
		double vitesseMax = 12.5;		// m/s : aucun humain ne va plus vite
		double picVitesse = 2.5;		// m/s : la vitesse monte puis retombe d'autant
		double rotationMaxDegS = 720.0;	// °/s pour le corps...
		double vitesseRotation = 4.0;	// ... au-delà de cette vitesse de course
		double piedsCorpsS = 0.25;		// s de pieds qui reculent pendant que le corps avance
	};

	enum class Anomalie : std::uint8_t
	{
		Aucune,
		AccelerationInstantanee,
		FreinageInstantane,
		Teleportation,
		PicVitesse,
		VitesseImpossible,
		RotationImpossible,
		PiedsCorps
	};

	LFCORE_API const char* nomAnomalie(Anomalie a);

	// §75 Positions en mètres (repère du moteur), lacet en degrés.
	class LFCORE_API DetecteurMouvement
	{
	public:
		explicit DetecteurMouvement(const SeuilsMouvement& s = {});
		Anomalie ajouter(double t, double x, double y, double lacetDeg);
		// Vitesses horizontales (m/s) du corps et des deux pieds, dans le même repère.
		Anomalie ajouterPieds(double t, double vCorpsX, double vCorpsY, double vPiedGX, double vPiedGY, double vPiedDX, double vPiedDY);
		// Une coupe voulue (coup d'envoi, remplacement) : on repart de zéro.
		void couper();
		int compte(Anomalie a) const { return comptes_[static_cast<std::size_t>(a)]; }
		int total() const;
		Anomalie derniere() const { return derniere_; }
		double instantDerniere() const { return instantDerniere_; }

	private:
		SeuilsMouvement s_;
		int n_ = 0;	// échantillons depuis la dernière coupe
		double t_[3]{}, x_[3]{}, y_[3]{}, lacet_[3]{};
		double debutPieds_ = -1.0;
		bool piedsSignales_ = false;
		Anomalie derniere_ = Anomalie::Aucune;
		double instantDerniere_ = -1.0;
		std::array<int, 8> comptes_{};
		Anomalie signaler(Anomalie a, double t);
	};

	// Le contrat de la passerelle (docs/passerelle-ue5.md, §7) : le contact se voit à 0,05 s et
	// 15 cm du point et de l'instant du moteur.
	struct SeuilsContact
	{
		double ecartCm = 15.0;		// de la partie du corps à la surface du ballon...
		double fenetreS = 0.05;		// ... à un instant situé à 0,05 s au plus du contact du moteur
	};

	enum class VerdictContact : std::uint8_t
	{
		Rien,		// pas de verdict à cette image
		Touche,		// la partie du corps est allée au ballon dans la fenêtre
		Manque,		// elle est restée loin pendant toute la fenêtre : CONTACT MANQUÉ
		NonJuge		// aucune image dans la fenêtre (images trop espacées) : on ne sait pas
	};

	LFCORE_API const char* nomVerdictContact(VerdictContact v);

	// §82 À chaque image : le contact suivi (son index d'action, LFContact.h), le temps qu'il reste
	// avant lui (négatif après) et l'écart en centimètres entre la partie du corps qui joue et la
	// surface du ballon au point du contact (distance au centre du ballon, moins son rayon). Le
	// plus petit écart vu dans la fenêtre est retenu ; le verdict tombe quand la fenêtre est passée,
	// ou quand le contact suivi change.
	class LFCORE_API DetecteurContact
	{
	public:
		explicit DetecteurContact(const SeuilsContact& s = {});
		VerdictContact ajouter(int action, double dans, double ecartCm);
		// Plus de contact annoncé pour ce joueur : le contact en cours est jugé avec ce qu'on a vu.
		VerdictContact aucun();
		// Une coupe voulue (coup d'envoi, remplacement) : le contact en cours est oublié.
		void reinitialiser();
		int juges() const { return juges_; }
		int manques() const { return manques_; }
		int nonJuges() const { return nonJuges_; }
		double dernierEcartCm() const { return dernierEcart_; }
		double pireEcartCm() const { return pireEcart_; }

	private:
		SeuilsContact s_;
		int action_ = -1;
		bool vu_ = false;
		bool clos_ = true;
		double meilleur_ = 0.0;
		int juges_ = 0;
		int manques_ = 0;
		int nonJuges_ = 0;
		double dernierEcart_ = 0.0;
		double pireEcart_ = 0.0;
		VerdictContact clore();
	};

	// La porte de qualité d'une scène (cahier « qualité visuelle » §20 et §31) : ce que les
	// détecteurs ont compté pendant qu'on la regardait, et le verdict. Un pied qui glisse est une
	// porte dure (§20) : la scène ne passe pas, comme une désynchronisation (l'écran ne montre
	// plus le match). Le reste se reprend : contacts manqués (tant que les gestes de football ne
	// sont pas capturés), animation en désaccord avec le moteur, mouvement impossible, ou un
	// contrôle incomplet faute de savoir quelle animation est jouée.
	struct BilanQualite
	{
		int desynchros = 0;
		int desynchrosAnimation = 0;
		int glissementsPied = 0;
		int mouvementsImpossibles = 0;
		int contactsJuges = 0;
		int contactsManques = 0;
		bool animationSignalee = true;

		BilanQualite& operator+=(const BilanQualite& autre);
	};

	enum class VerdictQualite : std::uint8_t
	{
		Valide,
		AReprendre,
		NePasLivrer		// DO NOT SHIP (§31)
	};

	struct ResultatQualite
	{
		VerdictQualite verdict = VerdictQualite::Valide;
		std::string raisons;	// en clair, séparées par « ; » (UTF-8)
	};

	LFCORE_API ResultatQualite porteQualite(const BilanQualite& b);
	LFCORE_API const char* nomVerdictQualite(VerdictQualite v);
}
