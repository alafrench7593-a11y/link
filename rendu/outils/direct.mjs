// Le match en direct de l'app, filmé avec ses vrais corps : la vue 3D de l'app (src/stade3d.js)
// et le rendu réel (labo/reel.js) sur un match que le moteur joue en direct (src/direct.js), dans
// la page d'essai labo/essai-reel.html. Le moteur joue jusqu'au premier but (ou jusqu'à l'instant
// demandé) ; on filme de t1 à t2 autour de lui, à 30 images par seconde, comme l'app le montre.
//   node rendu/outils/direct.mjs <sortie> [graine] [t1 t2 en secondes autour du but, ou absolues avec @] [largeur] [hauteur] [reel=0]
//   node rendu/outils/direct.mjs but 5 -5 3 390 320           le premier but, de 5 s avant à 3 s après
//   node rendu/outils/direct.mjs debut 5 @20 @26              de la 20e à la 26e seconde de jeu
// Sortie : <sortie>.mp4, <sortie>.png (planche de six images), et le temps de calcul des corps.
import { chromium } from '../../app/node_modules/playwright/index.mjs';
import { demarrer } from './serveur.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [sortie, graine = '5', a1 = '-5', a2 = '3', largeur = '390', hauteur = '320', option = ''] = process.argv.slice(2);
if (!sortie) { console.log('usage : direct.mjs <sortie> [graine] [t1] [t2] [largeur] [hauteur] [reel=0]'); process.exit(2); }
const FPS = 30;
const { serveur, port } = await demarrer();
const nav = await chromium.launch({ executablePath: process.env.LINKFOOT_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await nav.newPage({ viewport: { width: Number(largeur), height: Number(hauteur) } });
const erreurs = [];
p.on('pageerror', (e) => erreurs.push(e.message));
await p.goto(`http://127.0.0.1:${port}/rendu/labo/essai-reel.html?pilote=1&seed=${graine}&l=${largeur}&h=${hauteur}&${option}`);
await p.waitForFunction(() => window.pret === true, null, { timeout: 300000 });
// l'instant de référence : le premier but (le moteur joue jusqu'à lui), ou des instants absolus
let ref = 0, quoi = 'instants demandés';
if (!a1.startsWith('@')) {
  ref = await p.evaluate(() => {
    const e = window.essai;
    for (let t = 30; t < 5600; t += 30) { e.avancer(t); const b = e.evenements().find((x) => x.k === 'goal'); if (b) return b.t; }
    return -1;
  });
  if (ref < 0) { console.log('pas de but dans ce match'); process.exit(1); }
  quoi = 'premier but à ' + ref.toFixed(1) + ' s de jeu';
}
const t1 = ref + Number(a1.replace('@', '')), t2 = ref + Number(a2.replace('@', ''));
await p.evaluate((t) => window.essai.avancer(t), t2);
// les corps entrent dans le mouvement avant t1
for (let t = t1 - 2; t < t1; t += 0.5) await p.evaluate((x) => window.essai.montrer(x), t);
const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'direct-'));
const n = Math.max(2, Math.round((t2 - t1) * FPS));
for (let k = 0; k <= n; k++) {
  await p.evaluate((x) => window.essai.montrer(x), t1 + k / FPS);
  await (await p.$('canvas')).screenshot({ path: path.join(dossier, String(k).padStart(5, '0') + '.png') });
}
const mesure = await p.evaluate(() => (window.essai.reel ? Object.assign({}, window.essai.reel.mesure) : null));
await nav.close(); serveur.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dossier, '%05d.png'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', sortie + '.mp4']);
const choix = [0, 1, 2, 3, 4, 5].map((i) => path.join(dossier, String(Math.round(i * n / 5)).padStart(5, '0') + '.png'));
execFileSync('montage', [...choix, '-tile', '6x1', '-geometry', '+2+2', '-background', '#16191d', sortie + '.png']);
fs.rmSync(dossier, { recursive: true, force: true });
console.log(`${sortie}.mp4 (${n + 1} images), ${sortie}.png ; ${quoi}, de ${t1.toFixed(1)} à ${t2.toFixed(1)} s`
  + (mesure ? ` ; corps : ${(mesure.ms / Math.max(1, mesure.pas)).toFixed(1)} ms par pas de 1/60 s pour 22 joueurs` : ' ; sans les vrais corps')
  + (erreurs.length ? ' ; ERREURS : ' + erreurs.slice(0, 3).join(' | ') : ''));
