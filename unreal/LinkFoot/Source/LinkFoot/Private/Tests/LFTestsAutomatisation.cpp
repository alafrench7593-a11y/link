// Les tests d'automatisation de LinkFoot dans Unreal (Outils > Automatisation, groupe LinkFoot ;
// ou en ligne de commande : -ExecCmds="Automation RunTest LinkFoot;Quit").
//
// Ils rejouent, dans Unreal, une partie de ce que unreal/tests-coeur vérifie hors d'Unreal : les
// seize scènes montrent ce que leur nom promet, le repère d'Unreal est celui de la passerelle, la
// trajectoire donnée à Motion Matching est celle que le moteur a jouée, l'état du match se lit.
#include "Misc/AutomationTest.h"

#if WITH_DEV_AUTOMATION_TESTS

#include "Misc/FileHelper.h"

#include "LFAnimInstanceFootballeur.h"
#include "LFMatchSubsystem.h"

#include "LFCore/LFCinematique.h"
#include "LFCore/LFDocument.h"
#include "LFCore/LFEtatMatch.h"
#include "LFCore/LFRepere.h"
#include "LFCore/LFScene.h"

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

#endif // WITH_DEV_AUTOMATION_TESTS
