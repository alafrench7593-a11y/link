// Une seule source de vérité.
//
// Le moteur et les règles vivent dans src/ (club.js plus les modules de domaine).
// L'écran Mon Club (canvas/Club.dc.html)
// en contenait une copie, qui divergeait dès qu'on corrigeait d'un seul côté.
// Ce script réinjecte src/engine.js et les méthodes de src/club.js dans l'artboard.
//
//   node tools/sync-canvas.mjs           réécrit canvas/Club.dc.html
//   node tools/sync-canvas.mjs --check   ne réécrit rien, sort en erreur si ça diverge
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const check = process.argv.includes('--check');

// Extrait le corps d'une méthode `nom(...) { ... }` par comptage d'accolades,
// en ignorant chaînes, gabarits, commentaires et classes de caractères d'expressions régulières.
function findMethod(src, name, from = 0) {
  const re = new RegExp('(^|\\n)(\\s*)' + name + '\\s*\\(', 'g');
  re.lastIndex = from;
  const m = re.exec(src);
  if (!m) return null;
  const open = src.indexOf('{', m.index + m[0].length - 1);
  if (open < 0) return null;
  let d = 0, i = open, q = null, esc = false;
  for (; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (q) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (q === '//' && c === '\n') q = null;
      else if (q === '/*' && c === '*' && n === '/') { q = null; i++; }
      else if ((q === '"' || q === "'" || q === '`') && c === q) q = null;
      continue;
    }
    if (c === '/' && n === '/') { q = '//'; i++; continue; }
    if (c === '/' && n === '*') { q = '/*'; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) return { start: m.index + (m[1] ? 1 : 0), end: i + 1, indent: m[2] }; }
  }
  return null;
}

const reindent = (body, indent) => body.split('\n').map((l, i) => (i === 0 || !l.trim() ? l : indent + l.replace(/^ {2}/, ''))).join('\n');

let artboard = read('canvas/Club.dc.html');
const before = artboard;
const changed = [];

// 1. le moteur
{
  const eng = read('src/engine.js');
  const body = eng.slice(eng.indexOf('export function makeEngine(cfg) {') + 'export function '.length).trimEnd();
  const hit = findMethod(artboard, 'makeEngine');
  if (!hit) throw new Error('makeEngine introuvable dans l\'artboard');
  const next = reindent(body, '  ');
  const cur = artboard.slice(hit.start, hit.end);
  if (cur.trim() !== next.trim()) { artboard = artboard.slice(0, hit.start) + '  ' + next + artboard.slice(hit.end); changed.push('makeEngine'); }
}

