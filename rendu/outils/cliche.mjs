// Une photo à l'instant T d'une scène jouée depuis son début (les gestes, la fatigue et les
// célébrations ont besoin de leur histoire, ce que photo.mjs, qui part de T, ne leur donne pas).
//   node rendu/outils/cliche.mjs "<paramètres d'URL>" <T> <sortie.png> [largeur] [hauteur]
import { chromium } from '../../app/node_modules/playwright/index.mjs';
import { demarrer } from './serveur.mjs';

const [requete = '', T = '0', sortie = 'cliche.png', largeur = '960', hauteur = '540'] = process.argv.slice(2);
const { serveur, port } = await demarrer();
const nav = await chromium.launch({ executablePath: process.env.LINKFOOT_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await nav.newPage({ viewport: { width: Number(largeur), height: Number(hauteur) } });
p.on('pageerror', (e) => console.log('erreur: ' + e.message));
await p.goto(`http://127.0.0.1:${port}/rendu/labo/index.html?l=${largeur}&h=${hauteur}&${requete}`);
await p.waitForFunction(() => window.pret === true, null, { timeout: 300000 });
await p.evaluate((t) => window.labo.aller(t), Number(T));
await (await p.$('canvas')).screenshot({ path: sortie });
await nav.close(); serveur.close();
