// Le mouvement des footballeurs : de vraies captures humaines (base CMU), choisies image par image
// par Motion Matching pour suivre la trajectoire que le moteur LinkFoot a jouée, puis posées sur le
// corps du joueur (reciblage), avec les pieds verrouillés au sol pendant les appuis (aucune
// glissade) et la tête qui suit le ballon.
//
// Le principe est celui de Pose Search dans Unreal : à chaque recherche, la requête décrit où le
// joueur sera dans 0,2, 0,4 et 0,6 s (le moteur le sait), où il regardera, et la pose actuelle
// (pieds, hanches) ; on prend l'image de la base qui lui ressemble le plus (en miroir aussi), et
// on passe de l'ancienne pose à la nouvelle par inertialisation (l'écart s'éteint en 0,1 s).
import * as THREE from 'three';
import { vue } from './corps.js';
import { DetecteurPied } from './detecteur.js';

const CATS_LOCOMOTION = ['course', 'virage', 'depart', 'arret', 'lateral', 'recul', 'marche', 'immobile'];

export async function chargerMouvements(base) {
  const [man, bin] = await Promise.all([
    fetch(base + 'mouvements.json').then((r) => r.json()),
    fetch(base + 'mouvements.bin').then((r) => r.arrayBuffer())
  ]);
  const T = (k) => vue(bin, man.tableaux[k]);
  const quat = T('quat'), hanches = T('hanches'), vit = T('vit'), appuis = T('appuis'), cherchable = T('cherchable');
  const feats = T('feats'), featsM = T('featsMiroir');
  const N = man.images, F = 27, J = man.articulations.length;
  const norm = new Float32Array(N * F), normM = new Float32Array(N * F);
  for (let i = 0; i < N; i++) for (let k = 0; k < F; k++) {
    norm[i * F + k] = (feats[i * F + k] - man.moyennes[k]) / man.ecarts[k];
    normM[i * F + k] = (featsM[i * F + k] - man.moyennes[k]) / man.ecarts[k];
  }
  const clipDe = new Int32Array(N);
  man.clips.forEach((c, ci) => { for (let i = c.premier; i < c.premier + c.n; i++) clipDe[i] = ci; });
  const locomotion = [];
  for (let i = 0; i < N; i++) if (cherchable[i] && CATS_LOCOMOTION.includes(man.clips[clipDe[i]].categorie)) locomotion.push(i);
  // l'allure de chaque image : l'amplitude des bras de sa prise quand elle court (un joggeur aux
  // bras serrés court mal un sprint de footballeur ; la recherche le pénalise quand ça va vite)
  // la position moyenne des bras de chaque prise (le centre de leur balancier)
  const ARTS_BRAS = [18, 19, 22, 23];
  const brasMoyen = man.clips.map((c) => {
    const r = {};
    for (const j of ARTS_BRAS) {
      const m = new THREE.Quaternion(0, 0, 0, 0), q = new THREE.Quaternion(), ref = new THREE.Quaternion();
      for (let i = c.premier; i < c.premier + c.n; i++) {
        const b = (i * J + j) * 4;
        q.set(quat[b], quat[b + 1], quat[b + 2], quat[b + 3]);
        if (i === c.premier) ref.copy(q);
        const sg = q.x * ref.x + q.y * ref.y + q.z * ref.z + q.w * ref.w < 0 ? -1 : 1;
        m.x += sg * q.x; m.y += sg * q.y; m.z += sg * q.z; m.w += sg * q.w;
      }
      r[j] = m.normalize();
    }
    return r;
  });
  // la pénalité d'allure, payée seulement quand la course est rapide : bras serrés, ou genou qui
  // ne se plie pas (un vrai coureur ramène le talon vers la fesse)
  const allureDe = new Float32Array(N);
  man.clips.forEach((c) => {
    if (!c.allure) return;
    const p = Math.max(0, 0.28 - c.allure.bras) * 20 + Math.max(0, 108 - (c.allure.genou || 108)) * 0.05;
    for (let i = c.premier; i < c.premier + c.n; i++) allureDe[i] = p;
  });
  // l'accélération de la recherche par boîtes englobantes : par paquets de 16 images de
  // locomotion consécutives, le minimum et le maximum de chaque grandeur ; un paquet dont la
  // borne basse du coût dépasse déjà le meilleur trouvé est sauté en entier (résultat identique
  // à la recherche exhaustive, dans le même ordre)
  const TAILLE = 16, nbBlocs = Math.ceil(locomotion.length / TAILLE);
  const boites = [norm, normM].map((nm) => {
    const mn = new Float32Array(nbBlocs * F).fill(Infinity), mx = new Float32Array(nbBlocs * F).fill(-Infinity);
    for (let k = 0; k < locomotion.length; k++) {
      const o = Math.floor(k / TAILLE) * F, b = locomotion[k] * F;
      for (let d = 0; d < F; d++) { const v = nm[b + d]; if (v < mn[o + d]) mn[o + d] = v; if (v > mx[o + d]) mx[o + d] = v; }
    }
    return { mn, mx };
  });
  return { man, quat, hanches, vit, appuis, cherchable, feats, featsM, norm, normM, clipDe, N, F, J, locomotion: Int32Array.from(locomotion),
    boites, tailleBloc: TAILLE, nbBlocs, allureDe, brasMoyen };
}

// poids des grandeurs : trajectoire (positions, directions), pieds (positions, vitesses), hanches
const POIDS = new Float32Array([
  1, 1, 1, 1, 1, 1,
  1.5, 1.5, 1.5, 1.5, 1.5, 1.5,
  0.75, 0.75, 0.75, 0.75, 0.75, 0.75,
  1, 1, 1, 1, 1, 1,
  1, 1, 1]);

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m = new THREE.Matrix4();
const Y = new THREE.Vector3(0, 1, 0);

// les articulations de la base CMU, par groupe (ordre de mouvements.json)
const JAMBE = [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]];   // gauche, droite
const DOS = [11, 12, 13], COU = [14, 15, 16], BRAS = [17, 18, 19, 20, 21, 22, 23, 24];
const lisse = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const ecartAngle = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

// les chaînes qui portent une correction de pose (la pose en A de MakeHuman contre la pose en T des
// captures) : les bras et les jambes ; les autres os gardent leur pose de repos
const CORRIGEES = new Set(['LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg']);
const SUIT_LE_PARENT = new Set(['LeftHand', 'RightHand']);

export class Animateur {
  constructor(M, joueur, corpsMan) {
    this.M = M; this.J = joueur;
    const os = corpsMan.os, art = M.man.articulations;
    this.nb = os.length;
    this.parent = os.map((o) => o.parent);
    this.nomOs = os.map((o) => o.nom);
    const idx = (n) => this.nomOs.indexOf(n);
    this.cmu = new Int32Array(this.nb).fill(-1);
    this.fix = os.map(() => new THREE.Quaternion());
    const fixCmu = {};
    for (const ch of corpsMan.chaines) {
      const premier = idx(ch.os[0]), dernier = idx(ch.os[ch.os.length - 1]);
      let f = new THREE.Quaternion();
      if (CORRIGEES.has(ch.cmu)) {
        const dMh = new THREE.Vector3().subVectors(joueur.queues[dernier], joueur.tetes[premier]).normalize();
        const d = corpsMan.directions_tpose[ch.cmu];
        f.setFromUnitVectors(dMh, new THREE.Vector3(d[0], d[1], d[2]));
      } else if (SUIT_LE_PARENT.has(ch.cmu)) {
        f = fixCmu[ch.cmu === 'LeftHand' ? 'LeftForeArm' : 'RightForeArm'].clone();
      }
      fixCmu[ch.cmu] = f;
      for (const n of ch.os) { const b = idx(n); this.cmu[b] = art.indexOf(ch.cmu); this.fix[b].copy(f); }
    }
    this.racine = this.parent.indexOf(-1);
    // les rôles des os : fournis avec le squelette d'un personnage venu d'ailleurs (personnage.js),
    // sinon ceux du squelette de MakeHuman, par leurs noms
    const R = corpsMan.roles || {
      jambes: ['L', 'R'].map((c) => ({ cuisse: [idx(`upperleg01.${c}`), idx(`upperleg02.${c}`)], tibia: [idx(`lowerleg01.${c}`), idx(`lowerleg02.${c}`)],
        pied: idx(`foot.${c}`), orteil: idx(`toe1-1.${c}`) })),
      bras: ['L', 'R'].map((c) => ({ cuisse: [idx(`upperarm01.${c}`), idx(`upperarm02.${c}`)], tibia: [idx(`lowerarm01.${c}`), idx(`lowerarm02.${c}`)], pied: idx(`wrist.${c}`), suit: [idx(`wrist.${c}`)] })),
      cou: ['neck01', 'neck03', 'head'].map(idx),
      poitrine: idx('spine01'),
      mains: [idx('wrist.L'), idx('wrist.R')],
      haut: os.map((o) => /^(spine0[1-4]|neck|head|eye|clavicle|shoulder|upperarm|lowerarm|wrist)/.test(o.nom)),
      regard: os.map((o) => (o.nom === 'neck01' ? 0.2 : o.nom === 'neck02' ? 0.4 : o.nom === 'neck03' ? 0.6 : (o.nom === 'head' || o.nom.startsWith('eye.')) ? 1 : 0))
    };
    const hg = R.jambes[0].cuisse[0], hd = R.jambes[1].cuisse[0];
    this.centreHanches = joueur.tetes[hg].clone().add(joueur.tetes[hd]).multiplyScalar(0.5);
    this.echelleHanches = this.centreHanches.y / M.man.hanches_ref;
    this.jambes = R.jambes.map((L, i) => ({
      cuisse: L.cuisse.slice(), tibia: L.tibia.slice(), pied: L.pied, orteil: L.orteil, bit: i === 0 ? 1 : 2,
      cheville0: joueur.tetes[L.pied].y, verrou: null, sortie: 0, posePrec: false,
      pointe0: joueur.tetes[L.orteil].y,
      versPointe: new THREE.Vector3().subVectors(joueur.tetes[L.orteil], joueur.tetes[L.pied]),
      detecteur: new DetecteurPied(joueur.tetes[L.orteil].y)
    }));
    this.cou = R.cou.slice();
    this.poitrine = R.poitrine;
    this.bras = R.bras.map((B) => ({ cuisse: B.cuisse.slice(), tibia: B.tibia.slice(), pied: B.pied, suit: B.suit.slice() }));
    this.haut = R.haut.slice();
    this.partsRegard = R.regard.slice();
    this.plongeons = []; this.poidsTenue = 0;
    this.mainsOs = R.mains.slice();
    // l'écriture d'un personnage venu d'ailleurs passe par les matrices du monde
    if (joueur.personnage) {
      this.monde = joueur.ordre.map(() => new THREE.Matrix4());
      this.voulu = os.map(() => new THREE.Matrix4());
    }
    this.gestes = null; this.geste = null;
    this.regard = null;
    // état de lecture
    this.image = -1; this.miroir = false; this.prochaineRecherche = 0;
    this.offQ = Array.from({ length: M.J }, () => new THREE.Quaternion());
    this.offH = new THREE.Vector3();
    this.qCmu = Array.from({ length: M.J }, () => new THREE.Quaternion());
    this.D = os.map(() => new THREE.Quaternion());
    this.P = os.map(() => new THREE.Vector3());
    this.hanches = new THREE.Vector3();
    this.lacetLisse = null;
    this.stats = { recherches: 0, changements: 0, manqueMax: 0, appuisImages: 0, piedRapide: 0, vitessePiedMax: 0, abaissementMax: 0 };
  }

