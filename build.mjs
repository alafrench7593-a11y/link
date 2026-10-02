// Fabrique dist/linkfoot.js : un seul fichier, sans modules, qui expose window.LinkFoot.
// Utile pour une page ouverte directement depuis le disque ou pour une WebView.
//
//   node build.mjs           réécrit dist/linkfoot.js
//   node build.mjs --check   ne réécrit rien : vérifie que le fichier unique se charge,
//                            joue un match, et qu'il est à jour avec src/
//
// La liste des fichiers était écrite à la main, et elle avait cessé de suivre club.js :
// Tracks, PlayerXP, Quests et sept autres modules manquaient. Le fichier publié plantait
// au chargement (« Tracks is not defined ») sans que rien ne le signale. La liste se lit
// maintenant dans les imports de club.js, et --check tourne avec les autres vérifications.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const lire = (f) => readFileSync(new URL('./src/' + f, import.meta.url), 'utf8');
const strip = (f) => lire(f)
  .replace(/^\s*import[^;]*;\s*$/gm, '')
  .replace(/^export\s+/gm, '')
  .replace(/^\s*export\s*\{[^}]*\}\s*from[^;]*;\s*$/gm, '');

// club.js et ses modules, dans l'ordre de ses imports ; puis ce qui se sert de Club
const imports = [...lire('club.js').matchAll(/^import\s*\{[^}]*\}\s*from\s*'\.\/([\w-]+\.js)';/gm)].map((m) => m[1]);
const fichiers = [...new Set(imports.concat(['club.js', 'save.js', 'league.js', 'tournament.js', 'versus.js']))];
const corps = fichiers.map(strip).join('\n');
const tete = (jour) => `/* LinkFoot ${jour} : moteur de match + manager, sans dépendance. */`;
const fabrique = (jour) => `${tete(jour)}
(function (root) {
'use strict';
${corps}
root.LinkFoot = { makeEngine, Club, INITIAL_STATE, serialize, deserialize, SAVE_VERSION, MemoryStore, LocalStore, HttpStore, SaveManager,
  standings, schedule, applyResult, emptyRow, movements, createTournament, pendingMatches, reportResult, finalRanking, rewards, PAYOUTS,
  teamSnapshot, versusCfg, playVersus, verifyResult };
})(typeof window !== 'undefined' ? window : globalThis);
`;

const cible = new URL('./dist/linkfoot.js', import.meta.url);
if (!process.argv.includes('--check')) {
  const out = fabrique(new Date().toISOString().slice(0, 10));
  mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
  writeFileSync(cible, out);
  console.log('dist/linkfoot.js', out.length, 'octets, ' + fichiers.length + ' fichiers de src/');
} else {
  const sansTete = (s) => s.split('\n').slice(1).join('\n');
  const actuel = existsSync(cible) ? readFileSync(cible, 'utf8') : '';
  const echecs = [];
  // il se charge, crée un club et joue un match, sans rien d'autre que lui-même
  try {
    const g = {};
    new Function('window', actuel)(g);
    const c = new g.LinkFoot.Club();
    c.createClub({ name: 'FC Paquet', seed: 3 });
    const r = c.playMatch(c.prochainMatch().opp, { seed: 11 });
    if (!Array.isArray(r.score)) echecs.push('le match ne rend pas de score');
  } catch (e) { echecs.push('il ne se charge pas : ' + e.message); }
  if (sansTete(actuel) !== sansTete(fabrique(''))) echecs.push('il n’est plus à jour avec src/ : lance `npm run build`');
  if (echecs.length) { console.error('dist/linkfoot.js : ' + echecs.join(' ; ')); process.exit(1); }
  console.log('OK : dist/linkfoot.js se charge, joue un match, et suit src/ (' + fichiers.length + ' fichiers)');
}
