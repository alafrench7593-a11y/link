// LinkFoot dans Unreal : un footballeur.
//
// Il ne décide rien et ne se déplace pas de lui-même : à chaque image, il se pose là où le moteur
// LinkFoot l'a mis à cet instant (capsule au sol, corps orienté comme dans le moteur). Sa
// vitesse est celle du moteur (GetVelocity), que l'animation lit. Le mouvement de jambes, de
// buste et de tête vient de son Animation Blueprint (LFAnimInstanceFootballeur) : Motion Matching
// sur la vraie trajectoire du moteur, warping, IK de pied, regard.
//
// Le moteur l'a replacé (coup d'envoi, mise en place d'un coup de pied arrêté, entrée en jeu) :
// il est téléporté, sans glisser, et bCoupe le dit à l'animation pour une image. Un remplaçant
// prend le même code : le footballeur reprend alors la fiche, la taille et le maillage du
// remplaçant. Hors du terrain (remplacé, expulsé), il est caché.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"

#include "LFTypes.h"

#include "LFCore/LFCinematique.h"
#include "LFCore/LFCorps.h"

#include "LFFootballeur.generated.h"

class ULFComposantPeau;
class ULFDefinitionsPersonnages;
class ULFMatchSubsystem;

UCLASS(Blueprintable)
class LINKFOOTPLAYER_API ALFFootballeur : public ACharacter
{
	GENERATED_BODY()

public:
	ALFFootballeur();

	virtual void Tick(float DeltaSeconds) override;
	virtual FVector GetVelocity() const override;

	// Le code du joueur dans le moteur (0 à 10 : domicile, 11 à 21 : extérieur).
	UFUNCTION(BlueprintCallable, Category = "LinkFoot|Footballeur")
	void AttacherAuMatch(int32 InCode);

	// Les maillages par morphotype et l'Animation Blueprint (facultatif : sinon ceux du Blueprint).
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Footballeur")
	TObjectPtr<ULFDefinitionsPersonnages> Definitions;

	// Mettre le personnage à la taille de la fiche (échelle du squelette).
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Footballeur")
	bool bAppliquerTaille = true;

	// La sueur, la pluie et le souffle envoyés aux matériaux (cahier « qualité visuelle » §3, §24).
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "LinkFoot|Footballeur")
	TObjectPtr<ULFComposantPeau> Peau;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Footballeur")
	int32 Code = -1;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Footballeur")
	FString Personnage;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Footballeur")
	FString Nom;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Footballeur")
	FString Poste;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Footballeur")
	FString Role;

	// §44 le morphotype et le profil d'animation, lus dans la fiche (LFCorps.h)
	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Corps")
	ELFTypeCorps TypeCorps = ELFTypeCorps::MilieuCompact;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Corps")
	float Echelle = 1.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Corps")
	float Foulee = 1.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Corps")
	float Explosivite = 0.5f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Corps")
	float Agilite = 0.5f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Corps")
	float Equilibre = 0.5f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Corps")
	float Carrure = 0.5f;

	// du sol à la hanche (cm), pour la foulée (cahier « qualité visuelle » §21)
	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Corps")
	float LongueurJambeCm = 87.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Footballeur")
	bool bSurLeTerrain = false;

	// Vrai l'image où le moteur l'a replacé : l'animation repart de zéro au lieu de fondre.
	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Footballeur")
	bool bCoupe = false;

	// cm/s et cm/s², repère du monde
	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Footballeur")
	FVector VitesseSimulee = FVector::ZeroVector;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Footballeur")
	FVector AccelerationSimulee = FVector::ZeroVector;

	// Pour le C++ : la fiche portée maintenant, et l'état du moteur à l'instant montré.
	const lf::FicheJoueur* Fiche() const { return FicheCourante; }
	const lf::EtatCinematique& EtatMoteur() const { return Etat; }
	double TempsMoteur() const { return TempsCourant; }
	const ULFMatchSubsystem* Match() const;

protected:
	virtual void BeginPlay() override;

private:
	void AppliquerFiche(const lf::FicheJoueur& F, const lf::Cinematique& C);

	const lf::FicheJoueur* FicheCourante = nullptr;
	lf::EtatCinematique Etat;
	uint32 Generation = 0;
	uint32 Sauts = 0;
	int32 DebutSegment = -1;
	double TempsCourant = 0.0;
};
