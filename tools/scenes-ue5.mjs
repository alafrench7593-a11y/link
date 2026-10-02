// Les seize scènes de test du cahier AAA (§76), extraites de VRAIS matchs du moteur.
//
// Une scène n'est pas une animation écrite à la main : c'est une fenêtre de quelques
// secondes d'un match que le moteur LinkFoot a réellement joué, au format de la passerelle
// (docs/passerelle-ue5.md), avec un bloc « scene » : le joueur à regarder, l'instant clé,
// et ce que l'extraction a mesuré. Unreal les rejoue (carte LinkFoot.Scenes) pour juger la
// locomotion sur des situations connues ; le cœur C++ (unreal/tests-coeur) vérifie que
// chacune montre bien ce que son nom promet.
//
//   node tools/scenes-ue5.mjs            écrit unreal/LinkFoot/Content/LinkFoot/Scenes/*.json
//   node tools/scenes-ue5.mjs --check    vérifie que les fichiers sont ceux que le moteur produit
//
// Tout est joué à graines fixes : deux extractions donnent les mêmes fichiers. Un changement
// du moteur change les scènes ; --check le signale, comme build.mjs --check pour dist/.
import { Club } from '../src/club.js';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = join(RACINE, 'unreal', 'LinkFoot', 'Content', 'LinkFoot', 'Scenes');
const VERIFIER = process.argv.includes('--check');
const ADV = { club: 'Référence', ovr: 66, style: 'blocmed' };

// ---------------------------------------------------------------- les matchs
const nouveauClub = (retouche) => { const c = new Club(); c.createClub({ name: 'FC Pont', seed: 4242 }); if (retouche) retouche(c); return c; };
const tac = (o) => (c) => c.setState({ tac: Object.assign({}, c.state.tac, o) });
const fatigue = (fit) => (c) => c.setState({ squad: c.state.squad.map((p) => Object.assign({}, p, { fit })) });
// Des compétences équipées sur tous ceux qui peuvent les porter (comme test/leviers.js, sans
// passer par les emplacements : c'est une configuration de test). Le tacle glissé vient du
// trait « tacle » (MUR, GLADIATEUR) au-delà de 0,4 : MUR « à domicile » (28) et MUR « en
// permanence » (18), les plus fortes de leur condition, l'ouvrent pour tout un match à domicile.
const equipe = (liste) => (c) => {
  const D = c.SKILL_DEF(), idx = c.SKILL_INDEX(), inv = [];
  let uid = 1;
  const meilleure = (eid, cond) => { let best = null; Object.keys(idx).forEach((rar) => idx[rar].forEach((e) => { if (e[0] === eid && e[1] === cond && (!best || e[4] > best[4])) best = e; })); return best; };
  const choix = liste.map(([eid, cond]) => meilleure(eid, cond));
  c.state.squad.forEach((p) => choix.forEach((b) => { if ((D.POSOK[p.pos] || []).indexOf(b[0]) >= 0) inv.push(Object.assign({}, c.makeSkill(b[0], b[1], b[2], b[3]), { uid: uid++, on: p.id })); }));
  c.setState({ skillInv: inv });
};
const REGLAGES = {
  base: null,
  tacleurs: equipe([['mur', 7], ['mur', 0]]),
  pressing: tac({ press: 2, engage: 2, ptrap: 2 }),
  bloc: tac({ line: 0, engage: 0, press: 0 }),
  epuisee: fatigue(55)
};
const matchs = new Map();
function match(reglage, graine) {
  const cle = reglage + ':' + graine;
  // debug : les scènes portent aussi la cible que l'IA du moteur donne à chaque joueur (§71, TargetPosition),
  // et ses délibérations à chaque décision du porteur
  if (!matchs.has(cle)) matchs.set(cle, { reglage, graine, doc: nouveauClub(REGLAGES[reglage]).matchPont(ADV, { seed: graine, debug: true }).document });
  return matchs.get(cle);
}
// la météo est tirée à l'ouverture du match : on la lit sans le jouer
function graineAvecMeteo(meteo, depart) {
  for (let g = depart; g < depart + 400; g++) {
    const ctx = nouveauClub().ouvrirMatch(ADV, { seed: g });
    if (ctx.E.weather().id === meteo) return g;
  }
  throw new Error('aucune graine avec la météo ' + meteo);
}

