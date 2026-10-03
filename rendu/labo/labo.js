// Le laboratoire du rendu réel : une scène du moteur LinkFoot, jouée par des corps humains
// (MakeHuman) qui bougent avec de vraies captures (base CMU), dans un stade éclairé.
// Paramètres d'URL : doc (le document), joueurs (« focus », « tous », ou des codes), focus (le
// joueur suivi), camera (« tv », « suivi », « serre », « face », « dos », « cote », « portrait »), t (instant de départ), lecture
// (1 : temps réel), hud (0 : sans le bandeau du score en vue télé), perso (un personnage riggé,
// glTF, GLB ou FBX, à la place du corps MakeHuman pour tous les joueurs : voir personnage.js), base
// (le dossier de la base de mouvements, /rendu/donnees/ par défaut).
import * as THREE from 'three';
import { chargerCorps, fabriquerJoueur } from './corps.js';
import { chargerMouvements, Animateur } from './mouvement.js';
import { fabriquerJoueurPersonnage } from './personnage.js';
import { chargerPersonnage } from './charger.js';
import { Match } from './match.js';
import { construireStade, precipitations } from './stade.js';

const params = new URLSearchParams(location.search);
const L = Number(params.get('l') || innerWidth || 1280), H = Number(params.get('h') || innerHeight || 720);
const rendu = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
rendu.setSize(L, H);
rendu.shadowMap.enabled = true; rendu.shadowMap.type = THREE.PCFSoftShadowMap;
rendu.toneMapping = THREE.ACESFilmicToneMapping; rendu.toneMappingExposure = 1.05;
rendu.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(rendu.domElement);

const params0 = new URLSearchParams(location.search);
const modeCam = params0.get('camera') || ((params0.get('joueurs') || 'focus') === 'focus' ? 'suivi' : 'tv');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#cfe0ee');
scene.fog = new THREE.Fog('#cfe0ee', 140, 420);
const ciel = new THREE.HemisphereLight('#e4f0ff', '#3c5a2c', 0.85);
scene.add(ciel);
const soleil = new THREE.DirectionalLight('#fff1dc', 2.7);
soleil.castShadow = true;
// la vue télé couvre 40 m de terrain : l'ombre la couvre aussi
const DEMI_OMBRE = modeCam === 'tv' ? 34 : 14;
soleil.shadow.mapSize.set(modeCam === 'tv' ? 4096 : 2048, modeCam === 'tv' ? 4096 : 2048);
Object.assign(soleil.shadow.camera, { left: -DEMI_OMBRE, right: DEMI_OMBRE, top: DEMI_OMBRE, bottom: -DEMI_OMBRE, near: 1, far: 160 });
soleil.shadow.bias = -0.0004; soleil.shadow.normalBias = 0.03;
scene.add(soleil, soleil.target);

// ---- le ballon ----
function textureBallon() {
  // un ballon blanc à panneaux sombres (motif original, pas celui d'une marque)
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f4f2'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#1f3d6b';
  for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) {
    const x = i * 32 + (j % 2) * 16, y = j * 32 + 16;
    g.beginPath(); for (let k = 0; k < 5; k++) { const a = k * 2 * Math.PI / 5; g.lineTo(x + 7 * Math.cos(a), y + 7 * Math.sin(a)); } g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const ballon = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 16), new THREE.MeshStandardMaterial({ map: textureBallon(), roughness: 0.4 }));
ballon.castShadow = true; scene.add(ballon);
let ballonPrec = null;

