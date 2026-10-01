// LinkFoot : tournois (§73, §74, §76).
// 8, 16, 32 ou 64 participants, élimination directe ou groupes puis élimination.
// L'architecture des récompenses en argent existe, mais les paiements sont désactivés :
// rien dans ce fichier ne déclenche de transaction.

import { applyResult, standings } from './league.js';

export const SIZES = [8, 16, 32, 64];

// §76 architecture des récompenses. `cash` est décrit mais jamais versé ici.
// Tant que `payouts.enabled` est false, seules les récompenses en jetons sont distribuées.
export const PAYOUTS = {
  enabled: false,
  reason: 'Paiements désactivés tant que le cadre juridique, l’âge, la géolocalisation et les règles des plateformes ne sont pas validés.',
  currency: 'EUR'
};

export function prizePool(size, entryTokens) {
  const pot = size * (entryTokens || 0);
  return {
    tokens: { 1: Math.round(pot * 0.45), 2: Math.round(pot * 0.25), 4: Math.round(pot * 0.1), 8: Math.round(pot * 0.025) },
    cash: null,             // rempli seulement si PAYOUTS.enabled devient true côté serveur
    rake: Math.round(pot * 0.1)
  };
}

const shuffle = (arr, rnd) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor((rnd || Math.random)() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
};

// Crée un tournoi. `format` : 'knockout' ou 'groups'.
// En mode groupes : des poules de 4, les deux premiers qualifiés, puis élimination directe.
export function createTournament(opts) {
  const o = opts || {};
  const size = SIZES.indexOf(o.size) >= 0 ? o.size : 16;
  const entrants = (o.entrants || []).slice(0, size);
  if (entrants.length !== size) throw new Error('il faut exactement ' + size + ' participants');
  const seeded = o.seeded ? entrants.slice() : shuffle(entrants, o.rnd);
  const format = o.format === 'groups' ? 'groups' : 'knockout';
  const T = {
    id: o.id || 'tr_' + Math.random().toString(36).slice(2, 10),
    name: o.name || 'Tournoi LinkFoot',
    size, format, entrants: seeded,
    entry: o.entry || 0,
    prizes: prizePool(size, o.entry || 0),
    payouts: { enabled: PAYOUTS.enabled, currency: PAYOUTS.currency },
    stage: format === 'groups' ? 'groups' : 'ko',
    groups: [], rounds: [], champion: null, done: false
  };
  if (format === 'groups') {
    for (let i = 0; i < size; i += 4) {
      const g = seeded.slice(i, i + 4);
      T.groups.push({ id: 'G' + (T.groups.length + 1), teams: g, rows: [], matches: pairsOf(g) });
    }
  } else {
    T.rounds.push(buildRound(seeded, 1));
  }
  return T;
}

const pairsOf = (g) => {
  const out = [];
  for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) out.push({ home: g[i].id, away: g[j].id, hs: null, as: null });
  return out;
};

const roundName = (n) => ({ 2: 'Finale', 4: 'Demi-finales', 8: 'Quarts de finale', 16: 'Huitièmes de finale', 32: 'Seizièmes de finale', 64: 'Trente-deuxièmes' })[n] || (n + ' équipes');

function buildRound(teams, no) {
  const ties = [];
  for (let i = 0; i < teams.length; i += 2) ties.push({ home: teams[i], away: teams[i + 1], hs: null, as: null, pso: null, winner: null });
  return { no, name: roundName(teams.length), ties };
}

// Les rencontres à jouer maintenant, sous la forme { home, away, ref } à passer au moteur.
export function pendingMatches(T) {
  if (T.done) return [];
  if (T.stage === 'groups') {
    const out = [];
    T.groups.forEach((g) => g.matches.forEach((m, i) => { if (m.hs == null) out.push({ group: g.id, idx: i, home: find(T, m.home), away: find(T, m.away) }); }));
    return out;
  }
  const r = T.rounds[T.rounds.length - 1];
  return r.ties.map((t, i) => (t.winner ? null : { round: r.no, idx: i, home: t.home, away: t.away })).filter(Boolean);
}

const find = (T, id) => T.entrants.find((e) => e.id === id);

// Enregistre un résultat. `pso` = { H, A } quand la rencontre s'est jouée aux tirs au but.
export function reportResult(T, ref, hs, as, pso) {
  if (T.stage === 'groups') {
    const g = T.groups.find((x) => x.id === ref.group);
    const m = g.matches[ref.idx];
    m.hs = hs; m.as = as;
    g.rows = [];
    g.matches.forEach((x) => { if (x.hs != null) applyResult(g.rows, x.home, x.away, x.hs, x.as); });
    if (T.groups.every((x) => x.matches.every((m2) => m2.hs != null))) {
      const qualified = [];
      T.groups.forEach((x) => standings(x.rows).slice(0, 2).forEach((r) => qualified.push(find(T, r.id))));
      T.stage = 'ko';
      T.rounds.push(buildRound(qualified, 1));
    }
    return T;
  }
  const r = T.rounds.find((x) => x.no === ref.round), t = r.ties[ref.idx];
  t.hs = hs; t.as = as; t.pso = pso || null;
  t.winner = hs > as ? t.home : hs < as ? t.away : (pso && pso.H > pso.A ? t.home : pso ? t.away : null);
  if (!t.winner) throw new Error('match nul sans séance de tirs au but : il faut départager');
  if (r.ties.every((x) => x.winner)) {
    const winners = r.ties.map((x) => x.winner);
    if (winners.length === 1) { T.champion = winners[0]; T.done = true; }
    else T.rounds.push(buildRound(winners, r.no + 1));
  }
  return T;
}

// Classement final : champion, finaliste, demi-finalistes, puis les éliminés par tour.
export function finalRanking(T) {
  const out = [];
  if (T.champion) out.push({ rank: 1, team: T.champion });
  for (let i = T.rounds.length - 1; i >= 0; i--) {
    const r = T.rounds[i];
    const losers = r.ties.filter((t) => t.winner).map((t) => (t.winner.id === t.home.id ? t.away : t.home));
    losers.forEach((l) => { if (!out.some((x) => x.team.id === l.id)) out.push({ rank: out.length + 1, team: l }); });
  }
  return out;
}

// Récompenses en jetons d'un classement final. Jamais d'argent réel ici.
export function rewards(T) {
  const rank = finalRanking(T), P = T.prizes.tokens, out = [];
  rank.forEach((r) => {
    const tier = r.rank === 1 ? 1 : r.rank === 2 ? 2 : r.rank <= 4 ? 4 : r.rank <= 8 ? 8 : null;
    if (tier && P[tier]) out.push({ team: r.team, rank: r.rank, tokens: P[tier] });
  });
  return { tokens: out, cash: PAYOUTS.enabled ? null : { paid: false, reason: PAYOUTS.reason } };
}
