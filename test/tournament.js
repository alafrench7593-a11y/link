// Joue un tournoi complet avec le vrai moteur de match, en élimination directe et en groupes.
// node test/tournament.js [8|16|32|64]
import { Club, makeEngine } from '../src/index.js';
import { createTournament, pendingMatches, reportResult, finalRanking, rewards, PAYOUTS } from '../src/tournament.js';
import { schedule, standings, applyResult, movements, emptyRow } from '../src/league.js';

const SIZE = Number(process.argv[2] || 16);
const club = new Club();
const STYLES = ['tiki', 'contre', 'gegen', 'blocbas', 'direct', 'catenaccio', 'posit', 'ailes', 'homme'];
const entrants = Array.from({ length: SIZE }, (_, i) => ({ id: 'u' + i, name: 'Club ' + (i + 1), ovr: 60 + (i * 7) % 18, style: STYLES[i % STYLES.length] }));

// Un match entre deux participants : le moteur décide, les tirs au but départagent si besoin.
function playTie(a, bTeam) {
  const xi = club.pickXI(club.state.formation).map((p) => Object.assign({}, p, { energy: 100, ovr: Math.round(p.ovr + (a.ovr - 65) * 0.8) }));
  const shape = club.baseShape('4-4-2', 'A');
  const oxi = shape.map((s, i) => ({ id: 9000 + i, name: 'J' + i, pos: s.line, line: s.line, ovr: bTeam.ovr, energy: 100 }));
  const E = makeEngine(club.engineCfg({ club: bTeam.name, ovr: bTeam.ovr, style: bTeam.style }, xi, oxi, []));
  E.finish();
  const f = E.state();
  let pso = null;
  if (f.score.H === f.score.A) { const r = E.shootout(); pso = { H: r.H, A: r.A }; }
  return { hs: f.score.H, as: f.score.A, pso };
}

for (const format of ['knockout', 'groups']) {
  const T = createTournament({ size: SIZE, entrants, format, entry: 100, name: 'Coupe LinkFoot' });
  let guard = 0, played = 0;
  while (!T.done && guard++ < 400) {
    const todo = pendingMatches(T);
    if (!todo.length) break;
    for (const m of todo) {
      const r = playTie(m.home, m.away);
      reportResult(T, m, r.hs, r.as, r.pso);
      played++;
      if (T.done) break;
    }
  }
  const rk = finalRanking(T).slice(0, 4);
  const rw = rewards(T);
  console.log(`${format.padEnd(8)} · ${SIZE} participants · ${played} matchs · vainqueur ${T.champion ? T.champion.name : 'aucun'}`);
  console.log('           podium : ' + rk.map((r) => r.rank + '. ' + r.team.name).join(', '));
  console.log('           jetons : ' + rw.tokens.slice(0, 3).map((x) => x.team.name + ' ' + x.tokens).join(', ') + ' · argent réel : ' + (rw.cash.paid ? 'versé' : 'désactivé'));
}

// Ligue utilisateurs : calendrier aller-retour, classement, montées et descentes.
const ids = entrants.slice(0, 6).map((e) => e.id);
const days = schedule(ids, 2);
const rows = ids.map((id) => emptyRow(id, entrants.find((e) => e.id === id).name));
let n = 0;
days.forEach((d) => d.forEach((m) => { applyResult(rows, m.home, m.away, Math.floor(Math.random() * 4), Math.floor(Math.random() * 4)); n++; }));
const tbl = standings(rows);
console.log(`ligue    · ${ids.length} clubs · ${days.length} journées · ${n} matchs`);
console.log('           ' + tbl.map((r) => r.rank + '. ' + r.name + ' ' + r.pts + ' pts (' + (r.gd > 0 ? '+' : '') + r.gd + ')').join(' | '));
const mv = movements(tbl, { up: 2, down: 1 });
console.log('           montent : ' + mv.promoted.join(', ') + ' · descend : ' + mv.relegated.join(', '));
console.log('paiements en argent réel : ' + (PAYOUTS.enabled ? 'ACTIVÉS' : 'désactivés'));
