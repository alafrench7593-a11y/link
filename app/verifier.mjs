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
// joueur : premier lancement, les onglets (Accueil, Explorer, Match, Mon Club, Profil) et les
// écrans du jeu, les neuf entrées du directeur sportif, le pack ouvert, le match en direct,
// le réseau social (publier, relier X, suivre), second lancement.
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
// toucher le texte exact ; à défaut, le bouton qui porte ce nom (les boutons ronds de la barre du
// haut, En ligne et Quêtes, n'ont qu'une icône et leur nom pour les lecteurs d'écran)
const touche = (pg, texte) => pg.evaluate((v) => {
  const e = [...document.querySelectorAll('*')].find((x) => !x.children.length && x.textContent.trim() === v)
    || document.querySelector('[aria-label="' + v + '"]');
  if (!e) return false; e.click(); return true;
}, texte);

console.log('\n§2 Premier lancement : le club est créé');
const p1 = await ouvre();
await touche(p1, 'Mon Club');
await p1.waitForTimeout(600);
const a = await lit(p1);
t('le joueur commence au niveau 1', /\b1 niveau/.test(a), (a.match(/(\d+) niveau/) || [])[0]);
t('avec 600 jetons', /\b600\b/.test(a));
t('et quinze joueurs : quatorze normaux et le joueur rare offert', /15 joueurs/.test(a), (a.match(/(\d+) joueurs/) || [])[0]);

console.log('\nLes onglets s’ouvrent sans erreur (cinq en bas ; les écrans du jeu depuis Mon Club)');
for (const [o, avant] of [['Explorer'], ['Match'], ['Profil'], ['Accueil'], ['Mon Club'], ['Effectif', 'Mon Club'],
  ['Entraîn.', 'Mon Club'], ['Packs', 'Mon Club'], ['En ligne', 'Mon Club']]) {
  erreurs.length = 0;
  if (avant) { await touche(p1, avant); await p1.waitForTimeout(400); }
  const trouve = await touche(p1, o);
  await p1.waitForTimeout(900);
  t(o, trouve && !erreurs.length, erreurs[0] || '');
}

// §17 la section DIRECTEUR SPORTIF : ses neuf entrées, chacune vers un vrai écran.
console.log('\n§17 DIRECTEUR SPORTIF : les neuf entrées mènent à leur écran');
await touche(p1, 'Mon Club');
await p1.waitForTimeout(500);
t('la section est dans Mon Club', /DIRECTEUR SPORTIF/.test(await lit(p1)));
const ENTREES = [['Mon effectif', /Effectif/], ['Compétences', /combinaisons possibles/], ['Pack', /OUVRIR LE PACK/],
  ['Entraînement', /Séances disponibles/], ['Transferts', /VENDRE/], ['Quêtes', /Plafond du jour/],
  ['Finances', /JOURNAL DES TRANSACTIONS/], ['Tactique', /FORMATION/], ['Club', /PROGRESSION DU CLUB/]];
for (const [entree, attendu] of ENTREES) {
  erreurs.length = 0;
  await touche(p1, 'Mon Club');
  await p1.waitForTimeout(500);
  const trouve = await touche(p1, entree);
  await p1.waitForTimeout(900);
  const vu = await lit(p1);
  t(entree, trouve && attendu.test(vu) && !erreurs.length, erreurs[0] || (trouve ? '' : 'entrée introuvable'));
}

console.log('\n§8 et §19 Le pack unique s’ouvre, et ce qu’on fait se garde');
await touche(p1, 'Mon Club');
await p1.waitForTimeout(400);
await touche(p1, 'Packs');
await p1.waitForTimeout(700);
t('§9 la part de chaque famille est affichée avant l’ouverture', /CE QUE PEUT DONNER CHAQUE TIRAGE/.test(await lit(p1)));
const avant3d = await p1.evaluate(() => document.querySelectorAll('canvas').length);
t('§11 le pack est en 3D au centre de l’écran Pack', avant3d >= 1, avant3d + ' canvas');
await touche(p1, 'OUVRIR LE PACK · 250 jetons');
// l'éclat du pack 3D, puis les trois lots un par un : 1,6 s environ
await p1.waitForTimeout(2600);
const apres = await lit(p1);
t('le pack s’ouvre et dit ce qu’il a donné', /Dernier tirage/.test(apres));
const lots = await p1.evaluate(() => { const r = document.querySelector('[data-testid="revelation"]'); return r ? [...r.children].map((x) => x.innerText.replace(/\s+/g, ' ')) : []; });
t('§11 les trois lots se révèlent sous le pack, avec leur rareté', lots.length === 3 && lots.every((l) => /^(Normal|Rare|Épique|Élite|Gold|Legendary) /.test(l)), lots.join(' | '));
// le pack a pu donner un joueur : on relève l'effectif tel qu'il est APRÈS l'ouverture
await touche(p1, 'Mon Club');
await p1.waitForTimeout(600);
const effectif = ((await lit(p1)).match(/(\d+) joueurs/) || [])[1];
await p1.close();

