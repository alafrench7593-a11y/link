#include "LFComposantControle.h"

#include "Components/SkeletalMeshComponent.h"
#include "Engine/World.h"

#include "LFAnimInstanceFootballeur.h"
#include "LFFootballeur.h"
#include "LFMatchSubsystem.h"

#include "LFCore/LFContact.h"
#include "LFCore/LFFamilles.h"
#include "LFCore/LFRepere.h"

namespace
{
	// Un point du monde (cm) dans le repère du moteur (m).
	void VersMoteurControle(const ULFMatchSubsystem& M, const FVector& Monde, double& X, double& Y)
	{
		const FVector Local = M.RepereTerrain().InverseTransformPosition(Monde);
		lf::PointUE P;
		P.X = Local.X;
		P.Y = Local.Y;
		P.Z = Local.Z;
		double Z = 0.0;
		lf::depuisUnreal(P, X, Y, Z);
	}

	FString TexteControle(const char* Texte)
	{
		return FString(UTF8_TO_TCHAR(Texte));
	}
}

ULFComposantControle::ULFComposantControle()
{
	PrimaryComponentTick.bCanEverTick = true;
	// après l'animation : les os sont ceux de cette image
	PrimaryComponentTick.TickGroup = TG_PostUpdateWork;
}

void ULFComposantControle::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
	const ALFFootballeur* J = Cast<ALFFootballeur>(GetOwner());
	if (!J || !J->bSurLeTerrain)
	{
		DernierTemps = -1.0;
		return;
	}
	const ULFMatchSubsystem* M = J->Match();
	const USkeletalMeshComponent* Corps = J->GetMesh();
	if (!M || !M->EstCharge() || !Corps)
	{
		return;
	}
	if (M->Sauts() != SautsVus)
	{
		// un saut dans le temps (la scène reboucle, on revient en arrière) : la comparaison
		// reprend de là, sinon elle attendrait de repasser l'instant d'avant le saut
		SautsVus = M->Sauts();
		DernierTemps = -1.0;
	}
	const double T = J->TempsMoteur();
	if (T <= DernierTemps)
	{
		return;	// en pause : rien de neuf à comparer
	}
	DernierTemps = T;
	if (J->bCoupe)
	{
		// le moteur a replacé le joueur : on repart de zéro
		Position.reinitialiser();
		Animation.reinitialiser();
		PiedGauche.reinitialiser();
		PiedDroit.reinitialiser();
		Mouvement.couper();
		Contact.reinitialiser();
	}

	// §72 le corps vu (l'os racine) contre la position du moteur
	const lf::EtatCinematique& E = J->EtatMoteur();
	const FVector Racine = Corps->GetBoneIndex(OsRacine) != INDEX_NONE ? Corps->GetSocketLocation(OsRacine) : Corps->GetComponentLocation();
	double VuX = 0.0, VuY = 0.0;
	VersMoteurControle(*M, Racine, VuX, VuY);
	StatutPosition = static_cast<ELFStatut>(static_cast<uint8>(Position.ajouter(T, E.x, E.y, VuX, VuY)));
	EcartCm = static_cast<float>(Position.ecart() * 100.0);
	EcartMaxCm = static_cast<float>(Position.ecartMax() * 100.0);
	Desynchros = Position.desynchros();

	// §75 le mouvement du corps vu
	const lf::Anomalie A = Mouvement.ajouter(T, VuX, VuY, J->GetActorRotation().Yaw);
	if (A != lf::Anomalie::Aucune)
	{
		DerniereAnomalie = static_cast<ELFAnomalie>(static_cast<uint8>(A));
		TempsAnomalie = T;
	}
	else if (T - TempsAnomalie > 2.0)
	{
		DerniereAnomalie = ELFAnomalie::Aucune;	// l'alerte reste affichée deux secondes
	}
	Anomalies = Mouvement.total();

	// §73 la famille de l'animation choisie contre celle que le moteur attend
	if (const ULFAnimInstanceFootballeur* Anim = Cast<ULFAnimInstanceFootballeur>(Corps->GetAnimInstance()))
	{
		bAnimationSignalee = Anim->FamilleVue != ELFFamille::Inconnue;
		if (bAnimationSignalee)
		{
			const lf::Famille Attendue = static_cast<lf::Famille>(static_cast<uint8>(Anim->FamilleAttendue));
			const lf::Famille Vue = static_cast<lf::Famille>(static_cast<uint8>(Anim->FamilleVue));
			StatutAnimation = static_cast<ELFStatut>(static_cast<uint8>(Animation.ajouter(T, Attendue, Vue)));
			DesynchrosAnimation = Animation.desynchros();
		}
	}

	// §74 les pieds
	const double Sol = M->RepereTerrain().GetLocation().Z + HauteurOsPiedPoseCm;
	if (Corps->GetBoneIndex(OsPiedGauche) != INDEX_NONE)
	{
		const FVector P = Corps->GetSocketLocation(OsPiedGauche);
		DefautPiedGauche = static_cast<ELFDefautPied>(static_cast<uint8>(PiedGauche.ajouter(T, P.X, P.Y, P.Z, Sol, -1)));
	}
	if (Corps->GetBoneIndex(OsPiedDroit) != INDEX_NONE)
	{
		const FVector P = Corps->GetSocketLocation(OsPiedDroit);
		DefautPiedDroit = static_cast<ELFDefautPied>(static_cast<uint8>(PiedDroit.ajouter(T, P.X, P.Y, P.Z, Sol, -1)));
	}
	GlissementsPied = PiedGauche.compte(lf::DefautPied::Glissement) + PiedDroit.compte(lf::DefautPied::Glissement);

	// §82 au contact du moteur, la partie du corps qui joue va-t-elle au ballon ?
	const lf::Contact K = lf::prochainContact(*M->Cinematique(), J->Code, T);
	FName Os, Os2;
	bool AvecOs = false, AvecOs2 = false;
	if (K.valide)
	{
		switch (K.surface)
		{
		case lf::Surface::PiedDroit: Os = OsPiedDroit; AvecOs = true; break;
		case lf::Surface::PiedGauche: Os = OsPiedGauche; AvecOs = true; break;
		case lf::Surface::Tete: Os = OsTete; AvecOs = true; break;
		case lf::Surface::Poitrine: Os = OsPoitrine; AvecOs = true; break;
		case lf::Surface::Mains: Os = OsMainGauche; Os2 = OsMainDroite; AvecOs = true; AvecOs2 = true; break;
		case lf::Surface::Aucune: break;
		}
	}
	AvecOs = AvecOs && Corps->GetBoneIndex(Os) != INDEX_NONE;
	AvecOs2 = AvecOs2 && Corps->GetBoneIndex(Os2) != INDEX_NONE;
	lf::VerdictContact V = lf::VerdictContact::Rien;
	if (AvecOs)
	{
		// le moteur donne le point bas du ballon ; l'écart se mesure jusqu'à sa surface
		constexpr double RayonCm = lf::kRayonBallonM * 100.0;
		const FVector Centre = M->PositionMonde(K.x, K.y, K.z) + FVector(0.0, 0.0, RayonCm);
		double Distance = (Corps->GetSocketLocation(Os) - Centre).Size();
		if (AvecOs2)
		{
			Distance = FMath::Min(Distance, (Corps->GetSocketLocation(Os2) - Centre).Size());
		}
		V = Contact.ajouter(K.action, K.dans, FMath::Max(0.0, Distance - RayonCm));
	}
	else
	{
		V = Contact.aucun();
	}
	if (V == lf::VerdictContact::Manque)
	{
		TempsContactManque = T;
		EcartContactManqueCm = static_cast<float>(Contact.dernierEcartCm());
	}
	bAlerteContact = T - TempsContactManque <= 2.0;	// l'alerte reste affichée deux secondes
	ContactsJuges = Contact.juges();
	ContactsManques = Contact.manques();
	EcartContactCm = static_cast<float>(Contact.dernierEcartCm());
}

