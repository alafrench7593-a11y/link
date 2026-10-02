#include "LFBallon.h"

#include "Components/StaticMeshComponent.h"
#include "Engine/World.h"

#include "LFMatchSubsystem.h"

#include "LFCore/LFRepere.h"

// le rayon par défaut du ballon est celui du cœur (le rendu et les contrôles parlent du même ballon)
static_assert(lf::kRayonBallonM * 100.0 > 10.99 && lf::kRayonBallonM * 100.0 < 11.01, "RayonCm (LFBallon.h) doit valoir lf::kRayonBallonM");

ALFBallon::ALFBallon()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickGroup = TG_PrePhysics;
	Maillage = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Maillage"));
	Maillage->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	SetRootComponent(Maillage);
}

void ALFBallon::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	const ULFMatchSubsystem* Match = GetWorld() ? GetWorld()->GetSubsystem<ULFMatchSubsystem>() : nullptr;
	if (!Match || !Match->EstCharge())
	{
		return;
	}
	const lf::EtatBallon B = Match->Cinematique()->ballon(Match->Temps());
	if (!B.valide)
	{
		return;
	}
	const FVector Position = Match->PositionMonde(B.x, B.y, B.z) + FVector(0.0, 0.0, RayonCm);
	VitesseSimulee = Match->VecteurMonde(B.vx, B.vy, B.vz);
	bEnVol = B.enVol;
	Porteur = B.porteur;

	// Le ballon roule : au sol, il tourne de distance / rayon autour de l'axe horizontal
	// perpendiculaire à son déplacement. Un saut (coupe, remise en jeu) ne le fait pas tourner.
	if (bAPrecedente)
	{
		const FVector Deplacement = Position - PositionPrecedente;
		const FVector Horizontal(Deplacement.X, Deplacement.Y, 0.0);
		const double Distance = Horizontal.Size();
		if (Distance > 1e-3 && Distance < 300.0 && B.z < 0.05)
		{
			const FVector Axe = FVector::CrossProduct(FVector::UpVector, Horizontal / Distance);
			Rotation = FQuat(Axe, Distance / RayonCm) * Rotation;
			Rotation.Normalize();
		}
	}
	PositionPrecedente = Position;
	bAPrecedente = true;
	SetActorLocationAndRotation(Position, Rotation, false, nullptr, ETeleportType::None);
}