// ---------------------------------------------------------------- lire les images
const P = new Club().PASSERELLE(), NT = P.tete.length, NJ = P.joueur.length;
function lecteur(doc) {
  const D = doc.images.donnees, n = D.length;
  const present = (i, k) => D[i][NT + k * NJ] > -500;
  const pos = (i, k) => [D[i][NT + k * NJ] / 100, D[i][NT + k * NJ + 1] / 100];
  const etats = (i, k) => D[i][NT + k * NJ + 4];
  const energie = (i, k) => D[i][NT + k * NJ + 3];
  const temps = (i) => D[i][0] / 10;
  // les ruptures : celles du cœur C++ (coupe, trou dans le temps, entrée ou sortie, remplacement)
  const remp = new Set();
  doc.actions.filter((a) => a.a === 'remplacement').forEach((a) => { const t10 = Math.round(a.t * 10); remp.add(a.c + ':' + t10); remp.add(a.c + ':' + (t10 + 1)); });
  const rupture = (i, k) => i === 0 || D[i][3] === 1 || D[i][0] - D[i - 1][0] !== 1 || !present(i, k) || !present(i - 1, k) || remp.has(k + ':' + D[i][0]);
  // les segments, une fois pour toutes : numéro du segment, premier et dernier indice
  const segNum = [], segPremier = [], segDernier = [];
  for (let k = 0; k < 22; k++) {
    const num = new Int32Array(n), prem = [], dern = [];
    let s = -1;
    for (let i = 0; i < n; i++) { if (rupture(i, k)) { s++; prem.push(i); dern.push(i); } num[i] = s; dern[s] = i; }
    segNum.push(num); segPremier.push(prem); segDernier.push(dern);
  }
  const segment = (i, k) => { const s = segNum[k][i]; return [segPremier[k][s], segDernier[k][s]]; };
  const cacheV = new Map();
  // la vitesse aux images : différences centrées dans le segment (comme le cœur C++)
  const vitesse = (i, k) => {
    const cle = i * 22 + k; if (cacheV.has(cle)) return cacheV.get(cle);
    if (i < 0 || i >= n || !present(i, k)) return [0, 0];
    const [p, d] = segment(i, k); let v = [0, 0];
    if (d > p) {
      const a = i === p ? i : i - 1, b = i === d ? i : i + 1, dt = (b - a) * 0.1, pa = pos(a, k), pb = pos(b, k);
      v = [(pb[0] - pa[0]) / dt, (pb[1] - pa[1]) / dt];
    }
    cacheV.set(cle, v); return v;
  };
  const norme = (v) => Math.hypot(v[0], v[1]);
  const index = (t) => { const t10 = Math.round(t * 10); let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (D[m][0] <= t10) lo = m; else hi = m - 1; } return lo; };
  const memeSegment = (i, j, k) => i >= 0 && j >= 0 && i < n && j < n && present(i, k) && present(j, k) && segNum[k][i] === segNum[k][j];
  const cap = (v) => Math.atan2(v[1], v[0]);
  const ecartCap = (a, b) => { let d = (b - a) * 180 / Math.PI; while (d > 180) d -= 360; while (d <= -180) d += 360; return d; };
  return { D, n, present, pos, etats, energie, temps, rupture, segment, vitesse, norme, index, memeSegment, cap, ecartCap };
}
const vmaxDe = (doc, k) => { const j = doc.joueurs.find((q) => q.code === k); return j && j.moteur ? j.moteur.vitesse_max : 9; };
const enJeu = (row) => row[10] === 0;

