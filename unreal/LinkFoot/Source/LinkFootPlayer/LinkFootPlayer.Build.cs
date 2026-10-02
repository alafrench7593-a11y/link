// LinkFootPlayer : le footballeur. Le personnage qui suit la trajectoire du moteur, et l'instance
// d'animation qui donne à Motion Matching, au warping, à l'IK et au regard ce que le moteur a joué.
using UnrealBuildTool;

public class LinkFootPlayer : ModuleRules
{
	public LinkFootPlayer(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "LinkFootCore", "LinkFootMatch" });
	}
}
