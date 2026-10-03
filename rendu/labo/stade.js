// Le stade du laboratoire : la pelouse tondue en bandes, les lignes, les buts et leurs filets, les
// panneaux, des tribunes en gradins garnies d'un public, les pylônes, le ciel. Tout en géométrie et
// en textures peintes ici : aucun fichier extérieur.
import * as THREE from 'three';

const W = 34, LG = 52.5;

function hasard(graine) {
  let s = graine >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function pelouse(scene, meteo) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 2048;
  const g = c.getContext('2d');
  // bandes de tonte perpendiculaires aux lignes de touche (12 par moitié), herbe bruitée
  const n = 24, h = 2048 / n;
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#3a7a33' : '#44893b'; g.fillRect(0, i * h, 1024, h + 1); }
  const img = g.getImageData(0, 0, 1024, 2048), R = hasard(7);
  for (let k = 0; k < img.data.length; k += 4) { const b = (R() - 0.5) * 22; img.data[k] += b * 0.7; img.data[k + 1] += b; img.data[k + 2] += b * 0.5; }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  // la pelouse couvre le terrain et ses abords (2,5 m de part et d'autre)
  // mouillée, la pelouse est plus sombre et brille un peu ; sous la neige, elle blanchit
  const mouillee = meteo === 'pluie';
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(2 * W + 10, 2 * LG + 10), new THREE.MeshStandardMaterial({ map: tex, roughness: mouillee ? 0.62 : 0.97,
    color: mouillee ? '#d4dcd4' : meteo === 'neige' ? '#e8ecee' : '#ffffff' }));
  sol.rotation.x = -Math.PI / 2; sol.receiveShadow = true; scene.add(sol);
  const abords = new THREE.Mesh(new THREE.PlaneGeometry(2 * W + 40, 2 * LG + 40), new THREE.MeshStandardMaterial({ color: '#3b7a36', roughness: 1 }));
  abords.rotation.x = -Math.PI / 2; abords.position.y = -0.01; abords.receiveShadow = true; scene.add(abords);
}

function lignes(scene) {
  const blanc = new THREE.MeshStandardMaterial({ color: '#f1f3ee', roughness: 0.8 });
  const trait = (x0, z0, x1, z1) => {
    const lg = Math.hypot(x1 - x0, z1 - z0), m = new THREE.Mesh(new THREE.PlaneGeometry(0.12, lg), blanc);
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(x1 - x0, z1 - z0); m.position.set((x0 + x1) / 2, 0.006, (z0 + z1) / 2);
    m.receiveShadow = true; scene.add(m);
  };
  const arc = (cx, cz, r, a0, a1) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.06, r + 0.06, 96, 1, a0, a1 - a0), blanc);
    m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.006, cz); m.receiveShadow = true; scene.add(m);
  };
  trait(-W, -LG, W, -LG); trait(-W, LG, W, LG); trait(-W, -LG, -W, LG); trait(W, -LG, W, LG); trait(-W, 0, W, 0);
  arc(0, 0, 9.15, 0, Math.PI * 2);
  for (const s of [-1, 1]) {
    const z = s * LG;
    trait(-20.16, z, -20.16, z - s * 16.5); trait(20.16, z, 20.16, z - s * 16.5); trait(-20.16, z - s * 16.5, 20.16, z - s * 16.5);
    trait(-9.16, z, -9.16, z - s * 5.5); trait(9.16, z, 9.16, z - s * 5.5); trait(-9.16, z - s * 5.5, 9.16, z - s * 5.5);
    // l'arc de la surface, hors de la surface seulement ; le point de penalty
    const a = Math.acos(5.5 / 9.15);
    // la RingGeometry part de +X et tourne vers +Y, devenu −Z après la rotation du plan
    if (s > 0) arc(0, z - s * 11, 9.15, Math.PI / 2 - a, Math.PI / 2 + a);
    else arc(0, z - s * 11, 9.15, -Math.PI / 2 - a, -Math.PI / 2 + a);
    const pt = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), blanc); pt.rotation.x = -Math.PI / 2; pt.position.set(0, 0.006, z - s * 11); scene.add(pt);
    for (const x of [-W, W]) arc(x, z, 1, x < 0 ? (s > 0 ? -Math.PI / 2 : 0) : (s > 0 ? Math.PI : Math.PI / 2), x < 0 ? (s > 0 ? 0 : Math.PI / 2) : (s > 0 ? 3 * Math.PI / 2 : Math.PI));
  }
}

