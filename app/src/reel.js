// Sur téléphone, les vrais corps du match en 3D ne sont pas encore branchés : ils n'ont pas été
// vérifiés sur un appareil (le moteur JavaScript du téléphone, la lecture des 12 Mo de la base de
// mouvements, la déformation des corps dans expo-gl). La vue garde ses footballeurs en géométrie.
// Pour les essayer sur un téléphone, mettre ici le contenu de reel.web.js.
export const REEL_DISPONIBLE = false;
export function chargerReel() { return Promise.reject(new Error('vrais corps pas encore branchés sur téléphone')); }
export function creerReel() { return null; }