// ---------------------------------------------------------------- découper une scène
function decouper(m, def) {
  const { doc } = m, L = lecteur(doc);
  const t0 = Math.max(L.temps(0), def.instant - (def.avant != null ? def.avant : 4)), t1 = Math.min(L.temps(L.n - 1), def.instant + (def.apres != null ? def.apres : 4));
  const donnees = doc.images.donnees.filter((r) => r[0] / 10 >= t0 - 1e-9 && r[0] / 10 <= t1 + 1e-9);
  // les remplacements d'avant la fenêtre restent : ils disent qui porte quel code
  const actions = doc.actions.filter((a) => (a.t >= t0 - 1e-9 && a.t <= t1 + 1e-9) || (a.a === 'remplacement' && a.t < t0));
  const evenements = doc.evenements.filter((e) => e.t >= t0 - 1e-9 && e.t <= t1 + 1e-9);
  // §71 les délibérations du moteur dans la fenêtre (le match est joué en mode débogage)
  const decisions = (doc.decisions || []).filter((d) => d.t >= t0 - 1e-9 && d.t <= t1 + 1e-9);
  const c = new Club();
  const scene = Object.assign({}, doc, {
    match: Object.assign({}, doc.match, { debut: donnees[0][0] / 10, fin: donnees[donnees.length - 1][0] / 10 }),
    images: { champs: doc.images.champs, donnees }, actions, evenements, decisions, resultat: undefined
  });
  delete scene.resultat;
  scene.empreinte = String(c.empreintePont(JSON.stringify([donnees, actions])));
  scene.empreinte_images = c.empreinteImagesPont(donnees);
  scene.scene = {
    id: def.id, numero: def.numero, titre: def.titre, raison: def.raison, focus: def.focus,
    t0: Math.round(t0 * 10) / 10, t1: Math.round(t1 * 10) / 10, instant: Math.round(def.instant * 10) / 10,
    mesures: def.mesures || {}, source: { reglage: m.reglage, graine: m.graine }
  };
  return scene;
}

// ---------------------------------------------------------------- les seize recherches
const r2 = (v) => Math.round(v * 100) / 100;
const r1 = (v) => Math.round(v * 10) / 10;
const champ = (k) => k !== 0 && k !== 11;

function premier(liste, note) {
  let meilleur = null;
  for (const x of liste) { const s = note(x); if (s != null && (!meilleur || s > meilleur.s)) meilleur = { x, s }; }
  return meilleur ? meilleur.x : null;
}

