// Un personnage riggé au format GLB (glTF 2.0 binaire), lu sans chargeur. Le labo et l'app
// LinkFoot (navigateur et téléphone) le lisent avec ce même code : GLTFLoader demande un DOM
// pour ses textures et un chemin que le bundler de l'app ne résout pas.
//
// Le sous-ensemble lu est celui que Blender exporte pour un personnage : nœuds (translation,
// rotation, échelle, ou matrice), maillages en triangles (position, normale, uv, couleur,
// articulations et poids), matériaux PBR (couleur, métal, rugosité, texture de couleur, carte de
// normales, double face, transparence), une peau par maillage, images PNG ou JPEG dans le
// fichier. Le résultat est celui de GLTFLoader (three.js r160) : mêmes objets (Bone,
// SkinnedMesh, Group, Object3D), mêmes noms, mêmes matrices de liaison, mêmes matériaux.
//
//   const modele = await construirePersonnage(arrayBuffer, { image })   image(octets, type) →
//   ImageBitmap ou null (sans elle, ou si elle rend null : pas de texture, sur téléphone par exemple)
//   const scene = modele.creer()   un personnage neuf (os à lui ; maillages et textures partagés)
import * as THREE from 'three';

const TYPES = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const TAILLES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const ATTRIBUTS = { POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', TEXCOORD_1: 'uv1', COLOR_0: 'color', WEIGHTS_0: 'skinWeight', JOINTS_0: 'skinIndex' };
const FILTRES = { 9728: THREE.NearestFilter, 9729: THREE.LinearFilter, 9984: THREE.NearestMipmapNearestFilter, 9985: THREE.LinearMipmapNearestFilter,
  9986: THREE.NearestMipmapLinearFilter, 9987: THREE.LinearMipmapLinearFilter };
const ENROULEMENTS = { 33071: THREE.ClampToEdgeWrapping, 33648: THREE.MirroredRepeatWrapping, 10497: THREE.RepeatWrapping };

// le nom d'un objet, comme three.js le nettoie (PropertyBinding.sanitizeNodeName)
const nettoyer = (n) => String(n || '').replace(/\s/g, '_').replace(/[[\].:/]/g, '');

// l'UTF-8 du bloc JSON, même sans TextDecoder (certains moteurs JavaScript de téléphone)
function utf8(o) {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(o);
  let s = '';
  for (let i = 0; i < o.length;) {
    const c = o[i++];
    if (c < 0x80) s += String.fromCharCode(c);
    else if (c < 0xe0) s += String.fromCharCode(((c & 0x1f) << 6) | (o[i++] & 0x3f));
    else if (c < 0xf0) s += String.fromCharCode(((c & 0x0f) << 12) | ((o[i++] & 0x3f) << 6) | (o[i++] & 0x3f));
    else {
      const u = (((c & 0x07) << 18) | ((o[i++] & 0x3f) << 12) | ((o[i++] & 0x3f) << 6) | (o[i++] & 0x3f)) - 0x10000;
      s += String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 0x3ff));
    }
  }
  return s;
}

export function lireGlb(buffer) {
  const dv = new DataView(buffer);
  if (dv.byteLength < 20 || dv.getUint32(0, true) !== 0x46546c67 || dv.getUint32(4, true) !== 2) throw new Error('glb : pas un fichier glTF 2.0 binaire');
  let json = null, bin = -1;
  for (let off = 12; off + 8 <= dv.byteLength;) {
    const n = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    if (type === 0x4e4f534a) json = JSON.parse(utf8(new Uint8Array(buffer, off + 8, n)));
    else if (type === 0x004e4942) bin = off + 8;
    off += 8 + n;
  }
  if (!json) throw new Error('glb : pas de bloc JSON');
  if ((json.extensionsRequired || []).length) throw new Error('glb : extensions requises non lues : ' + json.extensionsRequired.join(', '));
  return { json, buffer, bin };
}