// ---- les joueurs ----
const doc = await fetch(params.get('doc') || '/unreal/LinkFoot/Content/LinkFoot/Scenes/01-sprint_droit.json').then((r) => r.json());
const match = new Match(doc);
// le temps du match (document : soleil, pluie, neige, nuit) : ciel, lumières, précipitations
const meteo = (doc.match && doc.match.meteo) || 'soleil', nuit = meteo === 'nuit' || meteo === 'nocturne';
construireStade(scene, { cote: -1, clubs: [doc.equipes.H.maillot.c1, doc.equipes.A.maillot.c1], meteo });
const precip = precipitations(scene, meteo);
let decalSoleil = new THREE.Vector3(-22, 34, 16);
if (nuit) {
  // la nuit : les projecteurs ; la lumière principale (avec les ombres) vient d'un pylône, une
  // seconde, sans ombre, du pylône opposé
  scene.background = new THREE.Color('#0a0f18'); scene.fog = new THREE.Fog('#0a0f18', 120, 380);
  ciel.color.set('#9fb3d1'); ciel.groundColor.set('#1a2a1a'); ciel.intensity = 0.35;
  soleil.color.set('#f4f6ff'); soleil.intensity = 2.3; decalSoleil = new THREE.Vector3(-30, 42, -38);
  const second = new THREE.DirectionalLight('#eef2ff', 1.1); second.position.set(40, 42, 50); scene.add(second);
} else if (meteo === 'pluie' || meteo === 'neige') {
  // couvert : une lumière douce et grise, peu d'ombre
  const f = meteo === 'pluie' ? '#9aa3aa' : '#c3cacf';
  scene.background = new THREE.Color(f); scene.fog = new THREE.Fog(f, 90, 300);
  ciel.color.set('#d0d7dd'); ciel.groundColor.set('#3a4a3a'); ciel.intensity = 1.15;
  soleil.color.set('#e6ecf2'); soleil.intensity = 1.0; decalSoleil = new THREE.Vector3(-8, 40, 6);
}
const persoUrl = params.get('perso');
const [D, M, modele] = await Promise.all([chargerCorps('/rendu/donnees/'), chargerMouvements(params.get('base') || '/rendu/donnees/'),
  persoUrl ? chargerPersonnage(persoUrl) : null]);
const focus = params.has('focus') ? Number(params.get('focus')) : doc.scene ? doc.scene.focus : 0;
const choix = params.get('joueurs') || 'focus';
const codes = choix === 'focus' ? [focus] : choix === 'tous' ? [...match.joueurs.keys()].filter((c) => c < 22) : choix.split(',').map(Number);
const joueurs = [];
for (const code of codes) {
  const j = match.joueurs.get(code); if (!j) continue;
  const m = doc.equipes[j.camp].maillot;
  const gb = j.poste === 'GB';
  const coul = gb ? { maillot: j.camp === 'H' ? '#E8C547' : '#2B2F36', short: '#1d1f22', chaussettes: j.camp === 'H' ? '#E8C547' : '#2B2F36', chaussures: '#111111', numero: '#111111' }
    : { maillot: m.c1, short: m.c2, chaussettes: m.c1, chaussures: ['#151515', '#f2f2f2', '#d8342b', '#2457d6'][code % 4], numero: m.c2 };
  coul.numeroMaillot = j.numero;
  const J = modele ? fabriquerJoueurPersonnage(modele, j, coul, D.man) : fabriquerJoueur(D, j, coul);
  scene.add(J.maillage);
  joueurs.push({ code, J, A: new Animateur(M, J, J.corpsMan || D.man) });
}

