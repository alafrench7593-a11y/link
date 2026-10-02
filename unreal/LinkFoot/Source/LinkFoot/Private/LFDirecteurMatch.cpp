#include "LFDirecteurMatch.h"

#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"

#include "LFBallon.h"
#include "LFComposantControle.h"
#include "LFFootballeur.h"
#include "LFMatchSubsystem.h"

#include "LFCore/LFDetecteurs.h"
#include "LFCore/LFDocument.h"

#include <string>

ALFDirecteurMatch::ALFDirecteurMatch()
{
	PrimaryActorTick.bCanEverTick = true;
	// avant les footballeurs et le ballon, qui lisent l'horloge qu'il fait avancer
	PrimaryActorTick.TickGroup = TG_PrePhysics;
}

void ALFDirecteurMatch::BeginPlay()
{
	Super::BeginPlay();
	Charger();
}

void ALFDirecteurMatch::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	UGameplayStatics::SetGlobalTimeDilation(this, 1.f);
	Super::EndPlay(EndPlayReason);
}

bool ALFDirecteurMatch::Charger()
{
	ULFMatchSubsystem* M = GetWorld() ? GetWorld()->GetSubsystem<ULFMatchSubsystem>() : nullptr;
	if (!M)
	{
		return false;
	}
	M->DefinirRepere(GetActorTransform());
	FString Erreur;
	const bool Lu = Fichier.IsEmpty() ? M->ChargerScene(Scene, Erreur) : M->ChargerFichier(Fichier, Erreur);
	if (!Lu)
	{
		UE_LOG(LogTemp, Error, TEXT("LinkFoot : %s"), *Erreur);
		return false;
	}
	UE_LOG(LogTemp, Log, TEXT("LinkFoot : %s (%.1f s du moteur)"), *M->Titre(), M->Fin() - M->Debut());
	DefinirVitesseLecture(VitesseLecture);
	Peupler();
	return true;
}

void ALFDirecteurMatch::Vider()
{
	for (ALFFootballeur* J : Footballeurs)
	{
		if (J)
		{
			J->Destroy();
		}
	}
	Footballeurs.Reset();
	if (Ballon)
	{
		Ballon->Destroy();
		Ballon = nullptr;
	}
}

void ALFDirecteurMatch::Peupler()
{
	Vider();
	ULFMatchSubsystem* M = GetWorld()->GetSubsystem<ULFMatchSubsystem>();
	if (!M || !M->EstCharge())
	{
		return;
	}
	FActorSpawnParameters Parametres;
	Parametres.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	UClass* ClasseB = ClasseBallon ? ClasseBallon.Get() : ALFBallon::StaticClass();
	Ballon = GetWorld()->SpawnActor<ALFBallon>(ClasseB, GetActorTransform(), Parametres);
	if (Ballon)
	{
		Ballon->AddTickPrerequisiteActor(this);
	}

	const int32 Focus = M->Focus();
	UClass* ClasseJ = ClasseFootballeur ? ClasseFootballeur.Get() : ALFFootballeur::StaticClass();
	for (int32 Code = 0; Code < lf::kJoueurs; ++Code)
	{
		if (bSeulementLeFocus && Focus >= 0 && Code != Focus)
		{
			continue;
		}
		ALFFootballeur* J = GetWorld()->SpawnActor<ALFFootballeur>(ClasseJ, GetActorTransform(), Parametres);
		if (!J)
		{
			continue;
		}
		if (Definitions)
		{
			J->Definitions = Definitions;
		}
		J->AttacherAuMatch(Code);
		J->AddTickPrerequisiteActor(this);
		if (bControles)
		{
			ULFComposantControle* Controle = NewObject<ULFComposantControle>(J, TEXT("Controle"));
			Controle->RegisterComponent();
		}
		Footballeurs.Add(J);
	}
}

void ALFDirecteurMatch::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	ULFMatchSubsystem* M = GetWorld() ? GetWorld()->GetSubsystem<ULFMatchSubsystem>() : nullptr;
	if (!M || !M->EstCharge() || !bEnLecture)
	{
		return;
	}
	// DeltaSeconds est déjà dilaté par la vitesse de lecture : une seconde du moteur par
	// seconde du monde
	M->Avancer(DeltaSeconds);
	if (M->Temps() >= M->Fin() - 1e-6)
	{
		JugerQualite();
		if (bBoucler)
		{
			Recommencer();
		}
		else
		{
			bEnLecture = false;
		}
	}
}

ELFVerdictQualite ALFDirecteurMatch::JugerQualite()
{
	lf::BilanQualite Total;
	int32 Controles = 0;
	for (ALFFootballeur* J : Footballeurs)
	{
		if (ULFComposantControle* Controle = J ? J->FindComponentByClass<ULFComposantControle>() : nullptr)
		{
			Total += Controle->Bilan();
			Controle->DebuterBilan();
			++Controles;
		}
	}
	if (Controles == 0)
	{
		bQualiteJugee = false;
		RaisonsQualite = ULFMatchSubsystem::Texte("aucun contrôle posé (bControles) : la qualité ne peut pas être jugée");
		UE_LOG(LogTemp, Warning, TEXT("LinkFoot : %s"), *RaisonsQualite);
		return VerdictQualite;
	}
	const lf::ResultatQualite R = lf::porteQualite(Total);
	bQualiteJugee = true;
	++BouclesJugees;
	VerdictQualite = static_cast<ELFVerdictQualite>(static_cast<uint8>(R.verdict));
	RaisonsQualite = ULFMatchSubsystem::Texte(R.raisons);
	const std::string Detail = std::string("porte de qualité : ") + lf::nomVerdictQualite(R.verdict) + " (boucle " + std::to_string(BouclesJugees) + ", "
		+ std::to_string(Controles) + " contrôle(s), " + std::to_string(Total.contactsJuges) + " contact(s) jugé(s))"
		+ (R.raisons.empty() ? std::string() : " : " + R.raisons);
	const FString Message = ULFMatchSubsystem::Texte(Detail);
	switch (R.verdict)
	{
	case lf::VerdictQualite::Valide:
		UE_LOG(LogTemp, Log, TEXT("LinkFoot : %s"), *Message);
		break;
	case lf::VerdictQualite::AReprendre:
		UE_LOG(LogTemp, Warning, TEXT("LinkFoot : %s"), *Message);
		break;
	case lf::VerdictQualite::NePasLivrer:
		UE_LOG(LogTemp, Error, TEXT("LinkFoot : %s"), *Message);
		break;
	}
	return VerdictQualite;
}

void ALFDirecteurMatch::Recommencer()
{
	if (ULFMatchSubsystem* M = GetWorld() ? GetWorld()->GetSubsystem<ULFMatchSubsystem>() : nullptr)
	{
		const lf::DocumentMatch* Doc = M->Document();
		M->DefinirTemps(Doc && Doc->estScene ? Doc->scene.t0 : M->Debut());
	}
}

void ALFDirecteurMatch::AllerAInstantCle(float Avance)
{
	if (ULFMatchSubsystem* M = GetWorld() ? GetWorld()->GetSubsystem<ULFMatchSubsystem>() : nullptr)
	{
		M->DefinirTemps(M->InstantCle() - Avance);
	}
}

void ALFDirecteurMatch::DefinirVitesseLecture(float Vitesse)
{
	VitesseLecture = FMath::Clamp(Vitesse, 0.05f, 4.f);
	UGameplayStatics::SetGlobalTimeDilation(this, VitesseLecture);
}