  // la pose de la base à l'image (fractionnaire) f, dans l'espace du personnage
  poseBase(f, miroir, qOut, hOut) {
    const M = this.M, J = M.J, c = M.man.clips[M.clipDe[Math.floor(f)]];
    const fin = c.premier + c.n - 1;
    const i0 = Math.min(Math.floor(f), fin), i1 = Math.min(i0 + 1, fin), a = f - Math.floor(f);
    for (let j = 0; j < J; j++) {
      const s = miroir ? M.man.miroir[j] : j;
      const b0 = (i0 * J + s) * 4, b1 = (i1 * J + s) * 4;
      _q.set(M.quat[b0], M.quat[b0 + 1], M.quat[b0 + 2], M.quat[b0 + 3]).normalize();
      _q2.set(M.quat[b1], M.quat[b1 + 1], M.quat[b1 + 2], M.quat[b1 + 3]).normalize();
      qOut[j].copy(_q).slerp(_q2, a);
      if (miroir) { qOut[j].y = -qOut[j].y; qOut[j].z = -qOut[j].z; }
    }
    const h0 = i0 * 3, h1 = i1 * 3;
    hOut.set(M.hanches[h0] * (1 - a) + M.hanches[h1] * a, M.hanches[h0 + 1] * (1 - a) + M.hanches[h1 + 1] * a, M.hanches[h0 + 2] * (1 - a) + M.hanches[h1 + 2] * a);
    if (miroir) hOut.x = -hOut.x;
  }

  // la requête du Motion Matching : la trajectoire que le moteur a jouée, la pose actuelle
  requete(match, code, t) {
    const M = this.M, F = M.F, q = new Float32Array(F);
    const p0 = match.position(code, t), psi = match.lacet(code, t);
    const c = Math.cos(psi), s = Math.sin(psi);
    const h = M.man.horizons.map((k) => k / M.man.fps);
    let vmax = 0;
    h.forEach((dt, k) => {
      const p = match.position(code, t + dt);
      const dx = p[0] - p0[0], dz = p[1] - p0[1];
      q[k * 2] = dx * c - dz * s; q[k * 2 + 1] = dx * s + dz * c;
      vmax = Math.max(vmax, Math.hypot(dx, dz) / dt);
      const a = match.lacet(code, t + dt) - psi;
      q[6 + k * 2] = Math.sin(a); q[6 + k * 2 + 1] = Math.cos(a);
    });
    this.vitesseRequete = vmax;
    // plus vite que les meilleures courses de la base (4,5 à 6 m/s) : on cherche la forme de la
    // course, la vitesse viendra de la cadence et de la foulée
    const VMAX = 5.0;
    this.facteurVitesse = vmax > VMAX ? vmax / VMAX : 1;
    if (vmax > VMAX) for (let k = 0; k < 6; k++) q[k] /= this.facteurVitesse;
    // la pose actuelle : celle de l'image jouée
    if (this.image >= 0) {
      const src = this.miroir ? M.featsM : M.feats, i = Math.floor(this.image);
      for (let k = 12; k < F; k++) q[k] = src[i * F + k];
    }
    for (let k = 0; k < F; k++) q[k] = (q[k] - M.man.moyennes[k]) / M.man.ecarts[k];
    return q;
  }

  // le poids de la pénalité d'allure : nul en marchant, plein au-dessus de 3,5 m/s
  poidsAllure() { return Math.max(0, Math.min(1, ((this.vitesseRequete || 0) - 2.5) / 1.0)); }

  cout(q, norm, i, avecPose) {
    const F = this.M.F, b = i * F;
    let s = this.poidsAllure() * this.M.allureDe[i];
    const n = avecPose ? F : 12;
    for (let k = 0; k < n; k++) { const d = q[k] - norm[b + k]; s += POIDS[k] * d * d; }
    return s;
  }

  chercher(q, avecPose) {
    const M = this.M, L = M.locomotion, F = M.F, T = M.tailleBloc, n = avecPose ? F : 12;
    // en course, une image d'allure molle coûte jusqu'à 4 de plus (le coût médian d'une
    // recherche est 2,2) ; la borne des boîtes reste une borne basse (biais positif)
    const pa = this.poidsAllure();
    let best = Infinity, bi = -1, bm = false;
    for (let m = 0; m < 2; m++) {
      const norm = m ? M.normM : M.norm, { mn, mx } = M.boites[m];
      for (let c = 0; c < M.nbBlocs; c++) {
        let borne = 0;
        const o = c * F;
        for (let d = 0; d < n && borne < best; d++) {
          const v = q[d], e = v < mn[o + d] ? mn[o + d] - v : v > mx[o + d] ? v - mx[o + d] : 0;
          borne += POIDS[d] * e * e;
        }
        if (borne >= best) continue;
        const fin = Math.min(L.length, (c + 1) * T);
        for (let k = c * T; k < fin; k++) {
          const i = L[k], b = i * F;
          let s = pa * M.allureDe[i];
          for (let d = 0; d < 12; d++) { const e = q[d] - norm[b + d]; s += POIDS[d] * e * e; }
          if (s >= best) continue;
          if (avecPose) for (let d = 12; d < F && s < best; d++) { const e = q[d] - norm[b + d]; s += POIDS[d] * e * e; }
          if (s < best) { best = s; bi = i; bm = !!m; }
        }
      }
    }
    return { image: bi, miroir: bm, cout: best };
  }

  // la recherche exhaustive, gardée pour vérifier que l'accélération ne change rien
  chercherExhaustif(q, avecPose) {
    const M = this.M, L = M.locomotion, pa = this.poidsAllure();
    let best = Infinity, bi = -1, bm = false;
    for (let m = 0; m < 2; m++) {
      const norm = m ? M.normM : M.norm, F = M.F;
      for (let k = 0; k < L.length; k++) {
        const i = L[k], b = i * F;
        let s = pa * M.allureDe[i];
        for (let d = 0; d < 12; d++) { const e = q[d] - norm[b + d]; s += POIDS[d] * e * e; }
        if (s >= best) continue;
        if (avecPose) for (let d = 12; d < F && s < best; d++) { const e = q[d] - norm[b + d]; s += POIDS[d] * e * e; }
        if (s < best) { best = s; bi = i; bm = !!m; }
      }
    }
    return { image: bi, miroir: bm, cout: best };
  }

  // ---- les gestes : ce que le moteur fait faire au joueur (frapper, contrôler) ----
  // Une frappe (passe, tir, dégagement, tacle) joue une vraie capture de frappe, calée pour que le
  // pied touche le ballon à l'instant de l'action du moteur ; le corps se tourne vers la cible et
  // s'approche du ballon (au plus 0,7 m), le pied qui frappe va derrière le ballon au contact.
  // Un contrôle : le pied le plus proche va au ballon quand il arrive.
  preparerGestes(match, code) {
    const M = this.M, fiche = match.joueurs.get(code) || {};
    const gaucher = fiche.pied === 'Gauche';
    // les frappes : les captures CMU de frappe (les gestes de GRF ont aussi un contact, d'une autre forme)
    const frappes = M.man.clips.filter((c) => c.categorie === 'frappe' && c.contact);
    this.gestes = [];
    this.gardien = fiche.poste === 'GB';
    if (!frappes.length) return;
    match.preparerBallon();
    for (const a of match.actions) {
      if (a.c !== code) continue;
      if ((a.a === 'passe' || a.a === 'tir' || a.a === 'degagement') && a.x1 != null && a.cpa !== 'throw') {
        const tc = a.t0 != null ? a.t0 : a.t;
        const dir = new THREE.Vector3(a.x1 - a.x0, 0, a.y1 - a.y0);
        if (dir.lengthSq() < 1e-6) continue;
        dir.normalize();
        const fort = a.a !== 'passe' || !!a.aerien || a.genre === 'long' || a.genre === 'cross';
        const clip = frappes[(code * 7 + Math.round(tc * 10)) % frappes.length];
        this.gestes.push(this.gesteFrappe(match, code, tc, new THREE.Vector3(a.x0 - 34, a.z0 || 0, a.y0 - 52.5), dir, fort, clip, gaucher, false));
      } else if (a.a === 'tacle') {
        const b = match.ballon(a.t).p, p = match.position(code, a.t);
        const dir = new THREE.Vector3(b[0] - p[0], 0, b[2] - p[1]);
        if (dir.lengthSq() < 1e-6) continue;
        dir.normalize();
        const clip = frappes[(code * 3 + 1) % frappes.length];
        this.gestes.push(this.gesteFrappe(match, code, a.t, new THREE.Vector3(b[0], 0, b[2]), dir, false, clip, gaucher, true));
      } else if (a.a === 'plongeon') {
        const tir = match.actions.find((b) => b.a === 'tir' && Math.abs(b.t - a.t) < 0.25);
        this.plongeons.push(this.gestePlongeon(match, code, a, tir));
      } else if (a.a === 'controle' && !a.haut) {
        // le ballon arrive puis va devant le joueur (match.js, transfert de 0,35 s) : le pied le
        // touche au début de ce transfert
        const pos = match.possessions.find((q) => q.c === code && Math.abs(match.lignes[q.ks][match.col.t] / 10 - a.t) < 0.25);
        const tc = (pos ? pos.tTransfert : a.t) + 0.08;
        const b0 = match.ballon(tc).p, b1 = match.ballon(tc + 0.1).p;
        if (b0[1] > 0.5) continue;
        const dir = new THREE.Vector3(b1[0] - b0[0], 0, b1[2] - b0[2]);
        if (dir.lengthSq() < 1e-6) { const l = match.lacet(code, tc); dir.set(Math.sin(l), 0, Math.cos(l)); }
        dir.normalize();
        const B = new THREE.Vector3(b0[0], b0[1], b0[2]);
        const p = match.position(code, tc), versBallon = new THREE.Vector3(B.x - p[0], 0, B.z - p[1]);
        const d = versBallon.length();
        const decalage = d > 0.65 ? versBallon.setLength(Math.min(0.5, d - 0.65)) : new THREE.Vector3();
        this.gestes.push({ type: 'touche', tc, B, dir, pied: -1, avant: 0.28, apres: 0.22, cadence: 1, decalage,
          visee: B.clone().addScaledVector(dir, -0.16).setY(B.y + 0.1) });
      }
    }
    // les célébrations (le moteur choisit le genre, la destination et la durée) : celle du buteur,
    // et celles où ce joueur est un coéquipier qui le rejoint
    this.celebrations = [];
    for (const a of match.actions) {
      if (a.a !== 'celebration') continue;
      const buteur = match.joueurs.get(a.c), moi = match.joueurs.get(code);
      if (!buteur || !moi) continue;
      if (a.c === code) this.celebrations.push({ genre: a.genre, t0: a.t, fin: a.fin, buteur: true, c: a.c });
      else if (buteur.camp === moi.camp && moi.poste !== 'GB') this.celebrations.push({ genre: a.genre, t0: a.t, fin: a.fin, buteur: false, c: a.c });
    }
    // les touches de la conduite de balle (match.js) : le pied qui est en l'air va au ballon
    match.preparerConduite();
    for (const p of match.possessions) {
      if (p.c !== code || !p.touches) continue;
      for (let k = 0; k < p.touches.length - 1; k++) {
        const tc = p.touches[k];
        if (tc <= p.debutConduite + 0.2) continue;
        const b = match.ballonVisuel(tc);
        if (b.regime !== 'porte') continue;
        const v = match.vitesse(code, tc), sp = Math.hypot(v[0], v[1]);
        const dir = sp > 0.4 ? new THREE.Vector3(v[0] / sp, 0, v[1] / sp) : new THREE.Vector3(Math.sin(match.lacet(code, tc)), 0, Math.cos(match.lacet(code, tc)));
        const B = new THREE.Vector3(b.p[0], b.p[1], b.p[2]);
        this.gestes.push({ type: 'touche', conduite: true, tc, B, dir, pied: -1, avant: 0.2, apres: 0.15, cadence: 1, decalage: new THREE.Vector3(),
          visee: B.clone().addScaledVector(dir, -0.15).setY(0.1) });
      }
    }
    this.gestes.sort((a, b) => a.tc - b.tc);
    this.preparerCorps(match, code);
  }

