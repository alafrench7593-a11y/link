// LinkFoot dans Unreal : l'animation d'un footballeur (le premier joueur réaliste, §78).
//
// La classe C++ des Animation Blueprint des footballeurs. Elle ne joue aucune animation : elle
// donne au graphe, à chaque image, ce que le moteur LinkFoot a joué, sous la forme qu'attendent
// les nœuds d'Unreal 5.8.
//
//   Motion Matching (§8, §15, §16)  Trajectoire : le vrai passé et le vrai futur du joueur
//       (FTransformTrajectory), à brancher sur la broche « Trajectory » du nœud Pose History,
//       génération de trajectoire désactivée. Le futur n'est pas prédit : le moteur l'a joué.
//   Locomotion (§11 à §14)          Vitesse, AngleLocomotion (Orientation Warping), Bande, Phase,
//       Allure, Virage (le choix des bases de mouvements) ; VitesseLocomotion (Stride Warping).
//   Regard (§26, §27)               CibleRegard : nœud Look At (ou Control Rig), séparé du corps.
//   Ballon (§22, §23, §82)          le prochain contact : genre, surface, pied, temps restant,
//       point dans le repère du corps et dans le monde, poids d'IK qui monte jusqu'au contact.
//   Fatigue (§37)                   Energie et bFatigue : une couche de posture.
//   Désynchronisation (§73)         FamilleAttendue (ce que fait le moteur) ; FamilleVue, que le
//       graphe renseigne après la recherche de Motion Matching (SignalerAnimationChoisie).
// Et, pour le cahier « qualité visuelle » :
//   §4   la tête et les yeux séparés du corps (LacetTete, LacetYeux...) ;
//   §17  le type de course (TypeCourse), pour choisir la base de mouvements ;
//   §19 §21 la foulée de ce corps (LongueurPas, Cadence) et l'inclinaison du buste ;
//   §24  le souffle et la posture de fatigue ; §3 la sueur et la pluie (paramètres de matériau) ;
//   §25 §26 les expressions du visage (poids de 0 à 1) et le geste du haut du corps ;
//   §27  le caractère du joueur, qui règle l'amplitude des gestes.
//
// Tout se lit dans le cœur portable, testé hors d'Unreal (unreal/tests-coeur).
#pragma once

#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "Animation/TrajectoryTypes.h"

#include "LFTypes.h"

#include "LFCore/LFCinematique.h"
#include "LFCore/LFTrajectoire.h"

#include "LFAnimInstanceFootballeur.generated.h"

class ALFFootballeur;

UCLASS(Transient, Blueprintable)
class LINKFOOTPLAYER_API ULFAnimInstanceFootballeur : public UAnimInstance
{
	GENERATED_BODY()

public:
	virtual void NativeInitializeAnimation() override;
	virtual void NativeUpdateAnimation(float DeltaSeconds) override;

	// --- §15 Motion Matching ---------------------------------------------------------------

	// Le passé et le futur réels du joueur, dans le repère du monde. Échantillon de temps 0 :
	// l'image précédente du rendu (la convention du nœud Pose History).
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Motion Matching")
	FTransformTrajectory Trajectoire;

