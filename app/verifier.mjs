// L'application, vérifiée en vrai (§2, §19, §47).
//
// Jusqu'ici l'app Expo n'avait jamais été lancée : seulement compilée. Compiler ne
// prouve rien sur ce qu'un joueur voit. Au premier vrai lancement, deux défauts sont
// apparus d'un coup :
//
//   - elle ne se construisait pas : expo-asset manquait au package.json ;
//   - elle ne créait jamais le club : tout nouveau joueur démarrait sur le club de
//     démonstration, niveau 7, 1 000 jetons, sans passer par la création du §2.
//
// Ce fichier construit l'app pour le navigateur, la sert, et la parcourt comme un
// joueur : premier lancement, les six onglets, les neuf entrées du directeur sportif,
// le pack ouvert, second lancement.
//
//   npm run verifier        depuis app/, après npm install
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
let ok = 0, ko = 0;
const t = (nom, cond, detail) => {
  console.log((cond ? '  ok   ' : '  ÉCHEC') + ' ' + nom + (detail ? '  (' + detail + ')' : ''));
  cond ? ok++ : ko++;
};

// 1. construire
console.log('Construction de l’app pour le navigateur…');
const construit = await new Promise((res) => {
  const ch = spawn('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist'],
    { cwd: ICI, env: Object.assign({}, process.env, { EXPO_OFFLINE: '1', CI: '1' }), stdio: ['ignore', 'pipe', 'pipe'] });
  let s = ''; ch.stdout.on('data', (d) => { s += d; }); ch.stderr.on('data', (d) => { s += d; });
  ch.on('exit', (code) => res({ code, s }));
});
t('l’app se construit', construit.code === 0, construit.code === 0
  ? (construit.s.match(/Bundled[^\n]*/) || [''])[0].trim()
  : construit.s.split('\n').filter((l) => /Error/.test(l))[0]);
if (construit.code !== 0) process.exit(1);

// 2. servir
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const srv = createServer(async (req, rs) => {
  const chemin = join(ICI, 'dist', req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  // Lire d'abord, répondre ensuite : sinon l'en-tête 200 part avant de savoir si le
  // fichier existe, et le 404 de rattrapage plante le serveur.
  let corps;
  try { corps = await readFile(chemin); } catch (e) { rs.writeHead(404).end(); return; }
  rs.writeHead(200, { 'Content-Type': TYPES[extname(chemin)] || 'application/octet-stream' }).end(corps);
});
await new Promise((r) => srv.listen(0, r));
const url = 'http://127.0.0.1:' + srv.address().port + '/';

// 3. jouer
const { chromium } = await import('playwright');
// Un Chromium déjà installé sur la machine sert s'il est là (variable LINKFOOT_CHROMIUM
// ou chemin habituel des conteneurs) ; sinon Playwright prend le sien, celui que
// `npx playwright install chromium` télécharge, ce que fait l'intégration continue.
const { existsSync } = await import('node:fs');
const local = process.env.LINKFOOT_CHROMIUM || '/opt/pw-browsers/chromium';
const b = await chromium.launch(existsSync(local) ? { executablePath: local } : {});
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const erreurs = [];
const ouvre = async () => {
  const pg = await ctx.newPage();
  pg.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text().slice(0, 160)); });
  pg.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));
  await pg.goto(url, { waitUntil: 'load' });
  await pg.waitForTimeout(4000);
  return pg;
};
const lit = async (pg) => (await pg.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
const touche = (pg, texte) => pg.evaluate((v) => {
  const e = [...document.querySelectorAll('*')].find((x) => !x.children.length && x.textContent.trim() === v);
  if (!e) return false; e.click(); return true;
}, texte);

console.log('\n§2 Premier lancement : le club est créé');
const p1 = await ouvre();
const a = await lit(p1);
t('le joueur commence au niveau 1', /\b1 niveau/.test(a), (a.match(/(\d+) niveau/) || [])[0]);
t('avec 600 jetons', /\b600\b/.test(a));
t('et quinze joueurs : quatorze normaux et le joueur rare offert', /15 joueurs/.test(a), (a.match(/(\d+) joueurs/) || [])[0]);

console.log('\nLes six onglets s’ouvrent sans erreur');
for (const o of ['Effectif', 'Match', 'Entraîn.', 'Packs', 'En ligne', 'Accueil']) {
  erreurs.length = 0;
  const trouve = await touche(p1, o);
  await p1.waitForTimeout(900);
  t(o, trouve && !erreurs.length, erreurs[0] || '');
}

// §17 la section DIRECTEUR SPORTIF : ses neuf entrées, chacune vers un vrai écran.
console.log('\n§17 DIRECTEUR SPORTIF : les neuf entrées mènent à leur écran');
t('la section est sur l’accueil', /DIRECTEUR SPORTIF/.test(await lit(p1)));
const ENTREES = [['Mon effectif', /Effectif/], ['Compétences', /combinaisons possibles/], ['Pack', /OUVRIR LE PACK/],
  ['Entraînement', /Séances disponibles/], ['Transferts', /VENDRE/], ['Quêtes', /Plafond du jour/],
  ['Finances', /JOURNAL DES TRANSACTIONS/], ['Tactique', /FORMATION/], ['Club', /PROGRESSION DU CLUB/]];
for (const [entree, attendu] of ENTREES) {
  erreurs.length = 0;
  await touche(p1, 'Accueil');
  await p1.waitForTimeout(500);
  const trouve = await touche(p1, entree);
  await p1.waitForTimeout(900);
  const vu = await lit(p1);
  t(entree, trouve && attendu.test(vu) && !erreurs.length, erreurs[0] || (trouve ? '' : 'entrée introuvable'));
}

console.log('\n§8 et §19 Le pack unique s’ouvre, et ce qu’on fait se garde');
await touche(p1, 'Packs');
await p1.waitForTimeout(700);
t('§9 la part de chaque famille est affichée avant l’ouverture', /CE QUE PEUT DONNER CHAQUE TIRAGE/.test(await lit(p1)));
await touche(p1, 'OUVRIR LE PACK · 250 jetons');
await p1.waitForTimeout(1800);
t('le pack s’ouvre et dit ce qu’il a donné', /Dernier tirage/.test(await lit(p1)));
// le pack a pu donner un joueur : on relève l'effectif tel qu'il est APRÈS l'ouverture
await touche(p1, 'Accueil');
await p1.waitForTimeout(600);
const effectif = ((await lit(p1)).match(/(\d+) joueurs/) || [])[1];
await p1.close();

const p2 = await ouvre();
const c = await lit(p2);
t('au second lancement, la partie est retrouvée : 350 jetons', /\b350\b/.test(c));
t('et le club n’est pas recréé : le même effectif qu’avant de fermer', !!effectif && new RegExp('\\b' + effectif + ' joueurs').test(c),
  effectif + ' joueurs avant, ' + ((c.match(/(\d+) joueurs/) || [])[1]) + ' après');
t('aucune erreur dans la console sur tout le parcours', !erreurs.length, erreurs[0] || '');

await b.close();
srv.close();
console.log('\n' + (ko ? 'ÉCHECS : ' + ko + ' sur ' + (ok + ko) : 'OK : ' + ok + ' vérifications, l’app tourne comme un joueur la verrait'));
process.exit(ko ? 1 : 0);
