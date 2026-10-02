#include "LFMatchSubsystem.h"

#include "HAL/FileManager.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"

#include "LFCore/LFFamilles.h"
#include "LFCore/LFRepere.h"

#include <string_view>

namespace
{
	// Les tables du contrat (src/passerelle.js, PASSERELLE()) : même ordre.
	const TCHAR* const kIntentions[] = { TEXT(""), TEXT("HOLD"), TEXT("SUPPORT"), TEXT("BUILD_UP"), TEXT("ATTACK_SPACE"), TEXT("DROP"),
		TEXT("OVERLAP"), TEXT("RECOVER"), TEXT("MARK"), TEXT("COVER") };
	const TCHAR* const kCpa[] = { TEXT(""), TEXT("ko"), TEXT("corner"), TEXT("fkc"), TEXT("fkd"), TEXT("fk"), TEXT("throw"), TEXT("gk"), TEXT("pen") };

	// Le lissage de la cinématique : il étale les à-coups des contacts du moteur sans jamais
	// s'écarter de plus de 25 cm de ses positions (la tolérance du contrat est de 30 cm).
	constexpr double kLissageS = 0.08;

	FLFStatsEquipe VersStatsEquipe(const lf::StatsEquipe& S)
	{
		FLFStatsEquipe R;
		R.Buts = S.buts;
		R.Tirs = S.tirs;
		R.TirsCadres = S.tirsCadres;
		R.XG = static_cast<float>(S.xg);
		R.Passes = S.passes;
		R.PassesReussies = S.passesReussies;
		R.Corners = S.corners;
		R.Fautes = S.fautes;
		R.Jaunes = S.jaunes;
		R.Rouges = S.rouges;
		R.HorsJeu = S.horsJeu;
		R.Tacles = S.tacles;
		return R;
	}

	FLFTactique VersTactique(const lf::Equipe& E)
	{
		FLFTactique T;
		T.Club = ULFMatchSubsystem::Texte(E.club);
		T.Formation = ULFMatchSubsystem::Texte(E.formation);
		T.Style = ULFMatchSubsystem::Texte(E.style);
		T.Mentalite = E.mentalite;
		for (const auto& Reglage : E.tactique)
		{
			T.Reglages.Add(FName(*ULFMatchSubsystem::Texte(Reglage.first)), static_cast<float>(Reglage.second));
		}
		return T;
	}
}

void ULFMatchSubsystem::Deinitialize()
{
	Vider();
	Super::Deinitialize();
}

void ULFMatchSubsystem::Vider()
{
	// la chronique lit la cinématique, qui lit le document : on les détruit dans l'autre sens
	Chron.Reset();
	Cine.Reset();
	Doc.Reset();
}

FString ULFMatchSubsystem::DossierScenes()
{
	return FPaths::Combine(FPaths::ProjectContentDir(), TEXT("LinkFoot"), TEXT("Scenes"));
}

TArray<FString> ULFMatchSubsystem::ListerScenes()
{
	TArray<FString> Fichiers;
	IFileManager::Get().FindFiles(Fichiers, *(DossierScenes() / TEXT("*.json")), true, false);
	Fichiers.Remove(TEXT("index.json"));
	Fichiers.Sort();
	return Fichiers;
}

bool ULFMatchSubsystem::ChargerFichier(const FString& Chemin, FString& Erreur)
{
	const FString Complet = FPaths::IsRelative(Chemin) ? DossierScenes() / Chemin : Chemin;
	TArray<uint8> Octets;
	if (!FFileHelper::LoadFileToArray(Octets, *Complet, 0))
	{
		Erreur = FString::Printf(TEXT("Fichier illisible : %s"), *Complet);
		return false;
	}
	return ChargerOctets(Complet, Octets, Erreur);
}

bool ULFMatchSubsystem::ChargerScene(int32 Numero, FString& Erreur)
{
	const FString Prefixe = FString::Printf(TEXT("%02d-"), Numero);
	for (const FString& Fichier : ListerScenes())
	{
		if (Fichier.StartsWith(Prefixe))
		{
			return ChargerFichier(Fichier, Erreur);
		}
	}
	Erreur = FString::Printf(TEXT("%s %d : %s"), *Texte("Aucune scène de numéro"), Numero, *DossierScenes());
	return false;
}