// 2. les méthodes du club
const METHODS = ['rand', 'seedR', 'statW', 'ovrOf', 'genStats', 'cardStats', 'profile', 'valueOf',
  'SKILL_DEF', 'skillCount', 'makeSkill', 'skillsOf', 'styles', 'matchup', 'levelNeed', 'addXp',
  'table', 'ajouterCarriere', 'carriereLigne', 'buteursDuMatch', 'bumpMission', 'afterMatch', 'applyFitness', 'TRAININGS', 'train', 'COACHES',
  'MATCH_CARDS', 'UPGRADE_CARDS', 'useUpgrade', 'STAFF_DEFS', 'staffLv', 'staffWages', 'hireStaff',
  'STADES', 'upgradeStade', 'ACADEMIES', 'upgradeAcademy', 'youthPlayer', 'synergy', 'finances',
  'marketList', 'MARKET_RULES', 'buyInfo', 'buyPlayer', 'sellInfo', 'formCoords', 'penalty', 'pickXI', 'benchOf', 'ROLE_OPTS', 'metrics', 'baseShape', 'engineCfg',
  'RARITY', 'rarityOf', 'rarityOfPower', 'CARD_POOL', 'drawCard', 'PACK_DEFS', 'THE_PACK', 'packOdds', 'collection', 'sellPlayer', 'ageSquad', 'valueOf', 'valueBreakdown',
  'rarityFor', 'packState', 'packByKey', 'packName', 'PACK_SLOTS', 'drawSlot', 'packFamilies', 'objetCourt', 'drawLot', 'openPack', 'commitPack', 'cardToPlayer',
  'GATES', 'gateOf', 'lockOf', 'progressBoard', 'trackLine', 'unlocksAt',
  'GRADES', 'rawPower', 'skillPower', 'SKILL_INDEX', 'skillReq', 'canEquip', 'skillSlots', 'equippedOn', 'makeSkill', 'rollSkill', 'innateSkills',
  'equipSkill', 'unequipSkill', 'skillInventory', 'reqLine', 'skillCount',
  'playerXpNeed', 'playerLevel', 'playerXp', 'playerProgress', 'hiddenOf', 'hiddenMods', 'injuryRisk', 'xpRate', 'matchXp', 'addPlayerXp', 'grantPlayerXp',
  'SHARD_XP', 'shardTrainInfo', 'shardTrain',
  'SESSION_RULES', 'sessions', 'takeSession', 'addSessions', 'trainInfo', 'TRAIN_LOTS', 'UPGRADE_CARDS', 'useUpgrade', 'appliquerObjetsEntrainement', 'trainingOptions', 'TRAININGS', 'train', 'engineCfg',
  'KIOSQUE', 'kiosque', 'packPrincipal', 'COACH_ITEMS', 'rangerObjetsCoach',
  'meetings', 'holdMeeting', 'plansLeft', 'usePlan', 'styleList', 'FORMATIONS', 'TAC_GROUPS', 'setFormation', 'applyStyle', 'setMentality', 'setConsigne',
  'CAPS', 'DAILY_REWARDS', 'claimDaily', 'claimMission', 'logMoney', 'dayKey', 'earn', 'spend', 'PRONO_DEFS', 'MAX_STAKE', 'placeProno', 'settlePronos', 'QUEST_DEFS', 'activeQuests', 'rollQuests', 'bumpQuest', 'claimQuest', 'questsAfterMatch',
  'matchPlan', 'MENTALITES', 'IMPACT_DEFS', 'impactFigures', 'impactReport', 'impactLine',
  'isOnline', 'onlineSummary', 'onlineActions', 'NEWS_SECTIONS', 'buildNews', 'newsBySection', 'onlineSlides', 'demoFeed', 'CREATION_STEPS', 'COUNTRIES', 'starterSquad', 'starterRare', 'canEquipRaw', 'genStatsFor', 'createClub', 'creationSummary',
  // §22 la division : les règles de classement communes (league.js) et le championnat solo (division.js)
  'emptyRow', 'applyResult', 'standings', 'schedule', 'movements',
  'CLUBS_DIVISION', 'DIVISION_RULES', 'clubsDeDivision', 'nouvelleDivision', 'divisionCourante', 'prochainMatch', 'estAuCalendrier',
  'resultatRapide', 'journeeJouee', 'situationDivision', 'resultatsDeJournee',
  // §2 composition et décisions pendant le match : les mêmes règles que l'app téléphone (tactics.js, direct.js)
  'joueurMoteur', 'assignSlot', 'compositionAuto', 'candidatsPoste',
  'REGLES_DIRECT', 'CRIS', 'entrant', 'remplacementInfo', 'issueDuMatch', 'joueursDuMatch',
  'nomUnique',
  // §28 le match en 3D et §11 le pack en 3D : le même rendu que l'app téléphone (stade3d.js)
  'stade3d', 'pack3d', 'peintre', 'texture3d', 'facePack', 'panneauPub'];
// Les méthodes retirées des sources. Le sync ne sait qu'ajouter et remplacer : sans
// cette liste, une méthode supprimée de src/ resterait dans l'artboard, morte mais
// toujours appelable par l'écran. Ici, elle est effacée, et --check échoue tant
// qu'elle y est.
const RETIREES = ['PACK_REGISTRY', 'kiosqueSummary',
  'SKILL_PACK', 'skillPackOdds', 'skillPackState', 'openSkillPack', 'commitSkillPack',
  'TRAIN_PACK', 'trainPackOdds', 'drawTrainLot', 'openTrainPack', 'commitTrainPack', 'trainPackState',
  'COACH_PACK', 'coachPackOdds', 'coachPackState', 'openCoachPack', 'commitCoachPack'];
const SOURCES = ['club.js', 'players.js', 'skills.js', 'cards.js', 'staff.js', 'training.js', 'transfer.js', 'progression.js', 'tactics.js', 'tracks.js', 'playerxp.js', 'quests.js', 'creation.js', 'onlineui.js', 'trainpack.js', 'packs.js', 'news.js', 'impact.js', 'league.js', 'division.js', 'direct.js', 'stade3d.js'];
const club = SOURCES.map((f) => read('src/' + f)).join('\n');
// Une méthode du club ne se cherche JAMAIS dans le corps du moteur : le moteur a ses
// propres fonctions internes (setTac, shoot…), et un nom partagé faisait remplacer
// une fonction du moteur par une méthode du club, en silence.
const horsMoteur = (name) => {
  const eng = findMethod(artboard, 'makeEngine');
  let hit = findMethod(artboard, name);
  while (hit && eng && hit.start >= eng.start && hit.start < eng.end) hit = findMethod(artboard, name, eng.end);
  return hit;
};
for (const name of METHODS) {
  const from = findMethod(club, name);
  if (!from) throw new Error('méthode absente des sources : ' + name);
  const body = club.slice(from.start, from.end);
  const hit = horsMoteur(name);
  if (!hit) {
    // méthode nouvelle : on l'insère avant renderVals
    const anchor = findMethod(artboard, 'renderVals');
    if (!anchor) throw new Error('renderVals introuvable dans l\'artboard');
    artboard = artboard.slice(0, anchor.start) + body + '\n' + artboard.slice(anchor.start);
    changed.push(name + ' (ajoutée)');
    continue;
  }
  const cur = artboard.slice(hit.start, hit.end);
  if (cur.trim() !== body.trim()) { artboard = artboard.slice(0, hit.start) + body + artboard.slice(hit.end); changed.push(name); }
}

