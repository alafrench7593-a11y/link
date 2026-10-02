// La cible du jeu LinkFoot (Unreal Engine 5.8).
using UnrealBuildTool;
using System.Collections.Generic;

public class LinkFootTarget : TargetRules
{
	public LinkFootTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("LinkFoot");
	}
}