bool ULFMatchSubsystem::ChargerOctets(const FString& Nom, const TArray<uint8>& Octets, FString& Erreur)
{
	TUniquePtr<lf::DocumentMatch> Nouveau = MakeUnique<lf::DocumentMatch>();
	const std::string_view Texte(reinterpret_cast<const char*>(Octets.GetData()), static_cast<std::size_t>(Octets.Num()));
	const lf::ResultatChargement Lu = lf::chargerDocument(Texte, *Nouveau);
	if (!Lu.ok)
	{
		Erreur = FString::Printf(TEXT("%s : %s"), *Nom, *ULFMatchSubsystem::Texte(Lu.erreur));
		return false;
	}
	if (Nouveau->images.empty())
	{
		Erreur = FString::Printf(TEXT("%s : aucune image"), *Nom);
		return false;
	}
	Vider();
	Doc = MoveTemp(Nouveau);
	lf::ParametresCinematique Parametres;
	Parametres.lissageS = kLissageS;
	Cine = MakeUnique<lf::Cinematique>(*Doc, Parametres);
	Chron = MakeUnique<lf::ChroniqueMatch>(*Cine);
	TempsCourant = Doc->estScene ? Doc->scene.t0 : Debut();
	++GenerationCourante;
	Source = Nom;
	return true;
}

bool ULFMatchSubsystem::EstCharge() const
{
	return Doc.IsValid() && Cine.IsValid() && Chron.IsValid();
}

double ULFMatchSubsystem::Debut() const
{
	return EstCharge() ? Doc->images.front().temps() : 0.0;
}

double ULFMatchSubsystem::Fin() const
{
	return EstCharge() ? Doc->images.back().temps() : 0.0;
}

void ULFMatchSubsystem::DefinirTemps(double T)
{
	const double Nouveau = EstCharge() ? FMath::Clamp(T, Debut(), Fin()) : 0.0;
	if (FMath::Abs(Nouveau - TempsCourant) > 0.5)
	{
		++SautsCourants;	// pas un pas de lecture : un saut
	}
	TempsCourant = Nouveau;
}

void ULFMatchSubsystem::Avancer(double Secondes)
{
	const double Nouveau = EstCharge() ? FMath::Clamp(TempsCourant + Secondes, Debut(), Fin()) : 0.0;
	TempsCourant = Nouveau;	// la lecture avance par petits pas, jamais un saut
}

FString ULFMatchSubsystem::Titre() const
{
	if (!EstCharge())
	{
		return FString();
	}
	if (Doc->estScene)
	{
		return FString::Printf(TEXT("%d. %s"), Doc->scene.numero, *Texte(Doc->scene.titre));
	}
	return FString::Printf(TEXT("%s - %s"), *Texte(Doc->equipes[0].club), *Texte(Doc->equipes[1].club));
}

int32 ULFMatchSubsystem::Focus() const
{
	return EstCharge() && Doc->estScene ? Doc->scene.focus : -1;
}

double ULFMatchSubsystem::InstantCle() const
{
	return EstCharge() && Doc->estScene ? Doc->scene.instant : TempsCourant;
}

FLinkFootMatchState ULFMatchSubsystem::Etat() const
{
	return EtatA(TempsCourant);
}

