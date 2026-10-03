// Filmer la vitrine des gestes (labo/gestes.html) : pour chaque clip demandé, une ligne de six
// images régulières (la planche) et le clip en entier à 30 i/s (le film), chaque image nommée.
//   node rendu/outils/gestes.mjs <dossier de sortie> "<clips ou catégories>" [perso=<url>] [base=<dossier de la base>] [vue=profil] [largeur] [hauteur]
import { chromium } from '../../app/node_modules/playwright/index.mjs';
import { demarrer } from './serveur.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [sortie = 'gestes', clips = 'glisse', ...reste] = process.argv.slice(2);
const opt = Object.fromEntries(reste.filter((x) => x.includes('=')).map((x) => [x.slice(0, x.indexOf('=')), x.slice(x.indexOf('=') + 1)]));
const nombres = reste.filter((x) => /^\d+$/.test(x));
const largeur = nombres[0] || '480', hauteur = nombres[1] || '360';
fs.mkdirSync(sortie, { recursive: true });
const images = path.join(sortie, 'images');
fs.rmSync(images, { recursive: true, force: true }); fs.mkdirSync(images, { recursive: true });
const { serveur, port } = await demarrer();
const nav = await chromium.launch({ executablePath: process.env.LINKFOOT_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await nav.newPage({ viewport: { width: Number(largeur), height: Number(hauteur) } });
p.on('pageerror', (e) => console.log('erreur', e.message));
const q = new URLSearchParams({ l: largeur, h: hauteur, clips, vue: opt.vue || 'profil' });
if (opt.perso) q.set('perso', opt.perso);
if (opt.base) q.set('base', opt.base);
await p.goto(`http://127.0.0.1:${port}/rendu/labo/gestes.html?${q}`);
await p.waitForFunction(() => window.pret === true, null, { timeout: 300000 });
const liste = await p.evaluate(() => window.vitrine.clips);
const lignes = [];
let k = 0;
const etiquette = (f, texte) => execFileSync('convert', [f, '-gravity', 'northwest', '-pointsize', String(Math.round(Number(hauteur) / 22)),
  '-fill', 'white', '-undercolor', '#000000aa', '-annotate', '+6+6', ` ${texte} `, f]);
for (const c of liste) {
  const nb = Math.max(1, Math.round(c.duree * 30) + 6);     // 0,2 s de plus : la fin du geste
  const planche = [];
  const pas = Math.max(1, Math.floor(nb / 5));
  for (let i = 0; i <= nb; i++) {
    await p.evaluate(([nom, t]) => window.vitrine.poser(nom, t), [c.nom, i / 30]);
    const f = path.join(images, `${String(k++).padStart(5, '0')}.png`);
    await (await p.$('canvas')).screenshot({ path: f });
    etiquette(f, `${c.categorie} : ${c.nom.replace(/^grf:/, '')}`);
    if (i % pas === 0 && planche.length < 6) planche.push(f);
  }
  const ligne = path.join(sortie, `ligne_${lignes.length}.png`);
  execFileSync('montage', [...planche, '-tile', `${planche.length}x1`, '-geometry', '+2+2', '-background', '#16191d', ligne]);
  lignes.push(ligne);
  console.log(`${c.categorie.padEnd(16)} ${c.nom} (${c.duree.toFixed(2)} s${c.contact ? `, contact ${c.contact.partie} à l'image ${c.contact.image}` : ''})`);
}
await nav.close(); serveur.close();
execFileSync('montage', [...lignes, '-tile', '1x', '-geometry', '+0+2', '-background', '#16191d', path.join(sortie, 'gestes.png')]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(images, '%05d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', path.join(sortie, 'gestes.mp4')]);
console.log(path.join(sortie, 'gestes.png'), path.join(sortie, 'gestes.mp4'));
