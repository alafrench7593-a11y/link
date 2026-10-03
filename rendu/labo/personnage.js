// Un personnage riggé venu d'ailleurs (glTF, GLB ou FBX) à la place du corps MakeHuman : on
// reconnaît ses os (Quaternius, Mixamo, mannequin d'Unreal, Rigify, ...), on décrit son
// squelette comme celui de MakeHuman (chaînes vers les articulations des captures CMU, rôles des
// os pour l'IK, la tête, les mains), et l'Animateur l'anime tel quel. Le modèle n'est jamais
// modifié : chaque joueur en est une copie, habillée aux couleurs de son club.
import * as THREE from 'three';
import { GLTFLoader } from '/three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from '/three/examples/jsm/loaders/FBXLoader.js';
import { clone as clonerSquelette } from '/three/examples/jsm/utils/SkeletonUtils.js';
import { TEINTS, CHEVEUX } from './corps.js';

export async function chargerPersonnage(url) {
  if (/\.fbx$/i.test(url)) {
    const scene = await new FBXLoader().loadAsync(url);
    return { scene, animations: scene.animations || [], url };
  }
  const g = await new GLTFLoader().loadAsync(url);
  return { scene: g.scene, animations: g.animations || [], url };
}

// ---- reconnaître les os ----
// le côté d'un os, d'après son nom (les points et les espaces sont déjà retirés ou changés en « _ »
// par le chargeur glTF : « Foot.L » devient « FootL », « Bip01 L Thigh » devient « Bip01_L_Thigh »)
const cote = (nom) => {
  if (/left/i.test(nom)) return 'L';
  if (/right/i.test(nom)) return 'R';
  if (/(^|[._\s:-])[lL]($|[._\s:-])/.test(nom) || /[a-z0-9]L$/.test(nom) || /^L[A-Z_]/.test(nom)) return 'L';
  if (/(^|[._\s:-])[rR]($|[._\s:-])/.test(nom) || /[a-z0-9]R$/.test(nom) || /^R[A-Z_]/.test(nom)) return 'R';
  return null;
};
const ignore = (nom) => /(_end|end$|pole|target|ik[._]|ctrl|twist|roll|helper|weapon|prop)/i.test(nom);
const ROLES = {
  cuisse: /(up.?leg|thigh|upperleg|femur)/i,
  tibia: /(lo.?w?.?er.?leg|calf|shin|lowerleg|knee|^leg|[^p]leg$|:leg)/i,
  pied: /(foot|ankle)/i,
  orteil: /(toe|ball)/i,
  clavicule: /(shoulder|clavicle|collar)/i,
  bras: /(up.?arm|upperarm|^.*arm$)/i,
  avantBras: /(fore.?arm|lo.?w?.?er.?arm|lowerarm|elbow)/i,
  main: /(hand|palm|wrist)/i,
  tete: /head/i,
  cou: /neck/i
};

