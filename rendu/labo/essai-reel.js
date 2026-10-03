// L'essai du rendu réel branché sur le match en direct, hors de l'app : un club, un match en
// direct regardé (spectacle de src/direct.js), la vue 3D de l'app (src/stade3d.js) et les vrais
// corps (reel.js). Paramètres : l, h (taille), seed (la graine du match), reel=0 (sans les vrais
// corps : la vue 3D telle qu'elle était), meteo.
import * as THREE from 'three';
import { Club } from '/src/club.js';
import { preparerReel, creerReel } from './reel.js';

const params = new URLSearchParams(location.search);
const L = Number(params.get('l') || 390), H = Number(params.get('h') || 320);
const club = new Club();
club.createClub({ name: 'FC Essai', seed: 4242 });
const d = club.matchEnDirect({ club: 'Référence', ovr: 66, style: 'blocmed', color: '#2F8FE0' }, { seed: Number(params.get('seed') || 5), friendly: true });
const rendu = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
rendu.setPixelRatio(1); rendu.setSize(L, H);
document.body.appendChild(rendu.domElement);
const v = club.stade3d(THREE, { renderer: rendu, largeur: L, hauteur: H, maillot: club.state.kit, adverse: '#2F8FE0', meteo: params.get('meteo') || d.meteo, ombres: false });
let reel = null;
if (params.get('reel') !== '0') {
  const [json, bin, squelette, glb] = await Promise.all([
    fetch('/rendu/donnees/mouvements.json').then((r) => r.json()), fetch('/rendu/donnees/mouvements.bin').then((r) => r.arrayBuffer()),
    fetch('/rendu/donnees/corps.json').then((r) => r.json()),
    fetch('/unreal/LinkFoot/SourceArt/Characters/Players/GameplayFootball/SK_LinkFoot_GPF.glb').then((r) => r.arrayBuffer())]);
  const R = await preparerReel({ mouvements: { json, bin }, squelette, personnage: glb });
  reel = creerReel(R, v.scene, { feuille: d.feuille(), couleurs: v.couleurs });
  v.brancherReel(reel);
}
d.spectacle(true);
d.vitesse(Number(params.get('vitesse') || 1.5));
// le temps : en lecture libre (requestAnimationFrame, comme dans l'app), ou piloté par un outil :
// le moteur joue jusqu'à un instant (avancer), puis l'outil choisit l'instant montré (montrer)
const libre = params.get('pilote') !== '1';
const montrerVue = () => { const f = d.vue(); v.image(f.A, f.B, f.fr, f.evs, f); return f; };
if (libre) { d.lancer(); const boucle = () => { montrerVue(); requestAnimationFrame(boucle); }; requestAnimationFrame(boucle); }
const images = () => d.vue().imgs || [];
const essai = {
  club, d, v, reel, THREE,
  // le moteur joue jusqu'à ce que ses images couvrent l'instant t (secondes de jeu) et 2 s de plus
  avancer(t) { let imgs = images(); while (!d.etat().fini && (!imgs.length || imgs[imgs.length - 1].t < t + 2)) { d.avancerPas(20); imgs = images(); } return imgs.length ? imgs[imgs.length - 1].t : 0; },
  // les buts et les tirs des images gardées
  evenements() { const r = []; let prec = null; for (const f of images()) { if (f.ev) f.ev.forEach((e) => { if (e.k === 'goal' || e.k === 'card') r.push({ t: f.t, k: e.k }); }); if (f.fl && f.fl[4] === 'shot' && !(prec && prec.fl && prec.fl[4] === 'shot')) r.push({ t: f.t, k: 'tir' }); prec = f; } return r; },
  // l'image de l'instant t, comme l'app la montrerait
  montrer(t) {
    const imgs = images(); if (!imgs.length) return null;
    let lo = 0, hi = imgs.length - 1;
    if (t <= imgs[0].t) hi = 0; else if (t >= imgs[hi].t) lo = hi; else while (hi - lo > 1) { const mi = (lo + hi) >> 1; if (imgs[mi].t <= t) lo = mi; else hi = mi; }
    const A = imgs[lo], B = imgs[Math.min(imgs.length - 1, lo + 1)], fr = B.t > A.t ? Math.max(0, Math.min(1, (t - A.t) / (B.t - A.t))) : 0;
    v.image(A, B, fr, null, { imgs, t });
    return { t, A: A.t };
  }
};
window.essai = essai;
window.pret = true;
