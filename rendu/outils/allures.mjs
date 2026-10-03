// Le catalogue des allures : dans les scènes de test (les vrais matchs du moteur), on cherche le
// meilleur exemple de chaque allure de locomotion (marche, jog, course, sprint, départ, arrêt,
// virages de 45°, 90°, 135° et 180°, pas chassés, course arrière), puis on le filme de profil,
// joueur suivi, avec le corps demandé. Rien n'est inventé : chaque exemple est un joueur du moteur
// à un instant du match, nommé avec sa scène, son code et son instant.
//   node rendu/outils/allures.mjs <dossier de sortie> [perso=<url d'un personnage riggé>] [largeur] [hauteur]
// Sortie : allures.json (les exemples trouvés), une planche (allures.png : une ligne par allure,
// six images régulières) et un film (allures.mp4 : chaque exemple, nommé, à 30 i/s).
import { chromium } from '../../app/node_modules/playwright/index.mjs';
import { demarrer } from './serveur.mjs';
import { Match } from '../labo/match.js';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [sortie = 'allures', persoArg = '', largeur = '480', hauteur = '360'] = process.argv.slice(2);
const perso = persoArg.startsWith('perso=') ? '&' + persoArg : '';
const DOSSIER = 'unreal/LinkFoot/Content/LinkFoot/Scenes';
fs.mkdirSync(sortie, { recursive: true });

const deg = (r) => r * 180 / Math.PI;
const ecart = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

// ---- 1. chercher les exemples ----
const ALLURES = [
  ['marche', 'Marche'], ['jog', 'Jog'], ['course', 'Course'], ['sprint', 'Sprint'], ['depart', 'Départ (accélération)'],
  ['arret', 'Arrêt (freinage)'], ['virage45', 'Virage 45°'], ['virage90', 'Virage 90°'], ['virage135', 'Virage 135°'],
  ['virage180', 'Demi-tour 180°'], ['lateral', 'Pas chassés'], ['arriere', 'Course arrière']
];
const meilleurs = {};
const proposer = (cle, score, ex) => { if (!meilleurs[cle] || score > meilleurs[cle].score) meilleurs[cle] = { score, ...ex }; };
for (const f of fs.readdirSync(DOSSIER).filter((x) => /^\d\d-.*\.json$/.test(x)).sort()) {
  const doc = JSON.parse(fs.readFileSync(path.join(DOSSIER, f), 'utf8'));
  const m = new Match(doc);
  for (const code of [...m.joueurs.keys()].filter((c) => c < 22)) {
    if (m.joueurs.get(code).poste === 'GB') continue;
    const V = (t) => { const v = m.vitesse(code, t); return Math.hypot(v[0], v[1]); };
    const cap = (t) => { const v = m.vitesse(code, t); return Math.atan2(v[0], v[1]); };
    for (let t = m.t0 + 0.6; t < m.t1 - 2.4; t += 0.1) {
      if (!m.present(code, t) || !m.present(code, t + 2)) continue;
      const vs = Array.from({ length: 11 }, (_, k) => V(t + k * 0.2));
      const moy = vs.reduce((a, b) => a + b, 0) / vs.length, mn = Math.min(...vs), mx = Math.max(...vs);
      const ex = { fichier: f, code, t: +t.toFixed(2), duree: 2.0 };
      const droit = Math.abs(deg(ecart(cap(t + 2), cap(t)))) < 25;
      if (droit && mx - mn < 0.6 && moy >= 1.0 && moy <= 2.0) proposer('marche', 1 - Math.abs(moy - 1.5) - (mx - mn), ex);
      if (droit && mx - mn < 0.8 && moy >= 2.8 && moy <= 4.2) proposer('jog', 1 - Math.abs(moy - 3.5) - (mx - mn), ex);
      if (droit && mx - mn < 0.8 && moy >= 4.8 && moy <= 6.2) proposer('course', 1 - Math.abs(moy - 5.5) - (mx - mn), ex);
      if (droit && moy >= 6.8) proposer('sprint', moy - (mx - mn), ex);
      if (V(t) < 0.8) proposer('depart', V(t + 1.6) - V(t), { ...ex, duree: 2.2 });
      if (V(t) > 4.5 && V(t + 1.6) < 0.6) proposer('arret', V(t) - V(t + 1.6), { ...ex, duree: 2.2 });
      // les virages : le cap de la vitesse tourne de N degrés en 1,2 s, sans ralentir sous 2,5 m/s
      if (V(t) > 2.5 && V(t + 0.6) > 2.0 && V(t + 1.2) > 2.5) {
        const d = Math.abs(deg(ecart(cap(t + 1.2), cap(t))));
        for (const n of [45, 90, 135]) proposer('virage' + n, -Math.abs(d - n) + 0.1 * Math.min(V(t), 6), { ...ex, t: +(t - 0.3).toFixed(2), duree: 2.0 });
      }
      if (V(t) > 1.5 && V(t + 1.5) > 1.5) {
        const d = Math.abs(deg(ecart(cap(t + 1.5), cap(t))));
        proposer('virage180', -Math.abs(d - 180) + 0.2 * Math.min(V(t), V(t + 1.5)), { ...ex, t: +(t - 0.3).toFixed(2), duree: 2.3 });
      }
      // pas chassés et course arrière : la vitesse par rapport au corps (le lacet du moteur)
      const rel = [0, 0.5, 1.0].map((k) => Math.abs(deg(ecart(cap(t + k), m.lacet(code, t + k)))));
      const vr = [0, 0.5, 1.0].map((k) => V(t + k));
      if (Math.min(...vr) > 1.2 && Math.max(...vr) < 4.5 && rel.every((r) => r > 65 && r < 115)) proposer('lateral', 3 - rel.reduce((a, r) => a + Math.abs(r - 90), 0) / 30, { ...ex, duree: 1.8 });
      if (Math.min(...vr) > 0.8 && rel.every((r) => r > 145)) proposer('arriere', Math.min(...vr) + rel.reduce((a, r) => a + r, 0) / 300, { ...ex, duree: 1.8 });
    }
  }
}
const liste = ALLURES.filter(([k]) => meilleurs[k]).map(([k, nom]) => ({ cle: k, nom, ...meilleurs[k] }));
const absentes = ALLURES.filter(([k]) => !meilleurs[k]).map(([, nom]) => nom);
fs.writeFileSync(path.join(sortie, 'allures.json'), JSON.stringify({ exemples: liste, absentes }, null, 1));
for (const e of liste) console.log(`${e.nom.padEnd(24)} ${e.fichier} joueur ${e.code} à ${e.t} s (${e.duree} s)`);
if (absentes.length) console.log('sans exemple :', absentes.join(', '));

