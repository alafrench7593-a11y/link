#include "LFFootballeur.h"

#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Engine/World.h"
#include "GameFramework/CharacterMovementComponent.h"

#include "LFDefinitionsPersonnages.h"
#include "LFMatchSubsystem.h"

namespace
{
	// La capsule d'un joueur de 1,80 m ; le personnage est mis à sa taille par l'échelle.
	constexpr float kRayonCapsule = 35.f;
	constexpr float kDemiHauteurCapsule = 90.f;
}

ALFFootballeur::ALFFootballeur()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickGroup = TG_PrePhysics;
	GetCapsuleComponent()->InitCapsuleSize(kRayonCapsule, kDemiHauteurCapsule);
	// Le maillage des mannequins d'Unreal regarde vers +Y : on le tourne pour qu'il regarde
	// l'avant de l'acteur, et on pose ses pieds au bas de la capsule (à ajuster dans le Blueprint
	// pour un autre maillage).
	GetMesh()->SetRelativeLocationAndRotation(FVector(0.0, 0.0, -kDemiHauteurCapsule), FRotator(0.0, -90.0, 0.0));
}

void ALFFootballeur::BeginPlay()
{
	Super::BeginPlay();
	// Le moteur LinkFoot déplace le joueur : le mouvement de personnage d'Unreal ne doit ni le
	// déplacer, ni le faire tomber, ni le pousser.
	if (UCharacterMovementComponent* Mouvement = GetCharacterMovement())
	{
		Mouvement->DisableMovement();
		Mouvement->SetComponentTickEnabled(false);
	}
	// L'animation lit ce que Tick vient de poser (position, bCoupe, état du moteur) : le maillage
	// se met à jour après l'acteur, jamais avec une image de retard.
	GetMesh()->AddTickPrerequisiteActor(this);
}

const ULFMatchSubsystem* ALFFootballeur::Match() const
{
	UWorld* Monde = GetWorld();
	return Monde ? Monde->GetSubsystem<ULFMatchSubsystem>() : nullptr;
}

void ALFFootballeur::AttacherAuMatch(int32 InCode)
{
	Code = InCode;
	FicheCourante = nullptr;
	DebutSegment = -1;
	Generation = 0;
}

FVector ALFFootballeur::GetVelocity() const
{
	return VitesseSimulee;
}

void ALFFootballeur::AppliquerFiche(const lf::FicheJoueur& F, const lf::Cinematique& C)
{
	Personnage = ULFMatchSubsystem::Texte(F.personnage);
	Nom = ULFMatchSubsystem::Texte(F.nom);
	Poste = ULFMatchSubsystem::Texte(F.poste);
	Role = ULFMatchSubsystem::Texte(F.role);
	const lf::ProfilCorps Profil = lf::profilCorps(F, lf::largeurDeJeu(C, Code));
	TypeCorps = static_cast<ELFTypeCorps>(static_cast<uint8>(Profil.type));
	Echelle = static_cast<float>(Profil.echelle);
	Foulee = static_cast<float>(Profil.foulee);
	Explosivite = static_cast<float>(Profil.explosivite);
	Agilite = static_cast<float>(Profil.agilite);
	Equilibre = static_cast<float>(Profil.equilibre);
	Carrure = static_cast<float>(Profil.carrure);
	if (bAppliquerTaille)
	{
		SetActorScale3D(FVector(Echelle));
	}
	if (Definitions)
	{
		if (USkeletalMesh* Maillage = Definitions->MaillagePour(TypeCorps))
		{
			GetMesh()->SetSkeletalMesh(Maillage, true);
		}
		if (Definitions->ClasseAnimation)
		{
			GetMesh()->SetAnimInstanceClass(Definitions->ClasseAnimation);
		}
	}
}

void ALFFootballeur::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	const ULFMatchSubsystem* M = Match();
	if (!M || !M->EstCharge() || Code < 0 || Code >= lf::kJoueurs)
	{
		return;
	}
	const lf::Cinematique& C = *M->Cinematique();
	TempsCourant = M->Temps();
	if (Generation != M->Generation())
	{
		// un nouveau document : tout se relit
		Generation = M->Generation();
		FicheCourante = nullptr;
		DebutSegment = -1;
	}
	if (Sauts != M->Sauts())
	{
		// un saut dans le temps : on se replace sans glisser
		Sauts = M->Sauts();
		DebutSegment = -1;
	}
	const lf::FicheJoueur* F = M->Document()->ficheA(Code, TempsCourant);
	if (F && F != FicheCourante)
	{
		FicheCourante = F;
		AppliquerFiche(*F, C);
	}

	Etat = C.etat(Code, TempsCourant);
	bSurLeTerrain = Etat.valide;
	SetActorHiddenInGame(!Etat.valide);
	if (!Etat.valide)
	{
		DebutSegment = -1;
		VitesseSimulee = FVector::ZeroVector;
		AccelerationSimulee = FVector::ZeroVector;
		return;
	}
	int Premier = 0, Dernier = 0;
	C.segment(Code, Etat.image, Premier, Dernier);
	bCoupe = Premier != DebutSegment;
	DebutSegment = Premier;

	VitesseSimulee = M->VecteurMonde(Etat.vx, Etat.vy, 0.0);
	AccelerationSimulee = M->VecteurMonde(Etat.ax, Etat.ay, 0.0);
	const FVector Sol = M->PositionMonde(Etat.x, Etat.y, 0.0);
	const float DemiHauteur = GetCapsuleComponent()->GetScaledCapsuleHalfHeight();
	const FRotator Orientation(0.0, M->LacetMonde(Etat.angleCorps), 0.0);
	SetActorLocationAndRotation(Sol + FVector(0.0, 0.0, DemiHauteur), Orientation, false, nullptr,
		bCoupe ? ETeleportType::TeleportPhysics : ETeleportType::None);
}
