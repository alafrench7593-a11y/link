// Vérifie que le moteur sorti de la page donne les mêmes chiffres que dans l'interface.
// node test/sim.js [nombre de matchs]
import { Club, MemoryStore, SaveManager, serialize, deserialize } from '../src/index.js';

const N = Number(process.argv[2] || 200);
const OPPS = [
  { club: 'Auteuil United', ovr: 72, style: 'tiki' }, { club: 'Kop Bleu FC', ovr: 67, style: 'contre' },
  { club: 'Olympique Vieux-Port', ovr: 75, style: 'gegen' }, { club: 'Sporting Yoyo', ovr: 70, style: 'blocbas' },
  { club: 'Real Canal FC', ovr: 64, style: 'direct' }, { club: 'Calcio Brindille', ovr: 71, style: 'catenaccio' },
  { club: 'Dynamo Positif', ovr: 74, style: 'posit' }, { club: 'Flèches du Nord', ovr: 68, style: 'ailes' },
  { club: 'Duel FC', ovr: 69, style: 'homme' }
];

const club = new Club();
const res = { w: 0, d: 0, l: 0, gf: 0, ga: 0, sh: 0, on: 0, xg: 0, dist: {} };
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const o = OPPS[i % OPPS.length];
  const opp = Object.assign({}, o, { ovr: o.ovr - 5 + (4 - club.state.division) * 3 });
  const r = club.playMatch(opp, { seed: i * 977 + 13 });
  const [h, a] = r.score;
  // le résultat du MATCH, lu au score : un amical nul se termine aux tirs au but (§51),
  // et r.res dirait alors « victoire » ou « défaite » pour un match nul
  res[r.score[0] > r.score[1] ? 'w' : r.score[0] === r.score[1] ? 'd' : 'l']++;
  res.gf += h; res.ga += a; res.dist[h + a] = (res.dist[h + a] || 0) + 1;
  res.sh += r.stats.H.sh + r.stats.A.sh; res.on += r.stats.H.on + r.stats.A.on; res.xg += r.stats.H.xg + r.stats.A.xg;
}
const f = (x) => (x / N).toFixed(2);
console.log(`${N} matchs en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`bilan        ${res.w}V ${res.d}N ${res.l}D`);
console.log(`buts         ${f(res.gf)} pour, ${f(res.ga)} contre, ${f(res.gf + res.ga)} au total`);
console.log(`tirs         ${f(res.sh)} dont ${f(res.on)} cadrés`);
console.log(`xG           ${f(res.xg)}`);
console.log(`répartition  ${Object.keys(res.dist).sort((a, b) => a - b).map((k) => k + ' buts x' + res.dist[k]).join(', ')}`);
console.log(`club         division ${club.state.division}, solde ${club.state.balance}, effectif ${club.state.squad.length}`);

// aller-retour de sauvegarde
const store = new MemoryStore(), mgr = new SaveManager(club, store, { delay: 0 });
await mgr.save();
const copie = new Club(deserialize(await store.load()));
const same = copie.state.balance === club.state.balance && copie.state.squad.length === club.state.squad.length && copie.state.division === club.state.division;
console.log(`sauvegarde   ${same ? 'relecture identique' : 'ÉCART APRÈS RELECTURE'} (${JSON.stringify(serialize(club)).length} octets)`);

const total = (res.gf + res.ga) / N;
const ok = total > 1.8 && total < 3.6 && res.sh / N > 18 && res.sh / N < 36;
console.log(ok ? 'OK : équilibrage dans la fourchette attendue' : 'ATTENTION : équilibrage hors fourchette');
process.exit(ok && same ? 0 : 1);
