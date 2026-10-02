// LinkFootMatch : le match dans Unreal. Le document du moteur, l'horloge, l'état du match
// (FLinkFootMatchState) et le ballon. Il ne simule rien : il lit.
using UnrealBuildTool;

public class LinkFootMatch : ModuleRules
{
	public LinkFootMatch(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "LinkFootCore" });
	}
}