lf::BilanQualite ULFComposantControle::Bilan() const
{
	lf::BilanQualite B;
	B.desynchros = Desynchros - Depart.desynchros;
	B.desynchrosAnimation = DesynchrosAnimation - Depart.desynchrosAnimation;
	B.glissementsPied = GlissementsPied - Depart.glissementsPied;
	B.mouvementsImpossibles = Anomalies - Depart.mouvementsImpossibles;
	B.contactsJuges = ContactsJuges - Depart.contactsJuges;
	B.contactsManques = ContactsManques - Depart.contactsManques;
	B.animationSignalee = bAnimationSignalee;
	return B;
}

void ULFComposantControle::DebuterBilan()
{
	Depart.desynchros = Desynchros;
	Depart.desynchrosAnimation = DesynchrosAnimation;
	Depart.glissementsPied = GlissementsPied;
	Depart.mouvementsImpossibles = Anomalies;
	Depart.contactsJuges = ContactsJuges;
	Depart.contactsManques = ContactsManques;
}

TArray<FString> ULFComposantControle::Alertes() const
{
	TArray<FString> R;
	if (StatutPosition == ELFStatut::Desynchro)
	{
		R.Add(FString::Printf(TEXT("DESYNC %.0f cm"), EcartCm));
	}
	if (StatutAnimation == ELFStatut::Desynchro)
	{
		R.Add(TEXT("ANIMATION DESYNC"));
	}
	if (DefautPiedGauche == ELFDefautPied::Glissement || DefautPiedDroit == ELFDefautPied::Glissement)
	{
		R.Add(TEXT("FOOT SLIDE WARNING"));
	}
	if (DefautPiedGauche == ELFDefautPied::Penetration || DefautPiedDroit == ELFDefautPied::Penetration)
	{
		R.Add(TexteControle("PIED SOUS LE SOL"));
	}
	if (DefautPiedGauche == ELFDefautPied::Flottement || DefautPiedDroit == ELFDefautPied::Flottement)
	{
		R.Add(TexteControle("PIED QUI FLOTTE"));
	}
	if (bAlerteContact)
	{
		R.Add(FString::Printf(TEXT("%s %.0f cm"), UTF8_TO_TCHAR("CONTACT MANQUÉ"), EcartContactManqueCm));
	}
	if (DerniereAnomalie != ELFAnomalie::Aucune)
	{
		R.Add(FString::Printf(TEXT("IMPOSSIBLE MOVEMENT : %s"), UTF8_TO_TCHAR(lf::nomAnomalie(static_cast<lf::Anomalie>(static_cast<uint8>(DerniereAnomalie))))));
	}
	return R;
}
