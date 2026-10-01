/* LinkFoot 2026-10-01 : moteur de match + manager, sans dépendance. */
(function (root) {
'use strict';
// LinkFoot : état de départ d'un club. Tout l'état du jeu tient dans cet objet,
// ce qui le rend sérialisable tel quel (voir save.js).
const P = (id, name, pos, ovr) => ({ id, name, pos, ovr });

function INITIAL_STATE() {
  return {
      speed: 1, view: 'home', formation: '4-3-3', balance: 1000, preset: 'equilibre', mentality: 3,
      tac: { width: 1, tempo: 1, pass: 1, behind: 0, cross: 1, dribble: 0, longshot: 0, patience: 0, line: 1, engage: 1, press: 1, trap: 0, tackle: 1, lost: 1, won: 1, gk: 0, corners: 0, freekicks: 0, mark: 0, fullbacks: 1, overload: 0, ptrap: 0, timewaste: 0 }, famFilter: null,
      roles: {}, duties: {}, lineup: {}, sel: null,
      squad: [
        P(1, 'T. Varnier', 'GB', 66), P(2, 'L. Okonkwé', 'DEF', 64), P(3, 'M. Delacroix-Sy', 'DEF', 67), P(4, 'J. Ferrandi', 'DEF', 62), P(5, 'A. Braxton', 'DEF', 65),
        P(6, 'N. Kessler', 'MIL', 68), P(7, 'Y. Mbaloula', 'MIL', 63), P(8, 'D. Arroyo-Faye', 'MIL', 66), P(9, 'S. Lindqvist', 'MIL', 61),
        P(10, 'K. Rouvière', 'ATT', 69), P(11, 'B. Adebanjo', 'ATT', 64), P(12, 'E. Castellane', 'ATT', 62), P(13, 'R. Moulinet', 'GB', 58), P(14, 'I. Tavares', 'DEF', 59)
      ],
      nextId: 100, pack: null, match: null, record: { w: 1, d: 1, l: 0 },
      kit: { c1: '#2ECC71', c2: '#0C1210', pat: 'uni', collar: 'rond', sponsor: true }, showKit: false, cam: '2d',
      xp: 340, level: 7, dayStreak: 3, dayClaimed: false, winStreak: 0, showHub: false, levelUp: null, now: Date.now(), freePackAt: Date.now() + 90000, freeQueue: [],
      division: 4, seasonP: 2, lastGain: null,
      staff: { adjoint: 0, physique: 0, recruteur: 0, kine: 0 }, stade: 0, academy: 0, youth: [],
      missions: [
        { id: 'play', label: 'Joue 3 matchs', goal: 3, prog: 0, reward: 100, xp: 30, claimed: false },
        { id: 'win', label: 'Gagne 1 match', goal: 1, prog: 0, reward: 150, xp: 50, claimed: false },
        { id: 'goals', label: 'Marque 3 buts', goal: 3, prog: 0, reward: 100, xp: 40, claimed: false },
        { id: 'pack', label: 'Ouvre un pack', goal: 1, prog: 0, reward: 80, xp: 20, claimed: false },
        { id: 'counter', label: 'Joue avec un style qui contre l’adversaire', goal: 1, prog: 0, reward: 120, xp: 60, claimed: false }
      ]
    };
}

// LinkFoot : moteur de match. Aucune dépendance, aucun DOM.
// Entrée : une configuration { sides: { H, A } } produite par Club.engineCfg().
// Sortie : une API { next, finish, state, step, frame, sub, card, shout, shootout, ... }.

function makeEngine(cfg) {
    const R = cfg.rnd || Math.random;
    const PW = 68, PL = 105, DT = 0.1;
    const cl = (v, a, b) => (v < a ? a : v > b ? b : v), hy = (a, b) => Math.sqrt(a * a + b * b), sig = (z) => 1 / (1 + Math.exp(-z));
    const gauss = () => { let u = 0; while (!u) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * R()); };
    const OT = { H: 'A', A: 'H' };
    // coordonnées « locales » d'une équipe : a = distance à SON but (0 → 105), x miroir pour l'équipe A
    const aOf = (s, y) => (s === 'H' ? PL - y : y), yOf = (s, a) => (s === 'H' ? PL - a : a), xl = (s, x) => (s === 'H' ? x : PW - x);
    // Expected Threat (Karun Singh, grille 12x8, lignes 0-3 du bord vers l'axe)
    const XT = [[0.00638, 0.0078, 0.00845, 0.00978, 0.01126, 0.01248, 0.01474, 0.01745, 0.02122, 0.02756, 0.03485, 0.03793],
      [0.0075, 0.00879, 0.00942, 0.01059, 0.01215, 0.01385, 0.01612, 0.0187, 0.02402, 0.02953, 0.04067, 0.04648],
      [0.00888, 0.00978, 0.01001, 0.0111, 0.01269, 0.01429, 0.01686, 0.01935, 0.02412, 0.02855, 0.05491, 0.06443],
      [0.00941, 0.01083, 0.01017, 0.01132, 0.01263, 0.01485, 0.0169, 0.01997, 0.02385, 0.03511, 0.10805, 0.25745]];
    const xT = (a, x) => {
      const fc = cl(a / PL * 12 - 0.5, 0, 11), fr = cl(x / PW * 8 - 0.5, 0, 7), c0 = Math.floor(fc), r0 = Math.floor(fr), c1 = Math.min(11, c0 + 1), r1 = Math.min(7, r0 + 1), tc = fc - c0, tr = fr - r0;
      const g = (r, c) => XT[r > 3 ? 7 - r : r][c];
      return (g(r0, c0) * (1 - tc) + g(r0, c1) * tc) * (1 - tr) + (g(r1, c0) * (1 - tc) + g(r1, c1) * tc) * tr;
    };
    // xG logistique (distance + angle, modèle Soccermatics)
    const xgAt = (a, x) => {
      const X = Math.max(0.4, PL - a), C = Math.abs(x - 34); let ang = Math.atan(7.32 * X / (X * X + C * C - 13.4)); if (ang < 0) ang += Math.PI;
      const d = hy(X, C); return Math.min(0.62, sig(0.002 + 0.659 * ang - 0.154 * d - 0.636 * Math.min(6, C / X)));
    };
    const inBox = (a, x) => a > PL - 16.5 && Math.abs(x - 34) < 20.16;
    // ---------- joueurs ----------
    const setAttr = (p, d) => {
      const S = d.st || {}, o = d.ovr || 65, g = (k, f) => (S[k] != null ? S[k] : f);
      if (p.line === 'GB') { p.att = 30; p.pow = 40; p.pace = g('VIT', o - 14); p.ref = g('RÉF', o); p.han = g('MAI', o); p.div = g('PLO', o); p.kick = g('DÉG', o - 6); p.gpos = g('PLA', o); p.pas = p.kick; p.sht = 30; p.dri = 35; p.def = 45; p.phy = o; p.dec = o; }
      else { p.pace = g('VIT', o); p.att = g('ATQ', o); p.pow = g('TIR', o); p.sht = Math.round(p.att * 0.55 + p.pow * 0.45); p.pas = g('PAS', o); p.dri = g('DRI', o); p.def = g('DÉF', o); p.phy = g('PHY', o); p.dec = Math.round(o * 0.5 + p.pas * 0.3 + p.att * 0.2); p.ref = 40; p.han = 40; p.div = 40; p.gpos = 40; }
      const fm = ((d.form != null ? d.form : 70) - 70) / 10 + ((d.morale != null ? d.morale : 72) - 72) / 20;   // forme et moral : ±3 points
      ['sht', 'pas', 'dri', 'def', 'phy', 'pace', 'dec'].forEach((k) => { p[k] = Math.round(p[k] + fm); });
      p.foot = d.foot || 'Droit'; p.wf = d.wf != null ? d.wf : 3;   // §25 pied fort et pied faible
      p.base = { sht: p.sht, pas: p.pas, dri: p.dri, def: p.def, phy: p.phy, pace: p.pace, dec: p.dec, ref: p.ref, han: p.han }; p.skills = d.skills || []; p.drain = 1; p.momT = -1; p.active = [];
      p.vmax = 5.5 + (p.pace - 40) * 0.064;
      // accélération, agilité, équilibre : dérivés des stats, distincts de la vitesse de pointe
      p.acc0 = 0.30 + (p.dri * 0.5 + p.pace * 0.5 - 40) * 0.0052;     // démarrage
      p.agi0 = 0.55 + (p.dri - 45) * 0.007 - (p.phy - 65) * 0.0022;   // changement de direction
      p.bal0 = 0.55 + (p.phy - 45) * 0.006;                            // résistance au contact
      p.name = d.name; p.short = d.name.split(' ').slice(1).join(' ') || d.name; p.ovr = o;
      p.role = d.role || ''; p.duty = d.duty || 'Soutien';
      const r = p.role;
      p.cutIn = r === 'Ailier inversé'; p.f9 = r === 'Faux 9'; p.fox = r === 'Renard des surfaces'; p.target = r === 'Pivot'; p.deep = r === 'Meneur reculé';
      p.b2b = r === 'Box-to-box' || r === 'Mezzala'; p.anchor = r === 'Récupérateur'; p.sweep = r === 'Gardien libéro'; p.stopper = r === 'Stoppeur'; p.libero = r === 'Libéro';
      p.fbMode = r === 'Latéral offensif' || r === 'Piston' ? 1 : r === 'Latéral inversé' ? 2 : null;
    };
    const mkP = (s, i, d, sh) => {
      const p = { s, i, code: (s === 'H' ? 0 : 11) + i, line: sh.line, bx: sh.fx * 0.68, ba: (100 - sh.fy) * 1.05, x: 34, y: 52.5, vx: 0, vy: 0, fx: 0, fy: s === 'H' ? -1 : 1,
        tl: null, tx: 34, ty: 52.5, urg: 0.5, energy: d.energy != null ? d.energy : 100, yc: d.yc || 0, red: !!d.red, rat: 6, beat: 0, fall: 0, run: null, prep: null,
        ctrlT: 0, nextDec: 0, rcvT: -9, carry: null, tkT: 0, sup: null, supT: 0, markT: null, press: false, g: 0, as: 0 };
      setAttr(p, d); return p;
    };
    const TM = {};
    const classify = (T) => {
      const ps = T.ps, defs = ps.filter((p) => p.line === 'DEF'), atts = ps.filter((p) => p.line === 'ATT');
      T.baseDefA = defs.length ? defs.reduce((a, p) => a + p.ba, 0) / defs.length : 30;
      const fa = atts.length ? atts.reduce((a, p) => a + p.ba, 0) / atts.length : T.baseDefA + 52;
      T.baseLen = Math.max(30, fa - T.baseDefA);
      ps.forEach((p) => {
        const fx = p.bx / 0.68, fy = 100 - p.ba / 1.05;
        p.lr = fx < 40 ? -1 : fx > 60 ? 1 : 0; p.wide = fx < 22 || fx > 78;
        if (p.line === 'GB') p.kind = 'GK';
        else if (p.line === 'DEF') p.kind = p.wide ? 'FB' : 'CB';
        else if (p.line === 'MIL') p.kind = p.wide ? (defs.length === 3 ? 'WB' : fy < 40 ? 'W' : 'WM') : fy >= 53 ? 'DM' : fy <= 42 ? 'AM' : 'CM';
        else p.kind = p.wide ? 'W' : 'ST';
      });
    };
    const setTP = (T) => {
      const t = T.tac, m = T.ment - 3, sh = T.shout;
      T.lineH = [23, 32, 41][t.line] + m * 1.6 + (sh === 'resserrer' ? -5 : 0);
      T.len = (t.line === 0 ? 25 : t.line === 2 ? 30 : 28) * (sh === 'resserrer' ? 0.9 : 1);
      T.engageA = [36, 56, 80][t.engage] + m * 2 + (sh === 'exiger' ? 6 : 0) - (sh === 'resserrer' ? 8 : 0);
      T.pressR = [5, 9, 14][t.press] + (sh === 'exiger' ? 3 : 0);
      T.pressN = t.press === 2 ? 2 : 1;
      T.width = [0.84, 1, 1.12][t.width];
      T.rest = [37, 32, 27][t.line] - m * 1.8;
      T.tempoInt = [0.8, 0.56, 0.38][t.tempo] * (sh === 'exiger' ? 0.85 : 1);
      T.fatK = 1 + 0.12 * (t.press - 1) + 0.1 * (t.tempo - 1) + (t.mark === 2 ? 0.06 : 0) + (sh === 'exiger' ? 0.08 : 0);
      T.bonus = (T.adv || 0) * 2.5 + (T.sbonus || 0) + (T.home ? 0.9 : 0) + (sh === 'encourager' ? 1.5 : 0) + (T.coach ? (T.coach.tactique - 70) / 25 : 0) + (T.boost && T.boost.bonus || 0);
    };
    // phase de jeu de l'équipe (ATTACK / DEFENSE / TRANSITION_ATTACK / TRANSITION_DEFENSE) et intention de chaque joueur
    const phaseOf = (T) => (W.poss === T.s ? (W.t < T.counterUntil ? 'TRANSITION_ATTACK' : 'ATTACK') : (W.t < T.cpressUntil || W.t < T.regroupUntil ? 'TRANSITION_DEFENSE' : 'DEFENSE'));
    // adaptation à la situation du match : score, minute, consignes (comme un vrai banc)
    const adaptToSituation = (T) => {
      const o = OT[T.s], diff = W.score[T.s] - W.score[o], min = W.clk / 60;
      if (T.ment0 == null) T.ment0 = T.ment;
      let adj = 0;
      if (diff < 0 && min >= 78) adj = 2; else if (diff < 0 && min >= 60) adj = 1;          // mené : on pousse, ligne plus haute
      if (diff > 0 && min >= 80) adj = T.tac.timewaste ? -2 : -1;                             // mène : on ferme, on baisse le bloc
      if (diff > 1 && min >= 60) adj = -1;
      const nm = Math.max(0, Math.min(6, T.ment0 + adj));
      if (nm !== T.ment) { T.ment = nm; setTP(T); }
      T.phase = phaseOf(T);
    };
    ['H', 'A'].forEach((s) => {
      const c = cfg.sides[s];
      const T = TM[s] = { s, coach: c.coach || null, coh: c.coh != null ? c.coh : 1, sbonus: c.sbonus || 0, home: !!c.home, tac: Object.assign({}, c.tac), ment: c.ment != null ? c.ment : 3, adv: c.adv || 0, shout: null, club: c.club, ps: [], bench: (c.bench || []).slice(), D: 30, counterUntil: 0, cpressUntil: 0, regroupUntil: 0, subs: 0 };
      c.players.forEach((d, i) => T.ps.push(mkP(s, i, d, c.coords[i])));
      classify(T); setTP(T); T.ovr = T.ps.reduce((a, p) => a + p.ovr, 0) / T.ps.length;
    });
    const Z = () => ({ sh: 0, on: 0, xg: 0, cor: 0, fou: 0, yc: 0, rc: 0, pa: 0, pc: 0, off: 0, tk: 0 });
    // ---------- SKILL ENGINE : conditions évaluées chaque minute, effets appliqués aux attributs ----------
    const skillCtx = (p) => {
      const s = p.s, o = OT[s], T = TM[s], min = W.clk / 60, diff = W.score[s] - W.score[o], a = aOf(s, p.y);
      return { always: true, trail70: diff < 0 && min >= 70, closeLate: min >= 75 && Math.abs(diff) <= 1, leading: diff > 0, first15: min < 15, momentum: W.clk < p.momT, tired: p.energy < 55, home: s === 'H',
        counter: W.t < T.counterUntil, box: a > 88 || a < 17, setpiece: !!W.set, pressed: W.t < TM[o].cpressUntil, derby: (TM[o].ovr || 0) > (T.ovr || 0), second: W.half === 2 };
    };
    const applySkills = () => {
      ['H', 'A'].forEach((s) => {
        const team = Object.assign({}, TM[s].boost && TM[s].boost.attr || {});
        TM[s].ps.forEach((p) => { if (p.red) return; const c = skillCtx(p); p.active = p.skills.filter((k) => c[k.cid]); p.active.forEach((k) => { if (k.eff.team) for (const a in k.eff.team) team[a] = (team[a] || 0) + k.eff.team[a]; }); });
        TM[s].ps.forEach((p) => {
          if (!p.base) return; p.drain = 1; const add = Object.assign({}, team);
          p.active.forEach((k) => { for (const a in k.eff) { if (a === 'drain') p.drain *= k.eff[a]; else if (a !== 'team') add[a] = (add[a] || 0) + k.eff[a]; } });
          for (const a in p.base) p[a] = Math.round(Math.max(20, Math.min(99, p.base[a] + (add[a] || 0))));
          p.vmax = 5.5 + (p.pace - 40) * 0.064;
        });
      });
    };
    let lastMin = -1;
    const W = { t: 0, clk: 0, half: 1, ball: { x: 34, y: 52.5, z: 0, vx: 0, vy: 0, vz: 0 }, owner: null, fl: null, poss: 'H', possT: 0, last: 'H', score: { H: 0, A: 0 }, st: { H: Z(), A: Z() }, pt: { H: 0, A: 0 },
      set: null, ended: false, cel: 0, cut: false, stop1: 60 + Math.floor(R() * 3) * 60, stop2: 120 + Math.floor(R() * 3) * 60, lastPass: null, com: '', comT: -9, dive: null, lastTele: 0, skip: false, oppSubs: 0 };
    let LV = { H: [], A: [] }, curEv = [];
    const ring = [], log = [], hist = [];
    let ALL = [];
    const all = () => ALL;
    const refreshLV = () => { LV = { H: TM.H.ps.filter((p) => !p.red), A: TM.A.ps.filter((p) => !p.red) }; ALL = LV.H.concat(LV.A); };
    const club = (s) => TM[s].club;
    const nearestOf = (s, x, y, excl) => { let b = null, bd = 1e9; for (const q of LV[s]) { if (q === excl) continue; const d = hy(q.x - x, q.y - y); if (d < bd) { bd = d; b = q; } } return { p: b, d: bd }; };
    const nearestOpp = (p) => nearestOf(OT[p.s], p.x, p.y);
    const rt = (p, d) => { if (p) p.rat = cl(p.rat + d, 3, 10); };
    const clockLabel = (c, h) => { const m = Math.floor(c / 60), hh = h || W.half; if (hh === 1 && m >= 45) return "45+" + (m - 44) + "'"; if (hh === 2 && m >= 90) return "90+" + (m - 89) + "'"; return Math.max(1, m + 1) + "'"; };
    const mark = (e) => curEv.push(e);
    const com = (text) => { W.com = text; W.comT = W.t; mark({ k: 'com', text }); };
    const banner = (text, sub, color, dur) => mark({ k: 'banner', text, sub: sub || '', color: color || '#F2F4F7', dur: dur || 1.6 });
    const possPct = () => { const tot = W.pt.H + W.pt.A; return tot ? Math.round(W.pt.H / tot * 100) : 50; };
    const snap = () => hist.push({ t: W.t, m: W.clk, score: { H: W.score.H, A: W.score.A }, st: { H: Object.assign({}, W.st.H), A: Object.assign({}, W.st.A) }, rat: { H: TM.H.ps.map((p) => p.rat), A: TM.A.ps.map((p) => p.rat) }, en: TM.H.ps.map((p) => p.energy), cards: TM.H.ps.map((p) => [p.yc, p.red]), poss: possPct() });
    const logE = (text, color, k, s) => { log.push({ t: W.t, text: clockLabel(W.clk) + ' ' + text, color, k, s, m: Math.min(90, Math.floor(W.clk / 60)) }); snap(); };
    // ---------- pending highlight / keys ----------
    const keys = [];
    const key = (score, side, kind) => keys.push({ t: W.t, score, side, kind });
    // ---------- géométrie ----------
    const offA = { H: 52.5, A: 52.5 };
    const calcOff = (s) => { const as = LV[OT[s]].map((q) => aOf(s, q.y)).sort((a, b) => b - a); const sec = as.length > 1 ? as[1] : PL; return Math.max(52.5, sec, aOf(s, W.ball.y)); };
    const isOffPos = (q) => { const a = aOf(q.s, q.y); return a > offA[q.s] + 0.25 && a > aOf(q.s, W.ball.y) + 0.2; };
    const spaceAt = (s, x, y) => { let m = 99; for (const q of LV[OT[s]]) { const d = hy(q.x - x, q.y - y); if (d < m) m = d; } return m; };
    const segDist = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1; const u = cl(((px - ax) * dx + (py - ay) * dy) / L, 0, 1); return hy(px - ax - dx * u, py - ay - dy * u); };
    const laneOpen = (s, ax, ay, bx, by) => { let m = 6; for (const q of LV[OT[s]]) { const d = segDist(q.x, q.y, ax, ay, bx, by); if (d < m) m = d; } return m; };
    const inTri = (px, py, ax, ay, bx, by, cx, cy) => { const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by), d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy), d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
    const toW = (s, a, x) => ({ x: xl(s, x), y: yOf(s, a) });
    const setTL = (p, a, x, urg) => { const t = p.tl || (p.tl = {}); t.a = a; t.x = x; t.urg = urg; };
    const setTW = (p, wx, wy, urg) => setTL(p, aOf(p.s, wy), xl(p.s, wx), urg);
    // ---------- possession ----------
    const ctrlDelay = (p) => 0.16 + (1 - (p.pas + p.dri) / 200) * 0.32;
    const assignMarks = (T) => {
      const o = OT[T.s], ours = LV[T.s].filter((p) => p.line !== 'GB'), theirs = LV[o].filter((q) => q.line !== 'GB');
      ours.forEach((p) => { p.markT = null; });
      const pairs = []; ours.forEach((p) => { if (T.tac.mark === 1 && p.line === 'DEF') return; theirs.forEach((q) => pairs.push([hy(p.x - q.x, p.y - q.y), p, q])); });
      pairs.sort((a, b) => a[0] - b[0]); const usedP = new Set(), usedQ = new Set();
      pairs.forEach(([d, p, q]) => { if (usedP.has(p) || usedQ.has(q)) return; usedP.add(p); usedQ.add(q); p.markT = q; });
    };
    const gain = (p, how) => {
      const prev = W.poss; W.owner = p; W.fl = null; W.dirty = true; const b = W.ball; b.z = 0; b.vx = b.vy = b.vz = 0;
      p.ctrlT = W.t + (how === 'set' ? 0 : ctrlDelay(p)); p.nextDec = p.ctrlT; p.rcvT = W.t; p.carry = null; p.run = null; p.prep = null; p.oneTouch = false; W.last = p.s;
      if (prev !== p.s) {
        W.poss = p.s; W.possT = W.t; const T = TM[p.s], O = TM[OT[p.s]];
        const bA = aOf(p.s, p.y), ahead = LV[OT[p.s]].filter((q) => q.line !== 'GB' && aOf(p.s, q.y) > bA).length;
        T.counterUntil = 0; O.counterUntil = 0; T.cpressUntil = 0;
        if (how !== 'set' && how !== 'gk' && T.tac.won === 0 && bA < 70 && ahead <= 6) {
          T.counterUntil = W.t + 7.5;
          if (ahead <= 5 && bA < 62) { com('Contre-attaque ! ' + p.short + ' lance le mouvement'); key(12, p.s, 'counter'); }
        }
        O.cpressUntil = O.tac.lost === 0 && how !== 'set' && how !== 'gk' ? W.t + 5 : 0;
        O.regroupUntil = O.tac.lost === 1 ? W.t + 4 : 0;
        if (O.tac.mark >= 1) assignMarks(O);
      }
    };
    // ---------- tirs ----------
    const shotEst = (p, head) => {
      const s = p.s, o = OT[s], a = aOf(s, p.y);
      let xg = xgAt(a, p.x) * (head ? 0.5 : 1);
      const nd = nearestOpp(p).d; if (nd < 1.5) xg *= 0.46; else if (nd < 3) xg *= 0.68; else if (nd < 4.5) xg *= 0.86;
      const gy = yOf(s, PL); let nb = 0, blocker = null, bd = 99; const gk = TM[o].ps[0];
      for (const r of LV[o]) {
        if (r.line === 'GB') continue; const d = hy(r.x - p.x, r.y - p.y);
        if (d < 14 && (inTri(r.x, r.y, p.x, p.y, 30.3, gy, 37.7, gy) || segDist(r.x, r.y, p.x, p.y, 34, gy) < 1.4)) { nb++; if (d < bd) { bd = d; blocker = r; } }
      }
      if (gk.red) xg = Math.min(0.62, xg * 1.35); else { const gkd = hy(gk.x - p.x, gk.y - p.y); if (gkd < 2.5) xg *= 0.78; }
      xg *= Math.pow(0.76, nb);
      return { xg: cl(xg * 0.68, 0.003, 0.7), blocker, pBlock: blocker ? Math.min(0.6, 0.18 + nb * 0.13 + (bd < 3 ? 0.1 : 0)) : 0 };
    };
    // ---------- §23 variantes de frappes ----------
    // chaque variante change la précision (ot), la conversion (g), la vitesse et la cloche du ballon.
    // le choix dépend de la hauteur du ballon, de la distance, de la technique, de la puissance et du gardien.
    const SHOTS = {
      place: { l: 'tir placé', ot: 0.07, g: 0.97, v: 0.86, apex: 0.6 },
      puissant: { l: 'frappe puissante', ot: -0.05, g: 1.12, v: 1.24, apex: 0.5 },
      enroule: { l: 'frappe enroulée', ot: 0.03, g: 1.08, v: 0.98, apex: 0.8 },
      seche: { l: 'frappe en première intention', ot: -0.04, g: 1.1, v: 1.08, apex: 0.5, surprise: 0.2 },
      lob: { l: 'ballon piqué', ot: -0.02, g: 1, v: 0.6, apex: 2.8 },
      volee: { l: 'reprise de volée', ot: -0.13, g: 1.2, v: 1.12, apex: 0.6 },
      demi: { l: 'demi-volée', ot: -0.07, g: 1.1, v: 1.1, apex: 0.6 },
      talon: { l: 'talonnade', ot: -0.16, g: 1.05, v: 0.7, apex: 0.4, surprise: 0.25 },
      retourne: { l: 'retourné acrobatique', ot: -0.22, g: 1.28, v: 1, apex: 0.7 },
      faible: { l: 'frappe du mauvais pied', ot: -0.09, g: 0.9, v: 0.9, apex: 0.6 },
      rasSol: { l: 'frappe à ras de terre', ot: 0.04, g: 1.06, v: 1.05, apex: 0.18 },
      reprise: { l: 'reprise de la demi-volée', ot: -0.08, g: 1.14, v: 1.06, apex: 0.5 },
      apresDrib: { l: 'frappe dans la foulée du dribble', ot: 0.02, g: 1.12, v: 1.02, apex: 0.55, surprise: 0.15 },
      ferme: { l: 'frappe sous un angle fermé', ot: -0.14, g: 1.3, v: 1.08, apex: 0.45 }
    };
    // §25 le pied qui frappe : un droitier place a gauche doit soit repiquer, soit tirer du mauvais pied
    const weakFoot = (p) => {
      if (p.foot === 'Ambidextre' || p.wf >= 5) return 0;
      const lx = xl(p.s, p.x), onLeft = lx < 30, onRight = lx > 38;
      const strongSide = p.foot === 'Gauche' ? onLeft : onRight;
      if (strongSide || (!onLeft && !onRight)) return 0;
      return cl((5 - p.wf) * 0.25, 0, 1);   // 0 = pied fort, 1 = pied faible franc
    };
    const pickShot = (p, a, gkOut, fresh) => {
      const z = W.ball.z, tech = p.dri * 0.5 + p.sht * 0.5, pw = p.pow != null ? p.pow : p.phy;
      const opts = [], add = (k, w) => { if (w > 0) opts.push({ k, w }); };
      const tight = Math.abs(p.x - 34) > 13 && a > 92;           // §23 angle ferme
      const justBeat = W.t - (p.beatT || -9) < 1.6;              // §23 tir apres dribble
      if (z > 0.9) { add('volee', 10 + (tech - 60) * 0.5); add('retourne', tech > 82 && a > 90 ? (tech - 82) * 0.4 : 0); }
      else if (z > 0.3) { add('demi', 10 + (tech - 60) * 0.4); add('volee', 3); add('reprise', 6 + (tech - 60) * 0.3); }
      else {
        add('place', a > 86 ? 14 : 5);
        add('puissant', 6 + (pw - 60) * 0.35 + (a < 88 ? 8 : 0));
        add('rasSol', 7 + (p.sht - 60) * 0.2);
        add('enroule', tech > 70 ? (tech - 70) * 0.9 + (Math.abs(p.x - 34) > 8 ? 5 : 0) : 0);
        add('seche', fresh ? 8 + (tech - 60) * 0.25 : 0);
        add('lob', gkOut ? 10 + (tech - 60) * 0.4 : 0.5);
        add('talon', tech > 80 && a > 92 ? (tech - 80) * 0.22 : 0);
        add('apresDrib', justBeat ? 14 + (tech - 60) * 0.3 : 0);
        add('ferme', tight ? 12 : 0);
        add('faible', weakFoot(p) > 0.4 ? 9 : 1);
      }
      if (!opts.length) return 'place';
      let r = R() * opts.reduce((t, o) => t + o.w, 0);
      for (const o of opts) { r -= o.w; if (r <= 0) return o.k; }
      return opts[0].k;
    };
    const shoot = (p, head, fk) => {
      const s = p.s, o = OT[s], T = TM[s], a = aOf(s, p.y), gk = TM[o].ps[0];
      const est = fk ? { xg: fk.xg, blocker: null, pBlock: 0 } : shotEst(p, head);
      const xg = est.xg; W.st[s].sh++; W.st[s].xg += xg;
      const lp = W.lastPass, rec2 = lp && lp.to === p && W.t - lp.t < 5;
      const orig = head ? 'head' : fk ? 'fk' : a < 84 ? 'long' : rec2 && lp.kind === 'through' ? 'through' : rec2 && lp.kind === 'cross' ? 'cross' : W.t < T.counterUntil ? 'counter' : rec2 ? 'pass' : 'solo';
      if (cfg.shotDbg) cfg.shotDbg(p, { a, x: p.x, xg, orig, nd: nearestOpp(p).d, head, held: W.t - p.rcvT, lp: lp && lp.from ? lp.from.kind + '>' + lp.kind : '-' , defBehind: LV[o].filter((q) => aOf(s, q.y) > a).length });
      W.orig = W.orig || {}; const oo = W.orig[orig] || (W.orig[orig] = { n: 0, g: 0, xg: 0 }); oo.n++; oo.xg += xg;
      const skill = (p.sht + T.bonus - 65) / 55 * (head ? 0.6 : 1) + (p.energy - 100) / 500;
      const gkOutNow = hy(gk.x - 34, gk.y - yOf(s, PL)) > 5;
      const sv = head || fk ? null : (W.forceSv || pickShot(p, a, gkOutNow, W.t - p.rcvT < 0.55)); W.forceSv = null;
      const V2 = sv ? SHOTS[sv] : null;
      let vg = V2 ? V2.g : 1; if (sv === 'lob') vg = gkOutNow ? 1.32 : 0.45;
      if (sv) { W.sv = W.sv || {}; const sc = W.sv[sv] || (W.sv[sv] = { n: 0, g: 0 }); sc.n++; }
      const gks = (gk.red ? -0.18 : (gk.ref * 0.6 + gk.div * 0.2 + gk.gpos * 0.2 + TM[o].bonus - 65) / 60) - (V2 && V2.surprise ? V2.surprise : 0);
      let res;
      const blocked = est.blocker && R() < est.pBlock;
      if (blocked) res = 'block';
      else {
        const pOT = cl(0.37 + skill * 0.35 + (a > 94 ? 0.12 : a > 88 ? 0.05 : 0) - (head ? 0.05 : 0) - (fk ? 0.05 : 0) + (V2 ? V2.ot : 0) - (head || fk ? 0 : weakFoot(p) * 0.12), 0.18, 0.8);
        const pG = cl(xg * vg * Math.max(0.3, 0.92 + skill * 0.6 - gks * 1.2) / (pOT * (1 - est.pBlock)), 0.01, 0.9);
        res = R() < pOT ? (R() < pG ? 'goal' : 'save') : 'miss';
      }
      if (res === 'goal' || res === 'save') W.st[s].on++;
      if (xg > 0.3 && res !== 'goal') mark({ k: 'roar', v: 0.55 });   // §53 le stade retient son souffle sur une grosse occasion
      if (res === 'goal') oo.g++;
      const gy = yOf(s, PL), sgn = s === 'H' ? -1 : 1;
      let tx, ty, post = false;
      if (res === 'goal') { tx = 34 + (R() < 0.5 ? -1 : 1) * (0.8 + R() * 2.6); ty = gy + sgn * 1.3; }
      else if (res === 'save') { tx = gk.x + (R() - 0.5) * 2.2; ty = gk.y; }
      else if (res === 'miss') { post = R() < 0.07; tx = post ? 34 + (R() < 0.5 ? -3.66 : 3.66) : 34 + (R() < 0.5 ? -1 : 1) * (4 + R() * 5); ty = post ? gy : gy + sgn * 3; }
      else { tx = est.blocker.x; ty = est.blocker.y; }
      const v = (head ? 15 : fk ? 22 : 24 + (p.sht - 60) * 0.12) * (V2 ? V2.v : 1);
      const f = kick(p, tx, ty, 'shot', null, { v, apex: head ? 0.6 : res === 'miss' && !post ? 1.6 : V2 ? V2.apex : 0.7 });
      Object.assign(f, { res, shooter: p, blocker: est.blocker, post, head, xg, fk: !!fk, orig, sv, dist: 105 - a, gkOut: gkOutNow, held: W.t - p.rcvT, nd: nearestOpp(p).d });
      if (res === 'goal' && sv) W.sv[sv].g++;
      if (res !== 'block' && !gk.red) { W.dive = { c: gk.code, dir: Math.sign((tx - gk.x) * (s === 'H' ? 1 : -1)) || 1, t0: W.t, dur: f.dur + 0.2 }; }
      com((head ? 'Tête de ' : fk ? 'Coup franc direct de ' : (V2 ? V2.l.charAt(0).toUpperCase() + V2.l.slice(1) : 'Frappe') + ' de ') + p.short + ' !');
      key(res === 'goal' ? 100 : 30 + xg * 170 + (res === 'save' ? 10 : 0), s, 'shot');
      rt(p, res === 'save' ? 0.05 : res === 'miss' ? (xg > 0.3 ? -0.2 : -0.02) : 0);
    };
    // ---------- ballon ----------
    const kick = (p, tx, ty, kind, to, opt) => {
      const b = W.ball, d = hy(tx - b.x, ty - b.y), aerial = !!(opt && opt.aerial);
      let dur, apex = (opt && opt.apex) || 0;
      if (aerial) { dur = 0.45 + d / (kind === 'cross' || kind === 'corner' || kind === 'fkc' ? 19 : 21); if (!(opt && opt.apex)) apex = cl(d / 4.2, 2.2, 13); }
      else { const v = opt && opt.v ? opt.v : cl(10.5 + d * 0.3, 11, 22); dur = Math.max(0.15, d / v); }
      W.dirty = true;
      W.fl = { x0: b.x, y0: b.y, x1: tx, y1: ty, t0: W.t, dur, kind, from: p, to, aerial, apex, v: d / Math.max(0.1, dur), u: 0, offside: null };
      W.owner = null; W.last = p.s; if (p) { p.carry = null; }
      return W.fl;
    };
    // ---------- contrôle de balle et première touche (4 niveaux) ----------
    // la qualité de la touche dépend de la technique, du dribble, de la décision,
    // de la pression, de la vitesse et de la hauteur du ballon, et de la fraîcheur.
    const touchScore = (q, f) => {
      const nd = nearestOpp(q).d;
      return q.dri * 0.45 + q.pas * 0.35 + q.dec * 0.2
        - (nd < 1.6 ? 16 : nd < 2.6 ? 9 : nd < 4 ? 4 : 0)
        - (f && f.aerial ? 9 : 0) - (f && f.v > 18 ? 6 : 0) - (f && f.v > 24 ? 4 : 0)
        - (100 - q.energy) * 0.12 + WX.ctrl;   // §54 la pluie et la neige salissent les contrôles
    };
    const receive = (q) => {
      const f = W.fl;
      if (f && f.offside === q) { W.fl = null; offsideCall(q); return; }
      const no = nearestOpp(q), pr = no.d < 2 ? 1 : 0;
      const tq = touchScore(q, f);
      const bad = cl(0.018 + (70 - tq) * 0.0072 + pr * (inBox(aOf(q.s, q.y), q.x) ? 0.08 : 0.03), 0.01, 0.4);
      if (f && f.from && f.from.s === q.s) { W.st[q.s].pc++; rt(f.from, 0.004); W.lastPass = { from: f.from, to: q, t: W.t, kind: f.kind, back: aOf(q.s, q.y) < aOf(q.s, f.y0) - 4 }; }
      if (R() < bad) {
        W.fl = null; W.owner = null; const b = W.ball, ang = R() * 6.283; b.vx = Math.cos(ang) * 3.5 + (f ? (f.x1 - f.x0) / f.dur * 0.15 : 0); b.vy = Math.sin(ang) * 3.5 + (f ? (f.y1 - f.y0) / f.dur * 0.15 : 0); b.z = 0; W.last = q.s; q.beat = 0.35; return;
      }
      gain(q, 'pass');
      const roll = tq + (R() - 0.5) * 26;
      const lvl = roll < 48 ? 'long' : roll < 76 ? 'correct' : roll < 90 ? 'oriente' : 'elite';
      W.cnt = W.cnt || {}; W.cnt['t_' + lvl] = (W.cnt['t_' + lvl] || 0) + 1;
      if (lvl === 'long') {
        // contrôle long : le ballon s'échappe d'un mètre, le défenseur le plus proche peut revenir
        q.ctrlT = W.t + ctrlDelay(q) + 0.42; q.nextDec = q.ctrlT;
        if (no.p && no.d < 5) no.p.tkT = Math.min(no.p.tkT || 0, W.t);
        if (no.d < 6 && R() < 0.3) com('Contrôle un peu long de ' + q.short);
      } else if (lvl !== 'correct') {
        // contrôle orienté : la touche met déjà le joueur dans le sens du jeu
        q.ctrlT = W.t + Math.max(0.09, ctrlDelay(q) * (lvl === 'elite' ? 0.4 : 0.6)); q.nextDec = q.ctrlT;
        const gy = yOf(q.s, PL), dx = 34 - q.x, dy = gy - q.y, dd = hy(dx, dy) || 1;
        q.fx = dx / dd; q.fy = dy / dd;
        q.vx += q.fx * 0.9; q.vy += q.fy * 0.9;
        if (lvl === 'elite') {
          rt(q, 0.04);
          if (no.p && no.d < 4.5) { no.p.beat = 0.8; com('Contrôle orienté de ' + q.short + ', il prend le dos de ' + no.p.short + ' !'); if (aOf(q.s, q.y) > 62) key(14, q.s, 'drib'); }
        }
      }
      // §19 passe en première intention : un joueur technique, ou pressé, joue sans contrôler
      const tech1 = q.pas * 0.6 + q.dri * 0.2 + q.dec * 0.2;
      const pOne = cl((tech1 - 62) * 0.009, 0, 0.2) * (no.d < 3 ? 1.8 : 1) * (lvl === 'long' ? 0 : 1) * (q.line === 'GB' ? 0 : 1);
      if (R() < pOne) { q.oneTouch = true; q.ctrlT = W.t; q.nextDec = W.t; }
      if (inBox(aOf(q.s, q.y), q.x)) { key(14, q.s, 'box'); W.cnt.boxRcv = (W.cnt.boxRcv || 0) + 1; }
    };
    const intercept = (q) => {
      const f = W.fl; W.fl = null; if (f && f.from) rt(f.from, -0.03); rt(q, 0.05); W.st[q.s].tk++;
      gain(q, 'int'); com('Interception de ' + q.short);
    };
    const offsideCall = (q) => {
      W.st[q.s].off++; banner('HORS-JEU', q.short, '#F2F4F7', 1.4); com('Hors-jeu de ' + q.short + ', le drapeau se lève'); logE('Hors-jeu de ' + q.name + ' signalé', '#9AA3B0', 'O', q.s);
      setPiece('fk', OT[q.s], q.x, q.y, 'off');
    };
    const flightStep = () => {
      const f = W.fl, b = W.ball;
      f.u = Math.min(1, (W.t + DT - f.t0) / f.dur);
      const e = f.aerial || f.kind === 'shot' ? f.u : 1 - Math.pow(1 - f.u, 1.35);
      b.x = f.x0 + (f.x1 - f.x0) * e; b.y = f.y0 + (f.y1 - f.y0) * e; b.z = f.apex ? 4 * f.apex * f.u * (1 - f.u) : 0;
      if (f.kind === 'shot') { if (f.u >= 1) shotArrive(); return; }
      if (b.x < -0.3 || b.x > PW + 0.3 || b.y < -0.3 || b.y > PL + 0.3) { if (!f.aerial || b.z < 2.4) { W.fl = null; outOfPlay(); return; } }
      if (!f.aerial) {
        for (const q of all()) {
          if (q === f.from && W.t - f.t0 < 0.4) continue; if (q.fall > 0 || q.beat > 0.2) continue;
          const d = hy(q.x - b.x, q.y - b.y); if (d > 1.05) continue;
          if (q === f.to) { receive(q); return; }
          if (q.s !== f.from.s) { const pI = cl(0.3 + (q.def - 60) / 85 + (f.u > 0.8 ? 0.15 : 0) + (f.v < 13 ? 0.1 : 0) + (q.line === 'GB' ? 0.35 : 0) + (inBox(aOf(f.from.s, b.y), b.x) ? 0.14 : 0), 0.12, 0.88); if (R() < pI) { intercept(q); return; } }
          else if (f.u > 0.55 && R() < 0.3) { receive(q); return; }
        }
      }
      if (f.u >= 1) arrive();
    };
    const arrive = () => {
      const f = W.fl, b = W.ball; W.fl = null;
      if (f.aerial) { if (aerialContest(f)) return; b.vx = (f.x1 - f.x0) / f.dur * 0.35; b.vy = (f.y1 - f.y0) / f.dur * 0.35; b.z = 0.05; b.vz = 2.4; return; }
      if (f.to && !f.to.red && hy(f.to.x - b.x, f.to.y - b.y) < 1.7) { W.fl = f; receive(f.to); if (W.fl === f) W.fl = null; return; }
      b.vx = (f.x1 - f.x0) / f.dur * 0.42; b.vy = (f.y1 - f.y0) / f.dur * 0.42; b.z = 0;
    };
    const aerialContest = (f) => {
      const L = { x: f.x1, y: f.y1 }, kS = f.from ? f.from.s : W.last, dS = OT[kS], gk = TM[dS].ps[0];
      const isCross = f.kind === 'cross' || f.kind === 'corner' || f.kind === 'fkc';
      if (!gk.red && (isCross || f.kind === 'long' || f.kind === 'gkl' || f.kind === 'through')) {
        const la = aOf(dS, L.y);
        if (la < 7.5 && Math.abs(L.x - 34) < 11 && hy(gk.x - L.x, gk.y - L.y) < 5.5) {
          if (R() < cl(0.5 + (gk.han - 65) / 90, 0.3, 0.8)) { rt(gk, 0.08); com(gk.short + ' sort et capte le ballon'); gkHold(gk); return true; }
        }
      }
      const cands = all().filter((q) => q.fall <= 0 && q.line !== 'GB' && hy(q.x - L.x, q.y - L.y) < 2.6);
      if (!cands.length) return false;
      const w = cands.map((q) => Math.pow((q.phy + (q.target ? 10 : 0)) / 70, 3.5) * (1.6 - hy(q.x - L.x, q.y - L.y) / 2.6) * (q.s === dS ? (isCross ? 2.1 : 1.1) : 1));
      let r = R() * w.reduce((a, v) => a + v, 0), win = cands[0];
      for (let k = 0; k < cands.length; k++) { r -= w[k]; if (r <= 0) { win = cands[k]; break; } }
      const b = W.ball; b.x = L.x; b.y = L.y; b.z = 1.8;
      if (R() < 0.035) { const opp = cands.find((q) => q.s !== win.s); if (opp) { W.fl = null; const boxD = inBox(aOf(kS, L.y), L.x); if (boxD && R() < 0.65) { const at = cands.find((q) => q.s === kS), df = cands.find((q) => q.s === dS); if (at && df) { foul(at, df, 'air'); return true; } } foul(opp, win, 'air'); return true; } }
      if (isCross) {
        if (win.s === kS) { const a = aOf(win.s, win.y), contested = cands.some((q) => q.s === dS && hy(q.x - win.x, q.y - win.y) < 1.5); if (contested && R() < 0.5) { b.vx = (R() - 0.5) * 8; b.vy = (R() - 0.5) * 8; b.z = 1.2; b.vz = 1; W.owner = null; W.last = win.s; com('Duel aérien, le ballon retombe dans la surface'); return true; } if (a > 86 && Math.abs(win.x - 34) < 15) { W.owner = null; const tech2 = win.dri * 0.5 + win.sht * 0.5; const foot = b.z < 2.1 && R() < cl((tech2 - 60) * 0.013, 0, 0.45);   // §23 reprise de volée au lieu de la tête
          if (foot) W.forceSv = b.z > 1.35 && tech2 > 82 && R() < 0.25 ? 'retourne' : b.z > 0.5 ? 'volee' : 'demi';
          shoot(win, !foot); return true; } gain(win, 'air'); return true; }
        rt(win, 0.04); W.st[dS].tk++; clearance(win, true); return true;
      }
      rt(win, 0.03);
      if (R() < 0.5 + (win.phy - 65) / 100) { gain(win, 'air'); if (win.s === kS && f.kind !== 'clear') com(win.short + ' remporte le duel aérien'); return true; }
      const mate = nearestOf(win.s, win.x, win.y, win).p;
      if (mate && hy(mate.x - win.x, mate.y - win.y) < 16) { const ff = kick(win, mate.x + mate.vx * 0.5, mate.y + mate.vy * 0.5, 'pass', mate, { aerial: true, apex: 1.5 }); ff.dur *= 0.8; com('Déviation de la tête de ' + win.short); return true; }
      return false;
    };
    const clearance = (p, head) => {
      const s = p.s, a = aOf(s, p.y);
      if (head && a < 9 && R() < 0.22) { W.last = s; com('Dégagement de ' + p.short + '… en corner'); outBehind(s, p.x); return; }
      const ta = a + (head ? 12 + R() * 12 : 32 + R() * 22), tx = cl(p.x + (R() - 0.5) * 36 + (p.x < 34 ? -8 : 8), 4, 64);
      kick(p, tx, yOf(s, Math.min(ta, 100)), 'clear', null, { aerial: true, apex: head ? 3 : 9 });
      com((head ? 'Dégagement de la tête de ' : 'Dégagement de ') + p.short);
    };
    const outBehind = (defS, x) => { W.fl = null; W.owner = null; setPiece('corner', OT[defS], x, yOf(defS, 0)); };
    const gkHold = (gk) => { gain(gk, 'gk'); W.gkHold = gk; const T = TM[gk.s]; gk.ctrlT = W.t + 1.4 + (T.tac.timewaste && W.score[gk.s] > W.score[OT[gk.s]] ? 2.5 : 0); gk.nextDec = gk.ctrlT; };
    const shotArrive = () => {
      const f = W.fl, p = f.shooter, s = p.s, o = OT[s], b = W.ball, gk = TM[o].ps[0]; W.fl = null;
      if (f.res === 'goal') { b.x = f.x1; b.y = yOf(s, PL + 1.3); b.z = 0.4; goalScored(p, f); return; }
      if (f.res === 'save') {
        rt(gk, 0.12 + f.xg * 0.9);
        const dbl = W.t - (W.lastSaveT || -9) < 2.6 && W.lastSaveGk === gk.code;
        const SAV = dbl ? 'DOUBLE ARRÊT !' : f.xg > 0.35 ? 'ARRÊT RÉFLEXE !' : f.sv === 'lob' ? 'LE GARDIEN SE DÉTEND' : f.sv === 'rasSol' || f.sv === 'ferme' ? 'ARRÊT DU PIED' : f.head ? 'CLAQUETTE !' : 'ARRÊT !';
        const SAVC = dbl ? gk.short + ' repousse une deuxième fois, incroyable !' : f.xg > 0.35 ? 'Réflexe énorme de ' + gk.short + ' !' : f.sv === 'lob' ? gk.short + ' se détend et capte le ballon piqué' : f.sv === 'rasSol' || f.sv === 'ferme' ? gk.short + ' sort le pied, superbe' : f.head ? gk.short + ' claque la tête de ' + p.short + ' sur sa barre' : 'Parade de ' + gk.short + ' devant ' + p.short + ' !';
        W.lastSaveT = W.t; W.lastSaveGk = gk.code;
        banner(SAV, gk.short, '#F2F4F7', 1.4); com(SAVC);
        if (f.xg > 0.22 && !f.pen) logE('Grosse parade de ' + gk.name + ' devant ' + p.name, s === 'H' ? '#BDEBC9' : '#F2B6B6', 'save', s);
        const r = R(), cp = cl(0.44 + (gk.han - 65) / 70 - f.xg * 0.25, 0.2, 0.78);
        if (r < cp) { gkHold(gk); return; }
        if (r < cp + (1 - cp) * 0.55) { com('Le gardien détourne en corner'); outBehind(o, b.x); return; }
        b.vx = (R() - 0.5) * 9; b.vy = (s === 'H' ? 1 : -1) * (4 + R() * 5); b.z = 0.3; W.owner = null; W.last = o; return;
      }
      if (f.res === 'miss') {
        if (f.post) { banner('POTEAU !', p.short, '#FFE14D', 1.4); com('Sur le poteau !'); b.vx = (R() - 0.5) * 8; b.vy = (s === 'H' ? 1 : -1) * (5 + R() * 6); W.owner = null; W.last = s; return; }
        banner('À CÔTÉ', p.short, '#F2F4F7', 1.1); com(p.short + ' manque le cadre'); setPiece('gk', o, b.x, b.y); return;
      }
      const bl = f.blocker;
      if (aOf(s, bl.y) > 92 && Math.abs(bl.x - 34) < 9 && R() < 0.012) { ownGoal(bl, p); return; }
      rt(bl, 0.06); W.st[o].tk++; banner('CONTRÉ !', bl.short, '#F2F4F7', 1.1); com('Frappe contrée par ' + bl.short);
      if (aOf(s, bl.y) > 95 && R() < 0.35) { outBehind(o, bl.x); return; }
      b.x = bl.x; b.y = bl.y; b.vx = (R() - 0.5) * 11; b.vy = (s === 'H' ? 1 : -1) * (2 + R() * 7) * (R() < 0.35 ? -1 : 1); b.z = 0; W.owner = null; W.last = o;
    };
    const ownGoal = (bl, shooter) => {
      const s = shooter.s, o = bl.s; W.score[s]++; rt(bl, -0.9); const b = W.ball; b.x = 34; b.y = yOf(s, PL + 1.3); b.z = 0.3;
      mark({ k: 'goal', s, c: bl.code, name: bl.short }); banner('CSC !', bl.short + ' · ' + W.score.H + ' - ' + W.score.A, s === 'H' ? '#2ECC71' : '#FF4757', 2.8);
      com('Malheureux ' + bl.short + ' : la frappe de ' + shooter.short + ' est déviée dans son propre but !');
      logE('BUT ! ' + bl.name + ' contre son camp, frappe déviée de ' + shooter.name + ' (' + W.score.H + '-' + W.score.A + ')', s === 'H' ? '#48E08B' : '#FF4757', 'G', s);
      key(100, s, 'goal'); W.celK = 'calme'; W.cel = W.t + 3.2; W.celS = s; W.scorer = shooter; W.owner = null; W.fl = null;
    };
    const goalScored = (p, f) => {
      const s = p.s, o = OT[s]; W.score[s]++;
      const lp = W.lastPass, as = lp && lp.to === p && lp.from.s === s && W.t - lp.t < 12 && lp.from !== p ? lp.from : null;
      rt(p, 1.0); p.g++; p.momT = W.clk + 360; if (as) { rt(as, 0.55); as.as++; as.momT = W.clk + 360; }
      rt(TM[o].ps[0], -0.25); LV[o].forEach((q) => { if (q.line === 'DEF') rt(q, -0.1); });
      // ---- variété des buts : type de finition + commentaire + bandeau ----
      const pick = (arr) => arr[Math.floor(R() * arr.length)];
      const asN = as ? as.name : '', o1 = f.orig || 'solo', far = f.dist >= 22, close = f.dist <= 8;
      let kind, how;
      if (f.pen) { kind = 'pen'; how = pick(['sur penalty, à contre-pied', 'sur penalty, en force', 'sur penalty, en pleine lucarne', 'sur penalty, d’une panenka']); }
      else if (f.fk) { kind = 'fk'; how = pick(['sur coup franc direct, au-dessus du mur', 'sur coup franc, dans la lucarne', 'sur coup franc, à ras de terre sous le mur', 'sur coup franc enroulé, imparable']); }
      else if (f.head) { kind = 'head'; how = pick(['de la tête', 'd’une tête plongeante', 'd’une tête décroisée', 'de la tête au second poteau']) + (asN ? ', centre de ' + asN : ''); }
      else if (f.sv === 'retourne') { kind = 'volley'; how = pick(['d’un retourné acrobatique', 'd’un ciseau retourné sous la barre']) + (asN ? ', sur le centre de ' + asN : ''); }
      else if (f.sv === 'volee') { kind = 'volley'; how = pick(['d’une reprise de volée', 'd’une volée en pleine lucarne', 'd’une reprise instantanée du plat du pied']) + (asN ? ', servi par ' + asN : ''); }
      else if (f.sv === 'demi') { kind = 'volley'; how = pick(['d’une demi-volée', 'd’une demi-volée à ras de terre', 'd’une demi-volée sous la barre']) + (asN ? ', sur le ballon de ' + asN : ''); }
      else if (f.sv === 'talon') { kind = 'close'; how = pick(['d’une talonnade pleine d’audace', 'du talon, dos au but']) + (asN ? ', servi par ' + asN : ''); }
      else if (f.gkOut && f.xg < 0.4 && R() < 0.8) { kind = 'lob'; how = pick(['d’un lob somptueux sur le gardien sorti', 'd’une pichenette par-dessus le gardien', 'd’un ballon piqué au-dessus du gardien']) + (asN ? ', lancé par ' + asN : ''); }
      else if (o1 === 'long' || far) { kind = 'long'; how = pick(['d’une frappe de 25 mètres', 'd’un missile de loin', 'd’une frappe enroulée de l’extérieur de la surface', 'd’une volée lointaine', 'd’une frappe sous la barre depuis l’entrée de la surface']) + (asN ? ', décalé par ' + asN : ''); }
      else if (o1 === 'cross') { kind = 'volley'; how = pick(['d’une reprise de volée', 'du plat du pied sur un centre', 'd’une reprise instantanée', 'd’un tacle rageur au second poteau']) + (asN ? ' de ' + asN : ''); }
      else if (o1 === 'through') { kind = 'through'; how = pick(['après une ouverture dans la profondeur', 'lancé seul face au gardien', 'd’un piqué après une passe en profondeur', 'en glissant le ballon entre les jambes du gardien']) + (asN ? ' de ' + asN : ''); }
      else if (o1 === 'counter') { kind = 'counter'; how = pick(['au bout d’un contre éclair', 'après une contre-attaque fulgurante', 'en conclusion d’un contre à trois contre deux']) + (asN ? ', servi par ' + asN : ''); }
      else if (o1 === 'solo' && (f.held > 3 || f.nd < 2)) { kind = 'solo'; how = pick(['après un slalom dans la défense', 'd’un exploit individuel', 'après un petit pont et une frappe croisée', 'après avoir effacé deux défenseurs']); }
      else if (close) { kind = 'close'; how = pick(['du bout du pied à bout portant', 'sur un cafouillage dans la surface', 'en renard des surfaces', 'd’une talonnade astucieuse']) + (asN ? ', servi par ' + asN : ''); }
      else if (f.sv === 'apresDrib') { kind = 'solo'; how = pick(['dans la foulée de son dribble', 'après avoir éliminé son vis-à-vis', 'enchaînant crochet et frappe']); }
      else if (f.sv === 'ferme') { kind = 'long'; how = pick(['sous un angle totalement fermé', 'd’un angle impossible, au premier poteau', 'depuis la ligne de sortie de but']) + (asN ? ', servi par ' + asN : ''); }
      else if (f.sv === 'rasSol') { kind = 'pass'; how = pick(['d’une frappe à ras de terre', 'd’un plat du pied au ras du poteau', 'd’une frappe rasante sous le gardien']) + (asN ? ', servi par ' + asN : ''); }
      else if (f.sv === 'reprise') { kind = 'volley'; how = pick(['d’une reprise à la retombée du ballon', 'd’une demi-volée rageuse']) + (asN ? ', sur le centre de ' + asN : ''); }
      else if (f.sv === 'enroule') { kind = far ? 'long' : 'pass'; how = pick(['d’une frappe enroulée dans la lucarne opposée', 'en enroulant sa frappe au second poteau', 'd’un enroulé imparable']) + (asN ? ', décalé par ' + asN : ''); }
      else if (f.sv === 'puissant') { kind = far ? 'long' : 'pass'; how = pick(['d’une frappe surpuissante', 'd’une mine sous la barre', 'd’un boulet de canon']) + (asN ? ', servi par ' + asN : ''); }
      else if (f.sv === 'seche') { kind = 'pass'; how = pick(['d’une frappe en première intention', 'en une touche, sans contrôle', 'd’une reprise sèche, le gardien est surpris']) + (asN ? ', sur la passe de ' + asN : ''); }
      else if (f.sv === 'faible') { kind = 'pass'; how = pick(['de son mauvais pied', 'du pied faible, mais ça suffit']) + (asN ? ', servi par ' + asN : ''); }
      else { kind = 'pass'; how = pick(['d’une frappe croisée', 'du gauche à ras de terre', 'd’une frappe placée petit filet', 'en une touche']) + (asN ? ', servi par ' + asN : ''); }
      const BAN = { pen: ['PENALTY TRANSFORMÉ', 'BUT !'], fk: ['COUP FRANC MAGISTRAL', 'QUEL COUP FRANC !'], head: ['BUT DE LA TÊTE !', 'BUT !'], lob: ['LOB SOMPTUEUX', 'QUEL BUT !'], long: ['GOLAZO !', 'QUELLE FRAPPE !', 'MISSILE !'], volley: ['QUELLE REPRISE !', 'BUT !'], through: ['BUT !', 'PROFONDEUR !'], counter: ['CONTRE ÉCLAIR', 'BUT !'], solo: ['EXPLOIT INDIVIDUEL', 'QUEL BUT !'], close: ['BUT !', 'RENARD DES SURFACES'], pass: ['BUT !', 'BUUUT !'] };
      const COM = { pen: ['Sans trembler : {p} transforme le penalty.', '{p} prend le gardien à contre-pied !'], fk: ['Coup franc de {p}, le ballon file dans la lucarne !', '{p} passe au-dessus du mur, imparable !'], head: ['{p} s’élève plus haut que tout le monde !', 'Tête rageuse de {p}, le gardien ne peut rien faire !'], lob: ['{p} voit le gardien avancé et le lobe !', 'Pichenette de génie de {p} !'], long: ['Frappe de loin de {p}, quel missile !', '{p} arme de 25 mètres, lucarne opposée !', 'Personne ne l’attendait : {p} tente et ça rentre !'], volley: ['Reprise de volée de {p}, magnifique !', '{p} reprend le centre en une touche !'], through: ['{p} file seul au but et conclut !', 'Lancé dans la profondeur, {p} ne tremble pas !'], counter: ['Contre éclair conclu par {p} !', 'En trois passes, {p} punit la défense !'], solo: ['{p} efface tout le monde et marque !', 'Exploit personnel de {p}, quel slalom !'], close: ['{p} pousse le ballon au fond, à bout portant !', 'Cafouillage dans la surface, {p} en profite !'], pass: ['{p} croise sa frappe, le ballon fait trembler les filets !', 'Frappe placée de {p}, petit filet !', '{p} trouve la faille !'] };
      const excl = f.xg < 0.1 ? ' Une frappe à ' + Math.round(f.xg * 100) + ' % de chance : du grand art.' : '';
      mark({ k: 'goal', s, c: p.code, name: p.short }); banner(pick(BAN[kind]), p.short + ' · ' + W.score.H + ' - ' + W.score.A, s === 'H' ? '#2ECC71' : '#FF4757', 2.8);
      com(pick(COM[kind]).replace('{p}', p.short) + excl);
      logE('BUT ! ' + p.name + ' ' + how + ' (' + W.score.H + '-' + W.score.A + ')', s === 'H' ? '#48E08B' : '#FF4757', 'G', s);
      key(100, s, 'goal');
      W.celK = pickCeleb(p, s); W.cel = W.t + (W.celK === 'ballon' ? 1.9 : W.celK === 'calme' ? 3.2 : 4.4); W.celS = s; W.scorer = p; W.owner = null;
      com(CELEB_TXT[W.celK].replace('{p}', p.short));
    };
    // ---------- coups de pied arrêtés ----------
    const setPiece = (kind, s, x, y, why) => {
      W.owner = null; W.fl = null; W.gkHold = null; const b = W.ball; b.vx = b.vy = b.vz = 0; b.z = 0;
      const T = TM[s];
      let bx = cl(x, 0.5, PW - 0.5), by = cl(y, 0.5, PL - 0.5), sub = kind;
      if (kind === 'pen') { bx = 34; by = yOf(s, PL - 11); }
      if (kind === 'corner') { bx = x < 34 ? 0.5 : PW - 0.5; by = yOf(s, PL - 0.5); }
      if (kind === 'gk') { bx = 34 + (x < 34 ? -1 : 1) * 6 * R(); by = yOf(s, 5.5); }
      if (kind === 'throw') { bx = x < 34 ? 0.3 : PW - 0.3; by = cl(y, 2, PL - 2); }
      if (kind === 'ko') { bx = 34; by = 52.5; }
      if (kind === 'fk') {
        const a = aOf(s, by), cx = Math.abs(bx - 34), fkPref = s === 'H' ? T.tac.freekicks : -1;
        if (a > 76 && cx < 20 && fkPref !== 1 && fkPref !== 2) sub = 'fkd';
        else if ((a > 66 && cx >= 12) || (a > 70 && fkPref === 1)) sub = 'fkc';
      }
      b.x = bx; b.y = by;
      const live = LV[s].filter((q) => q.line !== 'GB');
      let taker;
      if (sub === 'gk') taker = T.ps[0];
      else if (sub === 'pen' || sub === 'fkd') taker = live.slice().sort((a2, b2) => b2.sht - a2.sht)[0];
      else if (sub === 'corner' || sub === 'fkc') taker = live.slice().sort((a2, b2) => b2.pas - a2.pas)[0];
      else if (sub === 'ko') taker = live.filter((q) => q.kind === 'ST' || q.kind === 'AM').sort((a2, b2) => hy(a2.x - 34, a2.y - 52.5) - hy(b2.x - 34, b2.y - 52.5))[0] || live[live.length - 1];
      else taker = live.slice().sort((a2, b2) => hy(a2.x - bx, a2.y - by) - hy(b2.x - bx, b2.y - by))[0];
      if (sub === 'fk' && why === 'off') { const c = LV[s].filter((q) => q.line === 'DEF' || q.line === 'GB').sort((a2, b2) => hy(a2.x - bx, a2.y - by) - hy(b2.x - bx, b2.y - by))[0]; if (c) taker = c; }
      const setup = { throw: 1.6, gk: 2.8, corner: 4.6, fk: 2.2, fkd: 4.6, fkc: 4.2, pen: 4.4, ko: 1.4 }[sub];
      const dead = { throw: 18, gk: 26, corner: 32, fk: 26, fkd: 48, fkc: 34, pen: 60, ko: 0 }[sub] * (TM[s].tac.timewaste && W.score[s] > W.score[OT[s]] ? 1.6 : 1);
      W.set = { kind: sub, s, x: bx, y: by, t0: W.t, ready: W.t + setup, taker, wall: [] };
      W.clk += dead;
      if (sub === 'corner') { W.st[s].cor++; banner('CORNER', club(s), s === 'H' ? '#2ECC71' : '#F2F4F7', 1.3); com('Corner pour ' + club(s)); logE('Corner pour ' + club(s), '#9AA3B0', 'C', s); key(18, s, 'corner'); }
      if (sub === 'fkd') { com('Coup franc bien placé pour ' + club(s) + '. ' + taker.short + ' s’en charge'); key(34, s, 'fkd'); }
      if (sub === 'fkc') { com('Coup franc à centrer pour ' + club(s)); key(22, s, 'fkc'); }
      if (sub === 'throw') com('Touche pour ' + club(s));
      if (sub === 'gk') com('Six mètres pour ' + club(s));
      if (sub === 'pen') { com(taker.short + ' prend le ballon… face à face avec ' + TM[OT[s]].ps[0].short); key(90, s, 'pen'); }
      if (sub === 'fkd') { const o = OT[s], gy = yOf(s, PL), ang = Math.atan2(gy - by, 34 - bx), n = aOf(s, by) > 84 ? 4 : 3; const ws = LV[o].filter((q) => q.line !== 'GB').sort((a2, b2) => b2.phy - a2.phy).slice(0, n);
        ws.forEach((q, k) => { const off = (k - (n - 1) / 2) * 0.8; W.set.wall.push({ p: q, x: bx + Math.cos(ang) * 9.15 + Math.cos(ang + 1.5708) * off, y: by + Math.sin(ang) * 9.15 + Math.sin(ang + 1.5708) * off }); }); }
    };
    const outOfPlay = () => {
      const b = W.ball, lt = W.last || 'H'; W.fl = null; W.owner = null;
      if (b.y < 0 || b.y > PL) { const defS = b.y < 0 ? 'A' : 'H'; if (lt === defS) setPiece('corner', OT[defS], b.x, b.y); else setPiece('gk', defS, b.x, b.y); }
      else setPiece('throw', OT[lt], b.x, b.y);
    };
    const execSet = () => {
      const S = W.set, s = S.s, T = TM[s], p = S.taker, o = OT[s];
      if (!p || p.red) { W.set = null; return; }
      if (hy(p.x - S.x, p.y - S.y) > 1.6 && W.t < S.ready + 2.5) return;
      p.x = S.x - (S.kind === 'throw' ? 0 : 0.5 * Math.sign(34 - S.x)); p.y = S.kind === 'throw' ? S.y : S.y + (s === 'H' ? 0.6 : -0.6);
      W.set = null; W.owner = p; p.ctrlT = W.t; p.rcvT = W.t; W.last = s;
      if (W.poss !== s) { W.poss = s; W.possT = W.t; TM[s].counterUntil = 0; TM[o].cpressUntil = 0; if (TM[o].tac.mark >= 1) assignMarks(TM[o]); }
      const k = S.kind;
      if (k === 'pen') {
        const gk = TM[o].ps[0]; W.st[s].sh++; W.st[s].xg += 0.78;
        const pg = cl(0.78 + (p.sht - 70) * 0.004 - ((gk.red ? 30 : gk.ref) - 70) * 0.004, 0.62, 0.92), r = R();
        const res = r < pg ? 'goal' : r < pg + (1 - pg) * 0.66 ? 'save' : 'miss';
        if (res !== 'miss') W.st[s].on++;
        const side = R() < 0.5 ? -1 : 1, gy = yOf(s, PL), sgn = s === 'H' ? -1 : 1;
        const tx = res === 'miss' ? 34 + side * (4 + R() * 1.5) : 34 + side * (1.6 + R() * 1.6), ty = res === 'save' ? gy - sgn * 0.6 : gy + sgn * (res === 'goal' ? 1.2 : 2.5);
        const f = kick(p, tx, ty, 'shot', null, { v: 23, apex: res === 'miss' ? 1.8 : 0.5 }); Object.assign(f, { res, shooter: p, head: false, xg: 0.78, pen: true });
        if (!gk.red) W.dive = { c: gk.code, dir: (res === 'save' ? side : -side) * (s === 'H' ? 1 : -1), t0: W.t, dur: f.dur + 0.2 };
        if (res === 'save') { rt(gk, 0.5); logE('Penalty arrêté par ' + gk.name + ' !', s === 'H' ? '#F2B6B6' : '#BDEBC9', 'save', s); }
        if (res === 'miss') logE(p.name + ' rate son penalty !', '#F2B6B6', 'miss', s);
        com(p.short + ' s’élance…'); return;
      }
      if (k === 'fkd') {
        const d = hy(34 - S.x, yOf(s, PL) - S.y), base = d < 19 ? 0.1 : d < 23 ? 0.075 : d < 27 ? 0.052 : d < 32 ? 0.032 : 0.018;
        shoot(p, false, { xg: base * cl(0.55 + (p.sht - 62) / 22, 0.45, 2) }); return;
      }
      if (k === 'corner' || k === 'fkc') {
        const nl = S.x < 34 ? -1 : 1, pref = s === 'H' ? T.tac.corners : -1;
        let zone;
        if (k === 'corner') { const r = R(); zone = pref === 0 ? 'near' : pref === 1 ? 'far' : pref === 2 ? 'spot' : pref === 3 ? 'short' : r < 0.3 ? 'six' : r < 0.52 ? 'far' : r < 0.68 ? 'near' : r < 0.8 ? 'spot' : r < 0.91 ? 'short' : 'edge'; }
        else zone = R() < 0.4 ? 'far' : R() < 0.6 ? 'spot' : 'six';
        if (zone === 'short' || zone === 'edge') {
          const q = zone === 'short' ? nearestOf(s, S.x, S.y, p).p : LV[s].filter((q2) => q2 !== p && q2.line !== 'GB').sort((a2, b2) => hy(a2.x - 34, aOf(s, a2.y) - 87) - hy(b2.x - 34, aOf(s, b2.y) - 87))[0];
          if (q) { kick(p, q.x, q.y, 'pass', q, {}); com(zone === 'short' ? 'Corner joué à deux' : 'Corner en retrait vers l’entrée de la surface'); return; }
        }
        const Z2 = { near: [99.2, 34 + nl * 3.4], six: [100.2, 34 + nl * 0.3], far: [98.4, 34 - nl * 4.2], spot: [93.8, 34 - nl * 0.8] }[zone] || [99, 34];
        const sd = 1 + (1 - p.pas / 100) * 4;
        const tx = xl(s, Z2[1] + gauss() * sd), ty = yOf(s, Math.min(103, Z2[0] + gauss() * sd * 0.7));
        const tgt = LV[s].filter((q) => q !== p && q.line !== 'GB').sort((a2, b2) => hy(a2.x - tx, a2.y - ty) - hy(b2.x - tx, b2.y - ty))[0];
        const f = kick(p, tx, ty, k === 'corner' ? 'corner' : 'fkc', tgt, { aerial: true, apex: k === 'corner' ? 5.5 : 6 });
        W.boxRun = { tx, ty, until: W.t + f.dur + 0.3, s };
        com((k === 'corner' ? 'Corner ' : 'Coup franc ') + (zone === 'near' ? 'au premier poteau' : zone === 'far' ? 'au second poteau' : zone === 'spot' ? 'vers le point de penalty' : 'rentrant sur le gardien') + ' de ' + p.short + '…');
        return;
      }
      if (k === 'gk') {
        const shortOk = T.tac.gk === 0;
        let best = null;
        for (const q of LV[s]) { if (q === p) continue; const d = hy(q.x - p.x, q.y - p.y); if (d < 6) continue;
          if (shortOk && d < 32) { const e = passEval(p, q, q.x, q.y, false, 'pass'); if (e && e.pS > 0.84 && (!best || e.pS > best.pS)) best = { q, x: q.x, y: q.y, pS: e.pS, aerial: false }; } }
        if (!best) { const tg = LV[s].filter((q) => q.kind === 'ST' || q.kind === 'W' || q.target).sort((a2, b2) => (b2.phy + (b2.target ? 15 : 0)) - (a2.phy + (a2.target ? 15 : 0)))[0] || LV[s][LV[s].length - 1];
          const tx = cl(tg.x + (R() - 0.5) * 10, 8, 60), ty = yOf(s, cl(aOf(s, tg.y) + (R() - 0.3) * 8, 55, 78));
          kick(p, tx, ty, 'gkl', tg, { aerial: true }); com('Long dégagement de ' + p.short + ' vers ' + tg.short); return; }
        kick(p, best.x, best.y, 'pass', best.q, {}); com(p.short + ' relance court vers ' + best.q.short); return;
      }
      if (k === 'ko') { const q = LV[s].filter((q2) => q2 !== p && (q2.kind === 'CM' || q2.kind === 'DM' || q2.kind === 'AM')).sort((a2, b2) => hy(a2.x - p.x, a2.y - p.y) - hy(b2.x - p.x, b2.y - p.y))[0] || nearestOf(s, p.x, p.y, p).p; kick(p, q.x, q.y, 'pass', q, {}); return; }
      // touche, coup franc joué court : on choisit la meilleure passe proche
      let best = null;
      for (const q of LV[s]) { if (q === p) continue; const d = hy(q.x - p.x, q.y - p.y); if (d < 4 || d > (k === 'throw' ? 22 : 34)) continue;
        const e = passEval(p, q, q.x, q.y, k === 'throw', 'pass'); if (!e) continue; const ev = e.pS * V(s, q.x, q.y, e.space) - (1 - e.pS) * lossCost(s, q.x, q.y); if (!best || ev > best.ev) best = { q, ev }; }
      if (best) { kick(p, best.q.x + best.q.vx * 0.4, best.q.y + best.q.vy * 0.4, 'pass', best.q, { aerial: k === 'throw', apex: k === 'throw' ? 1.6 : 0 }); if (k === 'throw') W.fl.dur = Math.max(0.5, W.fl.dur * 0.8); }
      else { W.owner = p; p.ctrlT = W.t; p.nextDec = W.t; }
    };
    // ---------- valeur des positions ----------
    const V = (s, x, y, space) => { const a = aOf(s, y), lx = xl(s, x); let v = xT(a, lx); if (a > 80) v = Math.max(v, xgAt(a, x) * cl(space / 5, 0.2, 1.1) * 0.85); return v + Math.min(a, 72) * 0.0002 + Math.min(space, 6) * 0.00035; };
    const lossCost = (s, x, y) => 0.011 + xT(PL - aOf(s, y), xl(OT[s], x)) * 1.1;
    const passEval = (p, q, tx, ty, aerial, kind) => {
      const s = p.s, o = OT[s], b = W.ball, d = hy(tx - b.x, ty - b.y); if (d < 3) return null;
      const dur = aerial ? 0.45 + d / 21 : d / cl(10.5 + d * 0.3, 11, 22);
      const tr = 0.12 + Math.max(0, hy(tx - q.x, ty - q.y) - 0.8) / (q.vmax * 0.92);
      let pS = tr > dur + 0.3 ? sig(3 * (dur + 1.3 - tr)) : 1;
      const tArr = Math.max(dur, tr); let space = 99;
      for (const r of LV[o]) {
        const dl = hy(r.x - tx, r.y - ty); if (dl < space) space = dl;
        const react = r.beat > 0 ? 0.8 : 0.28;
        if (aerial) { const to = react + Math.max(0, dl - 1.4) / r.vmax; pS *= sig(3.2 * (to - tArr + 0.15)); }
        else {
          let mm = 9;
          for (let k = 1; k <= 5; k++) { const f = k / 5, tu = (1 - Math.pow(1 - f, 0.7407)) * dur, px = b.x + (tx - b.x) * f, py = b.y + (ty - b.y) * f; const to = react + Math.max(0, hy(r.x - px, r.y - py) - 1.0) / r.vmax; const m = to - (k === 5 ? tArr : tu); if (m < mm) mm = m; }
          pS *= sig(4.5 * (mm + 0.12));
        }
      }
      const skill = p.pas + TM[s].bonus;
      pS *= 1 - cl(d / 110 * (1.45 - skill / 100) * (aerial ? 1.8 : 1), 0, 0.5);
      pS *= 0.85 + 0.15 * TM[s].coh;
      return { pS, space, d, off: kind !== 'through' && isOffPos(q) };
    };
    const pDrib = (p, r) => cl(0.38 + (p.dri + TM[p.s].bonus - r.def - TM[r.s].bonus) / 90 + (TM[p.s].tac.dribble ? 0.03 : 0) + (r.beat > 0 ? 0.25 : 0), 0.12, 0.78);
    // ---------- décision du porteur ----------
    const decide = (p) => {
      const s = p.s, T = TM[s], o = OT[s], a0 = aOf(s, p.y), no = nearestOpp(p), pr = no.d;
      const counter = W.t < T.counterUntil, off = offA[s], isGK = p.line === 'GB';
      const opts = [];
      const Vh = V(s, p.x, p.y, pr);
      const gkO = TM[o].ps[0], gkd = gkO.red ? 99 : hy(gkO.x - p.x, gkO.y - p.y);
      const oneV1 = !isGK && a0 > 84 && gkd < 13 && LV[o].filter((q) => q.line !== 'GB' && aOf(s, q.y) > a0 - 1 && Math.abs(q.x - p.x) < 9).length === 0;
      if (!isGK && a0 > 71 && Math.abs(p.x - 34) < 30) {
        const e = shotEst(p, false);
        const ev = e.xg * (a0 < 88 ? (e.blocker ? 1.5 : 2.4) * (1 + (p.pow - 65) / 70) : 1.0) * (1 + (p.sht - 65) / 110) * (T.tac.longshot && a0 < 88 ? 1.6 : 1) * (T.shout === 'exiger' ? 1.1 : 1) * (1 + (T.ment - 3) * 0.04) - (1 - e.xg) * 0.004;
        if (e.xg > 0.015) opts.push({ k: 'shot', ev: oneV1 ? ev * 1.5 : ev });
      }
      const addPass = (q, tx, ty, kind, aerial) => {
        tx = cl(tx, 1, PW - 1); ty = cl(ty, 1, PL - 1);
        const e = passEval(p, q, tx, ty, !!aerial, kind); if (!e) return;
        const tA = aOf(s, ty); let ev = e.pS * V(s, tx, ty, e.space) - (1 - e.pS) * lossCost(s, tx, ty) * (T.tac.patience ? 1.25 : 1) * (isGK ? 1.5 : 1);
        const prog = tA - a0;
        if (counter) ev *= prog > 5 ? 1.25 : prog < -3 ? 0.55 : 1;
        if (T.tac.pass === 0 && e.d > 26) ev *= 0.85; if (T.tac.pass === 2 && prog > 12) ev *= 1.15;
        if (kind === 'through') ev *= T.tac.behind ? 1.3 : 1.1;
        if (kind === 'switch') ev *= 1.05 + Math.max(0, p.pas - 70) / 260;
        if (isGK && T.tac.gk === 0 && !aerial) ev *= 1.2; if (isGK && T.tac.gk === 1 && aerial) ev *= 1.25;
        if (e.off) { if (R() < 0.62) return; }
        opts.push({ k: 'pass', q, x: tx, y: ty, kind, aerial: !!aerial, ev, off: e.off });
      };
      for (const q of LV[s]) {
        if (q === p || q.fall > 0) continue;
        const dq = hy(q.x - p.x, q.y - p.y); if (dq < 4 || dq > 62) continue;
        const vis = p.dec * 0.6 + p.pas * 0.4;   // §20 un passeur d'élite voit des solutions que les autres ne voient pas
        if (dq > 30 && R() > vis / 100 + 0.2) continue;
        const lead = 0.3 + dq / 32, qa = aOf(s, q.y);
        addPass(q, q.x + q.vx * lead * 0.8, q.y + q.vy * lead * 0.8, 'pass', dq > 38 && !isGK ? true : false);
        if (isGK) { if ((q.kind === 'ST' || q.kind === 'W' || q.target) && dq > 30) addPass(q, q.x, yOf(s, qa + 3), 'long', true); continue; }
        if (qa > 38 && qa + 7 <= Math.max(off - 0.3, aOf(s, W.ball.y))) addPass(q, q.x + (34 - q.x) * 0.1, yOf(s, Math.min(qa + 7, 102)), 'space');
        if ((q.kind === 'ST' || q.kind === 'W' || q.kind === 'AM' || q.duty === 'Attaque' || (T.tac.behind && q.kind !== 'CB' && q.kind !== 'DM')) && qa > off - 10 && qa <= off + 0.4 && off < 96 && !isOffPos(q)) {
          const room = 101 - off;
          if (room > 7) { const tA = off + Math.min(room - 3, 6 + room * 0.28), lx = xl(s, q.x), tlx = cl(lx + (34 - lx) * 0.35, 5, 63); addPass(q, xl(s, tlx), yOf(s, tA), 'through', dq > 30 && R() < 0.5); }
        }
        if (dq > 26 && (T.tac.pass === 2 || q.target || counter) && qa > a0 + 10) addPass(q, q.x, yOf(s, qa + 2), 'long', true);
        // §19 ouverture / changement d'aile : long ballon diagonal vers le couloir opposé
        if (Math.abs(q.x - p.x) > 20 && Math.abs(q.x - 34) > 11 && qa > 28 && pr > 1.6 && spaceAt(s, q.x, q.y) > 4) addPass(q, q.x + (q.x < 34 ? -2 : 2), q.y, 'switch', true);
      }
      if (!isGK && !p.oneTouch) {
        const carry = (dx, dy, len, label) => {
          const dd = hy(dx, dy) || 1; dx /= dd; dy /= dd;
          const tx = cl(p.x + dx * len, 1.5, PW - 1.5), ty = cl(p.y + dy * len, 1.5, PL - 1.5);
          if (hy(tx - p.x, ty - p.y) < 2) return;
          const tc = hy(tx - p.x, ty - p.y) / (p.vmax * 0.82);
          let pS = 1, blk = null, bm = 9;
          for (const r of LV[o]) {
            let mm = 9; for (let k = 1; k <= 3; k++) { const f = k / 3, px = p.x + (tx - p.x) * f, py = p.y + (ty - p.y) * f; const to = (r.beat > 0 ? 0.8 : 0.25) + Math.max(0, hy(r.x - px, r.y - py) - 1.2) / r.vmax; const m = to - tc * f; if (m < mm) mm = m; }
            if (mm < bm) { bm = mm; blk = r; } pS *= sig(4 * (mm + 0.25));
          }
          let drib = false;
          if (bm < -0.05 && blk && hy(blk.x - p.x, blk.y - p.y) < 6.5) { if (blk.line === 'GB') pS *= 0.3; else { drib = true; pS = Math.min(1, pS / sig(4 * (bm + 0.25))) * pDrib(p, blk); } }
          const sp = spaceAt(s, tx, ty);
          let ev = pS * V(s, tx, ty, sp) - (1 - pS) * lossCost(s, p.x, p.y) - (W.t - p.rcvT) * 0.0012;
          if (drib) ev *= T.tac.dribble ? 1.12 : 0.94;
          if (counter && label !== 'side') ev *= 1.2;
          if (oneV1) ev *= 0.55;
          opts.push({ k: 'carry', x: tx, y: ty, ev, drib, blk: drib ? blk : null, label });
        };
        const fy = s === 'H' ? -1 : 1, gy = yOf(s, PL);
        carry(34 - p.x, gy - p.y, pr < 3 ? 5 : 9, 'goal');
        carry(0, fy, pr < 3 ? 5 : 10, 'fwd');
        carry((p.x < 34 ? 1 : -1) * 0.65, fy * 0.76, 7, 'in');
        if (a0 > 58 && Math.abs(p.x - 34) > 15) carry((p.x < 34 ? -1 : 1) * 0.15, fy, 10, 'line');
        if (pr < 2.6) carry(p.x < 34 ? 1 : -1, -fy * 0.3, 4, 'side');
        if (a0 > 74 && Math.abs(p.x - 34) > 11) {
          const nl = p.x < 34 ? -1 : 1;
          const spots = [['near', 34 + nl * 3.2, 100.3], ['far', 34 - nl * 4.5, 99], ['spot', 34 + nl * 0.5, 94], ['six', 34, 101.3]];
          for (const [nm, sx, sa] of spots) {
            const tx = sx, ty = yOf(s, sa); let aw = 0, dw = 0.35;
            for (const q of LV[s]) if (q !== p && q.line !== 'GB') { const d = Math.min(hy(q.x - tx, q.y - ty), hy(q.tx - tx, q.ty - ty) + 0.8); if (d < 4.5) aw += Math.pow(q.phy / 70, 2) * (1.3 - d / 4.5); }
            for (const r of LV[o]) { const d = hy(r.x - tx, r.y - ty); if (d < 3.6) dw += Math.pow(r.phy / 70, 2) * (1.3 - d / 3.6) * 1.2 * (r.line === 'GB' ? 1.5 : 1); }
            if (aw < 0.25) continue;
            const pWin = aw / (aw + dw * 1.5), ev = (0.5 * pWin * 0.8 * xgAt(sa, sx) * 0.5 - (1 - 0.5 * pWin) * 0.008) * [0.65, 1, 1.35][T.tac.cross] * (1 + (p.pas - 65) / 150);
            opts.push({ k: 'cross', x: tx, y: ty, ev, nm });
          }
        }
        if (pr > 2.2) { const held = W.t - p.rcvT; opts.push({ k: 'hold', ev: Vh - held * (T.tac.patience ? 0.0012 : 0.0028) * (counter ? 3 : 1) * (T.tac.timewaste && W.score[s] > W.score[o] ? 0.3 : 1) - (pr < 4 ? 0.004 : 0.0012) }); }
      }
      if (a0 < 24 && pr < 3.2) opts.push({ k: 'clear', ev: -0.0045 });
      if (!opts.length) { opts.push({ k: 'clear', ev: -1 }); }
      opts.sort((a, b) => b.ev - a.ev);
      const best = opts[0];
      const qd = cl(0.35 + (p.dec + T.bonus - 45) / 55, 0.4, 0.96) * (pr < 1.8 ? (T.shout === 'calme' ? 0.96 : 0.88) : 1);
      let ch = best;
      if (R() > qd) { const alt = opts.slice(1, 4).filter((x) => x.ev > best.ev - 0.012); if (alt.length) ch = alt[Math.floor(R() * alt.length)]; }
      if (cfg.dbg) cfg.dbg(W, p, ch, opts);
      exec(p, ch, counter);
    };
    const exec = (p, ch, counter) => {
      const s = p.s, T = TM[s];
      p.nextDec = W.t + T.tempoInt * (0.7 + 0.6 * R()) * (T.tac.timewaste && W.score[s] > W.score[OT[s]] ? 1.6 : 1);
      if (ch.k === 'shot') { shoot(p, false); return; }
      if (ch.k === 'clear') { clearance(p, false); return; }
      if (ch.k === 'hold') { const fy = s === 'H' ? -1 : 1; const sp = (sx, sy) => spaceAt(s, sx, sy); const c1 = [p.x + 2, p.y + fy * 1.5], c2 = [p.x - 2, p.y + fy * 1.5], c3 = [p.x, p.y + fy * 2]; const bestc = [c1, c2, c3].sort((u, v) => sp(v[0], v[1]) - sp(u[0], u[1]))[0]; p.carry = { x: cl(bestc[0], 2, 66), y: bestc[1], until: W.t + 0.6, slow: true }; return; }
      if (ch.k === 'carry') {
        const d = hy(ch.x - p.x, ch.y - p.y); p.carry = { x: ch.x, y: ch.y, until: W.t + d / (p.vmax * 0.8) + 0.2, drib: ch.drib, blk: ch.blk, done: false };
        p.nextDec = Math.min(W.t + (T.tempoInt + 0.25), p.carry.until);
        if (ch.drib) com(p.short + ' provoque ' + ch.blk.short + ' en un contre un');
        else if (d > 8 && aOf(s, ch.y) > aOf(s, p.y) + 6 && nearestOpp(p).d > 5) com(p.short + (counter ? ' file vers le but !' : ' avance balle au pied'));
        return;
      }
      if (ch.k === 'cross') {
        const low = T.tac.cross === 0 || (T.tac.cross === 1 && R() < 0.35);
        const sd = (1.2 + (1 - (p.pas + T.bonus) / 100) * 6) * (nearestOpp(p).d < 2 ? 1.4 : 1) * (1 + weakFoot(p) * 0.4); W.cnt = W.cnt || {}; W.cnt.cross = (W.cnt.cross || 0) + 1;
        const tx = cl(ch.x + gauss() * sd, 1, 67), ty = ch.y + gauss() * sd * 0.8;
        const tgt = LV[s].filter((q) => q !== p && q.line !== 'GB').sort((a2, b2) => hy(a2.x - tx, a2.y - ty) - hy(b2.x - tx, b2.y - ty))[0];
        const f = kick(p, tx, ty, 'cross', tgt, { aerial: true, apex: low ? 1.3 : 4 + R() * 1.5 }); if (low) f.dur *= 0.72;
        W.boxRun = { tx, ty, until: W.t + f.dur + 0.3, s };
        W.st[s].pa++; com((low ? 'Centre tendu de ' : 'Centre de ') + p.short + (ch.nm === 'far' ? ' au second poteau' : ch.nm === 'near' ? ' au premier poteau' : '') + '…');
        key(16, s, 'cross'); return;
      }
      // passe
      const q = ch.q, d = hy(ch.x - p.x, ch.y - p.y), pr = nearestOpp(p).d;
      const skill = p.pas + T.bonus;
      const one = !!p.oneTouch; p.oneTouch = false;
      const sd = d * (0.012 + 0.09 * Math.max(0, 1 - skill / 100)) * (pr < 2 ? 1.6 : pr < 4 ? 1.2 : 1) * (ch.aerial ? 1.7 : 1) * (1.2 - 0.2 * p.energy / 100) * (T.shout === 'calme' ? 0.9 : 1) * (one ? 1.3 : 1) * (1 + weakFoot(p) * 0.35) * WX.pass;
      const tx = ch.x + gauss() * sd, ty = ch.y + gauss() * sd;
      const f = kick(p, tx, ty, ch.kind === 'through' ? 'through' : ch.aerial ? 'long' : 'pass', q, { aerial: ch.aerial });
      W.st[s].pa++;
      if (isOffPos(q)) f.offside = q;
      if (ch.kind === 'switch') { com('Changement d’aile de ' + p.short + ' pour ' + q.short); key(10, s, 'play'); }
      else if (one && R() < 0.45) com(p.short + ' joue en une touche pour ' + q.short);
      if (ch.kind === 'through') { q.run = { x: ch.x, y: ch.y, until: W.t + f.dur + 1.5, free: true }; q.prep = null; com('Passe en profondeur de ' + p.short + ' pour ' + q.short + ' !'); key(18, s, 'through'); }
      else if (ch.aerial && d > 30) com((Math.abs(tx - p.x) > 30 ? 'Renversement de jeu de ' : 'Long ballon de ') + p.short + ' vers ' + q.short);
      else if (inBox(aOf(s, ty), tx) && aOf(s, p.y) > 88 && Math.abs(p.x - 34) > 10) com('Centre en retrait de ' + p.short + ' pour ' + q.short + ' !');
      else if (aOf(s, ty) > aOf(s, p.y) + 14 && d > 18) com(p.short + ' casse les lignes vers ' + q.short);
      if (!ch.aerial && (p.kind === 'CM' || p.kind === 'AM' || p.kind === 'W' || p.kind === 'ST' || p.b2b) && aOf(s, p.y) < 86 && aOf(s, ty) > aOf(s, p.y) - 5 && R() < 0.2 + T.tac.tempo * 0.08 + (counter ? 0.25 : 0)) {
        const lx = xl(s, p.x); p.run = { x: xl(s, cl(lx + (34 - lx) * 0.3, 8, 60)), y: yOf(s, aOf(s, p.y) + 12), until: W.t + 2.6, cap: true };
      }
    };
    // ---------- duels / tacles ----------
    const foul = (fr, vic, cause) => {
      const s = vic.s, o = fr.s, T = TM[o]; W.st[o].fou++; rt(fr, -0.1);
      const a = aOf(s, vic.y), pen = inBox(a, vic.x), tf = T.tac.tackle;
      if (pen) { W.cnt = W.cnt || {}; W.cnt['pen_' + (cause || 'x')] = (W.cnt['pen_' + (cause || 'x')] || 0) + 1; }
      let py = 0.17 + [-0.05, 0, 0.04][tf] + (W.t < TM[s].counterUntil ? 0.16 : 0) + (pen ? 0.1 : 0), prr = 0.004 + (tf === 2 ? 0.002 : 0);
      const betw = LV[o].filter((q) => q.line !== 'GB' && aOf(s, q.y) > a).length;
      if (a > 78 && betw === 0 && Math.abs(vic.x - 34) < 18 && W.owner === vic) prr = pen ? 0.05 : 0.11;   // derniere defense : rouge, mais le cas est rare
      if (T.shout === 'calme') { py *= 0.75; prr *= 0.7; }
      let card = null; const r = R(); if (r < prr) card = 'R'; else if (r < prr + py) card = 'Y';
      if (card === 'Y') { fr.yc++; W.st[o].yc++; rt(fr, -0.35); if (fr.yc >= 2) card = 'R2'; }
      vic.fall = 1.3; W.owner = null; W.fl = null; W.last = o;
      if (card) mark({ k: 'card', c: fr.code, col: card === 'Y' ? '#FFD23F' : '#FF4757' });
      banner(pen ? 'PENALTY !' : card === 'Y' ? 'CARTON JAUNE' : card ? 'CARTON ROUGE' : 'FAUTE', card ? fr.short : 'Coup franc pour ' + club(s), card === 'Y' ? '#FFD23F' : card ? '#FF4757' : pen ? '#FF4757' : '#F2F4F7', pen || card ? 2 : 1.2);
      com((pen ? 'PENALTY ! ' : '') + 'Faute de ' + fr.short + ' sur ' + vic.short + (card === 'Y' ? ' · carton jaune' : card === 'R2' ? ' · deuxième jaune, expulsé !' : card ? ' · carton rouge direct !' : ''));
      const cardTxt = card === 'Y' ? ' · carton jaune' : card === 'R' ? ' · CARTON ROUGE' : card === 'R2' ? ' · 2e jaune, expulsé !' : '';
      if (pen || card) logE((pen ? 'PENALTY ! Faute de ' : 'Faute de ') + fr.name + ' sur ' + vic.name + cardTxt, '#F2E27C', card === 'Y' ? 'Y' : card ? 'R' : 'P', o);
      else if (aOf(o, vic.y) > 68) logE('Coup franc dangereux pour ' + club(o) + ' · faute de ' + fr.name, '#9AA3B0', 'F', o);
      if (card === 'R' || card === 'R2') { W.st[o].rc++; rt(fr, -1.2); fr.red = true; fr.x = -9; key(85, s, 'red'); }
      else if (card === 'Y') key(28, s, 'card');
      else key(a > 72 ? 20 : 5, s, 'foul');
      setPiece(pen ? 'pen' : 'fk', s, vic.x, vic.y);
    };
    const duels = () => {
      const c = W.owner; if (!c || W.set || c.line === 'GB') return;
      const s = c.s, o = OT[s];
      if (c.carry && c.carry.drib && !c.carry.done && c.carry.blk && !c.carry.blk.red) {
        const bl = c.carry.blk;
        if (hy(bl.x - c.x, bl.y - c.y) < 1.4) {
          c.carry.done = true; const pd = pDrib(c, bl); W.cnt = W.cnt || {}; W.cnt.drib = (W.cnt.drib || 0) + 1;
          if (R() < pd) { W.cnt.dribOk = (W.cnt.dribOk || 0) + 1; bl.beat = 1.1; c.beatT = W.t; rt(c, 0.07); rt(bl, -0.03); com(c.short + ' élimine ' + bl.short + ' !'); if (aOf(s, c.y) > 66) key(12, s, 'drib'); c.vx *= 1.1; c.vy *= 1.1; }
          else { const pf = (inBox(aOf(s, c.y), c.x) ? 0.15 : 1) * 0.17 * [0.65, 1, 1.45][TM[o].tac.tackle] * (TM[o].shout === 'calme' ? 0.75 : 1) * (bl.yc >= 1 ? 0.14 : 1);
            if (R() < pf) { foul(bl, c, 'drib'); return; }
            rt(bl, 0.07); rt(c, -0.04); W.st[o].tk++; com('Tacle de ' + bl.short + ', ballon récupéré');
            if (R() < 0.7) gain(bl, 'tackle'); else { W.owner = null; const b = W.ball; b.vx = (R() - 0.5) * 8; b.vy = (R() - 0.5) * 8; W.last = o; }
            c.beat = 0.5; }
          return;
        }
      }
      const gk = TM[o].ps[0];
      if (!gk.red && gk.fall <= 0 && W.t >= gk.tkT && hy(gk.x - c.x, gk.y - c.y) < 2.2 && inBox(aOf(s, c.y), c.x)) {
        gk.tkT = W.t + 0.4;
        const r = R(), pw = cl(0.5 + (gk.div - c.dri) / 90, 0.25, 0.8);
        if (r < pw) { rt(gk, 0.15); com(gk.short + ' plonge dans les pieds de ' + c.short + ' !'); banner('ARRÊT !', gk.short, '#F2F4F7', 1.2); gkHold(gk); return; }
        if (r < pw + 0.008) { foul(gk, c, 'gk'); return; }
      }
      for (const d of LV[o]) {
        if (d.line === 'GB' || d.beat > 0 || d.fall > 0 || W.t < d.tkT) continue;
        const dist = hy(d.x - c.x, d.y - c.y); if (dist > 1.3) continue;
        const fresh = W.t - c.rcvT < 0.8, ownBox = inBox(aOf(s, c.y), c.x);
        const pa = (ownBox ? 0.5 : 1) * 0.34 * [0.7, 1, 1.35][TM[o].tac.tackle] * (fresh ? 1.6 : 1) * (d.press ? 1.3 : 1) * (d.stopper ? 1.2 : 1) * (d.yc >= 1 ? 0.45 : 1);
        d.tkT = W.t + 0.5; if (R() > pa) continue;
        const backToGoal = (c.fy * (s === 'H' ? -1 : 1)) < -0.2;
        const pWin = cl(0.35 + (d.def + TM[o].bonus - Math.max(c.dri, c.phy * 0.92) - TM[s].bonus) / 80 + (backToGoal ? 0.08 : 0) + (fresh ? 0.05 : 0), 0.12, 0.72);
        const pF = (ownBox ? 0.08 : 1) * 0.135 * [0.6, 1, 1.45][TM[o].tac.tackle] * (TM[o].shout === 'calme' ? 0.75 : 1) * (pWin < 0.3 ? 1.3 : 1) * (d.yc >= 1 ? 0.14 : 1);
        const r = R();
        if (r < pWin) { rt(d, 0.07); rt(c, -0.04); W.st[o].tk++; com('Tacle de ' + d.short + ' !'); if (R() < 0.72) gain(d, 'tackle'); else { W.owner = null; const b = W.ball; b.vx = (R() - 0.5) * 9; b.vy = (R() - 0.5) * 9; W.last = o; } return; }
        if (r < pWin + pF) { foul(d, c, 'tackle'); return; }
        d.beat = 0.7; return;
      }
    };
    const pickup = () => {
      const b = W.ball; if (b.z > 1.7) return;
      const cands = all().filter((q) => q.fall <= 0 && q.beat <= 0.3 && hy(q.x - b.x, q.y - b.y) < (q.line === 'GB' ? 1.5 : 1.0));
      if (!cands.length) return;
      const w = cands.map((q) => (q.phy + 30) * (q.line === 'GB' && inBox(aOf(q.s, q.y), q.x) ? 4 : 1));
      let r = R() * w.reduce((a, v) => a + v, 0), win = cands[0];
      for (let k = 0; k < cands.length; k++) { r -= w[k]; if (r <= 0) { win = cands[k]; break; } }
      if (win.line === 'GB' && inBox(aOf(win.s, win.y), win.x) && W.last !== win.s) { gkHold(win); return; }
      if (W.last !== win.s) { rt(win, 0.03); }
      gain(win, 'loose');
    };
    // ---------- placements ----------
    const boxSpots = (T, bX, car) => {
      const s = T.s, nl = bX < 34 ? -1 : 1, map = new Map();
      const spots = [{ a: 100.3, x: 34 + nl * 3 }, { a: 98.6, x: 34 - nl * 4.2 }, { a: 94.2, x: 34 + nl * 0.6 }, { a: 91.5, x: 34 + nl * 4.5 }, { a: 87, x: 34 - nl * 2 }];
      const pool = LV[s].filter((p) => p !== car && p.line !== 'GB' && p.kind !== 'CB' && !(p.kind === 'DM' && !p.b2b) && !(p.kind === 'FB' && p.fbMode !== 1 && T.tac.fullbacks !== 1));
      const pri = (p) => (p.kind === 'ST' ? 0 : p.fox ? -1 : p.kind === 'W' ? (p.lr === nl ? 3 : 1) : p.kind === 'AM' ? 2 : p.b2b || p.duty === 'Attaque' ? 2.5 : p.kind === 'WB' || p.kind === 'FB' ? 4 : 3.5);
      pool.sort((a2, b2) => pri(a2) - pri(b2));
      const n = Math.min(spots.length, pool.length, T.ment >= 4 ? 5 : T.ment <= 1 ? 3 : 4);
      const used = new Set();
      for (let k = 0; k < n; k++) { const p = pool[k]; let bi = -1, bd = 1e9; spots.forEach((sp, j) => { if (used.has(j)) return; const w = toW(s, sp.a, sp.x); const d = hy(w.x - p.x, w.y - p.y) + (p.kind === 'ST' && j === 0 ? -6 : 0) + (p.kind === 'W' && p.lr !== nl && j === 1 ? -8 : 0); if (d < bd) { bd = d; bi = j; } }); used.add(bi); map.set(p, spots[bi]); }
      return map;
    };
    const attackTargets = (T) => {
      const s = T.s, off = offA[s], b = W.ball, bA = aOf(s, b.y), bX = xl(s, b.x);
      const counter = W.t < T.counterUntil, buildUp = bA < 32;
      const car = W.owner && W.owner.s === s ? W.owner : W.fl && W.fl.to && W.fl.to.s === s ? W.fl.to : null;
      const ab = cl(bA - T.rest * 0.9, buildUp ? 9 : 17, 54);
      const cross = bA > 72 && (bX < 18 || bX > 50), boxMode = cross || (bA > 85 && Math.abs(bX - 34) < 22);
      const shiftX = T.tac.overload === 1 ? -7 : T.tac.overload === 3 ? 7 : 0;
      const boxList = boxMode ? boxSpots(T, bX, car) : null;
      const carSettled = car && W.owner === car && W.t > car.ctrlT && nearestOpp(car).d > 3.2;
      for (const p of LV[s]) {
        if (p.line === 'GB' || p === W.owner) continue;
        const rel = p.ba - T.baseDefA, k = p.kind; let a, x, urg = 0.55;
        p.intent = counter ? 'ATTACK_SPACE' : buildUp ? 'BUILD_UP' : k === 'CB' || (k === 'DM' && !p.b2b) ? 'HOLD' : 'SUPPORT';
        const fr = off - 1, span = Math.max(20, fr - ab), f = cl(rel / T.baseLen, 0, 1);
        a = ab + span * Math.pow(f, 0.85);
        if (k === 'CB') { a = Math.min(ab + (p.libero ? -3 : 0), bA - 12); x = 34 + (p.bx - 34) * (buildUp ? 1.6 : 1.1) + (bX - 34) * 0.15; }
        else if (k === 'FB' || k === 'WB') { const m = k === 'WB' ? 1 : p.fbMode != null ? p.fbMode : T.tac.fullbacks; if (m === 0) { a = ab + 7; x = p.lr < 0 ? 9 : 59; } else if (m === 1) { a = ab + span * (bA > 45 ? 0.58 : 0.35) + (k === 'WB' ? 3 : 0); x = p.lr < 0 ? 4 : 64; } else { a = ab + 10; x = 34 + p.lr * 11; } }
        else if (k === 'DM') { const fbHigh = LV[s].filter((q) => (q.kind === 'FB' || q.kind === 'WB') && aOf(s, q.y) > bA - 8).length >= 2; a = ab + (p.deep && buildUp ? 2 : fbHigh ? 3 : Math.max(8, span * 0.22)); x = 34 + (p.bx - 34) * (fbHigh ? 0.2 : 0.6) + (bX - 34) * 0.2; if (fbHigh) p.intent = 'DROP'; }
        else if (k === 'CM' || k === 'AM') { a = ab + span * (k === 'AM' ? 0.72 : 0.5) + (p.b2b ? 4 : 0); if (bA < 50) a = Math.max(a, bA + (k === 'AM' ? 16 : 8)); x = 34 + (p.bx - 34) * 1.05 * T.width + shiftX + (bX - 34) * 0.15; }
        else if (k === 'W' || k === 'WM') { a = k === 'WM' ? ab + span * 0.78 : fr - 1; x = T.width >= 1 && !p.cutIn ? (p.lr < 0 ? 3.5 : 64.5) : 34 + p.lr * 19; }
        else { a = fr; x = 34 + (p.bx - 34) * 1.1; if (p.f9) a = fr - 11; }
        if ((k === 'W' || k === 'ST') && !p.f9) a = Math.max(a, off - (buildUp ? 6 : 1.2));
        if (counter && (k === 'ST' || k === 'W' || k === 'AM' || p.duty === 'Attaque')) { a = Math.min(off - 0.7, bA + 24); urg = 1; if (k === 'W') x = p.lr < 0 ? 12 : 56; }
        if (p.duty === 'Défense' && (k === 'CM' || k === 'FB')) a -= 5;
        if (boxList && boxList.has(p)) { const sp = boxList.get(p); a = sp.a; x = sp.x; urg = 0.85; }
        // soutien au porteur : chercher la meilleure zone libre (jeu de position)
        if (car && !(boxList && boxList.has(p)) && !counter && k !== 'CB') {
          const tw = toW(s, a, x);
          if (hy(tw.x - car.x, tw.y - car.y) < 30) {
            if (W.t >= p.supT) {
              p.supT = W.t + 1.1 + R() * 0.5; let best = null, bs = -1e9;
              for (let dx = -5; dx <= 5; dx += 5) for (let da = -5; da <= 5; da += 5) {
                const ca = Math.min(a + da, off - 0.8), cx = cl(x + dx, 2.5, 65.5), w = toW(s, ca, cx);
                const lane = laneOpen(s, car.x, car.y, w.x, w.y), sp = Math.min(spaceAt(s, w.x, w.y), 7), dc = hy(w.x - car.x, w.y - car.y);
                let sc = lane * 1.0 + Math.min(sp, 6) * 0.55 + ca * 0.1 + xT(ca, cx) * 80 - (dc < 7 ? 4 : dc > 30 ? (dc - 30) * 0.3 : 0) - (Math.abs(dx) + Math.abs(da)) * 0.06;
                for (const q of LV[s]) if (q !== p && q !== car) { const dq = hy(q.tx - w.x, q.ty - w.y); if (dq < 7) sc -= (7 - dq) * 0.45; }
                if (sc > bs) { bs = sc; best = [ca - a, cx - x]; }
              }
              p.sup = best;
            }
            if (p.sup) { a += p.sup[0]; x += p.sup[1]; }
          }
        }
        // appels : préparation le long de la ligne
        if (carSettled && !p.run && (k === 'ST' || k === 'W' || k === 'AM' || p.duty === 'Attaque' || (T.tac.behind && k === 'CM')) && aOf(s, p.y) > off - 10 && bA > 40 && !boxMode) {
          if (!p.prep && R() < 0.05 * (1 + T.tac.behind + Math.max(0, T.ment - 3) * 0.3)) p.prep = { until: W.t + 2.2 + R(), dx: (R() < 0.5 ? -1 : 1) * (3 + R() * 4), err: gauss() * 0.9 * (1.3 - p.dec / 100) + 0.3 };
        }
        if (p.prep) { if (W.t > p.prep.until || !carSettled) p.prep = null; else { a = off - 0.7 + p.prep.err; x += p.prep.dx; urg = 0.95; } }
        if (!p.prep) a = Math.min(a, off - 0.7);
        a = cl(a, 3, 103);
        setTL(p, a, cl(x, 1.5, 66.5), urg);
        // courses déclenchées (dédoublement, appel en profondeur, une-deux)
        if (p.run) {
          if (W.t > p.run.until) p.run = null;
          else { let rw = { x: p.run.x, y: p.run.y }; if (p.run.cap && !p.run.free) { const ra = Math.min(aOf(s, rw.y), off - 0.7); rw.y = yOf(s, ra); } setTW(p, rw.x, rw.y, 1); }
        }
      }
      // dédoublement du latéral quand l'ailier a le ballon
      if (car && W.owner === car && (car.kind === 'W' || car.kind === 'WM') && aOf(s, car.y) > 50) {
        const fb = LV[s].find((q) => (q.kind === 'FB' || q.kind === 'WB') && q.lr === car.lr && !q.run && ((q.fbMode != null ? q.fbMode : T.tac.fullbacks) === 1 || q.kind === 'WB'));
        if (fb && R() < 0.06) { const ca = aOf(s, car.y); fb.run = { x: xl(s, car.lr < 0 ? 3.5 : 64.5), y: yOf(s, Math.min(ca + 11, 99)), until: W.t + 3.5, cap: true }; fb.intent = 'OVERLAP'; }
      }
    };
    const defendTargets = (T) => {
      const s = T.s, o = OT[s], b = W.ball, bA = aOf(s, b.y), bX = xl(s, b.x);
      const car = W.owner && W.owner.s === o ? W.owner : null;
      let Dt = T.lineH;
      const carFree = car && nearestOpp(car).d > 4.5 && W.t > car.ctrlT;
      Dt = Math.min(Dt, bA - (carFree ? 15 : 9));
      if (T.tac.trap && W.lastPass && W.lastPass.to.s === o && W.lastPass.back && W.t - W.lastPass.t < 1.4) Dt = Math.min(T.lineH + 3, bA - 6);
      if (W.t < T.regroupUntil) Dt = Math.min(Dt, T.lineH - 4);
      Dt = Math.max(Dt, bA < 20 ? 5.5 : 8);
      const rate = Dt < T.D ? 3.4 : 2.2; T.D += cl(Dt - T.D, -rate * DT, rate * DT);
      const D = T.D, len = T.len * cl((bA - 8) / 35, 0.45, 1), regroup = W.t < T.regroupUntil;
      // bloc en lignes : chaque ligne garde ses couloirs, coulisse vers le ballon, reste compacte
      const urg = regroup ? 1 : 0.7, nearBox = bA < 30, shiftX = (bX - 34) * (nearBox ? 0.3 : 0.45);
      const L2 = { DEF: [], MIL: [], ATT: [] };
      for (const p of LV[s]) { if (p.line === 'GB') continue; p.press = false; p.prep = null; p.run = null; p.boxM = false; p.intent = regroup ? 'RECOVER' : 'HOLD'; L2[p.line].push(p); }
      Object.values(L2).forEach((arr) => arr.sort((p1, p2) => p1.bx - p2.bx));
      const nD = L2.DEF.length, nM = L2.MIL.length;
      const place = (arr, a, gap, lim) => { const n = arr.length; arr.forEach((p, k) => { const x = cl(34 + (k - (n - 1) / 2) * gap + shiftX, lim, 68 - lim); setTL(p, a, x, urg * (0.75 + 0.25 * T.coh)); }); };
      const dGap = (nD >= 5 ? 8.2 : nD === 3 ? 10.5 : 9.6) * (nearBox ? 0.8 : 1);
      place(L2.DEF, D, dGap, nearBox ? 12 : 4);
      const midA = D + (nearBox ? 8.5 : Math.min(12, len * 0.42));
      const mGap = (nM >= 5 ? 8.8 : nM === 4 ? 10.5 : 11) * (nearBox ? 0.8 : 1);
      place(L2.MIL, midA, mGap, nearBox ? 10 : 4);
      L2.MIL.forEach((p) => { if (p.kind === 'DM' || p.anchor) p.tl.a = midA - 3.5; });
      const attA = Math.max(midA + 12, Math.min(bA + 5, D + len + (T.tac.engage === 2 ? 8 : 2)));
      place(L2.ATT, attA, 14, 10);
      // marquage : décalage latéral dans sa zone, la ligne ne se casse pas
      const gx0 = 34, gy0 = yOf(s, 0);
      for (const p of LV[s]) {
        if (p.line === 'GB' || p.line === 'ATT') continue;
        const man = T.tac.mark === 2 || (T.tac.mark === 1 && p.line === 'MIL');
        const zw = toW(s, p.tl.a, p.tl.x);
        if (man && p.markT && !p.markT.red && p.line === 'MIL') {
          const r = p.markT, ux = gx0 - r.x, uy = gy0 - r.y, ud = hy(ux, uy) || 1, tight = hy(r.x - b.x, r.y - b.y) < 25 ? 1.6 : 3.5;
          const wx = zw.x + (r.x + ux / ud * tight - zw.x) * 0.8, wy = zw.y + (r.y + uy / ud * tight - zw.y) * 0.8;
          setTW(p, wx, wy, 0.8); continue;
        }
        const rad = p.line === 'DEF' ? 8 : 9; let best = null, bd = rad;
        for (const r of LV[o]) { if (r.line === 'GB' || r === car) continue; const d = hy(r.x - zw.x, r.y - zw.y); if (d < bd) { bd = d; best = r; } }
        if (!best) continue;
        const ra = aOf(s, best.y);
        let na = p.tl.a, nx = p.tl.x + (xl(s, best.x) - p.tl.x) * (man ? 0.65 : 0.4);
        if (p.line === 'DEF' && ra < D - 1 && Math.abs(xl(s, best.x) - p.tl.x) < 7) na = Math.max(ra - 1.2, 3);   // suit l'appel dans son dos
        if (p.line === 'MIL' && ra < midA && ra > D + 2) na = Math.max(ra - 1.5, D + 3);                           // ferme l'intervalle
        if (p.line === 'DEF') { na = cl(na, D - 3.5, D + 1); nx = cl(nx, p.tl.x - dGap * 0.45, p.tl.x + dGap * 0.45); }   // la ligne reste plate et espacée
        p.intent = 'MARK';
        setTL(p, na, cl(nx, 3, 65), p.tl.urg);
      }
      // surface : les défenseurs prennent les attaquants dans la boîte, le milieu protège le point de penalty
      if (bA < 24) {
        const threats = LV[o].filter((r) => r.line !== 'GB' && aOf(s, r.y) < 17 && Math.abs(r.x - 34) < 21 && r !== car).sort((a2, b2) => aOf(s, a2.y) - aOf(s, b2.y));
        const avail = new Set(L2.DEF.concat(L2.MIL.filter((p) => p.kind === 'DM' || p.kind === 'CM')));
        threats.forEach((r) => { let bp = null, bdd = 1e9; avail.forEach((p) => { const d = hy(p.x - r.x, p.y - r.y); if (d < bdd) { bdd = d; bp = p; } }); if (bp && bdd < 12) { avail.delete(bp); const ux = gx0 - r.x, uy = gy0 - r.y, ud = hy(ux, uy) || 1; setTW(bp, r.x + ux / ud * 1.1 + r.vx * 0.25, r.y + uy / ud * 1.1 + r.vy * 0.25, 1); bp.boxM = true; bp.intent = 'MARK'; } });
      }
      // couverture : un défenseur qui sort (marquage dans la surface / pressing) est couvert par son voisin de ligne
      L2.DEF.forEach((p, k) => { if (!p.boxM) return; const nb = L2.DEF[k + 1] || L2.DEF[k - 1]; if (nb && !nb.boxM) { const zw = toW(s, nb.tl ? nb.tl.a : D, (nb.tl ? nb.tl.x : 34) + (p.tl && nb.tl ? (p.tl.x - nb.tl.x) * 0.45 : 0)); setTW(nb, zw.x, zw.y, 0.9); nb.intent = 'COVER'; } });
      // pressing
      const tgt = car || (W.fl && W.fl.to && W.fl.to.s === o && !W.fl.aerial ? W.fl.to : null);
      if (!tgt) return;
      const cpress = W.t < T.cpressUntil;
      const trig = (car && W.t - car.rcvT < 1 && car.fy * (o === 'H' ? -1 : 1) < -0.2) || (W.lastPass && W.lastPass.to === tgt && W.lastPass.back && W.t - W.lastPass.t < 1.5);
      const tX = xl(s, tgt.x), tA = aOf(s, tgt.y);
      const trapZone = T.tac.ptrap === 1 ? (tX < 16 || tX > 52) : T.tac.ptrap === 2 ? (tX > 20 && tX < 48 && tA > 30 && tA < 75) : false;
      const nearGoal = (tA < 30 && Math.abs(tX - 34) < 26) || tA < 20 || (car && W.t - car.rcvT > 2.5 && tA < 45);
      const engaged = tA < T.engageA || cpress || trig || trapZone || nearGoal;
      const cand = LV[s].filter((p) => p.line !== 'GB' && p.fall <= 0 && p.beat <= 0 && !p.boxM && (p.line !== 'DEF' || tA < 34 || T.tac.mark === 2 || hy(p.x - tgt.x, p.y - tgt.y) < 6)).map((p) => ({ p, t: hy(p.x - tgt.x, p.y - tgt.y) / p.vmax })).sort((a2, b2) => a2.t - b2.t);
      if (!cand.length) return;
      const p1 = cand[0].p, gx = 34, gy = yOf(s, 0), ux = gx - tgt.x, uy = gy - tgt.y, ud = hy(ux, uy) || 1, d1 = hy(p1.x - tgt.x, p1.y - tgt.y);
      if (engaged && d1 < T.pressR + (cpress ? 10 : 0) + (trig || trapZone ? 5 : 0) + (nearGoal ? 12 : 0)) {
        const mate = nearestOf(o, tgt.x, tgt.y, tgt).p; let ox = 0, oy = 0;
        if (mate) { const mx = mate.x - tgt.x, my = mate.y - tgt.y, md = hy(mx, my) || 1; ox = mx / md * 0.9; oy = my / md * 0.9; }
        setTW(p1, tgt.x + ux / ud * 0.9 + ox, tgt.y + uy / ud * 0.9 + oy, 1); p1.press = true;
        if (tA < 40) { const cv = cand.slice(1).find((c2) => c2.p.kind === 'DM' || (c2.p.line === 'DEF' && tA < 30)); if (cv) { setTW(cv.p, tgt.x + ux / ud * 4.5, tgt.y + uy / ud * 4.5, 1); cand.splice(cand.indexOf(cv), 1); } }
        const n2 = T.pressN + (cpress ? 1 : 0) + (trig || trapZone ? 1 : 0);
        const mates = LV[o].filter((q) => q !== tgt && q.line !== 'GB').sort((a2, b2) => hy(a2.x - tgt.x, a2.y - tgt.y) - hy(b2.x - tgt.x, b2.y - tgt.y));
        let mi = 0;
        for (let k = 1; k < cand.length && k < n2 + 2 && mi < n2 - 1; k++) {
          const pk = cand[k].p; if (pk.line === 'DEF' && tA > 45 && T.tac.mark !== 2 && !cpress) continue;
          const q = mates[mi++]; if (!q) break;
          const vx = gx - q.x, vy = gy - q.y, vd = hy(vx, vy) || 1; setTW(pk, q.x + vx / vd * 1.6, q.y + vy / vd * 1.6, 0.95); pk.press = true;
        }
      } else if (tA < 60 && car) {
        setTW(p1, tgt.x + ux / ud * 3.2, tgt.y + uy / ud * 3.2, 0.85);
        const p2 = cand[1] && cand[1].p; if (p2 && tA < 40) setTW(p2, tgt.x + ux / ud * 7, tgt.y + uy / ud * 7, 0.8);
      }
    };
    const gkTarget = (T, att) => {
      const g = T.ps[0]; if (g.red || g === W.owner) return;
      const s = T.s, b = W.ball, bA = aOf(s, b.y), bX = xl(s, b.x), dB = hy(bA, bX - 34) || 1;
      let a, x;
      if (att) { a = cl(bA * 0.22, 4, 18); x = 34 + (bX - 34) * 0.15; }
      else {
        let dep = cl(1 + dB * 0.045, 1, 5); if ((g.sweep || T.tac.line === 2) && bA > 45) dep = Math.max(dep, Math.min(T.D - 8, 15));
        a = bA / dB * dep; x = 34 + (bX - 34) / dB * dep;
        // sortie sur une passe en profondeur
        if (W.fl && W.fl.from && W.fl.from.s === OT[s] && (W.fl.kind === 'through' || W.fl.kind === 'long')) { const la = aOf(s, W.fl.y1); if (la < 22 && Math.abs(W.fl.x1 - 34) < 20) { setTL(g, la, xl(s, W.fl.x1), 1); return; } }
        if (!W.owner && !W.fl && bA < 16 && Math.abs(bX - 34) < 18) { setTL(g, bA, bX, 1); return; }
      }
      setTL(g, a, x, 0.7);
    };
    const setTargets = () => {
      const S = W.set, s = S.s, o = OT[s], k = S.kind;
      const shape = (T, att) => { if (att) attackTargets(T); else defendTargets(T); };
      if (k === 'ko') {
        ['H', 'A'].forEach((side) => { LV[side].forEach((p) => { if (p.line === 'GB') { setTL(p, 3, 34, 0.6); return; } setTL(p, cl(10 + (p.ba - 12) * 0.78, 5, 50.5), 34 + (p.bx - 34) * 0.95, 0.6); }); });
        if (S.taker) setTW(S.taker, S.x + (s === 'H' ? 0.4 : -0.4), S.y + (s === 'H' ? 0.6 : -0.6), 0.8);
      } else if (k === 'corner' || k === 'fkc') {
        const nl = xl(s, S.x) < 34 ? -1 : 1, T = TM[s], O = TM[o];
        const spots = k === 'corner' ? [{ a: 98.5, x: 34 + nl * 3.2 }, { a: 100, x: 34 + nl * 0.4 }, { a: 98, x: 34 - nl * 4 }, { a: 93.6, x: 34 - nl * 1 }, { a: 95, x: 34 - nl * 7.5 }, { a: 86.5, x: 34 + nl * 2 }]
          : [{ a: 88, x: 30 }, { a: 88, x: 34 }, { a: 88, x: 38 }, { a: 87.5, x: 42 }, { a: 88, x: 26 }, { a: 80, x: 34 }];
        const pool = LV[s].filter((p) => p.line !== 'GB' && p !== S.taker).sort((a2, b2) => (b2.phy + (b2.kind === 'CB' ? 8 : 0)) - (a2.phy + (a2.kind === 'CB' ? 8 : 0)));
        const rest = pool.slice().sort((a2, b2) => (a2.kind === 'DM' || a2.kind === 'FB' ? -1 : 0) - (b2.kind === 'DM' || b2.kind === 'FB' ? -1 : 0)).filter((p) => p.kind !== 'CB').slice(0, 2);
        const box = pool.filter((p) => !rest.includes(p)).slice(0, spots.length);
        box.forEach((p, j) => setTL(p, spots[j].a, spots[j].x, 0.8));
        rest.forEach((p, j) => setTL(p, 52 + j * 8, 26 + j * 16, 0.6));
        pool.filter((p) => !rest.includes(p) && !box.includes(p)).forEach((p, j) => setTL(p, 70, 20 + j * 14, 0.6));
        if (S.taker) setTW(S.taker, S.x + (S.x < 34 ? -0.6 : 0.6), S.y + (s === 'H' ? 0.6 : -0.6), 0.9);
        // défense : zone + marquage
        const def = LV[o].filter((p) => p.line !== 'GB').sort((a2, b2) => b2.phy - a2.phy);
        const zones = k === 'corner' ? [{ a: 5.2, x: 30.5 }, { a: 5.2, x: 33.5 }, { a: 5.2, x: 36.5 }, { a: 1.2, x: 34 + nl * 3.6 }] : [{ a: 17.5, x: 28 }, { a: 17.5, x: 32 }, { a: 17.5, x: 36 }, { a: 17.5, x: 40 }];
        const nZ = O.tac.mark === 2 ? 2 : 4; let di = 0;
        def.slice(0, nZ).forEach((p, j) => { setTL(p, zones[j].a, xl(o, xl(s, zones[j].x)) , 0.85); di++; });
        const markers = def.slice(nZ); const outlets = markers.filter((p) => p.line === 'ATT').slice(0, O.tac.won === 0 ? 2 : 1);
        box.forEach((r, j) => { const p = markers.filter((m) => !outlets.includes(m))[j]; if (!p) return; const gx = 34, gy = yOf(o, 0), ux = gx - r.tx, uy = gy - r.ty, ud = hy(ux, uy) || 1; setTW(p, r.tx + ux / ud * 1, r.ty + uy / ud * 1, 0.85); });
        outlets.forEach((p, j) => setTL(p, 36 + j * 4, 24 + j * 20, 0.6));
        markers.filter((p) => !outlets.includes(p)).slice(box.length).forEach((p, j) => setTL(p, 20, 26 + j * 16, 0.6));
      } else if (k === 'pen') {
        let j = 0; all().forEach((p) => { if (p === S.taker) return; if (p.line === 'GB' && p.s === o) { setTL(p, 0.3, 34, 0.8); return; } if (p.line === 'GB') { setTL(p, 30, 34, 0.5); return; } const a = aOf(s, yOf(s, 86.5 - (j % 3) * 2.5)), x = 18 + (j % 11) * 3.2; setTW(p, x, yOf(s, 86.5 - (j % 3) * 2.2), 0.7); j++; });
        setTW(S.taker, 34, yOf(s, PL - 12.2), 0.8);
      } else {
        shape(TM[s], true); shape(TM[o], false);
        if (k === 'gk') { LV[s].forEach((p) => { if (p.kind === 'CB') setTL(p, 12, 34 + (p.bx - 34) * 2.6, 0.7); if (p.kind === 'FB') setTL(p, 26, p.lr < 0 ? 5 : 63, 0.7); if (p.kind === 'DM') setTL(p, 22, 34, 0.7); });
          if (TM[o].tac.engage === 2) LV[o].forEach((p) => { if (p.line === 'ATT') setTL(p, 84, 34 + (p.bx - 34) * 0.8, 0.8); }); }
        if (k === 'fkd') { S.wall.forEach((w) => { if (!w.p.red) setTW(w.p, w.x, w.y, 1); }); LV[s].filter((p) => p !== S.taker && p.line !== 'GB').slice(-4).forEach((p, j) => setTL(p, 90 + (j % 2) * 3, 26 + j * 5, 0.8)); }
        if (S.taker && k !== 'gk') setTW(S.taker, S.x + (k === 'throw' ? 0 : (S.x < 34 ? -0.5 : 0.5)), S.y + (k === 'throw' ? 0 : (s === 'H' ? 0.6 : -0.6)), 0.9);
        if (k === 'throw') { const mates = LV[s].filter((p) => p !== S.taker && p.line !== 'GB').sort((a2, b2) => hy(a2.x - S.x, a2.y - S.y) - hy(b2.x - S.x, b2.y - S.y)).slice(0, 2); mates.forEach((p, j) => setTW(p, cl(S.x + (S.x < 34 ? 6 + j * 5 : -6 - j * 5), 2, 66), S.y + (j ? -6 : 5), 0.8)); }
      }
      ['H', 'A'].forEach((side) => { const g = TM[side].ps[0]; if (!g.red && !(k === 'pen' && side === o) && !(k === 'gk' && side === s)) gkTarget(TM[side], side === s); });
      if (k === 'gk') { const g = TM[s].ps[0]; setTW(g, S.x, S.y + (s === 'H' ? 0.6 : -0.6), 0.9); }
    };
    // ---------- célébrations ----------
    // chaque célébration a une destination réelle sur le terrain et une durée :
    // quand l'équipe est menée dans le money time, le buteur reprend le ballon et le match repart plus vite.
    const pickCeleb = (sc, s) => {
      const diff = W.score[s] - W.score[OT[s]], min = W.clk / 60;
      if (diff <= 0 && min > 72) return 'ballon';
      const r = R();
      if (r < 0.26) return 'corner';
      if (r < 0.46) return 'foule';
      if (r < 0.62) return 'genou';
      if (r < 0.78) return 'equipe';
      if (r < 0.9) return 'silence';
      return 'calme';
    };
    const CELEB_TXT = {
      corner: '{p} file au poteau de corner, poing serré !',
      foule: '{p} court vers la tribune, bras écartés !',
      genou: '{p} termine à genoux devant le but !',
      equipe: '{p} saute dans les bras de ses coéquipiers !',
      silence: '{p} met un doigt sur la bouche face au public adverse.',
      calme: '{p} lève simplement le poing, le travail n’est pas fini.',
      ballon: '{p} récupère le ballon et court le remettre au rond central !'
    };
    const celebrate = () => {
      const s = W.celS, sc = W.scorer, k = W.celK || 'corner', gy = yOf(s, PL);
      let dx = sc.x, dy = sc.y;
      if (k === 'corner') { dx = sc.x < 34 ? 3 : 65; dy = yOf(s, PL - 4); }
      else if (k === 'foule') { dx = cl(sc.x, 6, 62); dy = yOf(s, PL - 1.5); }
      else if (k === 'genou') { dx = 34 + (sc.x - 34) * 0.4; dy = yOf(s, PL - 9); }
      else if (k === 'equipe') { dx = sc.x < 34 ? 8 : 60; dy = yOf(s, PL - 14); }
      else if (k === 'silence') { dx = cl(sc.x, 4, 64); dy = yOf(s, PL - 3); }
      else if (k === 'ballon') { dx = 34; dy = 52.5; }
      else { dx = sc.x; dy = yOf(s, PL - 16); }
      LV[s].forEach((p) => { if (p === sc) { setTW(p, dx, dy, 0.95); return; } if (p.line === 'GB') return;
        if (k === 'ballon' || k === 'calme') { setTL(p, cl(p.ba, 8, 60), p.bx, 0.5); return; }
        setTW(p, dx + Math.cos(p.i * 1.3) * 2.4, dy + Math.sin(p.i * 1.3) * 2.4, 0.9); });
      LV[OT[s]].forEach((p) => { if (p.line === 'GB') { setTL(p, 2, 34, 0.3); return; } setTL(p, cl(p.ba * 0.7, 8, 45), p.bx, 0.35); });
    };
    const targets = () => {
      if (W.cel > 0) { celebrate(); }
      else if (W.set) setTargets();
      else {
        ['H', 'A'].forEach((s) => { const T = TM[s]; if (W.poss === s) attackTargets(T); else defendTargets(T); gkTarget(T, W.poss === s); });
        // récepteur et duel aérien
        const f = W.fl;
        if (f && f.kind !== 'shot') {
          if (f.to && !f.to.red) setTW(f.to, f.x1, f.y1, 1);
          if (f.aerial) { ['H', 'A'].forEach((s) => { const c = LV[s].filter((p) => p.line !== 'GB' && p !== f.to).sort((a2, b2) => hy(a2.x - f.x1, a2.y - f.y1) - hy(b2.x - f.x1, b2.y - f.y1)); const n = s === (f.from && f.from.s) ? 1 : 2; for (let k = 0; k < n && k < c.length; k++) if (hy(c[k].x - f.x1, c[k].y - f.y1) < 14) setTW(c[k], f.x1 + (k ? 1.2 : 0), f.y1 + (k ? -1 : 0), 1); }); }
          else { const o = f.from ? OT[f.from.s] : 'H'; let best = null, bm = 0.35; for (const r of LV[o]) { if (r.line === 'GB') continue; for (let k2 = 2; k2 <= 5; k2++) { const fr = k2 / 5, px = f.x0 + (f.x1 - f.x0) * fr, py = f.y0 + (f.y1 - f.y0) * fr, tb = (1 - Math.pow(1 - fr, 0.7407)) * f.dur - (W.t - f.t0), to = hy(r.x - px, r.y - py) / r.vmax; if (tb - to > bm) { bm = tb - to; best = { r, px, py }; } } } if (best) setTW(best.r, best.px, best.py, 1); }
        }
        if (W.boxRun && W.t < W.boxRun.until) { const br = W.boxRun; LV[br.s].filter((p) => p.line !== 'GB' && hy(p.x - br.tx, p.y - br.ty) < 9).sort((a2, b2) => hy(a2.x - br.tx, a2.y - br.ty) - hy(b2.x - br.tx, b2.y - br.ty)).slice(0, 2).forEach((p, j) => setTW(p, br.tx + (j ? 1.5 : 0), br.ty + (j ? 1 : 0), 1)); }
        // ballon libre : les plus proches vont le chercher
        if (!W.owner && !W.fl) {
          const b = W.ball, px = b.x + b.vx * 0.7, py = b.y + b.vy * 0.7;
          ['H', 'A'].forEach((s) => { const c = LV[s].filter((p) => p.fall <= 0 && (p.line !== 'GB' || (aOf(s, py) < 16 && Math.abs(px - 34) < 20))).sort((a2, b2) => hy(a2.x - px, a2.y - py) / a2.vmax - hy(b2.x - px, b2.y - py) / b2.vmax); if (c[0]) setTW(c[0], px, py, 1); if (c[1] && hy(c[1].x - px, c[1].y - py) < 10) setTW(c[1], px + 1.5, py, 0.9); });
        }
      }
      // porteur
      const c = W.owner;
      if (c && !W.set) {
        if (c.carry) { if (W.t > c.carry.until) c.carry = null; else setTW(c, c.carry.x, c.carry.y, c.carry.slow ? 0.35 : c.carry.drib ? 1 : 0.85); }
        if (!c.carry) { const fy = c.s === 'H' ? -1 : 1; setTW(c, c.x + (34 - c.x) * 0.03, c.y + fy * 0.6, 0.25); }
      }
      for (const p of ALL) { const tl = p.tl; if (!tl) continue; p.tx = cl(xl(p.s, tl.x), 0.5, PW - 0.5); p.ty = cl(yOf(p.s, tl.a), -0.5, PL + 0.5); p.urg = tl.urg; }
    };
    const move = () => {
      const A2 = all();
      for (const p of A2) {
        const sp = p.vmax * (0.78 + 0.22 * p.energy / 100) * (p.beat > 0 ? 0.4 : 1) * (p.fall > 0 ? 0 : 1) * (p === W.owner ? 0.88 : 1);
        const dx = p.tx - p.x, dy = p.ty - p.y, d = hy(dx, dy);
        const want = Math.min(sp * p.urg, d * 1.7), wx = d > 0.05 ? dx / d * want : 0, wy = d > 0.05 ? dy / d * want : 0;
        let ax = wx - p.vx, ay = wy - p.vy; const am = hy(ax, ay);
        const vv = hy(p.vx, p.vy), turn = vv > 0.6 && want > 0.3 ? Math.max(0, (p.vx * wx + p.vy * wy) / (vv * Math.max(0.01, want))) : 1;   // 1 = tout droit, -1 = demi-tour
        const lim = (p.acc0 != null ? p.acc0 : 0.45) * (p.urg > 0.9 ? 1.18 : 1) * (0.55 + 0.45 * (p.agi0 != null ? p.agi0 : 0.7)) * (turn < 0.2 ? 0.55 + 0.45 * (p.agi0 != null ? p.agi0 : 0.7) : 1) * (0.8 + 0.2 * p.energy / 100);
        if (am > lim) { ax *= lim / am; ay *= lim / am; }
        p.vx += ax; p.vy += ay;
      }
      for (let i = 0; i < A2.length; i++) for (let j = i + 1; j < A2.length; j++) {
        const p = A2[i], q = A2[j], dx = q.x - p.x, dy = q.y - p.y; if (dx > 1.5 || dx < -1.5 || dy > 1.5 || dy < -1.5) continue; const d = hy(dx, dy), mn = p.s === q.s ? 1.5 : 0.95;
        if (d < mn && d > 0.001) { const bp = (p.bal0 != null ? p.bal0 : 0.7), bq = (q.bal0 != null ? q.bal0 : 0.7), tot = bp + bq; const push = (mn - d) * 0.5, ux = dx / d, uy = dy / d; if (p !== W.owner) { p.x -= ux * push * (2 * bq / tot); p.y -= uy * push * (2 * bq / tot); } if (q !== W.owner) { q.x += ux * push * (2 * bp / tot); q.y += uy * push * (2 * bp / tot); } }
      }
      for (const p of A2) {
        p.x = cl(p.x + p.vx * DT, -1, PW + 1); p.y = cl(p.y + p.vy * DT, -1.5, PL + 1.5);
        const v = hy(p.vx, p.vy); if (v > 0.5) { p.fx = p.vx / v; p.fy = p.vy / v; } else { const bx = W.ball.x - p.x, by = W.ball.y - p.y, bd = hy(bx, by); if (bd > 0.5) { p.fx += (bx / bd - p.fx) * 0.2; p.fy += (by / bd - p.fy) * 0.2; } }
        if (p.beat > 0) p.beat -= DT; if (p.fall > 0) p.fall -= DT;
        const vr = v / p.vmax; p.energy = Math.max(12, p.energy - DT * (0.0078 + 0.016 * vr * vr) * (1.25 - p.phy / 200) * (p.line === 'GB' ? 0.3 : 1) * TM[p.s].fatK * (p.drain || 1));
      }
    };
    // §54 météo : tirée une fois par match. Elle agit sur la glisse du ballon,
    // la précision des passes et la propreté des contrôles. Pas de décor : que des effets.
    const WEATHER = {
      soleil: { l: 'Plein soleil', fric: 1, ctrl: 0, pass: 1, pace: 1 },
      nuit: { l: 'Match en nocturne', fric: 1, ctrl: -2, pass: 1.03, pace: 1 },
      pluie: { l: 'Sous la pluie', fric: 0.82, ctrl: -9, pass: 1.18, pace: 0.985 },
      neige: { l: 'Sur un terrain enneigé', fric: 1.35, ctrl: -14, pass: 1.3, pace: 0.95 }
    };
    const wq = R();
    W.wx = wq < 0.52 ? 'soleil' : wq < 0.78 ? 'nuit' : wq < 0.94 ? 'pluie' : 'neige';
    const WX = WEATHER[W.wx];
    const ballStep = () => {
      const b = W.ball;
      if (W.owner) {
        const p = W.owner, sp = hy(p.vx, p.vy), fx = sp > 0.4 ? p.vx / sp : p.fx, fy = sp > 0.4 ? p.vy / sp : p.fy;
        const off = 0.5 + Math.min(0.5, sp * 0.07) + (p.carry && p.carry.drib ? Math.abs(Math.sin(W.t * 9)) * 0.35 : 0);
        b.x = cl(p.x + fx * off, 0.1, PW - 0.1); b.y = cl(p.y + fy * off, 0.1, PL - 0.1); b.z = 0; return;
      }
      if (W.fl) { flightStep(); return; }
      b.x += b.vx * DT; b.y += b.vy * DT;
      if (b.z > 0 || b.vz) { b.vz -= 9.8 * DT; b.z += b.vz * DT; if (b.z <= 0) { b.z = 0; b.vz = Math.abs(b.vz) > 2 ? -b.vz * 0.35 : 0; } }
      const f = b.z > 0.2 ? 0.99 : Math.exp(-1.3 * WX.fric * DT); b.vx *= f; b.vy *= f; if (hy(b.vx, b.vy) < 0.25) { b.vx = b.vy = 0; }
      if (b.x < -0.3 || b.x > PW + 0.3 || b.y < -0.3 || b.y > PL + 0.3) { outOfPlay(); return; }
      pickup();
    };
    // ---------- temps de jeu ----------
    const kickoffReset = (s) => {
      refreshLV();
      ['H', 'A'].forEach((side) => { TM[side].D = TM[side].lineH; LV[side].forEach((p) => { const a = p.line === 'GB' ? 3 : cl(10 + (p.ba - 12) * 0.78, 5, 50.5); const w = toW(side, a, p.line === 'GB' ? 34 : 34 + (p.bx - 34) * 0.95); p.x = w.x; p.y = w.y; p.vx = p.vy = 0; p.run = p.prep = p.carry = null; p.fall = p.beat = 0; }); });
      const b = W.ball; b.x = 34; b.y = 52.5; b.z = 0; b.vx = b.vy = 0; W.owner = null; W.fl = null; W.cel = 0; W.dive = null; W.lastTele = W.t + DT;
      setPiece('ko', s, 34, 52.5);
      const tk = W.set.taker; if (tk) { tk.x = 34 + (s === 'H' ? 0.4 : -0.4); tk.y = 52.5 + (s === 'H' ? 0.6 : -0.6); }
    };
    const oppSubs = () => {
      const T = TM.A; if (!T.bench.length) return;
      const mins = W.clk / 60, due = [62, 71, 80][W.oppSubs]; if (due == null || mins < due || !W.set) return;
      // un entraîneur sort en priorité un joueur averti, puis le plus fatigué
      const pool = LV.A.filter((p) => p.line !== 'GB');
      const cand = pool.sort((a2, b2) => (b2.yc - a2.yc) * 60 + (a2.energy - b2.energy))[0]; if (!cand) return;
      const d = T.bench.shift(); W.oppSubs++;
      api.sub('A', cand.i, Object.assign({}, d, { role: cand.role, duty: cand.duty }));
      logE('Changement pour ' + club('A') + ' : ' + d.name + ' remplace ' + cand.name, '#4FA8E8', 'sub', 'A');
    };
    // ============ CONTRÔLE DIRECT ============
    // gestes techniques : palier selon dribble + agilité, du plus simple au plus rare
    // §31 cinq tiers de gestes : 1 basique, 2 intermédiaire, 3 avancé, 4 élite, 5 exceptionnel.
    // Le tier conditionne l'accès au geste et pilote le rendu : plus le tier est haut, plus l'effet visuel est marqué.
    const DRIBS = [
      { n: 'crochet', lab: 'crochet', min: 0, cost: 0.22, gain: 0.30, tier: 1 },
      { n: 'protect', lab: 'protection de balle', min: 0, cost: 0.10, gain: 0.18, tier: 1 },
      { n: 'feinte', lab: 'feinte de corps', min: 62, cost: 0.26, gain: 0.40, tier: 2 },
      { n: 'double', lab: 'double contact', min: 68, cost: 0.28, gain: 0.46, tier: 2 },
      { n: 'passement', lab: 'passement de jambes', min: 74, cost: 0.32, gain: 0.54, tier: 3 },
      { n: 'roulette', lab: 'roulette', min: 80, cost: 0.36, gain: 0.62, tier: 3 },
      { n: 'pont', lab: 'petit pont', min: 85, cost: 0.42, gain: 0.74, tier: 4 },
      { n: 'sombrero', lab: 'sombrero', min: 91, cost: 0.48, gain: 0.82, tier: 5 }
    ];
    const pickDrib = (p, forced) => {
      const lvl = p.dri * 0.7 + p.agi0 * 30;
      const pool = DRIBS.filter((d) => lvl >= d.min);
      if (!pool.length) return DRIBS[0];
      // les gestes rares restent rares même pour un joueur d'élite
      const w = pool.map((d, i) => (i === 0 || i === 1 ? 3 : Math.max(0.25, 1.6 - (d.min - 55) / 45)) * (forced ? (i > 1 ? 1.6 : 0.5) : 1));
      let r2 = R() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < pool.length; i++) { r2 -= w[i]; if (r2 <= 0) return pool[i]; }
      return pool[0];
    };
    const doSkill = (p, forced) => {
      const r = nearestOpp(p); if (!r.p || r.d > 4.5) { p.carry = { x: p.x + p.fx * 6, y: p.y + p.fy * 6, until: W.t + 0.6, drib: true }; return; }
      const g = pickDrib(p, forced), d2 = r.p;
      const atk = p.dri * 0.34 + p.pace * 0.18 + p.agi0 * 26 + p.bal0 * 14 + (p.active || []).length * 1.5;
      const def = d2.def * 0.4 + d2.pace * 0.16 + d2.dec * 0.12 + d2.bal0 * 16;
      const pOK = cl(0.36 + (atk - def) / 62 - g.cost + (W.t < TM[p.s].counterUntil ? 0.05 : 0) + (p.energy - 70) / 400, 0.1, 0.88);
      W.st[p.s].pc = (W.st[p.s].pc || 0) + 1;
      if (R() < pOK) {
        d2.beat = 0.55 + g.gain * 0.5; rt(p, 0.12 + g.gain * 0.12); rt(d2, -0.08);
        const ux = p.fx, uy = p.fy, side = R() < 0.5 ? 1 : -1;
        p.carry = { x: cl(p.x + ux * 7 - uy * side * 2.5, 1, PW - 1), y: cl(p.y + uy * 7 + ux * side * 2.5, 1, PL - 1), until: W.t + 1.1, drib: true };
        com(p.short + ' : ' + g.lab + ' sur ' + d2.short + ' !');
        mark({ k: 'skill', c: p.code, tier: g.tier });   // §28 à §31 le rendu suit le tier du geste
        if (g.min >= 80) { banner('QUEL GESTE !', p.short, '#2ECC71', 1.2); logE(p.short + ' élimine ' + d2.short + ' d’' + (g.n === 'pont' ? 'un petit pont' : 'une ' + g.lab), '#2ECC71', 'drib', p.s); }
        key(g.min >= 80 ? 30 : 14, p.s, 'drib');
      } else {
        com(g.lab + ' raté de ' + p.short); rt(p, -0.1);
        if (R() < 0.55) { gain(d2, 'tackle'); rt(d2, 0.12); } else { p.carry = null; p.nextDec = W.t + 0.2; }
      }
    };
    // tacle / pressing manuel : variantes selon le profil du défenseur
    const doTackle = (p) => {
      const c = W.owner; if (!c || c.s === p.s) return;
      const d = hy(c.x - p.x, c.y - p.y);
      if (d > 2.6) { p.carry = null; return; }
      const slide = d > 1.5 && p.def > 60 && R() < 0.45;
      const atk = c.dri * 0.32 + c.bal0 * 22 + c.pace * 0.12;
      const def = p.def * 0.38 + p.dec * 0.14 + p.bal0 * 20 + (slide ? 8 : 0) - (c.beat > 0 ? -14 : 0);
      const pOK = cl(0.34 + (def - atk) / 58 + (p.energy - 70) / 420, 0.08, 0.9);
      if (R() < pOK) { W.st[p.s].tk++; gain(p, 'tackle'); rt(p, 0.14); com((slide ? 'Tacle glissé de ' : 'Interception de ') + p.short + ' devant ' + c.short); }
      else if (slide && R() < 0.5) { p.fall = 0.8; foul(p, c, 'tackle'); }
      else { p.beat = 0.5; com(c.short + ' résiste au retour de ' + p.short); }
    };
    const tick = () => {
      if (lastMin < 0) { lastMin = 0; applySkills(); }
      refreshLV();
      if (W.cel > 0 && W.t >= W.cel) { if (!W.celCut) { W.celCut = true; W.cut = true; W.t += DT; return; } W.celCut = false; W.clk += W.celK === 'ballon' ? 22 : W.celK === 'calme' ? 40 : 55; kickoffReset(OT[W.celS]); }
      if (W.htDo) { W.htDo = false; W.half = 2; W.clk = 2700; W.ht = true; TM.H.ps.forEach((p) => { p.energy = Math.min(100, p.energy + 6); }); TM.A.ps.forEach((p) => { p.energy = Math.min(100, p.energy + 6); }); kickoffReset('A'); }
      offA.H = calcOff('H'); offA.A = calcOff('A');
      if (W.set && W.t >= W.set.ready) execSet();
      else if (!W.set && W.cel <= 0) {
        if (W.owner && W.t >= W.owner.ctrlT && (W.t >= W.owner.nextDec || (nearestOpp(W.owner).d < 1.6 && W.t - W.owner.rcvT > 0.25 && W.t >= W.owner.nextDec - 0.2))) decide(W.owner);
        if (W.owner) duels();
      }
      W.tn = (W.tn || 0) + 1; if (W.tn % 2 === 0 || W.dirty || W.set) { W.dirty = false; targets(); }
      move();
      if (!W.set && W.cel <= 0) ballStep();
      else if (W.cel > 0) { const b = W.ball; b.vx = b.vy = 0; }
      else { const b = W.ball; b.x = W.set.x; b.y = W.set.y; b.z = 0; }
      if (W.owner || W.fl) { const ps = W.owner ? W.owner.s : W.fl.from ? W.fl.from.s : W.poss; W.pt[ps] += DT; }
      rec();
      W.t += DT; W.clk += DT;
      if (Math.floor(W.clk / 60) !== lastMin) { lastMin = Math.floor(W.clk / 60); ['H', 'A'].forEach((sd) => { const T = TM[sd]; if (T.boost && W.clk / 60 > T.boost.until) { T.boost = null; setTP(T); } adaptToSituation(T); }); applySkills(); }
      if (Math.floor(W.clk / 60) !== Math.floor((W.clk - DT) / 60)) snap();
      oppSubs();
      // mi-temps / fin
      const calm = !W.fl && W.cel <= 0 && (W.set || !W.owner || aOf(W.owner.s, W.owner.y) < 68);
      if (W.half === 1 && W.clk >= 2700 + W.stop1 && (calm || W.clk >= 2700 + W.stop1 + 40)) {
        logE('Mi-temps : ' + W.score.H + '-' + W.score.A + ' · possession ' + possPct() + '%', '#4FA8E8', 'HT');
        W.cut = true; W.htDo = true; W.owner = null; W.fl = null; W.set = null;
      } else if (W.half === 2 && W.clk >= 5400 + W.stop2 && (calm || W.clk >= 5400 + W.stop2 + 40)) {
        W.ended = true; W.cut = true; banner('FIN DU MATCH', W.score.H + ' - ' + W.score.A, '#F2F4F7', 3);
        const res = W.score.H > W.score.A ? 'H' : W.score.A > W.score.H ? 'A' : null;
        ['H', 'A'].forEach((s) => { TM[s].ps.forEach((p) => { rt(p, res === s ? 0.3 : res ? -0.2 : 0); if (W.score[OT[s]] === 0 && (p.line === 'GB' || p.line === 'DEF')) rt(p, 0.5); }); });
        logE('Coup de sifflet final : ' + W.score.H + '-' + W.score.A, '#4FA8E8', 'FT');
      }
    };
    // ---------- enregistrement ----------
    let pend = null, lastEnd = -99, shown = 0;
    const rec = () => {
      if (W.skip) { curEv = []; return; }
      const P = new Float32Array(44);
      for (let i = 0; i < 11; i++) { const h = TM.H.ps[i], a = TM.A.ps[i]; P[i * 2] = !h || h.red ? -9 : h.x; P[i * 2 + 1] = !h || h.red ? -9 : h.y; P[22 + i * 2] = !a || a.red ? -9 : a.x; P[23 + i * 2] = !a || a.red ? -9 : a.y; }
      const fa = []; all().forEach((p) => { if (p.fall > 0) fa.push(p.code); });
      const f = { t: W.t, m: W.clk, h: W.half, P, b: [W.ball.x, W.ball.y, W.ball.z], o: W.owner ? W.owner.code : -1, to: W.fl && W.fl.to ? W.fl.to.code : -1,
        fl: W.fl ? [W.fl.x0, W.fl.y0, W.fl.x1, W.fl.y1, W.fl.kind] : null, ev: curEv.length ? curEv : null, fa: fa.length ? fa : null, set: W.set ? W.set.kind : null, tk: W.set && W.set.taker ? W.set.taker.code : -1,
        dv: W.dive && W.t - W.dive.t0 < W.dive.dur + 1 ? [W.dive.c, W.dive.dir, Math.min(1, (W.t - W.dive.t0) / Math.max(0.2, W.dive.dur))] : null, sc: [W.score.H, W.score.A] };
      curEv = [];
      ring.push(f); if (ring.length > 300) ring.shift();
      if (pend) pend.frames.push(f);
    };
    const AFTER = { goal: 5, shot: 3, pen: 6, corner: 10, fkd: 8, fkc: 10, card: 3.5, red: 4, foul: 2.5, counter: 8, box: 4.5, drib: 4, cross: 4, through: 4.5, play: 9, ko: 6 };
    const startPend = (k) => {
      let st = Math.max(Math.min(W.possT - 1, k.t - 4.5), k.t - 14);
      st = Math.max(st, lastEnd + 0.01, W.lastTele);
      pend = { frames: ring.filter((f) => f.t >= st - 0.001), score: k.score, kinds: [k.kind], endBy: k.t + (AFTER[k.kind] || 4), forced: !!k.forced };
    };
    const handleKeys = () => {
      for (const k of keys) { if (!pend) startPend(k); else { pend.score = Math.max(pend.score, k.score); pend.endBy = Math.max(pend.endBy, k.t + (AFTER[k.kind] || 4)); pend.kinds.push(k.kind); } }
      keys.length = 0;
    };
    const TOTAL = cfg.showSec || 330;
    const thr = () => { const budget = TOTAL * Math.min(1, (W.half === 1 ? W.clk : W.clk + 60) / 5580); let th = 27 + (shown - budget) * 1.1; if (W.t - lastEnd > 420) th -= 14; return cl(th, 5, 96); };
    const finalize = () => {
      const p = pend; pend = null; if (!p || p.frames.length < 6) return null;
      const must = p.score >= 85 || p.forced; if (!must && p.score < thr()) return null;
      shown += p.frames.length * DT; lastEnd = W.t;
      return { frames: p.frames, score: p.score, kinds: p.kinds, t0: p.frames[0].t, t1: p.frames[p.frames.length - 1].t };
    };
    const player = (c) => (c < 11 ? TM.H.ps[c] : TM.A.ps[c - 11]);
    const api = {
      W, TM, log, hist, player,
      next() {
        if (W.ended && !pend) return null;
        if (!W.started) { W.started = true; kickoffReset('H'); rec(); pend = { frames: [], score: 99, kinds: ['ko'], endBy: W.t + 6, forced: true }; }
        for (let guard = 0; guard < 200000; guard++) {
          if (W.ended) { const c = pend ? finalize() : null; return c; }
          tick(); handleKeys();
          if (W.ht) { W.ht = false; W.cut = false; pend = { frames: ring.slice(-1), score: 99, kinds: ['ko'], endBy: W.t + 5, forced: true }; continue; }
          if (!pend && W.t - lastEnd > 480 && W.owner && !W.set && aOf(W.owner.s, W.owner.y) > 55) pend = { frames: ring.filter((f) => f.t >= Math.max(W.t - 5, lastEnd + 0.01, W.lastTele)), score: 99, kinds: ['play'], endBy: W.t + 9, forced: true };
          if (pend && (W.t >= pend.endBy || W.cut || pend.frames.length > 420)) { W.cut = false; const c = finalize(); if (c) return c; }
          W.cut = false;
        }
        return null;
      },
      finish() { W.skip = true; pend = null; let g = 0; while (!W.ended && g++ < 200000) { tick(); keys.length = 0; } snap(); },
      snapAt(t) { let lo = null; for (let i = hist.length - 1; i >= 0; i--) if (hist[i].t <= t + 1e-6) { lo = hist[i]; break; } return lo || hist[0] || null; },
      state() { snap(); return hist[hist.length - 1]; },
      sub(side, i, d) {
        const T = TM[side], old = T.ps[i]; if (!old) return;
        const np = mkP(side, i, d, { line: old.line, fx: old.bx / 0.68, fy: 100 - old.ba / 1.05 });
        Object.assign(np, { x: old.x, y: old.y, kind: old.kind, lr: old.lr, wide: old.wide, rat: 6, energy: d.energy != null ? d.energy : 100 });
        if (np.fbMode == null) np.fbMode = old.fbMode; T.ps[i] = np;
        if (W.owner === old) W.owner = np; if (W.set && W.set.taker === old) W.set.taker = np;
        if (W.fl) { if (W.fl.to === old) W.fl.to = np; if (W.fl.from === old) W.fl.from = np; }
        TM[OT[side]].ps.forEach((q) => { if (q.markT === old) q.markT = np; });
        T.subs++; W.clk += 20; snap();
      },
      shout(k) { TM.H.shout = k; setTP(TM.H); },
      card(kind) {
        const T = TM.H, min = W.clk / 60;
        const C = { energie: { attr: {}, until: min + 90, fn: () => T.ps.forEach((p) => { p.energy = Math.min(100, p.energy + 15); }) }, motivation: { attr: { dec: 3, sht: 2 }, bonus: 1.5, until: min + 20 }, pressing: { attr: { def: 3, pace: 3 }, until: min + 15, tac: { press: 2, engage: 2 } },
          bloc: { attr: { def: 4, phy: 2 }, until: min + 15, tac: { line: 0, engage: 0, press: 0 } }, contre: { attr: { pace: 4 }, until: min + 15, tac: { won: 0, tempo: 2 } }, finition: { attr: { sht: 5 }, until: min + 15 } }[kind];
        if (!C) return false;
        if (C.fn) C.fn(); T.boost = { attr: C.attr, until: C.until, bonus: C.bonus || 0 }; if (C.tac) { T.tac = Object.assign({}, T.tac, C.tac); } setTP(T); applySkills(); return true;
      },
      phase(side) { return TM[side].phase || 'ATTACK'; },
      step() { if (W.ended) return false; tick(); keys.length = 0; return !W.ended; },
      frame() { return ring[ring.length - 1] || null; },
      intents(side) { return TM[side].ps.map((p) => p.intent || ''); },
      situation() { const T = TM.H; return { min: Math.floor(W.clk / 60), diff: W.score.H - W.score.A, tired: T.ps.map((p, i) => ({ i, e: p.energy, red: p.red, line: p.line })).filter((p) => !p.red && p.e < 45), poss: W.poss, subs: T.subs, phase: T.phase }; },
      setTac(side, tac, ment) { TM[side].tac = Object.assign({}, tac); if (ment != null) TM[side].ment = ment; setTP(TM[side]); },
      clockLabel,
      weather() { return { id: W.wx, label: WX.l }; },
      // §51 séance de tirs au but : 5 tireurs chacun, puis mort subite.
      // Chaque frappe compare le tir et le sang-froid du tireur aux réflexes du gardien,
      // et la pression monte quand la série peut se terminer.
      shootout() {
        const order = (sd) => LV[sd].filter((p) => p.line !== 'GB').sort((a2, b2) => (b2.sht + b2.dec) - (a2.sht + a2.dec));
        const takers = { H: order('H'), A: order('A') }, gk = { H: TM.H.ps[0], A: TM.A.ps[0] };
        const sc = { H: 0, A: 0 }, kicks = [];
        logE('Séance de tirs au but', '#F2E27C', 'pso');
        const shootOne = (sd, i, pressure) => {
          const t = takers[sd][i % takers[sd].length], g = gk[OT[sd]];
          const base = 0.78 + (t.sht - 70) * 0.004 + (t.dec - 70) * 0.002 - ((g.red ? 30 : g.ref) - 70) * 0.004 - pressure * 0.06;
          const ok = R() < cl(base, 0.45, 0.94);
          if (ok) sc[sd]++;
          kicks.push({ s: sd, name: t.name, ok });
          logE((ok ? 'But de ' : 'Tir manqué de ') + t.name + ' · ' + sc.H + '-' + sc.A, ok ? (sd === 'H' ? '#48E08B' : '#FF4757') : '#9AA3B0', 'pso', sd);
          rt(t, ok ? 0.2 : -0.3); if (!ok) rt(g, 0.25);
          return ok;
        };
        for (let i = 0; i < 5; i++) {
          for (const sd of ['H', 'A']) {
            const left = { H: 5 - i, A: 5 - i - (sd === 'A' ? 1 : 0) };
            const gap = sc[sd] - sc[OT[sd]];
            if (gap > left[OT[sd]]) break;                      // série déjà pliée
            if (-gap > left[sd] - 1) break;
            shootOne(sd, i, i >= 3 ? 1 : 0);
          }
          if (Math.abs(sc.H - sc.A) > Math.max(5 - i - 1, 0)) break;
        }
        let i = 5;
        while (sc.H === sc.A && i < 20) { const a2 = shootOne('H', i, 1.4), b2 = shootOne('A', i, 1.4); if (a2 !== b2) break; i++; }
        const win = sc.H > sc.A ? 'H' : 'A';
        logE('Séance remportée par ' + club(win) + ' ' + sc.H + '-' + sc.A, '#F2E27C', 'pso', win);
        banner('TIRS AU BUT', sc.H + ' - ' + sc.A, win === 'H' ? '#2ECC71' : '#FF4757', 3);
        return { H: sc.H, A: sc.A, win, kicks };
      }
    };
    snap();
    return api;
  }