const RECHERCHES = [
  ['sprint_droit', 1, 'Sprint droit', (m) => {
    const L = lecteur(m.doc), cand = [];
    for (let i = 20; i < L.n - 20; i += 2) for (let k = 1; k < 22; k++) {
      if (!champ(k) || !L.present(i, k) || !L.memeSegment(i - 10, i + 10, k) || !enJeu(L.D[i])) continue;
      const va = L.vitesse(i - 10, k), vb = L.vitesse(i + 10, k);
      if (L.norme(va) < 3 || L.norme(vb) < 3) continue;
      // l'instant clé est au cœur du sprint : à sa vitesse de pointe, en ligne droite sur 2 s
      const pointe = L.norme(L.vitesse(i, k));
      const ecart = Math.abs(L.ecartCap(L.cap(va), L.cap(vb)));
      if (pointe >= 0.92 * vmaxDe(m.doc, k) && ecart < 8) cand.push({ i, k, pointe, ecart });
    }
    const b = premier(cand, (c) => c.pointe - c.ecart * 0.02);
    return b && { focus: b.k, instant: L.temps(b.i), raison: 'pointe ' + r2(b.pointe) + ' m/s en ligne droite', mesures: { pointe: r2(b.pointe), cap: r1(b.ecart) } };
  }],
  ['sprint_virage_90', 2, 'Sprint puis virage à 90°', (m) => {
    const L = lecteur(m.doc), cand = [];
    for (let i = 5; i < L.n - 15; i += 1) for (let k = 1; k < 22; k++) {
      if (!champ(k) || !L.present(i, k) || !L.memeSegment(i, i + 12, k)) continue;
      const va = L.vitesse(i, k), vb = L.vitesse(i + 12, k);
      if (L.norme(va) < 4.5 || L.norme(vb) < 3.5) continue;
      const e = Math.abs(L.ecartCap(L.cap(va), L.cap(vb)));
      if (e >= 78 && e <= 102) cand.push({ i, k, e, v: L.norme(va) });
    }
    const b = premier(cand, (c) => c.v - Math.abs(c.e - 90) * 0.1);
    return b && { focus: b.k, instant: L.temps(b.i), raison: 'virage de ' + Math.round(b.e) + '° lancé à ' + r1(b.v) + ' m/s', mesures: { virage: r1(b.e), vitesse: r2(b.v) } };
  }],
  ['sprint_arret', 3, 'Sprint puis arrêt', (m) => {
    const L = lecteur(m.doc), cand = [];
    for (let i = 5; i < L.n - 40; i += 1) for (let k = 1; k < 22; k++) {
      if (!champ(k) || !L.present(i, k) || L.norme(L.vitesse(i, k)) < 6.5) continue;
      for (let j = i + 1; j <= i + 30 && L.memeSegment(i, j, k); j++) {
        if (L.norme(L.vitesse(j, k)) < 0.4) {
          let frein = 0; for (let q = i; q <= j; q++) { const a = L.vitesse(q - 1, k), b = L.vitesse(q + 1, k), v = L.vitesse(q, k), nv = L.norme(v) || 1;
            frein = Math.max(frein, -(((b[0] - a[0]) * v[0] + (b[1] - a[1]) * v[1]) / nv) / 0.2); }
          if (j - i >= 8 && frein <= 11) cand.push({ i, k, duree: (j - i) / 10, frein, v: L.norme(L.vitesse(i, k)) });
          break;
        }
      }
    }
    const b = premier(cand, (c) => c.v - c.duree * 0.5);
    return b && { focus: b.k, instant: L.temps(b.i), raison: 'de ' + r1(b.v) + ' m/s à l\'arrêt en ' + r1(b.duree) + ' s', mesures: { vitesse: r2(b.v), duree: r1(b.duree) } };
  }],
  ['reception_course', 4, 'Réception en course', (m) => {
    const L = lecteur(m.doc);
    const b = premier(m.doc.actions.filter((a) => a.a === 'controle' && a.niveau !== 'rate' && champ(a.c)), (a) => { const v = L.norme(L.vitesse(L.index(a.t), a.c)); return v >= 4.8 ? v : null; });
    return b && { focus: b.c, instant: b.t, raison: 'contrôle « ' + b.niveau + ' » en pleine course', mesures: { vitesse: r2(L.norme(L.vitesse(L.index(b.t), b.c))) } };
  }],
  ['reception_pression', 5, 'Réception sous pression', (m) => {
    const L = lecteur(m.doc);
    const b = premier(m.doc.actions.filter((a) => a.a === 'controle' && a.presse && champ(a.c)), (a) => (a.niveau === 'parfait' ? 3 : a.niveau === 'propre' ? 2 : a.niveau === 'correct' ? 1 : 0) + (L.index(a.t) % 7) * 0.01);
    return b && { focus: b.c, instant: b.t, raison: 'contrôle « ' + b.niveau + ' » avec un adversaire à moins de 2 m', mesures: {} };
  }],
  ['dribble_changement', 6, 'Dribble et changement de direction', (m) => {
    const L = lecteur(m.doc);
    const b = premier(m.doc.actions.filter((a) => a.a === 'dribble' && a.geste !== 'protect'), (a) => {
      const i = L.index(a.t); if (!L.memeSegment(i - 5, i + 7, a.c)) return null;
      const va = L.vitesse(i - 5, a.c), vb = L.vitesse(i + 7, a.c); if (L.norme(va) < 0.8 || L.norme(vb) < 0.8) return null;
      const e = Math.abs(L.ecartCap(L.cap(va), L.cap(vb))); return e >= 55 ? e + (a.reussi ? 100 : 0) + a.palier * 10 : null;
    });
    return b && { focus: b.c, instant: b.t, raison: b.geste + (b.reussi ? ' réussi' : ' manqué') + ' (palier ' + b.palier + ')', mesures: { palier: b.palier } };
  }],
  ['duel_epaule', 7, 'Duel d\'épaule', (m) => {
    const L = lecteur(m.doc);
    const b = premier(m.doc.actions.filter((a) => a.a === 'dribble' && a.geste === 'protect'), (a) => {
      const i = L.index(a.t); if (!L.present(i, a.contre)) return null;
      const p = L.pos(i, a.c), q = L.pos(i, a.contre), d = Math.hypot(p[0] - q[0], p[1] - q[1]); return d <= 1.4 ? 2 - d : null;
    });
    return b && { focus: b.c, instant: b.t, raison: 'protection de balle au contact du défenseur n°' + b.contre, mesures: {} };
  }],
  ['tacle_glisse', 8, 'Tacle glissé', (m) => {
    const b = premier(m.doc.actions.filter((a) => a.a === 'tacle' && a.genre === 'glisse'), (a) => (a.reussi ? 1 : 0) + a.t * 1e-6);
    return b && { focus: b.c, instant: b.t, raison: 'tacle glissé ' + (b.reussi ? 'réussi' : 'manqué'), mesures: {} };
  }],
  ['centre_tete', 9, 'Centre et tête', (m) => {
    const croisees = m.doc.actions.filter((a) => a.a === 'passe' && ['cross', 'corner', 'fkc'].includes(a.genre));
    const b = premier(m.doc.actions.filter((a) => a.a === 'tir' && a.tete), (a) => {
      const c = croisees.filter((x) => x.t >= a.t - 3 && x.t <= a.t - 0.2); return c.length ? (a.issue === 'goal' ? 3 : a.issue === 'save' ? 2 : 1) : null;
    });
    return b && { focus: b.c, instant: b.t, raison: 'tête « ' + b.issue + ' » sur centre', mesures: {} };
  }],
  ['un_contre_un', 10, 'Un contre un face au gardien', (m) => {
    const L = lecteur(m.doc);
    const b = premier(m.doc.actions.filter((a) => a.a === 'tir' && !a.tete && !a.penalty && champ(a.c)), (a) => {
      const i = L.index(a.t), g = a.c < 11 ? 11 : 0; if (!L.present(i, g)) return null;
      const p = L.pos(i, a.c), q = L.pos(i, g), d = Math.hypot(p[0] - q[0], p[1] - q[1]); return d <= 8 ? (a.issue === 'save' ? 3 : a.issue === 'goal' ? 2 : 1) - d * 0.05 : null;
    });
    return b && { focus: b.c, instant: b.t, raison: 'tir « ' + b.issue + ' » face au gardien', mesures: {} };
  }],
  ['pressing_haut', 11, 'Pressing haut', (m) => {
    const L = lecteur(m.doc), cand = [];
    for (let i = 60; i < L.n - 60; i += 10) {
      const t0 = L.temps(i) - 5, t1 = L.temps(i) + 5; let images = 0, presseurs = 0;
      for (let j = L.index(t0); j < L.n && L.temps(j) <= t1 + 1e-9; j++) {
        const r = L.D[j]; if (L.temps(j) < t0 - 1e-9 || r[7] < 11 || r[10] !== 0) continue;
        let nb = 0; for (let k = 1; k < 11; k++) if (L.present(j, k) && (L.etats(j, k) & 32)) nb++;
        presseurs += nb; images++;
      }
      if (images >= 30) cand.push({ i, moy: presseurs / images, images });
    }
    const b = premier(cand, (c) => (c.moy >= 2 ? c.moy : null));
    if (!b) return null;
    let focus = 1, max = -1;
    for (let k = 1; k < 11; k++) { let s = 0; for (let j = b.i - 50; j <= b.i + 50; j++) if (j >= 0 && j < L.n && L.present(j, k) && (L.etats(j, k) & 32)) s++; if (s > max) { max = s; focus = k; } }
    return { focus, instant: L.temps(b.i), avant: 5, apres: 5, raison: r2(b.moy) + ' joueurs pressent le porteur en moyenne (pressing réglé à fond)', mesures: { presseurs: b.moy } };
  }],
  ['bloc_bas', 12, 'Bloc bas', (m) => {
    const L = lecteur(m.doc), cand = [];
    for (let i = 60; i < L.n - 60; i += 10) {
      const t0 = L.temps(i) - 6, t1 = L.temps(i) + 6; let images = 0, groupes = 0;
      for (let j = L.index(t0); j < L.n && L.temps(j) <= t1 + 1e-9; j++) {
        const r = L.D[j]; if (L.temps(j) < t0 - 1e-9 || r[7] < 11 || r[10] !== 0) continue;
        const but = L.pos(j, 0)[1] < 52.5 ? 0 : 105;
        let bas = 0; for (let k = 1; k < 11; k++) if (L.present(j, k) && Math.abs(L.pos(j, k)[1] - but) <= 35) bas++;
        if (bas >= 8) groupes++; images++;
      }
      if (images >= 40 && groupes / images >= 0.75) cand.push({ i, part: groupes / images, images });
    }
    const b = premier(cand, (c) => c.part + c.images * 0.001);
    if (!b) return null;
    const defs = m.doc.joueurs.filter((j) => j.code != null && j.code < 11 && j.ligne === 'DEF').map((j) => j.code);
    const balle = [L.D[b.i][4] / 100, L.D[b.i][5] / 100];
    const focus = defs.sort((a, c) => Math.hypot(L.pos(b.i, a)[0] - balle[0], L.pos(b.i, a)[1] - balle[1]) - Math.hypot(L.pos(b.i, c)[0] - balle[0], L.pos(b.i, c)[1] - balle[1]))[0];
    return { focus, instant: L.temps(b.i), avant: 6, apres: 6, raison: Math.round(b.part * 100) + ' % du temps à huit dans ses 35 derniers mètres (ligne basse, pas de pressing)', mesures: { part: r2(b.part) } };
  }],
  ['contre_attaque', 13, 'Contre-attaque', (m) => {
    const L = lecteur(m.doc);
    const b = premier(m.doc.actions.filter((a) => a.a === 'tir' && !a.penalty && !a.cf), (a) => {
      const nous = a.c < 11, recups = m.doc.actions.filter((x) => x.t >= a.t - 15 && x.t <= a.t - 2 && x.c >= 0 && (x.c < 11) === nous && (x.a === 'interception' || (x.a === 'tacle' && x.reussi)));
      if (!recups.length) return null;
      const r = recups[recups.length - 1], but = a.y1 < 52.5 ? 0 : 105;
      const y0 = L.D[L.index(r.t)][5] / 100, y1 = L.D[L.index(a.t)][5] / 100, gain = Math.abs(y0 - but) - Math.abs(y1 - but);
      return gain >= 40 ? gain - (a.t - r.t) : null;
    });
    if (!b) return null;
    const nous = b.c < 11, r = m.doc.actions.filter((x) => x.t >= b.t - 15 && x.t <= b.t - 2 && x.c >= 0 && (x.c < 11) === nous && (x.a === 'interception' || (x.a === 'tacle' && x.reussi))).pop();
    return { focus: b.c, instant: b.t, avant: Math.min(14, b.t - r.t + 1.5), apres: 2.5, raison: 'récupération (' + r.a + ') puis tir ' + r1(b.t - r.t) + ' s plus tard', mesures: { recuperation: r.t } };
  }],
  ['joueur_epuise', 14, 'Joueur épuisé', (m) => {
    const L = lecteur(m.doc), cand = [];
    const frais = {};
    for (let k = 1; k < 22; k++) {
      if (!champ(k)) continue; const v = [];
      for (let i = 0; i < L.n && L.temps(i) < 900; i++) if (L.present(i, k) && (L.etats(i, k) & 16)) v.push(L.norme(L.vitesse(i, k)));
      v.sort((a, b) => a - b); frais[k] = v.length ? v[Math.min(v.length - 1, Math.floor(0.95 * v.length))] : 0;
    }
    for (let i = Math.floor(L.n * 0.75); i < L.n - 45; i += 5) for (let k = 1; k < 11; k++) {
      if (!L.present(i, k) || L.energie(i, k) >= 40 || !L.memeSegment(i - 40, i + 40, k)) continue;
      let pointe = 0; for (let j = i - 40; j <= i + 40; j++) pointe = Math.max(pointe, L.norme(L.vitesse(j, k)));
      if (pointe >= 3.5 && pointe < frais[k] - 0.4) cand.push({ i, k, pointe, frais: frais[k], e: L.energie(i, k) });
    }
    const b = premier(cand, (c) => c.pointe - c.e * 0.01);
    return b && { focus: b.k, instant: L.temps(b.i), raison: 'énergie ' + b.e + ' : sa pointe tombe à ' + r2(b.pointe) + ' m/s (' + r2(b.frais) + ' frais)', mesures: { p95_frais: r2(b.frais), pointe: r2(b.pointe), energie: b.e } };
  }],
  ['pluie', 15, 'Sous la pluie', (m) => {
    const L = lecteur(m.doc);
    const b = premier(m.doc.actions.filter((a) => a.a === 'passe' && !a.aerien && champ(a.c)), (a) => Math.hypot(a.x1 - a.x0, a.y1 - a.y0) + (L.index(a.t) % 5) * 0.01);
    return b && { focus: b.c, instant: b.t, raison: 'passe au sol de ' + Math.round(Math.hypot(b.x1 - b.x0, b.y1 - b.y0)) + ' m sur terrain mouillé (le ballon glisse plus, les contrôles sont plus durs)', mesures: {} };
  }],
  ['nuit', 16, 'Match de nuit', (m) => {
    const b = premier(m.doc.actions.filter((a) => a.a === 'tir' && !a.penalty && champ(a.c)), (a) => (a.issue === 'goal' ? 3 : a.issue === 'save' ? 2 : 1) - a.t * 1e-6);
    return b && { focus: b.c, instant: b.t, raison: 'tir « ' + b.issue + ' » sous les projecteurs', mesures: {} };
  }]
];

