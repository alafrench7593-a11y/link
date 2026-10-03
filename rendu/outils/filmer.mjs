// Filmer une scène du laboratoire : on avance le temps image par image (30 i/s), on photographie
// la toile, puis ffmpeg en fait une vidéo (et un GIF si demandé).
//   node rendu/outils/filmer.mjs <sortie.mp4> "<paramètres d'URL>" [durée s] [début relatif s]
import { chromium } from '../../app/node_modules/playwright/index.mjs';
import { demarrer } from './serveur.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [sortie, requete = '', duree = '0', debut = '0', largeur = '1280', hauteur = '720', fps = '30'] = process.argv.slice(2);
const dossier = sortie.replace(/\.[^.]+$/, '') + '_images';
fs.rmSync(dossier, { recursive: true, force: true }); fs.mkdirSync(dossier, { recursive: true });
const { serveur, port } = await demarrer();
const nav = await chromium.launch({ executablePath: process.env.LINKFOOT_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await nav.newPage({ viewport: { width: Number(largeur), height: Number(hauteur) } });
const msgs = [];
p.on('console', (m) => { if (m.type() !== 'log') msgs.push(m.type() + ': ' + m.text()); });
p.on('pageerror', (e) => msgs.push('erreur: ' + e.message));
await p.goto(`http://127.0.0.1:${port}/rendu/labo/index.html?l=${largeur}&h=${hauteur}&${requete}`);
await p.waitForFunction(() => window.pret === true, null, { timeout: 300000 }).catch((e) => { console.log(msgs.join('\n')); throw e; });
const { t0, t1 } = await p.evaluate(() => ({ t0: window.labo.t0, t1: window.labo.t1 }));
const a = t0 + 0.1 + Number(debut), b = Number(duree) > 0 ? Math.min(t1 - 0.7, a + Number(duree)) : t1 - 0.7;
const n = Math.floor((b - a) * Number(fps));
const debutMs = Date.now();
for (let k = 0; k < n; k++) {
  await p.evaluate((t) => window.labo.aller(t), a + k / Number(fps));
  const c = await p.$('canvas');
  await c.screenshot({ path: path.join(dossier, String(k).padStart(5, '0') + '.png') });
}
const stats = await p.evaluate(() => window.labo.stats());
await nav.close(); serveur.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', fps, '-i', path.join(dossier, '%05d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', sortie]);
console.log(JSON.stringify({ images: n, secondes: ((Date.now() - debutMs) / 1000).toFixed(0), stats }));
if (msgs.length) console.log(msgs.slice(0, 10).join('\n'));
