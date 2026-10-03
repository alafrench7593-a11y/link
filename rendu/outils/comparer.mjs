// La scène de comparaison des personnages (LINKFOOT_CHARACTER_COMPARISON) : la même scène du
// moteur, jouée depuis son début jusqu'au même instant, vue par la même caméra, avec la même
// lumière, le même terrain et la même résolution ; une image par personnage, côte à côte, nommée.
//   node rendu/outils/comparer.mjs <sortie.png> "<paramètres d'URL communs>" <T> <largeur> <hauteur> "Nom=url" ["Nom=url" ...]
// Une url vide désigne le corps actuel de LinkFoot (MakeHuman) ; sinon, un personnage riggé
// (glTF, GLB ou FBX) servi depuis la racine du dépôt (voir labo/personnage.js).
// Exemple :
//   node rendu/outils/comparer.mjs comparaison.png "doc=/unreal/LinkFoot/Content/LinkFoot/Scenes/01-sprint_droit.json&joueurs=focus&camera=cote" 3 640 480 \
//     "LinkFoot actuel=" "Candidate_01=/unreal/LinkFoot/SourceArt/Characters/Players/Candidates/Candidate_01/Candidate_01.glb"
import { chromium } from '../../app/node_modules/playwright/index.mjs';
import { demarrer } from './serveur.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [sortie, requete, T, largeur = '640', hauteur = '480', ...candidats] = process.argv.slice(2);
if (!sortie || !candidats.length) { console.log('usage : comparer.mjs <sortie.png> "<paramètres>" <T> <largeur> <hauteur> "Nom=url" ...'); process.exit(2); }
const { serveur, port } = await demarrer();
const nav = await chromium.launch({ executablePath: process.env.LINKFOOT_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'comparer-'));
const images = [];
for (const [k, c] of candidats.entries()) {
  const i = c.indexOf('='), nom = c.slice(0, i), url = c.slice(i + 1);
  const p = await nav.newPage({ viewport: { width: Number(largeur), height: Number(hauteur) } });
  p.on('pageerror', (e) => console.log(`${nom} : erreur ${e.message}`));
  await p.goto(`http://127.0.0.1:${port}/rendu/labo/index.html?l=${largeur}&h=${hauteur}&${requete}${url ? '&perso=' + url : ''}`);
  await p.waitForFunction(() => window.pret === true, null, { timeout: 300000 });
  const glissements = await p.evaluate((t) => {
    window.labo.aller(t);
    return window.labo.joueurs.reduce((a, j) => a + j.A.detecteurs().reduce((b, d) => b + d.glissements, 0), 0);
  }, Number(T));
  const f = path.join(dossier, `${k}.png`);
  await (await p.$('canvas')).screenshot({ path: f });
  images.push({ nom, f });
  console.log(`${nom.padEnd(28)} ${glissements} glissement(s) de pied jusqu'à T`);
  await p.close();
}
await nav.close(); serveur.close();
// côte à côte, chaque image sous son nom (ImageMagick)
execFileSync('montage', [...images.flatMap((x) => ['-label', x.nom, x.f]), '-tile', `${images.length}x1`, '-geometry', '+4+4',
  '-pointsize', String(Math.max(14, Math.round(Number(hauteur) / 26))), '-background', '#16191d', '-fill', '#f4f6f8', sortie]);
console.log(sortie);
