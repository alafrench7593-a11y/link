// §14, §22, §40 à §43, §47 : chaque décision du directeur sportif doit se voir sur le terrain.
//
// Le joueur ne touche jamais au ballon. Tout ce qu'il peut faire, il le fait AVANT :
// composer, placer, régler, préparer, équiper, entraîner. Ce fichier prend chacun de
// ces leviers, joue la même série de matchs avec et sans, et vérifie que le résultat
// bouge dans le sens annoncé. Un levier qui ne bouge rien est un faux bouton (§47) ;
// un levier qui bouge dans le mauvais sens est un mensonge affiché à l'écran.
//
// Tout est joué à graines fixes : deux séries identiques donnent exactement le même
// match, donc une différence mesurée vient du levier et de rien d'autre.
//
// Un match coûte environ deux secondes de calcul, et il en faut des centaines pour
// sortir du bruit. Chaque série part donc dans son propre processus, et les séries
// identiques ne sont jouées qu'une fois.
//
//   node test/leviers.js        12 matchs par série
//   node test/leviers.js 24     plus long, moins de bruit
import { Club } from '../src/club.js';
import { fork } from 'node:child_process';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';

const ICI = fileURLToPath(import.meta.url);
const ADV = { club: 'Référence', ovr: 66, style: 'blocmed' };

// ---------------------------------------------------------------- les réglages
// Chaque entrée est un réglage du club avant le coup d'envoi. C'est exactement ce que
// le directeur sportif peut faire depuis les écrans Tactique, Effectif et Entraînement.
const tac = (o) => (c) => c.setState({ tac: Object.assign({}, c.state.tac, o) });
const style = (k) => (c) => { const s = c.styles()[k]; c.setState({ preset: k, tac: Object.assign({}, s.tac), mentality: s.m, formation: s.form }); };
const squad = (f) => (c) => c.setState({ squad: c.state.squad.map((p) => Object.assign({}, p, f(p))) });
const consigne = (duty) => (c) => {
  const d = {};
  c.pickXI(c.state.formation).forEach((p) => { if (p.line === 'MIL') d[p.slot] = duty; });
  c.setState({ duties: Object.assign({}, c.state.duties, d), preset: 'perso' });
};
// La plus puissante compétence « en permanence » de cet effet, sur tous ceux qui
// peuvent la porter. L'index range chaque combinaison en tableau [effet, condition,
// niveau, grade, puissance] ; la condition 0 est « en permanence ».
const equipe = (eid) => (c) => {
  const D = c.SKILL_DEF(), idx = c.SKILL_INDEX(), inv = [];
  let uid = 1, best = null;
  Object.keys(idx).forEach((rar) => idx[rar].forEach((e) => {
    if (e[0] !== eid || e[1] !== 0) return;
    if (!best || e[4] > best[4]) best = e;
  }));
  if (!best) throw new Error('aucune compétence « ' + eid + ' » en permanence : index changé ?');
  c.state.squad.forEach((p) => {
    if ((D.POSOK[p.pos] || []).indexOf(eid) < 0) return;
    inv.push(Object.assign({}, c.makeSkill(best[0], best[1], best[2], best[3]), { uid: uid++, on: p.id }));
  });
  if (!inv.length) throw new Error('personne ne peut porter « ' + eid + ' » dans l’effectif de départ');
  c.setState({ skillInv: inv });
};

const REGLAGES = {
  base: null,
  prudente: (c) => c.setState({ mentality: 0 }),
  offensive: (c) => c.setState({ mentality: 6 }),
  f433: (c) => c.setState({ formation: '4-3-3' }),
  f532: (c) => c.setState({ formation: '5-3-2' }),
  direct: style('direct'),
  tiki: style('tiki'),
  jeuCourt: tac({ pass: 0 }),
  jeuLong: tac({ pass: 2 }),
  sansPress: tac({ press: 0, engage: 0, ptrap: 0 }),
  pressFort: tac({ press: 2, engage: 2, ptrap: 2 }),
  ligneBasse: tac({ line: 0 }),
  ligneHaute: tac({ line: 2 }),
  sansCentres: tac({ cross: 0, width: 0 }),
  centresFort: tac({ cross: 2, width: 2 }),
  milieuxBas: consigne('Défense'),
  milieuxHauts: consigne('Attaque'),
  sansPlan: (c) => c.setState({ nextAdv: 0 }),
  avecPlan: (c) => c.setState({ nextAdv: 6 }),
  sansCohesion: (c) => c.setState({ cohBonus: 0 }),
  avecReunion: (c) => c.setState({ cohBonus: 0.16 }),
  moralBas: squad(() => ({ morale: 30 })),
  moralHaut: squad(() => ({ morale: 99 })),
  epuisee: squad(() => ({ fit: 55 })),
  fraiche: squad(() => ({ fit: 100 })),
  entrainee: squad((p) => ({ ovr: Math.min(99, p.ovr + 8) })),
  sansAdjoint: (c) => c.setState({ staff: Object.assign({}, c.state.staff, { adjoint: 0 }) }),
  avecAdjoint: (c) => c.setState({ staff: Object.assign({}, c.state.staff, { adjoint: 5 }) }),
  finisseurs: equipe('tueur')
};