  // Les gestes de tout le corps (les clips « grf: » de la base, Google Research Football) : ce
  // que le moteur décide, joué par le corps entier. Tacle glissé (action « tacle » de genre
  // « glisse »), tête (« duel_aerien »), touche (« touche »), et la chute puis le relevé quand le
  // moteur met le joueur au sol (une faute subie : l'état « au_sol »). Le moteur ne déplace pas
  // le joueur comme le geste : le corps suit le déplacement du clip, ancré pour que la partie qui
  // touche le ballon le touche à l'instant et au point du moteur (au plus 1,5 m de la position du
  // moteur), puis il la rejoint en 0,3 s.
  preparerCorps(match, code) {
    const M = this.M;
    this.corps = [];
    const de = (cat) => M.man.clips.filter((c) => c.categorie === cat && c.source === 'grf');
    const parNom = (liste, motif) => liste.find((c) => c.nom.endsWith(motif)) || liste[0];
    const glisse = de('glisse'), tete = de('tete'), touche = de('touche'), chute = de('chute'), releve = de('releve');
    const amorti = de('controle_haut').filter((c) => c.contact);
    match.ballon(match.t0);   // prépare les vols et l'instant des contrôles hauts (a.tHaut)
    for (const a of match.actions) {
      if (a.c !== code) continue;
      const v = match.vitesse(code, a.t), sp = Math.hypot(v[0], v[1]);
      if (a.a === 'tacle' && a.genre === 'glisse' && glisse.length) {
        const g = this.ajouterCorps(match, code, parNom(glisse, sp > 4 ? 'sliding/sprint/000' : sp > 1.5 ? 'sliding/walk/000' : 'sliding/idle/000'), a.t, 'ballon');
        // couché sur le dos, il se relève
        if (g && releve.length) this.ajouterCorps(match, code, parNom(releve, 'stand_up_from_back'), g.fin + 0.25, 'suite', g);
      } else if (a.a === 'duel_aerien' && tete.length) {
        // la tête : seulement si le ballon est en l'air quand le duel se joue (sinon le moteur l'a
        // laissé retomber) ; le geste dont le contact est à la hauteur du ballon, en course ou non
        const hb = match.ballon(a.t).p[1] + 0.11, e = this.echelleHanches;
        if (hb < 1.2) continue;
        const candidats = tete.filter((c) => c.contact && !c.nom.includes('headerdive') && (sp > 3) === /sprint/.test(c.nom));
        const liste = candidats.length ? candidats : tete.filter((c) => c.contact && !c.nom.includes('headerdive'));
        const clip = liste.reduce((m, c) => (Math.abs(c.contact.balle[1] * e - hb) < Math.abs(m.contact.balle[1] * e - hb) ? c : m));
        const g = this.ajouterCorps(match, code, clip, a.t, 'ballon');
        // le saut monte un peu plus si le ballon est plus haut que le contact du geste (au plus 0,25 m)
        if (g) g.leve = Math.max(-0.1, Math.min(0.25, hb - clip.contact.balle[1] * e));
      } else if (a.a === 'touche' && touche.length) {
        this.ajouterCorps(match, code, touche[0], a.t0 != null ? a.t0 : a.t, 'ballon');
      } else if (a.a === 'controle' && a.haut && a.tHaut != null && amorti.length) {
        // le contrôle d'un ballon haut : le geste d'amorti dont le contact est à la hauteur du ballon
        const hb = match.ballon(a.tHaut).p[1], e = this.echelleHanches;
        const clip = amorti.reduce((m, c) => (Math.abs(c.contact.balle[1] * e - hb) < Math.abs(m.contact.balle[1] * e - hb) ? c : m));
        this.ajouterCorps(match, code, clip, a.tHaut, 'ballon');
      }
    }
    // la chute : les périodes « au sol » des images du moteur
    if (chute.length) {
      const col = match.col['etats' + code];
      let debut = null;
      for (let i = 0; i < match.n; i++) {
        const sol = (match.lignes[i][col] & 1) !== 0, ti = match.lignes[i][match.col.t] / 10;
        if (sol && debut == null) debut = ti;
        if ((!sol || i === match.n - 1) && debut != null) {
          const v = match.vitesse(code, debut), sp = Math.hypot(v[0], v[1]);
          const c = parNom(chute, sp > 4 ? 'trip/trip_t3/sprint/000' : sp > 1.5 ? 'trip/trip_t3/walk/000_000' : 'trip/trip_t2/idle/000_090');
          const g = this.ajouterCorps(match, code, c, debut, 'debut');
          if (g && releve.length) {
            const dos = (c.balises || {}).outgoing_special_state === 'lay_back';
            const r = parNom(releve, dos ? 'stand_up_from_back' : 'stand_up_from_front');
            // le relevé finit quand le moteur relève le joueur
            this.ajouterCorps(match, code, r, Math.max(g.fin + 0.2, ti - r.n / M.man.fps + 0.3), 'suite', g);
          }
          debut = null;
        }
      }
    }
    this.corps.sort((a, b) => a.t0 - b.t0);
  }

  // un geste de tout le corps : le chemin du clip (sa racine et son cap à chaque image, depuis
  // l'image 0), son ancrage dans le monde, et ses instants
  ajouterCorps(match, code, clip, tc, mode, avant) {
    const M = this.M, fps = M.man.fps, e = this.echelleHanches;
    const chemin = [];
    let psi = 0, x = 0, z = 0;
    for (let f = 0; f < clip.n; f++) {
      chemin.push({ x, z, psi });
      const k = (clip.premier + f) * 3, vx = M.vit[k], vz = M.vit[k + 1], w = M.vit[k + 2];
      x += (Math.cos(psi) * vx + Math.sin(psi) * vz) / fps;
      z += (-Math.sin(psi) * vx + Math.cos(psi) * vz) / fps;
      psi += w / fps;
    }
    let t0, psi0, racine0;
    if (mode === 'ballon' && clip.contact) {
      // la partie qui touche le ballon le touche à l'instant et au point du moteur
      const fc = Math.min(clip.n - 1, clip.contact.image), cc = chemin[fc];
      t0 = tc - fc / fps;
      const b = match.ballon(tc).p, p = match.position(code, tc);
      const bx = clip.contact.balle[0] * e, bz = clip.contact.balle[2] * e;
      let dx = b[0] - p[0], dz = b[2] - p[1];
      if (Math.hypot(dx, dz) < 0.05) { const l = match.lacet(code, tc); dx = Math.sin(l); dz = Math.cos(l); }
      const psiC = Math.atan2(dx, dz) - Math.atan2(bx, bz);
      let rx = b[0] - (Math.cos(psiC) * bx + Math.sin(psiC) * bz), rz = b[2] - (-Math.sin(psiC) * bx + Math.cos(psiC) * bz);
      // au plus 1,5 m de la position du moteur
      const ex = rx - p[0], ez = rz - p[1], d = Math.hypot(ex, ez);
      if (d > 1.5) { rx = p[0] + ex * 1.5 / d; rz = p[1] + ez * 1.5 / d; }
      psi0 = psiC - cc.psi;
      const cs = Math.cos(psi0), sn = Math.sin(psi0);
      racine0 = { x: rx - (cs * cc.x + sn * cc.z) * e, z: rz - (-sn * cc.x + cs * cc.z) * e };
    } else if (mode === 'suite' && avant) {
      // il reprend là où le geste d'avant a laissé le corps
      t0 = tc;
      const der = avant.chemin[avant.chemin.length - 1], cs = Math.cos(avant.psi0), sn = Math.sin(avant.psi0);
      racine0 = { x: avant.racine0.x + (cs * der.x + sn * der.z) * e, z: avant.racine0.z + (-sn * der.x + cs * der.z) * e };
      psi0 = avant.psi0 + der.psi;
      avant.garde = Math.max(avant.garde, tc - avant.fin);
    } else {
      t0 = tc;
      const p = match.position(code, tc);
      racine0 = { x: p[0], z: p[1] };
      psi0 = match.lacet(code, tc);
    }
    const g = { type: 'corps', clip, t0, fin: t0 + (clip.n - 1) / fps, tc, chemin, psi0, racine0, garde: 0, entree: mode === 'suite' ? 0.05 : 0.12, sortie: 0.3 };
    this.corps.push(g);
    return g;
  }