function trouverOs(racine) {
  const os = [];
  racine.traverse((o) => { if (o.isBone && !ignore(o.name)) os.push(o); });
  const parSide = (role, c) => {
    const liste = os.filter((o) => ROLES[role].test(o.name) && cote(o.name) === c);
    if (role === 'bras') return liste.filter((o) => !ROLES.avantBras.test(o.name) && !ROLES.main.test(o.name))[0];
    if (role === 'tibia') return liste.filter((o) => !ROLES.cuisse.test(o.name) && !ROLES.pied.test(o.name))[0];
    // le plus haut dans la hiérarchie (Palm avant MiddleHand)
    return liste.sort((a, b) => profondeur(a) - profondeur(b))[0];
  };
  const r = {};
  for (const c of ['L', 'R']) {
    r['cuisse' + c] = parSide('cuisse', c); r['tibia' + c] = parSide('tibia', c);
    r['pied' + c] = parSide('pied', c); r['orteil' + c] = parSide('orteil', c);
    r['clavicule' + c] = parSide('clavicule', c); r['bras' + c] = parSide('bras', c);
    r['avantBras' + c] = parSide('avantBras', c); r['main' + c] = parSide('main', c);
  }
  r.tete = os.filter((o) => ROLES.tete.test(o.name) && !cote(o.name)).sort((a, b) => profondeur(a) - profondeur(b))[0];
  for (const k of ['cuisseL', 'cuisseR', 'tibiaL', 'tibiaR', 'piedL', 'piedR', 'brasL', 'brasR', 'avantBrasL', 'avantBrasR', 'mainL', 'mainR', 'tete'])
    if (!r[k]) throw new Error(`personnage : os introuvable pour « ${k} » (${os.map((o) => o.name).join(', ')})`);
  // le bassin : l'ancêtre commun des deux cuisses ; la poitrine : celui des deux bras
  r.bassin = ancetreCommun(r.cuisseL, r.cuisseR);
  r.poitrine = ancetreCommun(r.brasL, r.brasR);
  // la colonne : de la poitrine vers le bassin (sans eux), puis le cou jusqu'à la tête
  r.colonne = cheminVers(r.poitrine, r.bassin);       // [poitrine, ..., juste au-dessus du bassin]
  r.cou = cheminVers(r.tete, r.poitrine).slice(1);       // les os entre la poitrine et la tête
  return r;
}
function profondeur(o) { let d = 0; while (o.parent) { d++; o = o.parent; } return d; }
function ancetreCommun(a, b) {
  const pa = new Set(); for (let o = a; o; o = o.parent) pa.add(o);
  for (let o = b; o; o = o.parent) if (pa.has(o)) return o;
  return null;
}
// les os de « de » (inclus) jusqu'à « vers » (exclu), en remontant les parents
function cheminVers(de, vers) {
  const c = [];
  for (let o = de; o && o !== vers; o = o.parent) c.push(o);
  return c;
}

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