FLinkFootMatchState ULFMatchSubsystem::EtatA(double T) const
{
	FLinkFootMatchState R;
	if (!EstCharge())
	{
		return R;
	}
	const lf::EtatMatch E = Chron->etat(T);
	R.bValide = E.valide;
	R.TempsMoteur = T;
	R.Horloge = E.horloge;
	R.MiTemps = E.miTemps;
	R.ScoreDomicile = E.score[0];
	R.ScoreExterieur = E.score[1];
	R.PossessionDomicile = static_cast<float>(E.possessionDomicile);
	R.Porteur = E.porteur;
	const int32 Cpa = static_cast<int32>(E.cpa);
	R.CoupDePiedArrete = Cpa > 0 && Cpa < static_cast<int32>(UE_ARRAY_COUNT(kCpa)) ? FName(kCpa[Cpa]) : NAME_None;
	R.PositionBallon = PositionMonde(E.ballon.x, E.ballon.y, E.ballon.z);
	R.VitesseBallon = VecteurMonde(E.ballon.vx, E.ballon.vy, E.ballon.vz);
	R.bBallonEnVol = E.ballon.enVol;
	R.StatsDomicile = VersStatsEquipe(E.equipes[0]);
	R.StatsExterieur = VersStatsEquipe(E.equipes[1]);
	R.TactiqueDomicile = VersTactique(Doc->equipes[0]);
	R.TactiqueExterieur = VersTactique(Doc->equipes[1]);
	R.Meteo = Texte(Doc->meteo);
	R.bTermine = E.termine;

	R.Joueurs.Reserve(lf::kJoueurs);
	for (int32 Code = 0; Code < lf::kJoueurs; ++Code)
	{
		FLFEtatJoueur J;
		J.Code = Code;
		if (const lf::FicheJoueur* Fiche = Doc->ficheA(Code, T))
		{
			J.Personnage = Texte(Fiche->personnage);
			J.Nom = Texte(Fiche->nom);
		}
		const lf::EtatCinematique C = Cine->etat(Code, T);
		J.bSurLeTerrain = C.valide;
		if (C.valide)
		{
			J.Position = PositionMonde(C.x, C.y, 0.0);
			J.Vitesse = VecteurMonde(C.vx, C.vy, 0.0);
			J.Acceleration = VecteurMonde(C.ax, C.ay, 0.0);
			J.Lacet = LacetMonde(C.angleCorps);
			J.Energie = static_cast<float>(C.energie);
			J.bAuSol = (C.etats & lf::etat::AuSol) != 0;
			J.bDesequilibre = (C.etats & lf::etat::Desequilibre) != 0;
			J.bPorteur = (C.etats & lf::etat::Porteur) != 0;
			J.bSprint = (C.etats & lf::etat::Sprint) != 0;
			J.bPresse = (C.etats & lf::etat::Presse) != 0;
			J.bAppel = (C.etats & lf::etat::Appel) != 0;
			J.bDribble = (C.etats & lf::etat::Dribble) != 0;
			J.Intention = C.intention < UE_ARRAY_COUNT(kIntentions) ? FName(kIntentions[C.intention]) : NAME_None;
			J.FamilleAttendue = static_cast<ELFFamille>(static_cast<uint8>(lf::familleAttendue(*Cine, Code, T)));
		}
		R.Joueurs.Add(J);
	}

	R.StatsJoueurs.Reserve(static_cast<int32>(E.joueurs.size()));
	for (std::size_t F = 0; F < E.joueurs.size() && F < Doc->joueurs.size(); ++F)
	{
		const lf::StatsJoueur& S = E.joueurs[F];
		const lf::FicheJoueur& Fiche = Doc->joueurs[F];
		FLFStatsJoueur J;
		J.Nom = Texte(Fiche.nom);
		J.Personnage = Texte(Fiche.personnage);
		J.bDomicile = Fiche.camp != 'A';
		J.bAJoue = S.aJoue;
		J.Minutes = static_cast<float>(S.minutes);
		J.Buts = S.buts;
		J.PassesDecisives = S.passesDecisives;
		J.Tirs = S.tirs;
		J.TirsCadres = S.tirsCadres;
		J.Passes = S.passes;
		J.PassesReussies = S.passesReussies;
		J.PassesCles = S.passesCles;
		J.Dribbles = S.dribbles;
		J.DribblesReussis = S.dribblesReussis;
		J.Tacles = S.tacles;
		J.Interceptions = S.interceptions;
		J.Duels = S.duels;
		J.DuelsGagnes = S.duelsGagnes;
		J.Fautes = S.fautes;
		J.Pertes = S.pertes;
		J.Arrets = S.arrets;
		J.Jaunes = S.jaunes;
		J.bExclu = S.exclu;
		J.XG = static_cast<float>(S.xg);
		J.XA = static_cast<float>(S.xa);
		J.Note = static_cast<float>(S.note);
		R.StatsJoueurs.Add(J);
	}

	// les derniers bandeaux et commentaires du moteur, du plus ancien au plus récent
	TArray<FString> Derniers;
	for (const lf::Evenement& Ev : Doc->evenements)
	{
		if (Ev.t > T + 1e-9)
		{
			break;
		}
		if ((Ev.genre == "banner" || Ev.genre == "com") && !Ev.texte.empty())
		{
			Derniers.Add(Texte(Ev.texte));
			if (Derniers.Num() > 5)
			{
				Derniers.RemoveAt(0);
			}
		}
	}
	R.DerniersEvenements = MoveTemp(Derniers);
	return R;
}

FVector ULFMatchSubsystem::VersUnreal(double X, double Y, double Z)
{
	const lf::PointUE P = lf::versUnreal(X, Y, Z);
	return FVector(P.X, P.Y, P.Z);
}

FVector ULFMatchSubsystem::VecteurVersUnreal(double VX, double VY, double VZ)
{
	const lf::PointUE P = lf::vecteurVersUnreal(VX, VY, VZ);
	return FVector(P.X, P.Y, P.Z);
}

float ULFMatchSubsystem::LacetUnreal(double AngleRad)
{
	return static_cast<float>(lf::lacetUnrealRad(AngleRad));
}

FString ULFMatchSubsystem::Texte(const std::string& Utf8)
{
	return FString(UTF8_TO_TCHAR(Utf8.c_str()));
}

FVector ULFMatchSubsystem::PositionMonde(double X, double Y, double Z) const
{
	return Repere.TransformPosition(VersUnreal(X, Y, Z));
}

FVector ULFMatchSubsystem::VecteurMonde(double VX, double VY, double VZ) const
{
	return Repere.TransformVector(VecteurVersUnreal(VX, VY, VZ));
}

float ULFMatchSubsystem::LacetMonde(double AngleRad) const
{
	return static_cast<float>(LacetUnreal(AngleRad) + Repere.Rotator().Yaw);
}
