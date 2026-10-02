// LinkFoot dans Unreal : les types partagés (énumérations et structures visibles des Blueprints).
//
// Chaque énumération reprend, dans le même ordre, celle du cœur portable (LinkFootCore) : un
// static_cast suffit pour passer de l'une à l'autre, et LFTypes.cpp vérifie à la compilation que
// les tailles concordent.
//
// FLinkFootMatchState (§6 du cahier) : l'état du match à un instant, tel que le moteur LinkFoot
// l'a joué. Ce n'est pas une seconde simulation : il se lit dans le document du moteur (score et
// horloge dans les images, statistiques recalculées depuis les actions avec les règles du moteur ;
// les tests du cœur prouvent qu'elles sont celles du moteur, au chiffre près).
#pragma once

#include "CoreMinimal.h"

#include "LFTypes.generated.h"

// §11 les bandes de vitesse : 0, 0-2, 2-4, 4-6, 6-8, 8+ m/s
UENUM(BlueprintType)
enum class ELFBandeVitesse : uint8
{
	Arret,
	Marche,
	Trot,
	Course,
	Rapide,
	Sprint
};

// §12 §13 démarrer, accélérer, freiner, s'arrêter
UENUM(BlueprintType)
enum class ELFPhaseVitesse : uint8
{
	Stable,
	Demarrage,
	Acceleration,
	Freinage,
	Arret
};

// §17 §26 le mouvement par rapport au corps
UENUM(BlueprintType)
enum class ELFAllure : uint8
{
	Avant,
	Lateral,
	Recul
};

// §14 les virages
UENUM(BlueprintType)
enum class ELFVirage : uint8
{
	Aucun,
	Correction,
	V30,
	V45,
	V60,
	V90,
	V135,
	V180
};

// §73 les familles d'animation (ce que le moteur fait faire, ce qu'Unreal joue)
UENUM(BlueprintType)
enum class ELFFamille : uint8
{
	Inconnue,
	Immobile,
	Marche,
	Trot,
	Course,
	Sprint,
	Demarrage,
	Freinage,
	Pivot,
	Lateral,
	Recul,
	Reception,
	Passe,
	Centre,
	Tir,
	Tete,
	Degagement,
	Touche,
	Dribble,
	Protection,
	Tacle,
	TacleGlisse,
	Interception,
	Plongeon,
	Arret,
	Prise,
	SortiePieds,
	Chute,
	Desequilibre,
	Celebration
};

// §26 §27 ce que regarde le joueur
UENUM(BlueprintType)
enum class ELFSourceRegard : uint8
{
	Ballon,
	PasseAttendue,
	CiblePasse,
	CibleTir,
	Devant,
	Balayage
};

// §22 §82 le contact avec le ballon
UENUM(BlueprintType)
enum class ELFGenreContact : uint8
{
	Aucun,
	Passe,
	PasseAerienne,
	Centre,
	Tir,
	Tete,
	Degagement,
	Touche,
	Controle,
	Interception,
	Tacle,
	Contre,
	Arret,
	PriseAerienne,
	SortiePieds
};

UENUM(BlueprintType)
enum class ELFSurface : uint8
{
	Aucune,
	PiedDroit,
	PiedGauche,
	Tete,
	Poitrine,
	Mains
};

// §23 la qualité du premier contrôle, tirée par le moteur
UENUM(BlueprintType)
enum class ELFQualiteControle : uint8
{
	Aucune,
	Parfait,
	Propre,
	Controle,
	Lourd,
	Rate
};

// §44 les morphotypes
UENUM(BlueprintType)
enum class ELFTypeCorps : uint8
{
	AilierFin,
	AilierExplosif,
	MilieuCompact,
	MilieuGrand,
	AttaquantPuissant,
	AttaquantGrand,
	DefenseurCentralPuissant,
	LateralFin,
	GardienAthletique,
	GardienGrand
};

// §72 à §75 les verdicts des détecteurs
UENUM(BlueprintType)
enum class ELFStatut : uint8
{
	Ok,
	Alerte,
	Desynchro
};

UENUM(BlueprintType)
enum class ELFDefautPied : uint8
{
	Aucun,
	Glissement,
	Flottement,
	Penetration
};

UENUM(BlueprintType)
enum class ELFAnomalie : uint8
{
	Aucune,
	AccelerationInstantanee,
	FreinageInstantane,
	Teleportation,
	PicVitesse,
	VitesseImpossible,
	RotationImpossible,
	PiedsCorps
};

// §60 les statistiques d'une équipe (les règles du moteur)
USTRUCT(BlueprintType)
struct LINKFOOTMATCH_API FLFStatsEquipe
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 Buts = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 Tirs = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 TirsCadres = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	float XG = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 Passes = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 PassesReussies = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 Corners = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 Fautes = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 Jaunes = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 Rouges = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 HorsJeu = 0;

	// ballons gagnés : interceptions, tacles réussis, tirs contrés, duels aériens gagnés en défense sur centre
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 Tacles = 0;
};

