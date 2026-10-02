// LinkFoot, cœur portable : l'export des symboles.
//
// Dans l'éditeur, Unreal compile chaque module en bibliothèque dynamique : LinkFootMatch,
// LinkFootPlayer et LinkFootDebug n'appellent les fonctions du cœur que si LinkFootCore les
// exporte. Unreal définit LINKFOOTCORE_API pour ce module (exportation quand il se compile,
// importation pour les autres) ; hors d'Unreal (tests compilés avec g++, clang ou MSVC), la
// macro est vide.
#pragma once

#if defined(LINKFOOTCORE_API)
#define LFCORE_API LINKFOOTCORE_API
#else
#define LFCORE_API
#endif
