// Les tests d'automatisation de LinkFoot dans Unreal (Outils > Automatisation, groupe LinkFoot ;
// ou en ligne de commande : -ExecCmds="Automation RunTest LinkFoot;Quit").
//
// Ils rejouent, dans Unreal, une partie de ce que unreal/tests-coeur vérifie hors d'Unreal : les
// seize scènes montrent ce que leur nom promet, le repère d'Unreal est celui de la passerelle, la
// trajectoire donnée à Motion Matching est celle que le moteur a jouée, l'état du match se lit,
// et ce que le cahier « qualité visuelle » demande au corps se calcule dans Unreal comme dehors.
#include "Misc/AutomationTest.h"

#if WITH_DEV_AUTOMATION_TESTS

#include "Misc/FileHelper.h"

#include "LFAnimInstanceFootballeur.h"
#include "LFMatchSubsystem.h"

#include "LFCore/LFCinematique.h"
#include "LFCore/LFCorps.h"
#include "LFCore/LFDocument.h"
#include "LFCore/LFEtatMatch.h"
#include "LFCore/LFPhysiologie.h"
#include "LFCore/LFRegard.h"
#include "LFCore/LFRepere.h"
#include "LFCore/LFScene.h"
#include "LFCore/LFVisage.h"

#include <memory>
#include <string_view>

