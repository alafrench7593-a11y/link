// Une photo d'une page du laboratoire, dans Chromium sans écran.
import { chromium } from '../../app/node_modules/playwright/index.mjs';
import { demarrer } from './serveur.mjs';
const [page_, sortie = 'photo.png', largeur = '1280', hauteur = '720'] = process.argv.slice(2);
const { serveur, port } = await demarrer();
const local = process.env.LINKFOOT_CHROMIUM || '/opt/pw-browsers/chromium';
const nav = await chromium.launch({ executablePath: local, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await nav.newPage({ viewport: { width: Number(largeur), height: Number(hauteur) } });
const msgs = [];
p.on('console', (m) => msgs.push(m.type() + ': ' + m.text()));
p.on('pageerror', (e) => msgs.push('erreur: ' + e.message));
await p.goto(`http://127.0.0.1:${port}/${page_}`);
await p.waitForFunction(() => window.pret === true, null, { timeout: 180000 }).catch((e) => msgs.push('attente: ' + e.message));
await p.screenshot({ path: sortie });
console.log(msgs.slice(0, 20).join('\n'));
await nav.close(); serveur.close();
