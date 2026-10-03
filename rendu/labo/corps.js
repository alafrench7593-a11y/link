// Le corps d'un footballeur LinkFoot, fabriqué dans le navigateur à partir de sa fiche.
//
// Le maillage humain et ses cibles de forme viennent de MakeHuman (actifs CC0 1.0) : on additionne
// les cibles que la fiche règle (muscle, masse, taille, proportions, origines, mensurations, visage),
// on met le corps à la taille exacte de la fiche, on recalcule le squelette à partir des sommets
// d'articulation, puis on habille les zones (maillot, short, chaussettes, crampons) aux couleurs du
// club. Le corps est un SkinnedMesh de three.js à 40 os.
import * as THREE from 'three';

const TYPES = { float32: Float32Array, uint16: Uint16Array, int16: Int16Array, uint8: Uint8Array, int32: Int32Array, uint32: Uint32Array };
export function vue(buf, [off, dtype, forme]) {
  const n = forme.reduce((a, b) => a * b, 1);
  return new TYPES[dtype](buf, off, n);
}

export async function chargerCorps(base) {
  const [man, bin] = await Promise.all([
    fetch(base + 'corps.json').then((r) => r.json()),
    fetch(base + 'corps.bin').then((r) => r.arrayBuffer())
  ]);
  const t = (k) => vue(bin, man.tableaux[k]);
  const cibles = new Map(man.cibles.map((c) => [c.nom, { echelle: c.echelle, i: vue(bin, c.i), d: vue(bin, c.d) }]));
  return { man, positions: t('positions'), uv: t('uv'), indices: t('indices'), osIndex: t('osIndex'), osPoids: t('osPoids'), zones: t('zones'), cibles,
    copieDe: t('copieDe'), lisseIdx: t('lisseIdx'), lisseOff: t('lisseOff'), lisseVois: t('lisseVois') };
}

