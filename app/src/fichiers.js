// Sur téléphone, un fichier livré avec l'app se donne tel quel à React Native (le web, lui,
// doit écrire son adresse relative à la page : fichiers.web.js).
import { Asset } from 'expo-asset';

export function adresse(module) {
  const a = Asset.fromModule(module);
  return a.localUri || a.uri;
}

export const image = (module) => module;
