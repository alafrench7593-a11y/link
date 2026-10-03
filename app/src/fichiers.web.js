// L'adresse d'un fichier livré avec l'app (base de mouvements, personnage, polices), relative à
// la page : l'app peut être servie ailleurs qu'à la racine d'un site (une page privée, un
// sous-dossier), et Metro écrit ces adresses depuis la racine (« /assets/… »).
import { Asset } from 'expo-asset';

export function adresse(module) {
  const a = Asset.fromModule(module);
  const u = a.localUri || a.uri;
  return /^\/(?!\/)/.test(u) && typeof document !== 'undefined' ? new URL(u.slice(1), document.baseURI).href : u;
}

// la source d'une <Image> livrée avec l'app
export const image = (module) => ({ uri: adresse(module) });