// 3. les méthodes retirées : effacées avec le commentaire qui les précède
for (const name of RETIREES) {
  const hit = horsMoteur(name);
  if (!hit) continue;
  let start = hit.start;
  const lignes = artboard.slice(0, start).split('\n');
  lignes.pop();                                        // le début de la ligne de la méthode
  while (lignes.length && /^\s*\/\//.test(lignes[lignes.length - 1])) { start -= lignes.pop().length + 1; }
  let end = hit.end;
  if (artboard[end] === ',') end++;
  if (artboard[end] === '\n') end++;
  artboard = artboard.slice(0, start) + artboard.slice(end);
  changed.push(name + ' (retirée)');
}

// 4. le balisage de l'écran. Une balise mal refermée ne fait aucune erreur : le
// navigateur répare en silence, et tous les écrans qui suivent sortent du cadre du
// téléphone. C'est arrivé : un reste de l'ancienne liste des packs ciblés refermait le
// cadre, et la Ligue, le Match ou l'Entraînement s'affichaient sous l'écran, hors champ.
function balisage(html) {
  const a = html.indexOf('</helmet>') + '</helmet>'.length, b = html.indexOf('</x-dc>');
  const zone = html.slice(a, b);
  const VIDES = new Set(['br', 'img', 'input', 'meta', 'link', 'hr', 'source', 'wbr', 'area', 'col', 'embed', 'param', 'track',
    'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'stop', 'use']);
  const ligne = (i) => html.slice(0, a + i).split('\n').length;
  const pile = [], erreurs = [];
  let i = 0;
  while ((i = zone.indexOf('<', i)) >= 0) {
    if (zone.startsWith('<!--', i)) { i = zone.indexOf('-->', i) + 3; continue; }
    const m = /^<(\/?)([a-zA-Z][\w-]*)/.exec(zone.slice(i, i + 64));
    if (!m) { i++; continue; }
    let j = i + m[0].length, q = null;                  // la fin de la balise, guillemets compris
    for (; j < zone.length; j++) { const c = zone[j]; if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '>') break; }
    const nom = m[2].toLowerCase();
    if (!VIDES.has(nom)) {
      if (!m[1]) { if (zone[j - 1] !== '/') pile.push({ nom, i }); }
      else {
        const k = pile.map((x) => x.nom).lastIndexOf(nom);
        if (k < 0) erreurs.push('</' + nom + '> ligne ' + ligne(i) + ' : rien à refermer');
        else {
          if (k !== pile.length - 1) erreurs.push('</' + nom + '> ligne ' + ligne(i) + ' referme aussi ' + pile.slice(k + 1).map((x) => '<' + x.nom + '> (ligne ' + ligne(x.i) + ')').join(', '));
          pile.length = k;
        }
      }
    }
    i = j + 1;
  }
  pile.forEach((x) => erreurs.push('<' + x.nom + '> ligne ' + ligne(x.i) + ' : jamais refermée'));
  return erreurs;
}
// 5. les dépendances : une méthode recopiée qui en appelle une autre absente de l'écran
// planterait à l'exécution, sans que rien ne le dise avant (nomUnique l'a fait).
// Les actions en ligne viennent de connectOnline (src/online.js), branché seulement
// avec un serveur : onlineActions ne les appelle que si isOnline() est vrai.
const EN_LIGNE = ['goOnline', 'playRanked', 'refreshLadder', 'refreshLeagues', 'refreshChallenges', 'refreshFeed', 'refreshMarket', 'sellOnline', 'buyOnline'];
{
  const manquent = new Set();
  for (const name of METHODS) {
    const hit = horsMoteur(name); if (!hit) continue;
    for (const m of artboard.slice(hit.start, hit.end).matchAll(/this\.([A-Za-z_]\w*)\(/g)) {
      if (!horsMoteur(m[1]) && !/^(setState|buzz|later|eng|timer)$/.test(m[1]) && !EN_LIGNE.includes(m[1])) manquent.add(m[1] + ' (appelée par ' + name + ')');
    }
  }
  if (manquent.size) { console.error('méthodes appelées mais absentes de l\'écran Mon Club :\n  ' + [...manquent].join('\n  ')); process.exit(1); }
}

const casse = balisage(artboard);
if (casse.length) {
  console.error('balisage de l\'écran Mon Club cassé :\n  ' + casse.slice(0, 6).join('\n  '));
  process.exit(1);
}

if (!changed.length) { console.log('canvas à jour, rien à faire'); process.exit(0); }
if (check) {
  console.error('canvas désynchronisé : ' + changed.join(', '));
  console.error('lance `npm run sync` puis republie l\'artboard.');
  process.exit(1);
}
writeFileSync(new URL('canvas/Club.dc.html', root), artboard);
console.log('canvas resynchronisé (' + changed.length + ') : ' + changed.join(', '));
console.log('écart : ' + (artboard.length - before.length) + ' octets');
