#include "LFAnimInstanceFootballeur.h"

#include "Containers/StringConv.h"
#include "Engine/World.h"

#include "LFFootballeur.h"
#include "LFMatchSubsystem.h"

#include "LFCore/LFContact.h"
#include "LFCore/LFFamilles.h"
#include "LFCore/LFCorps.h"
#include "LFCore/LFLocomotion.h"
#include "LFCore/LFPhysiologie.h"
#include "LFCore/LFRegard.h"
#include "LFCore/LFRepere.h"
#include "LFCore/LFVisage.h"

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
	TypeCourse = static_cast<ELFTypeCourse>(static_cast<uint8>(D.type));
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

	// §26 §27 le regard ; §4 (qualité visuelle) la tête et les yeux séparés du corps
	const lf::Regard R = lf::cibleRegard(C, Code, T);
	bRegardValide = R.valide;
	if (R.valide)
	{
		// le ballon : son centre, un rayon au-dessus du point bas que donne le moteur
		const bool VersBallon = R.source == lf::SourceRegard::Ballon || R.source == lf::SourceRegard::PasseAttendue;
		const double ZCible = R.z + (VersBallon ? lf::kRayonBallonM : 0.0);
		CibleRegard = M->PositionMonde(R.x, R.y, ZCible);
		SourceRegard = static_cast<ELFSourceRegard>(static_cast<uint8>(R.source));
		// les yeux d'un joueur de 1,80 m sont à 1,68 m ; Echelle est sa taille / 1,80 m
		const lf::OrientationRegard O = lf::orienterRegard(E.x, E.y, E.angleCorps, 1.68 * static_cast<double>(J->Echelle), R.x, R.y, ZCible);
		LacetTete = static_cast<float>(O.lacetTeteDeg);
		TangageTete = static_cast<float>(O.tangageTeteDeg);
		LacetYeux = static_cast<float>(O.lacetYeuxDeg);
		TangageYeux = static_cast<float>(O.tangageYeuxDeg);
		bCibleHorsDeVue = O.horsDeVue;
	}
	else
	{
		LacetTete = TangageTete = LacetYeux = TangageYeux = 0.f;
		bCibleHorsDeVue = false;
	}

	// §19 §21 (qualité visuelle) la foulée de ce corps et le buste
	const lf::Foulee F = lf::foulee(static_cast<double>(J->LongueurJambeCm) / 100.0, static_cast<double>(J->Explosivite), D.vitesse,
		D.accelerationLongitudinale);
	LongueurPas = static_cast<float>(F.longueurPasM * 100.0);
	Cadence = static_cast<float>(F.cadenceHz);
	InclinaisonBuste = static_cast<float>(F.inclinaisonDeg);

	// §25 §26 (qualité visuelle) le visage et le geste
	if (const lf::ChroniqueVisages* Vis = M->Visages())
	{
		const lf::EtatVisage V = Vis->etat(Code, T);
		const auto Poids = [&V](lf::Expression X) { return static_cast<float>(V.poids[static_cast<std::size_t>(X)]); };
		PoidsConcentration = Poids(lf::Expression::Concentration);
		PoidsFrustration = Poids(lf::Expression::Frustration);
		PoidsJoie = Poids(lf::Expression::Joie);
		PoidsColere = Poids(lf::Expression::Colere);
		PoidsDouleur = Poids(lf::Expression::Douleur);
		PoidsSurprise = Poids(lf::Expression::Surprise);
		PoidsSoulagement = Poids(lf::Expression::Soulagement);
		PoidsFatigueVisage = Poids(lf::Expression::Fatigue);
		ExpressionDominante = static_cast<ELFExpression>(static_cast<uint8>(V.dominante));
		Geste = static_cast<ELFGeste>(static_cast<uint8>(V.geste));
		PoidsGeste = static_cast<float>(V.poidsGeste);
		TempsGeste = static_cast<float>(V.tempsGeste);
	}

	// §3 §24 (qualité visuelle) le souffle, la sueur, la pluie, la posture de fatigue
	if (const lf::ChroniquePhysiologie* Phy = M->Physiologie())
	{
		const lf::EtatPhysiologique S = Phy->etat(Code, T);
		Essoufflement = static_cast<float>(S.essoufflement);
		FrequenceRespiration = static_cast<float>(S.frequenceRespiration);
		AmplitudeRespiration = static_cast<float>(S.amplitudeRespiration);
		Transpiration = static_cast<float>(S.transpiration);
		Humidite = static_cast<float>(S.humidite);
		PostureFatigue = static_cast<float>(S.postureFatigue);
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

	// §27 (qualité visuelle) le caractère
	if (const lf::FicheJoueur* Fi = J->Fiche())
	{
		Agressivite = static_cast<float>(Fi->personnalite.agressivite);
		Calme = static_cast<float>(Fi->personnalite.calme);
		Expressivite = static_cast<float>(Fi->personnalite.expressivite);
		EnergieCaractere = static_cast<float>(Fi->personnalite.energie);
		Confiance = static_cast<float>(Fi->personnalite.confiance);
	}
}
