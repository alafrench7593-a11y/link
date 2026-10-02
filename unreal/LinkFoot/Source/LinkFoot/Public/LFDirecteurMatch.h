// LinkFoot dans Unreal : le directeur du match.
//
// Posé dans un niveau, il charge un document du moteur (une scène de test, ou un match entier),
// place le terrain du moteur sur son propre transform, fait entrer les footballeurs et le ballon,
// et fait avancer l'horloge. Il ne décide rien du match : tout ce que les acteurs font se lit dans
// le document.
//
// Le premier palier de qualité (§78) : bSeulementLeFocus montre le seul joueur que la scène
// met en avant, avec le ballon. Les autres paliers (§79 à §81) : deux joueurs, cinq, puis les
// vingt-deux, avec les mêmes acteurs.
//
// La porte de qualité (cahier « qualité visuelle » §20 et §31) : à la fin de chaque boucle de la
// scène, il additionne ce que les contrôles des footballeurs ont compté et rend un verdict,
// VALIDE, À REPRENDRE ou NE PAS LIVRER (un pied qui glisse, ou l'écran qui ne suit plus le
// moteur), écrit dans le journal et lisible dans ses propriétés.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"

#include "LFTypes.h"

#include "LFDirecteurMatch.generated.h"

class ALFBallon;
class ALFFootballeur;
class ULFDefinitionsPersonnages;

UCLASS(Blueprintable)
class LINKFOOT_API ALFDirecteurMatch : public AActor
{
	GENERATED_BODY()

public:
	ALFDirecteurMatch();

	virtual void Tick(float DeltaSeconds) override;

	// La scène de test (§76), de 1 à 16, quand Fichier est vide.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Directeur")
	int32 Scene = 1;

	// Un document du moteur : chemin absolu, ou nom d'un fichier de Content/LinkFoot/Scenes.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Directeur")
	FString Fichier;

	// Le premier palier : un seul joueur (celui que la scène met en avant) et le ballon.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Directeur")
	bool bSeulementLeFocus = true;

	// Le Blueprint des footballeurs (dérivé de LFFootballeur) et celui du ballon.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Directeur")
	TSubclassOf<ALFFootballeur> ClasseFootballeur;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Directeur")
	TSubclassOf<ALFBallon> ClasseBallon;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Directeur")
	TObjectPtr<ULFDefinitionsPersonnages> Definitions;

	// 1 : temps réel ; 0,25 : ralenti. Passe par la dilatation du temps du monde : l'animation
	// ralentit avec le match, au lieu de choisir des allures plus lentes.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Directeur")
	float VitesseLecture = 1.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Directeur")
	bool bBoucler = true;

	// Poser le contrôle (§72 à §75) sur chaque footballeur.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LinkFoot|Directeur")
	bool bControles = true;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Directeur")
	bool bEnLecture = true;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Directeur")
	TArray<TObjectPtr<ALFFootballeur>> Footballeurs;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Directeur")
	TObjectPtr<ALFBallon> Ballon;

	// La porte de qualité de la dernière boucle complète (faux tant qu'aucune n'a été jugée,
	// ou si les contrôles ne sont pas posés).
	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Qualite")
	bool bQualiteJugee = false;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Qualite")
	ELFVerdictQualite VerdictQualite = ELFVerdictQualite::Valide;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Qualite")
	FString RaisonsQualite;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "LinkFoot|Qualite")
	int32 BouclesJugees = 0;

	// Juge ce que les contrôles ont compté depuis le dernier départ, puis repart de zéro.
	UFUNCTION(BlueprintCallable, Category = "LinkFoot|Qualite")
	ELFVerdictQualite JugerQualite();

	UFUNCTION(BlueprintCallable, Category = "LinkFoot|Directeur")
	bool Charger();

	UFUNCTION(BlueprintCallable, Category = "LinkFoot|Directeur")
	void Lecture() { bEnLecture = true; }

	UFUNCTION(BlueprintCallable, Category = "LinkFoot|Directeur")
	void Pause() { bEnLecture = false; }

	UFUNCTION(BlueprintCallable, Category = "LinkFoot|Directeur")
	void Recommencer();

	// Va à l'instant clé de la scène, moins une avance (pour voir venir le geste).
	UFUNCTION(BlueprintCallable, Category = "LinkFoot|Directeur")
	void AllerAInstantCle(float Avance = 1.5f);

	UFUNCTION(BlueprintCallable, Category = "LinkFoot|Directeur")
	void DefinirVitesseLecture(float Vitesse);

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
	void Vider();
	void Peupler();
};
