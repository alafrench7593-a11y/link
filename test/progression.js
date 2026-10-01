// Garde-fou de cohérence : une seule échelle de raretés, un seul axe de niveaux.
// Ce test échoue dès qu'une partie du jeu repart sur sa propre échelle.
import { Club } from '../src/club.js';

let fails = 0;
const ok = (cond, label) => { console.log((cond ? '  ok   ' : '  ÉCHEC') + ' ' + label); if (!cond) fails++; };

const c = new Club();

console.log('raretés');
const R = c.RARITY(), ids = R.map((x) => x.id);
ok(R.length === 7, '7 raretés');
ok(Math.abs(R.reduce((a, x) => a + x.rate, 0) - 1) < 1e-9, 'les taux font 100 %');
ok(R.every((x, i) => i === 0 || (x.lo > R[i - 1].lo && x.rate < R[i - 1].rate)), 'notes croissantes, taux décroissants');
const SR = c.SKILL_DEF().RAR;
ok(SR.length === R.length && SR.every((r, i) => r[0] === ids[i] && r[1] === R[i].label), 'les compétences utilisent la même échelle que les cartes');
ok(SR.every((r, i) => i === 0 || r[2] > SR[i - 1][2]), 'la puissance d’une compétence monte avec sa rareté');

console.log('catalogue');
const pool = c.CARD_POOL();
ok(pool.length === 500, '500 cartes');
ok(ids.every((id) => pool.some((x) => x.rar === id)), 'chaque rareté existe dans le catalogue');
ok(pool.every((x) => { const r = c.rarityOf(x.rar); return x.ovr >= r.lo && x.ovr <= r.hi; }), 'chaque note tient dans sa fourchette');

console.log('packs');
const packs = c.PACK_DEFS();
ok(packs.every((d) => typeof d.req === 'number'), 'chaque pack a un palier de niveau');
ok(packs.every((d) => Object.keys(d.w || {}).every((k) => ids.indexOf(k) >= 0)), 'aucun pack ne pondère une rareté inconnue');
ok(packs.every((d) => Math.abs(c.packOdds(d).reduce((a, x) => a + x.pct, 0) - 100) < 1e-6), 'les probabilités affichées font 100 %');
// toutes les clés de packs offerts du jeu doivent exister : c'est le bug qui rendait
// les packs gratuits impossibles à ouvrir.
['basic', 'premium', 'elite', 'gold', 'special'].forEach((k) => ok(c.packByKey(k).key === k, 'pack offert « ' + k +' » existe'));
c.setState({ xp: 0, level: 1 });
const L = c.addXp(c.state, 100000);
ok(L.freeQueue.every((k) => packs.some((d) => d.key === k)), 'tous les packs offerts par les niveaux existent');

console.log('paliers');
const G = c.GATES();
['card', 'staff', 'stade', 'academy'].forEach((k) => ok(G[k].every((v, i) => i === 0 || v >= G[k][i - 1]), 'paliers ' + k + ' croissants'));
ok(G.card.length === 6 && G.staff.length === 4 && G.stade.length === c.STADES().length && G.academy.length === c.ACADEMIES().length, 'un palier par niveau existant');
ok(packs.every((d) => d.req === G.pack[d.key]), 'le palier d’un pack est celui de la table');

console.log('tableau de progression');
c.setState({ level: 1, balance: 0, shards: 0 });
const board = c.progressBoard();
ok(board.length >= 9, 'toutes les pistes sont là (' + board.length + ')');
ok(board.every((t) => t.label && typeof t.lvl === 'number' && typeof t.max === 'number'), 'même forme pour toutes les pistes');
ok(board.filter((t) => t.currency === 'tokens').every((t) => !t.can && t.why), 'sans jetons, chaque piste dit pourquoi elle refuse');
ok(board.every((t) => c.trackLine(t).length > 0), 'chaque piste a une phrase lisible');

console.log('refus');
ok(c.upgradeStade().ok === false, 'le stade refuse sans jetons');
ok(typeof c.hireStaff('adjoint').why === 'string', 'le staff dit pourquoi il refuse');
c.setState({ level: 1, balance: 99999 });
ok(c.gateOf('stade', 1) === 3 && c.upgradeStade().why.indexOf('Niveau de club 3') === 0, 'le stade reste fermé tant que le niveau de club est trop bas');
c.setState({ level: 20, balance: 99999, shards: 99999 });
ok(c.upgradeStade().ok === true, 'au bon niveau et avec les jetons, le stade monte');
ok(c.packState(packs.find((d) => d.key === 'gold')).can === true, 'le Pack Or s’ouvre au niveau 20');

console.log('cartes et compétences');
const p = c.state.squad[0];
const inf = c.upgradeInfo(p);
ok(inf.rarLabel === c.rarityFor(p).label, 'la carte affiche la rareté de son joueur');
ok(inf.cost >= c.UPGRADE_COST()[inf.lvl], 'une carte rare coûte plus cher à monter');
ok(c.state.squad.every((q) => c.skillsOf(q).every((k) => {
  const ri = ids.indexOf(k.rar), ci = ids.indexOf(c.rarityFor(q).id);
  return ri >= 0 && ri <= ci;
})), 'aucune compétence plus rare que la carte qui la porte');

console.log(fails ? '\nÉCHEC : ' + fails + ' vérification(s)' : '\nOK : la progression est cohérente');
process.exit(fails ? 1 : 0);
