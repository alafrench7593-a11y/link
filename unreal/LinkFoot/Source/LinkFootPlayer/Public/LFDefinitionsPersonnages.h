// LinkFoot dans Unreal : de la fiche au personnage (§43).
//
// Un asset de données (Contenu > clic droit > Divers > Data Asset, classe
// LFDefinitionsPersonnages) qui dit quel maillage porte chaque morphotype (§44) et quelle
// classe d'animation (l'Animation Blueprint dérivé de LFAnimInstanceFootballeur) l'anime.
// Les maillages viennent du projet : un MetaHuman au corps paramétrique par morphotype, ou le
// mannequin du Game Animation Sample pour commencer. Aucun visage réel (cahier, §45).
#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"

#include "LFTypes.h"

#include "LFDefinitionsPersonnages.generated.h"

class UAnimInstance;
class USkeletalMesh;

UCLASS(BlueprintType)
class LINKFOOTPLAYER_API ULFDefinitionsPersonnages : public UDataAsset
{
	GENERATED_BODY()

public:
	// Le maillage de chaque morphotype ; un morphotype absent prend le maillage par défaut.
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "LinkFoot|Personnages")
	TMap<ELFTypeCorps, TObjectPtr<USkeletalMesh>> Maillages;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "LinkFoot|Personnages")
	TObjectPtr<USkeletalMesh> MaillageParDefaut;

	// L'Animation Blueprint des footballeurs (dérivé de LFAnimInstanceFootballeur).
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "LinkFoot|Personnages")
	TSubclassOf<UAnimInstance> ClasseAnimation;

	USkeletalMesh* MaillagePour(ELFTypeCorps Type) const;
};