// ---- 2. les filmer ----
const { serveur, port } = await demarrer();
const nav = await chromium.launch({ executablePath: process.env.LINKFOOT_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const images = path.join(sortie, 'images');
fs.rmSync(images, { recursive: true, force: true }); fs.mkdirSync(images, { recursive: true });
const lignes = [];
let n = 0;
for (const e of liste) {
  const p = await nav.newPage({ viewport: { width: Number(largeur), height: Number(hauteur) } });
  p.on('pageerror', (x) => console.log('erreur', x.message));
  await p.goto(`http://127.0.0.1:${port}/rendu/labo/index.html?l=${largeur}&h=${hauteur}&joueurs=${e.code}&focus=${e.code}&camera=cote&doc=/${DOSSIER}/${e.fichier}${perso}`);
  await p.waitForFunction(() => window.pret === true, null, { timeout: 300000 });
  // l'histoire d'abord (les gestes en cours, la fatigue), puis le film
  await p.evaluate((t) => window.labo.aller(t - 1.0), e.t);
  const planche = [];
  const nb = Math.round(e.duree * 30);
  for (let k = 0; k <= nb; k++) {
    await p.evaluate((t) => window.labo.aller(t), e.t + k / 30);
    const f = path.join(images, `${String(n++).padStart(5, '0')}.png`);
    await (await p.$('canvas')).screenshot({ path: f });
    execFileSync('convert', [f, '-gravity', 'northwest', '-pointsize', String(Math.round(Number(hauteur) / 18)), '-fill', 'white', '-undercolor', '#000000aa',
      '-annotate', '+8+8', ` ${e.nom} `, f]);
    if (k % Math.round(nb / 5) === 0 && planche.length < 6) planche.push(f);
  }
  const ligne = path.join(sortie, `ligne_${e.cle}.png`);
  execFileSync('montage', [...planche, '-tile', `${planche.length}x1`, '-geometry', '+2+2', '-background', '#16191d', ligne]);
  lignes.push(ligne);
  console.log(`filmé : ${e.nom}`);
  await p.close();
}
await nav.close(); serveur.close();
execFileSync('montage', [...lignes, '-tile', '1x', '-geometry', '+0+2', '-background', '#16191d', path.join(sortie, 'allures.png')]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(images, '%05d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', path.join(sortie, 'allures.mp4')]);
console.log(path.join(sortie, 'allures.png'), path.join(sortie, 'allures.mp4'));