const cl = (v, a, b) => Math.max(a, Math.min(b, v));
function hasard(graine) {
  let s = (graine >>> 0) || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const TEINTS = ['#F3D5C0', '#ECC2A4', '#E0AC88', '#D19873', '#BE835D', '#A66D49', '#8B593A', '#70452D', '#573422', '#3E2518'];
export const CHEVEUX = { noir: '#151110', brun_fonce: '#2B1D15', brun: '#4B3122', chatain: '#6C4B30', blond: '#B8935C', roux: '#8D4B25' };

// Les poids des cibles de MakeHuman pour une fiche LinkFoot.
export function poidsCibles(fiche) {
  const m = fiche.morphologie || {}, ap = fiche.apparence || {};
  const v = (k, d = 0.5) => (m[k] == null ? d : m[k]);
  const R = hasard(ap.graine || 1);
  const P = new Map();
  const ajoute = (nom, w) => { if (w > 1e-4) P.set(nom, (P.get(nom) || 0) + w); };
  // curseurs macro (formules de MakeHuman) : homme, 25 ans
  const muscle = cl(0.55 + 0.4 * v('muscles'), 0, 1);
  const masse = cl(0.38 + 0.22 * v('masse') + 0.25 * (v('masse_grasse') - 0.5), 0.15, 0.85);
  const taille = cl(0.5 + ((m.taille_cm || 180) - 180) / 40, 0.1, 0.9);
  const prop = cl(0.72 + 0.25 * (v('epaules') - 0.5) + 0.1 * (v('muscles') - 0.5), 0.3, 1);
  const trois = (x) => ({ min: Math.max(0, 1 - 2 * x), max: Math.max(0, 2 * x - 1), average: 1 - Math.max(0, 1 - 2 * x) - Math.max(0, 2 * x - 1) });
  const mu = trois(muscle), we = trois(masse);
  const hMin = Math.max(0, 1 - 2 * taille), hMax = Math.max(0, 2 * taille - 1);
  const pIdeal = Math.max(0, 2 * prop - 1), pRare = Math.max(0, 1 - 2 * prop);
  // origines : le hasard du personnage, penché par le teint, jamais exclusif
  const teint = cl(ap.teint || 0, 0, 9) / 9;
  let af = 0.15 + R() * 0.5 + 1.4 * teint * teint, ca = 0.15 + R() * 0.5 + 1.2 * (1 - teint), as = 0.1 + R() * 0.45 + 0.3 * (1 - Math.abs(teint - 0.35) * 2);
  const s = af + ca + as; af /= s; ca /= s; as /= s;
  ajoute('macrodetails/african-male-young', af);
  ajoute('macrodetails/caucasian-male-young', ca);
  ajoute('macrodetails/asian-male-young', as);
  for (const [km, wm] of Object.entries(mu)) for (const [kw, ww] of Object.entries(we)) {
    const base = `${km}muscle-${kw}weight`, w = wm * ww;
    if (w < 1e-4) continue;
    ajoute(`macrodetails/universal-male-young-${base}`, w);
    ajoute(`macrodetails/height/male-young-${base}-minheight`, w * hMin);
    ajoute(`macrodetails/height/male-young-${base}-maxheight`, w * hMax);
    ajoute(`macrodetails/proportions/male-young-${base}-idealproportions`, w * pIdeal);
    ajoute(`macrodetails/proportions/male-young-${base}-uncommonproportions`, w * pRare);
  }
  // mensurations et muscles : une valeur de -1 à 1 sur une paire de cibles
  const paire = (nom, x) => { if (x > 0) ajoute(nom + '-incr', Math.min(1, x)); else ajoute(nom + '-decr', Math.min(1, -x)); };
  const c = (k, a = 0.9) => 2 * (v(k) - 0.5) * a;
  paire('measure/measure-shoulder-dist', c('epaules'));
  paire('measure/measure-bust-circ', c('poitrine'));
  paire('measure/measure-waist-circ', c('ventre', 0.7));
  paire('measure/measure-hips-circ', c('bassin', 0.7));
  paire('measure/measure-upperarm-length', c('bras', 0.6));
  paire('measure/measure-lowerarm-length', c('bras', 0.5));
  paire('measure/measure-upperleg-height', c('jambes', 0.6));
  paire('measure/measure-lowerleg-height', c('jambes', 0.5));
  paire('measure/measure-thigh-circ', c('cuisses', 0.8));
  paire('measure/measure-calf-circ', c('mollets', 0.8));
  paire('measure/measure-neck-circ', c('cou', 0.8));
  paire('measure/measure-upperarm-circ', c('muscles', 0.6));
  paire('torso/torso-vshape', 0.35 + 0.5 * (v('epaules') - v('ventre')));
  paire('torso/torso-muscle-pectoral', 0.3 + 0.6 * (v('poitrine') - 0.5) + 0.3 * (v('muscles') - 0.5));
  paire('torso/torso-muscle-dorsi', 0.25 + 0.5 * (v('epaules') - 0.5));
  paire('stomach/stomach-tone', 0.4 - 0.9 * (v('masse_grasse') - 0.5));
  paire('buttocks/buttocks-volume', 0.6 * (v('bassin') - 0.5) + 0.3 * (v('cuisses') - 0.5));
  for (const cote of ['l', 'r']) {
    paire(`armslegs/${cote}-upperarm-muscle`, c('muscles', 0.8));
    paire(`armslegs/${cote}-lowerarm-muscle`, c('muscles', 0.6));
    paire(`armslegs/${cote}-upperleg-muscle`, 0.2 + c('cuisses', 0.8));
    paire(`armslegs/${cote}-lowerleg-muscle`, 0.2 + c('mollets', 0.8));
    paire(`armslegs/${cote}-hand-scale`, c('mains', 0.6));
    paire(`armslegs/${cote}-foot-scale`, c('pieds', 0.5));
  }
  // le visage : les huit coefficients de la fiche
  const vis = ap.visage || [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  const formes = ['head/head-oval', 'head/head-square', 'head/head-round', 'head/head-rectangular'];
  ajoute(formes[Math.floor(vis[0] * 3.999)], 0.25 + 0.5 * vis[1]);
  paire('head/head-fat', 0.4 * (v('masse_grasse') - 0.5));
  paire('head/head-scale-horiz', c('tete', 0.5) + 0.3 * (vis[1] - 0.5));
  paire('head/head-scale-vert', c('tete', 0.4));
  paire('nose/nose-hump', 1.2 * (vis[2] - 0.5));
  paire('nose/nose-scale-horiz', 1.2 * (vis[3] - 0.5));
  paire('nose/nose-scale-vert', 0.8 * (vis[4] - 0.5));
  paire('mouth/mouth-scale-horiz', 0.8 * (vis[5] - 0.5));
  paire('chin/chin-prominent', 1.0 * (vis[6] - 0.5));
  paire('chin/chin-width', 1.0 * (vis[7] - 0.5));
  for (const cote of ['l', 'r']) { paire(`cheek/${cote}-cheek-bones`, 0.8 * (vis[1] - 0.5)); paire(`ears/${cote}-ear-scale`, 0.6 * (vis[2] - 0.5)); }
  return P;
}

// Les sommets d'un joueur : la base plus ses cibles, mis à sa taille, pieds au sol.
export function sommetsDuJoueur(D, fiche) {
  const n = D.man.sommets, pos = new Float32Array(D.positions);
  for (const [nom, w] of poidsCibles(fiche)) {
    const c = D.cibles.get(nom);
    if (!c) continue;
    const e = c.echelle * w;
    for (let k = 0; k < c.i.length; k++) {
      const s = c.i[k] * 3;
      pos[s] += c.d[k * 3] * e; pos[s + 1] += c.d[k * 3 + 1] * e; pos[s + 2] += c.d[k * 3 + 2] * e;
    }
  }
  // les crampons : on lisse le pied (les orteils se fondent dans une chaussure)
  const tmp = new Float32Array(D.lisseIdx.length * 3);
  for (let it = 0; it < 6; it++) {
    for (let k = 0; k < D.lisseIdx.length; k++) {
      let x = 0, y = 0, z = 0; const a = D.lisseOff[k], b = D.lisseOff[k + 1];
      for (let q = a; q < b; q++) { const s = D.lisseVois[q] * 3; x += pos[s]; y += pos[s + 1]; z += pos[s + 2]; }
      const s = D.lisseIdx[k] * 3, m = 1 / Math.max(1, b - a);
      tmp[k * 3] = pos[s] * 0.4 + x * m * 0.6; tmp[k * 3 + 1] = pos[s + 1] * 0.4 + y * m * 0.6; tmp[k * 3 + 2] = pos[s + 2] * 0.4 + z * m * 0.6;
    }
    for (let k = 0; k < D.lisseIdx.length; k++) { const s = D.lisseIdx[k] * 3; pos[s] = tmp[k * 3]; pos[s + 1] = tmp[k * 3 + 1]; pos[s + 2] = tmp[k * 3 + 2]; }
  }
  // les copies suivent leur sommet : la calotte de cheveux suit le cuir chevelu, les doubles des
  // coutures UV restent collés à leur original
  const nb = D.man.sommets_base;
  for (let k = 0; k < D.copieDe.length; k++) { const s = D.copieDe[k] * 3, c = (nb + k) * 3; pos[c] = pos[s]; pos[c + 1] = pos[s + 1]; pos[c + 2] = pos[s + 2]; }
  // la taille de la fiche, des pieds au sommet du crâne (sans les cheveux)
  let ymin = Infinity, ymax = -Infinity;
  const zc = D.man.zones.indexOf('cheveux'), zy = D.man.zones.indexOf('yeux'), zm = D.man.zones.indexOf('meches');
  const rendu = new Uint8Array(n);
  for (let i = 0; i < D.indices.length; i++) rendu[D.indices[i]] = 1;
  for (let i = 0; i < n; i++) {
    if (!rendu[i] || D.zones[i] === zc || D.zones[i] === zy || D.zones[i] === zm) continue;
    ymin = Math.min(ymin, pos[i * 3 + 1]); ymax = Math.max(ymax, pos[i * 3 + 1]);
  }
  const taille = ((fiche.morphologie && fiche.morphologie.taille_cm) || 180) / 100;
  const k = taille / (ymax - ymin);
  for (let i = 0; i < n; i++) { pos[i * 3] *= k; pos[i * 3 + 1] = (pos[i * 3 + 1] - ymin) * k; pos[i * 3 + 2] *= k; }
  return { pos, echelle: k };
}

const moyenne = (pos, liste) => {
  const v = new THREE.Vector3();
  for (const i of liste) { v.x += pos[i * 3]; v.y += pos[i * 3 + 1]; v.z += pos[i * 3 + 2]; }
  return v.multiplyScalar(1 / liste.length);
};

// Le maillot peint : la couleur du club, une trame de tissu, le numéro dans le dos et petit sur la
// poitrine. Le numéro est dessiné dans l'espace du corps (vu de dos, vu de face) puis reporté
// triangle par triangle dans l'espace UV du maillage : il reste droit quelle que soit la découpe UV.
const luminance = (hex) => { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };
function textureMaillot(D, couleurs, numero) {
  const W = 1024, c = document.createElement('canvas'); c.width = W; c.height = W;
  const g = c.getContext('2d');
  g.fillStyle = couleurs.maillot; g.fillRect(0, 0, W, W);
  // la trame : de fines côtes verticales et un grain léger
  const img = g.getImageData(0, 0, W, W), R = hasard(97);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const k = (y * W + x) * 4, b = (x % 3 === 0 ? -5 : 0) + (R() - 0.5) * 7;
    img.data[k] += b; img.data[k + 1] += b; img.data[k + 2] += b;
  }
  g.putImageData(img, 0, 0);
  if (numero == null) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  // la couleur du numéro : la seconde couleur du club si elle tranche, sinon blanc ou noir
  let encre = couleurs.numero || '#ffffff';
  if (Math.abs(luminance(encre) - luminance(couleurs.maillot)) < 0.35) encre = luminance(couleurs.maillot) > 0.45 ? '#111111' : '#f5f5f5';
  const N = document.createElement('canvas'); N.width = 256; N.height = 256;
  const n = N.getContext('2d');
  n.fillStyle = encre; n.textAlign = 'center'; n.textBaseline = 'middle';
  n.font = `bold ${String(numero).length > 1 ? 190 : 210}px "Arial Narrow", Arial, sans-serif`;
  n.fillText(String(numero), 128, 140);
  const pos = D.positions, uv = D.uv, idx = D.indices;
  const gr = D.man.groupes.find((x) => x.zone === 'maillot');
  // (x0, y0)-(x1, y1) : le rectangle du corps où va l'image ; miroir : vu de dos
  const reporter = (x0, x1, y0, y1, garder, miroir) => {
    for (let k = gr.debut; k < gr.debut + gr.n; k += 3) {
      const t = [idx[k], idx[k + 1], idx[k + 2]];
      if (!t.every((i) => garder(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]))) continue;
      // seulement les triangles vus de face (un triangle vu par la tranche étirerait l'image)
      const ax = pos[t[1] * 3] - pos[t[0] * 3], ay = pos[t[1] * 3 + 1] - pos[t[0] * 3 + 1], az = pos[t[1] * 3 + 2] - pos[t[0] * 3 + 2];
      const bx = pos[t[2] * 3] - pos[t[0] * 3], by = pos[t[2] * 3 + 1] - pos[t[0] * 3 + 1], bz = pos[t[2] * 3 + 2] - pos[t[0] * 3 + 2];
      const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      if (Math.abs(nz) < 0.6 * Math.hypot(nx, ny, nz)) continue;
      const src = t.map((i) => [(miroir ? x1 - pos[i * 3] : pos[i * 3] - x0) / (x1 - x0) * 256, (y1 - pos[i * 3 + 1]) / (y1 - y0) * 256]);
      if (src.every((p) => p[0] < 0) || src.every((p) => p[0] > 256) || src.every((p) => p[1] < 0) || src.every((p) => p[1] > 256)) continue;
      const dst = t.map((i) => [uv[i * 2] * W, (1 - uv[i * 2 + 1]) * W]);
      // la transformation affine qui envoie le triangle de l'image sur le triangle UV
      const [a, b, cc] = src, [A, B, C] = dst;
      const det = (b[0] - a[0]) * (cc[1] - a[1]) - (cc[0] - a[0]) * (b[1] - a[1]);
      if (Math.abs(det) < 1e-9) continue;
      const m11 = ((B[0] - A[0]) * (cc[1] - a[1]) - (C[0] - A[0]) * (b[1] - a[1])) / det;
      const m12 = ((C[0] - A[0]) * (b[0] - a[0]) - (B[0] - A[0]) * (cc[0] - a[0])) / det;
      const m21 = ((B[1] - A[1]) * (cc[1] - a[1]) - (C[1] - A[1]) * (b[1] - a[1])) / det;
      const m22 = ((C[1] - A[1]) * (b[0] - a[0]) - (B[1] - A[1]) * (cc[0] - a[0])) / det;
      const dx = A[0] - m11 * a[0] - m12 * a[1], dy = A[1] - m21 * a[0] - m22 * a[1];
      // le triangle UV un peu élargi (pas de fente entre deux triangles)
      const cx = (A[0] + B[0] + C[0]) / 3, cy = (A[1] + B[1] + C[1]) / 3;
      g.save();
      g.beginPath();
      for (const P of [A, B, C]) { const l = Math.hypot(P[0] - cx, P[1] - cy) || 1; g.lineTo(P[0] + (P[0] - cx) / l * 0.8, P[1] + (P[1] - cy) / l * 0.8); }
      g.closePath(); g.clip();
      g.setTransform(m11, m21, m12, m22, dx, dy);
      g.drawImage(N, 0, 0);
      g.restore();
    }
  };
  // sur la poitrine, petit, côté gauche du joueur (le dos de MakeHuman est trop serré dans la
  // découpe UV : son numéro est un décalque, voir numeroDos)
  reporter(0.035, 0.105, 0.43, 0.5, (x, y, z) => z > 0.05, false);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Le numéro du dos : un décalque courbé sur le dos (la surface du maillot mesurée sur le corps
// du joueur), porté par l'os du dos qui pèse le plus sous lui.
function numeroDos(pos, D, man, couleurs, numero, tetes, os) {
  const zm = man.zones.indexOf('maillot'), n = man.sommets;
  const dos = [];
  for (let i = 0; i < n; i++) if (D.zones[i] === zm && pos[i * 3 + 2] < -0.02) dos.push(i);
  if (!dos.length) return null;
  // le col (le haut du dos près de la colonne) et la taille
  let haut = -Infinity, bas = Infinity;
  for (const i of dos) { if (Math.abs(pos[i * 3]) < 0.04) haut = Math.max(haut, pos[i * 3 + 1]); bas = Math.min(bas, pos[i * 3 + 1]); }
  const h = 0.25, l = 0.26, yc = haut - 0.08 - h / 2;
  // la surface du dos, colonne par colonne : le point le plus en arrière près de (x, y)
  const surface = (x, y) => {
    let z = Infinity;
    for (const i of dos) if (Math.abs(pos[i * 3] - x) < 0.025 && Math.abs(pos[i * 3 + 1] - y) < 0.03) z = Math.min(z, pos[i * 3 + 2]);
    return z;
  };
  const NX = 10, NY = 6, sommets = [], uvs = [], ind = [];
  for (let b = 0; b <= NY; b++) for (let a = 0; a <= NX; a++) {
    const x = -l / 2 + (l * a) / NX, y = yc - h / 2 + (h * b) / NY;
    let z = surface(x, y);
    if (!Number.isFinite(z)) z = surface(x * 0.8, y);
    sommets.push(x, y, (Number.isFinite(z) ? z : -0.1) - 0.006);
    uvs.push((l / 2 - x) / l, b / NY);
  }
  for (let b = 0; b < NY; b++) for (let a = 0; a < NX; a++) {
    const k = b * (NX + 1) + a;
    ind.push(k, k + NX + 1, k + 1, k + 1, k + NX + 1, k + NX + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(sommets, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(ind); geo.computeVertexNormals();
  // l'image du numéro
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  let encre = couleurs.numero || '#ffffff';
  if (Math.abs(luminance(encre) - luminance(couleurs.maillot)) < 0.35) encre = luminance(couleurs.maillot) > 0.45 ? '#111111' : '#f5f5f5';
  g.fillStyle = encre; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold ${String(numero).length > 1 ? 200 : 220}px "Arial Narrow", Arial, sans-serif`;
  g.fillText(String(numero), 128, 136);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, roughness: 0.7, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const decal = new THREE.Mesh(geo, mat);
  // l'os qui porte le plus de poids sous le décalque
  const somme = new Map();
  for (const i of dos) {
    if (Math.abs(pos[i * 3 + 1] - yc) > h / 2 || Math.abs(pos[i * 3]) > l / 2) continue;
    for (let k = 0; k < 4; k++) { const o = D.osIndex[i * 4 + k], w = D.osPoids[i * 4 + k]; somme.set(o, (somme.get(o) || 0) + w); }
  }
  let porteur = -1, max = -1;
  for (const [o, w] of somme) if (w > max) { max = w; porteur = o; }
  if (porteur < 0) return null;
  decal.position.copy(tetes[porteur]).multiplyScalar(-1);
  os[porteur].add(decal);
  return decal;
}

export function fabriquerJoueur(D, fiche, couleurs) {
  const { pos } = sommetsDuJoueur(D, fiche);
  const man = D.man;
  const tetes = man.os.map((o) => moyenne(pos, o.tete));
  const queues = man.os.map((o) => moyenne(pos, o.queue));
  // la géométrie
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(D.uv), 2));
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array(D.indices), 1));
  geo.computeVertexNormals();
  // les doubles d'une couture UV et leur original : une seule normale (pas d'arête dans l'ombrage)
  const no = geo.getAttribute('normal').array, nb0 = man.sommets_base, du = man.doubles_uv || man.sommets;
  for (let k = du - nb0; k < D.copieDe.length; k++) {
    const s = D.copieDe[k] * 3, c = (nb0 + k) * 3;
    no[s] += no[c]; no[s + 1] += no[c + 1]; no[s + 2] += no[c + 2];
  }
  for (let k = du - nb0; k < D.copieDe.length; k++) {
    const s = D.copieDe[k] * 3, c = (nb0 + k) * 3, l = Math.hypot(no[s], no[s + 1], no[s + 2]) || 1;
    no[c] = no[s] / l; no[c + 1] = no[s + 1] / l; no[c + 2] = no[s + 2] / l;
  }
  for (let k = du - nb0; k < D.copieDe.length; k++) {
    const s = D.copieDe[k] * 3, c = (nb0 + k) * 3;
    no[s] = no[c]; no[s + 1] = no[c + 1]; no[s + 2] = no[c + 2];
  }
  // l'épaisseur des vêtements : le long de la normale
  const ap0 = fiche.apparence || {};
  const EPAIS = { ras: 0.002, court: 0.007, degrade: 0.005, boucles: 0.014, frises: 0.016, afro: 0.04, dreadlocks: 0.012, tresses: 0.006, long: 0.012, attache: 0.008 };
  const EP = { maillot: 0.007, short: 0.009, chaussettes: 0.003, chaussures: 0.009, cheveux: EPAIS[ap0.coiffure] || 0.007 };
  const nor = geo.getAttribute('normal').array;
  for (let i = 0; i < man.sommets; i++) {
    const e = EP[man.zones[D.zones[i]]];
    if (e) { pos[i * 3] += nor[i * 3] * e; pos[i * 3 + 1] += nor[i * 3 + 1] * e; pos[i * 3 + 2] += nor[i * 3 + 2] * e; }
  }
  geo.getAttribute('position').needsUpdate = true;
  const si = new Uint16Array(man.sommets * 4), sw = new Float32Array(man.sommets * 4);
  for (let i = 0; i < man.sommets * 4; i++) { si[i] = D.osIndex[i]; sw[i] = D.osPoids[i] / 255; }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  // les matériaux, une zone chacun
  const ap = fiche.apparence || {};
  const peau = new THREE.Color(TEINTS[cl(ap.teint || 0, 0, 9)]);
  const mats = {
    peau: new THREE.MeshStandardMaterial({ color: peau, roughness: 0.58, metalness: 0 }),
    maillot: new THREE.MeshStandardMaterial({ map: textureMaillot(D, couleurs, couleurs.numeroMaillot), roughness: 0.78 }),
    short: new THREE.MeshStandardMaterial({ color: new THREE.Color(couleurs.short), roughness: 0.75 }),
    chaussettes: new THREE.MeshStandardMaterial({ color: new THREE.Color(couleurs.chaussettes), roughness: 0.85 }),
    chaussures: new THREE.MeshStandardMaterial({ color: new THREE.Color(couleurs.chaussures), roughness: 0.35, metalness: 0.05 }),
    cheveux: new THREE.MeshStandardMaterial({ color: new THREE.Color(CHEVEUX[ap.cheveux] || CHEVEUX.brun), roughness: 0.82 }),
    yeux: new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a1e18'), roughness: 0.2 }),
    meches: new THREE.MeshStandardMaterial({ color: new THREE.Color(CHEVEUX[ap.cheveux] || CHEVEUX.brun), roughness: 0.8 })
  };
  mats.meches.visible = ['dreadlocks', 'tresses', 'long'].includes(ap.coiffure);
  const liste = man.zones.map((z) => mats[z]);
  man.groupes.forEach((g) => { if (g.n) geo.addGroup(g.debut, g.n, man.zones.indexOf(g.zone)); });
  if (ap.coiffure === 'ras') mats.cheveux.color.lerp(peau, 0.55);
  // le squelette, au repos : chaque os à la position de sa tête
  const os = man.os.map((o, i) => { const b = new THREE.Bone(); b.name = o.nom; return b; });
  man.os.forEach((o, i) => {
    if (o.parent < 0) os[i].position.copy(tetes[i]);
    else { os[o.parent].add(os[i]); os[i].position.copy(tetes[i]).sub(tetes[o.parent]); }
  });
  if (couleurs.numeroMaillot != null) numeroDos(pos, D, man, couleurs, couleurs.numeroMaillot, tetes, os);
  const maillage = new THREE.SkinnedMesh(geo, liste);
  maillage.add(os[man.os.findIndex((o) => o.parent < 0)]);
  maillage.updateMatrixWorld(true);
  maillage.bind(new THREE.Skeleton(os));
  maillage.castShadow = true;
  maillage.frustumCulled = false;
  return { maillage, os, tetes, queues, materiaux: mats, fiche };
}
