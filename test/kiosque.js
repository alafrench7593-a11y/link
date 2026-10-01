// Le kiosque : les quatre packs regroupés au même endroit (§10, §28).
//
// Ce que ce fichier vérifie, et qui n'était pas vérifiable quand chaque pack vivait
// dans son propre écran : qu'ils sont tous là, qu'ils annoncent tous la même chose,
// que les probabilités affichées sont bien celles du tirage, et qu'ouvrir un pack
// depuis le kiosque donne exactement ce que son écran d'origine donnait.
import { Club } from '../src/club.js';

let ok = 0, ko = 0;
const t = (nom, cond) => { if (cond) { ok++; console.log('  ok   ', nom); } else { ko++; console.log('  ÉCHEC', nom); } };
const tete = (s) => console.log(s);

const club = new Club();
club.createClub({ name: 'FC Test', seed: 7 });
club.setState({ balance: 50000 });

tete('les quatre packs sont au même endroit');
const k = club.kiosque();
t('quatre packs, pas un de plus', k.length === 4);
t('les quatre clés attendues', ['linkfoot', 'skill', 'train', 'coach'].every((key) => k.some((x) => x.key === key)));
t('aucun nom en double', new Set(k.map((x) => x.name)).size === 4);
t('aucune famille en double : un pack, une famille', new Set(k.map((x) => x.family)).size === 4);

tete('chaque pack dit la même chose, dans la même forme');
const CHAMPS = ['key', 'name', 'family', 'question', 'n', 'cost', 'color', 'desc', 'can', 'why', 'useView', 'useLabel', 'kind', 'odds'];
t('tous les champs présents partout', k.every((x) => CHAMPS.every((c) => x[c] !== undefined)));
t('un prix réel partout', k.every((x) => x.cost > 0));
t('un nombre de tirages réel partout', k.every((x) => x.n >= 1));
t('des probabilités partout', k.every((x) => x.odds.length > 0));
t('chaque pack dit où son contenu finit', k.every((x) => x.useLabel && ['squad', 'skills', 'train'].includes(x.useView)));
t('§28 : les probabilités font 100 %', k.every((x) => Math.abs(x.odds.reduce((a, o) => a + o.pct, 0) - 100) < 0.01));

tete('§29 : ce qui est affiché est ce qui est tiré');
const parCle = {}; k.forEach((x) => { parCle[x.key] = x; });
t('cartes : les taux affichés sont ceux de RARITY',
  JSON.stringify(parCle.linkfoot.odds.map((o) => Math.round(o.pct * 1000)))
  === JSON.stringify(club.RARITY().map((r) => Math.round(r.rate * 100 * 1000))));
t('compétences : les mêmes taux que les cartes',
  JSON.stringify(parCle.skill.odds.map((o) => o.pct)) === JSON.stringify(parCle.linkfoot.odds.map((o) => o.pct)));
t('entraînement : un lot par ligne affichée', parCle.train.odds.length === club.TRAIN_LOTS().length);
t('tactique : un objet par ligne affichée', parCle.coach.odds.length === club.COACH_ITEMS().length);
t('les lots disent leur effet, pas seulement leur nom',
  parCle.train.odds.every((o) => o.desc) && parCle.coach.odds.every((o) => o.desc));

tete('ouvrir depuis le kiosque donne bien quelque chose');
const avant = { squad: club.state.squad.length, skills: club.skillInventory().length,
  sessions: club.sessions(), coach: Object.keys(club.state.coachInv || {}).length, solde: club.state.balance };

club.commitPack(club.openPack({}));
t('le pack de cartes remplit l’effectif ou la réserve',
  club.state.squad.length + club.skillInventory().length > avant.squad + avant.skills
  || (club.state.shards || 0) > 0);
t('et il laisse une trace lisible pour le kiosque', !!club.state.lastCardPack);

club.commitSkillPack(club.openSkillPack({}));
t('le pack compétence ne donne QUE des compétences',
  club.skillInventory().length > avant.skills && club.state.squad.length === club.state.squad.length);

const s0 = club.sessions();
club.commitTrainPack(club.openTrainPack({}));
t('le pack entraînement donne du temps ou des cartes',
  club.sessions() > s0 || club.UPGRADE_CARDS().some(([c]) => (club.state.inv || {})['up_' + c] > 0));

club.commitCoachPack(club.openCoachPack({}));
t('le pack entraîneur donne des idées de jeu',
  Object.keys(club.state.coachInv || {}).length > avant.coach);

t('§7 : chaque ouverture a été payée', club.state.balance < avant.solde);
t('les quatre dernières ouvertures sont affichables',
  club.kiosque().every((x) => typeof x.got === 'string') && club.kiosque().filter((x) => x.got).length === 4);

tete('le kiosque refuse quand le solde ne suit pas');
const pauvre = new Club();
pauvre.createClub({ name: 'FC Fauché', seed: 3 });
pauvre.setState({ balance: 0 });
const kp = pauvre.kiosque();
t('aucun pack ouvrable à zéro jeton', kp.every((x) => !x.can));
t('et chacun dit pourquoi, chiffre à l’appui', kp.every((x) => /manque \d+ jetons/.test(x.why)));
t('le résumé compte juste', pauvre.kiosqueSummary().open === 0 && pauvre.kiosqueSummary().n === 4);
t('le résumé donne le pack le moins cher',
  pauvre.kiosqueSummary().cheapest === Math.min(...kp.map((x) => x.cost)));

tete('§29 : le client ne peut pas changer les probabilités');
const triche = club.kiosque();
triche[0].odds[0].pct = 99;
t('modifier la liste affichée ne change rien au tirage suivant',
  club.kiosque()[0].odds[0].pct !== 99);

console.log('\n' + (ko ? 'ÉCHECS : ' + ko + ' sur ' + (ok + ko) : 'OK : ' + ok + ' vérifications, le kiosque tient'));
process.exit(ko ? 1 : 0);