// LinkFoot : Fiches joueurs : statistiques, note globale, profil (âge, nationalité, pied, forme).
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
const Players = {
  statW(pos) {
    return { ATT: { ATQ: 0.28, TIR: 0.2, DRI: 0.16, VIT: 0.16, PAS: 0.1, PHY: 0.08, 'DÉF': 0.02 }, MIL: { PAS: 0.26, DRI: 0.17, 'DÉF': 0.14, ATQ: 0.12, PHY: 0.11, TIR: 0.1, VIT: 0.1 }, DEF: { 'DÉF': 0.38, PHY: 0.22, VIT: 0.15, PAS: 0.12, DRI: 0.05, ATQ: 0.04, TIR: 0.04 }, GB: { 'RÉF': 0.3, PLO: 0.25, MAI: 0.2, PLA: 0.15, 'DÉG': 0.05, VIT: 0.05 } }[pos] || this.statW('MIL');
  },

  ovrOf(pos, st) { const w = this.statW(pos); let a = 0, t = 0; for (const k in w) { a += (st[k] != null ? st[k] : 50) * w[k]; t += w[k]; } return Math.round(a / t); },

  genStats(pos, target, seed) {
    const r = this.seedR(seed);
    const bias = { GB: { VIT: -14, PLO: 4, 'RÉF': 6, MAI: 2, 'DÉG': -6, PLA: 3 }, DEF: { VIT: -2, ATQ: -20, TIR: -16, PAS: -6, DRI: -8, 'DÉF': 8, PHY: 6 }, MIL: { VIT: 0, ATQ: 0, TIR: -2, PAS: 6, DRI: 4, 'DÉF': -6, PHY: -2 }, ATT: { VIT: 6, ATQ: 8, TIR: 6, PAS: -3, DRI: 5, 'DÉF': -28, PHY: -3 } }[pos] || {};
    const st = {}; for (const k in bias) st[k] = target + bias[k] + Math.round((r() - 0.5) * 12);
    for (let i = 0; i < 5; i++) { for (const k in st) st[k] = Math.max(25, Math.min(99, st[k])); const d = target - this.ovrOf(pos, st); if (!d) break; for (const k in st) st[k] += d; }
    for (const k in st) st[k] = Math.max(25, Math.min(99, st[k]));
    return st;
  },

  cardStats(p) {
    const st = p.st || this.genStats(p.pos, p.base != null ? p.base : p.ovr, p.id * 31 + 7);
    const order = p.pos === 'GB' ? ['VIT', 'PLO', 'RÉF', 'MAI', 'DÉG', 'PLA'] : ['VIT', 'ATQ', 'TIR', 'PAS', 'DRI', 'DÉF', 'PHY'];
    return order.map((l) => ({ l, v: st[l] != null ? st[l] : 50 }));
  },

  profile(p) {
    const r = this.seedR((p.id || 1) * 7919 + 13);
    const NAT = ['France', 'France', 'France', 'Sénégal', 'Maroc', 'Algérie', 'Brésil', 'Argentine', 'Espagne', 'Italie', 'Portugal', 'Belgique', 'Côte d’Ivoire', 'Cameroun', 'Nigeria', 'Pays-Bas', 'Allemagne', 'Japon', 'Norvège', 'Pologne'];
    const PERSO = ['Leader', 'Solitaire', 'Travailleur', 'Talent naturel', 'Showman', 'Compétiteur', 'Professionnel', 'Instable', 'Généreux', 'Ambitieux', 'Discret', 'Charismatique'];
    const age = p.age != null ? p.age : 17 + Math.floor(r() * 18);
    const base = p.ovr;
    const pot = p.pot != null ? p.pot : Math.min(96, base + Math.max(0, Math.round((28 - age) * 1.4 + r() * 8)));
    const perso = PERSO[Math.floor(r() * PERSO.length)];
    const foot = r() < 0.72 ? 'Droit' : r() < 0.9 ? 'Gauche' : 'Ambidextre';
    // §25 pied faible, de 1 (inutilisable) a 5 (ambidextre) : la plupart des joueurs sont a 3
    const wq = r(); const wf = foot === 'Ambidextre' ? 5 : wq < 0.18 ? 2 : wq < 0.62 ? 3 : wq < 0.9 ? 4 : 5;
    const h = 165 + Math.floor(r() * 30) + (p.pos === 'GB' ? 10 : p.pos === 'DEF' ? 4 : 0);
    const form = p.form != null ? p.form : 70, morale = p.morale != null ? p.morale : 72;
    const value = this.valueOf(Object.assign({}, p, { age, pot, form }));
    const salary = Math.round(value / 60 / 10) * 10;
    return { age: age + (p.ageAdj || 0), pot, perso, foot, wf, height: h, weight: Math.round(h * 0.42 - 8 + r() * 6), nat: NAT[Math.floor(r() * NAT.length)], value, salary, contract: p.contract != null ? p.contract : 1 + Math.floor(r() * 3), form, morale, fit: p.fit != null ? p.fit : 100, inj: p.inj || 0, skills: this.skillsOf(p), hidden: !p.scouted };
  }
};

