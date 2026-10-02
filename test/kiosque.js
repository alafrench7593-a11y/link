// Le pack unique (§8, §9, §12, §28, §29).
//
// Ce que ce fichier vérifie : qu'il n'y a qu'UN pack dans le jeu et qu'il peut tout
// donner (joueur, compétence, objet, fragments) ; que les deux tables affichées avant
// l'ouverture (familles, raretés) sont bien celles du tirage ; qu'aucun objet Gold ne
// sort plus souvent que la rareté Gold elle-même (§12) ; que chaque objet sorti du
// pack fait ce que sa carte annonce ; et que le client ne peut pas changer les taux.
import { Club } from '../src/club.js';

let ok = 0, ko = 0;
const t = (nom, cond, detail) => {
  console.log((cond ? '  ok   ' : '  ÉCHEC') + ' ' + nom + (detail ? '  (' + detail + ')' : ''));
  cond ? ok++ : ko++;
};
const tete = (s) => console.log('\n' + s);

const club = new Club();
club.createClub({ name: 'FC Test', seed: 7 });
club.setState({ balance: 50000 });

tete('§8 un seul pack dans tout le jeu');
const k = club.kiosque();
t('un seul pack, pas un de plus', k.length === 1 && k[0].key === 'linkfoot', k.map((x) => x.name).join(', '));
t('c’est le LinkFoot Pack, celui que donnent aussi les récompenses', club.packPrincipal().name === club.THE_PACK().name
  && club.PACK_DEFS().length === 1 && club.packByKey('nimporte').key === 'linkfoot');
t('les anciens packs ciblés n’existent plus', ['SKILL_PACK', 'TRAIN_PACK', 'COACH_PACK', 'openSkillPack', 'openTrainPack', 'openCoachPack']
  .every((m) => typeof club[m] !== 'function'));
const P = club.packPrincipal(), fam = P.familles || [];
t('§9 la part de chaque famille est affichée, et elle fait 100 %',
  fam.length === 3 && Math.abs(fam.reduce((a, f) => a + f.pct, 0) - 100) < 1e-9);
t('il peut donner un joueur, une compétence ET un objet',
  ['player', 'skill', 'objet'].every((kd) => fam.some((f) => f.kind === kd && f.pct > 0)));
t('§28 les raretés sont affichées et font 100 %', Math.abs(P.odds.reduce((a, o) => a + o.pct, 0) - 100) < 0.01);
t('les taux affichés sont ceux de RARITY',
  JSON.stringify(P.odds.map((o) => Math.round(o.pct * 1000))) === JSON.stringify(club.RARITY().map((r) => Math.round(r.rate * 100 * 1000))));
t('chaque champ de l’écran est rempli', ['key', 'name', 'family', 'question', 'n', 'cost', 'color', 'desc', 'can', 'why', 'useView', 'useLabel', 'kind', 'odds']
  .every((c) => P[c] !== undefined) && P.cost > 0 && P.n >= 1);

tete('§9 et §29 : les parts affichées sont celles du tirage');
{
  // un générateur à graine : le test est reproductible
  let g = 20261002;
  const rnd = () => { g = (g * 1664525 + 1013904223) >>> 0; return g / 4294967296; };
  const N = 20000, vu = { player: 0, skill: 0, objet: 0, shards: 0 }, rar = {}, objRar = {};
  let objetsJustes = 0, objets = 0;
  for (let i = 0; i < N; i++) {
    const lot = club.drawLot(rnd, new Set());
    vu[lot.kind]++;
    rar[lot.rar] = (rar[lot.rar] || 0) + 1;
    if (lot.kind === 'objet') { objets++; objRar[lot.rar] = (objRar[lot.rar] || 0) + 1; if (lot.objet && lot.objet.rar === lot.rar) objetsJustes++; }
  }
  for (const f of fam) {
    const obs = vu[f.kind] / N * 100;
    t('   ' + f.label + ' : ' + f.pct.toFixed(0) + ' % affichés, ' + obs.toFixed(1) + ' % tirés', Math.abs(obs - f.pct) < 1.5);
  }
  const normal = club.RARITY()[0];
  t('   la rareté la plus courante sort à son taux affiché', Math.abs((rar[normal.id] || 0) / N - normal.rate) < 0.015);
  t('un objet tiré a la rareté de son tirage, jamais une autre', objets > 0 && objetsJustes === objets);
  // §12 : Gold « 1 % ou moins ». Un objet Gold n'a pas de passe-droit : il sort au taux
  // Gold ET à la part Objet, donc bien plus rarement que 1 %.
  const gold = club.RARITY().find((r) => r.id === 'gold');
  const partObjet = fam.find((f) => f.kind === 'objet').pct / 100;
  t('§12 un objet Gold sort à moins de 1 % par tirage', gold.rate * partObjet < 0.01,
    (gold.rate * partObjet * 100).toFixed(3) + ' % par tirage');
}