// Un joueur à partir du modèle : copie, mise à la taille de la fiche, face à +Z, habillée ; et la
// description du squelette pour l'Animateur (os, chaînes CMU, rôles, repos dans le monde).
export function fabriquerJoueurPersonnage(modele, fiche, couleurs, man) {
  const scene = clonerSquelette(modele.scene);
  scene.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone(); } });
  coiffure(scene, fiche);
  const r = trouverOs(scene);
  // face à +Z : la main gauche du personnage doit être du côté +X
  scene.updateMatrixWorld(true);
  const ml = r.mainL.getWorldPosition(new THREE.Vector3()), mr = r.mainR.getWorldPosition(new THREE.Vector3());
  const lateral = ml.clone().sub(mr); lateral.y = 0;
  const angle = Math.atan2(lateral.z, lateral.x);   // rotation (autour de Y) qui ramène la gauche sur +X
  scene.rotation.y += angle;
  // à la taille de la fiche (du sol au sommet du crâne, d'après les maillages)
  scene.updateMatrixWorld(true);
  let boite = new THREE.Box3().setFromObject(scene, true);
  const taille = ((fiche.morphologie && fiche.morphologie.taille_cm) || 180) / 100;
  const k = taille / Math.max(0.5, boite.max.y - boite.min.y);
  scene.scale.multiplyScalar(k);
  scene.updateMatrixWorld(true);
  boite = new THREE.Box3().setFromObject(scene, true);
  scene.position.y -= boite.min.y;
  scene.position.x -= (boite.min.x + boite.max.x) / 2 - 0;
  scene.updateMatrixWorld(true);

  // ---- le squelette logique (parents de l'animation, pas forcément ceux du fichier) ----
  const liste = [], index = new Map();
  const ajouter = (bone, nom, parent, cmu) => {
    const i = liste.length;
    liste.push({ bone, nom: nom || bone.name, parent, cmu });
    if (bone) index.set(bone, i);
    return i;
  };
  const iBassin = ajouter(r.bassin, null, -1, 'Hips');
  // la colonne, du bas vers la poitrine
  const colonne = r.colonne.slice().reverse();
  const cmuColonne = colonne.length >= 3 ? ['LowerBack', 'Spine', 'Spine1'] : colonne.length === 2 ? ['LowerBack', 'Spine1'] : ['Spine1'];
  let p = iBassin;
  colonne.forEach((o, n) => { p = ajouter(o, null, p, cmuColonne[Math.min(n, cmuColonne.length - 1)] || 'Spine1'); });
  const iPoitrine = p;
  let pc = iPoitrine;
  r.cou.slice().reverse().forEach((o, n) => { pc = ajouter(o, null, pc, n === 0 ? 'Neck' : 'Neck1'); });
  const iTete = ajouter(r.tete, null, pc, 'Head');
  const roles = { jambes: [], bras: [], cou: [], poitrine: iPoitrine, tete: iTete, mains: [] };
  for (const c of ['L', 'R']) {
    const C = c === 'L' ? 'Left' : 'Right';
    let pb = iPoitrine;
    if (r['clavicule' + c] && r['clavicule' + c] !== r['bras' + c]) pb = ajouter(r['clavicule' + c], null, pb, C + 'Shoulder');
    const iBras = ajouter(r['bras' + c], null, pb, C + 'Arm');
    const iAvant = ajouter(r['avantBras' + c], null, iBras, C + 'ForeArm');
    const iMain = ajouter(r['main' + c], null, iAvant, C + 'Hand');
    roles.bras.push({ cuisse: [iBras], tibia: [iAvant], pied: iMain, suit: [iMain] });
    roles.mains.push(iMain);
    const iCuisse = ajouter(r['cuisse' + c], null, iBassin, C + 'UpLeg');
    const iTibia = ajouter(r['tibia' + c], null, iCuisse, C + 'Leg');
    const iPied = ajouter(r['pied' + c], null, iTibia, C + 'Foot');
    const iOrteil = ajouter(r['orteil' + c] || null, r['orteil' + c] ? null : 'orteil.' + c, iPied, C + 'ToeBase');
    roles.jambes.push({ cuisse: [iCuisse], tibia: [iTibia], pied: iPied, orteil: iOrteil });
  }
  // le repos, dans le monde
  const tetes = liste.map((e) => (e.bone ? e.bone.getWorldPosition(new THREE.Vector3()) : null));
  const reposMonde = liste.map((e) => (e.bone ? e.bone.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion()));
  const echelleMonde = liste.map((e) => (e.bone ? e.bone.getWorldScale(new THREE.Vector3()) : new THREE.Vector3(1, 1, 1)));
  // l'orteil absent : la base des orteils, estimée sur le maillage du pied (les sommets que l'os
  // du pied porte le plus) : aux trois quarts de la cheville à la pointe, 2,5 cm au-dessus de la
  // semelle ; à défaut, depuis la cheville seule
  const sommetsPieds = sommetsDominants(scene, roles.jambes.map((J) => liste[J.pied].bone));
  // un pied dont l'os part du talon, au sol (une cible d'IK, comme chez Quaternius), pas de la
  // cheville : l'animation le fait tourner autour d'une cheville estimée sur le maillage du pied
  // (au quart de la longueur depuis l'arrière du talon, à la hauteur du haut de la chaussure,
  // entre 3 et 4,5 % de la taille), et l'os suit avec son décalage (ecrireMonde)
  const decalages = liste.map(() => null);
  roles.jambes.forEach((J, n) => {
    const ch = tetes[J.pied], pts = sommetsPieds[n];
    if (ch.y > 0.022 * taille || pts.length < 8) return;
    let arriere = Infinity, avant = -Infinity, haut = -Infinity;
    for (const q of pts) { arriere = Math.min(arriere, q.z); avant = Math.max(avant, q.z); haut = Math.max(haut, q.y); }
    const talon = pts.filter((q) => q.z < arriere + 0.4 * (avant - arriere));
    const x = talon.reduce((a, q) => a + q.x, 0) / talon.length;
    const cheville = new THREE.Vector3(x, Math.max(0.03 * taille, Math.min(0.045 * taille, haut)), arriere + 0.25 * (avant - arriere));
    decalages[J.pied] = ch.clone().sub(cheville);
    tetes[J.pied] = cheville;
  });
  const pointes = [];
  roles.jambes.forEach((J, n) => {
    const ch = tetes[J.pied], pts = sommetsPieds[n];
    let pointe = null, semelle = 0;
    if (pts.length >= 8) {
      pointe = pts[0]; semelle = Infinity;
      for (const q of pts) { if (q.z > pointe.z) pointe = q; if (q.y < semelle) semelle = q.y; }
    }
    pointes[n] = pointe ? new THREE.Vector3(pointe.x, semelle + 0.02, pointe.z) : null;
    if (tetes[J.orteil]) return;
    tetes[J.orteil] = pointe
      ? new THREE.Vector3(ch.x + (pointe.x - ch.x) * 0.75, semelle + 0.025, ch.z + (pointe.z - ch.z) * 0.72)
      : new THREE.Vector3(ch.x, Math.max(0.02, ch.y * 0.3), ch.z + Math.max(0.1, ch.y * 1.5));
  });
  // les queues : la tête de l'os suivant dans la chaîne, ou un prolongement
  const enfants = liste.map(() => []);
  liste.forEach((e, i) => { if (e.parent >= 0) enfants[e.parent].push(i); });
  const queues = liste.map((e, i) => {
    let choix = null;
    if (i === iBassin) choix = enfants[i].find((j) => /LowerBack|Spine/.test(liste[j].cmu));
    else if (i === iPoitrine) choix = enfants[i].find((j) => /Neck|Head/.test(liste[j].cmu));
    else if (enfants[i].length) choix = enfants[i][0];
    if (choix != null) return tetes[choix].clone();
    if (i === iTete) return tetes[i].clone().add(new THREE.Vector3(0, 0.2, 0));
    const jambe = roles.jambes.findIndex((J) => J.orteil === i);
    if (jambe >= 0 && pointes[jambe]) return pointes[jambe].clone();
    const pa = e.parent >= 0 ? tetes[e.parent] : tetes[i].clone().sub(new THREE.Vector3(0, 0.1, 0));
    return tetes[i].clone().add(tetes[i].clone().sub(pa).setLength(0.08));
  });
  const os = liste.map((e) => e.bone || null);
  const chaines = liste.filter((e) => e.cmu).map((e) => ({ os: [e.nom], cmu: e.cmu }));
  // les noms doivent être uniques pour l'Animateur
  const vus = new Set();
  liste.forEach((e, i) => { if (vus.has(e.nom)) e.nom = e.nom + '#' + i; vus.add(e.nom); });
  chaines.length = 0;
  liste.forEach((e) => { if (e.cmu) chaines.push({ os: [e.nom], cmu: e.cmu }); });
  // le haut du corps (ce que penche une inclinaison) : la colonne au-dessus de son premier os, le
  // cou, la tête, les épaules et les bras ; le regard : le cou en partie, la tête en entier
  const premierColonne = colonne.length ? index.get(colonne[0]) : -1;
  roles.haut = liste.map((e, i) => i !== iBassin && i !== premierColonne && !/Leg|Foot|Toe|Hips/.test(e.cmu || 'Leg'));
  const neckIdx = liste.map((e, i) => (/Neck/.test(e.cmu || '') ? i : -1)).filter((i) => i >= 0);
  roles.regard = liste.map((e, i) => (i === iTete ? 1 : neckIdx.includes(i) ? 0.3 + 0.3 * neckIdx.indexOf(i) : 0));
  roles.cou = [neckIdx[0] != null ? neckIdx[0] : iTete, neckIdx[neckIdx.length - 1] != null ? neckIdx[neckIdx.length - 1] : iTete, iTete];
  const corpsMan = { os: liste.map((e) => ({ nom: e.nom, parent: e.parent })), chaines, directions_tpose: man.directions_tpose, roles };
  habiller(scene, fiche, couleurs);
  // l'ordre d'écriture : toute la hiérarchie du modèle, parents d'abord ; chaque nœud y connaît
  // l'indice de son parent dans cet ordre et son os logique (-1 : il garde sa pose locale)
  const ordre = [], place = new Map();
  scene.updateMatrix();
  scene.traverse((o) => {
    place.set(o, ordre.length);
    ordre.push({ o, p: o === scene ? -1 : place.get(o.parent), b: index.has(o) ? index.get(o) : -1 });
  });
  return { maillage: scene, os, tetes, queues, reposMonde, echelleMonde, decalages, fiche, corpsMan, ordre, personnage: true };
}