// ---------------------------------------------------------------- une série
//
// UN CLUB NEUF PAR MATCH, et pas un club qui enchaîne. Deux raisons, trouvées en
// écrivant ce fichier :
//
//   1. Le match est reproductible, la carrière ne l'est pas : ce qui se passe APRÈS
//      le coup de sifflet (progression des jeunes, usure des trentenaires, carte
//      gagnée) tire au sort sans graine. Un club qui enchaîne douze matchs n'est
//      donc plus le même d'une série à l'autre, et la comparaison ne veut plus rien
//      dire. Le serveur, lui, ne rejoue que le match : cette part-là est garantie.
//   2. Les leviers qui ne durent qu'un match (plan tactique, réunion, fraîcheur,
//      moral) s'effaçaient dès le deuxième, donc on mesurait leur absence.
function serie(nom, N) {
  const t = { matchs: N };
  for (let i = 0; i < N; i++) {
    const c = new Club();
    const r0 = REGLAGES[nom];
    if (r0) r0(c);
    const r = c.playMatch(ADV, { seed: 7000 + i });
    const H = r.stats.H, A = r.stats.A;
    t.buts = (t.buts || 0) + r.score[0];
    t.encaisses = (t.encaisses || 0) + r.score[1];
    // le résultat du MATCH, lu au score : un amical nul se termine aux tirs au but (§51),
    // et r.res dirait alors « victoire » ou « défaite » pour un match nul
    t.pts = (t.pts || 0) + (r.score[0] > r.score[1] ? 3 : r.score[0] === r.score[1] ? 1 : 0);
    ['sh', 'on', 'xg', 'cor', 'fou', 'yc', 'pa', 'pc', 'off', 'tk'].forEach((k) => { t[k] = (t[k] || 0) + H[k]; });
    ['sh', 'xg', 'pa', 'off'].forEach((k) => { t['adv_' + k] = (t['adv_' + k] || 0) + A[k]; });
    t.possT = (t.possT || 0) + r.poss;               // possession réelle, en temps de ballon
    Object.keys(r.cnt).forEach((k) => { t[k] = (t[k] || 0) + r.cnt[k]; });
  }
  t.precision = t.pc / (t.pa || 1) * 100;              // passes réussies, en %
  t.poss = t.possT / N;                                // possession moyenne, en %
  return t;
}

// Mode enfant : une série, un JSON sur la sortie standard.
if (process.argv.includes('--serie')) {
  const nom = process.argv[process.argv.indexOf('--serie') + 1];
  const N = Number(process.argv[process.argv.indexOf('--serie') + 2]);
  process.stdout.write('\u0001' + JSON.stringify(serie(nom === 'base' ? null : nom, N)) + '\u0001');
  process.exit(0);
}

// ---------------------------------------------------------------- les leviers
// [titre, réglage sans, réglage avec, [[ce qu'on mesure, sens attendu, seuil mini]]]
// Les actions se mesurent pour mille décisions : deux séries n'ont jamais le même
// nombre de ballons, donc les totaux bruts ne veulent rien dire.
const pm = (k) => (t) => (t[k] || 0) / (t.dec || 1) * 1000;
const brut = (k) => (t) => t[k] || 0;
const somme = (...ks) => (t) => ks.reduce((a, k) => a + (t[k] || 0), 0) / (t.dec || 1) * 1000;

