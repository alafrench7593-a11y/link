// La porte de qualité des pieds, rejouée sur le rendu web : chaque scène de test jouée en entier
// avec ses 22 joueurs, le détecteur du cœur C++ (pointe à moins de 3 cm du sol, plus de 15 cm/s
// pendant au moins 0,1 s) sur les deux pieds de chacun. Sortie non nulle au premier glissement.
//   node rendu/outils/verifier-pieds.mjs [numéros de scènes, par défaut toutes]
import { chromium } from '../../app/node_modules/playwright/index.mjs';
import { demarrer } from './serveur.mjs';
import fs from 'node:fs';
import path from 'node:path';

const dossier = 'unreal/LinkFoot/Content/LinkFoot/Scenes';
const voulues = process.argv.slice(2);
const scenes = fs.readdirSync(dossier).filter((f) => /^\d\d-.*\.json$/.test(f)).filter((f) => !voulues.length || voulues.includes(f.slice(0, 2)));
const { serveur, port } = await demarrer();
const nav = await chromium.launch({ executablePath: process.env.LINKFOOT_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let total = 0;
for (const f of scenes) {
  const p = await nav.newPage({ viewport: { width: 320, height: 180 } });
  await p.goto(`http://127.0.0.1:${port}/rendu/labo/index.html?l=320&h=180&joueurs=tous&camera=tv&doc=/${path.posix.join(dossier, f)}`);
  await p.waitForFunction(() => window.pret === true, null, { timeout: 300000 });
  const r = await p.evaluate(() => {
    const L = window.labo;
    L.aller(L.t1 - 0.7);
    return L.joueurs.map((j) => ({ code: j.code, glissements: j.A.detecteurs().reduce((a, d) => a + d.glissements, 0),
      evenements: j.A.detecteurs().flatMap((d) => d.evenements || []) }));
  });
  const n = r.reduce((a, x) => a + x.glissements, 0);
  total += n;
  const detail = n ? ' : ' + JSON.stringify(r.filter((x) => x.glissements)) : '';
  console.log(`${f.padEnd(28)} ${r.length} joueurs, ${n} glissement(s)${detail}`);
  await p.close();
}
await nav.close(); serveur.close();
console.log(total ? `NE PAS LIVRER : ${total} glissement(s)` : 'VALIDE : aucun glissement de pied');
process.exit(total ? 1 : 0);
