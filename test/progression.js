// Garde-fou de cohérence du jeu de directeur sportif.
// Il échoue dès qu'une partie du jeu repart sur sa propre échelle, ou qu'un système
// cesse d'être connecté aux autres (§19, §31).
import { Club } from '../src/club.js';

let fails = 0;
const ok = (cond, label) => { console.log((cond ? '  ok   ' : '  ÉCHEC') + ' ' + label); if (!cond) fails++; };
const c = new Club();

console.log('§11 raretés et taux');
const R = c.RARITY(), ids = R.map((x) => x.id);
ok(R.length === 6, '6 raretés');
ok(ids.join(',') === 'normal,rare,epic,elite,gold,legendary', 'Normal, Rare, Épique, Élite, Gold, Legendary');
ok(Math.abs(R.reduce((a, x) => a + x.rate, 0) - 1) < 1e-9, 'les taux font 100 %');
const want = [0.70, 0.20, 0.07, 0.02, 0.009, 0.001];
ok(R.every((x, i) => Math.abs(x.rate - want[i]) < 1e-9), 'les taux sont exactement ceux du cahier des charges');
ok(R.every((x, i) => i === 0 || (x.rate < R[i - 1].rate && x.pw[0] > R[i - 1].pw[0])), 'plus c’est puissant, plus c’est rare');
ok(R[4].rate <= 0.01 && R[5].rate <= 0.001, '§18 : Gold sous 1 %, Legendary à 0,1 %');

console.log('§10 pack unique');
const packs = c.PACK_DEFS();
ok(packs.length === 1, 'un seul pack');
ok(c.THE_PACK().key === 'linkfoot', 'c’est le LinkFoot Pack');
ok(Math.abs(c.packOdds(c.THE_PACK()).reduce((a, x) => a + x.pct, 0) - 100) < 1e-6, '§11 : les probabilités affichées font 100 %');
ok(c.packOdds(c.THE_PACK()).every((o, i) => Math.abs(o.pct - want[i] * 100) < 1e-6), 'les probabilités affichées sont celles du système');

console.log('§12 et §17 catalogue de compétences');
ok(c.skillCount() > 10000, 'plus de 10 000 combinaisons (' + c.skillCount() + ')');
const idx = c.SKILL_INDEX();
ok(ids.every((id) => idx[id].length > 0), 'chaque rareté a des combinaisons');
ok(ids.every((id, i) => i === 0 || idx[id].length <= idx[ids[i - 1]].length), 'moins de combinaisons à mesure que la rareté monte');
ok(ids.every((id) => { const b = R.find((x) => x.id === id).pw; return idx[id].every((e) => e[4] >= b[0] && e[4] <= b[1]); }),
  '§17 : la rareté découle de la puissance, jamais l’inverse');
const sk = {}; ids.forEach((id) => { sk[id] = c.rollSkill(id); });
ok(ids.every((id) => sk[id].rar === id), 'un tirage d’une rareté rend bien une compétence de cette rareté');
ok(sk.legendary.power > sk.gold.power && sk.gold.power > sk.elite.power && sk.elite.power > sk.epic.power, 'la puissance monte avec la rareté');
ok(Object.keys(sk.legendary.eff).length > 0, '§14 : une compétence porte un effet réel, jamais décoratif');

console.log('§15 compatibilité');
ok(ids.every((id) => sk[id].req.pos.length > 0), 'chaque compétence nomme ses postes compatibles');
ok(sk.legendary.req.lvl > sk.normal.req.lvl, 'une compétence forte exige un joueur de plus haut niveau');
c.createClub({ name: 'FC Test', seed: 1234 });
const weak = c.state.squad.find((p) => p.ovr <= 52 && p.pos !== 'GB');
const bad = c.canEquip(weak, sk.legendary);
ok(bad.ok === false && bad.why.length > 0, 'un joueur faible ne peut pas porter une compétence Legendary, et on dit pourquoi');

console.log('§2, §3, §4 création du club');
const sum = c.creationSummary();
ok(c.state.squad.length === 15, '14 joueurs normaux plus le joueur rare offert');
ok(sum.rare && sum.rare.ovr >= 66 && sum.rare.ovr <= 70, '§3 : le joueur rare est utile sans décider des matchs (' + (sum.rare || {}).ovr + ')');
ok(sum.rare.potential > sum.rare.ovr + 10, 'il a un potentiel supérieur');
ok(sum.rare.skill, 'il arrive avec une compétence spéciale');
ok(sum.avg <= 58, '§4 : le reste de l’effectif est faible au départ (note moyenne ' + sum.avg + ')');
ok(sum.pot >= 68, 'mais possède un vrai potentiel (potentiel moyen ' + sum.pot + ')');
ok(c.state.balance <= 700, '§7 : on commence avec peu');