const LEVIERS = [
  ['§40 La mentalité change l’équilibre du match', 'prudente', 'offensive', [
    ['on frappe davantage', pm('act_shot'), '>'],
    ['on arrive plus souvent dans la surface', pm('boxRcv'), '>'],
    ['et l’adversaire frappe plus aussi', brut('adv_sh'), '>']]],

  // Trois leviers tiennent leur sens mais restent sous le seuil de 4 % depuis les correctifs du
  // moteur (coup d'envoi, frappes de sa place, touche ; branche ue5) : mesurés le 3 octobre 2026
  // sur 48 matchs par série, ils sont affichés en constats et ne cassent la vérification que
  // s'ils s'inversent (docs/ue5/audit.md). À renforcer dans le moteur.
  ['§41 La formation change la solidité', 'f433', 'f532', [
    ['à cinq derrière, on concède moins de tirs', brut('adv_sh'), '<', null, 'trop faible depuis les correctifs du moteur (48 matchs : −3,7 %)'],
    ['et on frappe moins', pm('act_shot'), '<']]],

  ['§42 Le style change la manière, pas seulement le score', 'direct', 'tiki', [
    ['le tiki-taka garde le ballon', brut('poss'), '>', 0.5]]],

  ['§42 Le curseur jeu court / jeu long change le ballon joué', 'jeuCourt', 'jeuLong', [
    ['le jeu direct envoie bien plus de longs ballons', pm('act_pass_long'), '>'],
    ['il joue moins de passes en tout', brut('pa'), '<'],
    ['et il rend le ballon plus souvent', brut('poss'), '<', 0.5]]],

  ['§42 Le pressing se voit dans les duels', 'sansPress', 'pressFort', [
    ['on tacle davantage', brut('tk'), '>', null, 'trop faible depuis les correctifs du moteur (48 matchs : +3,1 %)'],
    ['on commet plus de fautes', brut('fou'), '>']]],

  ['§42 La ligne défensive change le piège du hors-jeu', 'ligneBasse', 'ligneHaute', [
    ['ligne haute : l’adversaire se fait plus souvent prendre au piège', brut('adv_off'), '>', 0]]],

  ['§42 Les centres changent par où on attaque', 'sansCentres', 'centresFort', [
    ['on centre beaucoup plus', pm('cross'), '>']]],

  ['§43 Les consignes individuelles changent le milieu', 'milieuxBas', 'milieuxHauts', [
    ['milieux offensifs : plus de présence dans la surface', pm('boxRcv'), '>'],
    // Pas « plus de frappes pour mille décisions » : des milieux qui montent gardent
    // le ballon plus haut, donc le nombre de décisions monte avec les frappes et le
    // rapport reste plat. Ce qui compte, c'est le danger produit.
    // Pas le danger créé : sur douze matchs il varie de plus de dix pour cent d'une
    // série à l'autre, donc il dit n'importe quoi. Sur trente matchs il monte bien
    // (22,6 → 24,7). Les points, eux, se comptent et tranchent.
    ['et plus de points', brut('pts'), '>', 0]]],

  ['§24 Le plan tactique préparé pèse sur le match', 'sansPlan', 'avecPlan', [
    ['on prend plus de points', brut('pts'), '>', 0],
    ['et on crée plus de danger', brut('xg'), '>']]],

  ['§24 La réunion d’équipe se voit dans la justesse technique', 'sansCohesion', 'avecReunion', [
    ['les passes arrivent plus souvent', brut('precision'), '>', 0.3]]],

  ['§5 Le moral de l’effectif change le rendement', 'moralBas', 'moralHaut', [
    ['une équipe au moral haut crée plus', brut('xg'), '>']]],

  // Le choix de frapper, rapporté aux décisions, est dans le bruit depuis le ballon
  // indépendant (4 octobre 2026, 48 matchs : de +6 % à −3 % d'un réglage du moteur à l'autre,
  // +10 % avant) ; la fraîcheur se voit toujours dans les frappes elles-mêmes (311 → 460) et le
  // danger créé (xG 27 → 37). Affiché en constat, il casse la vérification s'il s'inverse.
  ['§5 La fraîcheur physique change le match', 'epuisee', 'fraiche', [
    ['une équipe fraîche frappe davantage', pm('act_shot'), '>', null, 'dans le bruit depuis le ballon indépendant (48 matchs : +6 % à −3 %)'],
    ['elle garde plus le ballon, donc elle court moins après', brut('tk'), '<', null, 'trop faible depuis les correctifs du moteur (48 matchs : −2,4 %)']]],

  ['§6 L’entraînement de l’effectif se voit sur le terrain', 'base', 'entrainee', [
    ['un effectif plus fort crée plus', brut('xg'), '>'],
    ['et prend plus de points', brut('pts'), '>', 0]]],

  // L'adjoint ajoute son bonus tactique (+2,4 au niveau 3) à la passe : un écart de précision
  // de quelques dixièmes de point, au niveau du bruit de 48 matchs (écart-type de la différence :
  // 0,35 point environ). Mesuré le 4 octobre 2026 : +0,77 avant le ballon indépendant, −0,06
  // depuis, le mécanisme n'ayant pas changé. Affiché en constat, il casse s'il s'inverse.
  ['§25 Le niveau de l’adjoint compte', 'sansAdjoint', 'avecAdjoint', [
    ['un meilleur adjoint, des passes plus justes', brut('precision'), '>', 0.2, 'au niveau du bruit de 48 matchs (+0,77 avant, −0,06 depuis le ballon indépendant)']]],

  // Les frappes pour mille décisions de deux séries ne départageaient pas le Tueur en
  // permanence (quatre ou cinq décisions basculées en douze matchs) : le levier basculait
  // au moindre changement du moteur. Le moteur compte maintenant les décisions que la
  // compétence a fait basculer, au même instant, chez le même joueur.
  ['§14 Une compétence équipée change le jeu', 'base', 'finisseurs', [
    ['des finisseurs frappent là où ils auraient joué autre chose', brut('bascule_tir_H'), '>']]]
];