const p2 = await ouvre();
await touche(p2, 'Mon Club');
await p2.waitForTimeout(600);
const c = await lit(p2);
t('au second lancement, la partie est retrouvée : 350 jetons', /\b350\b/.test(c));
t('et le club n’est pas recréé : le même effectif qu’avant de fermer', !!effectif && new RegExp('\\b' + effectif + ' joueurs').test(c),
  effectif + ' joueurs avant, ' + ((c.match(/(\d+) joueurs/) || [])[1]) + ' après');
t('aucune erreur dans la console sur tout le parcours', !erreurs.length, erreurs[0] || '');

// §2 « composition » : le onze se choisit poste par poste, dans l'effectif.
console.log('\n§2 La composition se choisit');
// cliquer sur le premier texte qui CONTIENT `v` (une ligne de liste, dont le Pressable reçoit le clic)
const toucheContient = (pg, v) => pg.evaluate((x) => {
  const e = [...document.querySelectorAll('*')].find((y) => !y.children.length && y.textContent.includes(x));
  if (!e) return false; e.click(); return true;
}, v);
erreurs.length = 0;
await touche(p2, 'Mon Club');
await p2.waitForTimeout(400);
await touche(p2, 'Effectif');
await p2.waitForTimeout(700);
t('l’effectif montre le onze, automatique au départ', /LE ONZE · 4-3-3 · AUTOMATIQUE/.test(await lit(p2)));
await touche(p2, 'GB');
await p2.waitForTimeout(500);
t('toucher un poste ouvre le choix du joueur', /QUI JOUE À LA PLACE DE/.test(await lit(p2)));
await toucheContient(p2, '· remplaçant');
await p2.waitForTimeout(600);
t('le joueur choisi entre dans le onze, et l’écran le dit', /CHOISI PAR TOI/.test(await lit(p2)), erreurs[0] || '');

// §2 « remplacements, décisions pendant le match » : le match du calendrier, en direct.
console.log('\n§2 Pendant le match, le directeur sportif décide');
await touche(p2, 'Match');
await p2.waitForTimeout(600);
await touche(p2, 'Jouer');
await p2.waitForTimeout(1200);
let vu = await lit(p2);
t('le match se joue en direct', /CHAMPIONNAT · EN DIRECT/.test(vu), (vu.match(/EN DIRECT · ([^ ]+)/) || [])[1]);
await touche(p2, 'Pause');
await p2.waitForTimeout(400);
const m1 = ((await lit(p2)).match(/EN DIRECT · (\d+)/) || [])[1];
await p2.waitForTimeout(1200);
const m2 = ((await lit(p2)).match(/EN DIRECT · (\d+)/) || [])[1];
t('la pause arrête le temps', !!m1 && m1 === m2, m1 + "' puis " + m2 + "'");
// §28 le match se regarde en 3D, la vue 2D reste à un geste
const en3d = await p2.evaluate(() => document.querySelectorAll('canvas').length);
await touche(p2, 'VUE 2D');
await p2.waitForTimeout(500);
const en2d = await p2.evaluate(() => document.querySelectorAll('canvas').length);
await touche(p2, 'VUE 3D');
await p2.waitForTimeout(800);
const retour = await p2.evaluate(() => document.querySelectorAll('canvas').length);
t('§28 le match se regarde en 3D, et la vue 2D reste en bascule', en3d >= 1 && en2d === 0 && retour >= 1, en3d + ' canvas en 3D, ' + en2d + ' en 2D, ' + retour + ' au retour');
// les joueurs de la vue 3D sont de vrais corps animés par de vraies captures (rendu/labo/reel.js)
const reel = await p2.waitForFunction(() => (window.__LF_REEL && window.__LF_REEL.pas > 0 ? Object.assign({}, window.__LF_REEL) : null), null, { timeout: 30000 })
  .then((h) => h.jsonValue()).catch(() => null);
