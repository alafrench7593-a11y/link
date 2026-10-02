// LinkFoot dans Unreal : ce qui dit quand l'écran ment (§72 à §75), pour un footballeur.
//
// Posé sur chaque footballeur par le directeur du match, il compare à chaque image ce que montre
// Unreal à ce que le moteur a joué, avec les détecteurs du cœur portable (LFDetecteurs.h, testés
// hors d'Unreal) :
//   §72 DESYNC              le corps vu (l'os racine du squelette) loin de la position du moteur :
//                           plus de 30 cm pendant 0,2 s (la tolérance du contrat) ;
//   §73 ANIMATION DESYNC    la famille de l'animation choisie par Motion Matching contre celle
//                           que le moteur attend (le moteur dit « contrôle », l'écran montre un sprint) ;
//   §74 FOOT SLIDE WARNING  un pied au sol qui glisse, flotte ou s'enfonce ;
//   §75 mouvement impossible : accélération ou freinage instantanés, téléportation, pic de
//                           vitesse, rotation impossible ;
//   §82 CONTACT MANQUÉ      au contact du moteur, le pied (la tête, la poitrine, les mains) qui
//                           joue reste à plus de 15 cm du ballon pendant les 0,05 s autour de l'instant.
// Il compte, il ne corrige pas : c'est le rendu qu'il faut corriger. Le HUD de débogage affiche
// ses alertes ; le directeur du match fait de ses comptes, à chaque boucle de la scène, le verdict
// de la porte de qualité (cahier « qualité visuelle » §20 et §31 : un pied qui glisse, et la
// scène ne passe pas).
#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"

#include "LFTypes.h"

#include "LFCore/LFDetecteurs.h"

#include "LFComposantControle.generated.h"

UCLASS(ClassGroup = (LinkFoot), meta = (BlueprintSpawnableComponent))
class LINKFOOTDEBUG_API ULFComposantControle : public UActorComponent
{
	GENERATED_BODY()

public:
	ULFComposantControle();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	// Les os du squelette (noms du mannequin d'Unreal 5 et des MetaHumans).
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Controle")
	FName OsRacine = TEXT("root");

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Controle")
	FName OsPiedGauche = TEXT("ball_l");

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Controle")
	FName OsPiedDroit = TEXT("ball_r");

	// Les parties du corps des contacts qui ne se jouent pas du pied (§82).
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Controle")
	FName OsTete = TEXT("head");

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Controle")
	FName OsPoitrine = TEXT("spine_05");

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Controle")
	FName OsMainGauche = TEXT("hand_l");

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Controle")
	FName OsMainDroite = TEXT("hand_r");

	// La hauteur de l'os du pied au-dessus du sol quand le pied est posé (cm).
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Controle")
	float HauteurOsPiedPoseCm = 3.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Controle")
	float EcartCm = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Controle")
	float EcartMaxCm = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Controle")
	ELFStatut StatutPosition = ELFStatut::Ok;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Controle")
	ELFStatut StatutAnimation = ELFStatut::Ok;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Controle")
	ELFDefautPied DefautPiedGauche = ELFDefautPied::Aucun;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Controle")
	ELFDefautPied DefautPiedDroit = ELFDefautPied::Aucun;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Controle")
	ELFAnomalie DerniereAnomalie = ELFAnomalie::Aucune;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Controle")
	int32 Desynchros = 0;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Controle")
	int32 DesynchrosAnimation = 0;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Controle")
	int32 GlissementsPied = 0;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Controle")
	int32 Anomalies = 0;

	// §82 les contacts avec le ballon : jugés, manqués, et l'écart du dernier jugé (cm, de la partie
	// du corps à la surface du ballon)
	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Controle")
	int32 ContactsJuges = 0;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Controle")
	int32 ContactsManques = 0;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Controle")
	float EcartContactCm = 0.f;

	// Faux tant que l'Animation Blueprint n'appelle pas SignalerAnimationChoisie : la
	// désynchronisation d'animation ne peut pas être vérifiée.
	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Controle")
	bool bAnimationSignalee = false;

	// Les alertes en cours, en clair (DESYNC, ANIMATION DESYNC, FOOT SLIDE WARNING...).
	UFUNCTION(BlueprintPure, Category = "LinkFoot|Controle")
	TArray<FString> Alertes() const;

	// Ce que les détecteurs ont compté depuis le dernier DebuterBilan (LFDetecteurs.h, porteQualite).
	lf::BilanQualite Bilan() const;
	void DebuterBilan();

private:
	lf::DetecteurDesynchro Position;
	lf::DetecteurDesynchroAnimation Animation;
	lf::DetecteurPied PiedGauche;
	lf::DetecteurPied PiedDroit;
	lf::DetecteurMouvement Mouvement;
	lf::DetecteurContact Contact;
	lf::BilanQualite Depart;
	double DernierTemps = -1.0;
	uint32 SautsVus = 0;
	double TempsAnomalie = -1.0e9;
	double TempsContactManque = -1.0e9;
	float EcartContactManqueCm = 0.f;
	bool bAlerteContact = false;
};
