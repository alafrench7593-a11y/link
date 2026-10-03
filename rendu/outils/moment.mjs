// Un moment d'une scène du moteur, filmé dans le labo : de t1 à t2, à 30 images par seconde,
// avec le corps et la caméra voulus. Rien n'est mis en scène : c'est le document du moteur, joué.
//   node rendu/outils/moment.mjs <sortie (sans extension)> "<paramètres d'URL>" <t1> <t2> [largeur] [hauteur]
// Exemple (un contrôle de la poitrine, le footballeur de Gameplay Football, caméra de profil) :
//   node rendu/outils/moment.mjs controle "doc=/rendu/labo/scenes/controle_haut.json&joueurs=tous&focus=10&camera=cote&perso=/unreal/LinkFoot/SourceArt/Characters/Players/GameplayFootball/SK_LinkFoot_GPF.glb" 70 72
// Sortie : <sortie>.mp4 et <sortie>.png (planche de six images régulières), et le nombre de
// glissements de pied comptés par le détecteur pendant le film.
import { chromium } from '../../app/node_modules/playwright/index.mjs';
import { demarrer } from './serveur.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [sortie, requete, t1s, t2s, largeur = '640', hauteur = '360'] = process.argv.slice(2);
if (!sortie || !requete || t1s == null || t2s == null) { console.log('usage : moment.mjs <sortie> "<paramètres>" <t1> <t2> [largeur] [hauteur]'); process.exit(2); }
const t1 = Number(t1s), t2 = Number(t2s), FPS = 30;
const { serveur, port } = await demarrer();
const nav = await chromium.launch({ executablePath: process.env.LINKFOOT_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await nav.newPage({ viewport: { width: Number(largeur), height: Number(hauteur) } });
p.on('pageerror', (e) => console.log('erreur : ' + e.message));
await p.goto(`http://127.0.0.1:${port}/rendu/labo/index.html?l=${largeur}&h=${hauteur}&hud=0&${requete}`);
await p.waitForFunction(() => window.pret === true, null, { timeout: 300000 });
const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'filmer-'));
await p.evaluate((t) => window.labo.aller(t), t1 - 1.0);   // le corps entre dans le mouvement avant t1
const n = Math.max(2, Math.round((t2 - t1) * FPS));
for (let k = 0; k <= n; k++) {
  await p.evaluate((t) => window.labo.aller(t), t1 + k / FPS);
  await (await p.$('canvas')).screenshot({ path: path.join(dossier, String(k).padStart(5, '0') + '.png') });
}
const glissements = await p.evaluate(() => window.labo.joueurs.reduce((a, j) => a + j.A.detecteurs().reduce((b, d) => b + d.glissements, 0), 0));
await nav.close(); serveur.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dossier, '%05d.png'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', sortie + '.mp4']);
const choix = [0, 1, 2, 3, 4, 5].map((i) => path.join(dossier, String(Math.round(i * n / 5)).padStart(5, '0') + '.png'));
execFileSync('montage', [...choix, '-tile', '6x1', '-geometry', '+2+2', '-background', '#16191d', sortie + '.png']);
console.log(`${sortie}.mp4 (${n + 1} images), ${sortie}.png ; ${glissements} glissement(s) de pied`);
