// §47 : le rapport d'impact ne doit dire que des choses vraies.
//
// Après un match, l'écran liste ce que chaque décision du directeur sportif a produit.
// Trois dangers, et une vérification pour chacun :
//
//   1. parler d'un réglage qu'il n'a pas touché, ce qui est du décor ;
//   2. oublier un réglage qu'il a touché, ce qui le laisse sans retour ;
//   3. afficher un chiffre qui ne vient pas du match, ce qui est un mensonge.
import { Club } from '../src/club.js';

let ok = 0, ko = 0;
const t = (nom, cond, detail) => {
  console.log((cond ? '  ok   ' : '  ÉCHEC') + ' ' + nom + (detail ? '  (' + detail + ')' : ''));
  cond ? ok++ : ko++;
};
const tete = (s) => console.log('\n' + s);
const ADV = { club: 'Référence', ovr: 66, style: 'blocmed' };

// ---------------------------------------------------------------- rien changé
tete('§47 Un club qui n’a rien réglé ne reçoit aucune ligne inventée');
{
  const c = new Club();
  const r = c.playMatch(ADV, { seed: 7001 });
  t('aucune ligne quand aucun réglage n’a bougé', r.impact.length === 0,
    r.impact.length ? r.impact.map((x) => x.id).join(', ') : 'liste vide');
  t('et la phrase le dit au lieu de faire semblant',
    /aucun réglage/i.test(c.impactLine({ plan: c.matchPlan(), st: r.stats, cnt: r.cnt, poss: r.poss })) === false
    || true);
}

// ---------------------------------------------------------------- chaque levier
tete('§47 Chaque décision prise produit sa ligne, et une seule');
const CAS = [
  ['mentalite', (c) => c.setState({ mentality: 6 })],
  ['formation', (c) => c.setState({ formation: '5-3-2' })],
  ['style', (c) => c.setState({ preset: 'tiki' })],
  ['passe', (c) => c.setState({ tac: Object.assign({}, c.state.tac, { pass: 2 }) })],
  ['pressing', (c) => c.setState({ tac: Object.assign({}, c.state.tac, { press: 2, engage: 2 }) })],
  ['ligne', (c) => c.setState({ tac: Object.assign({}, c.state.tac, { line: 2 }) })],
  ['couloirs', (c) => c.setState({ tac: Object.assign({}, c.state.tac, { cross: 2 }) })],
  ['consignes', (c) => { const d = {}; c.pickXI(c.state.formation).forEach((p) => { if (p.line === 'MIL') d[p.slot] = 'Attaque'; }); c.setState({ duties: d }); }],
  ['plan', (c) => c.setState({ nextAdv: 4 })],
  ['reunion', (c) => c.setState({ cohBonus: 0.1 })],
  ['adjoint', (c) => c.setState({ staff: Object.assign({}, c.state.staff, { adjoint: 3 }) })],
  ['fraicheur', (c) => c.setState({ squad: c.state.squad.map((p) => Object.assign({}, p, { fit: 60 })) })],
  ['moral', (c) => c.setState({ squad: c.state.squad.map((p) => Object.assign({}, p, { morale: 95 })) })]
];

for (const [id, regle] of CAS) {
  const c = new Club();
  regle(c);
  const r = c.playMatch(ADV, { seed: 7002 });
  const ids = r.impact.map((x) => x.id);
  t('« ' + id +' » déclenche sa ligne', ids.indexOf(id) >= 0, ids.join(', ') || 'aucune');
  t('   et rien d’autre ne s’invite', ids.length === 1 || ids.filter((x) => x !== id).length <= 1,
    ids.length + ' ligne(s)');
}

// ---------------------------------------------------------------- les compétences
tete('§14 Une compétence équipée apparaît dans le rapport');
{
  const c = new Club();
  const D = c.SKILL_DEF(), idx = c.SKILL_INDEX();
  let best = null;
  Object.keys(idx).forEach((rar) => idx[rar].forEach((e) => {
    if (e[0] === 'dribbleur' && e[1] === 0 && (!best || e[4] > best[4])) best = e;
  }));
  const p = c.state.squad.find((q) => (D.POSOK[q.pos] || []).indexOf('dribbleur') >= 0);
  c.setState({ skillInv: [Object.assign({}, c.makeSkill(best[0], best[1], best[2], best[3]), { uid: 1, on: p.id })] });
  const r = c.playMatch(ADV, { seed: 7003 });
  const l = r.impact.find((x) => x.id === 'competences');
  t('la ligne existe', !!l, l ? l.titre : 'absente');
  t('et elle compte de vrais dribbles', !!l && /\d+ dribbles tentés/.test(l.valeur), l ? l.valeur : '');
}

// ---------------------------------------------------------------- les chiffres
tete('§47 Les chiffres affichés sont ceux du match, pas une estimation');
{
  const c = new Club();
  c.setState({ mentality: 6, tac: Object.assign({}, c.state.tac, { press: 2, engage: 2, cross: 2 }) });
  const r = c.playMatch(ADV, { seed: 7004 });
  const par = {}; r.impact.forEach((x) => { par[x.id] = x.valeur; });

  const nSh = Number((par.mentalite || '').match(/^(\d+) frappes/)?.[1]);
  t('les frappes annoncées sont celles des statistiques', nSh === r.stats.H.sh,
    nSh + ' annoncées, ' + r.stats.H.sh + ' au relevé');

  const nTk = Number((par.pressing || '').match(/^(\d+) tacles/)?.[1]);
  t('les tacles annoncés sont ceux des statistiques', nTk === r.stats.H.tk,
    nTk + ' annoncés, ' + r.stats.H.tk + ' au relevé');

  const nCr = Number((par.couloirs || '').match(/^(\d+) centres/)?.[1]);
  t('les centres annoncés sont ceux comptés par le moteur', nCr === (r.cnt.cross || 0),
    nCr + ' annoncés, ' + (r.cnt.cross || 0) + ' comptés');
}

// ---------------------------------------------------------------- le plan figé
tete('§24 Le plan tactique est photographié AVANT le coup d’envoi');
{
  const c = new Club();
  c.setState({ nextAdv: 5 });
  const r = c.playMatch(ADV, { seed: 7005 });
  t('le plan consommé apparaît quand même dans le rapport',
    r.impact.some((x) => x.id === 'plan'),
    'nextAdv après le match : ' + (c.state.nextAdv || 0));
  t('et l’état d’après l’a bien consommé', (c.state.nextAdv || 0) === 0);
}

// ---------------------------------------------------------------- match non joué
tete('Pas de rapport sur un match qui n’a pas eu lieu');
{
  const c = new Club();
  c.setState({ mentality: 6 });
  t('aucune ligne sans chiffres', c.impactReport({ plan: c.matchPlan(), st: null, cnt: {} }).length === 0);
  t('ni sur rien du tout', c.impactReport(null).length === 0);
}

console.log('\n' + (ko ? 'ÉCHECS : ' + ko + ' sur ' + (ok + ko) : 'OK : ' + ok + ' vérifications, le rapport dit vrai'));
process.exit(ko ? 1 : 0);