namespace
{
	bool ChargerSceneTest(const FString& Fichier, lf::DocumentMatch& Doc, FString& Erreur)
	{
		TArray<uint8> Octets;
		if (!FFileHelper::LoadFileToArray(Octets, *(ULFMatchSubsystem::DossierScenes() / Fichier), 0))
		{
			Erreur = TEXT("fichier illisible");
			return false;
		}
		const std::string_view Texte(reinterpret_cast<const char*>(Octets.GetData()), static_cast<std::size_t>(Octets.Num()));
		const lf::ResultatChargement R = lf::chargerDocument(Texte, Doc);
		Erreur = ULFMatchSubsystem::Texte(R.erreur);
		return R.ok;
	}
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FLFTestScenes, "LinkFoot.Coeur.Scenes", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FLFTestScenes::RunTest(const FString& Parameters)
{
	const TArray<FString> Fichiers = ULFMatchSubsystem::ListerScenes();
	TestEqual(TEXT("les seize scenes sont dans Content/LinkFoot/Scenes"), Fichiers.Num(), 16);
	for (const FString& Fichier : Fichiers)
	{
		lf::DocumentMatch Doc;
		FString Erreur;
		const bool Lu = ChargerSceneTest(Fichier, Doc, Erreur);
		if (!TestTrue(Fichier + TEXT(" se lit ") + Erreur, Lu))
		{
			continue;
		}
		const lf::Cinematique C(Doc);
		const lf::VerdictScene V = lf::verifierScene(Doc, C);
		TestTrue(Fichier + TEXT(" : ") + ULFMatchSubsystem::Texte(V.detail), V.ok);
	}
	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FLFTestRepere, "LinkFoot.Match.Repere", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FLFTestRepere::RunTest(const FString& Parameters)
{
	// le centre du terrain du moteur est l'origine ; le but de y = 0 est vers +X
	TestTrue(TEXT("le rond central est a l'origine"), ULFMatchSubsystem::VersUnreal(34.0, 52.5, 0.0).Equals(FVector::ZeroVector, 1e-6));
	TestTrue(TEXT("le but de y = 0 est a +X, 52,5 m"), ULFMatchSubsystem::VersUnreal(34.0, 0.0, 0.0).Equals(FVector(5250.0, 0.0, 0.0), 1e-6));
	TestTrue(TEXT("x = 68 est a +Y"), ULFMatchSubsystem::VersUnreal(68.0, 52.5, 0.0).Equals(FVector(0.0, 3400.0, 0.0), 1e-6));
	// un corps tourné vers y décroissant (angle -pi/2) regarde +X : lacet 0
	TestEqual(TEXT("regarder le but de y = 0 : lacet 0"), ULFMatchSubsystem::LacetUnreal(-lf::kPiLF / 2.0), 0.f, 1e-4f);
	TestEqual(TEXT("regarder x croissant : lacet 90"), ULFMatchSubsystem::LacetUnreal(0.0), 90.f, 1e-4f);
	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FLFTestTrajectoire, "LinkFoot.Joueur.Trajectoire", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FLFTestTrajectoire::RunTest(const FString& Parameters)
{
	const TArray<FString> Fichiers = ULFMatchSubsystem::ListerScenes();
	if (!TestTrue(TEXT("au moins une scene"), Fichiers.Num() > 0))
	{
		return true;
	}
	lf::DocumentMatch Doc;
	FString Erreur;
	if (!TestTrue(TEXT("la scene 1 se lit"), ChargerSceneTest(Fichiers[0], Doc, Erreur)))
	{
		return true;
	}
	const lf::Cinematique C(Doc);
	const int32 Code = Doc.scene.focus;
	const double T = Doc.scene.instant;
	FTransformTrajectory Trajectoire;
	lf::ParametresTrajectoire P;
	ULFAnimInstanceFootballeur::ConstruireTrajectoire(C, Code, T, P, FTransform::Identity, 0.f, Trajectoire);
	TestEqual(TEXT("10 echantillons de passe, le present, 8 de futur"), Trajectoire.Samples.Num(), 19);
	bool Croissant = true, Fidele = true;
	for (int32 i = 0; i < Trajectoire.Samples.Num(); ++i)
	{
		const FTransformTrajectorySample& S = Trajectoire.Samples[i];
		if (i > 0 && S.TimeInSeconds <= Trajectoire.Samples[i - 1].TimeInSeconds)
		{
			Croissant = false;
		}
		// chaque échantillon est la position que le moteur a jouée à cet instant (à 1 cm près)
		const lf::EtatCinematique E = C.etat(Code, T + S.TimeInSeconds);
		if (E.valide && !E.horsSegment && !S.Position.Equals(ULFMatchSubsystem::VersUnreal(E.x, E.y, 0.0), 1.0))
		{
			Fidele = false;
		}
	}
	TestTrue(TEXT("les echantillons sont dans l'ordre du temps"), Croissant);
	TestTrue(TEXT("chaque echantillon est la position du moteur a cet instant"), Fidele);
	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FLFTestEtat, "LinkFoot.Match.Etat", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FLFTestEtat::RunTest(const FString& Parameters)
{
	const TArray<FString> Fichiers = ULFMatchSubsystem::ListerScenes();
	for (const FString& Fichier : Fichiers)
	{
		lf::DocumentMatch Doc;
		FString Erreur;
		if (!ChargerSceneTest(Fichier, Doc, Erreur))
		{
			continue;
		}
		const lf::Cinematique C(Doc);
		const lf::ChroniqueMatch Chronique(C);
		const lf::EtatMatch Debut = Chronique.etat(Doc.images.front().temps());
		const lf::EtatMatch Fin = Chronique.etat(Doc.images.back().temps());
		TestTrue(Fichier + TEXT(" : l'etat se lit au debut et a la fin"), Debut.valide && Fin.valide);
		TestTrue(Fichier + TEXT(" : l'horloge avance"), Fin.horloge >= Debut.horloge);
		TestTrue(Fichier + TEXT(" : les statistiques ne reculent pas"), Fin.equipes[0].passes >= Debut.equipes[0].passes && Fin.equipes[1].tirs >= Debut.equipes[1].tirs);
	}
	return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FLFTestQualiteVisuelle, "LinkFoot.Joueur.QualiteVisuelle", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FLFTestQualiteVisuelle::RunTest(const FString& Parameters)
{
	const TArray<FString> Fichiers = ULFMatchSubsystem::ListerScenes();
	for (const FString& Fichier : Fichiers)
	{
		lf::DocumentMatch Doc;
		FString Erreur;
		if (!ChargerSceneTest(Fichier, Doc, Erreur))
		{
			continue;
		}
		const lf::Cinematique C(Doc);
		const lf::ChroniqueVisages Visages(C);
		const lf::ChroniquePhysiologie Physio(C);
		const int32 Code = Doc.scene.focus;
		const double T = Doc.scene.instant;
		const lf::FicheJoueur* F = Doc.ficheA(Code, T);
		if (!TestTrue(Fichier + TEXT(" : la fiche du joueur en avant"), F != nullptr))
		{
			continue;
		}
		// §8 §27 le corps et le caractère viennent de la passerelle
		TestTrue(Fichier + TEXT(" : une taille humaine"), F->morphologie.tailleCm >= 150 && F->morphologie.tailleCm <= 210);
		TestTrue(Fichier + TEXT(" : une longueur de jambe humaine"), lf::profilCorps(*F).longueurJambeM > 0.6 && lf::profilCorps(*F).longueurJambeM < 1.1);
		TestTrue(Fichier + TEXT(" : un caractere"), !F->personnalite.type.empty());
		// §25 le visage, §24 le souffle, §4 la tete et les yeux, a l'instant cle
		const lf::EtatVisage V = Visages.etat(Code, T);
		bool PoidsBornes = V.valide;
		for (const double P : V.poids)
		{
			PoidsBornes = PoidsBornes && P >= 0.0 && P <= 1.0;
		}
		TestTrue(Fichier + TEXT(" : des expressions entre 0 et 1"), PoidsBornes);
		const lf::EtatPhysiologique S = Physio.etat(Code, T);
		TestTrue(Fichier + TEXT(" : une respiration humaine"), S.valide && S.frequenceRespiration >= 10.0 && S.frequenceRespiration <= 70.0);
		const lf::Regard R = lf::cibleRegard(C, Code, T);
		const lf::EtatCinematique E = C.etat(Code, T);
		if (R.valide && E.valide)
		{
			const lf::LimitesRegard L;
			const lf::OrientationRegard O = lf::orienterRegard(E.x, E.y, E.angleCorps, 1.68, R.x, R.y, R.z, L);
			TestTrue(Fichier + TEXT(" : la tete reste dans ses limites"), FMath::Abs(O.lacetTeteDeg) <= L.lacetTeteMaxDeg + 1e-6);
			TestTrue(Fichier + TEXT(" : les yeux restent dans leurs limites"), FMath::Abs(O.lacetYeuxDeg) <= L.lacetYeuxMaxDeg + 1e-6);
		}
	}
	return true;
}

#endif // WITH_DEV_AUTOMATION_TESTS
