// Les énumérations d'Unreal reprennent celles du cœur, dans le même ordre : on passe de l'une à
// l'autre par un simple static_cast. Ces assertions le vérifient à la compilation.
#include "LFTypes.h"

#include "LFCore/LFContact.h"
#include "LFCore/LFCorps.h"
#include "LFCore/LFDetecteurs.h"
#include "LFCore/LFFamilles.h"
#include "LFCore/LFLocomotion.h"
#include "LFCore/LFRegard.h"
#include "LFCore/LFVisage.h"

#define LF_MEME_VALEUR(TypeUE, TypeCoeur, Valeur) \
	static_assert(static_cast<uint8>(TypeUE::Valeur) == static_cast<uint8>(TypeCoeur::Valeur), #TypeUE "::" #Valeur " diffère du cœur")

LF_MEME_VALEUR(ELFBandeVitesse, lf::BandeVitesse, Sprint);
LF_MEME_VALEUR(ELFPhaseVitesse, lf::PhaseVitesse, Arret);
LF_MEME_VALEUR(ELFAllure, lf::Allure, Recul);
LF_MEME_VALEUR(ELFVirage, lf::ClasseVirage, V180);
LF_MEME_VALEUR(ELFFamille, lf::Famille, Reception);
LF_MEME_VALEUR(ELFFamille, lf::Famille, Interception);
LF_MEME_VALEUR(ELFFamille, lf::Famille, Celebration);
LF_MEME_VALEUR(ELFSourceRegard, lf::SourceRegard, Balayage);
LF_MEME_VALEUR(ELFGenreContact, lf::GenreContact, Controle);
LF_MEME_VALEUR(ELFGenreContact, lf::GenreContact, SortiePieds);
LF_MEME_VALEUR(ELFSurface, lf::Surface, Mains);
LF_MEME_VALEUR(ELFQualiteControle, lf::QualiteControle, Rate);
LF_MEME_VALEUR(ELFTypeCorps, lf::TypeCorps, GardienGrand);
LF_MEME_VALEUR(ELFStatut, lf::Statut, Desynchro);
LF_MEME_VALEUR(ELFDefautPied, lf::DefautPied, Penetration);
LF_MEME_VALEUR(ELFAnomalie, lf::Anomalie, PiedsCorps);
LF_MEME_VALEUR(ELFTypeCourse, lf::TypeCourse, Sprint);
LF_MEME_VALEUR(ELFTypeCourse, lf::TypeCourse, Pressing);
LF_MEME_VALEUR(ELFExpression, lf::Expression, Joie);
LF_MEME_VALEUR(ELFExpression, lf::Expression, Fatigue);
LF_MEME_VALEUR(ELFGeste, lf::Geste, Celebration);
LF_MEME_VALEUR(ELFGeste, lf::Geste, PoingSerre);
LF_MEME_VALEUR(ELFVerdictQualite, lf::VerdictQualite, NePasLivrer);

#undef LF_MEME_VALEUR