  // le geste de tout le corps à l'instant t (le plus présent) et son poids
  corpsEnCours(t) {
    let g = null, w = 0;
    for (const x of this.corps || []) {
      if (t < x.t0 - x.entree || t > x.fin + x.garde + x.sortie) continue;
      const wx = lisse((t - (x.t0 - x.entree)) / x.entree) * (t <= x.fin + x.garde ? 1 : lisse((x.fin + x.garde + x.sortie - t) / x.sortie));
      if (wx >= w) { w = wx; g = x; }
    }
    return g ? { g, w } : null;
  }

  gesteFrappe(match, code, tc, B, dir, fort, clip, gaucher, poke) {
    const c = clip.contact, miroir = gaucher;
    const v = match.vitesse(code, tc), vit = Math.hypot(v[0], v[1]);
    const cadence = Math.min(1.5, Math.max(1, 1 + (vit - 2) * 0.15)) * (fort ? 1 : 1.15) * (poke ? 1.25 : 1);
    // le corps tourné pour que la frappe de la capture parte vers la cible
    const dx = miroir ? -c.dir[0] : c.dir[0];
    const lacet = Math.atan2(dir.x, dir.z) - Math.atan2(dx, c.dir[1]);
    // où serait la pointe du pied au contact si le corps restait où le moteur le met
    const e = this.echelleHanches, px = (miroir ? -c.pointe[0] : c.pointe[0]) * e, pz = c.pointe[2] * e;
    const p = match.position(code, tc), cs = Math.cos(lacet), sn = Math.sin(lacet);
    const pointe = new THREE.Vector3(p[0] + px * cs + pz * sn, 0, p[1] - px * sn + pz * cs);
    const visee = B.clone().addScaledVector(dir, -0.16);
    visee.y = B.y + 0.1;
    const ecart = new THREE.Vector3(visee.x - pointe.x, 0, visee.z - pointe.z);
    if (ecart.length() > 0.9) ecart.setLength(0.9);
    return { type: 'frappe', tc, B, dir, clip, miroir, cadence, lacet, visee, decalage: ecart.multiplyScalar(0.75),
      pied: (c.pied === 'R') !== miroir ? 1 : 0, avant: 0.62 / cadence, apres: 0.55 / cadence };
  }

  // Le plongeon du gardien : le moteur ne le déplace pas (il dit seulement le côté et le point du
  // tir), le rendu le fait voler vers le ballon, le pose au sol, puis le relève vers sa place.
  gestePlongeon(match, code, a, tir) {
    const ts = a.t, psi = match.lacet(code, ts), g0 = match.position(code, ts);
    const f = new THREE.Vector3(Math.sin(psi), 0, Math.cos(psi)), gauche = new THREE.Vector3(Math.cos(psi), 0, -Math.sin(psi));
    const G0 = new THREE.Vector3(g0[0], 0, g0[1]);
    let B = new THREE.Vector3(a.x - 34, 0.3, a.y - 52.5), tc = ts + Math.max(0.15, a.dur - 0.2);
    if (tir) {
      const v = { t0: tir.t0 != null ? tir.t0 : tir.t, dur: tir.dur, x0: tir.x0, y0: tir.y0, z0: tir.z0 || 0, x1: tir.x1, y1: tir.y1, apex: tir.apex || 0, lineaire: true };
      let meilleur = 1e9;
      for (let k = 0; k <= 60; k++) {
        const u = k / 60, q = match.volEn(v, v.t0 + u * v.dur), P = new THREE.Vector3(q[0] - 34, q[2] + 0.11, q[1] - 52.5);
        const dd = Math.abs(_v.subVectors(P, G0).dot(f));
        if (dd < meilleur) { meilleur = dd; B = P; tc = v.t0 + u * v.dur; }
      }
    }
    const L = _v.subVectors(B, G0).dot(gauche), h = B.y;
    const genre = Math.abs(L) < 0.75 ? (h > 1.3 ? 'saut' : h < 0.6 ? 'bas' : 'face') : 'lateral';
    const arret = match.actions.find((b) => b.a === 'arret' && b.c === code && b.t >= ts - 0.05 && b.t <= ts + 1.2);
    const lancer = Math.max(ts - 0.05, tc - (genre === 'lateral' ? 0.42 : 0.28));
    // le corps bascule autour de ses pieds (comme un arbre qui tombe) et la poussée l'emmène :
    // des pieds au bout des doigts, 2,1 m ; l'angle met les mains à la hauteur du ballon, la
    // poussée fait le reste du chemin de côté
    const roulis = Math.acos(Math.max(0.05, Math.min(0.9, (h - 0.05) / 2.1)));
    const poussee = Math.max(0, Math.abs(L) - 2.1 * Math.sin(roulis));
    return { type: 'plongeon', genre, ts, tc, lancer, B, L, h, G0, f, gauche, capte: !!(arret && arret.issue === 'capte'), roulis, poussee };
  }

  // l'état du plongeon à l'instant t : poids, position des hanches, roulis, poids des bras
  etatPlongeon(t) {
    const pl = this.plongeons.find((x) => t >= x.lancer - 0.02 && t <= x.tc + (x.genre === 'lateral' ? 1.9 : 1.0));
    if (!pl) return null;
    const u1 = lisse((t - pl.lancer) / Math.max(0.1, pl.tc - pl.lancer));
    if (pl.genre !== 'lateral') {
      const poids = t <= pl.tc + 0.35 ? u1 : 1 - lisse((t - pl.tc - 0.35) / 0.6);
      return { pl, poids, bras: pl.capte || t < pl.tc + 0.1 ? poids : 1 - lisse((t - pl.tc - 0.1) / 0.3) };
    }
    let roulis, poussee, envol = 0, poids = 1;
    if (t <= pl.tc) {
      roulis = pl.roulis * Math.pow(u1, 1.3);
      poussee = pl.poussee * lisse((u1 - 0.2) / 0.8);
      envol = (pl.poussee > 0.3 ? 0.3 : 0.1) * Math.sin(Math.PI * u1);
    } else if (t <= pl.tc + 0.3) {
      const u2 = lisse((t - pl.tc) / 0.3);
      roulis = pl.roulis + (1.5 - pl.roulis) * u2; poussee = pl.poussee + 0.15 * u2;
    } else {
      roulis = 1.5; poussee = pl.poussee + 0.15;
      poids = 1 - lisse((t - pl.tc - 0.9) / 0.9);
    }
    const bras = pl.capte ? Math.min(1, u1 * 1.2) : t < pl.tc + 0.1 ? u1 : 1 - lisse((t - pl.tc - 0.1) / 0.3);
    return { pl, poids, roulis, poussee, envol, u1, bras };
  }

  // où doivent être les chevilles : les cibles que l'étape des pieds leur a données (l'appui
  // verrouillé, le décollage en cours ou la capture)
  ciblesPieds() {
    return this.jambes.map((L, i) => (this.ciblesFinales ? this.ciblesFinales[i].clone() : this.P[L.pied].clone()));
  }

  // les mains vers deux points (gauche, droite), avec un poids
  mainsVers(cibleG, cibleD, poids) {
    if (poids <= 0.001) return;
    [cibleG, cibleD].forEach((c, i) => {
      const B = this.bras[i], m = this.P[B.pied];
      this.ik(B, m.clone().lerp(c, Math.min(1, poids)));
    });
    this.cinematique();
  }

  // le haut du corps penché vers l'avant (autour de l'axe des hanches)
  pencher(angle) {
    if (Math.abs(angle) < 1e-3) return;
    const axe = new THREE.Vector3(1, 0, 0).applyQuaternion(this.D[this.racine]).normalize();
    const R = new THREE.Quaternion().setFromAxisAngle(axe, angle);
    for (let b = 0; b < this.nb; b++) if (this.haut[b]) this.D[b].premultiply(R);
    this.cinematique();
  }

  // la position des mains (le ballon d'un gardien qui le tient)
  mains() {
    const a = this.P[this.mainsOs[0]], b = this.P[this.mainsOs[1]];
    return [(a.x + b.x) / 2, (a.y + b.y) / 2 - 0.02, (a.z + b.z) / 2];
  }