// Où chercher chaque scène : le réglage du club, puis les graines essayées dans l'ordre.
const OU = {
  tacle_glisse: [['tacleurs', [77, 78, 79, 80]]],
  pressing_haut: [['pressing', [77, 78, 79]]],
  bloc_bas: [['bloc', [77, 78, 79, 80]]],
  joueur_epuise: [['epuisee', [77, 78, 79]]]
};
const graines = [77, 78, 79, 80, 81];

const t0 = Date.now();
const pluie = graineAvecMeteo('pluie', 300), nuit = graineAvecMeteo('nuit', 300);
OU.pluie = [['base', [pluie]]];
OU.nuit = [['base', [nuit]]];

const scenes = [];
for (const [id, numero, titre, chercher] of RECHERCHES) {
  let trouve = null;
  for (const [reglage, liste] of OU[id] || [['base', graines]]) {
    for (const g of liste) {
      const m = match(reglage, g), r = chercher(m);
      if (r) { trouve = { m, r }; break; }
    }
    if (trouve) break;
  }
  if (!trouve) { console.error('ÉCHEC : aucune fenêtre pour la scène ' + numero + ' (' + id + ')'); process.exit(1); }
  const doc = decouper(trouve.m, Object.assign({ id, numero, titre }, trouve.r));
  scenes.push(doc);
  console.log(String(numero).padStart(2) + '. ' + titre.padEnd(36) + ' ' + trouve.r.raison + '  [' + trouve.m.reglage + ', graine ' + trouve.m.graine + ', ' + doc.images.donnees.length + ' images]');
}