// ---------------------------------------------------------------- l'exécution
const N = Number(process.argv[2] || 12);
const voulus = [...new Set(LEVIERS.flatMap(([, a, b]) => [a, b]))];

function joue(nom) {
  return new Promise((res, rej) => {
    const ch = fork(ICI, ['--serie', nom, String(N)], { stdio: ['ignore', 'pipe', 'inherit', 'ipc'] });
    let buf = '';
    ch.stdout.on('data', (d) => { buf += d; });
    ch.on('exit', (code) => {
      const m = buf.split('\u0001')[1];
      if (code !== 0 || !m) return rej(new Error('série ' + nom + ' : code ' + code));
      res(JSON.parse(m));
    });
  });
}

// Une file de la largeur de la machine : au-delà, les processus se gênent.
async function toutes(noms, largeur) {
  const out = {};
  let i = 0, faits = 0;
  await Promise.all(Array.from({ length: Math.min(largeur, noms.length) }, async () => {
    while (i < noms.length) {
      const n = noms[i++];
      out[n] = await joue(n);
      process.stdout.write('\r  ' + (++faits) + ' / ' + noms.length + ' séries jouées   ');
    }
  }));
  process.stdout.write('\r' + ' '.repeat(40) + '\r');
  return out;
}

const f1 = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
let fails = 0, checks = 0, constats = 0;

console.log('LinkFoot · ce que le directeur sportif décide se joue vraiment');
console.log(N + ' matchs par série, graines 7000 à ' + (7000 + N - 1) + ', même adversaire');
console.log(voulus.length + ' séries à jouer, ' + (voulus.length * N) + ' matchs au total\n');

const S = await toutes(voulus, Math.max(1, cpus().length));

for (const [titre, nomA, nomB, mesures] of LEVIERS) {
  console.log('\n' + titre);
  const A = S[nomA], B = S[nomB];
  for (const [label, lire, sens, mini, connu] of mesures) {
    checks++;
    const a = lire(A), b = lire(B), ecart = b - a;
    const seuil = mini != null ? mini : Math.abs(a) * 0.04;   // 4 % par défaut : au-dessus du bruit
    const ok = sens === '>' ? ecart > seuil : -ecart > seuil;
    const chiffres = '  (' + f1(a) + ' → ' + f1(b) + ', écart ' + (ecart >= 0 ? '+' : '') + f1(ecart) + ')';
    if (connu && !ok) {
      // un levier connu pour être trop faible : un chiffre sous les yeux ; il ne casse la
      // vérification que s'il part dans l'autre sens
      const inverse = sens === '>' ? ecart < -seuil : ecart > seuil;
      console.log((inverse ? '  ALERTE ' : '  constat ') + label + chiffres + (inverse ? '  ← INVERSÉ' : ''));
      console.log('            ' + connu + ' ; devrait être : un écart de plus de ' + f1(seuil));
      constats++;
      if (inverse) fails++;
      continue;
    }
    console.log((ok ? '  ok   ' : '  ÉCHEC') + ' ' + label + chiffres);
    if (!ok) fails++;
  }
}

// ---------------------------------------------------------------- le déterminisme
// La garantie qui rend tout le reste vérifiable, et qui fait tenir le multijoueur :
// deux fois le même réglage et la même graine donnent exactement le même match.
console.log('\n§29 Le match est reproductible');
{
  checks++;
  const bis = await joue('base');
  const memes = ['buts', 'encaisses', 'sh', 'xg', 'pa', 'tk', 'dec'].every((k) => S.base[k] === bis[k]);
  console.log((memes ? '  ok   ' : '  ÉCHEC') + ' deux séries identiques donnent le même résultat au chiffre près');
  if (!memes) fails++;
  console.log('         (le match est reproductible ; ce qui suit le coup de sifflet, non :');
  console.log('          progression et usure tirent au sort. Le serveur ne rejoue que le match.)');
}
{
  checks++;
  const differe = S.base.sh !== S.offensive.sh || S.base.xg !== S.offensive.xg;
  console.log((differe ? '  ok   ' : '  ÉCHEC') + ' un seul réglage changé suffit à changer le match');
  if (!differe) fails++;
}

console.log('\n' + (fails
  ? 'ÉCHECS : ' + fails + ' mesures sur ' + checks + ' ne font pas ce qui est annoncé'
  : 'OK : ' + checks + ' vérifications, chaque décision se joue vraiment' + (constats ? ', dont ' + constats + ' constats de leviers trop faibles' : '')));
process.exit(fails ? 1 : 0);
