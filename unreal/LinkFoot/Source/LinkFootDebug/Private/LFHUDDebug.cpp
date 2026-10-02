#include "LFHUDDebug.h"

#include "Components/SkeletalMeshComponent.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/World.h"
#include "EngineUtils.h"

#include "LFAnimInstanceFootballeur.h"
#include "LFComposantControle.h"
#include "LFFootballeur.h"
#include "LFMatchSubsystem.h"

#include "LFCore/LFContact.h"
#include "LFCore/LFCorps.h"
#include "LFCore/LFFamilles.h"

namespace
{
	FString TexteHUD(const char* Texte)
	{
		return FString(UTF8_TO_TCHAR(Texte));
	}

	FString HorlogeHUD(int32 Secondes)
	{
		return FString::Printf(TEXT("%d:%02d"), Secondes / 60, Secondes % 60);
	}

	const FLinearColor kBlanc(1.f, 1.f, 1.f);
	const FLinearColor kGris(0.72f, 0.75f, 0.8f);
	const FLinearColor kRouge(1.f, 0.28f, 0.28f);
	const FLinearColor kVert(0.45f, 1.f, 0.55f);

	FString NomFamilleHUD(ELFFamille F)
	{
		return TexteHUD(lf::nomFamille(static_cast<lf::Famille>(static_cast<uint8>(F))));
	}
}

void ALFHUDDebug::Ligne(const FString& Texte, float X, float& Y, const FLinearColor& Couleur)
{
	DrawText(Texte, Couleur, X, Y, GEngine ? GEngine->GetSmallFont() : nullptr, TailleTexte, false);
	Y += 15.f * TailleTexte;
}

void ALFHUDDebug::DrawHUD()
{
	Super::DrawHUD();
	UWorld* Monde = GetWorld();
	const ULFMatchSubsystem* M = Monde ? Monde->GetSubsystem<ULFMatchSubsystem>() : nullptr;
	if (!M || !M->EstCharge() || !Canvas)
	{
		return;
	}
	const FLinkFootMatchState E = M->Etat();

	// l'en-tête : la scène, l'horloge, le score, la possession, lus dans le moteur
	float Y = 16.f;
	Ligne(M->Titre(), 16.f, Y, kBlanc);
	Ligne(FString::Printf(TEXT("%s   %d - %d   possession %.0f %%   (%.1f s du moteur)"), *HorlogeHUD(E.Horloge), E.ScoreDomicile, E.ScoreExterieur,
		E.PossessionDomicile, E.TempsMoteur), 16.f, Y, kGris);
	if (E.DerniersEvenements.Num() > 0)
	{
		Ligne(E.DerniersEvenements.Last(), 16.f, Y, kGris);
	}

	const int32 Suivi = JoueurSuivi >= 0 ? JoueurSuivi : M->Focus();
	const ALFFootballeur* DuPanneau = nullptr;
	for (TActorIterator<ALFFootballeur> It(Monde); It; ++It)
	{
		const ALFFootballeur* J = *It;
		if (!J || !J->bSurLeTerrain || J->IsHidden())
		{
			continue;
		}
		if (J->Code == Suivi)
		{
			DuPanneau = J;
		}
		if (!bEtiquettes)
		{
			continue;
		}
		const FVector Ecran = Project(J->GetActorLocation() + FVector(0.0, 0.0, 115.0 * J->Echelle), true);
		if (Ecran.Z <= 0.0)
		{
			continue;	// derrière la caméra
		}
		float YL = static_cast<float>(Ecran.Y) - 30.f * TailleTexte;
		const float XL = static_cast<float>(Ecran.X) - 30.f;
		Ligne(FString::Printf(TEXT("#%d %s"), J->Code, *J->Nom), XL, YL, J->Code == Suivi ? kVert : kBlanc);
		if (const ULFAnimInstanceFootballeur* Anim = Cast<ULFAnimInstanceFootballeur>(J->GetMesh()->GetAnimInstance()))
		{
			Ligne(NomFamilleHUD(Anim->FamilleAttendue) + TEXT(" / ") + NomFamilleHUD(Anim->FamilleVue), XL, YL, kGris);
		}
		if (const ULFComposantControle* Controle = J->FindComponentByClass<ULFComposantControle>())
		{
			for (const FString& Alerte : Controle->Alertes())
			{
				Ligne(Alerte, XL, YL, kRouge);
			}
		}
	}
	if (bPanneau && DuPanneau)
	{
		Panneau(*DuPanneau, static_cast<float>(Canvas->ClipX) - 470.f * TailleTexte, 16.f);
	}
}

