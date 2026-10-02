// LinkFootCore : le cœur portable, du C++20 sans Unreal (lire le match du moteur LinkFoot, la
// cinématique, la trajectoire de Motion Matching, le regard, les contacts, l'état du match, les
// détecteurs). Le même code se compile hors d'Unreal et y est testé (unreal/tests-coeur).
using UnrealBuildTool;

public class LinkFootCore : ModuleRules
{
	public LinkFootCore(ReadOnlyTargetRules Target) : base(Target)
	{
		// Pas d'en-tête précompilé : rien d'Unreal n'est imposé aux fichiers du cœur, qui
		// incluent seulement la bibliothèque standard.
		PCHUsage = PCHUsageMode.NoPCHs;
		// Chaque fichier se compile seul, comme dans les tests (pas de fusion en unité unique).
		bUseUnity = false;
		bEnableExceptions = false;
		PublicDependencyModuleNames.Add("Core");
	}
}