// LinkFoot : Compétences procédurales : 20 effets x 14 conditions x 6 raretés x 5 niveaux (§32 à §36).
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
const Skills = {
  SKILL_DEF() {
    if (this._skill) return this._skill;
    const E = [
      ['tueur', 'Tueur', 'Attaque', { sht: 6 }, 'finition sur les grosses occasions'],
      ['visionnaire', 'Visionnaire', 'Passe', { pas: 5, dec: 4 }, 'passes qui créent le danger'],
      ['laser', 'Passe laser', 'Passe', { pas: 7 }, 'précision des passes longues'],
      ['chef', 'Chef d’orchestre', 'Tactique', { dec: 6, pas: 3 }, 'contrôle du rythme'],
      ['renard', 'Renard des surfaces', 'Attaque', { sht: 4, dec: 4 }, 'déplacements dans la surface'],
      ['sprinter', 'Sprinter', 'Physique', { pace: 7 }, 'exploitation des espaces en contre'],
      ['pressing', 'Pressing fou', 'Défense', { def: 4, pace: 3, drain: 1.25 }, 'pressing plus intense, plus fatigant'],
      ['gladiateur', 'Gladiateur', 'Physique', { phy: 7 }, 'duels physiques'],
      ['calme', 'Calme absolu', 'Mental', { dec: 6, pas: 2 }, 'moins d’erreurs sous pression'],
      ['mur', 'Mur', 'Défense', { def: 8 }, 'interventions dans sa surface'],
      ['acier', 'Mental d’acier', 'Mental', { dec: 5, sht: 2 }, 'résiste à la pression des grands moments'],
      ['dribbleur', 'Funambule', 'Dribble', { dri: 7 }, 'dribbles réussis'],
      ['aerien', 'Tour de contrôle', 'Coup de pied arrêté', { phy: 5, def: 3, sht: 2 }, 'jeu de tête'],
      ['moteur', 'Moteur', 'Physique', { drain: 0.8, pace: 2 }, 'endurance, fatigue plus lente'],
      ['leader', 'Leader', 'Leadership', { team: { dec: 2 } }, 'concentration des coéquipiers'],
      ['meneur', 'Meneur', 'Collectif', { team: { pas: 2 } }, 'jeu collectif autour de lui'],
      ['grinta', 'Grinta', 'Mental', { phy: 5, def: 3, pace: 3, team: { phy: 1 } }, 'agressivité et pressing quand l’équipe est menée'],
      ['clutch', 'Clutch', 'Spécial', { sht: 5, dec: 5 }, 'dernières minutes d’un match serré'],
      ['gk_reflex', 'Réflexes félins', 'Gardien', { ref: 7 }, 'parades réflexes'],
      ['gk_mains', 'Mains sûres', 'Gardien', { han: 7 }, 'ballons captés, pas de rebond']
    ];
    const C = [
      ['always', 'en permanence', 1.0], ['trail70', 'quand l’équipe est menée après la 70e', 1.9], ['closeLate', 'dans les 15 dernières minutes d’un match serré', 1.8],
      ['leading', 'quand l’équipe mène', 1.3], ['first15', 'dans le premier quart d’heure', 1.4], ['momentum', 'pendant 6 minutes après une action décisive', 1.7],
      ['tired', 'quand son énergie passe sous 55 %', 1.5], ['home', 'à domicile', 1.25], ['counter', 'en phase de contre', 1.6], ['box', 'dans une surface de réparation', 1.5],
      ['setpiece', 'sur coup de pied arrêté', 1.6], ['pressed', 'quand l’équipe subit le pressing', 1.5], ['derby', 'contre un adversaire mieux classé', 1.4], ['second', 'en seconde période', 1.2]
    ];
    const RAR = [['commune', 'Commune', 0.55, '#9AA3B0'], ['normale', 'Normale', 0.75, '#F2F4F7'], ['rare', 'Rare', 1.0, '#4FA8E8'], ['elite', 'Élite', 1.25, '#C39BFF'], ['mythique', 'Mythique', 1.5, '#FFC24A'], ['legendaire', 'Légendaire', 1.8, '#FF4757']];
    const POSOK = { GB: ['gk_reflex', 'gk_mains', 'calme', 'leader', 'acier', 'moteur'], DEF: ['mur', 'gladiateur', 'aerien', 'leader', 'calme', 'moteur', 'grinta', 'pressing', 'laser', 'sprinter', 'acier'], MIL: ['visionnaire', 'laser', 'chef', 'meneur', 'moteur', 'pressing', 'dribbleur', 'calme', 'grinta', 'clutch', 'gladiateur', 'sprinter'], ATT: ['tueur', 'renard', 'sprinter', 'dribbleur', 'clutch', 'aerien', 'grinta', 'acier', 'gladiateur', 'visionnaire'] };
    return (this._skill = { E, C, RAR, POSOK, LVL: ['I', 'II', 'III', 'IV', 'V'] });
  },

  skillCount() { const D = this.SKILL_DEF(); let n = 0; for (const pos in D.POSOK) n += D.POSOK[pos].length; return n * D.C.length * D.RAR.length * D.LVL.length; },

  makeSkill(eid, cid, rar, lvl, cond) {
    const D = this.SKILL_DEF(), e = D.E.find((x) => x[0] === eid), c = D.C[cid], R2 = D.RAR[rar];
    const mult = R2[2] * (0.7 + lvl * 0.15) * c[2] * 0.55;
    const eff = {}; for (const k in e[3]) eff[k] = k === 'drain' ? e[3][k] : k === 'team' ? Object.fromEntries(Object.entries(e[3][k]).map(([a, v]) => [a, v * mult])) : e[3][k] * mult;
    const name = e[1] + (lvl ? ' ' + D.LVL[lvl] : '') + (c[0] === 'always' ? '' : ' · ' + ['', 'grinta', 'clutch', 'dominant', 'précoce', 'momentum', 'increvable', 'local', 'contre', 'surface', 'CPA', 'sous pression', 'outsider', '2e MT'][cid]);
    return { id: eid + ':' + cid + ':' + rar + ':' + lvl, eid, cid: c[0], name, cat: e[2], rar: R2[0], rarLabel: R2[1], color: R2[3], lvl: lvl + 1, eff, desc: e[4] + (c[0] === 'always' ? '' : ', ' + c[1]) + '.' };
  },

  skillsOf(p) {
    if (p.skills) return p.skills;
    const D = this.SKILL_DEF(), r = this.seedR((p.id || 1) * 104729 + 3), pool = D.POSOK[p.pos] || D.POSOK.MIL;
    const n = p.ovr >= 80 ? 3 : p.ovr >= 68 ? 2 : 1, out = [];
    for (let i = 0; i < n; i++) {
      const q = r(), rar = q < 0.42 ? 0 : q < 0.7 ? 1 : q < 0.87 ? 2 : q < 0.95 ? 3 : q < 0.99 ? 4 : 5;
      out.push(this.makeSkill(pool[Math.floor(r() * pool.length)], Math.floor(r() * D.C.length), Math.min(rar, p.ovr >= 75 ? 5 : 3), Math.min(4, Math.floor(r() * 2 + (p.ovr - 55) / 12)), null));
    }
    return out;
  }
};

