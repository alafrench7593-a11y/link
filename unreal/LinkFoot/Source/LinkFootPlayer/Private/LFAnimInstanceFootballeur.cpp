#include "LFAnimInstanceFootballeur.h"

#include "Containers/StringConv.h"
#include "Engine/World.h"

#include "LFFootballeur.h"
#include "LFMatchSubsystem.h"

#include "LFCore/LFContact.h"
#include "LFCore/LFFamilles.h"
#include "LFCore/LFLocomotion.h"
#include "LFCore/LFRegard.h"
#include "LFCore/LFRepere.h"

#include <string_view>
#include <vector>

void ULFAnimInstanceFootballeur::NativeInitializeAnimation()
{
	Super::NativeInitializeAnimation();
	Footballeur = Cast<ALFFootballeur>(TryGetPawnOwner());
}

void ULFAnimInstanceFootballeur::ConstruireTrajectoire(const lf::Cinematique& C, int32 Code, double TReference, const lf::ParametresTrajectoire& Parametres,
	const FTransform& Repere, float DecalageLacet, FTransformTrajectory& Sortie)
{
	const std::vector<lf::EchantillonTrajectoire> Echantillons = lf::trajectoire(C, Code, TReference, Parametres);
	Sortie.Samples.Reset(static_cast<int32>(Echantillons.size()));
	const double LacetRepere = Repere.Rotator().Yaw;
	for (const lf::EchantillonTrajectoire& E : Echantillons)
	{
		FTransformTrajectorySample S;
		S.Position = Repere.TransformPosition(ULFMatchSubsystem::VersUnreal(E.x, E.y, 0.0));
		S.Facing = FRotator(0.0, ULFMatchSubsystem::LacetUnreal(E.angleCorps) + LacetRepere + DecalageLacet, 0.0).Quaternion();
		S.TimeInSeconds = static_cast<float>(E.decalage);
		Sortie.Samples.Add(S);
	}
}

void ULFAnimInstanceFootballeur::SignalerAnimationChoisie(const FString& NomBaseOuAnimation)
{
	AnimationVue = NomBaseOuAnimation;
	const FTCHARToUTF8 Utf8(*NomBaseOuAnimation);
	const std::string_view Nom(reinterpret_cast<const char*>(Utf8.Get()), static_cast<std::size_t>(Utf8.Length()));
	FamilleVue = static_cast<ELFFamille>(static_cast<uint8>(lf::familleDepuisNom(Nom)));
}

