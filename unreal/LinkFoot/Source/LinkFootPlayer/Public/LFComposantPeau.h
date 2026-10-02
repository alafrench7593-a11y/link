// LinkFoot dans Unreal : la sueur, la pluie et le souffle jusque dans les matériaux (cahier
// « qualité visuelle » §3 et §24 : quand il transpire, on doit voir un joueur qui vient de courir).
//
// MetaHuman n'a pas de réglage de sueur. La peau et le maillot la reçoivent donc comme des données
// de primitive (Custom Primitive Data), que leurs matériaux lisent avec le nœud « Custom Primitive
// Data » aux index choisis ici. Tant qu'aucun matériau ne les lit, ces valeurs ne changent rien à
// l'écran : la lecture est à ajouter dans les matériaux de la peau et du maillot
// (docs/ue5/personnages.md). Des données de primitive plutôt qu'une instance dynamique de matériau
// par joueur : les vingt-deux joueurs gardent des matériaux partagés.
//
//   Transpiration  0 à 1 : la sueur accumulée pendant le match, plus vite au soleil (LFPhysiologie.h) ;
//   Humidite       0 à 1 : la pluie ;
//   Effort         0 à 1 : l'essoufflement du moment (un teint qui rougit un peu).
// Tout se lit dans le moteur, par le sous-système du match : le composant ne dépend pas de
// l'Animation Blueprint choisi.
#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"

#include "LFComposantPeau.generated.h"

UCLASS(ClassGroup = (LinkFoot), meta = (BlueprintSpawnableComponent))
class LINKFOOTPLAYER_API ULFComposantPeau : public UActorComponent
{
	GENERATED_BODY()

public:
	ULFComposantPeau();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	// Les index des données de primitive, ceux que lisent les matériaux.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Peau")
	int32 IndexTranspiration = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Peau")
	int32 IndexHumidite = 1;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Peau")
	int32 IndexEffort = 2;

	// En deçà de cet écart, rien ne se verrait : on ne réveille pas le rendu.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Peau")
	float Seuil = 0.01f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Peau")
	float Transpiration = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Peau")
	float Humidite = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Peau")
	float Effort = 0.f;

private:
	float Envoyees[3] = { -1.f, -1.f, -1.f };
};
