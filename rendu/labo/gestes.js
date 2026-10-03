// La vitrine des gestes : un clip de la base de mouvements joué tel quel sur un corps (MakeHuman ou
// un personnage riggé), sur la pelouse du stade, sous la même lumière que le labo. Pour juger un
// geste avant de le brancher sur le moteur : tacle glissé, chute, relevé, tête, contrôle de la
// poitrine, parade... Le déplacement du clip est rejoué (vitesse et rotation de chaque image) ; le
// ballon, quand le clip le touche, est posé au point du contact et repart après.
// Paramètres : clips (noms de clips ou catégories, séparés par des virgules), perso (url d'un
// personnage riggé), base (dossier de la base, /rendu/donnees/ par défaut), l, h (taille),
// vue (« profil », « face », « trois_quarts »).
import * as THREE from 'three';
import { chargerCorps, fabriquerJoueur } from './corps.js';
import { chargerMouvements, Animateur } from './mouvement.js';
import { chargerPersonnage, fabriquerJoueurPersonnage } from './personnage.js';
import { construireStade } from './stade.js';

const params = new URLSearchParams(location.search);
const L = Number(params.get('l') || 640), H = Number(params.get('h') || 480);
const rendu = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
rendu.setSize(L, H);
rendu.shadowMap.enabled = true; rendu.shadowMap.type = THREE.PCFSoftShadowMap;
rendu.toneMapping = THREE.ACESFilmicToneMapping; rendu.toneMappingExposure = 1.05;
rendu.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(rendu.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#cfe0ee');
scene.fog = new THREE.Fog('#cfe0ee', 140, 420);
scene.add(new THREE.HemisphereLight('#e4f0ff', '#3c5a2c', 0.85));
const soleil = new THREE.DirectionalLight('#fff1dc', 2.7);
soleil.castShadow = true;
soleil.shadow.mapSize.set(2048, 2048);
Object.assign(soleil.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 120 });
soleil.shadow.bias = -0.0004; soleil.shadow.normalBias = 0.03;
scene.add(soleil, soleil.target);
construireStade(scene, { cote: -1, clubs: ['#1d4ed8', '#dc2626'], meteo: 'soleil' });
const ballon = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 12), new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.4 }));
ballon.castShadow = true; scene.add(ballon);

const base = params.get('base') || '/rendu/donnees/';
const persoUrl = params.get('perso');
const [D, M, modele] = await Promise.all([chargerCorps('/rendu/donnees/'), chargerMouvements(base), persoUrl ? chargerPersonnage(persoUrl) : null]);
const fiche = { code: 0, numero: 10, poste: 'MC', morphologie: { taille_cm: 181 }, apparence: { teint: 3, cheveux: 'brun' } };
const coul = { maillot: '#1d4ed8', short: '#f2f2f2', chaussettes: '#1d4ed8', chaussures: '#151515', numero: '#f2f2f2', numeroMaillot: 10 };
const J = modele ? fabriquerJoueurPersonnage(modele, fiche, coul, D.man) : fabriquerJoueur(D, fiche, coul);
scene.add(J.maillage);
const A = new Animateur(M, J, J.corpsMan || D.man);

// les clips demandés : par nom exact ou par catégorie
const demandes = (params.get('clips') || 'glisse').split(',');
const clips = M.man.clips.filter((c) => demandes.includes(c.nom) || demandes.includes(c.categorie));

const cam = new THREE.PerspectiveCamera(30, L / H, 0.1, 600);
const vue = params.get('vue') || 'profil';
const Y = new THREE.Vector3(0, 1, 0);
const hb = new THREE.Vector3();

// le déplacement du clip jusqu'à l'image i (fractionnaire) : cap et position, depuis l'origine
function trajet(c, i) {
  let psi = 0, x = 0, z = 0;
  const dt = 1 / M.man.fps;
  for (let f = 0; f < Math.floor(i); f++) {
    const k = (c.premier + f) * 3, vx = M.vit[k], vz = M.vit[k + 1], w = M.vit[k + 2];
    x += (Math.cos(psi) * vx + Math.sin(psi) * vz) * dt;
    z += (-Math.sin(psi) * vx + Math.cos(psi) * vz) * dt;
    psi += w * dt;
  }
  return { psi, x, z };
}

function poser(nom, t) {
  const c = M.man.clips.find((x) => x.nom === nom);
  if (!c) throw new Error('clip absent : ' + nom);
  const i = Math.max(0, Math.min(c.n - 1.001, t * M.man.fps));
  const { psi, x, z } = trajet(c, i);
  A.poseBase(c.premier + i, false, A.qCmu, hb);
  const lacet = new THREE.Quaternion().setFromAxisAngle(Y, psi);
  const e = A.echelleHanches;
  A.hanches.set(hb.x * e, hb.y * e, hb.z * e).applyQuaternion(lacet).add(new THREE.Vector3(x, 0, z));
  const _q = new THREE.Quaternion();
  for (let b = 0; b < A.nb; b++) {
    const j = A.cmu[b];
    A.D[b].copy(lacet).multiply(j >= 0 ? A.qCmu[j] : _q.identity()).multiply(A.fix[b]);
  }
  A.cinematique();
  A.ecrire();
  // le ballon : au point du contact, puis il repart dans la direction du geste
  ballon.visible = !!c.contact;
  if (c.contact) {
    const tc = trajet(c, c.contact.image), lc = new THREE.Quaternion().setFromAxisAngle(Y, tc.psi);
    const p = new THREE.Vector3(c.contact.balle[0] * e, c.contact.balle[1] * e, c.contact.balle[2] * e).applyQuaternion(lc).add(new THREE.Vector3(tc.x, 0, tc.z));
    const apres = Math.max(0, t - c.contact.image / M.man.fps);
    if (apres > 0) {
      const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(lc);
      p.addScaledVector(dir, 9 * apres);
      p.y = Math.max(0.11, p.y + (c.contact.partie === 'tete' ? 2.5 : 1.5) * apres - 4.9 * apres * apres);
    }
    ballon.position.copy(p);
  }
  // la caméra suit les hanches
  const h = A.hanches, regard = new THREE.Vector3(h.x, 0.8, h.z);
  const angle = vue === 'face' ? 0 : vue === 'trois_quarts' ? 0.7 : Math.PI / 2;
  cam.position.set(h.x + Math.sin(angle) * 5.2, 1.25, h.z + Math.cos(angle) * 5.2 + (vue === 'profil' ? 0.6 : 0));
  cam.lookAt(regard);
  soleil.position.copy(regard).add(new THREE.Vector3(-14, 22, 10)); soleil.target.position.copy(regard);
  rendu.render(scene, cam);
  return { n: c.n, duree: c.n / M.man.fps };
}

window.vitrine = { clips: clips.map((c) => ({ nom: c.nom, categorie: c.categorie, n: c.n, duree: c.n / M.man.fps, contact: c.contact || null, balises: c.balises || null })), poser };
window.pret = true;