// les sommets (dans le monde, au repos) que chacun des os donnés porte le plus
function sommetsDominants(scene, bones) {
  const res = bones.map(() => []);
  const v = new THREE.Vector3();
  scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const g = o.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    if (!si || !sw) return;
    const ici = bones.map((b) => o.skeleton.bones.indexOf(b));
    for (let i = 0; i < g.attributes.position.count; i++) {
      let meilleur = -1, pm = 0;
      for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > pm) { pm = w; meilleur = si.getComponent(i, k); } }
      const q = ici.indexOf(meilleur);
      if (q < 0) continue;
      res[q].push(o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld).clone());
    }
  });
  return res;
}

// Un modèle peut porter plusieurs coiffures, chacune un maillage « cheveux_<style> » attaché à la
// tête (le footballeur de Gameplay Football en a six : rendu/construire/gpf_joueur.py). Un seul
// reste visible, choisi d'après la coiffure de la fiche ; rasé : aucun. Sans ces maillages, rien
// ne change.
const COIFFURES = { ras: null, court: 'short01', degrade: 'short02', boucles: 'medium01', frises: 'medium02', afro: 'medium02',
  dreadlocks: 'long01', tresses: 'long02', long: 'long01', attache: 'medium01' };
function coiffure(scene, fiche) {
  const styles = [];
  scene.traverse((o) => { if (/^cheveux_/.test(o.name) && (o.isMesh || o.isGroup)) styles.push(o); });
  if (!styles.length) return;
  const ap = fiche.apparence || {};
  const voulue = ap.coiffure in COIFFURES ? COIFFURES[ap.coiffure] : styles[0].name.slice(8);
  styles.forEach((o) => { o.visible = voulue !== null && o.name === 'cheveux_' + voulue; });
}

// les couleurs du club sur les matériaux du modèle, reconnus par leur nom
function habiller(scene, fiche, c) {
  const ap = fiche.apparence || {};
  const peau = new THREE.Color(TEINTS[Math.max(0, Math.min(9, ap.teint || 0))]);
  scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      const n = (m.name || '').toLowerCase();
      const teinter = (couleur) => { if (m.map) m.color.set('#ffffff').lerp(new THREE.Color(couleur), 0.85); else m.color.set(couleur); };
      if (/shirt|jersey|top|maillot|torso_?cloth|kit/.test(n)) teinter(c.maillot);
      else if (/pant|short|trunk/.test(n)) teinter(c.short);
      else if (/sock|chaussette/.test(n)) teinter(c.chaussettes);
      else if (/shoe|boot|cleat|chaussure/.test(n)) teinter(c.chaussures);
      else if (/skin|body|peau|face|head/.test(n) && !m.map) m.color.copy(peau);
      else if (/hair|cheveu|beard/.test(n) && !m.map) m.color.set(CHEVEUX[ap.cheveux] || CHEVEUX.brun);
      if (m.roughness !== undefined && !m.roughnessMap) m.roughness = Math.max(m.roughness, 0.55);
    }
  });
}
