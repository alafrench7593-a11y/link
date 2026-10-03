// Les vrais corps du match en 3D, sur le web : le footballeur de Gameplay Football animé par de
// vraies captures (rendu/labo/reel.js, le même code que le labo du rendu). La base de mouvements
// (12 Mo) et le personnage (400 Ko) partent avec l'app comme fichiers à part (metro.config.js)
// et se chargent une fois, à la première vue 3D.
import { Asset } from 'expo-asset';
import { preparerReel, creerReel } from '../../rendu/labo/reel.js';

export { creerReel };
export const REEL_DISPONIBLE = true;

let ressources = null;
export function chargerReel() {
  if (!ressources) {
    const lien = async (m) => { const a = Asset.fromModule(m); await a.downloadAsync(); return a.localUri || a.uri; };
    const binaire = async (m) => { const r = await fetch(await lien(m)); if (!r.ok) throw new Error('rendu réel : ' + r.status); return r.arrayBuffer(); };
    ressources = Promise.all([
      binaire(require('../../rendu/donnees/mouvements.bin')),
      binaire(require('../../unreal/LinkFoot/SourceArt/Characters/Players/GameplayFootball/SK_LinkFoot_GPF.glb'))
    ]).then(([bin, glb]) => preparerReel({ mouvements: { json: require('../../rendu/donnees/mouvements.json'), bin },
      squelette: require('../../rendu/donnees/corps.json'), personnage: glb }))
      .catch((e) => { ressources = null; throw e; });
  }
  return ressources;
}
