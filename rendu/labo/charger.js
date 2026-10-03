// Charger un personnage riggé dans le labo : un GLB est lu par glb.js (le même code que l'app
// LinkFoot) ; un glTF ou un FBX, par les chargeurs de three.js. Le modèle rendu sait fabriquer
// un joueur neuf (creer), ce que personnage.js lui demande pour chaque joueur.
import { construirePersonnage } from './glb.js';

export async function chargerPersonnage(url) {
  if (/\.glb$/i.test(url)) {
    const buffer = await fetch(url).then((r) => { if (!r.ok) throw new Error('personnage introuvable : ' + url); return r.arrayBuffer(); });
    return construirePersonnage(buffer, { url });
  }
  const { clone } = await import('/three/examples/jsm/utils/SkeletonUtils.js');
  if (/\.fbx$/i.test(url)) {
    const { FBXLoader } = await import('/three/examples/jsm/loaders/FBXLoader.js');
    const scene = await new FBXLoader().loadAsync(url);
    return { scene, animations: scene.animations || [], url, creer: () => clone(scene) };
  }
  const { GLTFLoader } = await import('/three/examples/jsm/loaders/GLTFLoader.js');
  const g = await new GLTFLoader().loadAsync(url);
  return { scene: g.scene, animations: g.animations || [], url, creer: () => clone(g.scene) };
}