void ALFHUDDebug::Panneau(const ALFFootballeur& J, float X, float Y)
{
	const lf::FicheJoueur* F = J.Fiche();
	const lf::EtatCinematique& E = J.EtatMoteur();
	const ULFMatchSubsystem* M = J.Match();
	if (!F || !M)
	{
		return;
	}
	// §71 qui il est
	Ligne(FString::Printf(TEXT("JOUEUR #%d  %s"), J.Code, *J.Nom), X, Y, kVert);
	Ligne(FString::Printf(TEXT("%s | %s | %s"), *J.Poste, *J.Role,
		*TexteHUD(lf::nomTypeCorps(static_cast<lf::TypeCorps>(static_cast<uint8>(J.TypeCorps))))), X, Y, kGris);
	Ligne(FString::Printf(TEXT("carte %lld | personnage %s"), static_cast<long long>(F->carte), *J.Personnage), X, Y, kGris);

	// §71 ce que fait son corps dans le moteur
	const double Vitesse = FMath::Sqrt(E.vx * E.vx + E.vy * E.vy);
	Ligne(FString::Printf(TEXT("position %.2f, %.2f m | vitesse %.2f m/s (pointe %.2f)"), E.x, E.y, Vitesse,
		M->Document()->vitesseMax(J.Code, J.TempsMoteur())), X, Y, kBlanc);
	Ligne(FString::Printf(TEXT("%s %.1f m/s2 | lacet %.0f"), *TexteHUD("accélération"), E.accelerationLongitudinale, M->LacetMonde(E.angleCorps)), X, Y, kBlanc);
	const lf::DocumentMatch& Doc = *M->Document();
	if (!Doc.cibles.empty() && E.image >= 0)
	{
		const std::size_t B = static_cast<std::size_t>(E.image) * static_cast<std::size_t>(lf::kChampsCibles) + static_cast<std::size_t>(J.Code) * 2;
		if (B + 1 < Doc.cibles.size())
		{
			const double CX = Doc.cibles[B], CY = Doc.cibles[B + 1];
			Ligne(FString::Printf(TEXT("cible de l'IA %.1f, %.1f m (%.1f m)"), CX, CY, FMath::Sqrt((CX - E.x) * (CX - E.x) + (CY - E.y) * (CY - E.y))), X, Y, kBlanc);
		}
	}

	// §71 sa dernière décision (mode débogage) : ce qu'il a choisi, et ce qu'il a écarté
	if (const lf::Decision* Delib = Doc.derniereDecision(J.Code, J.TempsMoteur(), 3.0))
	{
		FString Choix = ULFMatchSubsystem::Texte(lf::texteOption(Delib->choix)) + FString::Printf(TEXT(" %.3f"), Delib->choix.ev);
		if (Delib->rang > 0)
		{
			Choix += FString::Printf(TEXT(" (%de option)"), Delib->rang + 1);
		}
		if (Delib->bascule)
		{
			Choix += TexteHUD(" : sa compétence a fait basculer le choix");
		}
		Ligne(FString::Printf(TEXT("%s, il y a %.1f s : %s"), *TexteHUD("décision"), J.TempsMoteur() - Delib->t, *Choix), X, Y, kBlanc);
		FString Ecartees;
		for (const lf::OptionDecision& O : Delib->autres)
		{
			Ecartees += (Ecartees.IsEmpty() ? TEXT("") : TEXT(" ; ")) + ULFMatchSubsystem::Texte(lf::texteOption(O)) + FString::Printf(TEXT(" %.3f"), O.ev);
		}
		if (!Ecartees.IsEmpty())
		{
			Ligne(TexteHUD("écartées : ") + Ecartees, X, Y, kGris);
		}
	}

	// §71 l'action, l'animation, la compétence, la tactique
	if (const ULFAnimInstanceFootballeur* Anim = Cast<ULFAnimInstanceFootballeur>(J.GetMesh()->GetAnimInstance()))
	{
		Ligne(FString::Printf(TEXT("attendu %s | vu %s %s"), *NomFamilleHUD(Anim->FamilleAttendue), *NomFamilleHUD(Anim->FamilleVue), *Anim->AnimationVue), X, Y, kBlanc);
		if (Anim->bContact)
		{
			Ligne(FString::Printf(TEXT("contact %s, %s dans %.2f s | ballon %.0f devant, %.0f %s, %.0f de haut (cm)"),
				*TexteHUD(lf::nomGenreContact(static_cast<lf::GenreContact>(static_cast<uint8>(Anim->GenreContact)))),
				*TexteHUD(lf::nomSurface(static_cast<lf::Surface>(static_cast<uint8>(Anim->Surface)))),
				Anim->TempsAvantContact, Anim->PointContactLocal.X, Anim->PointContactLocal.Y, *TexteHUD("à droite"), Anim->PointContactLocal.Z), X, Y, kBlanc);
		}
	}
	FString Competences;
	for (const lf::Competence& C : F->competences)
	{
		Competences += (Competences.IsEmpty() ? TEXT("") : TEXT(", ")) + ULFMatchSubsystem::Texte(C.nom);
	}
	Ligne(TexteHUD("compétences : ") + (Competences.IsEmpty() ? FString(TEXT("-")) : Competences), X, Y, kGris);
	Ligne(FString::Printf(TEXT("tactique : %s | %s"), *ULFMatchSubsystem::Texte(F->devoir), *ULFMatchSubsystem::Texte(F->posteTactique)), X, Y, kGris);
	Ligne(FString::Printf(TEXT("fatigue %.0f %% | forme %d | moral %d"), 100.0 - E.energie, F->etat.forme, F->etat.moral), X, Y, kGris);

	// §72 à §75, §82 ce que disent les détecteurs
	if (const ULFComposantControle* Controle = J.FindComponentByClass<ULFComposantControle>())
	{
		Ligne(FString::Printf(TEXT("%s %.0f cm (max %.0f) | %s %d | animation %d | pieds %d | mouvements %d"), *TexteHUD("écart au moteur"),
			Controle->EcartCm, Controle->EcartMaxCm, *TexteHUD("désynchros"), Controle->Desynchros, Controle->DesynchrosAnimation, Controle->GlissementsPied, Controle->Anomalies), X, Y, kGris);
		Ligne(FString::Printf(TEXT("contacts %d %s, %d %s | dernier %.0f cm du ballon"), Controle->ContactsJuges, *TexteHUD("jugés"),
			Controle->ContactsManques, *TexteHUD("manqués"), Controle->EcartContactCm), X, Y, kGris);
		if (!Controle->bAnimationSignalee)
		{
			Ligne(TexteHUD("animation non signalée : appeler SignalerAnimationChoisie dans l'AnimBP"), X, Y, kGris);
		}
		for (const FString& Alerte : Controle->Alertes())
		{
			Ligne(Alerte, X, Y, kRouge);
		}
	}
}