// §60 les statistiques d'un joueur
USTRUCT(BlueprintType)
struct LINKFOOTMATCH_API FLFStatsJoueur
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	FString Nom;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	FString Personnage;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	bool bDomicile = true;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	bool bAJoue = false;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	float Minutes = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 Buts = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 PassesDecisives = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 Tirs = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 TirsCadres = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 Passes = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 PassesReussies = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 PassesCles = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 Dribbles = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 DribblesReussis = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 Tacles = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 Interceptions = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 Duels = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 DuelsGagnes = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 Fautes = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 Pertes = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 Arrets = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	int32 Jaunes = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	bool bExclu = false;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	float XG = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	float XA = 0.f;

	// la note du moteur, au coup de sifflet final (-1 avant)
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Statistiques")
	float Note = -1.f;
};

// Un joueur sur le terrain à un instant : ce que le moteur a joué.
USTRUCT(BlueprintType)
struct LINKFOOTMATCH_API FLFEtatJoueur
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Joueur")
	int32 Code = -1;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Joueur")
	FString Personnage;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Joueur")
	FString Nom;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Joueur")
	bool bSurLeTerrain = false;

	// centimètres, repère d'Unreal
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Joueur")
	FVector Position = FVector::ZeroVector;

	// cm/s
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Joueur")
	FVector Vitesse = FVector::ZeroVector;

	// cm/s²
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Joueur")
	FVector Acceleration = FVector::ZeroVector;

	// l'orientation du corps, lacet en degrés
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Joueur")
	float Lacet = 0.f;

	// 0 à 100
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Joueur")
	float Energie = 100.f;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Joueur")
	bool bAuSol = false;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Joueur")
	bool bDesequilibre = false;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Joueur")
	bool bPorteur = false;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Joueur")
	bool bSprint = false;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Joueur")
	bool bPresse = false;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Joueur")
	bool bAppel = false;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Joueur")
	bool bDribble = false;

	// l'intention de l'IA du moteur (HOLD, SUPPORT, BUILD_UP, ATTACK_SPACE, DROP, OVERLAP, RECOVER, MARK, COVER)
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Joueur")
	FName Intention;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Joueur")
	ELFFamille FamilleAttendue = ELFFamille::Inconnue;
};

// Le réglage tactique d'une équipe, tel que le moteur l'a reçu (la feuille de match).
USTRUCT(BlueprintType)
struct LINKFOOTMATCH_API FLFTactique
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Tactique")
	FString Club;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Tactique")
	FString Formation;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Tactique")
	FString Style;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Tactique")
	int32 Mentalite = 3;

	// les réglages du moteur (press, line, width, tempo, ...), par nom
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Tactique")
	TMap<FName, float> Reglages;
};

// §6 FLinkFootMatchState : l'état du match à un instant.
USTRUCT(BlueprintType)
struct LINKFOOTMATCH_API FLinkFootMatchState
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	bool bValide = false;

	// secondes du moteur (le temps du document)
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	double TempsMoteur = 0.0;

	// MatchTime : l'horloge affichée, en secondes
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	int32 Horloge = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	int32 MiTemps = 1;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	int32 ScoreDomicile = 0;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	int32 ScoreExterieur = 0;

	// Possession : % du domicile jusqu'à cet instant (règle du moteur)
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	float PossessionDomicile = 50.f;

	// CurrentPossessor : le code du porteur, -1 personne
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	int32 Porteur = -1;

	// le coup de pied arrêté en cours (ko, corner, fkc, fkd, fk, throw, gk, pen), vide sinon
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	FName CoupDePiedArrete;

	// BallPosition, BallVelocity : centimètres et cm/s, repère d'Unreal (centre du ballon au sol : z = 0)
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	FVector PositionBallon = FVector::ZeroVector;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	FVector VitesseBallon = FVector::ZeroVector;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	bool bBallonEnVol = false;

	// Players, PlayerStates, Fatigue (Energie) : les 22 codes
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	TArray<FLFEtatJoueur> Joueurs;

	// TeamTactics, TeamMentality, Pressing, DefensiveLine, Width, Tempo
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	FLFTactique TactiqueDomicile;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	FLFTactique TactiqueExterieur;

	// Shots, ShotsOnTarget, xG, Passes, CompletedPasses, Tackles, Fouls, Corners, Offsides, Cards
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	FLFStatsEquipe StatsDomicile;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	FLFStatsEquipe StatsExterieur;

	// une par fiche de la feuille de match, remplaçants compris (Substitutions)
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	TArray<FLFStatsJoueur> StatsJoueurs;

	// Events : les derniers bandeaux et commentaires du moteur jusqu'à cet instant
	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	TArray<FString> DerniersEvenements;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	FString Meteo;

	UPROPERTY(BlueprintReadOnly, Category = "LinkFoot|Match")
	bool bTermine = false;
};