  mettreAJour(match, code, t, dt) {
    const M = this.M;
    // 1. Motion Matching, toutes les 0,1 s, ou quand le clip se termine
    const clip = this.image >= 0 ? M.man.clips[M.clipDe[Math.floor(this.image)]] : null;
    const finClip = clip ? this.image >= clip.premier + clip.n - 3 : true;
    if (this.image < 0 || t >= this.prochaineRecherche || finClip) {
      const q = this.requete(match, code, t);
      const r = this.chercher(q, this.image >= 0);
      this.stats.recherches++;
      let garder = false;
      if (this.image >= 0 && !finClip) {
        const actuel = this.cout(q, this.miroir ? M.normM : M.norm, Math.floor(this.image), true);
        const memeEndroit = r.miroir === this.miroir && M.clipDe[r.image] === M.clipDe[Math.floor(this.image)] && Math.abs(r.image - this.image) < 8;
        garder = memeEndroit || actuel <= r.cout * 1.08 + 0.05;
      }
      if (!garder && r.image >= 0) {
        if (this.image >= 0) {
          // inertialisation : l'écart entre l'ancienne pose et la nouvelle s'éteint peu à peu
          const ancienne = this.qCmu.map((x) => x.clone()), hAnc = this.hBrut ? this.hBrut.clone() : new THREE.Vector3();
          const nouvelle = this.qCmu.map(() => new THREE.Quaternion()), hNouv = new THREE.Vector3();
          this.poseBase(r.image, r.miroir, nouvelle, hNouv);
          for (let j = 0; j < M.J; j++) this.offQ[j].copy(ancienne[j]).multiply(nouvelle[j].invert());
          this.offH.subVectors(hAnc, hNouv);
          this.stats.changements++;
        }
        this.image = r.image; this.miroir = r.miroir;
      }
      this.prochaineRecherche = t + 0.1;
    }
    // 2. la vitesse de lecture et la foulée : le corps va à la vitesse du moteur
    const v = match.vitesse(code, t), vMoteur = Math.hypot(v[0], v[1]);
    const iv = Math.floor(this.image) * 3, vClip = Math.hypot(M.vit[iv], M.vit[iv + 1]);
    let vitesseLecture = 1, foulee = 1;
    if (vMoteur > 0.6 && vClip > 0.4) {
      // la cadence d'abord (un sprinteur fait 4,5 pas par seconde, un joggeur 3), la foulée ensuite
      vitesseLecture = Math.max(0.75, Math.min(1.5, vMoteur / vClip));
      foulee = Math.max(0.8, Math.min(1.45, vMoteur / (vClip * vitesseLecture)));
    }
    this.foulee = foulee;
    const c = M.man.clips[M.clipDe[Math.floor(this.image)]];
    this.image = Math.min(this.image + dt * M.man.fps * vitesseLecture, c.premier + c.n - 1);
    // 3. la pose, avec l'écart d'inertialisation qui s'éteint (demi-vie 0,08 s)
    const hb = this.hBrut || (this.hBrut = new THREE.Vector3());
    this.poseBase(this.image, this.miroir, this.qCmu, hb);
    const amort = Math.exp(-dt * Math.LN2 / 0.08);
    for (let j = 0; j < M.J; j++) {
      this.offQ[j].slerp(_q.identity(), 1 - amort);
      this.qCmu[j].premultiply(this.offQ[j]);
    }
    this.offH.multiplyScalar(amort);
    hb.add(this.offH);
    // 3b. le geste en cours : la capture de frappe, mêlée à la course (la jambe d'appui garde la
    // course quand le joueur va vite)
    if (!this.gestes) this.preparerGestes(match, code);
    let g = null, w = 0;
    for (const x of this.gestes) {
      if (t < x.tc - x.avant || t > x.tc + x.apres) continue;
      const wx = lisse((t - (x.tc - x.avant)) / 0.18) * lisse((x.tc + x.apres - t) / 0.22);
      if (wx > w) { w = wx; g = x; }
    }
    this.geste = g; this.poidsGeste = w;
    const vitesseMoteur = Math.hypot(v[0], v[1]);
    let appuisPerso = M.appuis[Math.floor(this.image)];
    if (this.miroir) appuisPerso = ((appuisPerso & 1) << 1) | ((appuisPerso & 2) >> 1);
    if (g && g.type === 'frappe' && w > 0) {
      const c = g.clip, fin = c.premier + c.n - 1;
      const f = Math.max(c.premier, Math.min(fin, c.premier + c.contact.image + (t - g.tc) * M.man.fps * g.cadence));
      const qG = this.qGeste || (this.qGeste = Array.from({ length: M.J }, () => new THREE.Quaternion()));
      const hG = this.hGeste || (this.hGeste = new THREE.Vector3());
      this.poseBase(f, g.miroir, qG, hG);
      const wAppui = w * Math.max(0.35, Math.min(1, 1.6 - 0.3 * vitesseMoteur));
      for (let j = 0; j < M.J; j++) {
        const pj = JAMBE[1 - g.pied].includes(j) ? wAppui : COU.includes(j) ? w * 0.5 : w;
        this.qCmu[j].slerp(qG[j], pj);
      }
      hb.lerp(hG, wAppui);
      if (w > 0.5) {
        let ag = M.appuis[Math.floor(f)];
        if (g.miroir) ag = ((ag & 1) << 1) | ((ag & 2) >> 1);
        appuisPerso = ag;
      }
    }
    // 3b'. le geste de tout le corps (tacle glissé, tête, touche, chute, relevé)
    const gc = this.corpsEnCours(t), wc = gc ? gc.w : 0;
    this.poidsCorps = wc;
    if (gc) {
      const c = gc.g.clip, f = Math.max(0, Math.min(c.n - 1, (t - gc.g.t0) * M.man.fps));
      const qG = this.qGeste || (this.qGeste = Array.from({ length: M.J }, () => new THREE.Quaternion()));
      const hG = this.hGeste || (this.hGeste = new THREE.Vector3());
      this.poseBase(c.premier + f, false, qG, hG);
      for (let j = 0; j < M.J; j++) this.qCmu[j].slerp(qG[j], wc);
      hb.lerp(hG, wc);
      if (wc > 0.3 && c.categorie !== 'touche') appuisPerso = 0;
      else if (wc > 0.3) appuisPerso = 3;    // la touche : les deux pieds au sol
      gc.f = f;
    }
    // 3c. le plongeon latéral garde la pose du départ (les jambes suivent le corps qui vole)
    const plo = this.plongeons.length ? this.etatPlongeon(t) : null;
    if (plo && plo.pl.genre === 'lateral') {
      if (!this.poseGelee || this.poseGelee.pl !== plo.pl) {
        // la pose du départ, jambes et dos allongés (le corps s'étire vers le ballon)
        const q = this.qCmu.map((x) => x.clone());
        for (const j of [...JAMBE[0], ...JAMBE[1], ...DOS]) q[j].slerp(_q.identity(), 0.75);
        this.poseGelee = { pl: plo.pl, q, h: hb.clone() };
      }
      for (let j = 0; j < M.J; j++) this.qCmu[j].slerp(this.poseGelee.q[j], plo.poids);
      hb.lerp(this.poseGelee.h, plo.poids);
    }
    // 3d. plus vite que la prise : le balancier des bras s'élargit (jusqu'à 35 % à deux fois sa
    // vitesse), comme celui d'un sprinteur
    const vPrise = Math.hypot(M.vit[Math.floor(this.image) * 3], M.vit[Math.floor(this.image) * 3 + 1]);
    if (w < 0.1 && !plo && vPrise > 1.5 && vitesseMoteur > vPrise) this.amplifierBras(1 + 0.35 * Math.min(1, (vitesseMoteur - vPrise) / vPrise));
    // 4. dans le monde : la position et l'orientation du moteur
    const p0 = match.position(code, t);
    let psi = match.lacet(code, t);
    if (this.lacetLisse == null) this.lacetLisse = psi;
    let d = psi - this.lacetLisse;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    this.lacetLisse += d * (1 - Math.exp(-dt / 0.06));
    psi = this.lacetLisse;
    if (g && g.type === 'frappe') psi += ecartAngle(g.lacet, psi) * w;
    let racX = p0[0], racZ = p0[1];
    if (gc) {
      // le corps suit le déplacement du clip depuis son ancrage
      const k = Math.floor(gc.f), u = gc.f - k, a = gc.g.chemin[k], b = gc.g.chemin[Math.min(k + 1, gc.g.chemin.length - 1)];
      const cx = a.x + (b.x - a.x) * u, cz = a.z + (b.z - a.z) * u, cp = a.psi + (b.psi - a.psi) * u;
      const cs = Math.cos(gc.g.psi0), sn = Math.sin(gc.g.psi0), e0 = this.echelleHanches;
      const gx = gc.g.racine0.x + (cs * cx + sn * cz) * e0, gz = gc.g.racine0.z + (-sn * cx + cs * cz) * e0;
      racX += (gx - racX) * wc; racZ += (gz - racZ) * wc;
      psi += ecartAngle(gc.g.psi0 + cp, psi) * wc;
    }
    const lacet = new THREE.Quaternion().setFromAxisAngle(Y, psi);
    const e = this.echelleHanches;
    this.hanches.set(hb.x * e, hb.y * e, hb.z * e).applyQuaternion(lacet).add(_v.set(racX, 0, racZ));
    if (gc && gc.g.leve) this.hanches.y += gc.g.leve * wc * Math.exp(-Math.pow((t - gc.g.tc) / 0.18, 2));
    if (g) {
      // le corps va au ballon : tout le poids au contact, rien au début et à la fin du geste
      const k = g.type === 'frappe' ? w : Math.exp(-Math.pow((t - g.tc) / 0.22, 2));
      this.hanches.addScaledVector(g.decalage, k);
    }
    for (let b = 0; b < this.nb; b++) {
      const j = this.cmu[b];
      this.D[b].copy(lacet).multiply(j >= 0 ? this.qCmu[j] : _q.identity()).multiply(this.fix[b]);
    }
    this.cinematique();
    // 5. les pieds : foulée, verrouillage pendant les appuis, sol
    const appuis = appuisPerso;
    if (g && g.type === 'touche' && g.pied < 0) {
      // le pied le plus proche du ballon le touche ; en conduite, de préférence celui qui est en l'air
      let meilleur = 1e9;
      this.jambes.forEach((L, i) => {
        const o = this.P[L.orteil], appui = g.conduite && (appuis & L.bit) ? 0.6 : 0;
        const dd = Math.hypot(o.x - g.B.x, o.z - g.B.z) + appui;
        if (dd < meilleur) { meilleur = dd; g.pied = i; }
      });
    }
    const avance = _v2.set(v[0], 0, v[1]);
    if (avance.lengthSq() > 1e-4) avance.normalize();
    const cibles = [];
    // ce que le bassin descendra plus loin dans cette image (bassin abaissé pour la foulée, garde
    // du gardien, arrêt bas, mains sur les genoux) : un appui qu'il pourra tenir n'est pas relâché
    const abaissement = 0.08 + (this.gardien ? 0.12 * (this.poidsGarde || 0) : 0) + (plo && plo.pl.genre === 'bas' ? 0.3 * plo.poids : 0) + 0.1 * (this.poidsGenoux || 0);
    this.jambes.forEach((L, iL) => {
      // le pied qui frappe (ou touche) ne s'appuie pas autour du contact
      const fenetre = g && g.pied === iL ? (g.type === 'frappe' ? [g.tc - 0.32 / g.cadence, g.tc + 0.15] : [g.tc - 0.2, g.tc + 0.1]) : null;
      const frappeur = !!(fenetre && t > fenetre[0] && t < fenetre[1]);
      const enVol = !!(plo && plo.poids > 0.3 && (plo.pl.genre === 'lateral' || plo.pl.genre === 'saut'));
      // pendant un geste de tout le corps, les pieds suivent le geste, sauf ceux du lanceur d'une
      // touche (il garde ses appuis)
      const libres = wc >= 0.3 && !(gc && gc.g.clip.categorie === 'touche');
      const pose = (appuis & L.bit) !== 0 && !frappeur && !enVol && !libres;
      if (libres) { L.verrou = null; L.libere = false; }
      // un pied posé sur le talon ne tourne pas sur lui-même (sa pointe balaierait l'herbe) : il
      // garde le cap qu'il avait en se posant ; c'est sur la pointe qu'il pivote, et l'écart
      // s'éteint alors en 0,1 s. Le cap est celui de la pointe elle-même (cheville vers l'avant du
      // pied), pas d'un axe du squelette : sur un pied dont la pointe est bien plus basse que la
      // cheville (celui de Gameplay Football), le pied qui roule ou bascule la ferait sinon tourner
      if (pose && L.verrou && !L.libere) {
        const f = _v.copy(L.versPointe).applyQuaternion(this.D[L.pied]), cap = Math.atan2(f.x, f.z);
        if (L.verrou.mode === 'cheville') {
          if (L.verrou.cap == null) L.verrou.cap = cap;
          L.verrou.corr = ecartAngle(L.verrou.cap, cap);
        } else if (L.verrou.corr) L.verrou.corr *= Math.exp(-dt / 0.05);
        if (L.verrou.corr) {
          const R = _q2.setFromAxisAngle(Y, L.verrou.corr);
          this.D[L.pied].premultiply(R); this.D[L.orteil].premultiply(R);
        }
      }
      const cheville = this.P[L.pied].clone();
      // la foulée : l'écart du pied aux hanches, le long de la course
      if (this.foulee !== 1 && wc < 0.3) {
        const rel = _v.subVectors(cheville, this.hanches); rel.y = 0;
        const along = rel.dot(avance);
        cheville.addScaledVector(avance, along * (this.foulee - 1));
      }
      // la pointe (l'avant du pied) telle que la capture la pose, et pas sous le sol
      const pointeVec = L.versPointe.clone().applyQuaternion(this.D[L.pied]);
      const solMin = L.cheville0 * 0.92;
      if (cheville.y < solMin) cheville.y = solMin;
      if (cheville.y + pointeVec.y < L.pointe0) cheville.y = L.pointe0 - pointeVec.y;
      let cible = cheville;
      // un appui que la jambe ne peut plus tenir (le corps est passé) : le pied décolle, il ne glisse pas
      if (pose && L.verrou && !L.libere) {
        const H = this.P[L.cuisse[0]], a = H.distanceTo(this.P[L.tibia[0]]), b = this.P[L.tibia[0]].distanceTo(this.P[L.pied]);
        const Hb = H.clone(); Hb.y -= abaissement;
        if (Hb.distanceTo(L.verrou.cible) > (a + b) * 0.995 + 0.005) { L.libere = true; this.stats.decollages = (this.stats.decollages || 0) + 1; }
      }
      if (!pose) L.libere = false;
      if (pose && !L.libere) {
        // l'appui : la cheville tient tant que le talon est au sol ; quand le talon se lève, c'est
        // la pointe qui tient et la cheville monte autour d'elle (le déroulé du pied)
        const pointeAnim = cheville.clone().add(pointeVec);
        // dès que l'avant du pied touche le sol, c'est lui qui tient (le pied pivote autour de lui)
        const pointeAuSol = pointeAnim.y - L.pointe0 < 0.02;
        if (!L.verrou) L.verrou = { mode: pointeAuSol ? 'pointe' : 'cheville', cheville: cheville.clone(), pointe: pointeAnim.clone(), cible: cheville.clone() };
        if (L.verrou.mode === 'pointe' && !L.verrou.pointePosee) { L.verrou.pointe.y = Math.max(L.pointe0, Math.min(L.verrou.pointe.y, L.pointe0 + 0.01)); L.verrou.pointePosee = true; }
        const pointeVerrou = L.verrou.mode === 'cheville' ? L.verrou.cheville.y + pointeVec.y - L.pointe0 < 0.02 : false;
        if (L.verrou.mode === 'cheville' && (pointeAuSol || pointeVerrou)) {
          L.verrou.mode = 'pointe';
          L.verrou.pointe = L.verrou.cheville.clone().add(pointeVec);
          L.verrou.pointe.y = Math.max(L.pointe0, Math.min(L.verrou.pointe.y, L.pointe0 + 0.01));
        }
        if (L.verrou.mode === 'pointe') {
          cible = L.verrou.pointe.clone().sub(pointeVec);
          if (cible.y < solMin) cible.y = solMin;
        } else cible = L.verrou.cheville.clone();
        L.verrou.cible = cible.clone();
        L.sortie = 1;
      } else if (L.verrou) {
        // le décollage : le pied rejoint la capture en se levant (il ne rase pas le sol)
        L.sortie = Math.max(0, L.sortie - dt / 0.12);
        const k = 1 - L.sortie;
        cible = L.verrou.cible.clone().lerp(cheville, k);
        cible.y += 0.07 * Math.min(1, k * 3) * (1 - k * 0.6);
        // la pointe aussi se lève : un pied talon haut garderait sinon l'orteil au ras de l'herbe
        const minPointe = L.pointe0 + 0.045 * Math.min(1, k * 4);
        if (cible.y + pointeVec.y < minPointe) cible.y = minPointe - pointeVec.y;
        if (L.sortie <= 0) L.verrou = null;
      } else if (cheville.y + pointeVec.y < L.pointe0 + 0.045 && this.foulee > 0) {
        // en l'air : la pointe passe à 4,5 cm au-dessus de l'herbe (le détecteur compte « au sol » sous 3 cm)
        cible = cheville.clone(); cible.y = L.pointe0 + 0.045 - pointeVec.y;
      }
      if (frappeur) {
        // au contact, la pointe du pied est derrière le ballon
        const cloche = Math.exp(-Math.pow((t - g.tc) / (g.type === 'frappe' ? 0.08 : 0.1), 2));
        const pointe = cible.clone().add(pointeVec).lerp(g.visee, cloche);
        if (pointe.y < L.pointe0) pointe.y = L.pointe0;
        cible = pointe.sub(pointeVec);
      }
      cibles.push({ L, cible, pose });
    });
    this.ciblesFinales = cibles.map((c) => c.cible.clone());
    // le bassin descend un peu si une jambe ne peut pas atteindre son appui (foulée allongée)
    let baisse = 0;
    for (const { L, cible } of cibles) {
      const H = this.P[L.cuisse[0]], a = H.distanceTo(this.P[L.tibia[0]]), b = this.P[L.tibia[0]].distanceTo(this.P[L.pied]);
      const dx = cible.x - H.x, dz = cible.z - H.z, reach = (a + b) * 0.995, h2 = reach * reach - dx * dx - dz * dz;
      const besoin = h2 > 0 ? (H.y - cible.y) - Math.sqrt(h2) : 0.08;
      baisse = Math.max(baisse, Math.min(0.08, besoin));
    }
    this.baisse = (this.baisse || 0) + (baisse - (this.baisse || 0)) * (1 - Math.exp(-dt / 0.05));
    if (this.baisse > 1e-4) { this.hanches.y -= this.baisse; this.cinematique(); this.stats.abaissementMax = Math.max(this.stats.abaissementMax, this.baisse); }
    for (const { L, cible, pose } of cibles) {
      const manque = this.ik(L, cible);
      if (pose) { this.stats.appuisImages++; this.stats.manqueMax = Math.max(this.stats.manqueMax, manque); }
      // le pied garde le déroulé de la capture (talon, plante, pointe) autour de la cheville verrouillée
    }
    this.cinematique();
    // 5c. la fatigue (cahier qualité §24) et l'inclinaison de la course
    if (!this.gardien) this.fatigue(match, code, t, dt, vitesseMoteur);
    if (!plo && w < 0.1) this.inclinerCourse(match, code, t, dt, vitesseMoteur);
    // 5b. le gardien : plongeon, arrêt, ballon tenu dans les mains
    if (this.plongeons.length || this.gardien) this.gardienEnAction(match, code, t, dt, plo);
    // 5d. la célébration d'un but
    if (this.celebrations && this.celebrations.length) this.celebrer(match, code, t, dt, vitesseMoteur);
    // 6. la tête suit le ballon (ou la tribune, pendant une célébration)
    this.regarder(match, code, t, dt);
    // les gestes où le corps glisse ou se couche : le détecteur de glissement n'y juge pas les pieds
    const auSol = !!(gc && wc >= 0.3 && ['glisse', 'chute', 'releve'].includes(gc.g.clip.categorie));
    // la glissade réelle : la vitesse d'un pied en appui (le détecteur du cœur C++ tolère 15 cm/s)
    for (const L of this.jambes) {
      const p = this.P[L.pied];
      const bit = L.bit;
      const verrouille = !!(L.verrou && (appuis & bit) && !L.libere);
      if (L.dernier && verrouille && L.etaitVerrouille && dt > 0) {
        const vp = Math.hypot(p.x - L.dernier.x, p.z - L.dernier.z) / dt;
        this.stats.imagesVerrouillees = (this.stats.imagesVerrouillees || 0) + 1;
        if (vp > 0.15) this.stats.piedRapide++;
        this.stats.vitessePiedMax = Math.max(this.stats.vitessePiedMax, vp);
      }
      L.etaitVerrouille = verrouille;
      const o = this.P[L.orteil];
      L.detecteur.etat = (L.verrou ? (L.libere || !(appuis & bit) ? 'sortie' : L.verrou.mode) : 'vol') + (appuis & bit ? '+appui' : '');
      if (auSol) L.detecteur.suspendre(t);   // un geste au sol (tacle glissé, chute, relevé) : glisser est voulu
      else L.detecteur.ajouter(t, o.x, o.y, o.z);   // l'avant du pied, comme l'os ball_l dans Unreal
      L.dernier = (L.dernier || new THREE.Vector3()).copy(p);
    }
    this.ecrire();
  }