function buts(scene) {
  const poteau = new THREE.MeshStandardMaterial({ color: '#fbfbfb', roughness: 0.35 });
  const fil = new THREE.LineBasicMaterial({ color: '#e8e8e8', transparent: true, opacity: 0.55 });
  for (const s of [-1, 1]) {
    const z = s * LG, g = new THREE.Group();
    for (const x of [-3.66, 3.66]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.44, 16), poteau); p.position.set(x, 1.22, z); p.castShadow = true; g.add(p); }
    const barre = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7.44, 16), poteau); barre.rotation.z = Math.PI / 2; barre.position.set(0, 2.44, z); barre.castShadow = true; g.add(barre);
    // le filet : un maillage de fils (12 cm), le fond à 2 m, le haut à 1 m
    const pts = [], prof = (y) => 1 + (2.44 - y) / 2.44, pas = 0.24;
    for (let x = -3.66; x <= 3.661; x += pas) for (let y = 0; y < 2.44; y += pas) {
      const y2 = Math.min(2.44, y + pas);
      pts.push(x, y, z + s * prof(y), x, y2, z + s * prof(y2));
    }
    for (let y = 0; y <= 2.441; y += pas) pts.push(-3.66, y, z + s * prof(y), 3.66, y, z + s * prof(y));
    for (const x of [-3.66, 3.66]) for (let d = 0; d <= 2.001; d += pas) pts.push(x, 0, z + s * d, x, 2.44 - Math.max(0, d - 1) * 2.44, z + s * d);
    for (let x = -3.66; x <= 3.661; x += pas) pts.push(x, 2.44, z, x, 2.44, z + s * 1);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.add(new THREE.LineSegments(geo, fil));
    scene.add(g);
  }
}

