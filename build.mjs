// Fabrique dist/linkfoot.js : un seul fichier, sans modules, qui expose window.LinkFoot.
// Utile pour une page ouverte directement depuis le disque ou pour une WebView.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const strip = (f) => readFileSync(new URL('./src/' + f, import.meta.url), 'utf8')
  .replace(/^\s*import[^;]*;\s*$/gm, '')
  .replace(/^export\s+/gm, '')
  .replace(/^\s*export\s*\{[^}]*\}\s*from[^;]*;\s*$/gm, '');
const parts = ['state.js', 'engine.js', 'players.js', 'skills.js', 'cards.js', 'staff.js', 'training.js', 'transfer.js', 'progression.js', 'tactics.js', 'club.js', 'save.js', 'league.js', 'tournament.js'].map(strip);
const out = `/* LinkFoot ${new Date().toISOString().slice(0, 10)} : moteur de match + manager, sans dépendance. */
(function (root) {
'use strict';
${parts.join('\n')}
root.LinkFoot = { makeEngine, Club, INITIAL_STATE, serialize, deserialize, SAVE_VERSION, MemoryStore, LocalStore, HttpStore, SaveManager,
  standings, schedule, applyResult, emptyRow, movements, createTournament, pendingMatches, reportResult, finalRanking, rewards, PAYOUTS };
})(typeof window !== 'undefined' ? window : globalThis);
`;
mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('./dist/linkfoot.js', import.meta.url), out);
console.log('dist/linkfoot.js', out.length, 'octets');