  gardienEnAction(match, code, t, dt, plo) {
    const b = match.ballon(t);
    if (plo && plo.poids > 0) {
      const pl = plo.pl;
      if (pl.genre === 'lateral') {
        // le corps bascule autour du milieu de ses pieds (pris au départ), la poussée l'emmène de côté
        if (!this.depart || this.depart.pl !== pl) {
          const a = this.P[this.jambes[0].pied], c = this.P[this.jambes[1].pied];
          this.depart = { pl, pivot: new THREE.Vector3((a.x + c.x) / 2, 0, (a.z + c.z) / 2) };
        }
        const piv = this.depart.pivot, sg = Math.sign(pl.L) || 1;
        const R = new THREE.Quaternion().setFromAxisAngle(pl.f, -sg * plo.roulis * plo.poids);
        const T = pl.gauche.clone().multiplyScalar(sg * plo.poussee * plo.poids).add(new THREE.Vector3(0, plo.envol * plo.poids, 0));
        for (let o = 0; o < this.nb; o++) this.D[o].premultiply(R);
        this.hanches.sub(piv).applyQuaternion(R).add(piv).add(T);
        this.cinematique();
        // jamais sous l'herbe
        let bas = Infinity;
        for (let o = 0; o < this.nb; o++) bas = Math.min(bas, this.P[o].y);
        if (bas < 0.09) { this.hanches.y += 0.09 - bas; this.cinematique(); }
      } else if (pl.genre === 'bas') {
        const pieds = this.ciblesPieds();
        this.hanches.y -= 0.3 * plo.poids; this.cinematique();
        this.jambes.forEach((L, i) => this.ik(L, pieds[i].setY(Math.max(pieds[i].y, L.cheville0 * 0.92))));
        this.cinematique();
        this.pencher(0.55 * plo.poids);
      } else if (pl.genre === 'saut') {
        this.hanches.y += 0.32 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - pl.lancer) / (pl.tc + 0.35 - pl.lancer)))) * plo.poids;
        this.cinematique();
      }
      // les mains au ballon jusqu'au contact
      if (t <= pl.tc + 0.05 || !pl.capte) {
        const B = pl.B, ec = pl.gauche.clone().multiplyScalar(0.1);
        this.mainsVers(B.clone().add(ec), B.clone().sub(ec), plo.bras);
      }
    }
    // la garde : genoux fléchis, buste penché, mains ouvertes devant (quand le ballon approche)
    if (this.gardien) {
      const g0 = match.position(code, t), dBallon = Math.hypot(b.p[0] - g0[0], b.p[2] - g0[1]);
      const voulu = b.porteur === code || (plo && plo.poids > 0.05) ? 0 : dBallon < 38 ? 1 : 0.35;
      this.poidsGarde = (this.poidsGarde || 0) + (voulu - (this.poidsGarde || 0)) * (1 - Math.exp(-dt / 0.25));
      if (plo && plo.poids > 0.05) this.poidsGarde = 0;
      const wG = this.poidsGarde;
      if (wG > 0.01) {
        const pieds = this.ciblesPieds();
        this.hanches.y -= 0.12 * wG; this.cinematique();
        this.jambes.forEach((L, i) => this.ik(L, pieds[i]));
        this.cinematique();
        this.pencher(0.22 * wG);
        const Dr = this.D[this.racine], R0 = this.P[this.racine];
        const avant = new THREE.Vector3(0, 0, 1).applyQuaternion(Dr).setY(0).normalize(), cote = new THREE.Vector3(1, 0, 0).applyQuaternion(Dr).setY(0).normalize();
        const c = R0.clone().addScaledVector(avant, 0.32); c.y = R0.y - 0.02;
        this.mainsVers(c.clone().addScaledVector(cote, 0.34), c.clone().addScaledVector(cote, -0.34), 0.75 * wG);
      }
    }
    // le ballon dans les mains : contre la poitrine
    const tient = b.porteur === code && b.mains;
    this.poidsTenue += ((tient ? 1 : 0) - this.poidsTenue) * (1 - Math.exp(-dt / 0.12));
    if (this.poidsTenue > 0.01) {
      const P = this.P[this.poitrine], Dq = this.D[this.poitrine];
      const avant = new THREE.Vector3(0, 0, 1).applyQuaternion(Dq), cote = new THREE.Vector3(1, 0, 0).applyQuaternion(Dq);
      const c = P.clone().addScaledVector(avant, 0.3).add(new THREE.Vector3(0, -0.12, 0));
      this.mainsVers(c.clone().addScaledVector(cote, 0.11), c.clone().addScaledVector(cote, -0.11), this.poidsTenue);
    }
  }

  // le balancier des bras élargi : chaque bras s'écarte de sa position moyenne dans la prise
  // (l'avant-bras et la main suivent le bras, le coude garde son angle)
  amplifierBras(a) {
    const M = this.M, moyennes = M.brasMoyen[M.clipDe[Math.floor(this.image)]];
    for (const [bras, avantBras, main] of [[18, 19, 20], [22, 23, 24]]) {
      const moy = moyennes[this.miroir ? M.man.miroir[bras] : bras].clone();
      if (this.miroir) { moy.y = -moy.y; moy.z = -moy.z; }
      const q = this.qCmu[bras];
      const ample = moy.slerp(q, a);
      const delta = ample.clone().multiply(q.clone().invert());
      q.copy(ample);
      this.qCmu[avantBras].premultiply(delta); this.qCmu[main].premultiply(delta);
    }
  }

  // L'inclinaison de la course : un coureur se penche quand il accélère (jusqu'à 7°) et un peu
  // plus quand il va plus vite que les prises (au-delà de 4,6 m/s) ; il se redresse en freinant.
  // Pas pendant un départ ou un arrêt capturés, qui ont déjà la leur.
  inclinerCourse(match, code, t, dt, vit) {
    const M = this.M, cat = M.man.clips[M.clipDe[Math.floor(this.image)]].categorie;
    const v0 = match.vitesse(code, t - 0.1), v1 = match.vitesse(code, t + 0.1);
    const acc = (Math.hypot(v1[0], v1[1]) - Math.hypot(v0[0], v0[1])) / 0.2;
    let voulu = Math.min(0.05, Math.max(0, 0.012 * (vit - 4.6)));
    if (cat !== 'depart' && cat !== 'arret') voulu += Math.max(-0.06, Math.min(0.12, 0.03 * acc));
    this.inclinaison = (this.inclinaison || 0) + (voulu - (this.inclinaison || 0)) * (1 - Math.exp(-dt / 0.15));
    if (Math.abs(this.inclinaison) > 0.003) this.pencher(this.inclinaison);
  }

  // La fatigue (cahier qualité §24) : sous 50 d'énergie, le buste se penche en courant ; un
  // joueur épuisé arrêté depuis plus d'une seconde pose les mains sur les genoux (sauf s'il a le
  // ballon ou un geste à faire).
  fatigue(match, code, t, dt, vit) {
    const e = match.energie(code, t);
    if (e == null) return;
    const lassitude = Math.max(0, Math.min(1, (50 - e) / 35));
    this.arret = vit < 0.5 ? (this.arret || 0) + dt : 0;
    const voulu = lassitude > 0.3 && this.arret > 1.2 && !this.geste && match.ballon(t).porteur !== code ? 1 : 0;
    this.poidsGenoux = (this.poidsGenoux || 0) + (voulu - (this.poidsGenoux || 0)) * (1 - Math.exp(-dt / 0.35));
    const wg = this.poidsGenoux;
    const angle = 0.16 * lassitude * Math.min(1, vit / 3) + 0.75 * wg;
    if (angle < 0.005) return;
    if (wg > 0.01) {
      const pieds = this.ciblesPieds();
      this.hanches.y -= 0.1 * wg; this.cinematique();
      this.jambes.forEach((L, i) => this.ik(L, pieds[i]));
      this.cinematique();
    }
    this.pencher(angle);
    if (wg > 0.01) {
      const avant = new THREE.Vector3(0, 0, 1).applyQuaternion(this.D[this.racine]).setY(0).normalize();
      const sur = (o) => this.P[o].clone().add(new THREE.Vector3(0, 0.1, 0)).addScaledVector(avant, 0.06);
      this.mainsVers(sur(this.jambes[0].tibia[0]), sur(this.jambes[1].tibia[0]), wg);
    }
  }

  // La célébration d'un but (actions « celebration » du moteur : corner, foule, genou, equipe,
  // silence, calme, ballon). Le moteur emmène le buteur et ses coéquipiers à la destination ; le
  // rendu fait les gestes : bras écartés en courant, à l'arrivée poing levé, genoux au sol bras
  // au ciel, doigt sur la bouche ; les coéquipiers qui le rejoignent lèvent les bras.
  celebrer(match, code, t, dt, vit) {
    const c = this.celebrations.find((x) => t >= x.t0 && t <= x.fin);
    const voulu = c ? lisse((t - c.t0) / 0.4) * lisse((c.fin - t) / 0.6) : 0;
    this.poidsFete = (this.poidsFete || 0) + (voulu - (this.poidsFete || 0)) * (1 - Math.exp(-dt / 0.15));
    const w = this.poidsFete;
    this.fete = null;
    if (!c || w < 0.01 || c.genre === 'ballon') return;
    const Dr = this.D[this.racine];
    const avant = new THREE.Vector3(0, 0, 1).applyQuaternion(Dr).setY(0).normalize();
    const cote = new THREE.Vector3(1, 0, 0).applyQuaternion(Dr).setY(0).normalize();
    const epaule = (i) => this.P[this.bras[i].cuisse[0]].clone();
    const haut = new THREE.Vector3(0, 1, 0);
    // arrivé : il ralentit après la course ; une fois à genoux, il le reste jusqu'à la fin
    const arrive = (this.genoux && this.genoux.c === c) || (vit < 1.0 && t > c.t0 + 1.2);
    if (!c.buteur) {
      // un coéquipier près du buteur lève les bras
      const p = match.position(c.c, t), moi = match.position(code, t);
      if (Math.hypot(p[0] - moi[0], p[1] - moi[1]) > 5 || t < c.t0 + 1.2) return;
      this.mainsVers(epaule(0).addScaledVector(haut, 0.55).addScaledVector(cote, 0.15), epaule(1).addScaledVector(haut, 0.55).addScaledVector(cote, -0.15), w * 0.85);
      return;
    }
    this.fete = c;
    const ecartes = () => this.mainsVers(epaule(0).addScaledVector(cote, 0.62).addScaledVector(haut, 0.12), epaule(1).addScaledVector(cote, -0.62).addScaledVector(haut, 0.12), w);
    const auCiel = (k) => this.mainsVers(epaule(0).addScaledVector(haut, 0.58).addScaledVector(cote, 0.18), epaule(1).addScaledVector(haut, 0.58).addScaledVector(cote, -0.18), k);
    if (c.genre === 'calme') {
      this.mainsVers(this.P[this.bras[0].pied].clone(), epaule(1).addScaledVector(haut, 0.55), w);
      return;
    }
    if (!arrive) { if (c.genre === 'equipe') auCiel(w); else ecartes(); return; }
    if (c.genre === 'genou') {
      // à genoux : les hanches descendent, les pieds restent derrière, les bras montent au ciel
      if (!this.genoux || this.genoux.c !== c) {
        // les appuis à genoux sont choisis une fois (derrière les hanches), d'où partent les pieds
        const H0 = this.hanches;
        this.genoux = { c, debut: t, depart: this.jambes.map((L) => this.P[L.pied].clone()), H0: this.hanches.clone(), avant: avant.clone(),
          pieds: this.jambes.map((L, i) => new THREE.Vector3(H0.x, 0.13, H0.z).addScaledVector(avant, -0.42).addScaledVector(cote, i === 0 ? 0.13 : -0.13)) };
      }
      // la descente (0,5 s), entière tant que la fête est à son plein (le poids lissé n'atteint
      // jamais tout à fait 1)
      const k = lisse((t - this.genoux.debut) / 0.5) * Math.min(1, w / 0.98);
      // à genoux, le corps reste où il s'est posé (le moteur le fait encore glisser de quelques
      // centimètres par seconde, le rendu le garde sur place)
      this.hanches.x += (this.genoux.H0.x - this.hanches.x) * k;
      this.hanches.z += (this.genoux.H0.z - this.hanches.z) * k;
      this.hanches.y += (0.6 - this.hanches.y) * k;
      this.cinematique();
      // les pieds passent derrière en l'air (ils ne raclent pas l'herbe), puis se posent sur les
      // orteils repliés, talons en haut
      const arc = k < 1 ? 0.18 * Math.sin(Math.PI * k) : 0;
      this.jambes.forEach((L, i) => {
        const depart = this.P[L.pied].clone().lerp(this.genoux.depart[i], lisse((t - this.genoux.debut) / 0.1));
        // le déplacement finit avant la pose : le pied arrive au-dessus de sa place, puis descend
        const c = depart.lerp(this.genoux.pieds[i], lisse(k / 0.75)); c.y += arc;
        this.ik(L, c);
      });
      this.cinematique();
      if (k >= 1 && this.genoux.orient) {
        // posés : les pieds ne bougent plus
        this.jambes.forEach((L, i) => { this.D[L.pied].copy(this.genoux.orient[i][0]); this.D[L.orteil].copy(this.genoux.orient[i][1]); });
      } else {
        for (const L of this.jambes) {
          const devant = new THREE.Vector3(0, 0, 1).applyQuaternion(this.D[L.pied]);
          const voulu = new THREE.Vector3(0, -1, 0).addScaledVector(this.genoux.avant, -0.2).normalize();
          const Rk = new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(devant, voulu), k);
          this.D[L.pied].premultiply(Rk); this.D[L.orteil].premultiply(Rk);
        }
        if (k >= 1) this.genoux.orient = this.jambes.map((L) => [this.D[L.pied].clone(), this.D[L.orteil].clone()]);
      }
      this.cinematique();
      auCiel(w);
    } else if (c.genre === 'corner') {
      // le poing serré qui frappe l'air
      const coup = 0.35 + 0.22 * Math.max(0, Math.sin(2 * Math.PI * 1.8 * t));
      this.mainsVers(this.P[this.bras[0].pied].clone(), epaule(1).addScaledVector(haut, coup).addScaledVector(avant, 0.12), w);
    } else if (c.genre === 'silence') {
      const tete = this.P[this.cou[2]];
      this.mainsVers(this.P[this.bras[0].pied].clone(), tete.clone().addScaledVector(avant, 0.13).add(new THREE.Vector3(0, -0.03, 0)), w);
    } else if (c.genre === 'foule') ecartes();
    else auCiel(w);
  }

  // La tête et le cou se tournent vers le ballon (au plus 70° de côté, 45° vers le bas, 30° vers
  // le haut par rapport à la poitrine, 80 % du chemin), le cou prend sa part ; le porteur lève les
  // yeux de temps en temps pour voir le jeu devant lui.
  regarder(match, code, t, dt) {
    const b = match.ballonVisuel(t), tete = this.P[this.cou[2]];
    const cible = new THREE.Vector3(b.p[0], b.p[1] + 0.11, b.p[2]);
    if (this.fete && this.poidsFete > 0.3) {
      const avant = new THREE.Vector3(0, 0, 1).applyQuaternion(this.D[this.racine]).setY(0).normalize();
      cible.copy(tete).addScaledVector(avant, 20).setY(this.genoux && this.genoux.c === this.fete ? 9 : 4);
    }
    if (b.porteur === code) {
      const phase = (t * 0.7 + code * 0.37) % 1;
      if (phase < 0.32) {
        const v = match.vitesse(code, t), l = Math.hypot(v[0], v[1]);
        const dx = l > 0.3 ? v[0] / l : Math.sin(this.lacetLisse), dz = l > 0.3 ? v[1] / l : Math.cos(this.lacetLisse);
        const haut = lisse(phase / 0.08) * lisse((0.32 - phase) / 0.08);
        cible.lerp(new THREE.Vector3(tete.x + dx * 15, 1.6, tete.z + dz * 15), haut);
      }
    }
    const inv = this.D[this.poitrine].clone().invert();
    const loc = cible.sub(tete).applyQuaternion(inv);
    let lacet = Math.atan2(loc.x, loc.z), tangage = Math.atan2(loc.y, Math.hypot(loc.x, loc.z));
    lacet = Math.max(-1.22, Math.min(1.22, lacet));
    tangage = Math.max(-0.8, Math.min(0.5, tangage));
    if (!this.regard) this.regard = { lacet, tangage };
    const k = 1 - Math.exp(-dt / 0.12);
    this.regard.lacet += (lacet - this.regard.lacet) * k;
    this.regard.tangage += (tangage - this.regard.tangage) * k;
    const voulu = new THREE.Vector3(Math.sin(this.regard.lacet) * Math.cos(this.regard.tangage), Math.sin(this.regard.tangage),
      Math.cos(this.regard.lacet) * Math.cos(this.regard.tangage)).applyQuaternion(this.D[this.poitrine]);
    const devant = new THREE.Vector3(0, 0, 1).applyQuaternion(this.D[this.cou[2]]);
    const R = new THREE.Quaternion().setFromUnitVectors(devant, voulu);
    const I = new THREE.Quaternion();
    const parts = this.partsRegard;
    for (let o = 0; o < this.nb; o++) if (parts[o] > 0) this.D[o].premultiply(_q.copy(I).slerp(R, parts[o] * 0.8));
    this.cinematique();
  }

  cinematique() {
    // la racine de MakeHuman : son repos rapporté au centre des hanches
    const r = this.racine, J = this.J;
    this.P[r].subVectors(J.tetes[r], this.centreHanches).applyQuaternion(this.D[r]).add(this.hanches);
    for (let b = 0; b < this.nb; b++) {
      const p = this.parent[b];
      if (p < 0) continue;
      this.P[b].subVectors(J.tetes[b], J.tetes[p]).applyQuaternion(this.D[p]).add(this.P[p]);
    }
  }

  // deux os : la hanche, le genou, la cheville vers la cible ; rend ce qu'il manque pour l'atteindre
  ik(L, cible) {
    const H = this.P[L.cuisse[0]], K = this.P[L.tibia[0]], A = this.P[L.pied];
    const a = H.distanceTo(K), b = K.distanceTo(A);
    const dh = new THREE.Vector3().subVectors(cible, H);
    let dist = dh.length();
    const manque = Math.max(0, dist - (a + b) * 0.999);
    dist = Math.max(Math.abs(a - b) + 1e-3, Math.min((a + b) * 0.999, dist));
    const e = dh.normalize();
    // le genou reste dans son plan de flexion
    const ea = new THREE.Vector3().subVectors(A, H).normalize();
    let u = new THREE.Vector3().subVectors(K, H);
    u.addScaledVector(ea, -u.dot(ea));
    if (u.lengthSq() < 1e-8) u.set(Math.sin(this.lacetLisse), 0, Math.cos(this.lacetLisse));
    u.addScaledVector(e, -u.dot(e));
    u.normalize();
    const x = (a * a - b * b + dist * dist) / (2 * dist), y = Math.sqrt(Math.max(0, a * a - x * x));
    const K2 = H.clone().addScaledVector(e, x).addScaledVector(u, y);
    const r1 = new THREE.Quaternion().setFromUnitVectors(_v.subVectors(K, H).normalize(), _v2.subVectors(K2, H).normalize());
    for (const o of L.cuisse) this.D[o].premultiply(r1);
    const tib = new THREE.Vector3().subVectors(A, K).applyQuaternion(r1).normalize();
    const vers = new THREE.Vector3().subVectors(cible, K2).normalize();
    const r2 = new THREE.Quaternion().setFromUnitVectors(tib, vers).multiply(r1);
    for (const o of L.tibia) this.D[o].premultiply(r2);
    // la main suit l'avant-bras (le pied, lui, garde son orientation)
    if (L.suit) for (const o of L.suit) this.D[o].premultiply(r2);
    return manque;
  }

  detecteurs() {
    return this.jambes.map((L) => ({ glissements: L.detecteur.glissements, imagesAuSol: L.detecteur.imagesAuSol, pireCmS: Math.round(L.detecteur.pire), evenements: L.detecteur.evenements || [],
      imagesSuspendues: L.detecteur.imagesSuspendues || 0 }));
  }

  ecrire() {
    if (this.J.personnage) return this.ecrireMonde();
    const os = this.J.os;
    for (let b = 0; b < this.nb; b++) {
      const p = this.parent[b];
      if (p < 0) { os[b].position.copy(this.P[b]); os[b].quaternion.copy(this.D[b]); }
      else os[b].quaternion.copy(_q.copy(this.D[p]).invert().multiply(this.D[b]));
    }
  }

  // un personnage venu d'ailleurs : ses os n'ont pas une rotation nulle au repos, et sa hiérarchie
  // n'est pas forcément celle de l'animation (les pieds de Quaternius sont des enfants de la racine).
  // Chaque os logique reçoit sa matrice voulue dans le monde (position calculée, rotation D fois
  // celle du repos, échelle du repos ; un os décalé de son articulation, comme un pied qui part du
  // talon, garde son décalage) ; la locale s'en déduit par la matrice du monde de son vrai
  // parent ; les autres nœuds (doigts, racines, cibles) gardent leur pose locale.
  ecrireMonde() {
    const J = this.J, ordre = J.ordre, monde = this.monde;
    for (let b = 0; b < this.nb; b++) {
      if (!J.os[b]) continue;
      _q.copy(this.D[b]).multiply(J.reposMonde[b]);
      _v.copy(this.P[b]);
      if (J.decalages[b]) _v.add(_v2.copy(J.decalages[b]).applyQuaternion(this.D[b]));
      this.voulu[b].compose(_v, _q, J.echelleMonde[b]);
    }
    for (let k = 0; k < ordre.length; k++) {
      const e = ordre[k];
      if (e.b >= 0) {
        monde[k].copy(this.voulu[e.b]);
        _m.copy(monde[e.p]).invert().multiply(monde[k]).decompose(e.o.position, e.o.quaternion, e.o.scale);
      } else if (e.p < 0) monde[k].copy(e.o.matrix);
      else monde[k].multiplyMatrices(monde[e.p], e.o.matrix);
    }
  }
}