void ULFAnimInstanceFootballeur::NativeUpdateAnimation(float DeltaSeconds)
{
	Super::NativeUpdateAnimation(DeltaSeconds);
	ALFFootballeur* J = Footballeur.Get();
	if (!J)
	{
		J = Cast<ALFFootballeur>(TryGetPawnOwner());
		Footballeur = J;
	}
	if (!J || J->Code < 0 || J->Code >= lf::kJoueurs)
	{
		return;
	}
	const ULFMatchSubsystem* M = J->Match();
	if (!M || !M->EstCharge())
	{
		return;
	}
	const lf::Cinematique& C = *M->Cinematique();
	const int32 Code = J->Code;
	const double T = M->Temps();
	bCoupe = J->bCoupe;

	// §11 à §14 la locomotion que le moteur a jouée
	const lf::DescriptionLocomotion D = lf::decrireLocomotion(C, Code, T);
	if (!D.valide)
	{
		return;
	}
	Vitesse = static_cast<float>(D.vitesse * 100.0);
	VitesseMax = static_cast<float>(D.vitesseMax * 100.0);
	Effort = static_cast<float>(D.effort);
	VitesseLocomotion = Vitesse;
	AccelerationLongitudinale = static_cast<float>(D.accelerationLongitudinale * 100.0);
	AngleLocomotion = static_cast<float>(D.angleLocomotionDeg);
	VirageDeg = static_cast<float>(D.virageDeg);
	RayonVirage = static_cast<float>(D.rayonVirage * 100.0);
	Bande = static_cast<ELFBandeVitesse>(static_cast<uint8>(D.bande));
	Phase = static_cast<ELFPhaseVitesse>(static_cast<uint8>(D.phase));
	Allure = static_cast<ELFAllure>(static_cast<uint8>(D.allure));
	Virage = static_cast<ELFVirage>(static_cast<uint8>(D.virage));
	bSprintVoulu = D.sprintVoulu;
	Energie = static_cast<float>(D.energie);
	bFatigue = D.fatigue;

	const lf::EtatCinematique& E = J->EtatMoteur();
	bAuSol = (E.etats & lf::etat::AuSol) != 0;
	bDesequilibre = (E.etats & lf::etat::Desequilibre) != 0;
	bPorteur = (E.etats & lf::etat::Porteur) != 0;
	bPresse = (E.etats & lf::etat::Presse) != 0;
	bAppel = (E.etats & lf::etat::Appel) != 0;
	bDribble = (E.etats & lf::etat::Dribble) != 0;

	// §15 la trajectoire : l'échantillon 0 est l'image précédente du rendu
	lf::ParametresTrajectoire P;
	P.historique = EchantillonsPasse;
	P.pasHistorique = PasPasse;
	P.prediction = EchantillonsFutur;
	P.pasPrediction = PasFutur;
	ConstruireTrajectoire(C, Code, T - DeltaSeconds, P, M->RepereTerrain(), DecalageLacetTrajectoire, Trajectoire);

	// §26 §27 le regard
	const lf::Regard R = lf::cibleRegard(C, Code, T);
	bRegardValide = R.valide;
	if (R.valide)
	{
		CibleRegard = M->PositionMonde(R.x, R.y, R.z);
		SourceRegard = static_cast<ELFSourceRegard>(static_cast<uint8>(R.source));
	}

	// §22 §23 §82 le prochain contact avec le ballon
	const lf::Contact K = lf::prochainContact(C, Code, T);
	bContact = K.valide;
	if (K.valide)
	{
		TempsAvantContact = static_cast<float>(K.dans);
		GenreContact = static_cast<ELFGenreContact>(static_cast<uint8>(K.genre));
		Surface = static_cast<ELFSurface>(static_cast<uint8>(K.surface));
		QualiteControle = static_cast<ELFQualiteControle>(static_cast<uint8>(K.qualite));
		bPiedFaible = K.piedFaible;
		// le moteur donne le point bas du ballon : le centre est un rayon plus haut
		constexpr double RayonCm = lf::kRayonBallonM * 100.0;
		PointContact = M->PositionMonde(K.x, K.y, K.z) + FVector(0.0, 0.0, RayonCm);
		PointContactLocal = FVector(K.avant * 100.0, K.droite * 100.0, K.z * 100.0 + RayonCm);
		VitesseBallonContact = static_cast<float>(K.vitesseBallon);
		const double Dans = K.dans;
		double Poids = 0.0;
		if (Dans >= 0.0 && Dans <= MonteeIK)
		{
			Poids = 1.0 - Dans / FMath::Max(1e-3, static_cast<double>(MonteeIK));
		}
		else if (Dans < 0.0 && -Dans <= DescenteIK)
		{
			Poids = 1.0 + Dans / FMath::Max(1e-3, static_cast<double>(DescenteIK));
		}
		PoidsIKContact = static_cast<float>(FMath::Clamp(Poids, 0.0, 1.0));
	}
	else
	{
		TempsAvantContact = 0.f;
		GenreContact = ELFGenreContact::Aucun;
		Surface = ELFSurface::Aucune;
		QualiteControle = ELFQualiteControle::Aucune;
		bPiedFaible = false;
		PoidsIKContact = 0.f;
	}

	// §73 ce que le moteur fait faire au joueur
	FamilleAttendue = static_cast<ELFFamille>(static_cast<uint8>(lf::familleAttendue(C, Code, T)));

	// §44 le corps
	TypeCorps = J->TypeCorps;
	Explosivite = J->Explosivite;
	Agilite = J->Agilite;
	Equilibre = J->Equilibre;
	Foulee = J->Foulee;
}
