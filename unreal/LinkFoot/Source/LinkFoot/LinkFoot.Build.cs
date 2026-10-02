// LinkFoot : le module de jeu. Le mode de jeu, le directeur qui met le match en scène, et les
// tests d'automatisation (Outils > Automatisation, groupe LinkFoot).
using UnrealBuildTool;

public class LinkFoot : ModuleRules
{
	public LinkFoot(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "LinkFootCore", "LinkFootMatch", "LinkFootPlayer", "LinkFootDebug" });
	}
}
