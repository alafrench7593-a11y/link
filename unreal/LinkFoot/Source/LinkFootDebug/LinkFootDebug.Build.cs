// LinkFootDebug : ce qui dit quand l'écran ment (§71 à §75) : le panneau du joueur, la
// désynchronisation, l'animation qui ne correspond pas, le pied qui glisse, le mouvement impossible.
using UnrealBuildTool;

public class LinkFootDebug : ModuleRules
{
	public LinkFootDebug(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "LinkFootCore", "LinkFootMatch", "LinkFootPlayer" });
	}
}