console.log('§6 niveau de joueur');
ok(c.playerXpNeed(1) === 60, 'niveau 1 → 2 facile');
ok(c.playerXpNeed(10) > c.playerXpNeed(5) * 2, 'niveau 10 nettement plus cher que niveau 5');
ok(c.playerXpNeed(20) > c.playerXpNeed(10) * 4, 'niveau 20 très difficile');
ok(c.playerXpNeed(30) > c.playerXpNeed(20) * 4, 'niveau 30 extrêmement difficile');
const rich = new Club();
rich.createClub({ name: 'FC Riche', seed: 99 });
rich.setState({ balance: 1000000, shards: 1000000 });
const p0 = rich.state.squad[3], ovr0 = p0.ovr;
for (let i = 0; i < 40; i++) rich.shardTrain(p0.id);
const p1 = rich.state.squad.find((x) => x.id === p0.id);
ok(rich.playerLevel(p1) <= 6, '§6 : l’argent seul ne fait pas une superstar (niveau ' + rich.playerLevel(p1) + ' avec un million)');
ok(p1.ovr - ovr0 <= 6, 'la note gagnée par l’argent seul reste faible (+' + (p1.ovr - ovr0) + ')');

console.log('§5 attributs cachés');
const h = c.hiddenOf(c.state.squad[0]);
['potReel', 'regularite', 'grandsMatchs', 'pression', 'progression', 'blessure', 'adaptation'].forEach((k) => ok(typeof h[k] === 'number', 'attribut caché ' + k));
const m1 = c.hiddenMods(c.state.squad[0], { closeLate: true }), m2 = c.hiddenMods(c.state.squad[0], {});
ok(m1.dec !== m2.dec, '§19 : les attributs cachés changent vraiment le joueur selon le contexte');

console.log('§19 pack → inventaire → joueur → match');
const pk = c.openPack({ free: true });
ok(pk.ok && pk.got.length === c.THE_PACK().n, 'le pack rend bien ' + c.THE_PACK().n + ' lots');
ok(pk.got.every((g) => ['player', 'skill', 'objet', 'shards'].indexOf(g.kind) >= 0), 'chaque lot est un joueur, une compétence, un objet ou des fragments');
const tout = () => c.state.skillInv.length + c.state.squad.length + (c.state.shards || 0) + (c.state.sessions || 0)
  + Object.values(c.state.inv || {}).reduce((a, v) => a + v, 0) + Object.values(c.state.coachInv || {}).reduce((a, v) => a + v, 0);
const avantPack = tout();
c.commitPack(pk);
ok(tout() > avantPack, 'le contenu du pack arrive dans l’effectif, l’inventaire, l’entraînement ou les fragments');
// la compétence Normal la plus modeste du catalogue doit être portable par un effectif de départ
const weakest = c.SKILL_INDEX().normal.slice().sort((a, b2) => a[4] - b2[4])[0];
const starter = c.makeSkill(weakest[0], weakest[1], weakest[2], weakest[3]);
c.setState({ skillInv: c.state.skillInv.concat([Object.assign({}, starter, { uid: 9001, on: null })]) });
const target = c.state.squad.find((p) => c.canEquip(p, c.state.skillInv.find((k) => k.uid === 9001)).ok);
ok(!!target, '§27 : un effectif de départ peut porter la compétence la plus modeste du jeu');
if (target) {
  const before = c.skillsOf(target).length;
  ok(c.equipSkill(9001, target.id).ok, 'une compétence s’équipe sur un joueur compatible');
  ok(c.skillsOf(target).length === before + 1, 'le moteur voit immédiatement la compétence équipée');
  ok(c.unequipSkill(9001).ok, 'et se retire');
} else { ok(false, 'aucun joueur compatible avec une compétence Normal'); }
const gbId = (c.state.squad.find((p) => p.pos === 'GB') || {}).id;
const inc = c.equipSkill(9001, gbId);
ok(inc.ok === false && inc.why.indexOf('COMPÉTENCE INCOMPATIBLE') === 0, '§15 : une compétence incompatible est refusée et nommée');