// le public : des rangées de sièges, des spectateurs vêtus surtout de sombre et de neutre, avec les
// couleurs des deux clubs (plus de supporters du club qui reçoit), quelques sièges vides
function texturePublic(graine, largeur, hauteur, clubs) {
  const c = document.createElement('canvas'); c.width = largeur; c.height = hauteur;
  const g = c.getContext('2d'), R = hasard(graine);
  g.fillStyle = '#23282f'; g.fillRect(0, 0, largeur, hauteur);
  const neutres = ['#1d2025', '#2c3138', '#3b4048', '#55595f', '#6d7177', '#d6d6d2', '#1f2a44', '#3a2f2a', '#4a4f3a'];
  const [dom, ext] = clubs || ['#2e86de', '#c0392b'];
  const peaux = ['#e9c39f', '#c8956b', '#8d5a3b', '#5b3a26', '#f0d0b0'];
  const rang = 7;
  for (let y = 0; y < hauteur; y += rang) {
    g.fillStyle = '#30353d'; g.fillRect(0, y + rang - 2, largeur, 2);
    // des tribunes plus pleines en bas qu'en haut
    const vide = 0.06 + 0.14 * (y / hauteur);
    for (let x = 0; x < largeur; x += 4) {
      if (R() < vide) continue;
      const r = R();
      const habit = r < 0.4 ? dom : r < 0.52 ? ext : neutres[Math.floor(R() * neutres.length)];
      const ombre = 0.75 + R() * 0.3;
      const col = new THREE.Color(habit).multiplyScalar(ombre);
      g.fillStyle = '#' + col.getHexString();
      const dx = Math.floor(R() * 2);
      g.fillRect(x + dx, y + 2, 3, 3);
      g.fillStyle = peaux[Math.floor(R() * peaux.length)];
      g.fillRect(x + dx + 1, y + 1, 1, 1);
    }
  }
  // le haut de la tribune dans l'ombre du toit
  const gr = g.createLinearGradient(0, 0, 0, hauteur);
  gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(0.35, 'rgba(0,0,0,0.1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, largeur, hauteur);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// une tribune en gradins : depuis une ligne au sol, elle monte en s'éloignant du terrain
function tribune(scene, cx, cz, longueur, orient, profondeur, hauteur, graine, clubs, nuit) {
  const g = new THREE.Group();
  const pente = new THREE.Mesh(new THREE.PlaneGeometry(longueur, Math.hypot(profondeur, hauteur)),
    new THREE.MeshStandardMaterial({ map: texturePublic(graine, 2048, 256, clubs), roughness: 0.95, color: nuit ? '#5a5f66' : '#ffffff' }));
  pente.rotation.x = -Math.atan2(hauteur, profondeur);
  pente.position.set(0, 1.2 + hauteur / 2, -profondeur / 2);
  g.add(pente);
  // la nuit, les projecteurs visent la pelouse : les tribunes restent dans la pénombre
  const beton = new THREE.MeshStandardMaterial({ color: nuit ? '#2c3036' : '#59616b', roughness: 0.9 });
  const muret = new THREE.Mesh(new THREE.BoxGeometry(longueur, 1.2, 0.3), beton); muret.position.set(0, 0.6, 0); g.add(muret);
  const fond = new THREE.Mesh(new THREE.BoxGeometry(longueur, hauteur + 6, 0.5), beton); fond.position.set(0, (hauteur + 6) / 2, -profondeur - 0.3); g.add(fond);
  const toit = new THREE.Mesh(new THREE.BoxGeometry(longueur + 2, 0.5, profondeur * 0.75), new THREE.MeshStandardMaterial({ color: '#8b939c', roughness: 0.6, metalness: 0.2 }));
  toit.position.set(0, hauteur + 6, -profondeur * 0.62); g.add(toit);
  g.position.set(cx, 0, cz); g.rotation.y = orient;
  scene.add(g);
}

function panneaux(scene) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 1024, 0); grad.addColorStop(0, '#0f2a1a'); grad.addColorStop(0.5, '#1d6b3a'); grad.addColorStop(1, '#0f2a1a');
  g.fillStyle = grad; g.fillRect(0, 0, 1024, 64);
  g.fillStyle = '#e8f8ec'; g.font = 'bold 40px sans-serif'; g.textBaseline = 'middle';
  for (let x = 20; x < 1024; x += 260) g.fillText('LINKFOOT', x, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({ map: t, emissive: '#1d6b3a', emissiveIntensity: 0.25, roughness: 0.5 });
  const poser = (x, z, longueur, orient) => {
    const tx = t.clone(); tx.repeat.set(longueur / 26, 1); tx.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.BoxGeometry(longueur, 0.9, 0.12), [mat, mat, mat, mat, new THREE.MeshStandardMaterial({ map: tx, emissive: '#1d6b3a', emissiveIntensity: 0.25 }), mat]);
    m.position.set(x, 0.45, z); m.rotation.y = orient; m.castShadow = true; scene.add(m);
  };
  poser(W + 4.5, 0, 2 * LG, Math.PI / 2);
  poser(-W - 4.5, 0, 2 * LG, -Math.PI / 2);
  for (const s of [-1, 1]) { poser(-20, s * (LG + 4), 30, s > 0 ? Math.PI : 0); poser(20, s * (LG + 4), 30, s > 0 ? Math.PI : 0); }
}

