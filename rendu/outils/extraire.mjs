// Des fenêtres de vrais matchs du moteur pour le labo, autour d'actions que les 16 scènes de test
// n'ont pas (une faute et la chute qui la suit, une touche...). Comme tools/scenes-ue5.mjs : des
// matchs joués à graines fixes, découpés sans rien changer ; mais ces fenêtres restent au labo
// (rendu/labo/scenes/), les scènes officielles et leurs tests ne bougent pas.
//   node rendu/outils/extraire.mjs [graine de départ] [nombre de matchs]
// Écrit rendu/labo/scenes/<id>.json et index.json (ce qui a été trouvé, où, à quel instant).
import { Club } from '../../src/club.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SORTIE = path.join(RACINE, 'rendu', 'labo', 'scenes');
const ADV = { club: 'Référence', ovr: 66, style: 'blocmed' };
const [depart = '1', combien = '6'] = process.argv.slice(2);

// les compétences du tacle glissé (comme tools/scenes-ue5.mjs, « tacleurs ») : MUR à domicile et en permanence
const equipe = (liste) => (c) => {
  const D = c.SKILL_DEF(), idx = c.SKILL_INDEX(), inv = [];
  let uid = 1;
  const meilleure = (eid, cond) => { let best = null; Object.keys(idx).forEach((rar) => idx[rar].forEach((e) => { if (e[0] === eid && e[1] === cond && (!best || e[4] > best[4])) best = e; })); return best; };
  const choix = liste.map(([eid, cond]) => meilleure(eid, cond));
  c.state.squad.forEach((p) => choix.forEach((b) => { if ((D.POSOK[p.pos] || []).indexOf(b[0]) >= 0) inv.push(Object.assign({}, c.makeSkill(b[0], b[1], b[2], b[3]), { uid: uid++, on: p.id })); }));
  c.setState({ skillInv: inv });
};
const nouveauClub = () => { const c = new Club(); c.createClub({ name: 'FC Pont', seed: 4242 }); equipe([['mur', 7], ['mur', 0]])(c); return c; };

// ce qu'on cherche : un nom, une action du moteur, et ce qu'elle doit montrer
const RECHERCHES = [
  ['faute_chute', 'Faute et chute', (a) => a.a === 'faute' && a.chute, (a) => a.victime],
  ['tacle_glisse', 'Tacle glissé', (a) => a.a === 'tacle' && a.genre === 'glisse', (a) => a.c],
  ['duel_aerien', 'Duel aérien', (a) => a.a === 'duel_aerien', (a) => a.c],
  ['touche', 'Touche', (a) => a.a === 'touche' && a.cpa === 'throw', (a) => a.c],
  ['controle_haut', 'Contrôle de la poitrine', (a) => a.a === 'controle' && a.haut, (a) => a.c]
];

function decouper(doc, t, avant = 4, apres = 5) {
  const D = doc.images.donnees;
  const debut = Math.max(D[0][0] / 10, t - avant), fin = Math.min(D[D.length - 1][0] / 10, t + apres);
  const donnees = D.filter((r) => r[0] / 10 >= debut - 1e-9 && r[0] / 10 <= fin + 1e-9);
  const actions = doc.actions.filter((a) => (a.t >= debut - 1e-9 && a.t <= fin + 1e-9) || (a.a === 'remplacement' && a.t < debut));
  const evenements = doc.evenements.filter((e) => e.t >= debut - 1e-9 && e.t <= fin + 1e-9);
  const s = Object.assign({}, doc, {
    match: Object.assign({}, doc.match, { debut: donnees[0][0] / 10, fin: donnees[donnees.length - 1][0] / 10 }),
    images: { champs: doc.images.champs, donnees }, actions, evenements, decisions: (doc.decisions || []).filter((d) => d.t >= debut - 1e-9 && d.t <= fin + 1e-9)
  });
  delete s.resultat;
  return s;
}

fs.mkdirSync(SORTIE, { recursive: true });
const trouves = {};
for (let g = Number(depart); g < Number(depart) + Number(combien) && Object.keys(trouves).length < RECHERCHES.length; g++) {
  const doc = nouveauClub().matchPont(ADV, { seed: g, debug: true }).document;
  for (const [id, titre, test, focus] of RECHERCHES) {
    if (trouves[id]) continue;
    // une action au milieu du match, loin des mi-temps (la fenêtre doit être entière)
    const a = doc.actions.find((x) => test(x) && x.t > 60 && x.t < doc.images.donnees[doc.images.donnees.length - 1][0] / 10 - 60);
    if (!a) continue;
    const s = decouper(doc, a.t);
    s.scene = { id, titre, focus: focus(a), instant: Math.round(a.t * 10) / 10, t0: s.match.debut, t1: s.match.fin,
      source: { graine: g, reglage: 'tacleurs (MUR)' }, action: a };
    fs.writeFileSync(path.join(SORTIE, id + '.json'), JSON.stringify(s));
    trouves[id] = { fichier: id + '.json', titre, graine: g, instant: s.scene.instant, focus: s.scene.focus, action: a.a + (a.genre ? '/' + a.genre : '') };
    console.log(`${id.padEnd(14)} match ${g}, ${s.scene.instant} s, joueur ${s.scene.focus}`);
  }
}
fs.writeFileSync(path.join(SORTIE, 'index.json'), JSON.stringify({ format: 'linkfoot-scenes-labo', version: 1, scenes: trouves }, null, 1));
const manquent = RECHERCHES.filter(([id]) => !trouves[id]).map(([id]) => id);
if (manquent.length) console.log('non trouvés :', manquent.join(', '));
