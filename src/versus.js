// LinkFoot : match entre deux vrais clubs (§26, §73, §74).
//
// Le moteur est déterministe : à graine égale, le match est identique partout.
// Le serveur n'a donc pas besoin de stocker un film de match, seulement
// (club A, club B, graine). Les deux joueurs rejouent la même rencontre chez eux,
// avec les mêmes buts à la même minute, et personne ne peut la truquer de son côté
// puisque le score fait foi côté serveur (§29).
import { Club } from './club.js';
import { makeEngine } from './engine.js';

// L'état minimal d'un club à envoyer au serveur pour qu'il puisse jouer le match.
// On n'envoie ni le solde, ni l'inventaire, ni le journal : seulement l'équipe.
export function teamSnapshot(club) {
  const s = club.state;
  const xi = club.pickXI(s.formation);
  return {
    club: s.clubName || 'FC TonPseudo',
    division: s.division,
    level: s.level,
    ovr: Math.round(club.metrics(xi).ovr),
    formation: s.formation,
    preset: s.preset,
    tac: s.tac,
    mentality: s.mentality,
    coach: s.coach || null,
    staffAdjoint: club.staffLv('adjoint'),
    cohBonus: s.cohBonus || 0,
    roles: s.roles, duties: s.duties,
    xi: xi.map((p) => ({
      id: p.id, name: p.name, pos: p.pos, line: p.line, slot: p.slot, ovr: p.ovr,
      st: (() => { const o = {}; club.cardStats(p).forEach((q) => { o[q.l] = q.v; }); return o; })(),
      energy: p.fit != null ? p.fit : 100, form: p.form != null ? p.form : 70, morale: p.morale != null ? p.morale : 72,
      pen: p.pen || 0, skills: club.skillsOf(p),
      foot: club.profile(p).foot, wf: club.profile(p).wf
    })),
    bench: club.benchOf(xi).slice(0, 5).map((p) => ({
      id: p.id, name: p.name, pos: p.pos, ovr: p.ovr,
      st: (() => { const o = {}; club.cardStats(p).forEach((q) => { o[q.l] = q.v; }); return o; })()
    }))
  };
}

// Construit la configuration du moteur depuis deux instantanés d'équipe.
// Aucune des deux équipes n'est « l'IA » : les deux sont de vrais effectifs.
// Les réglages par défaut d'une équipe. Une équipe publiée par un client peut arriver
// incomplète : ancienne version, client bricolé, champ oublié. Sans ces valeurs, le
// moteur calculait sur `undefined`, les positions devenaient NaN et le serveur
// répondait 500 — autrement dit, n'importe qui pouvait le faire tomber en publiant une
// équipe sans tactique (§29). On complète ici, une fois, pour les deux camps.
function completer(t) {
  const ref = new Club();
  const form = t && t.formation && ref.formCoords(t.formation) ? t.formation : '4-3-3';
  const preset = (t && t.preset) || (t && t.style) || 'equilibre';
  const style = ref.styles()[preset] || ref.styles().equilibre;
  const tac = {};
  Object.keys(style.tac).forEach((k) => {
    const v = t && t.tac ? t.tac[k] : undefined;
    tac[k] = Number.isFinite(v) ? v : style.tac[k];
  });
  const ment = Number.isFinite(t && t.mentality) ? t.mentality : style.m;
  return Object.assign({}, t, { formation: form, preset, tac, mentality: ment,
    roles: (t && t.roles) || {}, duties: (t && t.duties) || {},
    xi: ((t && t.xi) || []).map((p) => Object.assign({}, p, {
      ovr: Number.isFinite(p.ovr) ? p.ovr : 60,
      energy: Number.isFinite(p.energy) ? p.energy : 100,
      form: Number.isFinite(p.form) ? p.form : 70,
      morale: Number.isFinite(p.morale) ? p.morale : 72,
      wf: Number.isFinite(p.wf) ? p.wf : 3
    })) });
}

