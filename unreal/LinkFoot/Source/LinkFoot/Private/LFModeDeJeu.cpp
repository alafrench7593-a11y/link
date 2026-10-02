#include "LFModeDeJeu.h"

#include "GameFramework/SpectatorPawn.h"

#include "LFHUDDebug.h"

ALFModeDeJeu::ALFModeDeJeu()
{
	DefaultPawnClass = ASpectatorPawn::StaticClass();
	HUDClass = ALFHUDDebug::StaticClass();
}
