// LinkFoot dans Unreal : le mode de jeu. Une caméra libre (le spectateur) et le débogueur à
// l'écran ; le match lui-même est mis en scène par un LFDirecteurMatch posé dans le niveau.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"

#include "LFModeDeJeu.generated.h"

UCLASS()
class LINKFOOT_API ALFModeDeJeu : public AGameModeBase
{
	GENERATED_BODY()

public:
	ALFModeDeJeu();
};