// ---- la caméra ----
const mode = modeCam;
const cam = new THREE.PerspectiveCamera(mode === 'tv' ? 24 : 30, L / H, 0.1, 1200);
const visee = new THREE.Vector3(), camPos = new THREE.Vector3();
let camInit = false;
// la caméra télé : dans la tribune principale (18 m derrière la touche, 15 m de haut), elle suit le
// ballon en panoramique, glisse un peu le long de la touche, et cadre environ 31 m de terrain
let largeurCadre = 31, lacetFace = null, lacetDos = null, lacetCote = null, camInitCadre = false;
function placerCamera(t, dt) {
  let cible;
  if (mode === 'tv') { const b = match.ballon(t).p; cible = new THREE.Vector3(b[0] * 0.75, 0.6, b[2]); }
  else { const p = match.position(focus, t); cible = new THREE.Vector3(p[0], 1.0, p[1]); }
  let pos;
  if (mode === 'tv') pos = new THREE.Vector3(-34 - 18, 15, cible.z * 0.55);
  else if (mode === 'serre') pos = new THREE.Vector3(cible.x - 5.5, 1.6, cible.z + 1.5);
  else if (mode === 'face') {
    // de face, à 7 m, du côté où le joueur regarde (le gardien vu depuis le terrain)
    if (lacetFace == null) lacetFace = match.lacet(focus, t);
    pos = new THREE.Vector3(cible.x + Math.sin(lacetFace) * 7, 1.5, cible.z + Math.cos(lacetFace) * 7);
  }
  else if (mode === 'dos') {
    // derrière le joueur, à 6 m, qui tourne avec lui
    const l = match.lacet(focus, t);
    lacetDos = lacetDos == null ? l : lacetDos + Math.atan2(Math.sin(l - lacetDos), Math.cos(l - lacetDos)) * (1 - Math.exp(-dt / 0.6));
    pos = new THREE.Vector3(cible.x - Math.sin(lacetDos) * 6, 2.0, cible.z - Math.cos(lacetDos) * 6);
  }
  else if (mode === 'portrait') {
    // le visage, à 1,4 m devant lui (pour juger la peau, les yeux, la barbe, le maillot)
    const j = joueurs.find((x) => x.code === focus);
    if (j) {
      const tete = j.A.P[j.A.cou[2]], l = j.A.lacetLisse || 0;
      cible = new THREE.Vector3(tete.x, tete.y + 0.02, tete.z);
      pos = new THREE.Vector3(tete.x + Math.sin(l + 0.35) * 1.4, tete.y + 0.05, tete.z + Math.cos(l + 0.35) * 1.4);
    } else pos = new THREE.Vector3(cible.x - 2, 1.7, cible.z);
  }
  else if (mode === 'cote') {
    // de profil, à 7 m sur la gauche de la course, à hauteur de hanche : pour juger la foulée
    const v = match.vitesse(focus, t), l = Math.hypot(v[0], v[1]);
    const cap = l > 0.5 ? Math.atan2(v[0], v[1]) : match.lacet(focus, t);
    lacetCote = lacetCote == null ? cap : lacetCote + Math.atan2(Math.sin(cap - lacetCote), Math.cos(cap - lacetCote)) * (1 - Math.exp(-dt / 0.8));
    pos = new THREE.Vector3(cible.x + Math.cos(lacetCote) * 7, 1.0, cible.z - Math.sin(lacetCote) * 7);
  }
  else pos = new THREE.Vector3(cible.x - 11, 3.2, cible.z + 2);
  const k = camInit && mode !== 'cote' && mode !== 'portrait' ? 1 - Math.exp(-dt / (mode === 'tv' ? 0.45 : 0.25)) : 1;
  visee.lerp(cible, k); camPos.lerp(pos, k); camInit = true;
  cam.position.copy(camPos); cam.lookAt(visee);
  if (mode === 'tv') {
    // le cadre se resserre quand le ballon approche d'un but (31 m de terrain, 24 m près du but)
    const b = match.ballon(t).p, prochesBut = Math.max(0, Math.min(1, (28 - (52.5 - Math.abs(b[2]))) / 16));
    const voulu = 31 - 7 * prochesBut * prochesBut * (3 - 2 * prochesBut);
    largeurCadre += (voulu - largeurCadre) * (camInitCadre ? 1 - Math.exp(-dt / 0.8) : 1); camInitCadre = true;
    const d = camPos.distanceTo(visee), hfov = 2 * Math.atan(largeurCadre / 2 / d);
    cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / cam.aspect));
    cam.updateProjectionMatrix();
  }
  soleil.position.copy(visee).add(decalSoleil); soleil.target.position.copy(visee);
}