// LinkFoot : Cartes : raretés, catalogue de 500, packs, collection, fragments et niveaux (§56 à §65).
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
const Cards = {
  RARITY() {
    return [
      { id: 'normal', label: 'Normal', rate: 0.55, lo: 48, hi: 64, shards: 1, color: 'linear-gradient(135deg, #AEB9C2, #5E6672)', ink: '#171B21' },
      { id: 'common', label: 'Commun', rate: 0.25, lo: 56, hi: 70, shards: 2, color: 'linear-gradient(135deg, #CFE0D4, #8FA89A)', ink: '#171B21' },
      { id: 'rare', label: 'Rare', rate: 0.12, lo: 64, hi: 77, shards: 5, color: 'linear-gradient(135deg, #4FA8E8, #2F8FE0)', ink: '#06101F' },
      { id: 'epic', label: 'Épique', rate: 0.05, lo: 71, hi: 83, shards: 12, color: 'linear-gradient(135deg, #C39BFF, #7B4FD8)', ink: '#120A24' },
      { id: 'elite', label: 'Élite', rate: 0.02, lo: 77, hi: 88, shards: 30, color: 'linear-gradient(135deg, #2ECC71, #1E9E92)', ink: '#04201C' },
      { id: 'gold', label: 'Or', rate: 0.009, lo: 82, hi: 92, shards: 80, color: 'linear-gradient(135deg, #FFE59A, #E9A93A)', ink: '#241703' },
      { id: 'legendary', label: 'Légendaire', rate: 0.001, lo: 86, hi: 95, shards: 200, color: 'linear-gradient(135deg, #FF9F6B, #FF4F7B)', ink: '#2A0812' }
    ];
  },

  rarityOf(id) { return this.RARITY().find((r) => r.id === id) || this.RARITY()[0]; },

  CARD_POOL() {
    if (this._pool) return this._pool;
    const R = this.RARITY(), r = this.seedR(424242);
    const F = ['A.', 'B.', 'C.', 'D.', 'E.', 'F.', 'G.', 'H.', 'I.', 'J.', 'K.', 'L.', 'M.', 'N.', 'O.', 'P.', 'R.', 'S.', 'T.', 'V.', 'Y.', 'Z.'];
    const L = ['Marvello', 'Ducasson', 'Ebongué', 'Halvorsen', 'Quintero', 'Belkadi-Roy', 'Stranieri', 'Okafor-Lemaire', 'Vasquet', 'Nyamsi', 'Gaudrel', 'Petrakis', 'Lindau', 'Moreau-Diaby', 'Castagne-Nil', 'Rivoire', 'Takamura', 'Ferbault', 'Ansaldi', 'Kowalevski', 'Dembrel', 'Soumahé', 'Varnier', 'Okonkwé', 'Delacroix-Sy', 'Ferrandi', 'Braxton', 'Kessler', 'Mbaloula', 'Arroyo-Faye', 'Lindqvist', 'Rouvière', 'Adebanjo', 'Castellane', 'Moulinet', 'Tavares', 'Bellanger', 'Cissoko-Vidal', 'Ngoumou', 'Rakotoson', 'Esperanza', 'Haugen', 'Pirlotti', 'Zemmouri', 'Okonjo', 'Vanthier', 'Bramante', 'Keita-Marsal'];
    const POS = ['GB', 'DEF', 'DEF', 'DEF', 'MIL', 'MIL', 'MIL', 'ATT', 'ATT'];
    const pool = [];
    // la part de chaque rareté dans le catalogue suit les taux, avec au moins une carte par rareté
    const counts = R.map((x) => Math.max(1, Math.round(x.rate * 500)));
    counts[0] += 500 - counts.reduce((a2, v) => a2 + v, 0);   // le catalogue fait exactement 500 cartes
    R.forEach((rar, ri) => {
      for (let k = 0; k < counts[ri]; k++) {
        const id = 50000 + pool.length;
        pool.push({ id, name: F[Math.floor(r() * F.length)] + ' ' + L[Math.floor(r() * L.length)],
          pos: POS[Math.floor(r() * POS.length)], ovr: rar.lo + Math.floor(r() * (rar.hi - rar.lo + 1)), rar: rar.id });
      }
    });
    return (this._pool = pool);
  },

  drawCard(packWeights, rnd) {
    const R = this.RARITY(), w = R.map((x) => x.rate * ((packWeights || {})[x.id] != null ? packWeights[x.id] : 1));
    let t = w.reduce((a, v) => a + v, 0), q = (rnd || Math.random)() * t, pick = R[0];
    for (let i = 0; i < R.length; i++) { q -= w[i]; if (q <= 0) { pick = R[i]; break; } }
    const pool = this.CARD_POOL().filter((c) => c.rar === pick.id);
    return pool[Math.floor((rnd || Math.random)() * pool.length)];
  },

  PACK_DEFS() {
    return [
      { key: 'basic', name: 'Pack Basic', n: 3, cost: 150, w: {}, color: 'linear-gradient(135deg, #AEB9C2, #5E6672)', fx: 'bronze' },
      { key: 'premium', name: 'Pack Premium', n: 4, cost: 400, w: { normal: 0.4, common: 1.2, rare: 2.2, epic: 2.5, elite: 2, gold: 1.6, legendary: 1.4 }, color: 'linear-gradient(135deg, #F2F6F4, #AEB9C2)', fx: 'silver' },
      { key: 'elite', name: 'Pack Élite', n: 3, cost: 900, w: { normal: 0.1, common: 0.5, rare: 2, epic: 4, elite: 5, gold: 3, legendary: 2.5 }, color: 'linear-gradient(135deg, #2ECC71, #1E9E92)', fx: 'silver' },
      { key: 'gold', name: 'Pack Or', n: 3, cost: 2000, w: { normal: 0, common: 0.2, rare: 1.2, epic: 4, elite: 8, gold: 9, legendary: 6 }, color: 'linear-gradient(135deg, #FFE59A, #E9A93A)', fx: 'gold' },
      { key: 'special', name: 'Pack Spécial', n: 2, cost: 1200, w: { normal: 0, common: 0, rare: 2, epic: 5, elite: 6, gold: 5, legendary: 4 }, color: 'linear-gradient(135deg, #FF9F6B, #FF4F7B)', fx: 'gold' }
    ];
  },

  packOdds(def) {
    const R = this.RARITY(), w = R.map((x) => x.rate * ((def.w || {})[x.id] != null ? def.w[x.id] : 1));
    const t = w.reduce((a, v) => a + v, 0) || 1;
    return R.map((x, i) => ({ id: x.id, label: x.label, color: x.color, pct: (w[i] / t * 100) }));
  },

  collection() {
    const owned = new Set((this.state.squad || []).concat(this.state.collected || []).map((p) => p.id != null ? p.id : p));
    const pool = this.CARD_POOL();
    const have = pool.filter((c) => owned.has(c.id)).length;
    return { have, total: pool.length };
  },

  UPGRADE_COST() { return [0, 25, 60, 140, 320]; },

  cardLevel(p) { return p.lvl || 1; },

  upgradeInfo(p) {
    const lvl = this.cardLevel(p), max = lvl >= 5;
    const cost = max ? 0 : this.UPGRADE_COST()[lvl];
    return { lvl, max, cost, can: !max && (this.state.shards || 0) >= cost };
  },

  levelUpPlayer(id) {
    const s = this.state, p = s.squad.find((x) => x.id === id);
    if (!p) return { ok: false, why: 'Joueur introuvable' };
    const info = this.upgradeInfo(p);
    if (info.max) return { ok: false, why: 'Niveau maximum' };
    if (!info.can) return { ok: false, why: 'Il te manque ' + (info.cost - (s.shards || 0)) + ' fragments' };
    const st = {}; this.cardStats(p).forEach((q) => { st[q.l] = q.v; });
    const w = this.statW(p.pos), keys = Object.keys(w).sort((a, b) => w[b] - w[a]).slice(0, 2);
    keys.forEach((k) => { if (st[k] != null && st[k] < 99) st[k] += 2; });
    const ovr = Math.max(p.ovr, this.ovrOf(p.pos, st));
    this.buzz([30, 30, 60]);
    this.setState({ shards: (s.shards || 0) - info.cost,
      squad: s.squad.map((x) => (x.id === id ? Object.assign({}, x, { st, ovr, lvl: info.lvl + 1 }) : x)),
      trainLog: p.name + ' passe niveau ' + (info.lvl + 1) + ' · ' + keys.map((k) => '+2 ' + k).join(', ') });
    return { ok: true, lvl: info.lvl + 1 };
  },

  MATCH_CARDS() {
    return [
      { id: 'energie', label: 'Boost énergie', desc: '+15 % d’énergie pour tout le XI', icon: 'M13 2 3 14h7l-1 8 10-12h-7z' },
      { id: 'motivation', label: 'Motivation', desc: 'Décision et finition +, 20 minutes', icon: 'M12 2 15 8l7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z' },
      { id: 'pressing', label: 'Pressing', desc: 'Pressing haut et intense, 15 minutes', icon: 'M4 12h16M12 4l8 8-8 8' },
      { id: 'bloc', label: 'Bloc défensif', desc: 'Bloc bas, défense renforcée, 15 minutes', icon: 'M12 2 20 5v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5z' },
      { id: 'contre', label: 'Contre-attaque', desc: 'Vitesse et transitions rapides, 15 minutes', icon: 'M3 17 9 11l4 4 8-8M14 7h7v7' },
      { id: 'finition', label: 'Boost finition', desc: 'Tir +5, 15 minutes', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' }
    ];
  },

  UPGRADE_CARDS() { return [['VIT', 'Vitesse'], ['ATQ', 'Attaque'], ['TIR', 'Tir'], ['PAS', 'Passe'], ['DRI', 'Dribble'], ['DÉF', 'Défense'], ['PHY', 'Physique']]; },

  useUpgrade(pid, stat) {
    const s = this.state, key = 'up_' + stat, inv = Object.assign({}, s.inv || {}); if (!(inv[key] > 0)) return;
    const p = s.squad.find((q) => q.id === pid); if (!p) return;
    const st = {}; this.cardStats(p).forEach((q) => { st[q.l] = q.v; }); if (st[stat] == null || st[stat] >= 99) return;
    st[stat] = Math.min(99, st[stat] + 2); inv[key]--; this.buzz(30);
    this.setState({ inv, squad: s.squad.map((q) => (q.id === pid ? Object.assign({}, q, { st, ovr: Math.max(q.ovr, this.ovrOf(q.pos, st)) }) : q)) });
  }
};

// LinkFoot : Staff, stade, centre de formation, synergies et finances.
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
const Staff = {
  STAFF_DEFS() {
    return [
      { id: 'adjoint', label: 'Entraîneur adjoint', cost: [400, 900, 1800], wage: [0, 12, 26, 48], eff: ['Aucun', 'Bonus tactique +0,8 en match', 'Bonus tactique +1,6 en match', 'Bonus tactique +2,4 en match'] },
      { id: 'physique', label: 'Préparateur physique', cost: [350, 800, 1600], wage: [0, 10, 22, 42], eff: ['Aucun', 'Récupération +5, blessures −18 %', 'Récupération +10, blessures −36 %', 'Récupération +15, blessures −54 %'] },
      { id: 'recruteur', label: 'Recruteur', cost: [300, 750, 1500], wage: [0, 9, 20, 38], eff: ['Aucun', 'Marché +2 de note', 'Marché +4 de note, stats révélées', 'Marché +6 de note, stats révélées'] },
      { id: 'kine', label: 'Kinésithérapeute', cost: [320, 760, 1500], wage: [0, 9, 20, 38], eff: ['Aucun', 'Blessures −20 %', 'Blessures −40 %', 'Blessures −60 %'] }
    ];
  },

  staffLv(id) { const st = this.state.staff || {}; return st[id] || 0; },

  staffWages() { return this.STAFF_DEFS().reduce((a, d) => a + d.wage[this.staffLv(d.id)], 0); },

  hireStaff(id) {
    const s = this.state, d = this.STAFF_DEFS().find((x) => x.id === id), lv = this.staffLv(id);
    if (!d || lv >= 3) return; const cost = d.cost[lv]; if (s.balance < cost) return;
    this.buzz([25, 25, 50]);
    this.setState({ balance: s.balance - cost, staff: Object.assign({}, s.staff, { [id]: lv + 1 }), staffLog: d.label + ' niveau ' + (lv + 1) + ' recruté' });
  },

  STADES() {
    return [
      { name: 'Terrain municipal', cap: 800, mult: 1, cost: 0 },
      { name: 'Stade de quartier', cap: 2500, mult: 1.3, cost: 900 },
      { name: 'Enceinte couverte', cap: 8000, mult: 1.7, cost: 2200 },
      { name: 'Stade de division', cap: 20000, mult: 2.2, cost: 4800 },
      { name: 'Grand stade LinkFoot', cap: 45000, mult: 3, cost: 9500 }
    ];
  },

  upgradeStade() {
    const s = this.state, L = this.STADES(), lv = s.stade || 0; if (lv >= L.length - 1) return;
    const cost = L[lv + 1].cost; if (s.balance < cost) return;
    this.buzz([25, 25, 60]); this.setState({ balance: s.balance - cost, stade: lv + 1, staffLog: L[lv + 1].name + ' construit' });
  },

  ACADEMIES() {
    return [
      { name: 'Aucun centre', note: 'Pas de jeune formé', cost: 0, lo: 0, hi: 0, potLo: 0, potHi: 0 },
      { name: 'École de foot', note: '1 jeune par saison · note 48 à 56 · potentiel 68 à 78', cost: 700, lo: 48, hi: 56, potLo: 68, potHi: 78 },
      { name: 'Centre de formation', note: '1 jeune par saison · note 54 à 62 · potentiel 74 à 85', cost: 2000, lo: 54, hi: 62, potLo: 74, potHi: 85 },
      { name: 'Académie d’élite', note: '1 jeune par saison · note 58 à 66 · potentiel 80 à 92', cost: 5000, lo: 58, hi: 66, potLo: 80, potHi: 92 }
    ];
  },

  upgradeAcademy() {
    const s = this.state, A = this.ACADEMIES(), lv = s.academy || 0; if (lv >= A.length - 1) return;
    const cost = A[lv + 1].cost; if (s.balance < cost) return;
    this.buzz([25, 25, 60]); this.setState({ balance: s.balance - cost, academy: lv + 1, staffLog: A[lv + 1].name + ' ouvert' });
  },

  youthPlayer(st) {
    const A = this.ACADEMIES()[st.academy || 0]; if (!A.lo) return null;
    const r = this.seedR(st.division * 311 + st.seasonP * 97 + (st.youth || []).length * 13 + 7);
    const F = ['A.', 'B.', 'C.', 'E.', 'I.', 'K.', 'L.', 'M.', 'N.', 'R.', 'S.', 'T.', 'Y.'];
    const L = ['Baptiste', 'Covelli', 'Diarra-Noel', 'Ewane', 'Fontenay', 'Greco', 'Hadji-Lenoir', 'Istvan', 'Jourdain', 'Keita-Marsal', 'Lombardi', 'Novak', 'Oyelaran', 'Prunier', 'Sagnol-Diaz', 'Terrasse', 'Vukovic'];
    const POS = ['GB', 'DEF', 'DEF', 'MIL', 'MIL', 'MIL', 'ATT', 'ATT'];
    const bonus = st.coach === 'formateur' ? 3 : 0;
    const ovr = A.lo + Math.floor(r() * (A.hi - A.lo + 1)) + bonus;
    const pot = Math.max(ovr + 6, A.potLo + Math.floor(r() * (A.potHi - A.potLo + 1)) + bonus);
    return { id: 30000 + (st.division * 100) + Math.floor(r() * 900), name: F[Math.floor(r() * F.length)] + ' ' + L[Math.floor(r() * L.length)], pos: POS[Math.floor(r() * POS.length)], ovr, pot, age: 16 + Math.floor(r() * 4), youth: true, fresh: true, scouted: true };
  },

  synergy(xi) {
    const nat = {}, labels = [];
    xi.forEach((p) => { const n = this.profile(p).nat || '—'; nat[n] = (nat[n] || 0) + 1; });
    let sc = 0;
    Object.keys(nat).sort((a, b) => nat[b] - nat[a]).forEach((n) => { if (nat[n] >= 3) { sc += (nat[n] - 2) * 0.03; labels.push(n + ' ×' + nat[n]); } });
    const fit = xi.filter((p) => !p.pen).length; sc += (fit - 9) * 0.014;
    const form = xi.length ? xi.reduce((a, p) => a + this.profile(p).form, 0) / xi.length : 70;
    sc += (form - 70) * 0.0035;
    return { score: Math.max(-0.18, Math.min(0.3, sc)), labels };
  },

  finances(st, res) {
    const base = [0, 700, 520, 380, 260, 180][st.division] + (res === 'w' ? 60 : 0);
    const gate = Math.round(base * this.STADES()[st.stade || 0].mult);
    const wages = Math.round(st.squad.reduce((a, p) => a + this.profile(p).salary, 0) / 10 * (st.coach === 'gestionnaire' ? 0.85 : 1)) + this.staffWages();
    return { gate, wages, net: gate - wages };
  }
};

// LinkFoot : Entraînement, forme, énergie et blessures (§68, §69).
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
const Training = {
  TRAININGS() {
    return [
      { id: 'repos', label: 'Repos', desc: 'Énergie +25, soigne les blessés plus vite', fit: 25, form: -2, gain: null, risk: 0 },
      { id: 'physique', label: 'Physique', desc: 'VIT et PHY progressent, énergie −10', fit: -10, form: 3, gain: ['VIT', 'PHY'], risk: 0.06 },
      { id: 'technique', label: 'Technique', desc: 'PAS et DRI progressent', fit: -6, form: 4, gain: ['PAS', 'DRI'], risk: 0.03 },
      { id: 'tir', label: 'Finition', desc: 'ATQ et TIR progressent', fit: -6, form: 4, gain: ['ATQ', 'TIR'], risk: 0.03 },
      { id: 'defense', label: 'Défense', desc: 'DÉF et PHY progressent', fit: -8, form: 3, gain: ['DÉF', 'PHY'], risk: 0.04 },
      { id: 'collectif', label: 'Collectif', desc: 'Cohésion +, forme +', fit: -5, form: 6, gain: null, risk: 0.02, coh: 0.04 }
    ];
  },

  train(id) {
    const s = this.state, T = this.TRAININGS().find((t) => t.id === id); if (!T || s.match && !s.match.done) return;
    let squad = this.applyFitness(s.squad, null, T), lines = [];
    if (T.gain) squad = squad.map((p) => {
      if (p.pos === 'GB' || p.inj || this.rand(0, 99) > 45 + (p.pot - p.ovr) * 4 * (s.coach === 'formateur' ? 2 : 1)) return p;
      const st = {}; this.cardStats(p).forEach((q) => { st[q.l] = q.v; }); const k = T.gain[this.rand(0, T.gain.length - 1)];
      if (st[k] >= 99 || p.ovr >= p.pot) return p; st[k]++; const ovr = Math.max(p.ovr, this.ovrOf(p.pos, st)); lines.push(p.name.split(' ').slice(1).join(' ') + ' +1 ' + k);
      return Object.assign({}, p, { st, ovr });
    });
    const hurt = [];
    if (T.risk) squad = squad.map((p) => { if (!p.inj && this.rand(0, 999) / 1000 < T.risk) { hurt.push(p.name); return Object.assign({}, p, { inj: 1 + this.rand(0, 2) }); } return p; });
    this.buzz(20);
    this.setState({ squad, cohBonus: Math.min(0.12, (s.cohBonus || 0) + (T.coh || 0)), trainLog: 'Séance ' + T.label + (lines.length ? ' · ' + lines.slice(0, 3).join(', ') : '') + (hurt.length ? ' · blessé : ' + hurt.join(', ') : ''), trainDone: (s.trainDone || 0) + 1 });
  },

  applyFitness(squad, mt, training) {
    const played = new Set(mt ? mt.xi.map((p) => p.id) : []);
    return squad.map((p) => {
      const pr = this.profile(p); let fit = pr.fit, inj = pr.inj, form = pr.form, morale = pr.morale;
      if (mt) {
        const xp = mt.xi.find((q) => q.id === p.id);
        if (xp) {
          const rat = mt.rat && mt.rat.H[mt.xi.indexOf(xp)] || 6;
          fit = Math.min(100, Math.max(20, Math.round((xp.energy != null ? xp.energy * 0.45 + 52 : fit - 10) + this.staffLv('physique') * 5)));   // une semaine de récupération entre deux matchs
          form = Math.round(Math.max(20, Math.min(99, form * 0.75 + (rat - 6) * 12 + 18)));
          morale = Math.round(Math.max(20, Math.min(99, morale + (mt.res === 'w' ? 6 : mt.res === 'd' ? 1 : -5) + (rat >= 7.5 ? 4 : 0))));
          const risk = (0.012 + Math.max(0, 60 - (xp.energy != null ? xp.energy : 70)) / 600 + (pr.age >= 31 ? 0.01 : 0)) * (xp.red ? 0 : 1) * (1 - this.staffLv('physique') * 0.18);
          if (!inj && this.rand(0, 999) / 1000 < risk) { const base = 1 + this.rand(0, 3) + (this.rand(0, 9) === 0 ? 3 : 0); inj = Math.max(1, Math.round(base * (1 - this.staffLv('kine') * 0.2))); }
        } else { fit = Math.min(100, fit + 30 + this.staffLv('physique') * 5); morale = Math.max(20, morale - (played.size ? 2 : 0)); if (inj) inj -= 1 + (this.staffLv('kine') >= 2 && this.rand(0, 1) ? 1 : 0); if (inj < 0) inj = 0; }
      }
      if (training) { const T = training; fit = Math.max(15, Math.min(100, fit + T.fit)); form = Math.max(20, Math.min(99, form + T.form)); if (inj && T.id === 'repos') inj = Math.max(0, inj - 1); }
      return Object.assign({}, p, { age: pr.age, pot: pr.pot, fit, inj, form, morale, contract: pr.contract, skills: pr.skills });
    });
  }
};

// LinkFoot : Marché des transferts : valeur, offres, vente (§71).
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
const Transfer = {
  valueOf(p) {
    const age = p.age != null ? p.age : this.profile(p).age, pot = p.pot != null ? p.pot : p.ovr;
    const ageK = age <= 21 ? 1.35 : age <= 25 ? 1.2 : age <= 29 ? 1 : age <= 32 ? 0.7 : 0.45;
    const formK = 0.85 + ((p.form != null ? p.form : 70) - 50) / 200;
    return Math.round(Math.pow(Math.max(40, p.ovr) / 10, 3.2) * ageK * formK * (1 + Math.max(0, pot - p.ovr) / 40) / 3) * 10;
  },

  marketList() {
    const s = this.state; if (s.market && s.market.week === s.seasonP + s.division * 10) return s.market.list;
    const POS = ['GB', 'DEF', 'DEF', 'MIL', 'MIL', 'ATT'], r = this.seedR(s.division * 977 + s.seasonP * 31 + 5);
    const list = []; const F = ['A.', 'B.', 'C.', 'D.', 'E.', 'G.', 'H.', 'I.', 'J.', 'K.', 'L.', 'M.', 'N.', 'O.', 'R.', 'S.', 'T.', 'V.', 'Y.', 'Z.'];
    const L = ['Marvello', 'Ducasson', 'Ebongué', 'Halvorsen', 'Quintero', 'Belkadi-Roy', 'Stranieri', 'Okafor-Lemaire', 'Vasquet', 'Nyamsi', 'Gaudrel', 'Petrakis', 'Lindau', 'Moreau-Diaby', 'Castagne-Nil', 'Rivoire', 'Takamura', 'Ferbault', 'Ansaldi', 'Kowalevski', 'Dembrel', 'Soumahé'];
    for (let i = 0; i < 6; i++) {
      const ovr = 55 + Math.floor(r() * 12) + (5 - s.division) * 3 + this.staffLv('recruteur') * 2, id = 20000 + s.division * 1000 + s.seasonP * 100 + i;
      const p = { id, name: F[Math.floor(r() * F.length)] + ' ' + L[Math.floor(r() * L.length)], pos: POS[Math.floor(r() * POS.length)], ovr };
      list.push(Object.assign(p, { scouted: this.staffLv('recruteur') >= 2, price: this.valueOf(Object.assign({}, p, this.profile(p))) }));
    }
    return list;
  },

  sellPlayer(id) {
    const s = this.state;
    if (s.match && !s.match.done) return { ok: false, why: 'Impossible pendant un match' };
    if (s.squad.length <= 12) return { ok: false, why: 'Il te faut au moins 12 joueurs' };
    const p = s.squad.find((x) => x.id === id);
    if (!p) return { ok: false, why: 'Joueur introuvable' };
    const price = Math.round(this.profile(p).value * 0.6);
    this.buzz(25);
    this.setState({ squad: s.squad.filter((x) => x.id !== id), balance: s.balance + price, sel: null,
      trainLog: p.name + ' vendu pour ' + price + ' jetons' });
    return { ok: true, price };
  }
};

// LinkFoot : Progression du club : niveaux, missions, suites de match, saison, vieillissement (§70, §72).
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
const Progression = {
  levelNeed(l) { return 300 + l * 100; },

  addXp(st, gain) {
    let xp = st.xp + gain, level = st.level, bal = 0, queue = st.freeQueue.slice(), ups = [];
    while (xp >= this.levelNeed(level)) { xp -= this.levelNeed(level); level++; const pack = level % 5 === 0; bal += 100 + level * 20; if (pack) queue.push('or'); ups.push({ level, text: '+' + (100 + level * 20) + ' jetons' + (pack ? ' + Pack Or offert' : '') }); }
    return { xp, level, bonusBal: bal, freeQueue: queue, ups };
  },

  bumpMission(ms, id, n) { return ms.map((m) => (m.id === id && !m.claimed ? Object.assign({}, m, { prog: Math.min(m.goal, m.prog + n) }) : m)); },

  afterMatch(mt, st) {
    const res = mt.res, win = res === 'w';
    const winStreak = win ? st.winStreak + 1 : 0;
    const mult = winStreak >= 5 ? 2 : winStreak >= 3 ? 1.5 : winStreak >= 2 ? 1.2 : 1;
    const bonus = Math.round(mt.reward * (mult - 1));
    const xpGain = (win ? 100 : res === 'd' ? 50 : 25) + mt.hs * 10 + (mt.as === 0 ? 20 : 0);
    let missions = this.bumpMission(st.missions, 'play', 1);
    if (win) missions = this.bumpMission(missions, 'win', 1);
    if (mt.hs) missions = this.bumpMission(missions, 'goals', mt.hs);
    let squad = st.squad, prog = '';
    if (win || mt.hs >= 2) {
      const c = mt.xi.filter((p) => p.line !== 'GB'); let pk = c[this.rand(0, c.length - 1)]; if (mt.rat) { let bi = 0; mt.rat.H.forEach((v, k) => { if (v > mt.rat.H[bi]) bi = k; }); if (mt.xi[bi]) pk = mt.xi[bi]; }
      const cur = squad.find((p) => p.id === pk.id);
      if (cur && cur.ovr < 99) {
        const st = {}; this.cardStats(cur).forEach((q) => { st[q.l] = q.v; }); const w = this.statW(cur.pos), keys = Object.keys(w).sort((a2, b2) => w[b2] - w[a2]), gains = {};
        let ovr = this.ovrOf(cur.pos, st), guard = 0;
        while (ovr <= cur.ovr && guard++ < 20) { const k = keys[this.rand(0, 2)]; if (st[k] < 99) { st[k]++; gains[k] = (gains[k] || 0) + 1; } ovr = this.ovrOf(cur.pos, st); }
        squad = squad.map((p) => (p.id === pk.id ? Object.assign({}, p, { st, ovr: Math.max(ovr, cur.ovr) }) : p));
        prog = cur.name + ' progresse ' + cur.ovr + ' → ' + Math.max(ovr, cur.ovr) + ' (' + Object.keys(gains).map((k) => '+' + gains[k] + ' ' + k).join(', ') + ')';
      }
    }
    squad = this.applyFitness(squad, mt, null);
    const F = this.finances(st, res); const inv = Object.assign({}, st.inv || {}); if (win) { const drop = ['energie', 'motivation', 'pressing', 'bloc', 'contre', 'finition', 'up_VIT', 'up_TIR', 'up_PAS', 'up_DÉF'][this.rand(0, 9)]; inv[drop] = (inv[drop] || 0) + 1; }
    const L = this.addXp(st, xpGain);
    const patch = { winStreak, missions, squad, inv, lastFin: 'Recette ' + F.gate + ' · salaires −' + F.wages + ' · net ' + (F.net >= 0 ? '+' : '') + F.net + ' jetons', coachAdvice: null, xp: L.xp, level: L.level, freeQueue: L.freeQueue, balance: st.balance + bonus + L.bonusBal + this.finances(st, res).net,
      lastGain: '+' + xpGain + ' XP' + (bonus ? ' · série de ' + winStreak + ' victoires x' + mult + ' (+' + bonus + ' jetons)' : '') + (prog ? ' · ' + prog : '') };
    let over = L.ups.length ? { title: 'NIVEAU ' + L.level + ' !', sub: L.ups.map((u) => 'Niveau ' + u.level + ' : ' + u.text).join(' · ') } : null;
    const seasonP = st.seasonP + 1;
    if (seasonP >= 5) {
      const tbl = this.table(st.record), rank = tbl.findIndex((c) => c.me) + 1, last = tbl.length;
      // le centre de formation sort un jeune à chaque fin de saison
      patch.squad = this.ageSquad(patch.squad || st.squad);   // §70 une saison de plus pour tout le monde
      const yg = this.youthPlayer(st);
      let ygTxt = '';
      if (yg) { patch.squad = (patch.squad || st.squad).concat([yg]); patch.youth = (st.youth || []).concat([yg.id]); ygTxt = ' Le centre sort ' + yg.name + ' (' + yg.pos + ' ' + yg.ovr + ', potentiel ' + yg.pot + ').'; }
      if (rank <= 2 && st.division > 1) { patch.division = st.division - 1; patch.balance += 500; patch.freeQueue = patch.freeQueue.concat(['or']); over = { title: 'PROMU EN DIVISION ' + patch.division + ' !', sub: 'Fin de saison : ' + rank + 'e. +500 jetons et un Pack Or. Les adversaires seront plus forts.' + ygTxt }; }
      else if (rank === last && st.division < 5) { patch.division = st.division + 1; over = { title: 'RELÉGUÉ EN DIVISION ' + patch.division, sub: 'Fin de saison : ' + rank + 'e sur ' + last + '. Les adversaires seront plus faibles, mais la recette du match baisse.' + ygTxt }; }
      else over = over || { title: 'FIN DE SAISON', sub: rank + 'e de la division ' + st.division + '. Termine dans les 2 premiers pour monter, évite la dernière place.' + ygTxt };
      patch.seasonP = 0; patch.record = { w: 0, d: 0, l: 0 };
    } else patch.seasonP = seasonP;
    if (over) { patch.levelUp = over; this.buzz([60, 40, 60, 40, 200]); }
    return patch;
  },

  ageSquad(squad) {
    return squad.map((p) => {
      const q = Object.assign({}, p, { ageAdj: (p.ageAdj || 0) + 1 });
      const pr = this.profile(q);
      if (q.pos === 'GB') return q;
      const st = {}; this.cardStats(q).forEach((x) => { st[x.l] = x.v; });
      if (pr.age >= 31 && this.rand(0, 99) < (pr.age - 29) * 22) {
        const k = ['VIT', 'PHY', 'DRI'][this.rand(0, 2)];
        if (st[k] != null && st[k] > 30) { st[k] -= 1 + (pr.age >= 34 ? 1 : 0); return Object.assign(q, { st, ovr: Math.max(40, this.ovrOf(q.pos, st)) }); }
      } else if (pr.age <= 23 && q.pot && q.ovr < q.pot && this.rand(0, 99) < 55) {
        const k = ['VIT', 'ATQ', 'TIR', 'PAS', 'DRI', 'DÉF', 'PHY'][this.rand(0, 6)];
        if (st[k] != null && st[k] < 99) { st[k] += 1; return Object.assign(q, { st, ovr: Math.min(q.pot, Math.max(q.ovr, this.ovrOf(q.pos, st))) }); }
      }
      return q;
    });
  },

  table(rec) {
    const others = [
      { user: '@Massilia13', club: 'Olympique Vieux-Port', w: 3, d: 1, l: 0 }, { user: '@Lina_psg', club: 'Auteuil United', w: 2, d: 1, l: 1 },
      { user: '@Yohan_foot', club: 'Sporting Yoyo', w: 2, d: 0, l: 2 }, { user: '@KopBleu', club: 'Kop Bleu FC', w: 1, d: 1, l: 2 }, { user: '@Nina_foot', club: 'Real Canal FC', w: 0, d: 2, l: 2 }
    ];
    return others.concat([{ user: 'Toi', club: 'FC TonPseudo', w: rec.w, d: rec.d, l: rec.l, me: true }])
      .map((c) => Object.assign({}, c, { pts: c.w * 3 + c.d, p: c.w + c.d + c.l })).sort((a, b) => b.pts - a.pts || b.w - a.w);
  }
};

// LinkFoot : Tactiques, formations, rôles, composition et passerelle vers le moteur (§40 à §43).
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
const Tactics = {
  styles() {
    if (this._styles) return this._styles;
    const D = { width: 1, tempo: 1, pass: 1, behind: 0, cross: 1, dribble: 0, longshot: 0, patience: 0, line: 1, engage: 1, press: 1, trap: 0, tackle: 1, lost: 1, won: 1, gk: 0, mark: 0, fullbacks: 1, overload: 0, ptrap: 0, timewaste: 0 };
    const S = (k, fam, name, form, m, tac, desc, ref, beats, weak, threat) => ({ k, fam, name, form, m, tac: Object.assign({}, D, tac), desc, ref, beats, weak, threat });
    const list = [
      S('equilibre', 'Équilibre', 'Équilibré', '4-3-3', 3, {}, 'Aucun excès : un peu de tout, idéal pour découvrir l’adversaire.', 'La base de toutes les équipes', [], [], 'mid'),
      S('tiki', 'Possession', 'Tiki-taka', '4-3-3', 4, { tempo: 0, pass: 0, cross: 0, patience: 1, line: 2, engage: 2, press: 2, trap: 1, lost: 0 }, 'Passes courtes à l’infini, 65 % de possession, on fatigue l’adversaire avec le ballon.', 'Popularisé par le Barça de la fin des années 2000', ['direct', 'kick', 'blocmed'], ['contre', 'gegen', 'bus'], 'keep'),
      S('posit', 'Possession', 'Jeu de position', '4-3-3', 4, { tempo: 1, pass: 0, patience: 1, width: 2, line: 2, engage: 2, press: 2, lost: 0, fullbacks: 2 }, 'Chaque joueur occupe une zone précise pour créer des supériorités numériques entre les lignes.', 'La méthode Guardiola', ['blocbas', 'blocmed', 'homme'], ['gegen', 'contre'], 'keep'),
      S('relation', 'Possession', 'Jeu relationnel', '4-2-3-1', 4, { tempo: 1, pass: 0, dribble: 1, patience: 1, width: 0, overload: 2, line: 1, lost: 0 }, 'Les joueurs se rapprochent du ballon et combinent en petits triangles, sans positions fixes.', 'Style de Fluminense, très brésilien', ['homme', 'blocmed'], ['gegen', 'blocbas'], 'keep'),
      S('total', 'Possession', 'Football total', '4-3-3', 5, { tempo: 2, pass: 1, behind: 1, dribble: 1, line: 2, engage: 2, press: 2, trap: 1, lost: 0, fullbacks: 1 }, 'Tout le monde attaque, tout le monde défend, permutations permanentes. Très fatigant.', 'L’Ajax et les Pays-Bas des années 70', ['blocmed', 'catenaccio', 'bus'], ['contre', 'direct'], 'keep'),
      S('gegen', 'Pressing', 'Gegenpressing', '4-3-3', 4, { tempo: 2, behind: 1, line: 2, engage: 2, press: 2, trap: 1, lost: 0, won: 0, ptrap: 2 }, 'Dès la perte du ballon, on presse à 5 pour le récupérer en moins de 8 secondes.', 'La signature de Klopp', ['tiki', 'posit', 'relation'], ['direct', 'kick'], 'press'),
      S('blochaut', 'Pressing', 'Bloc haut', '4-4-2', 4, { line: 2, engage: 2, press: 2, trap: 1, lost: 0, ptrap: 1 }, 'Ligne défensive très haute et piège du hors-jeu : l’adversaire étouffe dans son camp.', 'Utilisé par la plupart des grosses équipes', ['tiki', 'relation', 'bus'], ['contre', 'vertical', 'direct'], 'press'),
      S('homme', 'Pressing', 'Pressing homme à homme', '3-5-2', 4, { line: 2, engage: 2, press: 2, tackle: 2, mark: 2, lost: 0 }, 'Chaque joueur suit son adversaire direct partout sur le terrain. Duels, duels, duels.', 'Bielsa et Gasperini', ['posit', 'tiki', 'pistons'], ['relation', 'surcharge', 'vertical'], 'press'),
      S('blocmed', 'Défensif', 'Bloc médian', '4-4-2', 2, { width: 0, line: 1, engage: 1, press: 1, lost: 1, won: 0, ptrap: 2 }, 'On attend au milieu de terrain, on ferme l’axe et on presse seulement dans les zones pièges.', 'Très utilisé en sélection nationale', ['contre', 'direct', 'kick', 'vertical'], ['posit', 'total', 'surcharge'], 'mid'),
      S('blocbas', 'Défensif', 'Bloc bas', '4-4-2', 1, { width: 0, pass: 2, longshot: 1, line: 0, engage: 0, press: 0, tackle: 2, lost: 1, gk: 1, fullbacks: 0 }, 'Deux lignes de 4 collées devant la surface : aucun espace dans le dos, on attend l’erreur.', 'L’arme des outsiders', ['contre', 'vertical', 'kick', 'relation'], ['posit', 'ailes', 'pistons'], 'low'),
      S('catenaccio', 'Défensif', 'Catenaccio', '5-3-2', 1, { width: 0, pass: 2, behind: 1, line: 0, engage: 0, press: 1, tackle: 2, mark: 2, gk: 1, fullbacks: 0 }, 'Un libéro derrière la défense, marquage individuel strict et contres éclairs.', 'Le verrou italien des années 60', ['tiki', 'gegen', 'vertical'], ['ailes', 'total', 'surcharge'], 'low'),
      S('bus', 'Défensif', 'Garer le bus', '5-3-2', 0, { width: 0, tempo: 0, pass: 2, line: 0, engage: 0, press: 0, tackle: 2, gk: 1, fullbacks: 0, timewaste: 1 }, 'Les 11 joueurs derrière le ballon, on défend le score coûte que coûte.', 'Le plan anti-favori', ['tiki', 'posit'], ['ailes', 'total', 'blochaut', 'pistons'], 'low'),
      S('contre', 'Transition', 'Contre-attaque', '4-4-2', 2, { tempo: 2, pass: 2, behind: 1, dribble: 1, line: 0, engage: 0, won: 0, gk: 1 }, 'On récupère bas et on se projette en 3 passes dans le dos d’une défense montée.', 'Le classique des équipes rapides', ['tiki', 'posit', 'blochaut', 'total', 'ailes'], ['blocbas', 'blocmed'], 'space'),
      S('vertical', 'Transition', 'Transitions verticales', '4-2-3-1', 3, { tempo: 2, pass: 2, behind: 1, line: 1, engage: 1, press: 1, won: 0 }, 'Dès la récupération, le ballon va vers l’avant : peu de passes, beaucoup de vitesse.', 'Leicester champion en 2016', ['blochaut', 'homme', 'gegen'], ['blocbas', 'blocmed', 'catenaccio'], 'space'),
      S('direct', 'Direct', 'Jeu direct', '4-4-2', 4, { width: 2, tempo: 2, pass: 2, behind: 1, cross: 2, longshot: 1, tackle: 2, gk: 1 }, 'Longs ballons vers un grand attaquant, on gagne les deuxièmes ballons.', 'Le foot anglais traditionnel', ['gegen', 'blochaut', 'total'], ['blocmed', 'tiki', 'posit'], 'space'),
      S('kick', 'Direct', 'Kick and rush', '4-4-2', 5, { width: 2, tempo: 2, pass: 2, behind: 1, cross: 2, longshot: 1, engage: 2, press: 2, tackle: 2, gk: 1 }, 'On balance devant et on court : intensité maximale, peu de construction.', 'Le football d’avant, 100 % engagement', ['gegen', 'homme'], ['blocbas', 'blocmed', 'tiki'], 'space'),
      S('ailes', 'Couloirs', 'Jeu sur les ailes', '4-4-2', 4, { width: 2, cross: 2, dribble: 1, fullbacks: 1 }, 'Débordements et centres : on étire le bloc adverse sur toute la largeur.', 'Idéal avec des ailiers rapides', ['blocbas', 'bus', 'catenaccio'], ['contre', 'blocmed'], 'wide'),
      S('surcharge', 'Couloirs', 'Surcharge et renversement', '4-3-3', 4, { width: 2, pass: 1, patience: 1, overload: 1, fullbacks: 2 }, 'On attire l’adversaire d’un côté à 5 contre 3, puis on renverse vers un ailier seul de l’autre côté.', 'Très utilisé dans le foot moderne', ['homme', 'blocmed', 'catenaccio'], ['gegen', 'contre'], 'wide'),
      S('pistons', 'Couloirs', 'Pistons en 3-5-2', '3-5-2', 4, { width: 2, cross: 1, behind: 1, fullbacks: 1, line: 1 }, 'Trois défenseurs centraux et deux pistons qui font tout le couloir : largeur et solidité.', 'Système favori de nombreux entraîneurs italiens', ['blocbas', 'bus', 'kick'], ['contre', 'homme'], 'wide')
    ];
    this._styles = {};
    list.forEach((x) => { this._styles[x.k] = x; });
    this._styleList = list;
    return this._styles;
  },

  matchup(a, b) {
    const S = this.styles(), A = S[a], B = S[b];
    if (!A || !B) return 0;
    let v = (A.beats.includes(b) ? 1 : 0) - (A.weak.includes(b) ? 1 : 0) + (B.weak.includes(a) ? 1 : 0) - (B.beats.includes(a) ? 1 : 0);
    return Math.max(-2, Math.min(2, v));
  },

  formCoords(f) {
    return {
      '4-3-3': { GB: [[50, 88]], DEF: [[14, 68], [38, 73], [62, 73], [86, 68]], MIL: [[26, 49], [50, 54], [74, 49]], ATT: [[20, 24], [50, 17], [80, 24]] },
      '4-4-2': { GB: [[50, 88]], DEF: [[14, 68], [38, 73], [62, 73], [86, 68]], MIL: [[12, 46], [37, 51], [63, 51], [88, 46]], ATT: [[36, 20], [64, 20]] },
      '4-2-3-1': { GB: [[50, 88]], DEF: [[14, 68], [38, 73], [62, 73], [86, 68]], MIL: [[36, 56], [64, 56], [16, 34], [50, 36], [84, 34]], ATT: [[50, 15]] },
      '3-5-2': { GB: [[50, 88]], DEF: [[25, 72], [50, 75], [75, 72]], MIL: [[9, 46], [30, 52], [50, 42], [70, 52], [91, 46]], ATT: [[36, 19], [64, 19]] },
      '5-3-2': { GB: [[50, 88]], DEF: [[8, 64], [29, 72], [50, 75], [71, 72], [92, 64]], MIL: [[26, 48], [50, 52], [74, 48]], ATT: [[36, 20], [64, 20]] }
    }[f];
  },

  penalty(pos, line) {
    if (pos === line) return 0;
    if (pos === 'GB' || line === 'GB') return 30;
    const o = { DEF: 0, MIL: 1, ATT: 2 };
    return Math.abs(o[pos] - o[line]) === 1 ? 6 : 13;
  },

  pickXI(formation, lineup) {
    const s = this.state; lineup = lineup || s.lineup || {};
    const need = { '4-3-3': [1, 4, 3, 3], '4-4-2': [1, 4, 4, 2], '4-2-3-1': [1, 4, 5, 1], '3-5-2': [1, 3, 5, 2], '5-3-2': [1, 5, 3, 2] }[formation];
    const slots = [];
    ['GB', 'DEF', 'MIL', 'ATT'].forEach((pos, k) => { for (let i = 0; i < need[k]; i++) slots.push({ line: pos, slot: pos + i }); });
    const byId = {}; s.squad.forEach((p) => { byId[p.id] = p; });
    const pool = s.squad.filter((p) => !p.inj).slice().sort((a, b) => b.ovr - a.ovr);
    const used = new Set(), asg = {};
    slots.forEach((sl) => { const id = lineup[sl.slot]; if (id != null && byId[id] && !used.has(id)) { asg[sl.slot] = byId[id]; used.add(id); } });
    slots.forEach((sl) => {
      if (asg[sl.slot]) return;
      const p = pool.find((q) => !used.has(q.id) && q.pos === sl.line) || pool.find((q) => !used.has(q.id) && q.pos !== 'GB') || pool.find((q) => !used.has(q.id));
      if (p) { asg[sl.slot] = p; used.add(p.id); }
    });
    return slots.filter((sl) => asg[sl.slot]).map((sl) => {
      const p = asg[sl.slot], pen = this.penalty(p.pos, sl.line);
      return Object.assign({}, p, { line: sl.line, slot: sl.slot, base: p.ovr, pen, ovr: Math.max(30, p.ovr - pen) });
    });
  },

  benchOf(xi) { const ids = new Set(xi.map((p) => p.id)); return this.state.squad.filter((p) => !ids.has(p.id) && !p.inj).sort((a, b) => b.ovr - a.ovr).slice(0, 7); },

  ROLE_OPTS(line, slot, formation) {
    if (line === 'GB') return ['Gardien classique', 'Gardien libéro'];
    if (line === 'DEF') {
      const n = { '4-3-3': 4, '4-4-2': 4, '4-2-3-1': 4, '3-5-2': 3, '5-3-2': 5 }[formation];
      const i = Number(slot.slice(3));
      const wide = n >= 4 && (i === 0 || i === n - 1);
      return wide ? ['Latéral', 'Latéral offensif', 'Piston', 'Latéral inversé'] : ['Défenseur central', 'Défenseur relanceur', 'Stoppeur', 'Libéro'];
    }
    if (line === 'MIL') return ['Milieu central', 'Récupérateur', 'Meneur reculé', 'Box-to-box', 'Mezzala', 'Meneur avancé', 'Ailier'];
    return ['Avant-centre', 'Renard des surfaces', 'Faux 9', 'Pivot', 'Ailier inversé', 'Attaquant de pointe'];
  },

  metrics(xi) {
    const s = this.state, t = s.tac, m = s.mentality - 3;
    const ovr = xi.reduce((a, p) => a + p.ovr, 0) / xi.length;
    let atk = 0, def = 0, ctrl = 0, press = 0, fat = 0;
    atk += m * 1.3; def -= m * 1.0;
    atk += (t.width - 1) * 0.6; ctrl -= (t.width - 1) * 0.3;
    atk += (t.tempo - 1) * 0.8; ctrl -= (t.tempo - 1) * 1.2; fat += (t.tempo - 1) * 1.5;
    ctrl -= (t.pass - 1) * 1.5; atk += (t.pass - 1) * 0.3;
    if (t.behind) atk += 0.7;
    if (t.dribble) { atk += 0.5; ctrl -= 0.3; }
    if (t.longshot) atk += 0.3;
    if (t.patience) { ctrl += 1.5; atk -= 0.4; }
    def += (1 - t.line) * 1.0; press += (t.line - 1) * 0.8;
    press += (t.engage - 1) * 1.0; fat += (t.engage - 1) * 0.8;
    press += (t.press - 1) * 1.6; fat += (t.press - 1) * 2; def += (t.press - 1) * 0.4;
    if (t.trap) def += 0.4;
    def += (t.tackle - 1) * 0.3;
    if (t.lost === 0) { press += 1; fat += 0.8; } else def += 0.6;
    if (t.won === 0) atk += 0.6; else ctrl += 0.8;
    if (t.gk === 0) ctrl += 0.6; else atk += 0.2;
    if (t.mark === 0) def += 0.3; if (t.mark === 2) { press += 0.8; def -= 0.2; fat += 0.4; }
    if (t.fullbacks === 0) { def += 0.5; atk -= 0.3; } if (t.fullbacks === 1) { atk += 0.4; def -= 0.3; } if (t.fullbacks === 2) ctrl += 0.8;
    if (t.overload === 1 || t.overload === 3) { atk += 0.4; ctrl += 0.2; } if (t.overload === 2) ctrl += 0.5;
    if (t.ptrap === 1) press += 0.6; if (t.ptrap === 2) { press += 0.4; def += 0.2; }
    xi.forEach((p) => {
      const r = s.roles[p.slot], d = s.duties[p.slot] || 'Soutien';
      if (d === 'Attaque') { atk += 0.35; def -= 0.25; }
      if (d === 'Défense') { def += 0.35; atk -= 0.25; }
      if (r === 'Meneur reculé' || r === 'Défenseur relanceur' || r === 'Faux 9') ctrl += 0.5;
      if (r === 'Box-to-box' || r === 'Piston') { atk += 0.3; fat += 0.4; }
      if (r === 'Récupérateur' || r === 'Stoppeur') def += 0.4;
      if (r === 'Renard des surfaces' || r === 'Attaquant de pointe') atk += 0.4;
      if (r === 'Gardien libéro') ctrl += 0.3;
    });
    return { ovr, atk, def, ctrl, press, fat: Math.max(0, fat) };
  },

  baseShape(formation, side) {
    const C = this.formCoords(formation), out = [];
    ['GB', 'DEF', 'MIL', 'ATT'].forEach((l) => (C[l] || []).forEach(([x, y]) => {
      const hy = 50 + (y - 50) * 0.82 + 3;
      out.push(side === 'H' ? { x, y: hy, line: l } : { x: 100 - x, y: 100 - hy, line: l });
    }));
    return out;
  },

  engineCfg(opp, xi, oxi, obench) {
    const s = this.state, S = this.styles(), st = S[opp.style] || S.equilibre;
    const coordsFrom = (form) => { const C = this.formCoords(form), out = []; ['GB', 'DEF', 'MIL', 'ATT'].forEach((l) => (C[l] || []).forEach(([fx, fy]) => out.push({ fx, fy, line: l }))); return out; };
    const statsOf = (p) => { const o = {}; this.cardStats(p).forEach((q) => { o[q.l] = Math.max(25, q.v - Math.round((p.pen || 0) * 0.6)); }); return o; };
    const adv = s.preset === 'perso' ? 0 : this.matchup(s.preset, opp.style);
    const syn = this.synergy(xi);
    const coh = Math.min(1.2, Math.max(0.7, 1 - xi.filter((p) => p.pen).length * 0.06 - (s.preset === 'perso' ? 0.04 : 0) - xi.filter((p) => p.fresh).length * 0.03 + (s.cohBonus || 0) + syn.score));
    const H = { club: 'FC TonPseudo', sbonus: this.staffLv('adjoint') * 0.8, coach: this.COACHES().find((c) => c.id === (s.coach || 'tacticien')), coh, tac: s.tac, ment: s.mentality, adv, coords: coordsFrom(s.formation), home: true, players: xi.map((p) => ({ name: p.name, ovr: p.ovr, st: statsOf(p), energy: p.energy, form: p.form != null ? p.form : 70, morale: p.morale != null ? p.morale : 72, skills: this.skillsOf(p), foot: this.profile(p).foot, wf: this.profile(p).wf, role: s.roles[p.slot] || this.ROLE_OPTS(p.line, p.slot, s.formation)[0], duty: s.duties[p.slot] || 'Soutien' })) };
    const A = { club: opp.club, tac: st.tac, ment: st.m, adv: -adv, coords: coordsFrom(st.form), players: oxi.map((p) => ({ name: p.name, ovr: p.ovr, st: statsOf(p), skills: this.skillsOf(p), foot: this.profile(p).foot, wf: this.profile(p).wf })), bench: (obench || []).map((p) => ({ name: p.name, ovr: p.ovr, st: statsOf(p) })) };
    return { sides: { H, A } };
  }
};

// LinkFoot : état du club et règles du manager. Aucune dépendance au DOM ni à React.
// Le même code que l'interface utilise, sorti de la page pour tourner dans une app ou sur un serveur.










class Club {
  constructor(state) {
    this.state = Object.assign({}, INITIAL_STATE(), state || {});
    this._listeners = [];
  }
  // --- compatibilité avec le code de l'interface : setState fusionne, buzz et later ne font rien ici
  setState(patch) {
    Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch);
    this._listeners.forEach((fn) => fn(this.state));
    return this.state;
  }
  onChange(fn) { this._listeners.push(fn); return () => { this._listeners = this._listeners.filter((f) => f !== fn); }; }
  buzz() {}
  later(fn) { return setTimeout(fn, 0); }
  makeEngine(cfg) { return makeEngine(cfg); }

  // --- un match complet, sans interface : construit le moteur, le déroule, applique les suites
  playMatch(opp, opts) {
    const s = this.state, o = opts || {};
    const xi = this.pickXI(s.formation).map((p) => Object.assign({}, p, { energy: p.fit != null ? p.fit : 100, yc: 0, red: false }));
    const styles = this.styles(), oppForm = (styles[opp.style] || {}).form || '4-4-2';
    const shapeA = this.baseShape(oppForm, 'A'), rnd = this.seedR(o.seed != null ? o.seed : Date.now() % 100000);
    const oxi = shapeA.map((b, i) => ({ id: 9000 + i, name: 'J' + i, pos: b.line, line: b.line, ovr: Math.round(opp.ovr + (rnd() - 0.5) * 8), energy: 100, yc: 0, red: false }));
    const obench = ['MIL', 'ATT', 'DEF'].map((pos, i) => ({ id: 9500 + i, name: 'B' + i, pos, ovr: Math.round(opp.ovr - 2) }));
    const E = makeEngine(Object.assign(this.engineCfg(opp, xi, oxi, obench), { rnd }));
    E.finish();
    const f = E.state();
    const hs = f.score.H, as = f.score.A;
    const res = hs > as ? 'w' : hs === as ? 'd' : 'l', reward = res === 'w' ? 120 : res === 'd' ? 50 : 20;
    const mt = { opp, oxi, bench: this.benchOf(xi), hs, as, st: f.st, rat: f.rat, res, reward, done: true, ended: true,
      log: E.log.map((l) => ({ m: l.m, text: l.text, k: l.k, s: l.s })),
      xi: f.en ? xi.map((p, i) => Object.assign({}, p, { energy: f.en[i], yc: f.cards[i][0], red: f.cards[i][1] })) : xi };
    const record = Object.assign({}, s.record, { [res]: s.record[res] + 1 });
    const base = Object.assign({}, this.state, { balance: s.balance + reward, record });
    const patch = this.afterMatch(mt, base);
    this.setState(Object.assign({ record }, patch));
    return { score: [hs, as], res, reward, stats: f.st, log: mt.log, patch };
  }
  rand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  seedR(seed) { let x = (seed * 2654435761) % 4294967296; return () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; }; }

  COACHES() {
    return [
      { id: 'tacticien', label: 'Tacticien', tactique: 88, motivation: 62, gestion: 74, dev: 66, desc: 'Bonus tactique en match, adaptation fine au score' },
      { id: 'motivateur', label: 'Motivateur', tactique: 64, motivation: 90, gestion: 80, dev: 62, desc: 'Moral et forme remontent plus vite, meilleure fin de match' },
      { id: 'defensif', label: 'Défensif', tactique: 80, motivation: 66, gestion: 72, dev: 64, desc: 'Bloc plus solide, moins de buts encaissés' },
      { id: 'offensif', label: 'Offensif', tactique: 78, motivation: 74, gestion: 66, dev: 66, desc: 'Plus d’occasions créées, défense plus exposée' },
      { id: 'formateur', label: 'Formateur', tactique: 66, motivation: 70, gestion: 70, dev: 92, desc: 'Les jeunes progressent deux fois plus vite à l’entraînement' },
      { id: 'gestionnaire', label: 'Gestionnaire', tactique: 70, motivation: 72, gestion: 92, dev: 72, desc: 'Moins de blessures, salaires mieux négociés' }
    ];
  }

  // ================= CARTES : RARETÉS, CATALOGUE, PACKS (§56 à §65) =================
  // Les taux sont centralisés ici. Changer une valeur change le jeu partout.

  // Catalogue fixe de 500 cartes : des identifiants stables, donc des doublons réels et une collection qui a du sens.

  // Tirage d'une carte selon la table de raretés d'un pack (poids multiplicatifs).

  // Probabilités réelles d'un pack, affichées au joueur (§58).

  // §71 vendre un joueur : 75 % de sa valeur, interdit si l'effectif tombe sous 12

  // §70 une saison de plus : tout le monde prend un an, les anciens déclinent, les jeunes progressent

  // §60 à §63 niveaux de carte : les fragments issus des doublons servent à faire monter une carte.
   // index = niveau visé moins 1

}