t('§28 les joueurs de la vue 3D sont de vrais corps, animés par de vraies captures', !!reel,
  reel ? `${reel.images} images du moteur lues, ${reel.pas} pas des corps, ${(reel.ms / Math.max(1, reel.pas)).toFixed(1)} ms par pas` : 'rendu réel absent');
if (process.env.LINKFOOT_CAPTURE) { await p2.waitForTimeout(1500); await p2.screenshot({ path: process.env.LINKFOOT_CAPTURE }); }
// le salon du match : une réaction se compte, le score se partage sur X
await p2.click('[aria-label="Réaction 🔥"]');
await p2.waitForTimeout(300);
const salon = await p2.evaluate(() => {
  const r = document.querySelector('[aria-label="Réaction 🔥"]');
  const x = [...document.querySelectorAll('a')].map((a) => a.href).find((h) => h.startsWith('https://twitter.com/intent/tweet?text='));
  return { n: r ? r.innerText.replace(/\s+/g, ' ').trim() : '', x: x ? decodeURIComponent(x.split('text=')[1]).slice(0, 70) : '' };
});
t('le salon du match : une réaction se compte, et le score se partage sur X', /🔥 1/.test(salon.n) && /en direct sur LinkFoot/.test(salon.x), salon.n + ' · ' + salon.x);
await touche(p2, 'Exiger plus');
await p2.waitForTimeout(400);
t('une consigne de la voix s’applique, et son effet est écrit', /Exiger plus : Pressing plus large/.test(await lit(p2)));
// §6 du cahier du match : la tactique change pendant le match
await touche(p2, 'Très intense');
await p2.waitForTimeout(300);
await touche(p2, '4-2-4');
await p2.waitForTimeout(400);
vu = await lit(p2);
t('§6 la tactique change en direct : pressing très intense, 4-2-4', /Toi : Formation : 4-2-4/.test(vu) && /Toi : Pressing : Très intense/.test(vu) && /TACTIQUE EN DIRECT · 4-2-4/.test(vu));
// §7 l'AUTO COACH se choisit, et dit ce qu'il fera
await touche(p2, 'Auto coach');
await p2.waitForTimeout(300);
t('§7 l’AUTO COACH se met en route', /Le coach IA décide seul/.test(await lit(p2)));
await touche(p2, 'Manuel');
await p2.waitForTimeout(300);
await touche(p2, 'ATT');
await p2.waitForTimeout(400);
const ok1 = await p2.evaluate(() => {
  const e = [...document.querySelectorAll('*')].find((y) => !y.children.length && /^Qui remplace /.test(y.textContent));
  const ligne = e && e.parentElement && e.parentElement.children[1];
  if (!ligne) return false; ligne.click(); return true;
});
await p2.waitForTimeout(500);
vu = await lit(p2);
t('un remplacement se fait depuis le banc', ok1 && /CHANGEMENTS · 1 \/ 5/.test(vu) && /Toi : .+ remplace /.test(vu), (vu.match(/Toi : [^']+/) || [])[0]);
await touche(p2, 'Reprendre');
await touche(p2, 'Résultat direct');
for (let i = 0; i < 40 && !/TES DÉCISIONS/.test(await lit(p2)); i++) await p2.waitForTimeout(500);
vu = await lit(p2);
t('le match va au bout, et le résultat rappelle tes décisions', /CHAMPIONNAT/.test(vu) && /TES DÉCISIONS/.test(vu) && /remplace/.test(vu) && /Consigne : Exiger plus/.test(vu));
const partage = await p2.evaluate(() => {
  const x = [...document.querySelectorAll('a')].map((a) => decodeURIComponent(a.href)).find((h) => /intent\/tweet\?text=.+\d-\d .+division/.test(h));
  return x ? x.split('text=')[1].slice(0, 80) : '';
});
t('le résultat se partage sur X, score compris', !!partage, partage);
await touche(p2, 'Le classement');
await p2.waitForTimeout(800);
vu = await lit(p2);
t('§22 la journée est jouée pour toute la division', /JOURNÉE 1 · RÉSULTATS/.test(vu) && /Journée 2 sur 5|journée 2 sur 5/.test(vu), (vu.match(/[Jj]ournée \d sur 5/) || [])[0]);
t('aucune erreur dans la console pendant le match', !erreurs.length, erreurs[0] || '');
await p2.close();

const p3 = await ouvre();
await touche(p3, 'Mon Club');
await p3.waitForTimeout(500);
t('au lancement suivant, la division a avancé : le prochain match est la journée 2', /Journée 2\/5 contre/.test(await lit(p3)));

// fermer l'app pendant le direct ne fait pas fuir le match : il se rejoue au retour
console.log('\n§2 Fermer l’app pendant le match ne l’efface pas');
await touche(p3, 'Match');
await p3.waitForTimeout(600);
await touche(p3, 'Jouer');
await p3.waitForTimeout(2500);
t('le match de la journée 2 est en direct', /CHAMPIONNAT · EN DIRECT/.test(await lit(p3)));
await p3.waitForTimeout(1000);          // la sauvegarde écrit après 600 ms
await p3.close();                       // l'app est fermée en plein match
const p4 = await ouvre();
await touche(p4, 'Mon Club');
await p4.waitForTimeout(600);
vu = await lit(p4);
t('au retour, le match interrompu a été joué jusqu’au bout', /Match interrompu contre .+ joué jusqu’au bout/.test(vu), (vu.match(/Match interrompu[^·]+/) || [])[0]);
t('   et la division est passée à la journée 3', /Journée 3\/5 contre/.test(vu));
t('aucune erreur dans la console au retour', !erreurs.length, erreurs[0] || '');
await p4.close();

// Le réseau social : l'accueil, publier un post (aussi sur X), relier son compte X, suivre.
// Les autres personnes sont des exemples étiquetés tant que le serveur en ligne n'est pas branché.
console.log('\nLe réseau social : publier, relier X, suivre');
const p5 = await ouvre();
erreurs.length = 0;
await touche(p5, 'Accueil');
await p5.waitForTimeout(500);
vu = await lit(p5);
t('l’accueil est le réseau : le direct de la division, le fil, le journal de la partie, des exemples étiquetés',
  /En direct/.test(vu) && /Le fil/.test(vu) && /LinkFoot Journal/.test(vu) && /EXEMPLE/.test(vu));
await touche(p5, 'Profil');
await p5.waitForTimeout(400);
await touche(p5, 'Modifier le profil');
await p5.waitForTimeout(300);
await p5.fill('[aria-label="Pseudo X"]', '@essai_linkfoot');
await touche(p5, 'Enregistrer');
await p5.waitForTimeout(400);
const lienX = await p5.evaluate(() => [...document.querySelectorAll('a')].map((a) => a.href).find((h) => h === 'https://x.com/essai_linkfoot'));
t('le profil relie un compte X : un vrai lien vers x.com', !!lienX, lienX || 'aucun lien');
await p5.click('[aria-label="Publier"]');
await p5.waitForTimeout(300);
await touche(p5, 'Post');
await p5.waitForTimeout(200);
await p5.fill('[aria-label="Texte du post"]', 'Essai du vérificateur');
await touche(p5, 'Publier le post');
await p5.waitForTimeout(400);
const intention = await p5.evaluate(() => [...document.querySelectorAll('a')].map((a) => decodeURIComponent(a.href)).find((h) => h.startsWith('https://twitter.com/intent/tweet?text=Essai du vérificateur')));
t('un post se publie, et « Aussi sur X » ouvre X avec le même texte', /C’est publié/.test(await lit(p5)) && !!intention, intention ? intention.slice(0, 70) : '');
await touche(p5, 'Voir le fil');
await p5.waitForTimeout(500);
t('le post est dans le fil', /Essai du vérificateur/.test(await lit(p5)));
await touche(p5, 'Suivre');
await p5.waitForTimeout(300);
t('suivre une personne (un exemple)', /Suivi/.test(await lit(p5)));
await p5.waitForTimeout(700);           // le réseau s'enregistre après 400 ms
await p5.close();
const p6 = await ouvre();
await touche(p6, 'Accueil');
await p6.waitForTimeout(500);
vu = await lit(p6);
t('au lancement suivant, le post, le suivi et le compte X sont gardés', /Essai du vérificateur/.test(vu) && /Suivi/.test(vu) && /aussi sur X/.test(vu));
t('aucune erreur dans la console sur le réseau social', !erreurs.length, erreurs[0] || '');
await p6.close();

await b.close();
srv.close();
console.log('\n' + (ko ? 'ÉCHECS : ' + ko + ' sur ' + (ok + ko) : 'OK : ' + ok + ' vérifications, l’app tourne comme un joueur la verrait'));
process.exit(ko ? 1 : 0);
