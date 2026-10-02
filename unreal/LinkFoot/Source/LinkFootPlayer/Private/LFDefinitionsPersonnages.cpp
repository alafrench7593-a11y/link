#include "LFDefinitionsPersonnages.h"

#include "Engine/SkeletalMesh.h"

USkeletalMesh* ULFDefinitionsPersonnages::MaillagePour(ELFTypeCorps Type) const
{
	if (const TObjectPtr<USkeletalMesh>* Trouve = Maillages.Find(Type))
	{
		if (*Trouve)
		{
			return Trouve->Get();
		}
	}
	return MaillageParDefaut.Get();
}