	// Les valeurs par défaut de UPoseSearchTrajectoryLibrary (UE 5.8) : 10 échantillons de
	// passé toutes les 0,04 s, 8 de futur toutes les 0,2 s.
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "LinkFoot|Motion Matching")
	int32 EchantillonsPasse = 10;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "LinkFoot|Motion Matching")
	float PasPasse = 0.04f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "LinkFoot|Motion Matching")
	int32 EchantillonsFutur = 8;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "LinkFoot|Motion Matching")
	float PasFutur = 0.2f;

	// Si l'affichage de la trajectoire montre l'orientation tournée d'un quart de tour par rapport
	// au corps, ce décalage (degrés) la corrige (selon l'orientation du maillage).
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "LinkFoot|Motion Matching")
	float DecalageLacetTrajectoire = 0.f;

	// --- §11 à §14 locomotion -----------------------------------------------------------------

	// cm/s
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Locomotion")
	float Vitesse = 0.f;

	// la vitesse de pointe du joueur dans le moteur (cm/s)
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Locomotion")
	float VitesseMax = 900.f;

	// vitesse / vitesse de pointe (0 à 1)
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Locomotion")
	float Effort = 0.f;

	// pour le nœud Stride Warping (Locomotion Speed), cm/s
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Locomotion")
	float VitesseLocomotion = 0.f;

	// le long du mouvement, cm/s² : positif accélère, négatif freine
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Locomotion")
	float AccelerationLongitudinale = 0.f;

	// le mouvement par rapport au corps, degrés (0 : vers l'avant, + : à droite) : nœud Orientation Warping
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Locomotion")
	float AngleLocomotion = 0.f;

	// le changement de cap des 0,6 s à venir, degrés
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Locomotion")
	float VirageDeg = 0.f;

	// cm ; très grand en ligne droite
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Locomotion")
	float RayonVirage = 1.e9f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Locomotion")
	ELFBandeVitesse Bande = ELFBandeVitesse::Arret;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Locomotion")
	ELFPhaseVitesse Phase = ELFPhaseVitesse::Stable;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Locomotion")
	ELFAllure Allure = ELFAllure::Avant;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Locomotion")
	ELFVirage Virage = ELFVirage::Aucun;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Locomotion")
	bool bSprintVoulu = false;

	// §17 (qualité visuelle) la bibliothèque de locomotion
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Locomotion")
	ELFTypeCourse TypeCourse = ELFTypeCourse::Immobile;

	// §19 §21 la foulée de ce corps : un pas (cm), des pas par seconde, le buste (degrés, + en avant)
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Locomotion")
	float LongueurPas = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Locomotion")
	float Cadence = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Locomotion")
	float InclinaisonBuste = 0.f;

	// Le moteur a replacé le joueur cette image (coup d'envoi, remise en jeu, entrée en jeu).
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Locomotion")
	bool bCoupe = false;

	// --- §37 fatigue ------------------------------------------------------------------------

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Fatigue")
	float Energie = 100.f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Fatigue")
	bool bFatigue = false;

	// --- §26 §27 regard ---------------------------------------------------------------------

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Regard")
	bool bRegardValide = false;

	// point du monde à regarder (cm)
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Regard")
	FVector CibleRegard = FVector::ZeroVector;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Regard")
	ELFSourceRegard SourceRegard = ELFSourceRegard::Ballon;

	// §4 (qualité visuelle) la tête par rapport au corps, les yeux par rapport à la tête,
	// degrés : + à droite (le sens du lacet), + vers le haut
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Regard")
	float LacetTete = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Regard")
	float TangageTete = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Regard")
	float LacetYeux = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Regard")
	float TangageYeux = 0.f;

	// la cible est derrière lui : tête et yeux au bout de leur course
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Regard")
	bool bCibleHorsDeVue = false;

	// --- §25 §26 le visage et le geste ----------------------------------------------------------

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Visage")
	float PoidsConcentration = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Visage")
	float PoidsFrustration = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Visage")
	float PoidsJoie = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Visage")
	float PoidsColere = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Visage")
	float PoidsDouleur = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Visage")
	float PoidsSurprise = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Visage")
	float PoidsSoulagement = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Visage")
	float PoidsFatigueVisage = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Visage")
	ELFExpression ExpressionDominante = ELFExpression::Concentration;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Visage")
	ELFGeste Geste = ELFGeste::Aucun;

	// 0 à 1 : monte, tient, retombe
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Visage")
	float PoidsGeste = 0.f;

	// secondes depuis le début du geste
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Visage")
	float TempsGeste = 0.f;

	// --- §3 §24 le souffle, la sueur ------------------------------------------------------------

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Physiologie")
	float Essoufflement = 0.f;

	// cycles par minute
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Physiologie")
	float FrequenceRespiration = 14.f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Physiologie")
	float AmplitudeRespiration = 0.2f;

	// 0 à 1 : à envoyer au matériau de la peau et du maillot (paramètre à créer, voir docs/ue5/personnages.md)
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Physiologie")
	float Transpiration = 0.f;

	// 0 à 1 : la pluie
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Physiologie")
	float Humidite = 0.f;

	// 0 à 1 : épaules qui tombent, tête plus basse
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Physiologie")
	float PostureFatigue = 0.f;

	// --- §22 §23 §82 le ballon ----------------------------------------------------------------

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Ballon")
	bool bContact = false;

	// secondes avant le contact (négatif juste après)
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Ballon")
	float TempsAvantContact = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Ballon")
	ELFGenreContact GenreContact = ELFGenreContact::Aucun;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Ballon")
	ELFSurface Surface = ELFSurface::Aucune;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Ballon")
	ELFQualiteControle QualiteControle = ELFQualiteControle::Aucune;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Ballon")
	bool bPiedFaible = false;

	// le centre du ballon au contact, dans le monde (cm)
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Ballon")
	FVector PointContact = FVector::ZeroVector;

	// le centre du ballon au contact dans le repère du corps (cm) : X devant, Y à droite, Z hauteur
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Ballon")
	FVector PointContactLocal = FVector::ZeroVector;

	// m/s : départ d'une frappe, arrivée d'une réception
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Ballon")
	float VitesseBallonContact = 0.f;

	// 0 à 1 : l'alpha de l'IK du pied (ou de la tête) qui va au ballon. Monte pendant
	// MonteeIK secondes jusqu'au contact, retombe en DescenteIK secondes après.
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Ballon")
	float PoidsIKContact = 0.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "LinkFoot|Ballon")
	float MonteeIK = 0.25f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "LinkFoot|Ballon")
	float DescenteIK = 0.12f;

	// --- états du moteur --------------------------------------------------------------------

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Etats")
	bool bAuSol = false;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Etats")
	bool bDesequilibre = false;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Etats")
	bool bPorteur = false;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Etats")
	bool bPresse = false;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Etats")
	bool bAppel = false;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Etats")
	bool bDribble = false;

	// --- §44 le corps -----------------------------------------------------------------------

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Corps")
	ELFTypeCorps TypeCorps = ELFTypeCorps::MilieuCompact;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Corps")
	float Explosivite = 0.5f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Corps")
	float Agilite = 0.5f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Corps")
	float Equilibre = 0.5f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Corps")
	float Foulee = 1.f;

	// §27 (qualité visuelle) le caractère, de 0,1 à 0,9 : l'amplitude des gestes et des expressions
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Caractere")
	float Agressivite = 0.5f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Caractere")
	float Calme = 0.5f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Caractere")
	float Expressivite = 0.5f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Caractere")
	float EnergieCaractere = 0.5f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Caractere")
	float Confiance = 0.5f;

	// --- §73 ce que fait le moteur, ce que montre l'animation ---------------------------------

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Controle")
	ELFFamille FamilleAttendue = ELFFamille::Inconnue;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Controle")
	ELFFamille FamilleVue = ELFFamille::Inconnue;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Controle")
	FString AnimationVue;

	// À appeler depuis la fonction de mise à jour du nœud Motion Matching, avec le nom de la base
	// Pose Search (ou de l'animation) que la recherche a choisie : la famille se lit dans le nom
	// (PSD_LF_Sprint, PSD_Reception..., ou les noms du Game Animation Sample).
	UFUNCTION(BlueprintCallable, Category = "LinkFoot|Controle")
	void SignalerAnimationChoisie(const FString& NomBaseOuAnimation);

	// La trajectoire telle que l'instance la construit (utilisée aussi par les tests) : celle du
	// joueur Code, vue de l'instant TReference, placée dans le monde par Repere.
	static void ConstruireTrajectoire(const lf::Cinematique& C, int32 Code, double TReference, const lf::ParametresTrajectoire& Parametres,
		const FTransform& Repere, float DecalageLacet, FTransformTrajectory& Sortie);

private:
	TWeakObjectPtr<ALFFootballeur> Footballeur;
};
