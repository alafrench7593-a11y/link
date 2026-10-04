// La porte de qualité des pieds, rejouée sur le rendu web : chaque scène de test jouée en entier
// avec ses 22 joueurs, le détecteur du cœur C++ (pointe à moins de 3 cm du sol, plus de 15 cm/s
// pendant au moins 0,1 s) sur les deux pieds de chacun. Et le pied dans le ballon : un pied
// enfoncé de plus de 2 cm dans le ballon (labo/mouvement.js, distancePiedBallon), à n'importe
// quel pas de 1/60 s. Sortie non nulle au premier glissement ou au premier pied dans le ballon.
//   node rendu/outils/verifier-pieds.mjs [numéros de scènes, par défaut toutes]
//   LINKFOOT_PERSO=<url d'un personnage riggé> node rendu/outils/verifier-pieds.mjs   (voir labo/personnage.js)
import { chromium } from '../../app/node_modules/playwright/index.mjs';
import { demarrer } from './serveur.mjs';
import fs from 'node:fs';
import path from 'node:path';

// les scènes de test officielles, ou un autre dossier de fenêtres de match (LINKFOOT_SCENES=rendu/labo/scenes)
const dossier = process.env.LINKFOOT_SCENES || 'unreal/LinkFoot/Content/LinkFoot/Scenes';
const voulues = process.argv.slice(2);
const perso = process.env.LINKFOOT_PERSO ? '&perso=' + process.env.LINKFOOT_PERSO : '';
const scenes = fs.readdirSync(dossier).filter((f) => (process.env.LINKFOOT_SCENES ? /\.json$/.test(f) && f !== 'index.json' : /^\d\d-.*\.json$/.test(f))).filter((f) => !voulues.length || voulues.includes(f.slice(0, 2)));
const { serveur, port } = await demarrer();
const nav = await chromium.launch({ executablePath: process.env.LINKFOOT_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let total = 0, totalBallon = 0;
for (const f of scenes) {
  const p = await nav.newPage({ viewport: { width: 320, height: 180 } });
  await p.goto(`http://127.0.0.1:${port}/rendu/labo/index.html?l=320&h=180&joueurs=tous&camera=tv&doc=/${path.posix.join(dossier, f)}${perso}`);
  await p.waitForFunction(() => window.pret === true, null, { timeout: 300000 });
  const r = await p.evaluate(() => {
    const L = window.labo;
    L.aller(L.t1 - 0.7);
    return L.joueurs.map((j) => ({ code: j.code, glissements: j.A.detecteurs().reduce((a, d) => a + d.glissements, 0),
      suspendues: j.A.detecteurs().reduce((a, d) => a + (d.imagesSuspendues || 0), 0),
      dansBallon: j.A.stats.piedDansBallon || 0, enfoncement: +(j.A.stats.enfoncementMax || 0).toFixed(3), tEnfoncement: j.A.stats.tEnfoncement != null ? +j.A.stats.tEnfoncement.toFixed(2) : null,
      evenements: j.A.detecteurs().flatMap((d) => d.evenements || []) }));
  });
  const n = r.reduce((a, x) => a + x.glissements, 0), nb = r.reduce((a, x) => a + x.dansBallon, 0);
  total += n; totalBallon += nb;
  const detail = n ? ' : ' + JSON.stringify(r.filter((x) => x.glissements).map(({ code, glissements, evenements }) => ({ code, glissements, evenements }))) : '';
  const detailBallon = nb ? ' : ' + JSON.stringify(r.filter((x) => x.dansBallon).map(({ code, dansBallon, enfoncement, tEnfoncement }) => ({ code, dansBallon, enfoncement, t: tEnfoncement }))) : '';
  const susp = r.reduce((a, x) => a + x.suspendues, 0);
  console.log(`${f.padEnd(28)} ${r.length} joueurs, ${n} glissement(s)${susp ? `, ${susp} images de gestes au sol (tacle glissé, chute, relevé) non jugées` : ''}${detail}, ${nb} pas de pied dans le ballon${detailBallon}`);
  await p.close();
}
await nav.close(); serveur.close();
const echecs = [total ? `${total} glissement(s)` : '', totalBallon ? `${totalBallon} pas de pied dans le ballon` : ''].filter(Boolean);
console.log(echecs.length ? `NE PAS LIVRER : ${echecs.join(', ')}` : 'VALIDE : aucun glissement de pied, aucun pied dans le ballon');
process.exit(echecs.length ? 1 : 0);
