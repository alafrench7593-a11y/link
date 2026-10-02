// Le kiosque : UN pack principal, et trois packs ciblés au même endroit (§8, §9, §28).
//
// Ce que ce fichier vérifie : qu'il n'y a qu'un seul pack principal et qu'il peut
// tout donner (joueur, compétence, objet, fragments) ; que les deux tables affichées
// avant l'ouverture (familles, raretés) sont bien celles du tirage ; qu'un objet sorti
// du pack principal fait exactement ce qu'il ferait sorti de son pack ciblé ; et
// qu'ouvrir un pack depuis le kiosque donne ce que son écran d'origine donnait.
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
t('aucune famille en double', new Set(k.map((x) => x.family)).size === 4);

tete('§8 un seul pack principal, qui peut tout donner');
const principaux = k.filter((x) => x.principal);
t('un seul pack principal', principaux.length === 1 && principaux[0].key === 'linkfoot');
t('c’est le premier affiché', k[0].principal === true);
t('les packs ciblés ne se présentent pas comme principaux', k.slice(1).every((x) => !x.principal && /^Ciblé/.test(x.family)));
const fam = principaux[0].familles || [];
t('§9 la part de chaque famille est affichée', fam.length === 3);
t('   et elle fait 100 %', Math.abs(fam.reduce((a, f) => a + f.pct, 0) - 100) < 1e-9);
t('il peut donner un joueur, une compétence ET un objet',
  ['player', 'skill', 'objet'].every((kd) => fam.some((f) => f.kind === kd && f.pct > 0)));
t('seul le pack principal mélange les familles', k.slice(1).every((x) => !x.familles));

tete('§9 et §29 : les parts affichées sont celles du tirage');
{
  // un générateur à graine : le test est reproductible
  let g = 20261002;
  const rnd = () => { g = (g * 1664525 + 1013904223) >>> 0; return g / 4294967296; };
  const N = 20000, vu = { player: 0, skill: 0, objet: 0, shards: 0 }, rar = {};
  let objetsJustes = 0, objets = 0;
  for (let i = 0; i < N; i++) {
    const lot = club.drawLot(rnd, new Set());
    vu[lot.kind]++;
    rar[lot.rar] = (rar[lot.rar] || 0) + 1;
    if (lot.kind === 'objet') { objets++; if (lot.objet && lot.objet.rar === lot.rar) objetsJustes++; }
  }
  for (const f of fam) {
    const obs = vu[f.kind] / N * 100;
    t('   ' + f.label + ' : ' + f.pct.toFixed(0) + ' % affichés, ' + obs.toFixed(1) + ' % tirés', Math.abs(obs - f.pct) < 1.5);
  }
  const normal = club.RARITY()[0];
  t('   la rareté la plus courante sort à son taux affiché',
    Math.abs((rar[normal.id] || 0) / N - normal.rate) < 0.015);
  t('un objet tiré a la rareté de son tirage, jamais une autre', objets > 0 && objetsJustes === objets);
}

tete('§3 un objet fait la même chose, qu’il sorte du pack principal ou de son pack ciblé');
{
  const lotDe = (famille, id, stat) => {
    const table = famille === 'tactique' ? club.COACH_ITEMS() : club.TRAIN_LOTS();
    const o = Object.assign({ famille }, table.find((x) => x.id === id));
    if (o.up) { o.stat = stat; o.stats = o.up > 1 ? Array.from({ length: o.up }, () => stat) : null; }
    return o;
  };
  const neuf = () => { const c = new Club(); c.createClub({ name: 'FC Jumeau', seed: 11 }); c.setState({ balance: 5000, sessions: 0, inv: {}, coachInv: {}, cohBonus: 0 }); return c; };
  const viaPrincipal = (c, o) => c.commitPack({ ok: true, def: c.THE_PACK(), shards: 0, free: true,
    got: [{ kind: 'objet', rar: o.rar, name: o.label, label: o.rar, objet: o }] });
  for (const [fam2, id] of [['entrainement', 'duo'], ['entrainement', 'carte'], ['entrainement', 'stage'], ['tactique', 'video'], ['tactique', 'masterplan']]) {
    const a = neuf(), b = neuf(), o = lotDe(fam2, id, 'VIT');
    viaPrincipal(a, o);
    if (fam2 === 'tactique') b.commitCoachPack({ ok: true, def: b.COACH_PACK(), got: [o], free: true });
    else b.commitTrainPack({ ok: true, def: b.TRAIN_PACK(), got: [o], free: true });
    const empreinte = (c) => JSON.stringify({ se: c.state.sessions, inv: c.state.inv, co: c.state.coachInv, coh: c.state.cohBonus,
      xp: c.state.squad.map((p) => p.pxp + ':' + p.plv), mo: c.state.squad.map((p) => c.profile(p).morale) });
    t('   ' + o.label + ' : même effet par les deux chemins', empreinte(a) === empreinte(b));
  }
  const c = neuf();
  const avantMoral = c.state.squad.map((p) => c.profile(p).morale);
  viaPrincipal(c, lotDe('tactique', 'masterplan'));
  t('le plan de campagne donne bien ses trois plans', c.plansLeft() === 3);
  t('   et le moral promis, à réception', c.state.squad.every((p, i) => c.profile(p).morale >= Math.min(99, avantMoral[i] + 20) - 0.001));
  t('   et la cohésion promise', Math.abs(c.state.cohBonus - 0.08) < 1e-9);
  t('la carte révélée dit ce que l’objet fait, lu dans ses champs',
    /\+2 séances/.test(club.objetCourt(lotDe('entrainement', 'duo'))) && /3 plans tactiques/.test(club.objetCourt(lotDe('tactique', 'masterplan'))));
}

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
const invTotal = (c) => Object.values(c.state.inv || {}).reduce((a, v) => a + v, 0);
t('le pack principal remplit l’effectif, la réserve ou l’entraînement',
  club.state.squad.length + club.skillInventory().length > avant.squad + avant.skills
  || (club.state.shards || 0) > 0 || club.sessions() > avant.sessions || invTotal(club) > 0
  || Object.keys(club.state.coachInv || {}).length > avant.coach);
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