// ---- le temps : pas fixes de 1/60 s, pour que tout soit reproductible ----
let tCourant = Number(params.get('t') || match.t0 + 0.05);
const PAS = 1 / 60;
function avancerJusqua(t) {
  while (tCourant < t - 1e-9) {
    const dt = Math.min(PAS, t - tCourant);
    tCourant += dt;
    for (const p of joueurs) if (match.present(p.code, tCourant)) p.A.mettreAJour(match, p.code, tCourant, dt);
    placerCamera(tCourant, dt);
  }
  placerBallon(tCourant);
  if (precip) precip.placer(tCourant, camPos.clone().lerp(visee, 0.65));
}
// le ballon : sa position (match.js) et sa rotation, qui roule sans glisser sur l'herbe
function placerBallon(t) {
  const b = match.ballonVisuel(t);
  let p = b.p;
  if (b.mains) {
    // le gardien tient le ballon ; il le lâche 0,3 s avant de le frapper
    const g = joueurs.find((j) => j.code === b.porteur);
    if (g && g.A.mains) {
      const m = g.A.mains(), k = Math.max(0, Math.min(1, (t - (b.te - 0.3)) / 0.3)), s = k * k * (3 - 2 * k);
      p = [m[0] + (p[0] - m[0]) * s, m[1] + (p[1] - m[1]) * s, m[2] + (p[2] - m[2]) * s];
    }
  }
  const nouveau = new THREE.Vector3(p[0], p[1] + 0.11, p[2]);
  if (ballonPrec) {
    const d = new THREE.Vector3().subVectors(nouveau, ballonPrec); d.y = 0;
    const l = d.length();
    if (l > 1e-5 && l < 3) {
      const axe = new THREE.Vector3(d.z, 0, -d.x).normalize();
      ballon.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axe, l / 0.11));
    }
  }
  ballon.position.copy(nouveau);
  ballonPrec = nouveau;
}
// ---- le bandeau de la télévision : les deux clubs, le score et l'horloge du moteur ----
const hudActif = mode === 'tv' && params.get('hud') !== '0';
const hudScene = new THREE.Scene(), hudCam = new THREE.OrthographicCamera(0, L, H, 0, -1, 1);
const hudToile = document.createElement('canvas'); hudToile.width = 640; hudToile.height = 80;
const hudTex = new THREE.CanvasTexture(hudToile); hudTex.colorSpace = THREE.SRGBColorSpace;
const echHud = H / 720;
const hud = new THREE.Mesh(new THREE.PlaneGeometry(320 * echHud, 40 * echHud), new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, depthTest: false, toneMapped: false }));
hud.position.set(24 * echHud + 160 * echHud, H - 24 * echHud - 20 * echHud, 0);
hudScene.add(hud);
const sigle = (nom) => {
  const mots = String(nom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().split(/\s+/).filter((w) => w && !['FC', 'AS', 'SC', 'US', 'RC', 'OGC', 'AC', 'CF'].includes(w));
  return (mots[0] || 'EQU').slice(0, 3);
};
let hudTexte = '';
function dessinerHud(t) {
  const [i, u] = match.index(t), ligne = match.lignes[i], col = match.col;
  const horloge = ligne[col.horloge] + u, mn = Math.floor(horloge / 60), sec = Math.floor(horloge % 60);
  const sd = ligne[col.score_d], se = ligne[col.score_e];
  const texte = `${mn}:${sec}:${sd}:${se}`;
  if (texte === hudTexte) return;
  hudTexte = texte;
  const g = hudToile.getContext('2d');
  g.clearRect(0, 0, 640, 80);
  const bloc = (x, w, coul) => { g.fillStyle = coul; g.fillRect(x, 8, w, 64); };
  bloc(0, 132, 'rgba(14,17,22,0.92)'); bloc(132, 8, doc.equipes.H.maillot.c1);
  bloc(140, 120, 'rgba(244,246,248,0.96)');
  bloc(260, 8, doc.equipes.A.maillot.c1); bloc(268, 132, 'rgba(14,17,22,0.92)');
  bloc(408, 120, 'rgba(30,107,58,0.95)');
  g.textBaseline = 'middle'; g.textAlign = 'center';
  g.font = 'bold 34px Arial, sans-serif'; g.fillStyle = '#f4f6f8';
  g.fillText(sigle(doc.equipes.H.club), 66, 41); g.fillText(sigle(doc.equipes.A.club), 334, 41);
  g.fillStyle = '#0e1116'; g.font = 'bold 38px Arial, sans-serif';
  g.fillText(`${sd} - ${se}`, 200, 42);
  g.fillStyle = '#f4f6f8'; g.font = 'bold 32px Arial, sans-serif';
  g.fillText(`${String(mn).padStart(2, '0')}:${String(sec).padStart(2, '0')}`, 468, 42);
  hudTex.needsUpdate = true;
}
rendu.autoClear = false;
function afficher() {
  rendu.clear();
  rendu.render(scene, cam);
  if (hudActif) { dessinerHud(tCourant); rendu.clearDepth(); rendu.render(hudScene, hudCam); }
}
avancerJusqua(tCourant + PAS);
afficher();

window.labo = {
  t0: match.t0, t1: match.t1, focus,
  aller(t) { avancerJusqua(t); afficher(); return tCourant; },
  stats() { return joueurs.map((p) => Object.assign({ code: p.code }, p.A.stats)); },
  joueurs, match, M, D
};
window.pret = true;

if (params.get('lecture') === '1') {
  let dernier = performance.now();
  const boucle = (n) => {
    const dt = Math.min(0.1, (n - dernier) / 1000); dernier = n;
    let t = tCourant + dt; if (t > match.t1 - 0.6) { tCourant = match.t0 + 0.05; t = tCourant + PAS; joueurs.forEach((p) => { p.A.image = -1; p.A.lacetLisse = null; }); }
    avancerJusqua(t); afficher(); requestAnimationFrame(boucle);
  };
  requestAnimationFrame(boucle);
}
