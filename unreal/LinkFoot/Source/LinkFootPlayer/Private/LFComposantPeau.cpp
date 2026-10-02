#include "LFComposantPeau.h"

#include "Components/PrimitiveComponent.h"

#include "LFFootballeur.h"
#include "LFMatchSubsystem.h"

#include "LFCore/LFPhysiologie.h"

ULFComposantPeau::ULFComposantPeau()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickGroup = TG_PostUpdateWork;
}

void ULFComposantPeau::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
	AActor* Proprietaire = GetOwner();
	const ALFFootballeur* J = Cast<ALFFootballeur>(Proprietaire);
	const ULFMatchSubsystem* M = J ? J->Match() : nullptr;
	const lf::ChroniquePhysiologie* Physio = M && M->EstCharge() ? M->Physiologie() : nullptr;
	if (!Physio || J->Code < 0)
	{
		return;
	}
	const lf::EtatPhysiologique P = Physio->etat(J->Code, J->TempsMoteur());
	if (!P.valide)
	{
		return;
	}
	Transpiration = static_cast<float>(P.transpiration);
	Humidite = static_cast<float>(P.humidite);
	Effort = static_cast<float>(FMath::Clamp(P.essoufflement, 0.0, 1.0));
	if (FMath::Abs(Transpiration - Envoyees[0]) < Seuil && FMath::Abs(Humidite - Envoyees[1]) < Seuil && FMath::Abs(Effort - Envoyees[2]) < Seuil)
	{
		return;
	}
	Envoyees[0] = Transpiration;
	Envoyees[1] = Humidite;
	Envoyees[2] = Effort;
	// tous les maillages du joueur (corps, visage, cheveux, maillot), y compris ceux d'un
	// personnage MetaHuman posé comme acteur enfant
	TArray<UPrimitiveComponent*> Composants;
	Proprietaire->GetComponents<UPrimitiveComponent>(Composants, true);
	for (UPrimitiveComponent* C : Composants)
	{
		if (C)
		{
			C->SetCustomPrimitiveDataFloat(IndexTranspiration, Transpiration);
			C->SetCustomPrimitiveDataFloat(IndexHumidite, Humidite);
			C->SetCustomPrimitiveDataFloat(IndexEffort, Effort);
		}
	}
}