// Ce qu'une équipe publiée doit contenir pour être jouable. Le serveur s'en sert pour
// refuser à la porte, avec une raison lisible, plutôt que de planter en plein match :
// un 500 ne dit rien au joueur et laisse le serveur à la merci du premier client
// bricolé (§29).
export function verifierEquipe(t) {
  if (!t || typeof t !== 'object') return 'équipe absente';
  if (!Array.isArray(t.xi) || t.xi.length !== 11) return 'il faut exactement onze joueurs';
  const LIGNES = ['GB', 'DEF', 'MIL', 'ATT'];
  for (let i = 0; i < t.xi.length; i++) {
    const p = t.xi[i];
    if (!p || typeof p !== 'object') return 'joueur ' + (i + 1) + ' absent';
    if (!p.name || typeof p.name !== 'string') return 'joueur ' + (i + 1) + ' sans nom';
    if (LIGNES.indexOf(p.line) < 0) return 'joueur ' + (i + 1) + ' : ligne inconnue';
    if (!Number.isFinite(p.ovr) || p.ovr < 1 || p.ovr > 99) return 'joueur ' + (i + 1) + ' : note hors limites';
  }
  if (t.xi.filter((p) => p.line === 'GB').length !== 1) return 'il faut exactement un gardien';
  const ref = new Club();
  if (t.formation && !ref.formCoords(t.formation)) return 'formation inconnue : ' + t.formation;
  return null;
}

export function versusCfg(home0, away0, seed) {
  const home = completer(home0), away = completer(away0);
  const ref = new Club();
  const coordsFrom = (form) => {
    const C = ref.formCoords(form), out = [];
    ['GB', 'DEF', 'MIL', 'ATT'].forEach((l) => (C[l] || []).forEach(([fx, fy]) => out.push({ fx, fy, line: l })));
    return out;
  };
  const adv = ref.matchup(home.preset, away.preset) || 0;
  const side = (t, isHome, advantage) => ({
    club: t.club,
    sbonus: (t.staffAdjoint || 0) * 0.8,
    coach: ref.COACHES().find((c) => c.id === (t.coach || 'tacticien')),
    coh: Math.min(1.2, Math.max(0.7, 1 - t.xi.filter((p) => p.pen).length * 0.06 + (t.cohBonus || 0))),
    tac: t.tac, ment: t.mentality, adv: advantage, home: isHome,
    coords: coordsFrom(t.formation),
    players: t.xi.map((p) => ({
      name: p.name, ovr: p.ovr, st: p.st, energy: p.energy, form: p.form, morale: p.morale,
      skills: p.skills || [], foot: p.foot, wf: p.wf,
      role: (t.roles || {})[p.slot] || ref.ROLE_OPTS(p.line, p.slot, t.formation)[0],
      duty: (t.duties || {})[p.slot] || 'Soutien'
    })),
    bench: (t.bench || []).map((p) => ({ name: p.name, ovr: p.ovr, st: p.st }))
  });
  return { sides: { H: side(home, true, adv), A: side(away, false, -adv) }, rnd: ref.seedR(seed) };
}

// Joue la rencontre. Le même appel, avec la même graine, rend exactement le même
// résultat sur le serveur et chez les deux joueurs.
export function playVersus(home, away, seed, opts) {
  // Une équipe injouable doit se voir ici, avec son nom et sa raison, pas trois cents
  // lignes plus bas sous la forme d'un NaN.
  const eh = verifierEquipe(home), ea = verifierEquipe(away);
  if (eh) throw new Error('équipe à domicile invalide : ' + eh);
  if (ea) throw new Error('équipe à l’extérieur invalide : ' + ea);
  const E = makeEngine(versusCfg(home, away, seed));
  E.finish();
  const f = E.state();
  const hs = f.score.H, as = f.score.A;
  // §51 : en coupe, une égalité se départage aux tirs au but. La séance est jouée
  // par le même moteur et la même graine, donc elle se rejoue à l'identique partout.
  let pso = null;
  if (opts && opts.shootout && hs === as) {
    const so = E.shootout();
    pso = { H: so.H, A: so.A, kicks: so.kicks };
  }
  return {
    seed,
    home: home.club, away: away.club,
    score: [hs, as], pso,
    res: hs > as ? 'h' : hs < as ? 'a' : pso ? (pso.H > pso.A ? 'h' : 'a') : 'd',
    st: f.st, rat: f.rat, poss: f.poss,
    log: E.log.map((l) => ({ m: l.m, text: l.text, k: l.k, s: l.s }))
  };
}

// Vérifie qu'un résultat annoncé par un client correspond bien au match joué (§29).
// C'est ce qui empêche quelqu'un d'envoyer « j'ai gagné 9-0 » depuis sa console.
export function verifyResult(home, away, seed, claimed) {
  const real = playVersus(home, away, seed);
  const ok = !!claimed && real.score[0] === claimed[0] && real.score[1] === claimed[1];
  return { ok, real: real.score, claimed: claimed || null };
}
