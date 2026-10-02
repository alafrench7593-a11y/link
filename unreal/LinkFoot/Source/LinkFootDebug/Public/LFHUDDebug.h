// LinkFoot dans Unreal : le débogueur à l'écran (§71 à §75).
//
// En haut : la scène, l'horloge, le score, la possession (lus dans le moteur). Au-dessus de chaque
// footballeur : son numéro, ce que le moteur lui fait faire, l'animation que l'écran montre, et
// les alertes en rouge. Pour le joueur suivi, le panneau du §71 : identifiants (code, carte,
// personnage), position, vitesse, accélération, orientation, cible donnée par l'IA du moteur,
// action attendue, animation jouée, compétences, rôle, fatigue, forme, moral, prochain contact.
//
// Le panneau « décision » du §71 (option choisie, raison, probabilité) n'y est pas : le moteur
// ne transmet pas encore ses délibérations (docs/ue5/audit.md, systèmes manquants).
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"

#include "LFHUDDebug.generated.h"

class ALFFootballeur;

UCLASS()
class LINKFOOTDEBUG_API ALFHUDDebug : public AHUD
{
	GENERATED_BODY()

public:
	virtual void DrawHUD() override;

	// Le joueur du panneau ; -1 : celui que la scène met en avant.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Debug")
	int32 JoueurSuivi = -1;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Debug")
	bool bEtiquettes = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Debug")
	bool bPanneau = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Debug")
	float TailleTexte = 1.f;

	UFUNCTION(BlueprintCallable, Category = "LinkFoot|Debug")
	void SuivreJoueur(int32 Code) { JoueurSuivi = Code; }

private:
	void Ligne(const FString& Texte, float X, float& Y, const FLinearColor& Couleur);
	void Panneau(const ALFFootballeur& J, float X, float Y);
};
