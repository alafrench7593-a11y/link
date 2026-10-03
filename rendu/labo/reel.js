// Le rendu réel en direct : le match que le moteur LinkFoot est en train de jouer, montré par de
// vrais corps (le footballeur de Gameplay Football) qui bougent avec de vraies captures (Motion
// Matching sur la base CMU, gestes de Google Research Football), dans la scène du match en 3D de
// l'app (src/stade3d.js). Le moteur reste la seule autorité : ce module lit ses images, comme le
// labo lit le document d'un match fini, et n'en change rien.
//
// Le match grandit pendant qu'on le regarde : l'app garde le moteur un peu plus d'une seconde en
// avance sur l'image montrée (src/direct.js), assez pour la requête du Motion Matching (0,6 s) et
// pour caler une frappe ou un plongeon. Les images arrivent ; le document du labo (match.js)
// s'allonge ; les gestes des joueurs concernés sont repris (mouvement.js, actualiserGestes).
//
//   const R = await preparerReel({ mouvements: { json, bin }, squelette: corps.json, personnage: glb })
//   const reel = creerReel(R, scene, { fiches, couleurs })     fiches : la feuille de match (passerelle)
//   reel.image({ imgs, t })   les images du moteur et l'instant montré → { ballon, joueurs } ou null
import * as THREE from 'three';
import { Match } from './match.js';
import { preparerMouvements, Animateur } from './mouvement.js';
import { fabriquerJoueurPersonnage } from './personnage.js';
import { construirePersonnage } from './glb.js';
import { Passerelle } from '../../src/passerelle.js';

const PAS = 1 / 60;   // les corps avancent par pas fixes, comme dans le labo

export async function preparerReel({ mouvements, squelette, personnage, image }) {
  const M = preparerMouvements(mouvements.json, mouvements.bin);
  const modele = await construirePersonnage(personnage, image === undefined ? {} : { image });
  return { M, man: { directions_tpose: squelette.directions_tpose }, modele };
}

// une fiche par code (0 à 21) : celle de la feuille de match, sinon une fiche neutre
function fichesParCode(feuille) {
  const parCode = new Map(((feuille && feuille.joueurs) || []).filter((j) => j.code != null && j.code >= 0 && j.code < 22).map((j) => [j.code, j]));
  return Array.from({ length: 22 }, (_, code) => parCode.get(code) || {
    code, camp: code < 11 ? 'H' : 'A', poste: code === 0 || code === 11 ? 'GB' : 'MIL', numero: (code % 11) + 1,
    apparence: { teint: (code * 3) % 10, coiffure: ['court', 'degrade', 'boucles', 'ras'][code % 4], cheveux: 'brun' }, morphologie: { taille_cm: 178 + (code * 7) % 12 }
  });
}