// §80 : chaque domaine vit dans son fichier et vient se mélanger ici.
Object.assign(Club.prototype, Players, Skills, Cards, Staff, Training, Transfer, Progression, Tactics);

// LinkFoot : sauvegarde. Sérialise l'état du club, le relit, et le range
// où tu veux : mémoire, navigateur, ou ton serveur.

const SAVE_VERSION = 2;

// Ce qui est conservé d'une session à l'autre. Tout le reste (vue courante, match en cours,
// animation de pack, horodatages d'affichage) est volatil et recalculé au chargement.
const PERSIST = [
  'formation', 'balance', 'preset', 'mentality', 'tac', 'roles', 'duties', 'lineup',
  'squad', 'nextId', 'record', 'kit', 'xp', 'level', 'dayStreak', 'dayClaimed',
  'winStreak', 'freePackAt', 'freeQueue', 'division', 'seasonP', 'missions',
  'staff', 'stade', 'academy', 'youth', 'inv', 'coach', 'coachMode', 'cohBonus', 'trainDone'
];

function serialize(club) {
  const s = club.state || club, out = {};
  PERSIST.forEach((k) => { if (s[k] !== undefined) out[k] = s[k]; });
  return { v: SAVE_VERSION, at: new Date().toISOString(), state: out };
}

