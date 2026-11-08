// Captures réelles de l'app IRLY pour le studio vidéo.
// On sert la version web DÉMO de l'app (EXPO_PUBLIC_DEMO=1 : aucun serveur, rien n'est
// enregistré, aucun compte touché) et on photographie ses écrans au format iPhone.
//
//   cd <app irly> && EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir <dist>
//   node tools/capture_app.mjs <dist> <dossier de sortie> [fr|en]
//
// Playwright : NODE_PATH vers un dossier qui contient playwright ; Chromium : PW_CHROMIUM.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist, outDir, lang = 'fr'] = process.argv.slice(2);
if (!dist || !outDir) {
  console.error('usage: node capture_app.mjs <dist> <out> [fr|en]');
  process.exit(2);
}
const DIST = path.resolve(dist);
fs.mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  let file = path.join(DIST, decodeURIComponent((req.url ?? '/').split('?')[0]));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(8743);
const BASE = 'http://localhost:8743';

// Les écrans montrés dans les vidéos : [nom, route, espace, membre déjà inscrit ?]
const SHOTS = [
  ['02_inscription', '/onboarding/you', 'mixte', false],
  ['03_accueil', '/', 'mixte', true],
  ['04_decouvrir', '/discover', 'mixte', true],
  ['05_activites', '/activities', 'mixte', true],
  ['06_communautes', '/communities', 'mixte', true],
  ['08_girl_accueil', '/girl', 'girl', true],
  ['09_girl_communautes', '/communities', 'girl', true],
  ['10_network', '/network', 'mixte', true],
  ['11_creer', '/girl/new-community', 'girl', true],
];

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const results = [];
for (const [name, route, space, onboarded] of SHOTS) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
    locale: lang === 'fr' ? 'fr-FR' : 'en-US', colorScheme: 'dark' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/`);
  await page.evaluate(({ space, onboarded, lang }) => {
    localStorage.clear();
    if (onboarded) {
      localStorage.setItem('irly-v2-demo', JSON.stringify({ state: { onboarded: true, storySeen: 99, communityIntroSeen: true,
        destinationId: 'emirates', cityId: 'dubai', profile: { name: 'Demo', gender: 'woman', age: 29, types: [],
          interests: ['food'], activities: ['padel'], languages: ['Français'], lookingFor: [] } }, version: 1 }));
    }
    localStorage.setItem('irly-lang-demo', JSON.stringify({ state: { setting: lang }, version: 0 }));
    localStorage.setItem('irly-space-demo', JSON.stringify({ state: { space }, version: 1 }));
  }, { space, onboarded, lang });
  await page.goto(`${BASE}${route}`);
  await page.waitForTimeout(5000);
  // Le bandeau « Démo · rien n'est enregistré » n'existe que dans la version démo : on le masque.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('div, span')) {
      if (el.children.length === 0 && /rien n.est enregistré|nothing is saved/i.test(el.textContent || '')) {
        let box = el;
        for (let i = 0; i < 6 && box.parentElement; i++) {
          const pos = getComputedStyle(box).position;
          if (pos === 'fixed' || pos === 'absolute') break;
          box = box.parentElement;
        }
        box.style.visibility = 'hidden';
      }
    }
  });
  await page.waitForTimeout(300);
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file });
  results.push({ name, route, space, url: page.url().replace(BASE, ''), errors: errors.length });
  console.log(`${name}  ${route} -> ${page.url().replace(BASE, '')}  erreurs:${errors.length}`);
  await ctx.close();
}
fs.writeFileSync(path.join(outDir, 'captures.json'), JSON.stringify({ source: 'IRLY web DEMO build (EXPO_PUBLIC_DEMO=1)',
  captured: new Date().toISOString(), lang, shots: results }, null, 2));
await browser.close();
server.close();
