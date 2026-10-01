// Fabrique dist/linkfoot.js : un seul fichier, sans modules, qui expose window.LinkFoot.
// Utile pour une page ouverte directement depuis le disque ou pour une WebView.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const strip = (f) => readFileSync(new URL('./src/' + f, import.meta.url), 'utf8')
  .replace(/^\s*import[^;]*;\s*$/gm, '')
  .replace(/^export\s+/gm, '')
  .replace(/^\s*export\s*\{[^}]*\}\s*from[^;]*;\s*$/gm, '');
const parts = ['state.js', 'engine.js', 'club.js', 'save.js'].map(strip);
const out = `/* LinkFoot ${new Date().toISOString().slice(0, 10)} : moteur de match + manager, sans dépendance. */
(function (root) {
'use strict';
${parts.join('\n')}
root.LinkFoot = { makeEngine, Club, INITIAL_STATE, serialize, deserialize, SAVE_VERSION, MemoryStore, LocalStore, HttpStore, SaveManager };
})(typeof window !== 'undefined' ? window : globalThis);
`;
mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('./dist/linkfoot.js', import.meta.url), out);
console.log('dist/linkfoot.js', out.length, 'octets');