// un accesseur, en tableau typé posé sur le fichier (sans copie, comme GLTFLoader)
function accesseur(g, i) {
  const a = g.json.accessors[i], bv = g.json.bufferViews[a.bufferView], T = TYPES[a.componentType], n = TAILLES[a.type];
  if (a.sparse || bv.buffer !== 0 || g.bin < 0) throw new Error('glb : accesseur creux ou hors du fichier, non lu');
  if (bv.byteStride && bv.byteStride !== n * T.BYTES_PER_ELEMENT) throw new Error('glb : données entrelacées, non lues');
  return new T(g.buffer, g.bin + (bv.byteOffset || 0) + (a.byteOffset || 0), a.count * n);
}

// le décodeur d'images d'un navigateur (celui de GLTFLoader : ImageBitmap, sans retournement)
export async function decoderImage(octets, type) {
  if (typeof createImageBitmap !== 'function' || typeof Blob !== 'function') return null;
  try { return await createImageBitmap(new Blob([octets], { type }), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); } catch (e) { return null; }
}

async function texture(g, i, image) {
  const d = g.json.textures[i], src = g.json.images[d.source];
  if (!src || src.bufferView === undefined) return null;
  const bv = g.json.bufferViews[src.bufferView];
  const source = await image(new Uint8Array(g.buffer, g.bin + (bv.byteOffset || 0), bv.byteLength), src.mimeType || 'image/png');
  if (!source) return null;
  const t = new THREE.Texture(source);
  t.flipY = false;
  t.name = d.name || src.name || '';
  const s = (g.json.samplers || [])[d.sampler] || {};
  t.magFilter = FILTRES[s.magFilter] || THREE.LinearFilter;
  t.minFilter = FILTRES[s.minFilter] || THREE.LinearMipmapLinearFilter;
  t.wrapS = ENROULEMENTS[s.wrapS] || THREE.RepeatWrapping;
  t.wrapT = ENROULEMENTS[s.wrapT] || THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

// un matériau du fichier ; les variantes (couleurs de sommets, sans normales, sans tangentes)
// sont faites ensuite pour chaque primitive, comme GLTFLoader.assignFinalMaterial
function materiau(g, i, textures) {
  const d = g.json.materials[i], pbr = d.pbrMetallicRoughness || {};
  const p = { color: new THREE.Color(1, 1, 1), opacity: 1 };
  if (Array.isArray(pbr.baseColorFactor)) {
    const a = pbr.baseColorFactor;
    p.color.setRGB(a[0], a[1], a[2], THREE.LinearSRGBColorSpace);
    p.opacity = a[3];
  }
  const tex = (def, espace) => {
    const t = def && textures[def.index];
    if (!t) return null;
    if (espace) t.colorSpace = espace;
    return t;
  };
  const carte = tex(pbr.baseColorTexture, THREE.SRGBColorSpace);
  if (carte) p.map = carte;
  p.metalness = pbr.metallicFactor !== undefined ? pbr.metallicFactor : 1;
  p.roughness = pbr.roughnessFactor !== undefined ? pbr.roughnessFactor : 1;
  const mr = tex(pbr.metallicRoughnessTexture);
  if (mr) { p.metalnessMap = mr; p.roughnessMap = mr; }
  if (d.doubleSided === true) p.side = THREE.DoubleSide;
  const mode = d.alphaMode || 'OPAQUE';
  if (mode === 'BLEND') { p.transparent = true; p.depthWrite = false; } else {
    p.transparent = false;
    if (mode === 'MASK') p.alphaTest = d.alphaCutoff !== undefined ? d.alphaCutoff : 0.5;
  }
  const normales = tex(d.normalTexture);
  if (normales) {
    p.normalMap = normales;
    p.normalScale = new THREE.Vector2(1, 1);
    if (d.normalTexture.scale !== undefined) p.normalScale.set(d.normalTexture.scale, d.normalTexture.scale);
  }
  const occ = tex(d.occlusionTexture);
  if (occ) { p.aoMap = occ; if (d.occlusionTexture.strength !== undefined) p.aoMapIntensity = d.occlusionTexture.strength; }
  if (d.emissiveFactor !== undefined) p.emissive = new THREE.Color().setRGB(d.emissiveFactor[0], d.emissiveFactor[1], d.emissiveFactor[2], THREE.LinearSRGBColorSpace);
  const em = tex(d.emissiveTexture, THREE.SRGBColorSpace);
  if (em) p.emissiveMap = em;
  const m = new THREE.MeshStandardMaterial(p);
  if (d.name) m.name = d.name;
  return m;
}

function geometrie(g, prim) {
  const geo = new THREE.BufferGeometry();
  for (const [nom, i] of Object.entries(prim.attributes)) {
    const cible = ATTRIBUTS[nom];
    if (!cible) continue;
    const a = g.json.accessors[i];
    geo.setAttribute(cible, new THREE.BufferAttribute(accesseur(g, i), TAILLES[a.type], a.normalized === true));
  }
  if (prim.indices !== undefined) geo.setIndex(new THREE.BufferAttribute(accesseur(g, prim.indices), 1));
  // la boîte des bornes de POSITION, la sphère qui l'entoure (GLTFLoader.computeBounds)
  const pa = g.json.accessors[prim.attributes.POSITION];
  if (pa && pa.min && pa.max) {
    const boite = new THREE.Box3(new THREE.Vector3().fromArray(pa.min), new THREE.Vector3().fromArray(pa.max));
    geo.boundingBox = boite;
    const s = new THREE.Sphere();
    boite.getCenter(s.center);
    s.radius = boite.min.distanceTo(boite.max) / 2;
    geo.boundingSphere = s;
  }
  return geo;
}

// les poids de peau ramenés à une somme de 1 (SkinnedMesh.normalizeSkinWeights), une fois
function normaliserPoids(geo) {
  const w = geo.attributes.skinWeight;
  if (!w) return;
  const v = new THREE.Vector4();
  for (let i = 0; i < w.count; i++) {
    v.fromBufferAttribute(w, i);
    const s = 1 / v.manhattanLength();
    if (s !== Infinity) v.multiplyScalar(s); else v.set(1, 0, 0, 0);
    w.setXYZW(i, v.x, v.y, v.z, v.w);
  }
}

export async function construirePersonnage(buffer, options = {}) {
  const g = lireGlb(buffer), json = g.json;
  const image = options.image === undefined ? decoderImage : options.image;
  // une texture par image et par échantillonneur (le cache de GLTFLoader)
  const cache = new Map();
  const textures = image ? await Promise.all((json.textures || []).map((d, i) => {
    const cle = ((json.images[d.source] || {}).bufferView) + ':' + d.sampler;
    if (!cache.has(cle)) cache.set(cle, texture(g, i, image));
    return cache.get(cle);
  })) : [];
  const materiaux = (json.materials || []).map((d, i) => materiau(g, i, textures));
  // les maillages qu'une peau déforme (ceux d'un nœud qui porte une peau : GLTFLoader._markDefs)
  const os = new Set(), deformes = new Set();
  (json.skins || []).forEach((s) => s.joints.forEach((j) => os.add(j)));
  json.nodes.forEach((n) => { if (n.mesh !== undefined && n.skin !== undefined) deformes.add(n.mesh); });
  // chaque primitive : sa géométrie et son matériau final, faits une fois pour tous les joueurs
  const variantes = new Map();
  const primitives = json.meshes.map((m, mi) => m.primitives.map((prim) => {
    if (prim.mode !== undefined && prim.mode !== 4) throw new Error('glb : primitive autre que des triangles, non lue');
    const geo = geometrie(g, prim);
    if (deformes.has(mi)) normaliserPoids(geo);
    let mat = prim.material !== undefined ? materiaux[prim.material] : new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 1 });
    const sansTangentes = !geo.attributes.tangent, couleurs = !!geo.attributes.color, plat = !geo.attributes.normal;
    if (sansTangentes || couleurs || plat) {
      const cle = mat.uuid + (sansTangentes ? ':t' : '') + (couleurs ? ':c' : '') + (plat ? ':p' : '');
      if (!variantes.has(cle)) {
        const v = mat.clone();
        if (couleurs) v.vertexColors = true;
        if (plat) v.flatShading = true;
        if (sansTangentes && v.normalScale) v.normalScale.y *= -1;
        variantes.set(cle, v);
      }
      mat = variantes.get(cle);
    }
    return { geo, mat };
  }));
  const inverses = (json.skins || []).map((s) => {
    const a = s.inverseBindMatrices !== undefined ? accesseur(g, s.inverseBindMatrices) : null;
    return s.joints.map((j, k) => (a ? new THREE.Matrix4().fromArray(a, k * 16) : new THREE.Matrix4()));
  });

  function creer() {
    const noms = new Map();
    const unique = (n) => {
      const s = nettoyer(n);
      if (noms.has(s)) { const k = noms.get(s) + 1; noms.set(s, k); return s + '_' + k; }
      noms.set(s, 0);
      return s;
    };
    const sd = json.scenes[json.scene || 0];
    const scene = new THREE.Group();
    if (sd.name) scene.name = unique(sd.name);
    // les noms des nœuds d'abord, dans l'ordre où GLTFLoader les donne (en profondeur depuis la
    // scène), ceux des maillages ensuite
    const nomNoeud = [];
    const nommer = (i) => { const n = json.nodes[i]; nomNoeud[i] = n.name ? unique(n.name) : ''; (n.children || []).forEach(nommer); };
    sd.nodes.forEach(nommer);
    const objets = json.nodes.map((n, i) => {
      let contenu = null;
      if (n.mesh !== undefined) {
        const md = json.meshes[n.mesh], peau = deformes.has(n.mesh);
        const maillages = primitives[n.mesh].map(({ geo, mat }) => {
          const m = peau ? new THREE.SkinnedMesh(geo, mat) : new THREE.Mesh(geo, mat);
          m.name = unique(md.name || 'mesh_' + n.mesh);
          return m;
        });
        if (maillages.length === 1) contenu = maillages[0];
        else { contenu = new THREE.Group(); maillages.forEach((m) => contenu.add(m)); }
      }
      let o;
      if (os.has(i)) { o = new THREE.Bone(); if (contenu) o.add(contenu); } else o = contenu || new THREE.Object3D();
      if (n.name) { o.userData.name = n.name; o.name = nomNoeud[i] !== undefined ? nomNoeud[i] : unique(n.name); }
      if (n.matrix !== undefined) o.applyMatrix4(new THREE.Matrix4().fromArray(n.matrix));
      else {
        if (n.translation !== undefined) o.position.fromArray(n.translation);
        if (n.rotation !== undefined) o.quaternion.fromArray(n.rotation);
        if (n.scale !== undefined) o.scale.fromArray(n.scale);
      }
      return o;
    });
    // une peau, un squelette (partagé par les maillages qui la portent), lié avant que les
    // enfants du nœud ne s'y ajoutent, comme GLTFLoader.loadNode
    const squelettes = (json.skins || []).map((s, k) => new THREE.Skeleton(s.joints.map((j) => objets[j]), inverses[k].map((m) => m.clone())));
    const identite = new THREE.Matrix4();
    json.nodes.forEach((n, i) => {
      if (n.skin !== undefined) objets[i].traverse((m) => { if (m.isSkinnedMesh) m.bind(squelettes[n.skin], identite); });
      (n.children || []).forEach((c) => objets[i].add(objets[c]));
    });
    sd.nodes.forEach((i) => scene.add(objets[i]));
    return scene;
  }

  return {
    json, url: options.url || null, animations: [], creer,
    // libérer ce qui est partagé (géométries, matériaux, textures)
    detruire() {
      primitives.forEach((l) => l.forEach(({ geo }) => geo.dispose()));
      materiaux.forEach((m) => m.dispose()); variantes.forEach((m) => m.dispose());
      new Set(textures).forEach((t) => t && t.dispose());
    }
  };
}
