// La cible de l'éditeur LinkFoot (Unreal Engine 5.8).
using UnrealBuildTool;
using System.Collections.Generic;

public class LinkFootEditorTarget : TargetRules
{
	public LinkFootEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("LinkFoot");
	}
}