console.log('§6 et §10 entraînement limité, Pack Entraînement');
const tc = new Club(); tc.createClub({ name: 'FC Entrain', seed: 77 });
const t0 = tc.trainInfo();
ok(t0.sessions > 0 && t0.can, 'on démarre avec quelques séances', t0.line);
let nSeances = 0;
while (tc.train('technique').ok && nSeances < 40) nSeances++;
ok(nSeances === t0.sessions, 'chaque séance consomme une séance en stock', nSeances + ' séances lancées');
const refus = tc.train('technique');
ok(refus.ok === false && /Pack Entraînement/.test(refus.why), '§6 : à court de séances, le refus dit où en trouver', refus.why);
const lots = tc.TRAIN_LOTS();
ok(Math.abs(lots.reduce((a, x) => a + x.rate, 0) - 1) < 1e-9, '§11 : les taux du Pack Entraînement font 100 %');
ok(lots.every((x) => ids.indexOf(x.rar) >= 0), 'ses lots utilisent les mêmes raretés que le reste du jeu');
ok(lots.every((x, i) => i === 0 || x.rate <= lots[i - 1].rate), 'plus le lot est fort, plus il est rare',
  lots.map((x) => (x.rate * 100).toFixed(1) + ' %').join(' · '));
ok(tc.TRAIN_PACK().key === 'train' && tc.THE_PACK().key === 'linkfoot',
  '§10 : le pack de cartes et le pack d’entraînement restent deux objets distincts');
ok(lots.every((x) => !x.player && !x.skill), 'le Pack Entraînement ne contient ni joueur ni compétence');
tc.setState({ balance: 2000 });
const avant = tc.sessions(), pk2 = tc.openTrainPack({});
ok(pk2.ok && pk2.got.length === 3, 'il s’ouvre et rend 3 lots', pk2.got.map((g) => g.label).join(', '));
const got2 = tc.commitTrainPack(pk2);
ok(tc.sessions() >= avant, 'ce qu’il donne arrive dans le stock', avant + ' → ' + tc.sessions() + ' séances');
ok(tc.state.balance === 2000 - tc.TRAIN_PACK().cost, 'et il est payé', tc.state.balance + ' jetons');
tc.setState({ balance: 0 });
ok(tc.openTrainPack({}).ok === false, 'sans jetons, il refuse');
ok(tc.sessions() <= tc.SESSION_RULES().max, '§29 : on ne peut pas empiler les séances sans limite',
  tc.sessions() + ' sur ' + tc.SESSION_RULES().max);
const anyCard = tc.UPGRADE_CARDS()[0][0];
tc.setState({ inv: Object.assign({}, tc.state.inv, { ['up_' + anyCard]: 1 }) });
const pU = tc.state.squad.find((p) => p.pos !== 'GB');
const ovrAvant = pU.ovr;
const u = tc.useUpgrade(pU.id, anyCard);
ok(u.ok, 'une carte d’amélioration s’utilise sur un joueur', anyCard + ' : note ' + ovrAvant + ' → ' + u.ovr);
ok(tc.useUpgrade(pU.id, anyCard).ok === false, 'et elle est bien consommée');

console.log('§10 les quatre packs, une famille chacun');
const reg = tc.PACK_REGISTRY();
ok(reg.length === 4, 'quatre packs', reg.map((r) => r.name).join(' · '));
ok(new Set(reg.map((r) => r.family)).size === 4 && reg.filter((r) => r.principal).length === 1 && reg[0].family === 'tout',
  'un pack principal qui donne tout, et trois packs ciblés d’une famille chacun', reg.map((r) => r.family).join(', '));
ok(new Set(reg.map((r) => r.key)).size === 4, 'chacun a sa propre clé');
tc.setState({ balance: 5000, skillInv: [], coachInv: {} });
const sp2 = tc.openSkillPack({});
ok(sp2.ok && sp2.got.every((g) => g.kind === 'skill'), 'le Pack Compétence ne donne QUE des compétences',
  sp2.got.map((g) => g.label).join(', '));
tc.commitSkillPack(sp2);
ok(tc.state.skillInv.length === sp2.got.length, 'elles arrivent dans l’inventaire');
ok(Math.abs(tc.skillPackOdds().reduce((a, x) => a + x.pct, 0) - 100) < 1e-6, 'ses probabilités font 100 %');
const ci = tc.COACH_ITEMS();
ok(Math.abs(ci.reduce((a, x) => a + x.rate, 0) - 1) < 1e-9, 'les taux du Pack Entraîneur font 100 %');
ok(ci.every((x) => !x.player && !x.skill && !x.sessions), 'il ne donne ni joueur, ni compétence, ni séance');
const cp2 = tc.openCoachPack({});
ok(cp2.ok && cp2.got.length === 2, 'il s’ouvre', cp2.got.map((g) => g.label).join(', '));
tc.commitCoachPack(cp2);
ok(Object.keys(tc.state.coachInv).length > 0, 'son contenu arrive en réserve', JSON.stringify(tc.state.coachInv));