// Les sauvegardes d'une version antérieure sont remontées une étape à la fois.
const MIGRATIONS = {
  // v1 : avant le staff, le stade et le centre de formation
  1: (st) => Object.assign({}, st, {
    staff: st.staff || { adjoint: 0, physique: 0, recruteur: 0, kine: 0 },
    stade: st.stade || 0, academy: st.academy || 0, youth: st.youth || []
  })
};

function deserialize(data) {
  if (!data || typeof data !== 'object') return null;
  if (!data.state) return null;
  let v = data.v || 1, st = data.state;
  while (v < SAVE_VERSION) { const m = MIGRATIONS[v]; if (m) st = m(st); v++; }
  return st;
}

// ---------- stockages ----------

// Mémoire : utile pour les tests et pour un serveur qui garde l'état en RAM.
class MemoryStore {
  constructor() { this.data = null; }
  async load() { return this.data; }
  async save(payload) { this.data = payload; }
  async clear() { this.data = null; }
}

// Navigateur. Tout est protégé : en navigation privée ou si le stockage est bloqué,
// load renvoie null et save échoue sans casser le jeu.
class LocalStore {
  constructor(key) { this.key = key || 'linkfoot.save'; }
  async load() {
    try { const raw = localStorage.getItem(this.key); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  async save(payload) {
    try { localStorage.setItem(this.key, JSON.stringify(payload)); return true; }
    catch (e) { return false; }
  }
  async clear() { try { localStorage.removeItem(this.key); } catch (e) {} }
}

// Ton serveur. Attend GET qui renvoie le payload (ou 404), PUT qui l'enregistre,
// DELETE qui l'efface. Passe tes en-têtes d'authentification dans headers.
class HttpStore {
  constructor(opts) {
    const o = opts || {};
    this.url = o.url;
    this.headers = Object.assign({ 'Content-Type': 'application/json' }, o.headers || {});
    this.fetch = o.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    if (!this.url) throw new Error('HttpStore : url manquante');
    if (!this.fetch) throw new Error('HttpStore : aucune implémentation de fetch disponible');
  }
  async load() {
    const r = await this.fetch(this.url, { method: 'GET', headers: this.headers });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('HttpStore load ' + r.status);
    return r.json();
  }
  async save(payload) {
    const r = await this.fetch(this.url, { method: 'PUT', headers: this.headers, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error('HttpStore save ' + r.status);
    return true;
  }
  async clear() { await this.fetch(this.url, { method: 'DELETE', headers: this.headers }); }
}

// ---------- gestionnaire ----------
// Relie un Club à un stockage : charge au démarrage, enregistre après chaque changement,
// avec un délai pour ne pas écrire à chaque image.
class SaveManager {
  constructor(club, store, opts) {
    const o = opts || {};
    this.club = club; this.store = store;
    this.delay = o.delay != null ? o.delay : 800;
    this.onError = o.onError || (() => {});
    this._t = null; this._off = null; this.lastSavedAt = null;
  }
  async load() {
    try {
      const raw = await this.store.load();
      const st = deserialize(raw);
      if (st) this.club.setState(st);
      return !!st;
    } catch (e) { this.onError(e); return false; }
  }
  async save() {
    try { await this.store.save(serialize(this.club)); this.lastSavedAt = Date.now(); return true; }
    catch (e) { this.onError(e); return false; }
  }
  start() {
    if (this._off) return this;
    this._off = this.club.onChange(() => {
      clearTimeout(this._t);
      this._t = setTimeout(() => this.save(), this.delay);
    });
    return this;
  }
  stop() { clearTimeout(this._t); if (this._off) { this._off(); this._off = null; } return this; }
}

// LinkFoot : classements et calendriers (§72, §75).
// Pure logique, aucune dépendance : le même code sert pour une division solo,
// une ligue entre amis ou un classement national.

const POINTS = { win: 3, draw: 1, loss: 0 };

// Une ligne de classement vierge.
function emptyRow(id, name) {
  return { id, name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
}

// Applique un résultat aux deux lignes concernées. Les lignes sont créées si besoin.
function applyResult(rows, homeId, awayId, hs, as) {
  const get = (id) => {
    let r = rows.find((x) => x.id === id);
    if (!r) { r = emptyRow(id, String(id)); rows.push(r); }
    return r;
  };
  const H = get(homeId), A = get(awayId);
  H.p++; A.p++; H.gf += hs; H.ga += as; A.gf += as; A.ga += hs;
  if (hs > as) { H.w++; A.l++; H.pts += POINTS.win; A.pts += POINTS.loss; }
  else if (hs < as) { A.w++; H.l++; A.pts += POINTS.win; H.pts += POINTS.loss; }
  else { H.d++; A.d++; H.pts += POINTS.draw; A.pts += POINTS.draw; }
  return rows;
}

// Tri officiel : points, puis différence de buts, puis buts marqués, puis victoires, puis nom.
function standings(rows) {
  return rows.slice()
    .map((r) => Object.assign({}, r, { gd: r.gf - r.ga }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.w - a.w || String(a.name).localeCompare(String(b.name)))
    .map((r, i) => Object.assign(r, { rank: i + 1 }));
}

// Calendrier toutes rondes (méthode du cercle). `rounds` = 1 pour aller simple, 2 pour aller-retour.
function schedule(teamIds, rounds) {
  const t = teamIds.slice();
  if (t.length % 2) t.push(null);                 // exempt
  const n = t.length, half = n / 2, out = [];
  let arr = t.slice();
  for (let r = 0; r < (n - 1) * (rounds || 1); r++) {
    const day = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a == null || b == null) continue;
      day.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
    }
    out.push(day);
    arr = [arr[0]].concat([arr[n - 1]], arr.slice(1, n - 1));   // rotation
  }
  return out;
}

// Promotion et relégation d'une division (§72).
function movements(table, opts) {
  const o = opts || {};
  const up = o.up != null ? o.up : 2, down = o.down != null ? o.down : 1;
  return {
    promoted: table.slice(0, up).map((r) => r.id),
    relegated: down ? table.slice(table.length - down).map((r) => r.id) : []
  };
}

// LinkFoot : tournois (§73, §74, §76).
// 8, 16, 32 ou 64 participants, élimination directe ou groupes puis élimination.
// L'architecture des récompenses en argent existe, mais les paiements sont désactivés :
// rien dans ce fichier ne déclenche de transaction.

const SIZES = [8, 16, 32, 64];

// §76 architecture des récompenses. `cash` est décrit mais jamais versé ici.
// Tant que `payouts.enabled` est false, seules les récompenses en jetons sont distribuées.
const PAYOUTS = {
  enabled: false,
  reason: 'Paiements désactivés tant que le cadre juridique, l’âge, la géolocalisation et les règles des plateformes ne sont pas validés.',
  currency: 'EUR'
};

function prizePool(size, entryTokens) {
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
function createTournament(opts) {
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
function pendingMatches(T) {
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
function reportResult(T, ref, hs, as, pso) {
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
function finalRanking(T) {
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
function rewards(T) {
  const rank = finalRanking(T), P = T.prizes.tokens, out = [];
  rank.forEach((r) => {
    const tier = r.rank === 1 ? 1 : r.rank === 2 ? 2 : r.rank <= 4 ? 4 : r.rank <= 8 ? 8 : null;
    if (tier && P[tier]) out.push({ team: r.team, rank: r.rank, tokens: P[tier] });
  });
  return { tokens: out, cash: PAYOUTS.enabled ? null : { paid: false, reason: PAYOUTS.reason } };
}

root.LinkFoot = { makeEngine, Club, INITIAL_STATE, serialize, deserialize, SAVE_VERSION, MemoryStore, LocalStore, HttpStore, SaveManager,
  standings, schedule, applyResult, emptyRow, movements, createTournament, pendingMatches, reportResult, finalRanking, rewards, PAYOUTS };
})(typeof window !== 'undefined' ? window : globalThis);
