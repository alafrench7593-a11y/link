// LinkFoot dans Unreal : le ballon.
//
// Sa position est celle du moteur : pendant un vol, la formule même du vol (départ, arrivée,
// durée, hauteur du sommet) ; hors vol, les images, au pied du porteur ou libre. Unreal n'y ajoute
// que ce que le moteur ne décrit pas et qui se déduit du mouvement : le ballon roule (sa rotation
// suit la distance parcourue au sol, sans glisser).
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"

#include "LFBallon.generated.h"

class UStaticMeshComponent;
class ULFMatchSubsystem;

UCLASS(Blueprintable)
class LINKFOOTMATCH_API ALFBallon : public AActor
{
	GENERATED_BODY()

public:
	ALFBallon();

	virtual void Tick(float DeltaSeconds) override;

	// Le maillage du ballon (à choisir dans le Blueprint dérivé).
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "LinkFoot|Ballon")
	TObjectPtr<UStaticMeshComponent> Maillage;

	// Rayon d'un ballon de taille 5 (22 cm de diamètre), lf::kRayonBallonM : le moteur donne le
	// point bas du ballon.
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "LinkFoot|Ballon")
	float RayonCm = 11.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Ballon")
	FVector VitesseSimulee = FVector::ZeroVector;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Ballon")
	bool bEnVol = false;

	// Le code du porteur, -1 : personne.
	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Ballon")
	int32 Porteur = -1;

private:
	FVector PositionPrecedente = FVector::ZeroVector;
	bool bAPrecedente = false;
	FQuat Rotation = FQuat::Identity;
};
