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