// le ciel selon le temps : bleu de jour, gris de pluie ou de neige, nuit noire sous les projecteurs
const CIELS = { soleil: ['#5d93cf', '#d6e6f2'], pluie: ['#5b636b', '#9aa3aa'], neige: ['#8e979e', '#c9d0d4'], nuit: ['#03050a', '#141c28'] };
function ciel(scene, meteo) {
  const [h, b] = CIELS[meteo] || CIELS.soleil;
  const geo = new THREE.SphereGeometry(400, 32, 16), col = [];
  const haut = new THREE.Color(h), horizon = new THREE.Color(b);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = Math.max(0, p.getY(i) / 400); const c = horizon.clone().lerp(haut, Math.pow(y, 0.6)); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
}

function pylones(scene, nuit) {
  const acier = new THREE.MeshStandardMaterial({ color: '#9aa3ab', roughness: 0.5, metalness: 0.4 });
  const lampe = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6e0', emissiveIntensity: nuit ? 3 : 0.6 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 42, 10), acier); m.position.set(sx * 62, 21, sz * 78); scene.add(m);
    const tete = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 1), lampe); tete.position.set(sx * 62, 43, sz * 78); tete.lookAt(0, 0, 0); scene.add(tete);
  }
}

// La pluie et la neige : des gouttes (traits) ou des flocons autour de ce que regarde la caméra,
// dont la position ne dépend que du temps (une vidéo filmée deux fois est la même).
export function precipitations(scene, meteo) {
  if (meteo !== 'pluie' && meteo !== 'neige') return null;
  const pluie = meteo === 'pluie', n = pluie ? 6000 : 2500, R = hasard(11);
  const base = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { base[i * 3] = (R() - 0.5) * 70; base[i * 3 + 1] = R() * 24; base[i * 3 + 2] = (R() - 0.5) * 70; }
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * (pluie ? 6 : 3));
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const objet = pluie
    ? new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#c9dbe8', transparent: true, opacity: 0.22, depthWrite: false }))
    : new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.12, transparent: true, opacity: 0.85, depthWrite: false }));
  objet.frustumCulled = false;
  scene.add(objet);
  const vy = pluie ? 9 : 1.1;
  return {
    placer(t, centre) {
      for (let i = 0; i < n; i++) {
        const y = ((base[i * 3 + 1] - vy * t) % 24 + 24) % 24;
        // la pluie tombe un peu en biais, la neige flotte
        const dx = pluie ? (24 - y) * 0.12 : Math.sin(t * 0.7 + i) * 0.4;
        const x = centre.x + base[i * 3] + dx, z = centre.z + base[i * 3 + 2];
        if (pluie) pos.set([x, y, z, x - 0.06, y + 0.45, z], i * 6);
        else pos.set([x, y, z], i * 3);
      }
      geo.attributes.position.needsUpdate = true;
    }
  };
}

// cote : le côté de la caméra principale (sa tribune n'est pas dessinée : la caméra y est)
export function construireStade(scene, { cote = -1, clubs = null, meteo = 'soleil' } = {}) {
  const nuit = meteo === 'nuit' || meteo === 'nocturne';
  ciel(scene, nuit ? 'nuit' : meteo); pelouse(scene, meteo); lignes(scene); buts(scene); panneaux(scene); pylones(scene, nuit);
  // l'avant d'une tribune (son +Z local) regarde le terrain : rotation.y envoie +Z vers (sin a, cos a)
  if (cote !== -1) tribune(scene, -W - 9, 0, 2 * LG + 20, Math.PI / 2, 22, 16, 1, clubs, nuit);
  if (cote !== 1) tribune(scene, W + 9, 0, 2 * LG + 20, -Math.PI / 2, 22, 16, 2, clubs, nuit);
  tribune(scene, 0, -LG - 9, 2 * W + 20, 0, 18, 12, 3, clubs, nuit);
  tribune(scene, 0, LG + 9, 2 * W + 20, Math.PI, 18, 12, 4, clubs, nuit);
}