export function creerReel(R, scene, o = {}) {
  const fiches = fichesParCode(o.feuille);
  const champs = Passerelle.champsPont();
  const joueurs = fiches.map((fiche) => {
    const c = o.couleurs ? o.couleurs(fiche.code) : { maillot: '#2ECC71', short: '#F2F4F7', chaussettes: '#2ECC71', chaussures: '#141414' };
    const J = fabriquerJoueurPersonnage(R.modele, fiche, c, R.man);
    J.maillage.visible = false;
    J.maillage.traverse((m) => { if (m.isMesh) m.castShadow = !!o.ombres; });
    scene.add(J.maillage);
    return { code: fiche.code, J, A: null, x: 0, z: 0, present: false };
  });
  const colEtats = Array.from({ length: 22 }, (_, k) => champs.indexOf('etats' + k));
  let doc = null, match = null, tCourant = 0, dernierT = -Infinity, porteurPrec = -1, dernier = null;
  const mesure = { images: 0, pas: 0, ms: 0, repartis: 0 };

  // les images du moteur à partir de l'instant donné (temps du moteur), en lignes du document ;
  // rend les joueurs dont les gestes sont à reprendre
  const premiere = (imgs, t) => { let lo = 0, hi = imgs.length; while (lo < hi) { const mi = (lo + hi) >> 1; if (imgs[mi].t <= t) lo = mi + 1; else hi = mi; } return lo; };
  const completer = (imgs, depuis) => {
    const touches = new Set();
    for (let i = premiere(imgs, Math.max(dernierT + 1e-6, depuis - 1e-6)); i < imgs.length; i++) {
      const f = imgs[i];
      if (!f.F) continue;
      const D = doc.images.donnees, prec = D.length ? D[D.length - 1] : null;
      const ligne = Passerelle.lignePont(f);
      D.push(ligne);
      (f.ac || []).forEach((a) => {
        const b = Passerelle.actionPont(a);
        doc.actions.push(b);
        if (b.c >= 0) touches.add(b.c);
        // une célébration fait courir les coéquipiers du buteur
        if (b.a === 'celebration' && b.c >= 0) for (let k = b.c < 11 ? 0 : 11, n = k + 11; k < n; k++) touches.add(k);
      });
      // le porteur (sa conduite de balle), celui qui vient de le perdre, et qui tombe ou se relève
      if (f.o >= 0) touches.add(f.o);
      if (porteurPrec >= 0) touches.add(porteurPrec);
      porteurPrec = f.o;
      if (prec) for (let k = 0; k < 22; k++) if ((prec[colEtats[k]] & 1) !== (ligne[colEtats[k]] & 1)) touches.add(k);
      dernierT = f.t;
      mesure.images++;
    }
    return touches;
  };
  const repartir = (imgs, tm) => {
    // le document repart 1,5 s avant l'instant montré (un saut d'une action à l'autre, ou le début)
    doc = { images: { champs, donnees: [] }, actions: [], joueurs: fiches, equipes: (o.feuille && o.feuille.equipes) || {}, match: {} };
    dernierT = -Infinity; porteurPrec = -1;
    completer(imgs, tm - 0.1 - 1.5);
    if (doc.images.donnees.length < 2) { match = null; return false; }
    match = new Match(doc);
    match.enDirect = true;
    for (const j of joueurs) j.A = new Animateur(R.M, j.J, j.J.corpsMan);
    tCourant = Math.max(match.t0, tm - PAS);
    mesure.repartis++;
    return true;
  };

  return {
    joueurs,
    mesure,
    // src : { imgs (les images du moteur), t (l'instant montré, temps du moteur) }
    image(src) {
      const imgs = src && src.imgs;
      if (!imgs || !imgs.length || !imgs[imgs.length - 1].F || src.t == null) return null;
      const debut = typeof performance !== 'undefined' ? performance.now() : Date.now();
      // la ligne d'une image montre la fin du pas du moteur (passerelle : t + 0,1)
      const tm = src.t + 0.1;
      // l'image gelée (l'app saute d'une action à la suivante) : les corps ne bougent pas
      if (match && dernier && Math.abs(tm - tCourant) < 1e-9) return dernier;
      if (!match || tm < tCourant - 0.05 || tm > tCourant + 1 || tm < match.t0) { if (!repartir(imgs, tm)) return null; } else {
        const touches = completer(imgs, -Infinity);
        if (touches.size) {
          match.etendre();
          match.tAffiche = tCourant;
          for (const c of touches) { const j = joueurs[c]; if (j && j.A) j.A.actualiserGestes(match, c); }
        }
      }
      match.tAffiche = tm;
      for (let n = 0; tCourant < tm - 1e-9 && n < 40; n++) {
        const dt = Math.min(PAS, tm - tCourant);
        tCourant += dt;
        for (const j of joueurs) if (match.present(j.code, tCourant)) j.A.mettreAJour(match, j.code, tCourant, dt);
        mesure.pas++;
      }
      for (const j of joueurs) {
        j.present = match.present(j.code, tCourant) && j.A && j.A.image >= 0;
        j.J.maillage.visible = j.present;
        if (j.present) { j.x = j.A.hanches.x; j.z = j.A.hanches.z; }
      }
      // le ballon : celui du moteur, porté, en vol ou libre (match.js), dans les mains d'un gardien
      const b = match.ballonVisuel(tCourant);
      let p = b.p;
      if (b.mains) {
        const g = joueurs[b.porteur];
        if (g && g.A && g.A.mains) {
          const m = g.A.mains(), k = Math.max(0, Math.min(1, (tCourant - (b.te - 0.3)) / 0.3)), s = k * k * (3 - 2 * k);
          p = [m[0] + (p[0] - m[0]) * s, m[1] + (p[1] - m[1]) * s, m[2] + (p[2] - m[2]) * s];
        }
      }
      mesure.ms += (typeof performance !== 'undefined' ? performance.now() : Date.now()) - debut;
      dernier = { ballon: new THREE.Vector3(p[0], p[1] + 0.11, p[2]), joueurs };
      return dernier;
    },
    detruire() {
      for (const j of joueurs) scene.remove(j.J.maillage);
      // les matériaux sont propres à chaque joueur (personnage.js les copie) ; les géométries et les
      // textures sont celles du modèle, partagées, et restent à lui
      for (const j of joueurs) j.J.maillage.traverse((m) => { if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose()); });
    }
  };
}