tete('§13 chaque objet fait ce que sa carte annonce');
{
  const lotDe = (famille, id, stat) => {
    const table = famille === 'tactique' ? club.COACH_ITEMS() : club.TRAIN_LOTS();
    const o = Object.assign({ famille }, table.find((x) => x.id === id));
    if (o.up) { o.stat = stat; o.stats = o.up > 1 ? Array.from({ length: o.up }, () => stat) : null; }
    return o;
  };
  const neuf = () => { const c = new Club(); c.createClub({ name: 'FC Objet', seed: 11 }); c.setState({ balance: 5000, sessions: 0, inv: {}, coachInv: {}, cohBonus: 0 }); return c; };
  const ouvre = (c, o) => c.commitPack({ ok: true, def: c.THE_PACK(), shards: 0, free: true,
    got: [{ kind: 'objet', rar: o.rar, name: o.label, label: o.rar, objet: o }] });
  t('les deux tables ont un objet par rareté, rien de plus',
    [club.TRAIN_LOTS(), club.COACH_ITEMS()].every((L) => L.length === 6 && new Set(L.map((x) => x.rar)).size === 6));
  {
    const c = neuf(); ouvre(c, lotDe('entrainement', 'duo'));
    t('Double séance : +2 séances', c.state.sessions === 2, c.state.sessions + ' séances');
  }
  {
    const c = neuf(); ouvre(c, lotDe('entrainement', 'carte', 'VIT'));
    t('Carte d’amélioration : une carte VIT en réserve', (c.state.inv || {}).up_VIT === 1);
  }
  {
    const c = neuf(); const av = c.state.squad.map((p) => p.pxp + p.plv * 1e6);
    ouvre(c, lotDe('entrainement', 'stage'));
    t('Stage de pré-saison : de l’XP pour tout l’effectif', c.state.squad.every((p, i) => p.pxp + p.plv * 1e6 > av[i]));
  }
  {
    const c = neuf(); ouvre(c, lotDe('tactique', 'causerie'));
    t('Causerie : rangée, à tenir en réunion', (c.state.coachInv || {}).causerie === 1 && c.meetings().find((m) => m.id === 'causerie').can);
  }
  {
    const c = neuf(); const avantMoral = c.state.squad.map((p) => c.profile(p).morale);
    ouvre(c, lotDe('tactique', 'masterplan'));
    t('Plan de campagne : trois plans en réserve', c.plansLeft() === 3);
    t('   le moral promis, à réception', c.state.squad.every((p, i) => c.profile(p).morale >= Math.min(99, avantMoral[i] + 20) - 0.001));
    t('   et la cohésion promise', Math.abs(c.state.cohBonus - 0.08) < 1e-9);
  }
  t('la carte révélée dit ce que l’objet fait, lu dans ses champs',
    /\+2 séances/.test(club.objetCourt(lotDe('entrainement', 'duo'))) && /3 plans tactiques/.test(club.objetCourt(lotDe('tactique', 'masterplan')))
    && /à tenir/.test(club.objetCourt(lotDe('tactique', 'causerie'))));
  const sans = neuf();
  t('sans objet en réserve, la réunion dit d’où il viendrait', /LinkFoot Pack/.test(sans.meetings()[0].why), sans.meetings()[0].why);
}

tete('ouvrir le pack');
{
  const avant = { squad: club.state.squad.length, skills: club.skillInventory().length, sessions: club.sessions(),
    coach: Object.keys(club.state.coachInv || {}).length, solde: club.state.balance };
  club.commitPack(club.openPack({}));
  const invTotal = (c) => Object.values(c.state.inv || {}).reduce((a, v) => a + v, 0);
  t('le pack remplit l’effectif, la réserve ou l’entraînement',
    club.state.squad.length + club.skillInventory().length > avant.squad + avant.skills
    || (club.state.shards || 0) > 0 || club.sessions() > avant.sessions || invTotal(club) > 0
    || Object.keys(club.state.coachInv || {}).length > avant.coach);
  t('il laisse une trace lisible pour l’écran', !!club.packPrincipal().got);
  t('§7 l’ouverture est payée, et le journal le dit',
    club.state.balance === avant.solde - club.THE_PACK().cost && club.state.ledger[0].a === -club.THE_PACK().cost);
}

tete('le pack refuse quand le solde ne suit pas');
{
  const pauvre = new Club();
  pauvre.createClub({ name: 'FC Fauché', seed: 3 });
  pauvre.setState({ balance: 0 });
  const kp = pauvre.packPrincipal();
  t('pas ouvrable à zéro jeton', !kp.can);
  t('et il dit pourquoi, chiffre à l’appui', /manque \d+ jetons/.test(kp.why), kp.why);
  t('l’ouverture est refusée par le moteur, pas seulement par l’écran', pauvre.openPack({}).ok === false);
}

tete('§29 : le client ne peut pas changer les probabilités');
const triche = club.kiosque();
triche[0].odds[0].pct = 99;
triche[0].familles[0].pct = 99;
t('modifier la liste affichée ne change rien au tirage suivant',
  club.kiosque()[0].odds[0].pct !== 99 && club.packFamilies()[0].pct !== 99);

console.log('\n' + (ko ? 'ÉCHECS : ' + ko + ' sur ' + (ok + ko) : 'OK : ' + ok + ' vérifications, un seul pack, et il dit vrai'));
process.exit(ko ? 1 : 0);
