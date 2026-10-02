// LinkFoot dans Unreal : le match du monde courant.
//
// Une seule source de vérité (§6) : le document que le moteur LinkFoot a écrit (format
// linkfoot-match, docs/passerelle-ue5.md). Ce sous-système le charge, le vérifie (empreinte des
// images), et le garde avec sa cinématique et sa chronique. Il tient aussi l'horloge de lecture :
// le temps du moteur que la scène montre. Les footballeurs, le ballon, la caméra, le son et le
// débogueur lisent tous ici, au même instant : changer de caméra ou de rendu ne change rien au
// match (§7).
#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"

#include "LFTypes.h"

#include "LFCore/LFCinematique.h"
#include "LFCore/LFDocument.h"
#include "LFCore/LFEtatMatch.h"

#include "LFMatchSubsystem.generated.h"

UCLASS()
class LINKFOOTMATCH_API ULFMatchSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	virtual void Deinitialize() override;

	// Charge un document du moteur : un chemin absolu, ou un nom de fichier du dossier des
	// scènes (Content/LinkFoot/Scenes). Faux, avec la raison, s'il ne se lit pas.
	UFUNCTION(BlueprintCallable, Category = "LinkFoot|Match")
	bool ChargerFichier(const FString& Chemin, FString& Erreur);

	// Charge la scène de test numéro N (§76) : le fichier dont le nom commence par « NN- ».
	UFUNCTION(BlueprintCallable, Category = "LinkFoot|Match")
	bool ChargerScene(int32 Numero, FString& Erreur);

	// Les fichiers du dossier des scènes, triés.
	UFUNCTION(BlueprintPure, Category = "LinkFoot|Match")
	static TArray<FString> ListerScenes();

	UFUNCTION(BlueprintPure, Category = "LinkFoot|Match")
	static FString DossierScenes();

	UFUNCTION(BlueprintPure, Category = "LinkFoot|Match")
	bool EstCharge() const;

	// Le premier et le dernier instant du document (secondes du moteur).
	UFUNCTION(BlueprintPure, Category = "LinkFoot|Match")
	double Debut() const;

	UFUNCTION(BlueprintPure, Category = "LinkFoot|Match")
	double Fin() const;

	// L'instant que la scène montre (secondes du moteur).
	UFUNCTION(BlueprintPure, Category = "LinkFoot|Match")
	double Temps() const { return TempsCourant; }

	UFUNCTION(BlueprintCallable, Category = "LinkFoot|Match")
	void DefinirTemps(double T);

	UFUNCTION(BlueprintCallable, Category = "LinkFoot|Match")
	void Avancer(double Secondes);

	// L'état du match à l'instant montré, et à un instant quelconque.
	UFUNCTION(BlueprintPure, Category = "LinkFoot|Match")
	FLinkFootMatchState Etat() const;

	UFUNCTION(BlueprintPure, Category = "LinkFoot|Match")
	FLinkFootMatchState EtatA(double T) const;

	// Une scène de test : son titre, le joueur à regarder (-1 pour un match entier), sa fenêtre
	// et son instant clé.
	UFUNCTION(BlueprintPure, Category = "LinkFoot|Match")
	FString Titre() const;

	UFUNCTION(BlueprintPure, Category = "LinkFoot|Match")
	int32 Focus() const;

	UFUNCTION(BlueprintPure, Category = "LinkFoot|Match")
	double InstantCle() const;

	// Change à chaque chargement : un acteur qui s'est attaché à un document le sait périmé.
	uint32 Generation() const { return GenerationCourante; }
	// Change à chaque saut dans le temps (retour au début, recherche) : les acteurs se replacent
	// sans glisser, comme à une coupe du moteur.
	uint32 Sauts() const { return SautsCourants; }

	// Le cœur, pour le C++ des autres modules (nul tant que rien n'est chargé).
	const lf::DocumentMatch* Document() const { return Doc.Get(); }
	const lf::Cinematique* Cinematique() const { return Cine.Get(); }
	const lf::ChroniqueMatch* Chronique() const { return Chron.Get(); }

	// Le repère : un point du moteur (mètres) en centimètres d'Unreal, un vecteur, une orientation.
	// Le terrain du moteur est centré sur l'origine d'Unreal.
	static FVector VersUnreal(double X, double Y, double Z);
	static FVector VecteurVersUnreal(double VX, double VY, double VZ);
	static float LacetUnreal(double AngleRad);

	// Où est le terrain dans le niveau : le directeur du match y pose son propre transform. Tout
	// ce qui se place dans le monde passe par ces trois fonctions.
	UFUNCTION(BlueprintCallable, Category = "LinkFoot|Match")
	void DefinirRepere(const FTransform& Transform) { Repere = Transform; }

	UFUNCTION(BlueprintPure, Category = "LinkFoot|Match")
	FTransform RepereTerrain() const { return Repere; }

	FVector PositionMonde(double X, double Y, double Z) const;
	FVector VecteurMonde(double VX, double VY, double VZ) const;
	float LacetMonde(double AngleRad) const;
	// Un texte du cœur (UTF-8) en FString.
	static FString Texte(const std::string& Utf8);

private:
	bool ChargerOctets(const FString& Nom, const TArray<uint8>& Octets, FString& Erreur);
	void Vider();

	// Dans cet ordre : la cinématique lit le document, la chronique lit la cinématique.
	TUniquePtr<lf::DocumentMatch> Doc;
	TUniquePtr<lf::Cinematique> Cine;
	TUniquePtr<lf::ChroniqueMatch> Chron;
	double TempsCourant = 0.0;
	uint32 GenerationCourante = 0;
	uint32 SautsCourants = 0;
	FString Source;
	FTransform Repere = FTransform::Identity;
};