console.log('§24 réunion d’équipe et plan tactique');
tc.setState({ coachInv: { causerie: 1, reunion: 1, plan: 1 }, cohBonus: 0 });
const moAv = Math.round(tc.state.squad.reduce((a, p) => a + tc.profile(p).morale, 0) / tc.state.squad.length);
const hm = tc.holdMeeting('causerie');
const moAp = Math.round(tc.state.squad.reduce((a, p) => a + tc.profile(p).morale, 0) / tc.state.squad.length);
ok(hm.ok && moAp > moAv, 'une causerie remonte vraiment le moral', moAv + ' → ' + moAp);
ok(tc.holdMeeting('causerie').ok === false, 'et elle est consommée');
const hr = tc.holdMeeting('reunion');
ok(hr.ok && tc.state.cohBonus > 0, 'une réunion de groupe améliore la cohésion', Math.round(tc.state.cohBonus * 100) + ' %');
const up = tc.usePlan('gegen');
ok(up.ok && tc.state.nextAdv === 2, 'un plan tactique donne un avantage pour le match suivant', 'avantage ' + tc.state.nextAdv);
ok(tc.state.preset === 'gegen', 'et applique vraiment le style préparé');
tc.playMatch({ club: 'Adversaire', ovr: 60, style: 'tiki' }, { seed: 2 });
ok(tc.state.nextAdv === 0, 'l’avantage ne vaut que pour ce match');
ok(tc.usePlan('tiki').ok === false, 'sans plan en réserve, on ne prépare rien');

console.log('§19 l’entraînement suit ce qu’on possède');
tc.setState({ sessions: 0, caps: { day: tc.dayKey() }, inv: { up_VIT: 1 } });
const opts = tc.trainingOptions();
const sq = opts.filter((o) => o.kind === 'squad'), cd = opts.filter((o) => o.kind === 'card');
ok(sq.length && sq.every((o) => !o.can), 'sans séance, les séances collectives sont refusées');
ok(cd.length === 1 && cd[0].can, 'mais la carte en réserve reste utilisable', cd[0].label);
ok(sq[0].why.length > 0 && cd[0].cost.indexOf('carte') >= 0, 'chaque ligne dit ce qu’elle coûte ou ce qui manque');
tc.setState({ inv: {} });
ok(tc.trainingOptions().filter((o) => o.kind === 'card').length === 0, 'une carte utilisée disparaît de la liste');

console.log('§7 et §29 économie encadrée');
const c2 = new Club(); c2.createClub({ name: 'FC Eco', seed: 5 });
let total = 0;
for (let i = 0; i < 40; i++) total += c2.earn(500, 'quest', 'test').given;
ok(total <= c2.CAPS().quest, '§29 : aucune source ne peut produire une quantité infinie (' + total + ' sur ' + c2.CAPS().quest + ' autorisés)');
ok(c2.earn(500, 'quest').given === 0, 'une fois le plafond atteint, la source ne rend plus rien');
ok(c2.state.ledger.length > 0, 'chaque mouvement est écrit dans le journal');
ok(c2.spend(1e9, 'test').ok === false, 'une dépense trop grosse est refusée et dit pourquoi');

console.log('§8 quêtes');
const qs = c2.activeQuests();
ok(qs.length === 4, '4 quêtes actives');
ok(qs.every((q) => q.goal > 0 && q.reward > 0 && q.kind), 'chaque quête a un objectif, une clé et une récompense');
ok(c2.claimQuest(qs[0].id).ok === false, 'une quête non terminée ne se récupère pas');
c2.bumpQuest(qs[0].kind, qs[0].goal);
ok(c2.activeQuests().find((q) => q.id === qs[0].id).prog >= qs[0].goal, 'le jeu fait avancer la quête');

console.log('§22 le match reste automatique');
ok(typeof c.setHuman !== 'function' && typeof c.humanAct !== 'function', 'aucune prise de contrôle directe d’un joueur');
const r = c2.playMatch({ club: 'Adversaire', ovr: 58, style: 'direct' }, { seed: 3 });
ok(r.score.length === 2 && r.log.length > 0, 'un match se joue tout seul et produit un rapport');
ok(c2.state.ledger.some((l) => /Match/.test(l.l)), 'le match écrit sa ligne dans le journal');
ok(c2.state.squad.some((p) => c2.playerXp(p) > 0 || c2.playerLevel(p) > 1), '§19 : jouer fait progresser les joueurs');

console.log('tableau de progression');
const board = c.progressBoard();
ok(board.length >= 9, 'toutes les pistes sont là (' + board.length + ')');
ok(board.every((t) => t.label && typeof t.lvl === 'number' && c.trackLine(t).length > 0), 'même forme et une phrase lisible pour chaque piste');
ok(board.some((t) => t.key === 'skills'), 'les compétences sont une piste de progression');

console.log(fails ? '\nÉCHEC : ' + fails + ' vérification(s)' : '\nOK : les systèmes sont connectés');
process.exit(fails ? 1 : 0);