// ---------------------------------------------------------------- écrire ou vérifier
const nom = (d) => String(d.scene.numero).padStart(2, '0') + '-' + d.scene.id + '.json';
const index = { format: 'linkfoot-scenes', version: 1, scenes: scenes.map((d) => ({ fichier: nom(d), numero: d.scene.numero, id: d.scene.id, titre: d.scene.titre, raison: d.scene.raison, focus: d.scene.focus, instant: d.scene.instant, meteo: d.match.meteo })) };
const fichiers = scenes.map((d) => [nom(d), JSON.stringify(d)]).concat([['index.json', JSON.stringify(index, null, 1)]]);
if (VERIFIER) {
  const differents = fichiers.filter(([f, txt]) => !existsSync(join(SORTIE, f)) || readFileSync(join(SORTIE, f), 'utf8') !== txt).map(([f]) => f);
  if (differents.length) { console.error('Les scènes ne sont plus celles du moteur : ' + differents.join(', ') + '\nRelance : node tools/scenes-ue5.mjs'); process.exit(1); }
  console.log('OK : les ' + scenes.length + ' scènes sont celles que le moteur joue (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
} else {
  mkdirSync(SORTIE, { recursive: true });
  fichiers.forEach(([f, txt]) => writeFileSync(join(SORTIE, f), txt));
  console.log(scenes.length + ' scènes écrites dans ' + SORTIE.replace(RACINE + '/', '') + ' en ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
}
