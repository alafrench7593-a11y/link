/* LinkFoot 2026-10-02 : moteur de match + manager, sans dépendance. */
(function (root) {
'use strict';
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
      p.vmax = 6.10 + (p.pace - 40) * 0.045;
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
      // le pressing très intense va chercher le ballon plus haut que la ligne d'engagement réglée
      T.engageA = [36, 56, 80][t.engage] + m * 2 + (sh === 'exiger' ? 6 : 0) - (sh === 'resserrer' ? 8 : 0) + (t.press >= 3 ? 14 : 0);
      // §5 du cahier du match : quatre niveaux de pressing, le quatrième (« très intense »)
      // sort trois joueurs au pressing et va chercher le ballon plus loin, au prix du souffle
      T.pressR = [5, 9, 14, 17][t.press] + (sh === 'exiger' ? 3 : 0);
      T.pressN = t.press >= 3 ? 3 : t.press === 2 ? 2 : 1;
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
      // §6 une mentalité choisie par le manager pendant le match est appliquée telle quelle :
      // l'équipe ne la corrige plus d'elle-même selon le score
      if (T.mentManuelle) { T.phase = phaseOf(T); return; }
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
    // ---------- §23 : TRAITS, le pont entre une compétence et ce qu'on voit sur le terrain ----------
    // Une compétence équipée ne se contente pas de monter un chiffre : elle ouvre des
    // variantes de gestes et change la prise de décision. Chaque trait vaut de 0 à ~1,2,
    // proportionnellement à la puissance des compétences actives qui l'alimentent.
    // Les gestes rares restent CONTEXTUELS : le trait ouvre la porte, il ne la force pas.
    const TRAIT_OF = {
      dribbleur: 'drib', sprinter: 'sprint', moteur: 'sprint',
      laser: 'pass', visionnaire: 'pass', chef: 'pass', meneur: 'pass',
      tueur: 'shot', renard: 'shot', clutch: 'shot', acier: 'shot',
      mur: 'tackle', gladiateur: 'tackle', pressing: 'press', grinta: 'press',
      aerien: 'aerial', gk_reflex: 'gk', gk_mains: 'hands', calme: 'calm', leader: 'lead',
      perforateur: 'run', eclair: 'trans'
    };
    // Lecture d'un trait, sûre même avant la première minute.
    const TR = (p, k) => ((p && p.tr && p.tr[k]) || 0);
    const traitsOf = (p) => {
      const tr = {};
      (p.active || []).forEach((k) => {
        const t = TRAIT_OF[k.eid];
        if (!t) return;
        // la puissance de la compétence décide de l'ampleur : une Legendary ouvre tout,
        // une Normal entrouvre à peine.
        tr[t] = Math.min(1.2, (tr[t] || 0) + Math.max(0.08, (k.power != null ? k.power : 20) / 100));
      });
      return tr;
    };
    const applySkills = () => {
      ['H', 'A'].forEach((s) => {
        const team = Object.assign({}, TM[s].boost && TM[s].boost.attr || {});
        TM[s].ps.forEach((p) => { if (p.red) return; const c = skillCtx(p); p.active = p.skills.filter((k) => c[k.cid]); p.active.forEach((k) => { if (k.eff.team) for (const a in k.eff.team) team[a] = (team[a] || 0) + k.eff.team[a]; }); });
        TM[s].ps.forEach((p) => {
          if (!p.base) return; p.drain = 1; const add = Object.assign({}, team);
          p.active.forEach((k) => { for (const a in k.eff) { if (a === 'drain') p.drain *= k.eff[a]; else if (a !== 'team') add[a] = (add[a] || 0) + k.eff[a]; } });
          for (const a in p.base) p[a] = Math.round(Math.max(20, Math.min(99, p.base[a] + (add[a] || 0))));
          p.tr = traitsOf(p);                       // §23 recalculé chaque minute, avec les conditions
          p.vmax = 6.10 + (p.pace - 40) * 0.045;
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
    // Les listes de joueurs en vie. Elles étaient reconstruites à chaque pas de calcul,
    // soit trois tableaux neufs 54 000 fois par match pour un contenu qui ne change
    // qu'à un carton rouge ou à un changement. Le ramasse-miettes en passait sept pour
    // cent du temps. On ne reconstruit plus que quand la composition bouge vraiment :
    // le contenu est identique, donc le match l'est aussi, au chiffre près.
    let lvSale = true;
    const salirLV = () => { lvSale = true; };
    const refreshLV = () => {
      if (!lvSale) return;
      lvSale = false;
      LV = { H: TM.H.ps.filter((p) => !p.red), A: TM.A.ps.filter((p) => !p.red) }; ALL = LV.H.concat(LV.A);
    };
    const club = (s) => TM[s].club;
    // Le plus proche : on compare les distances AU CARRÉ et on ne prend la racine
    // qu'une fois, à la fin. La racine carrée est croissante, donc le plus proche au
    // carré est le plus proche tout court, et IEEE 754 l'arrondit exactement : le
    // nombre renvoyé est le même bit pour bit. Vingt-et-une racines économisées par
    // appel, et il y en a des millions dans un match.
    const nearestOf = (s, x, y, excl) => {
      let b = null, bd = 1e18;
      for (const q of LV[s]) {
        if (q === excl) continue;
        const dx = q.x - x, dy = q.y - y, d2 = dx * dx + dy * dy;
        if (d2 < bd) { bd = d2; b = q; }
      }
      return { p: b, d: b ? Math.sqrt(bd) : 1e9 };
    };
    const nearestOpp = (p) => nearestOf(OT[p.s], p.x, p.y);
    const rt = (p, d) => { if (p) p.rat = cl(p.rat + d, 3, 10); };
    const clockLabel = (c, h) => { const m = Math.floor(c / 60), hh = h || W.half; if (hh === 1 && m >= 45) return "45+" + (m - 44) + "'"; if (hh === 2 && m >= 90) return "90+" + (m - 89) + "'"; return Math.max(1, m + 1) + "'"; };
    const mark = (e) => curEv.push(e);
    const com = (text) => { W.com = text; W.comT = W.t; mark({ k: 'com', text }); };
    const banner = (text, sub, color, dur) => mark({ k: 'banner', text, sub: sub || '', color: color || '#F2F4F7', dur: dur || 1.6 });
    const possPct = () => { const tot = W.pt.H + W.pt.A; return tot ? Math.round(W.pt.H / tot * 100) : 50; };
    const snap = () => hist.push({ t: W.t, m: W.clk, score: { H: W.score.H, A: W.score.A }, st: { H: Object.assign({}, W.st.H), A: Object.assign({}, W.st.A) }, rat: { H: TM.H.ps.map((p) => p.rat), A: TM.A.ps.map((p) => p.rat) }, en: TM.H.ps.map((p) => p.energy), cards: TM.H.ps.map((p) => [p.yc, p.red]), poss: possPct() });
    // `plus` : ce que le texte dit en toutes lettres, en champs. Un but porte son buteur et
    // son passeur : les lire dans la phrase en manquait un sur quatre (« centre de », « lancé par »…).
    const logE = (text, color, k, s, plus) => { log.push(Object.assign({ t: W.t, text: clockLabel(W.clk) + ' ' + text, color, k, s, m: Math.min(90, Math.floor(W.clk / 60)) }, plus || {})); snap(); };
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
        // Compteurs de récupération : comment et où le ballon change de camp. Ils ne
        // changent rien au match ; ils servent à mesurer ce que le pressing et les
        // blocs font réellement, que le nombre de tacles ne disait pas.
        W.cnt = W.cnt || {};
        W.cnt['rec_' + p.s] = (W.cnt['rec_' + p.s] || 0) + 1;
        W.cnt['rec_' + p.s + '_' + (how || 'x')] = (W.cnt['rec_' + p.s + '_' + (how || 'x')] || 0) + 1;
        const zA = aOf(p.s, p.y);
        if (zA > 52) W.cnt['rec_' + p.s + '_haut'] = (W.cnt['rec_' + p.s + '_haut'] || 0) + 1;
        W.poss = p.s; W.possT = W.t; const T = TM[p.s], O = TM[OT[p.s]];
        const bA = aOf(p.s, p.y), ahead = LV[OT[p.s]].filter((q) => q.line !== 'GB' && aOf(p.s, q.y) > bA).length;
        T.counterUntil = 0; O.counterUntil = 0; T.cpressUntil = 0;
        if (how !== 'set' && how !== 'gk' && T.tac.won === 0 && bA < 70 && ahead <= 6) {
          T.counterUntil = W.t + 7.5;
          if (ahead <= 5 && bA < 62) { com('Contre-attaque ! ' + p.short + ' lance le mouvement'); key(12, p.s, 'counter'); }
        } else if (how !== 'set' && how !== 'gk' && TR(p, 'trans') && bA < 70 && ahead <= 6) {
          // §10 le Contre éclair lance la transition LUI-MÊME, même quand la consigne de
          // l'équipe ne dit pas de contre-attaquer. Sans ça, il voulait jouer vers
          // l'avant mais ses attaquants ne partaient pas, puisqu'ils ne courent qu'en
          // phase de contre : il n'avait personne à servir. La fenêtre est plus courte
          // que celle d'une équipe réglée pour contrer, et grandit avec sa compétence.
          T.counterUntil = W.t + 3.5 + TR(p, 'trans') * 3;
          if (ahead <= 5 && bA < 62) { com('Contre éclair de ' + p.short + ' !'); key(12, p.s, 'counter'); }
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
      // §23 le trait de finition ouvre les frappes spectaculaires : retourné, talonnade,
      // volée. Elles restent conditionnées à la hauteur du ballon et à l'angle.
      const ts = TR(p, 'shot');
      const z = W.ball.z, tech = p.dri * 0.5 + p.sht * 0.5 + ts * 12, pw = p.pow != null ? p.pow : p.phy;
      const opts = [], add = (k, w) => { if (w > 0) opts.push({ k, w }); };
      const tight = Math.abs(p.x - 34) > 13 && a > 92;           // §23 angle ferme
      const justBeat = W.t - (p.beatT || -9) < 1.6;              // §23 tir apres dribble
      if (z > 0.9) { add('volee', (10 + (tech - 60) * 0.5) * (1 + ts * 0.5)); add('retourne', tech > 82 - ts * 9 && a > 90 ? (tech - 82 + ts * 9) * 0.4 * (1 + ts) : 0); }
      else if (z > 0.3) { add('demi', 10 + (tech - 60) * 0.4); add('volee', 3); add('reprise', 6 + (tech - 60) * 0.3); }
      else {
        add('place', a > 86 ? 14 : 5);
        add('puissant', 6 + (pw - 60) * 0.35 + (a < 88 ? 8 : 0));
        add('rasSol', 7 + (p.sht - 60) * 0.2);
        add('enroule', tech > 70 ? ((tech - 70) * 0.9 + (Math.abs(p.x - 34) > 8 ? 5 : 0)) * (1 + ts * 0.4) : 0);
        add('seche', fresh ? 8 + (tech - 60) * 0.25 : 0);
        add('lob', gkOut ? 10 + (tech - 60) * 0.4 : 0.5);
        add('talon', tech > 80 - ts * 8 && a > 92 ? (tech - 80 + ts * 8) * 0.22 * (1 + ts * 0.8) : 0);
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
      // Les frappes de TRANSITION : moins de huit secondes après que l'équipe a récupéré
      // le ballon. C'est le terrain de la compétence Contre éclair ; le total des tirs
      // la noyait. Simple compteur, sans effet sur le match.
      if (W.poss === s && W.t - W.possT < 8) { W.cnt = W.cnt || {}; W.cnt['tir_transition_' + s] = (W.cnt['tir_transition_' + s] || 0) + 1; }
      const lp = W.lastPass, rec2 = lp && lp.to === p && W.t - lp.t < 5;
      const orig = head ? 'head' : fk ? 'fk' : a < 84 ? 'long' : rec2 && lp.kind === 'through' ? 'through' : rec2 && lp.kind === 'cross' ? 'cross' : W.t < T.counterUntil ? 'counter' : rec2 ? 'pass' : 'solo';
      if (cfg.shotDbg) cfg.shotDbg(p, { a, x: p.x, xg, orig, nd: nearestOpp(p).d, head, held: W.t - p.rcvT, lp: lp && lp.from ? lp.from.kind + '>' + lp.kind : '-' , defBehind: LV[o].filter((q) => aOf(s, q.y) > a).length });
      W.orig = W.orig || {}; const oo = W.orig[orig] || (W.orig[orig] = { n: 0, g: 0, xg: 0 }); oo.n++; oo.xg += xg;
      const skill = (p.sht + T.bonus - 65) / 55 * (head ? 0.6 : 1) + (p.energy - 100) / 500;
      const gkOutNow = hy(gk.x - 34, gk.y - yOf(s, PL)) > 5;
      const sv = head || fk ? null : (W.forceSv || pickShot(p, a, gkOutNow, W.t - p.rcvT < 0.55)); W.forceSv = null;
      if (sv) { W.cnt = W.cnt || {}; W.cnt['sv_' + sv] = (W.cnt['sv_' + sv] || 0) + 1; }
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
      // §23 le contrôle orienté et le contrôle d'élite s'ouvrent au joueur technique,
      // et un dribbleur confirmé les sort plus souvent.
      const roll = tq + (R() - 0.5) * 26 + TR(q, 'drib') * 7;
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
      if (inBox(aOf(q.s, q.y), q.x)) { key(14, q.s, 'box'); W.cnt.boxRcv = (W.cnt.boxRcv || 0) + 1; W.cnt['boxRcv_' + q.s] = (W.cnt['boxRcv_' + q.s] || 0) + 1; }
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
        const SAV = dbl ? 'DOUBLE ARRÊT !' : f.xg > 0.35 || (TR(gk, 'gk') > 0.5 && f.xg > 0.18) ? 'ARRÊT RÉFLEXE !' : f.sv === 'lob' ? 'LE GARDIEN SE DÉTEND' : f.sv === 'rasSol' || f.sv === 'ferme' ? 'ARRÊT DU PIED' : f.head ? 'CLAQUETTE !' : 'ARRÊT !';
        const SAVC = dbl ? gk.short + ' repousse une deuxième fois, incroyable !' : f.xg > 0.35 ? 'Réflexe énorme de ' + gk.short + ' !' : f.sv === 'lob' ? gk.short + ' se détend et capte le ballon piqué' : f.sv === 'rasSol' || f.sv === 'ferme' ? gk.short + ' sort le pied, superbe' : f.head ? gk.short + ' claque la tête de ' + p.short + ' sur sa barre' : 'Parade de ' + gk.short + ' devant ' + p.short + ' !';
        W.lastSaveT = W.t; W.lastSaveGk = gk.code;
        banner(SAV, gk.short, '#F2F4F7', 1.4); com(SAVC);
        if (f.xg > 0.22 && !f.pen) logE('Grosse parade de ' + gk.name + ' devant ' + p.name, s === 'H' ? '#BDEBC9' : '#F2B6B6', 'save', s);
        // §23 Mains sûres capte au lieu de repousser, Réflexes félins sort les frappes les plus dures
        const r = R(), cp = cl(0.44 + (gk.han - 65) / 70 - f.xg * 0.25 + TR(gk, 'hands') * 0.12, 0.2, 0.82);
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
      logE('BUT ! ' + bl.name + ' contre son camp, frappe déviée de ' + shooter.name + ' (' + W.score.H + '-' + W.score.A + ')', s === 'H' ? '#48E08B' : '#FF4757', 'G', s, { by: null, as: null, csc: bl.name });
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
      logE('BUT ! ' + p.name + ' ' + how + ' (' + W.score.H + '-' + W.score.A + ')', s === 'H' ? '#48E08B' : '#FF4757', 'G', s, { by: p.name, as: as ? as.name : null });
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
      // §14 « augmente la précision de certaines passes » : seulement les longues et
      // celles qui cassent une ligne, pas la passe latérale de dix mètres.
      const hard = kind === 'through' || kind === 'long' || kind === 'switch' || kind === 'space';
      const skill = p.pas + TM[s].bonus + (hard ? TR(p, 'pass') * 9 : 0);
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
        // §14 un Tueur tente la frappe dans des situations qu'un autre refuserait :
        // son seuil d'acceptation baisse ET la frappe pèse plus lourd dans son choix.
        const ts2 = TR(p, 'shot');
        const evS = ev * (1 + ts2 * 0.5);
        if (e.xg > 0.015 - ts2 * 0.007) opts.push({ k: 'shot', ev: oneV1 ? evS * 1.5 : evS });
      }
      const addPass = (q, tx, ty, kind, aerial) => {
        tx = cl(tx, 1, PW - 1); ty = cl(ty, 1, PL - 1);
        const e = passEval(p, q, tx, ty, !!aerial, kind); if (!e) return;
        const tA = aOf(s, ty); let ev = e.pS * V(s, tx, ty, e.space) - (1 - e.pS) * lossCost(s, tx, ty) * (T.tac.patience ? 1.25 : 1) * (isGK ? 1.5 : 1);
        const prog = tA - a0;
        if (counter) ev *= prog > 5 ? 1.25 : prog < -3 ? 0.55 : 1;
        // §10 le Contre éclair joue vers l'avant dès la récupération. Au premier jet, son
        // facteur multipliait l'espérance directement ; une espérance négative devenait
        // alors PLUS négative, et la compétence faisait jouer moins vers l'avant
        // (56 passes en profondeur pour mille devenaient 55, et le danger créé
        // tombait de 13,9 à 9,9). On grandit le gain et on réduit la perte.
        //
        // Et la phase de contre de l'équipe ne s'ouvre qu'avec un réglage précis (« après
        // la récupération : contre-attaquer ») : avec la tactique par défaut, elle ne
        // s'ouvrait jamais et la compétence ne se déclenchait pas. Le porteur qui l'a
        // joue donc vers l'avant dans les quatre secondes qui suivent CHAQUE
        // récupération de son équipe : c'est sa compétence, pas la consigne du coach.
        const eclair = TR(p, 'trans');
        if (eclair && (counter || (W.poss === s && W.t - W.possT < 4))) {
          const kt = prog > 5 ? 1 + eclair * 0.6 : prog < -3 ? 1 / (1 + eclair * 0.6) : 1;
          ev = ev > 0 ? ev * kt : ev / kt;
        }
        if (T.tac.pass === 0 && e.d > 26) ev *= 0.85; if (T.tac.pass === 2 && prog > 12) ev *= 1.15;
        // §42 Jeu court ou jeu long. Les deux lignes au-dessus ne jugeaient que la
        // distance et la progression, jamais le BALLON joué : une équipe réglée en jeu
        // direct envoyait exactement autant de ballons aériens qu'une équipe de
        // possession, donc le curseur ne se voyait pas sur le terrain. Une passe en
        // l'air est un pari : le jeu court le refuse, le jeu direct le prend.
        // Attention au signe : une espérance peut être négative (une passe qui coûte
        // plus qu'elle ne rapporte). La multiplier par 0,7 la rendrait MOINS mauvaise,
        // donc plus attirante, soit l'inverse de ce qu'on veut. On agit sur l'ampleur
        // en gardant le sens : favoriser, c'est grandir le gain et réduire la perte.
        if (aerial) { const k = [0.7, 1, 1.4][T.tac.pass] || 1; ev = ev > 0 ? ev * k : ev / k; }
        // §14 la Passe laser joue entre les lignes : les passes difficiles deviennent
        // une option raisonnable, et le receveur rapide est davantage servi dans la profondeur.
        const tp = TR(p, 'pass');
        if (kind === 'through') ev *= (T.tac.behind ? 1.3 : 1.1) * (1 + tp * 0.45) * (1 + TR(q, 'sprint') * 0.3);
        // Le passeur sait que le Perforateur fait l'appel : la passe en profondeur vers
        // lui pèse plus. Sans ce lien, ses courses ne servaient à rien. Même précaution
        // de signe qu'ailleurs : on grandit le gain, on réduit la perte.
        if ((kind === 'through' || kind === 'space') && TR(q, 'run')) { const kr = 1 + TR(q, 'run') * 0.5; ev = ev > 0 ? ev * kr : ev / kr; }
        if (kind === 'space') ev *= (1 + tp * 0.3) * (1 + TR(q, 'sprint') * 0.35);
        if (kind === 'long') ev *= 1 + tp * 0.4;
        if (kind === 'switch') ev *= (1.05 + Math.max(0, p.pas - 70) / 260) * (1 + tp * 0.5);
        // §42 La surcharge n'avait que sa première moitié. Le réglage décalait l'équipe
        // de sept mètres d'un côté — on attire bien l'adversaire — et rien ne poussait
        // ensuite à RENVERSER vers l'ailier resté seul de l'autre. Le style promettait
        // un plan en deux temps et n'en jouait qu'un.
        if (kind === 'switch' && T.tac.overload) {
          const lx2 = xl(s, tx);
          const loin = T.tac.overload === 1 ? lx2 > 40 : lx2 < 28;
          if (loin) { const kr = 1.45; ev = ev > 0 ? ev * kr : ev / kr; }
        }
        if (isGK && T.tac.gk === 0 && !aerial) ev *= 1.2; if (isGK && T.tac.gk === 1 && aerial) ev *= 1.25;
        if (e.off) { if (R() < 0.62) return; }
        opts.push({ k: 'pass', q, x: tx, y: ty, kind, aerial: !!aerial, ev, off: e.off });
      };
      for (const q of LV[s]) {
        if (q === p || q.fall > 0) continue;
        const dq = hy(q.x - p.x, q.y - p.y); if (dq < 4 || dq > 62) continue;
        // §14, §20 un Visionnaire voit des solutions que les autres ne voient pas
        const vis = p.dec * 0.6 + p.pas * 0.4 + TR(p, 'pass') * 16;
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
          // §14 le dribbleur tente davantage et prend plus de risques : il élimine plus souvent,
          // mais il perd aussi plus de ballons, puisqu'il tente des duels qu'un autre refuserait.
          if (drib) ev *= (T.tac.dribble ? 1.12 : 0.94) * (1 + TR(p, 'drib') * 0.42);
          if (counter && label !== 'side') ev *= 1.2;
          if (oneV1) ev *= 0.55;
          opts.push({ k: 'carry', x: tx, y: ty, ev, drib, blk: drib ? blk : null, label });
        };
        const fy = s === 'H' ? -1 : 1, gy = yOf(s, PL);
        carry(34 - p.x, gy - p.y, pr < 3 ? 5 : 9, 'goal');
        carry(0, fy, (pr < 3 ? 5 : 10) * (1 + TR(p, 'sprint') * 0.22), 'fwd');   // §14 il attaque la profondeur plus loin
        carry((p.x < 34 ? 1 : -1) * 0.65, fy * 0.76, 7, 'in');
        if (a0 > 58 && Math.abs(p.x - 34) > 15) carry((p.x < 34 ? -1 : 1) * 0.15, fy, 10, 'line');
        if (pr < 2.6) carry(p.x < 34 ? 1 : -1, -fy * 0.3, 4, 'side');
        if (a0 > 74 && Math.abs(p.x - 34) > 11) {
          const nl = p.x < 34 ? -1 : 1;
          const spots = [['near', 34 + nl * 3.2, 100.3], ['far', 34 - nl * 4.5, 99], ['spot', 34 + nl * 0.5, 94], ['six', 34, 101.3]];
          for (const [nm, sx, sa] of spots) {
            const tx = sx, ty = yOf(s, sa); let aw = 0, dw = 0.35;
            // §23 une Tour de contrôle gagne davantage de duels aériens sur les centres
            for (const q of LV[s]) if (q !== p && q.line !== 'GB') { const d = Math.min(hy(q.x - tx, q.y - ty), hy(q.tx - tx, q.ty - ty) + 0.8); if (d < 4.5) aw += Math.pow(q.phy / 70, 2) * (1.3 - d / 4.5) * (1 + TR(q, 'aerial') * 0.45); }
            for (const r of LV[o]) { const d = hy(r.x - tx, r.y - ty); if (d < 3.6) dw += Math.pow(r.phy / 70, 2) * (1.3 - d / 3.6) * 1.2 * (r.line === 'GB' ? 1.5 : 1); }
            if (aw < 0.25) continue;
            const pWin = aw / (aw + dw * 1.5), ev = (0.5 * pWin * 0.8 * xgAt(sa, sx) * 0.5 - (1 - 0.5 * pWin) * 0.008) * [0.65, 1, 1.35][T.tac.cross] * (1 + (p.pas - 65) / 150);
            opts.push({ k: 'cross', x: tx, y: ty, ev, nm });
          }
        }
        // J'ai essayé de rendre la conservation plus coûteuse chez une équipe patiente,
        // pour que le Tiki-taka fasse circuler au lieu de garder. Le Tiki-taka a un peu
        // mieux circulé (de 89 passes de retard à 17) mais un effectif technique a perdu
        // DOUZE POINTS sur vingt-six matchs : forcé de rejouer vite devant un bloc, il
        // perd le ballon. L'écart entre deux cartes de même note passait de 18 à 35
        // points. Annulé : le défaut visé est moins grave que le dégât causé.
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
      // §23 compteurs de décision : ce que le joueur a RÉELLEMENT choisi de faire.
      // Ils servent au garde-fou test/traits.js, qui vérifie qu'une compétence change
      // le comportement et pas seulement les chiffres affichés.
      W.cnt = W.cnt || {}; W.cnt.dec = (W.cnt.dec || 0) + 1;
      // Une passe aérienne EST un long ballon : deux lignes plus bas, exec l'envoie à
      // kick() avec le type 'long'. Le compteur disait 'pass', donc une équipe en jeu
      // direct semblait jouer court. On compte ce que le moteur fait, pas ce que
      // l'option s'appelait au moment du choix.
      const sousType = ch.k !== 'pass' ? '' : '_' + (ch.kind === 'pass' && ch.aerial ? 'long' : ch.kind);
      W.cnt['act_' + ch.k + sousType] = (W.cnt['act_' + ch.k + sousType] || 0) + 1;
      // et par équipe : sans ce suffixe, ce que fait un camp se noyait dans ce que fait l'autre (§15)
      W.cnt['act_' + ch.k + sousType + '_' + s] = (W.cnt['act_' + ch.k + sousType + '_' + s] || 0) + 1;
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
      if (card === 'R' || card === 'R2') { W.st[o].rc++; rt(fr, -1.2); fr.red = true; fr.x = -9; salirLV(); key(85, s, 'red'); }
      else if (card === 'Y') key(28, s, 'card');
      else key(a > 72 ? 20 : 5, s, 'foul');
      setPiece(pen ? 'pen' : 'fk', s, vic.x, vic.y);
    };
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
      // §23 un Funambule accède à des gestes qu'un joueur de même note n'atteint pas,
      // et les sort plus souvent. Sans la compétence, le palier reste celui des statistiques.
      const td = TR(p, 'drib');
      const lvl = p.dri * 0.7 + p.agi0 * 30 + td * 18;
      const pool = DRIBS.filter((d) => lvl >= d.min);
      if (!pool.length) return DRIBS[0];
      // les gestes rares restent rares même pour un joueur d'élite : le trait les rend
      // possibles, pas systématiques.
      const w = pool.map((d, i) => (i === 0 || i === 1 ? 3 : Math.max(0.25, 1.6 - (d.min - 55) / 45) * (1 + td * 1.1)) * (forced ? (i > 1 ? 1.6 : 0.5) : 1));
      let r2 = R() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < pool.length; i++) { r2 -= w[i]; if (r2 <= 0) return pool[i]; }
      return pool[0];
    };
    const duels = () => {
      const c = W.owner; if (!c || W.set || c.line === 'GB') return;
      const s = c.s, o = OT[s];
      if (c.carry && c.carry.drib && !c.carry.done && c.carry.blk && !c.carry.blk.red) {
        const bl = c.carry.blk;
        if (hy(bl.x - c.x, bl.y - c.y) < 1.4) {
          c.carry.done = true;
          // §23 et §31 : le geste joué dépend du joueur. Un crochet pour tout le monde,
          // un petit pont ou un sombrero seulement pour qui a la technique ou la compétence.
          // Le geste choisi change la difficulté du duel et ce que le commentaire raconte.
          const g = pickDrib(c, false);
          const pd = cl(pDrib(c, bl) - g.cost * 0.5 + g.gain * 0.22, 0.1, 0.9);
          W.cnt = W.cnt || {}; W.cnt.drib = (W.cnt.drib || 0) + 1; W.cnt['g' + g.tier] = (W.cnt['g' + g.tier] || 0) + 1;
          if (R() < pd) { W.cnt.dribOk = (W.cnt.dribOk || 0) + 1; bl.beat = 1.1 + g.gain * 0.5; c.beatT = W.t; c.lastGest = g.n; rt(c, 0.07 + g.gain * 0.04); rt(bl, -0.03); mark({ k: 'skill', c: c.code, tier: g.tier });
            com(c.short + (g.tier >= 4 ? ' : ' + g.lab + ' sur ' + bl.short + ' !' : g.tier >= 3 ? ' élimine ' + bl.short + ' d’une ' + g.lab : ' élimine ' + bl.short + ' !'));
            // §23 un geste de haut palier mérite sa ligne dans le rapport : il reste rare,
            // donc il ne noie pas le fil des événements.
            if (g.tier >= 4) logE(c.name + ' : ' + g.lab + ' sur ' + bl.name, s === 'H' ? '#BDEBC9' : '#F2B6B6', 'skill', s);
            if (aOf(s, c.y) > 66) key(12 + g.tier * 2, s, 'drib'); c.vx *= 1.1 + g.gain * 0.08; c.vy *= 1.1 + g.gain * 0.08; }
          else { const pf = (inBox(aOf(s, c.y), c.x) ? 0.15 : 1) * 0.17 * [0.65, 1, 1.45][TM[o].tac.tackle] * (TM[o].shout === 'calme' ? 0.75 : 1) * (bl.yc >= 1 ? 0.14 : 1);
            if (R() < pf) { foul(bl, c, 'drib'); return; }
            rt(bl, 0.07); rt(c, -0.04); W.st[o].tk++;
            com((TR(bl, 'tackle') > 0.4 && R() < 0.45 ? 'Tacle glissé de ' : TR(bl, 'press') > 0.4 && R() < 0.4 ? 'Interception de ' : 'Tacle de ') + bl.short + ', ballon récupéré');
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
        // §23 le Mur intervient mieux dans sa surface ; le Funambule résiste mieux au retour
        const pWin = cl(0.35 + (d.def + TM[o].bonus - Math.max(c.dri, c.phy * 0.92) - TM[s].bonus) / 80 + (backToGoal ? 0.08 : 0) + (fresh ? 0.05 : 0) + TR(d, 'tackle') * 0.07 - TR(c, 'drib') * 0.05, 0.12, 0.72);
        const pF = (ownBox ? 0.08 : 1) * 0.135 * [0.6, 1, 1.45][TM[o].tac.tackle] * (TM[o].shout === 'calme' ? 0.75 : 1) * (pWin < 0.3 ? 1.3 : 1) * (d.yc >= 1 ? 0.14 : 1);
        const r = R();
        if (r < pWin) { rt(d, 0.07); rt(c, -0.04); W.st[o].tk++; com((TR(d, 'tackle') > 0.4 && R() < 0.45 ? 'Tacle glissé de ' : TR(d, 'press') > 0.4 && R() < 0.4 ? 'Interception de ' : 'Tacle de ') + d.short + ' !'); if (R() < 0.72) gain(d, 'tackle'); else { W.owner = null; const b = W.ball; b.vx = (R() - 0.5) * 9; b.vy = (R() - 0.5) * 9; W.last = o; } return; }
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
        // J'ai essayé de faire monter les joueurs de couloir plus haut quand la consigne
        // dit de centrer, pour que le 3-5-2 centre autant qu'il le promet. Résultat
        // mesuré : il centrait toujours aussi peu (6,9 contre 7,6 pour l'Équilibré) et
        // il encaissait DEUX FOIS PLUS (17,1 de danger concédé contre 8,3). Deux pistons
        // haut placés devant trois défenseurs, c'est une défense ouverte. Annulé.
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
          // §44 Un bon attaquant part plus souvent, et au bon moment. Le taux était
          // plat : le meilleur avant-centre du jeu faisait autant d'appels que le pire.
          // t0 sert au temps de réaction du défenseur, plus bas : c'est le décalage
          // entre le départ de l'appel et le moment où il est vu.
          // §10 le Perforateur fait jusqu'à deux fois plus d'appels. Au premier jet c'était
          // deux fois et demie, et ça le sortait de la surface sans qu'on le serve
          // davantage : 124 tirs devenaient 106. Ce qui compte, c'est que l'appel soit
          // VU par le passeur, plus bas, dans addPass.
          const flair = (0.05 + Math.max(0, p.att + p.dec - 130) * 0.0006) * (1 + TR(p, 'run') * 1.0);
          if (!p.prep && R() < flair * (1 + T.tac.behind + Math.max(0, T.ment - 3) * 0.3)) p.prep = { t0: W.t, until: W.t + 2.2 + R(), dx: (R() < 0.5 ? -1 : 1) * (3 + R() * 4), err: gauss() * 0.9 * (1.3 - p.dec / 100) + 0.3 };
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
      // §41 UN 3-5-2 DÉFEND À CINQ, PAS À TROIS. Les pistons sont des milieux de couloir
      // quand on a le ballon, et des défenseurs dès qu'on le perd : c'est tout l'intérêt
      // du système, et c'est ce que sa description promet (« largeur et solidité »).
      //
      // Le moteur les laissait dans la ligne du milieu même en phase défensive, donc
      // trois centraux couvraient soixante-huit mètres, avec des intervalles PLUS larges
      // qu'une défense à quatre : 10,5 mètres contre 9,6. Mesuré, le 3-5-2 encaissait
      // 20,7 de danger contre 8,3 pour le 4-3-3. Le système le plus solide du football
      // était le plus perméable du jeu.
      // Sauf en marquage individuel strict : là, chacun suit son homme au lieu de tenir
      // une ligne, et placer les pistons dans la défense les tiraille entre les deux.
      // Mesuré, ça empirait : 21 buts encaissés contre 31.
      if (L2.DEF.length === 3 && T.tac.mark !== 2) {
        const pistons = L2.MIL.filter((q) => q.kind === 'WB');
        if (pistons.length) {
          L2.DEF = L2.DEF.concat(pistons).sort((p1, p2) => p1.bx - p2.bx);
          L2.MIL = L2.MIL.filter((q) => q.kind !== 'WB');
        }
      }
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
        // LE TEMPS DE RÉACTION. Le défenseur suivait l'appel dans son dos au pas de
        // calcul près, sans jamais être pris de vitesse par le MOUVEMENT : seule une
        // vitesse de pointe supérieure pouvait le battre. D'où un jeu où un effectif
        // athlétique créait trois fois plus de danger qu'un effectif technique de même
        // note, et où resserrer l'écart de vitesse vidait le match de ses occasions.
        //
        // Un appel se gagne d'abord par le départ : l'attaquant part, le défenseur met
        // un demi-temps à le voir, et ce demi-temps dépend de l'anticipation des deux.
        // Un attaquant qui sait masquer son appel gagne du terrain sans courir plus
        // vite ; un défenseur qui lit le jeu ne se laisse pas prendre.
        const reaction = best.prep
          ? cl(0.85 + (best.att + best.dec - 130) * 0.0045 - (p.def + p.dec - 130) * 0.0045 + TR(best, 'run') * 0.3, 0.20, 1.6)
          : 0;
        const vu = !best.prep || W.t - best.prep.t0 >= reaction;
        if (vu && p.line === 'DEF' && ra < D - 1 && Math.abs(xl(s, best.x) - p.tl.x) < 7) na = Math.max(ra - 1.2, 3);   // suit l'appel dans son dos
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
      // J'ai essayé de faire monter le pressing quand une possession adverse dépasse dix
      // secondes, pour qu'une équipe en bloc bas ne puisse plus faire tourner derrière
      // à l'infini. Mesuré : le Bus passait de 59 à 55 % de possession contre le
      // Tiki-taka, et gagnait toujours 20 points sur 24. Ce n'était pas la cause.
      // Annulé ; le constat reste dans test/styles.js.
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
        // §14 un Sprinter accélère plus fort : il prend deux mètres au démarrage.
        const lim = (p.acc0 != null ? p.acc0 : 0.45) * (1 + TR(p, 'sprint') * 0.26) * (p.urg > 0.9 ? 1.18 : 1) * (0.55 + 0.45 * (p.agi0 != null ? p.agi0 : 0.7)) * (turn < 0.2 ? 0.55 + 0.45 * (p.agi0 != null ? p.agi0 : 0.7) : 1) * (0.8 + 0.2 * p.energy / 100);
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
    // ============ LA BOUCLE DU MATCH (le moteur joue seul, §1 : aucun contrôle direct) ============
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
      // La possession se compte en temps de ballon. Le temps de VOL était crédité au
      // camp du passeur, y compris sur un long dégagement : une équipe qui balançait
      // devant gagnait de la possession à chaque ballon en l'air. D'où un Bloc bas,
      // censé laisser le ballon, qui affichait 61 % contre 51 % pour l'Équilibré.
      // Une passe au sol reste à son camp — elle arrive presque toujours ; un ballon
      // en l'air n'appartient à personne tant qu'il n'est pas retombé.
      if (W.owner) W.pt[W.owner.s] += DT;
      else if (W.fl && W.fl.from && !W.fl.aerial && W.fl.kind !== 'long' && W.fl.kind !== 'cross') W.pt[W.fl.from.s] += DT;
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
      // en calcul rapide (runFor, runTicks, finish), rien n'est enregistré... sauf si l'écran
      // a demandé à regarder le match (capture) : l'image est alors gardée à part. L'image se
      // fabrique sans rien tirer au hasard ni rien changer au monde : le match reste le même.
      if (W.skip && !W.capt) { curEv = []; return; }
      const P = new Float32Array(44);
      for (let i = 0; i < 11; i++) { const h = TM.H.ps[i], a = TM.A.ps[i]; P[i * 2] = !h || h.red ? -9 : h.x; P[i * 2 + 1] = !h || h.red ? -9 : h.y; P[22 + i * 2] = !a || a.red ? -9 : a.x; P[23 + i * 2] = !a || a.red ? -9 : a.y; }
      const fa = []; all().forEach((p) => { if (p.fall > 0) fa.push(p.code); });
      const f = { t: W.t, m: W.clk, h: W.half, P, b: [W.ball.x, W.ball.y, W.ball.z], o: W.owner ? W.owner.code : -1, to: W.fl && W.fl.to ? W.fl.to.code : -1,
        fl: W.fl ? [W.fl.x0, W.fl.y0, W.fl.x1, W.fl.y1, W.fl.kind] : null, ev: curEv.length ? curEv : null, fa: fa.length ? fa : null, set: W.set ? W.set.kind : null, tk: W.set && W.set.taker ? W.set.taker.code : -1,
        dv: W.dive && W.t - W.dive.t0 < W.dive.dur + 1 ? [W.dive.c, W.dive.dir, Math.min(1, (W.t - W.dive.t0) / Math.max(0.2, W.dive.dur))] : null, sc: [W.score.H, W.score.A] };
      curEv = [];
      if (W.skip) { W.capt.push(f); if (W.capt.length > W.captMax) W.capt.shift(); return; }
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
      // Le même match, découpé. Un match complet fait 54 000 pas de calcul, soit deux
      // secondes sur une machine de bureau et dix à trente sur un téléphone. Tant que
      // c'est une seule boucle, l'écran est gelé pendant tout ce temps, sans rien
      // afficher : le joueur croit que l'application a planté.
      //
      // runFor rend la main au bout du temps demandé. La SUITE des pas est identique à
      // celle de finish(), donc le match l'est aussi, au chiffre près : on ne va pas
      // plus vite, on arrête simplement de bloquer. L'appelant rappelle jusqu'à ce que
      // done soit vrai, et affiche minute pendant ce temps.
      runFor(ms) {
        W.skip = true; pend = null;
        const fin = Date.now() + (ms > 0 ? ms : 50);
        let g = 0;
        while (!W.ended && g < 200000) {
          // on teste l'horloge tous les 64 pas : la lire à chaque pas coûterait plus
          // cher que les pas eux-mêmes
          for (let k = 0; k < 64 && !W.ended && g < 200000; k++) { tick(); keys.length = 0; g++; }
          if (Date.now() >= fin) break;
        }
        if (W.ended) snap();
        // L'horloge du match n'est pas monotone : les arrêts de jeu poussent clk
        // au-delà de 2700 en première période, puis la mi-temps la ramène à 2700.
        // Affiché brut, le compteur reculait de 47' à 45'. On garde donc le plus haut
        // atteint pour la jauge, et le moteur donne le libellé juste (« 45+2' »).
        const brut = Math.min(90, Math.floor(W.clk / 60));
        W.minVue = Math.max(W.minVue || 0, brut);
        return { done: !!W.ended, minute: W.minVue, clock: clockLabel(W.clk, W.half), pas: g };
      },
      // Exactement n pas, faits comme runFor les fait. Un match interrompu se rejoue ainsi à
      // l'identique jusqu'à l'instant de chaque décision prise depuis le banc (direct.js) :
      // les décisions sont datées en pas de moteur, pas en minutes, qui ne sont pas assez fines.
      runTicks(n) {
        W.skip = true; pend = null;
        let g = 0;
        while (!W.ended && g < n) { tick(); keys.length = 0; g++; }
        if (W.ended) snap();
        const brut = Math.min(90, Math.floor(W.clk / 60));
        W.minVue = Math.max(W.minVue || 0, brut);
        return { done: !!W.ended, minute: W.minVue, clock: clockLabel(W.clk, W.half), pas: g };
      },
      // Regarder un match joué en calcul rapide : garder les n dernières images (dix par
      // seconde de jeu). C'est ce que lit la vue 3D de l'app pendant le direct (direct.js).
      capture(n) { W.capt = n > 0 ? [] : null; W.captMax = n; },
      images() { return W.capt || []; },
      snapAt(t) { let lo = null; for (let i = hist.length - 1; i >= 0; i--) if (hist[i].t <= t + 1e-6) { lo = hist[i]; break; } return lo || hist[0] || null; },
      state() { snap(); return Object.assign({}, hist[hist.length - 1], { cnt: W.cnt || {} }); },
      sub(side, i, d) {
        const T = TM[side], old = T.ps[i]; if (!old) return;
        const np = mkP(side, i, d, { line: old.line, fx: old.bx / 0.68, fy: 100 - old.ba / 1.05 });
        Object.assign(np, { x: old.x, y: old.y, kind: old.kind, lr: old.lr, wide: old.wide, rat: 6, energy: d.energy != null ? d.energy : 100 });
        if (np.fbMode == null) np.fbMode = old.fbMode; T.ps[i] = np; salirLV();
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
      // §6 le coaching en direct : quelques réglages changés (les autres restent, cartes de
      // match comprises), et la mentalité, si le manager la fixe, n'est plus corrigée par le score
      reglage(side, patch, ment) {
        const T = TM[side]; T.tac = Object.assign({}, T.tac, patch || {});
        if (ment != null) { T.ment = ment; T.ment0 = ment; T.mentManuelle = true; }
        setTP(T); W.dirty = true;
      },
      // §6 changer de formation en cours de match : chaque joueur reçoit sa nouvelle place
      // (coords dans l'ordre des joueurs, { line, fx, fy } comme au coup d'envoi)
      formation(side, coords) {
        const T = TM[side];
        T.ps.forEach((p, i) => { const c = coords[i]; if (!c) return; p.line = c.line; p.bx = c.fx * 0.68; p.ba = (100 - c.fy) * 1.05; });
        classify(T); setTP(T); salirLV(); W.dirty = true;
      },
      tactique(side) { const T = TM[side]; return { tac: Object.assign({}, T.tac), ment: T.ment }; },
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

// LinkFoot : état de départ d'un club. Tout l'état du jeu tient dans cet objet,
// ce qui le rend sérialisable tel quel (voir save.js).
// Un joueur de l'effectif de démonstration. Son niveau découle de sa note :
// un joueur à 66 est déjà construit, un joueur à 58 débute (§6).
const P = (id, name, pos, ovr) => ({ id, name, pos, ovr, plv: Math.max(1, Math.round((ovr - 46) / 3.5)), pxp: 0 });

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
      // §12, §19 : l'inventaire de compétences. Une compétence obtenue dans un pack
      // arrive ici, puis s'équipe sur un joueur compatible, puis agit dans le match.
      skillInv: [], nextSkillUid: 1, collected: [], seenPlayers: [],
      // §7, §29 : l'économie encadrée. `caps` compte les gains du jour par source,
      // `ledger` garde le journal des transactions.
      // §6 : l'entraînement se paie en séances, gagnées dans les Packs Entraînement
      sessions: 3, coachInv: {}, nextAdv: 0,
      shards: 0, caps: {}, quests: null,
      // le solde de départ a sa ligne : le journal explique le solde dès la première seconde
      ledger: [{ at: Date.now(), a: 1000, l: 'Dotation de départ' }], clubName: 'FC TonPseudo', country: 'fr', created: true,
      kit: { c1: '#2ECC71', c2: '#0C1210', pat: 'uni', collar: 'rond', sponsor: true }, showKit: false, cam: '2d',
      xp: 340, level: 7, dayStreak: 3, dayClaimed: false, winStreak: 0, showHub: false, levelUp: null, now: Date.now(), freePackAt: Date.now() + 90000, freeQueue: [],
      // le club de démonstration (niveau 7, note 65) joue en division 2, à sa place
      division: 2, seasonP: 2, lastGain: null,
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

// LinkFoot : Fiches joueurs : statistiques, note globale, profil (âge, nationalité, pied, forme).
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
const Players = {
  // Deux joueurs du même nom dans un club : le fil du match ne saurait plus lequel a
  // marqué, et l'un volait les buts, l'XP et les pronostics « X marque » de l'autre.
  // Un club neuf sur cinq en avait. Un nom déjà pris change d'initiale (G. → H. → I.),
  // sans rien toucher d'autre : note, âge et potentiel restent ceux du tirage.
  nomUnique(name, pris) {
    if (!pris.has(name)) return name;
    const m = /^([A-Z])\. (.+)$/.exec(name);
    if (m) {
      for (let i = 1; i < 26; i++) {
        const n = String.fromCharCode(65 + ((m[1].charCodeAt(0) - 65 + i) % 26)) + '. ' + m[2];
        if (!pris.has(n)) return n;
      }
    }
    let k = 2; while (pris.has(name + ' ' + k)) k++;
    return name + ' ' + k;
  },

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

// LinkFoot : SkillEngine (§12 à §20).
// 20 effets x 14 conditions x 6 raretés x 5 niveaux = plus de 10 000 combinaisons,
// générées à la demande, jamais stockées en dur.
//
// Trois règles tiennent tout le module :
//   1. une compétence a une PUISSANCE calculée, et sa RARETÉ en découle (§16, §17) :
//      une compétence très forte ne peut pas tomber souvent.
//   2. une compétence a des PRÉREQUIS (poste, statistiques, niveau) : elle n'est pas
//      équipable sur n'importe qui (§15).
//   3. une compétence équipée change le comportement du joueur dans le moteur (§14) :
//      ses effets sont lus par tactics.js puis par engine.js. Rien de décoratif.
const Skills = {
  SKILL_DEF() {
    if (this._skill) return this._skill;
    // [id, nom, catégorie, effets, description, prérequis]
    // `req` : statistiques minimum à la rareté Élite, mises à l'échelle selon la rareté.
    const E = [
      ['tueur', 'Tueur', 'Tir', { sht: 6 }, 'finition sur les grosses occasions', { TIR: 72, ATQ: 66 }],
      ['visionnaire', 'Visionnaire', 'Passe', { pas: 5, dec: 4 }, 'passes qui créent le danger', { PAS: 72 }],
      ['laser', 'Passe laser', 'Passe', { pas: 7 }, 'précision des passes longues', { PAS: 75 }],
      ['chef', 'Chef d’orchestre', 'Tactique', { dec: 6, pas: 3 }, 'contrôle du rythme', { PAS: 68 }],
      ['renard', 'Renard des surfaces', 'Finition', { sht: 4, dec: 4 }, 'déplacements dans la surface', { ATQ: 70 }],
      ['sprinter', 'Sprinter', 'Vitesse', { pace: 7 }, 'exploitation des espaces en contre', { VIT: 75 }],
      ['pressing', 'Pressing fou', 'Pressing', { def: 4, pace: 3, drain: 1.25 }, 'pressing plus intense, plus fatigant', { PHY: 68, VIT: 64 }],
      ['gladiateur', 'Gladiateur', 'Physique', { phy: 7 }, 'duels physiques', { PHY: 75 }],
      ['calme', 'Calme absolu', 'Mental', { dec: 6, pas: 2 }, 'moins d’erreurs sous pression', {}],
      ['mur', 'Mur', 'Défense', { def: 8 }, 'interventions dans sa surface', { 'DÉF': 75 }],
      ['acier', 'Mental d’acier', 'Mental', { dec: 5, sht: 2 }, 'résiste à la pression des grands moments', {}],
      ['dribbleur', 'Funambule', 'Dribble', { dri: 7 }, 'dribbles réussis', { DRI: 75 }],
      ['aerien', 'Tour de contrôle', 'Coup de pied arrêté', { phy: 5, def: 3, sht: 2 }, 'jeu de tête', { PHY: 70 }],
      ['moteur', 'Moteur', 'Physique', { drain: 0.8, pace: 2 }, 'endurance, fatigue plus lente', { PHY: 64 }],
      ['leader', 'Leader', 'Leadership', { team: { dec: 2 } }, 'concentration des coéquipiers', {}],
      ['meneur', 'Meneur', 'Collectif', { team: { pas: 2 } }, 'jeu collectif autour de lui', { PAS: 66 }],
      ['grinta', 'Grinta', 'Mental', { phy: 5, def: 3, pace: 3, team: { phy: 1 } }, 'agressivité et pressing quand l’équipe est menée', { PHY: 66 }],
      ['clutch', 'Clutch', 'Situationnel', { sht: 5, dec: 5 }, 'dernières minutes d’un match serré', { TIR: 66 }],
      ['gk_reflex', 'Réflexes félins', 'Gardien', { ref: 7 }, 'parades réflexes', { 'RÉF': 72 }],
      ['gk_mains', 'Mains sûres', 'Gardien', { han: 7 }, 'ballons captés, pas de rebond', { MAI: 72 }],
      // §10 les deux catégories qui manquaient. Elles ont un vrai effet en match
      // (§13) : le Perforateur multiplie ses appels dans le dos de la défense et les
      // masque mieux, le Contre éclair joue vers l'avant dès la récupération.
      ['perforateur', 'Perforateur', 'Attaque', { pace: 3, dec: 3 }, 'appels dans le dos de la défense', { ATQ: 72, VIT: 70 }],
      ['eclair', 'Contre éclair', 'Transition', { pace: 4, pas: 3 }, 'joue vers l’avant dès la récupération', { VIT: 68, PAS: 66 }]
    ];
    // [id, libellé, multiplicateur, raccourci]
    // Plus la condition est étroite, plus l'effet est fort quand elle se produit.
    const C = [
      ['always', 'en permanence', 1.0, ''], ['trail70', 'quand l’équipe est menée après la 70e', 1.9, 'grinta'], ['closeLate', 'dans les 15 dernières minutes d’un match serré', 1.8, 'clutch'],
      ['leading', 'quand l’équipe mène', 1.3, 'dominant'], ['first15', 'dans le premier quart d’heure', 1.4, 'précoce'], ['momentum', 'pendant 6 minutes après une action décisive', 1.7, 'momentum'],
      ['tired', 'quand son énergie passe sous 55 %', 1.5, 'increvable'], ['home', 'à domicile', 1.25, 'local'], ['counter', 'en phase de contre', 1.6, 'contre'], ['box', 'dans une surface de réparation', 1.5, 'surface'],
      ['setpiece', 'sur coup de pied arrêté', 1.6, 'CPA'], ['pressed', 'quand l’équipe subit le pressing', 1.5, 'sous pression'], ['derby', 'contre un adversaire mieux classé', 1.4, 'outsider'], ['second', 'en seconde période', 1.2, '2e MT']
    ];
    const POSOK = {
      GB: ['gk_reflex', 'gk_mains', 'calme', 'leader', 'acier', 'moteur'],
      DEF: ['mur', 'gladiateur', 'aerien', 'leader', 'calme', 'moteur', 'grinta', 'pressing', 'laser', 'sprinter', 'acier'],
      MIL: ['visionnaire', 'laser', 'chef', 'meneur', 'moteur', 'pressing', 'dribbleur', 'calme', 'grinta', 'clutch', 'gladiateur', 'sprinter', 'eclair'],
      ATT: ['tueur', 'renard', 'sprinter', 'dribbleur', 'clutch', 'aerien', 'grinta', 'acier', 'gladiateur', 'visionnaire', 'perforateur', 'eclair']
    };
    // Les compétences avec lesquelles un joueur peut NAÎTRE. Figées sur les vingt
    // d'origine : une compétence ajoutée au jeu s'obtient (pack, récompense) et
    // s'équipe, mais ne change pas rétroactivement les joueurs déjà générés. Sans ce
    // gel, ajouter une compétence redistribuait les compétences innées de tout
    // l'effectif de départ, et donc changeait tous les matchs déjà joués.
    const INNEES = new Set(['tueur', 'visionnaire', 'laser', 'chef', 'renard', 'sprinter', 'pressing', 'gladiateur',
      'calme', 'mur', 'acier', 'dribbleur', 'aerien', 'moteur', 'leader', 'meneur', 'grinta', 'clutch', 'gk_reflex', 'gk_mains']);
    return (this._skill = { E, C, POSOK, INNEES, LVL: ['I', 'II', 'III', 'IV', 'V'] });
  },

  // Le nombre réel de combinaisons : l'objectif du §12 est de dépasser 10 000.
  skillCount() {
    const D = this.SKILL_DEF();
    return D.E.length * D.C.length * D.LVL.length * this.GRADES();
  },

  // §17 : la puissance réelle d'une compétence, de 0 à 100.
  // Elle se calcule à partir de l'effet, de l'étroitesse de la condition, du niveau
  // et du grade du tirage. La RARETÉ EN DÉCOULE : elle n'entre jamais dans le calcul,
  // sinon le raisonnement tourne en rond. C'est la règle du §16 et du §17.
  GRADES() { return 8; },

  rawPower(eid, cid, lvl, grade) {
    const D = this.SKILL_DEF(), e = D.E.find((x) => x[0] === eid), c = D.C[cid];
    if (!e || !c) return 0;
    let raw = 0;
    for (const k in e[3]) {
      if (k === 'drain') raw += Math.abs(1 - e[3][k]) * 16;
      else if (k === 'team') for (const t in e[3][k]) raw += e[3][k][t] * 3.4;   // un effet collectif pèse lourd
      else raw += e[3][k];
    }
    return raw * c[2] * (0.6 + lvl * 0.2) * (0.7 + grade * 0.1);
  },

  // Mise à l'échelle sur 0-100. L'exposant étale volontairement le haut du spectre :
  // très peu de combinaisons atteignent Gold et Legendary, ce qui est exactement
  // ce que demande le §18.
  skillPower(eid, cid, lvl, grade) {
    const raw = this.rawPower(eid, cid, lvl, grade);
    // l'échelle est calée pour que la combinaison la plus forte du jeu atteigne 100
    // sans que rien ne s'y empile : chaque rareté est plus étroite que la précédente.
    return Math.max(0, Math.min(100, Math.round(100 * Math.pow(raw / 38.5, 1.9))));
  },

  // L'index des combinaisons, rangées par rareté. Construit une fois, à la demande.
  // C'est lui qui garantit qu'un tirage Legendary tire vraiment dans les compétences
  // les plus puissantes du jeu, et pas dans une approximation.
  SKILL_INDEX() {
    if (this._skIdx) return this._skIdx;
    const D = this.SKILL_DEF(), G = this.GRADES(), R = this.RARITY();
    const by = {}; R.forEach((r) => { by[r.id] = []; });
    for (let ei = 0; ei < D.E.length; ei++) {
      for (let ci = 0; ci < D.C.length; ci++) {
        for (let l = 0; l < D.LVL.length; l++) {
          for (let g = 0; g < G; g++) {
            const pw = this.skillPower(D.E[ei][0], ci, l, g);
            by[this.rarityOfPower(pw).id].push([D.E[ei][0], ci, l, g, pw]);
          }
        }
      }
    }
    return (this._skIdx = by);
  },

  // §15 : ce qu'une compétence exige du joueur qui la porte.
  // L'exigence suit la PUISSANCE : une compétence forte demande un joueur fort.
  skillReq(eid, lvl, grade, power) {
    const D = this.SKILL_DEF(), e = D.E.find((x) => x[0] === eid);
    if (!e) return { pos: [], stats: {}, lvl: 1 };
    const pw = power != null ? power : this.skillPower(eid, 0, lvl, grade);
    const scale = 0.74 + pw / 100 * 0.42;            // 0,74 au plus faible, 1,16 au plus fort
    const stats = {};
    for (const k in e[5]) stats[k] = Math.round(e[5][k] * scale);
    const pos = [];
    for (const p2 in D.POSOK) if (D.POSOK[p2].indexOf(eid) >= 0) pos.push(p2);
    // le niveau exigé suit la puissance : les compétences Normal les plus modestes
    // sont portables dès le départ, les Legendary demandent un joueur construit.
    return { pos, stats, lvl: 1 + Math.round(pw / 5.5), power: pw };
  },

  // §15 : ce joueur peut-il porter cette compétence ? La réponse dit toujours pourquoi.
  canEquip(p, sk) {
    if (!p || !sk) return { ok: false, why: 'Compétence ou joueur introuvable' };
    const req = sk.req || this.skillReq(sk.eid, sk.lvlIdx || sk.lvl - 1, sk.grade || 0, sk.power);
    if (req.pos.indexOf(p.pos) < 0) return { ok: false, why: 'Réservée aux ' + req.pos.join(', ') };
    const st = {}; this.cardStats(p).forEach((q) => { st[q.l] = q.v; });
    for (const k in req.stats) {
      if ((st[k] || 0) < req.stats[k]) return { ok: false, why: k + ' ' + (st[k] || 0) + ' sur ' + req.stats[k] + ' requis' };
    }
    const lvl = this.playerLevel(p);
    if (lvl < req.lvl) return { ok: false, why: 'Joueur niveau ' + lvl + ', il en faut ' + req.lvl };
    const worn = this.equippedOn(p.id).length;
    if (worn >= this.skillSlots(p)) return { ok: false, why: 'Emplacements pleins (' + worn + ' sur ' + this.skillSlots(p) + ')' };
    return { ok: true, why: '' };
  },

  // Le nombre de compétences qu'un joueur peut porter : il augmente avec son niveau.
  skillSlots(p) { const l = this.playerLevel(p); return l >= 25 ? 4 : l >= 15 ? 3 : l >= 6 ? 2 : 1; },

  equippedOn(id) { return (this.state.skillInv || []).filter((k) => k.on === id); },

  makeSkill(eid, cid, lvl, grade) {
    const D = this.SKILL_DEF(), e = D.E.find((x) => x[0] === eid), c = D.C[cid];
    const g = grade || 0;
    const power = this.skillPower(eid, cid, lvl, g);
    const R = this.rarityOfPower(power), rarIdx = this.RARITY().findIndex((x) => x.id === R.id);
    // l'effet réel appliqué par le moteur suit la même échelle que la puissance
    const mult = (0.46 + power / 100 * 1.05) * 0.62;
    const eff = {};
    for (const k in e[3]) eff[k] = k === 'drain' ? e[3][k] : k === 'team' ? Object.fromEntries(Object.entries(e[3][k]).map(([a, v]) => [a, v * mult])) : e[3][k] * mult;
    const name = e[1] + (lvl ? ' ' + D.LVL[lvl] : '') + (c[3] ? ' · ' + c[3] : '');
    return {
      id: eid + ':' + cid + ':' + lvl + ':' + g, eid, cid: c[0], cidx: cid, lvlIdx: lvl, grade: g,
      name, cat: e[2], rar: R.id, rarIdx, rarLabel: R.label, color: R.tint, lvl: lvl + 1, power, eff,
      req: this.skillReq(eid, lvl, g, power),
      desc: e[4] + (c[0] === 'always' ? '' : ', ' + c[1]) + '.'
    };
  },

  // §17 : tirer une compétence d'une rareté, c'est tirer uniformément parmi les
  // combinaisons dont la puissance tombe dans la bande de cette rareté. Aucune
  // compétence très puissante ne peut donc sortir à un taux élevé.
  rollSkill(rarId, rnd) {
    const r = rnd || Math.random, idx = this.SKILL_INDEX();
    let list = idx[rarId];
    if (!list || !list.length) {
      // bande vide : on descend d'un cran plutôt que de rendre n'importe quoi
      const R = this.RARITY(); let i = Math.max(0, R.findIndex((x) => x.id === rarId));
      while (i > 0 && (!idx[R[i].id] || !idx[R[i].id].length)) i--;
      list = idx[R[i].id];
    }
    const pick = list[Math.floor(r() * list.length)];
    return this.makeSkill(pick[0], pick[1], pick[2], pick[3]);
  },

  // Les compétences d'un joueur pendant un match : celles qu'on lui a équipées,
  // plus celles qu'il porte de naissance. Le moteur ne lit que cette liste (§19).
  skillsOf(p) {
    const worn = this.state && this.state.skillInv ? this.equippedOn(p.id) : [];
    if (p.skills) return p.skills.concat(worn);
    return this.innateSkills(p).concat(worn);
  },

  // Les compétences innées : ce avec quoi un joueur arrive. Un joueur normal en a peu
  // et de faible rareté : c'est au directeur sportif de le construire (§4, §27).
  innateSkills(p) {
    const r = this.seedR((p.id || 1) * 104729 + 3), R = this.RARITY();
    const pool = this.SKILL_DEF().POSOK[p.pos] || this.SKILL_DEF().POSOK.MIL;
    const n = p.ovr >= 82 ? 2 : p.ovr >= 68 ? 1 : 0;
    const capIdx = Math.max(0, R.findIndex((x) => x.id === this.rarityFor(p).id));
    const idx = this.SKILL_INDEX(), out = [];
    for (let i = 0; i < n; i++) {
      let q = r(), ri = 0;
      for (let k = 0; k < R.length; k++) { q -= R[k].rate; if (q <= 0) { ri = k; break; } }
      ri = Math.min(ri, capIdx);
      // une compétence innée reste compatible avec le poste du joueur
      const nee = this.SKILL_DEF().INNEES;
      const band = (idx[R[ri].id] || []).filter((x) => pool.indexOf(x[0]) >= 0 && nee.has(x[0]));
      const list = band.length ? band : (idx[R[0].id] || []).filter((x) => pool.indexOf(x[0]) >= 0 && nee.has(x[0]));
      if (!list.length) continue;
      const pick = list[Math.floor(r() * list.length)];
      out.push(this.makeSkill(pick[0], pick[1], pick[2], pick[3]));
    }
    return out;
  },

  // §19 : équiper change immédiatement le joueur, donc le moteur, donc le match.
  equipSkill(uid, playerId) {
    const s = this.state, inv = (s.skillInv || []).slice();
    const i = inv.findIndex((k) => k.uid === uid);
    if (i < 0) return { ok: false, why: 'Compétence introuvable' };
    const p = s.squad.find((x) => x.id === playerId);
    if (!p) return { ok: false, why: 'Joueur introuvable' };
    const chk = this.canEquip(p, inv[i]);
    if (!chk.ok) return { ok: false, why: 'COMPÉTENCE INCOMPATIBLE · ' + chk.why };
    inv[i] = Object.assign({}, inv[i], { on: playerId });
    this.buzz([25, 25, 50]);
    this.setState({ skillInv: inv, trainLog: p.name + ' apprend ' + inv[i].name });
    this.bumpQuest('equip', 1);
    return { ok: true };
  },

  unequipSkill(uid) {
    const s = this.state, inv = (s.skillInv || []).slice();
    const i = inv.findIndex((k) => k.uid === uid);
    if (i < 0) return { ok: false, why: 'Compétence introuvable' };
    inv[i] = Object.assign({}, inv[i], { on: null });
    this.setState({ skillInv: inv });
    return { ok: true };
  },

  // L'inventaire tel que l'écran Compétences l'affiche : pour chaque compétence,
  // qui la porte et, sinon, qui pourrait la porter.
  skillInventory() {
    const s = this.state, inv = s.skillInv || [];
    return inv.map((k) => {
      const on = k.on ? s.squad.find((p) => p.id === k.on) : null;
      const fits = s.squad.filter((p) => this.canEquip(p, k).ok);
      // §81 : quand personne ne peut la porter, on dit ce qui manque, pas « incompatible ».
      let miss = '';
      if (!fits.length && !on) {
        const req = k.req || this.skillReq(k.eid, k.lvlIdx || k.lvl - 1, k.grade || 0, k.power);
        const cands = s.squad.filter((p) => req.pos.indexOf(p.pos) >= 0);
        if (!cands.length) miss = 'Aucun ' + req.pos.join(' ni ') + ' dans ton effectif';
        else {
          const best = cands.map((p) => this.canEquip(p, k)).find((x) => x.why);
          const closest = cands.sort((a, b2) => this.playerLevel(b2) - this.playerLevel(a))[0];
          miss = this.canEquip(closest, k).why + ' (ton meilleur candidat : ' + closest.name + ')';
          if (!miss && best) miss = best.why;
        }
      }
      return Object.assign({}, k, {
        onName: on ? on.name : null,
        fitCount: fits.length,
        fits: fits.map((p) => ({ id: p.id, name: p.name, pos: p.pos, ovr: p.ovr })),
        miss,
        reqLine: this.reqLine(k)
      });
    });
  },

  reqLine(k) {
    const req = k.req || this.skillReq(k.eid, k.lvlIdx || k.lvl - 1, k.grade || 0, k.power);
    const st = Object.keys(req.stats).map((x) => x + ' ' + req.stats[x]);
    return [req.pos.join('/'), st.join(', '), 'niveau ' + req.lvl].filter(Boolean).join(' · ');
  }
};

// LinkFoot : Cartes : raretés, catalogue de 500, packs, collection, fragments et niveaux (§56 à §65).
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
const Cards = {
  // §11 et §16 : six raretés, taux exacts du cahier des charges, affichés avant l'ouverture.
  // `pw` est la bande de puissance d'une compétence qui tombe dans cette rareté (§17) :
  // plus une compétence est forte, plus elle est rare, et plus son taux de drop est faible.
  RARITY() {
    return [
      { id: 'normal', label: 'Normal', rate: 0.70, lo: 48, hi: 64, pw: [0, 19], shards: 1, tint: '#9AA3B0', color: 'linear-gradient(135deg, #AEB9C2, #5E6672)', ink: '#171B21' },
      { id: 'rare', label: 'Rare', rate: 0.20, lo: 62, hi: 74, pw: [20, 39], shards: 4, tint: '#4FA8E8', color: 'linear-gradient(135deg, #4FA8E8, #2F8FE0)', ink: '#06101F' },
      { id: 'epic', label: 'Épique', rate: 0.07, lo: 71, hi: 81, pw: [40, 59], shards: 12, tint: '#C39BFF', color: 'linear-gradient(135deg, #C39BFF, #7B4FD8)', ink: '#120A24' },
      { id: 'elite', label: 'Élite', rate: 0.02, lo: 78, hi: 87, pw: [60, 74], shards: 30, tint: '#2ECC71', color: 'linear-gradient(135deg, #2ECC71, #1E9E92)', ink: '#04201C' },
      { id: 'gold', label: 'Gold', rate: 0.009, lo: 84, hi: 92, pw: [75, 89], shards: 80, tint: '#FFC24A', color: 'linear-gradient(135deg, #FFE59A, #E9A93A)', ink: '#241703' },
      { id: 'legendary', label: 'Legendary', rate: 0.001, lo: 88, hi: 96, pw: [90, 100], shards: 200, tint: '#FF4757', color: 'linear-gradient(135deg, #FF9F6B, #FF4F7B)', ink: '#2A0812' }
    ];
  },

  // La rareté d'une compétence se déduit de sa puissance réelle (§17), jamais l'inverse.
  rarityOfPower(pw) {
    const R = this.RARITY(), v = Math.max(0, Math.min(100, pw));
    return R.find((x) => v >= x.pw[0] && v <= x.pw[1]) || R[0];
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

  // §10 : UN SEUL PACK. Pas de catalogue de packs à comprendre, un seul bouton.
  // §28 : son coût, son contenu possible et ses probabilités sont affichés avant l'ouverture.
  PACK_DEFS() {
    return [
      { key: 'linkfoot', name: 'LinkFoot Pack', n: 3, cost: 250, req: 0, w: {},
        color: 'linear-gradient(135deg, #2ECC71, #1E9E92)', fx: 'gold',
        content: 'joueur, compétence, objet ou fragments' }
    ];
  },

  THE_PACK() { return this.PACK_DEFS()[0]; },

  packState(def) {
    const s = this.state, lock = this.lockOf(def.req || 0);
    const poor = s.balance < def.cost;
    return { locked: lock.locked, need: lock.need, can: !lock.locked && !poor,
      why: lock.locked ? lock.why : poor ? 'Il te manque ' + (def.cost - s.balance) + ' jetons' : '' };
  },

  // Les packs offerts (quotidien, série, niveau, promotion) tirent dans la même liste
  // que les packs achetés : plus de clé inventée qui ne correspond à aucun pack.
  packByKey(key) { return this.PACK_DEFS().find((d) => d.key === key) || this.PACK_DEFS()[0]; },

  packName(key) { return this.packByKey(key).name; },

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

  // §10 : le contenu d'un pack. Un tirage = une rareté (taux du §11), puis le lot :
  // un joueur, une compétence de cette rareté, ou des fragments si le lot est un doublon.
  // Tirage côté système, jamais côté affichage (§29).
  // §8 LE pack principal donne TOUT : joueurs, compétences, objets (séances, cartes
  // d'amélioration, causeries, plans tactiques) et ressources (fragments, quand un
  // joueur tiré est déjà au club). Chaque tirage choisit d'abord sa FAMILLE selon ces
  // parts, puis sa RARETÉ selon RARITY. Les deux sont affichées avant l'ouverture
  // (§9) : jusqu'ici, la part joueur / compétence n'était écrite nulle part.
  PACK_SLOTS() {
    return [
      { kind: 'player', w: 0.40, label: 'Joueur' },
      { kind: 'skill', w: 0.45, label: 'Compétence' },
      { kind: 'objet', w: 0.15, label: 'Objet' }
    ];
  },

  drawSlot(rnd) {
    const S = this.PACK_SLOTS(), q = (rnd || Math.random)();
    let a = 0; for (const x of S) { a += x.w; if (q <= a) return x.kind; }
    return S[S.length - 1].kind;
  },

  // §9 : la part de chaque famille, en pourcentage, pour l'affichage avant l'ouverture.
  // Lue dans PACK_SLOTS, la table même du tirage : changer une part ici change le
  // tirage ET l'affichage, jamais l'un sans l'autre.
  packFamilies() {
    const S = this.PACK_SLOTS(), t = S.reduce((a, x) => a + x.w, 0) || 1;
    return S.map((x) => ({ kind: x.kind, label: x.label, pct: x.w / t * 100 }));
  },

  // Ce qu'un objet fait, en quelques mots, lu dans ses propres champs : la carte
  // révélée ne peut donc pas promettre autre chose que ce que l'objet applique.
  // Une réunion se range en réserve et agit le jour où on la tient : la carte le dit.
  objetCourt(o) {
    if (!o) return '';
    const p = [];
    if (o.kind === 'meeting') p.push('à tenir');
    if (o.sessions) p.push('+' + o.sessions + ' séance' + (o.sessions > 1 ? 's' : ''));
    const cartes = o.stats || (o.stat ? [o.stat] : []);
    if (cartes.length) p.push('carte' + (cartes.length > 1 ? 's' : '') + ' +2 ' + cartes.join(', '));
    if (o.squadXp) p.push('+' + o.squadXp + ' XP à l’effectif');
    if (o.kind === 'plan') p.push((o.plans || 1) + ' plan' + ((o.plans || 1) > 1 ? 's' : '') + ' tactique' + ((o.plans || 1) > 1 ? 's' : ''));
    if (o.morale) p.push('moral +' + o.morale);
    if (o.coh) p.push('cohésion +' + Math.round(o.coh * 100) + ' %');
    if (o.adv && o.kind !== 'plan') p.push('+' + o.adv + ' d’avantage');
    return p.join(' · ');
  },

  // Un tirage complet : rareté, puis famille (joueur, compétence ou objet) de cette rareté.
  drawLot(rnd, owned) {
    const R = this.RARITY(), r = rnd || Math.random;
    let q = r(), pick = R[0];
    for (let i = 0; i < R.length; i++) { q -= R[i].rate; if (q <= 0) { pick = R[i]; break; } }
    const slot = this.drawSlot(r);
    if (slot === 'skill') {
      const sk = this.rollSkill(pick.id, r);
      return { kind: 'skill', rar: pick.id, skill: sk, name: sk.name, ovr: sk.power, label: pick.label, color: pick.color, shards: pick.shards };
    }
    if (slot === 'objet') {
      // Un objet de la rareté tirée, pris dans les deux tables du matériel (entraînement
      // et entraîneur) : une seule source pour ce qu'un objet fait.
      const tous = this.TRAIN_LOTS().map((x) => Object.assign({ famille: 'entrainement' }, x))
        .concat(this.COACH_ITEMS().map((x) => Object.assign({ famille: 'tactique' }, x)));
      const ici = tous.filter((x) => x.rar === pick.id);
      const liste = ici.length ? ici : tous.filter((x) => x.rar === 'normal');
      const obj = liste[Math.floor(r() * liste.length)];
      const U = this.UPGRADE_CARDS();
      return { kind: 'objet', rar: pick.id, name: obj.label, label: pick.label, color: pick.color, shards: pick.shards,
        objet: Object.assign({}, obj, {
          stat: obj.up ? U[Math.floor(r() * U.length)][0] : null,
          stats: obj.up > 1 ? Array.from({ length: obj.up }, () => U[Math.floor(r() * U.length)][0]) : null
        }) };
    }
    const pool = this.CARD_POOL().filter((c) => c.rar === pick.id);
    const c = pool[Math.floor(r() * pool.length)];
    const dup = owned && owned.has(c.id);
    return dup
      ? { kind: 'shards', rar: pick.id, name: c.name, ovr: c.ovr, label: pick.label, color: pick.color, dup: true, shards: pick.shards, id: c.id, pos: c.pos }
      : { kind: 'player', rar: pick.id, name: c.name, ovr: c.ovr, pos: c.pos, id: c.id, label: pick.label, color: pick.color, shards: pick.shards };
  },

  // L'ouverture complète, côté règles : l'écran ne fait que l'animer.
  openPack(opts) {
    const o = opts || {}, s = this.state, def = this.THE_PACK();
    if (!o.free) { const st2 = this.packState(def); if (!st2.can) return { ok: false, why: st2.why }; }
    const r = o.rnd || Math.random;
    const owned = new Set((s.squad || []).map((p) => p.id).concat(s.collected || []));
    const got = [];
    let shards = 0;
    for (let i = 0; i < def.n; i++) {
      const lot = this.drawLot(r, owned);
      if (lot.kind === 'player') owned.add(lot.id);
      if (lot.kind === 'shards') shards += lot.shards;
      got.push(lot);
    }
    const order = this.RARITY().map((x) => x.id);
    got.sort((a, b) => order.indexOf(b.rar) - order.indexOf(a.rar) || (b.ovr || 0) - (a.ovr || 0));
    return { ok: true, def, got, shards, free: !!o.free };
  },

  // Encaisser le pack : les joueurs entrent dans l'effectif, les compétences dans l'inventaire,
  // les doublons en fragments. §19 : tout est immédiatement disponible partout.
  commitPack(res) {
    if (!res || !res.ok) return { ok: false };
    const s = this.state, def = res.def;
    const squad = s.squad.slice(), inv = (s.skillInv || []).slice(), collected = (s.collected || []).slice();
    let uid = s.nextSkillUid || 1;
    res.got.forEach((g) => {
      if (g.kind === 'player') {
        const p = this.cardToPlayer(g);
        p.name = this.nomUnique(p.name, new Set(squad.map((x) => x.name)));
        squad.push(p); collected.push(g.id);
      }
      else if (g.kind === 'skill') { inv.push(Object.assign({}, g.skill, { uid: uid++, on: null })); }
    });
    const objets = res.got.filter((g) => g.kind === 'objet').map((g) => g.objet);
    const cost = res.free ? 0 : def.cost;
    this.setState({ squad, skillInv: inv, collected, nextSkillUid: uid,
      shards: (s.shards || 0) + res.shards,
      balance: s.balance - cost,
      // ce que le kiosque affiche sous la carte du pack : le dernier tirage, en clair
      lastCardPack: res.got.map((g) => g.name + ' (' + g.label + ')').join(' · '),
      missions: this.bumpMission(s.missions, 'pack', 1),
      freeQueue: res.free ? s.freeQueue.slice(1) : s.freeQueue });
    if (!res.free) this.logMoney(-cost, 'Ouverture ' + def.name);
    // §3 une seule source de vérité : un objet sorti du pack passe par les fonctions
    // qui rangent le matériel, les mêmes pour tout ce qui en donne.
    this.appliquerObjetsEntrainement(objets.filter((o) => o.famille !== 'tactique'));
    this.rangerObjetsCoach(objets.filter((o) => o.famille === 'tactique'));
    this.bumpQuest('pack', 1);
    return { ok: true };
  },

  // Une carte du catalogue devient un vrai joueur de l'effectif (§19).
  cardToPlayer(c) {
    return { id: c.id, name: c.name, pos: c.pos, ovr: c.ovr, rar: c.rar, fresh: true, scouted: true,
      plv: 1, pxp: 0, pot: Math.min(97, c.ovr + 4 + Math.floor(Math.random() * 10)) };
  },

  // La rareté d'un joueur de l'effectif, déduite de sa note quand la carte n'en porte pas.
  rarityFor(p) {
    const R = this.RARITY();
    if (p.rar) { const hit = R.find((x) => x.id === p.rar); if (hit) return hit; }
    for (let i = R.length - 1; i >= 0; i--) if (p.ovr >= R[i].lo) return R[i];
    return R[0];
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

  // Les trois montées (staff, stade, centre) refusent de la même façon et disent pourquoi.
  hireStaff(id) {
    const s = this.state, d = this.STAFF_DEFS().find((x) => x.id === id), lv = this.staffLv(id);
    if (!d) return { ok: false, why: 'Poste inconnu' };
    if (lv >= 3) return { ok: false, why: 'Niveau maximum' };
    const lock = this.lockOf(this.gateOf('staff', lv + 1));
    if (lock.locked) { this.setState({ staffLog: d.label + ' : ' + lock.why }); return { ok: false, why: lock.why }; }
    const cost = d.cost[lv];
    if (s.balance < cost) { const why = 'Il te manque ' + (cost - s.balance) + ' jetons'; this.setState({ staffLog: d.label + ' : ' + why }); return { ok: false, why }; }
    this.buzz([25, 25, 50]);
    this.spend(cost, 'Staff : ' + d.label + ' niveau ' + (lv + 1));   // §7 la dépense entre au journal
    this.setState({ staff: Object.assign({}, s.staff, { [id]: lv + 1 }), staffLog: d.label + ' niveau ' + (lv + 1) + ' recruté · ' + d.eff[lv + 1] });
    return { ok: true, lvl: lv + 1 };
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
    const s = this.state, L = this.STADES(), lv = s.stade || 0;
    if (lv >= L.length - 1) return { ok: false, why: 'Niveau maximum' };
    const lock = this.lockOf(this.gateOf('stade', lv + 1));
    if (lock.locked) { this.setState({ staffLog: 'Stade : ' + lock.why }); return { ok: false, why: lock.why }; }
    const cost = L[lv + 1].cost;
    if (s.balance < cost) { const why = 'Il te manque ' + (cost - s.balance) + ' jetons'; this.setState({ staffLog: 'Stade : ' + why }); return { ok: false, why }; }
    this.buzz([25, 25, 60]);
    this.spend(cost, 'Stade : ' + L[lv + 1].name);
    this.setState({ stade: lv + 1, staffLog: L[lv + 1].name + ' construit · ' + L[lv + 1].cap + ' places' });
    return { ok: true, lvl: lv + 1 };
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
    const s = this.state, A = this.ACADEMIES(), lv = s.academy || 0;
    if (lv >= A.length - 1) return { ok: false, why: 'Niveau maximum' };
    const lock = this.lockOf(this.gateOf('academy', lv + 1));
    if (lock.locked) { this.setState({ staffLog: 'Centre : ' + lock.why }); return { ok: false, why: lock.why }; }
    const cost = A[lv + 1].cost;
    if (s.balance < cost) { const why = 'Il te manque ' + (cost - s.balance) + ' jetons'; this.setState({ staffLog: 'Centre : ' + why }); return { ok: false, why }; }
    this.buzz([25, 25, 60]);
    this.spend(cost, 'Centre de formation : ' + A[lv + 1].name);
    this.setState({ academy: lv + 1, staffLog: A[lv + 1].name + ' ouvert' });
    return { ok: true, lvl: lv + 1 };
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
    // un identifiant et un nom libres : deux jeunes au même identifiant partageaient profil et statistiques
    const ids = new Set((st.squad || []).map((p) => p.id));
    let id = 30000 + (st.division * 100) + Math.floor(r() * 900);
    while (ids.has(id)) id++;
    const name = this.nomUnique(F[Math.floor(r() * F.length)] + ' ' + L[Math.floor(r() * L.length)], new Set((st.squad || []).map((p) => p.name)));
    return { id, name, pos: POS[Math.floor(r() * POS.length)], ovr, pot, age: 16 + Math.floor(r() * 4), youth: true, fresh: true, scouted: true };
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

  // §6 : une séance consomme une séance en stock. L'entraînement est donc une
  // décision, pas un bouton qu'on presse en boucle. Le refus dit toujours pourquoi.
  train(id) {
    const s = this.state, T = this.TRAININGS().find((t) => t.id === id);
    if (!T) return { ok: false, why: 'Séance inconnue' };
    const info = this.trainInfo();
    if (!info.can) return { ok: false, why: info.why };
    if (!this.takeSession()) return { ok: false, why: this.trainInfo().why };
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
    this.setState({ squad, cohBonus: Math.min(0.12, (s.cohBonus || 0) + (T.coh || 0)), trainLog: 'Séance ' + T.label + (lines.length ? ' · ' + lines.slice(0, 3).join(', ') : '') + (hurt.length ? ' · blessé : ' + hurt.join(', ') : '') + ' · ' + this.sessions() + ' séance(s) restante(s)', trainDone: (s.trainDone || 0) + 1 });
    return { ok: true, gains: lines, hurt };
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
  // §25 : la valeur se calcule, elle n'est pas écrite. Niveau, note, âge, potentiel,
  // forme, rareté et compétences portées entrent tous dedans. Un joueur normal
  // longuement développé finit donc par valoir cher : c'est une vraie économie.
  valueOf(p) {
    const age = p.age != null ? p.age : this.profile(p).age, pot = p.pot != null ? p.pot : p.ovr;
    const ageK = age <= 21 ? 1.35 : age <= 25 ? 1.2 : age <= 29 ? 1 : age <= 32 ? 0.7 : 0.45;
    const formK = 0.85 + ((p.form != null ? p.form : 70) - 50) / 200;
    const lvlK = 1 + (this.playerLevel(p) - 1) * 0.035;                 // le travail accompli se paie
    const rarK = 1 + Math.max(0, this.RARITY().findIndex((x) => x.id === this.rarityFor(p).id)) * 0.07;
    const skills = this.state && this.state.skillInv ? this.equippedOn(p.id) : [];
    const skK = 1 + skills.reduce((a, k) => a + k.power / 260, 0);      // une compétence rare vaut cher
    const base = Math.pow(Math.max(40, p.ovr) / 10, 3.2) * ageK * formK * (1 + Math.max(0, pot - p.ovr) / 40) / 3;
    return Math.round(base * lvlK * rarK * skK) * 10;
  },

  // Le détail de la valeur, pour que l'écran puisse l'expliquer plutôt que l'afficher sèchement.
  valueBreakdown(p) {
    const skills = this.state && this.state.skillInv ? this.equippedOn(p.id) : [];
    return {
      value: this.valueOf(p), lvl: this.playerLevel(p),
      rar: this.rarityFor(p).label,
      skills: skills.length,
      line: 'Niveau ' + this.playerLevel(p) + ' · ' + this.rarityFor(p).label
        + (skills.length ? ' · ' + skills.length + ' compétence' + (skills.length > 1 ? 's' : '') : '')
    };
  },

  marketList() {
    const s = this.state; if (s.market && s.market.week === s.seasonP + s.division * 10) return s.market.list;
    const POS = ['GB', 'DEF', 'DEF', 'MIL', 'MIL', 'ATT'], r = this.seedR(s.division * 977 + s.seasonP * 31 + 5);
    const list = [], pris = new Set(s.squad.map((p) => p.name)); const F = ['A.', 'B.', 'C.', 'D.', 'E.', 'G.', 'H.', 'I.', 'J.', 'K.', 'L.', 'M.', 'N.', 'O.', 'R.', 'S.', 'T.', 'V.', 'Y.', 'Z.'];
    const L = ['Marvello', 'Ducasson', 'Ebongué', 'Halvorsen', 'Quintero', 'Belkadi-Roy', 'Stranieri', 'Okafor-Lemaire', 'Vasquet', 'Nyamsi', 'Gaudrel', 'Petrakis', 'Lindau', 'Moreau-Diaby', 'Castagne-Nil', 'Rivoire', 'Takamura', 'Ferbault', 'Ansaldi', 'Kowalevski', 'Dembrel', 'Soumahé'];
    for (let i = 0; i < 6; i++) {
      const ovr = 55 + Math.floor(r() * 12) + (5 - s.division) * 3 + this.staffLv('recruteur') * 2, id = 20000 + s.division * 1000 + s.seasonP * 100 + i;
      const p = { id, name: this.nomUnique(F[Math.floor(r() * F.length)] + ' ' + L[Math.floor(r() * L.length)], pris), pos: POS[Math.floor(r() * POS.length)], ovr };
      pris.add(p.name);
      list.push(Object.assign(p, { scouted: this.staffLv('recruteur') >= 2, price: this.valueOf(Object.assign({}, p, this.profile(p))) }));
    }
    return list;
  },

  // §17 Transferts : acheter. La règle vivait dans l'écran Mon Club et nulle part
  // ailleurs : l'app téléphone ne pouvait pas acheter, et un achat n'apparaissait pas
  // dans le journal des finances. Elle est ici, une seule fois (§3), et l'argent passe
  // par spend(), le même chemin que toutes les dépenses du club (§7).
  MARKET_RULES() { return { maxSquad: 20 }; },

  buyInfo(m) {
    const s = this.state, R = this.MARKET_RULES();
    if (!m) return { can: false, why: 'Ce joueur n’est plus sur le marché' };
    const why = s.match && !s.match.done ? 'Impossible pendant un match'
      : s.squad.some((p) => p.id === m.id) ? 'Déjà dans ton effectif'
      : s.squad.length >= R.maxSquad ? 'Effectif complet (' + R.maxSquad + ' joueurs) : vends d’abord'
      : s.balance < m.price ? 'Il te manque ' + (m.price - s.balance) + ' jetons' : '';
    return { can: !why, why };
  },

  buyPlayer(id) {
    const s = this.state, list = this.marketList(), m = list.find((x) => x.id === id);
    const info = this.buyInfo(m);
    if (!info.can) return { ok: false, why: info.why };
    const pay = this.spend(m.price, 'Achat de ' + m.name);
    if (!pay.ok) return pay;
    this.buzz([30, 30, 60]);
    this.setState({ squad: this.state.squad.concat([Object.assign({}, m, { fresh: true })]),
      market: { week: s.seasonP + s.division * 10, list: list.filter((x) => x.id !== id) },
      trainLog: m.name + ' rejoint le club pour ' + m.price + ' jetons' });
    return { ok: true, price: m.price };
  },

  // Vendre : 60 % de la valeur. Un titulaire ne se vend pas tant qu'il est dans le onze :
  // la règle vivait seulement dans l'écran Mon Club, l'app téléphone ne la connaissait pas.
  sellInfo(p) {
    const s = this.state;
    if (!p) return { can: false, why: 'Joueur introuvable', price: 0 };
    const price = Math.round(this.profile(p).value * 0.6);
    const why = s.match && !s.match.done ? 'Impossible pendant un match'
      : s.squad.length <= 12 ? 'Effectif minimum atteint (12 joueurs)'
      : this.pickXI(s.formation).some((x) => x.id === p.id) ? 'Titulaire : sors-le du onze pour le vendre' : '';
    return { can: !why, why, price };
  },

  sellPlayer(id) {
    const s = this.state;
    const p = s.squad.find((x) => x.id === id);
    const info = this.sellInfo(p);
    if (!info.can) return { ok: false, why: info.why };
    const price = info.price;
    this.buzz(25);
    // les compétences du joueur vendu retournent en réserve : elles t'appartiennent (§19)
    const inv = (s.skillInv || []).map((k) => (k.on === id ? Object.assign({}, k, { on: null }) : k));
    this.setState({ squad: s.squad.filter((x) => x.id !== id), sel: null, skillInv: inv,
      trainLog: p.name + ' vendu pour ' + price + ' jetons' });
    this.earn(price, 'vente', 'Vente de ' + p.name);
    if (p.base != null && price > p.base) this.bumpQuest('sell', 1);
    else if (price > this.valueOf(Object.assign({}, p, { plv: 1 }))) this.bumpQuest('sell', 1);
    return { ok: true, price };
  }
};

// LinkFoot : Progression du club : niveaux, missions, suites de match, saison, vieillissement (§70, §72).
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
const Progression = {
  levelNeed(l) { return 300 + l * 100; },

  addXp(st, gain) {
    let xp = st.xp + gain, level = st.level, bal = 0, queue = st.freeQueue.slice(), ups = [];
    while (xp >= this.levelNeed(level)) {
      xp -= this.levelNeed(level); level++;
      bal += 100 + level * 20;
      // un pack offert tous les 5 niveaux, pris dans la vraie liste des packs
      const key = level % 5 === 0 ? 'linkfoot' : null;   // §10 : un seul pack
      if (key) queue.push('linkfoot');
      // ce que ce niveau débloque, dit une seule fois, au moment où ça arrive
      const opened = this.unlocksAt(level);
      ups.push({ level, text: '+' + (100 + level * 20) + ' jetons' + (key ? ' + ' + this.packName(key) + ' offert' : '') + (opened.length ? ' · débloque ' + opened.join(', ') : '') });
    }
    return { xp, level, bonusBal: bal, freeQueue: queue, ups };
  },

  // Ce que le niveau `l` ouvre : lu dans les paliers, jamais écrit en dur deux fois.
  unlocksAt(l) {
    const G = this.GATES(), out = [];
    G.staff.forEach((n, i) => { if (n === l && i > 0) out.push('staff niveau ' + i); });
    G.stade.forEach((n, i) => { if (n === l && i > 0) out.push(this.STADES()[i].name); });
    G.academy.forEach((n, i) => { if (n === l && i > 0) out.push(this.ACADEMIES()[i].name); });
    this.PACK_DEFS().forEach((d) => { if ((d.req || 0) === l && l > 0) out.push(d.name); });
    // §8 : certains paliers de club ouvrent des quêtes plus ambitieuses
    if (l === 5) out.push('quêtes de palier 3');
    if (l === 10) out.push('quêtes de palier 4');
    if (l === 15) out.push('quêtes de palier 5');
    return out;
  },

  // Les statistiques d'un joueur, match après match : matchs joués, buts, passes
  // décisives, et la somme des notes (la moyenne se calcule à l'affichage).
  ajouterCarriere(c, stat) {
    const x = Object.assign({ m: 0, b: 0, pd: 0, n: 0 }, c || {});
    return { m: x.m + 1, b: x.b + (stat.goals || 0), pd: x.pd + (stat.assists || 0), n: Math.round((x.n + (stat.rating || 6)) * 10) / 10 };
  },

  carriereLigne(p) {
    const c = p.carriere;
    if (!c || !c.m) return 'Aucun match joué';
    return c.m + ' match' + (c.m > 1 ? 's' : '') + ' · ' + c.b + ' but' + (c.b > 1 ? 's' : '') + ' · ' + c.pd + ' passe' + (c.pd > 1 ? 's' : '')
      + ' décisive' + (c.pd > 1 ? 's' : '') + ' · note moyenne ' + (c.n / c.m).toFixed(1).replace('.', ',');
  },

  // Qui a marqué, qui a fait la passe, lu dans le fil du match. Les quêtes, les
  // pronostics « X marque » et l'XP des joueurs en dépendent (§19). Une seule lecture
  // pour l'app et pour l'écran Mon Club, qui ne les relevait pas du tout.
  buteursDuMatch(log, xi) {
    const scorers = [], assisters = [], idDe = {};
    (xi || []).forEach((p) => { idDe[p.name] = p.id; });
    (log || []).filter((l) => l.k === 'G' && l.s === 'H').forEach((l) => {
      // le moteur dit qui a marqué et qui a donné la passe (un but contre son camp : personne)
      if (l.by !== undefined) {
        if (l.by != null && idDe[l.by] != null) scorers.push(idDe[l.by]);
        if (l.as != null && idDe[l.as] != null) assisters.push(idDe[l.as]);
        return;
      }
      // un fil plus ancien, sans ces champs : on lit la phrase
      (xi || []).forEach((p) => {
        if (l.text.indexOf('BUT ! ' + p.name) >= 0) scorers.push(p.id);
        else if (l.text.indexOf('servi par ' + p.name) >= 0 || l.text.indexOf('sur un centre de ' + p.name) >= 0) assisters.push(p.id);
      });
    });
    return { scorers, assisters };
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
    // §6, §19, §20 : chaque joueur du onze gagne de l'XP selon son temps de jeu et
    // sa performance. C'est le seul chemin de progression d'un joueur : jouer.
    // L'argent ne peut pas remplacer ces lignes.
    const grown = [];
    squad = squad.map((p) => {
      const i = mt.xi.findIndex((x) => x.id === p.id);
      if (i < 0) return p;
      const stat = {
        // un remplacé ou un entrant n'a pas joué 90 minutes (direct.js, joueursDuMatch)
        min: mt.xi[i].min != null ? mt.xi[i].min : 90,
        goals: (mt.scorers || []).filter((id) => id === p.id).length,
        assists: (mt.assisters || []).filter((id) => id === p.id).length,
        rating: mt.rat && mt.rat.H ? mt.rat.H[i] : 6
      };
      const gain = this.matchXp(p, stat);
      const up = this.addPlayerXp(p, gain);
      if (up.ups.length) grown.push(p.name + ' niveau ' + up.plv + (up.ups[up.ups.length - 1].capped ? ' (potentiel atteint)' : ''));
      // §18 RÉSULTAT DU MATCH → STATISTIQUES DU JOUEUR → XP : les chiffres du match
      // restent sur le joueur (matchs, buts, passes, notes), et sa fiche les montre
      return Object.assign({}, p, { plv: up.plv, pxp: up.pxp, st: up.st, ovr: up.ovr, carriere: this.ajouterCarriere(p.carriere, stat) });
    });
    if (grown.length) prog = grown.slice(0, 2).join(' · ');
    squad = this.applyFitness(squad, mt, null);
    const F = this.finances(st, res); const inv = Object.assign({}, st.inv || {}); if (win) { const drop = ['energie', 'motivation', 'pressing', 'bloc', 'contre', 'finition', 'up_VIT', 'up_TIR', 'up_PAS', 'up_DÉF'][this.rand(0, 9)]; inv[drop] = (inv[drop] || 0) + 1; }
    const L = this.addXp(st, xpGain);
    // §7, §29 : tout ce qui entre passe par le journal. Le match n'est pas plafonné
    // (il coûte du temps réel), mais il est tracé comme le reste : la prime du
    // résultat et le bonus de niveau entraient au solde sans laisser de ligne, si bien
    // que l'écran Finances ne pouvait pas expliquer le solde.
    if (mt.reward) this.logMoney(mt.reward, 'Match : prime de ' + (win ? 'victoire' : res === 'd' ? 'nul' : 'défaite'));
    this.logMoney(F.net, 'Match : recette ' + F.gate + ', salaires −' + F.wages);
    if (bonus) this.logMoney(bonus, 'Série de ' + winStreak + ' victoires');
    if (L.bonusBal) this.logMoney(L.bonusBal, 'Niveau ' + L.level + ' atteint');
    const patch = { nextAdv: 0, winStreak, missions, squad, inv, lastFin: 'Recette ' + F.gate + ' · salaires −' + F.wages + ' · net ' + (F.net >= 0 ? '+' : '') + F.net + ' jetons', coachAdvice: null, xp: L.xp, level: L.level, freeQueue: L.freeQueue, balance: st.balance + bonus + L.bonusBal + F.net,
      lastGain: '+' + xpGain + ' XP' + (bonus ? ' · série de ' + winStreak + ' victoires x' + mult + ' (+' + bonus + ' jetons)' : '') + (prog ? ' · ' + prog : '') };
    let over = L.ups.length ? { title: 'NIVEAU ' + L.level + ' !', sub: L.ups.map((u) => 'Niveau ' + u.level + ' : ' + u.text).join(' · ') } : null;
    // §22 la division : seul le match prévu au calendrier compte. Un amical ne fait
    // avancer ni le championnat ni la saison (il la faisait avancer avant, sans compter
    // dans le classement). La journée jouée, les deux autres matchs le sont aussi.
    let fin = null;
    if (!mt.friendly) {
      const j = this.journeeJouee(this.divisionCourante(), mt.hs, mt.as);
      this.setState({ league: j.league });
      patch.seasonP = j.league.day;
      if (j.over) fin = j.table;
    } else patch.seasonP = st.seasonP || 0;
    if (fin) {
      const R = this.DIVISION_RULES();
      const tbl = fin, rank = tbl.findIndex((c) => c.me) + 1, last = tbl.length;
      // le centre de formation sort un jeune à chaque fin de saison
      patch.squad = this.ageSquad(patch.squad || st.squad);   // §70 une saison de plus pour tout le monde
      const yg = this.youthPlayer(st);
      let ygTxt = '';
      if (yg) { patch.squad = (patch.squad || st.squad).concat([yg]); patch.youth = (st.youth || []).concat([yg.id]); ygTxt = ' Le centre sort ' + yg.name + ' (' + yg.pos + ' ' + yg.ovr + ', potentiel ' + yg.pot + ').'; }
      if (rank <= R.up && st.division > R.top) { patch.division = st.division - 1; patch.balance += 500; this.logMoney(500, 'Promotion en division ' + patch.division); patch.freeQueue = patch.freeQueue.concat(['linkfoot']); over = { title: 'PROMU EN DIVISION ' + patch.division + ' !', sub: 'Fin de saison : ' + rank + 'e. +500 jetons et un LinkFoot Pack. Les adversaires seront plus forts.' + ygTxt }; }
      else if (rank > last - R.down && st.division < R.bottom) { patch.division = st.division + 1; over = { title: 'RELÉGUÉ EN DIVISION ' + patch.division, sub: 'Fin de saison : ' + rank + 'e sur ' + last + '. Les adversaires seront plus faibles, mais la recette du match baisse.' + ygTxt }; }
      else over = over || { title: 'FIN DE SAISON', sub: rank + 'e de la division ' + st.division + '. Termine dans les ' + R.up + ' premiers pour monter, évite la dernière place.' + ygTxt };
      // la saison finie reste lisible ; la suivante repart d'un nouveau calendrier
      patch.lastSeason = { saison: st.saison || 1, division: st.division, rank, clubs: last,
        table: tbl.map((c) => ({ club: c.club, me: c.me, pts: c.pts, w: c.w, d: c.d, l: c.l, gd: c.gd })) };
      patch.saison = (st.saison || 1) + 1; patch.league = null;
      patch.seasonP = 0; patch.record = { w: 0, d: 0, l: 0 };
    }
    if (over) { patch.levelUp = over; this.buzz([60, 40, 60, 40, 200]); }
    // §8, §19 : le match fait avancer les quêtes. Elles lisent les mêmes chiffres que le rapport.
    this.questsAfterMatch(mt, Object.assign({}, st, { squad: patch.squad || squad, winStreak: st.winStreak }));
    // §9 : les pronostics se règlent sur le match qui vient d'être joué, jamais sur un match réel.
    const pr = this.settlePronos(mt);
    if (pr.lines.length) patch.lastProno = pr.lines;
    // earn() vient de verser les gains au solde, mais `patch.balance` a été calculé
    // avant : sans cette ligne, l'appelant écrasait le solde et les pronostics gagnés
    // n'étaient jamais payés, alors que le journal les affichait.
    if (pr.won) patch.balance += pr.won;
    if (patch.division && patch.division < st.division) this.bumpQuest('division', 1);
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
      S('ailes', 'Couloirs', 'Jeu sur les ailes', '4-3-3', 4, { width: 2, cross: 2, dribble: 1, fullbacks: 1 }, 'Débordements et centres : on étire le bloc adverse sur toute la largeur.', 'Idéal avec des ailiers rapides', ['blocbas', 'bus', 'catenaccio'], ['contre', 'blocmed'], 'wide'),
      S('surcharge', 'Couloirs', 'Surcharge et renversement', '4-3-3', 4, { width: 2, pass: 1, patience: 1, overload: 1, fullbacks: 2 }, 'On attire l’adversaire d’un côté à 5 contre 3, puis on renverse vers un ailier seul de l’autre côté.', 'Très utilisé dans le foot moderne', ['homme', 'blocmed', 'catenaccio'], ['gegen', 'contre'], 'wide'),
      // §5 du cahier du match : le jeu axial, l'inverse du jeu sur les ailes
      S('axial', 'Couloirs', 'Jeu axial', '4-2-3-1', 4, { width: 0, cross: 0, pass: 1, behind: 1, dribble: 1, fullbacks: 0 }, 'On attaque par l’axe : passes entre les lignes, appels dans l’intervalle des centraux, presque pas de centres.', 'Les équipes à meneur de jeu', ['blochaut', 'homme', 'ailes'], ['blocbas', 'catenaccio', 'bus'], 'mid'),
      S('pistons', 'Couloirs', 'Pistons en 3-5-2', '3-5-2', 4, { width: 2, cross: 2, behind: 1, fullbacks: 2, line: 1 }, 'Trois défenseurs centraux et deux pistons qui font tout le couloir : largeur et solidité.', 'Système favori de nombreux entraîneurs italiens', ['blocbas', 'bus', 'kick'], ['contre', 'homme'], 'wide')
    ];
    this._styles = {};
    list.forEach((x) => { this._styles[x.k] = x; });
    this._styleList = list;
    return this._styles;
  },

  // La liste des styles, dans l'ordre d'affichage.
  styleList() { this.styles(); return this._styleList; },

  // ---------- §17 TACTIQUE : les réglages, une seule fois pour tous les écrans ----------
  // L'écran Mon Club les écrivait en ligne, avec ses propres libellés : l'app téléphone
  // n'avait donc aucun écran Tactique, et rien n'empêchait deux écrans de régler la même
  // chose différemment. Les règles et les libellés sont ici (§3). Chaque réglage listé
  // est lu par le moteur ; test/leviers.js vérifie qu'il change vraiment le match.
  // §5 et §6 du cahier du match : 4-2-4 pour forcer en fin de match, 3-4-3 et 4-1-4-1 en plus
  FORMATIONS() { return ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2', '4-2-4', '3-4-3', '4-1-4-1']; },

  // Combien de joueurs par ligne (gardien, défense, milieu, attaque), lu dans les places.
  lignesFormation(f) {
    const C = this.formCoords(f);
    return C ? ['GB', 'DEF', 'MIL', 'ATT'].map((l) => (C[l] || []).length) : null;
  },

  // [clé lue par le moteur, libellé, options dans l'ordre des valeurs 0, 1, 2…]
  TAC_GROUPS() {
    return [
      { title: 'Avec le ballon', color: '#2ECC71', items: [
        ['width', 'Largeur', ['Étroite', 'Normale', 'Large']],
        ['tempo', 'Tempo', ['Lent', 'Normal', 'Rapide']],
        ['pass', 'Style de passes', ['Courtes', 'Mixtes', 'Directes']],
        ['cross', 'Centres', ['Rasants', 'Mixtes', 'Aériens']],
        ['behind', 'Jeu dans le dos de la défense', ['Non', 'Oui']],
        ['dribble', 'Dribbles', ['Normal', 'Plus de dribbles']],
        ['longshot', 'Frappes de loin', ['Rarement', 'Souvent']],
        ['patience', 'Patience dans la construction', ['Normale', 'Travailler le ballon']]
      ] },
      { title: 'Sans le ballon', color: '#5ED6C0', items: [
        ['line', 'Ligne défensive', ['Basse', 'Normale', 'Haute']],
        ['engage', 'Ligne d’engagement', ['Basse', 'Moyenne', 'Haute']],
        ['press', 'Intensité du pressing', ['Faible', 'Normale', 'Intense', 'Très intense']],
        ['trap', 'Piège du hors-jeu', ['Non', 'Oui']],
        ['tackle', 'Tacles', ['Prudents', 'Normaux', 'Rugueux']]
      ] },
      { title: 'Organisation', color: '#C39BFF', items: [
        ['mark', 'Marquage', ['En zone', 'Mixte', 'Individuel']],
        ['fullbacks', 'Latéraux', ['Restent', 'Montent', 'Inversés']],
        ['overload', 'Surcharger un côté', ['Non', 'Gauche', 'Axe', 'Droite']],
        ['ptrap', 'Pièges de pressing', ['Aucun', 'Sur les côtés', 'Dans l’axe']],
        ['timewaste', 'Gagner du temps quand on mène', ['Non', 'Oui']]
      ] },
      { title: 'Transitions', color: '#4FA8E8', items: [
        ['lost', 'À la perte du ballon', ['Contre-pressing', 'Se replacer']],
        ['won', 'À la récupération', ['Contre-attaque', 'Construire']],
        ['gk', 'Relance du gardien', ['Courte', 'Longue']]
      ] },
      { title: 'Coups de pied arrêtés', color: '#F5C84C', items: [
        ['corners', 'Corners', ['1er poteau', '2e poteau', 'Point de penalty', 'À la remise']],
        ['freekicks', 'Coups francs', ['Frappe directe', 'Centre', 'Combinaison']]
      ] }
    ];
  },

  setFormation(f) {
    if (this.FORMATIONS().indexOf(f) < 0) return { ok: false, why: 'Formation inconnue' };
    this.setState({ formation: f, roles: {}, duties: {}, sel: null });
    return { ok: true };
  },

  // Appliquer un style : ses consignes et sa mentalité, et sa formation sauf si on
  // demande de garder la sienne (les raccourcis de l'écran Tactique la gardent).
  applyStyle(k, opts) {
    const x = this.styles()[k];
    if (!x) return { ok: false, why: 'Style inconnu' };
    const patch = { preset: k, mentality: x.m, tac: Object.assign({}, this.state.tac, x.tac) };
    if (!opts || opts.formation !== false) Object.assign(patch, { formation: x.form, roles: {}, duties: {}, sel: null });
    this.setState(patch);
    return { ok: true };
  },

  // Toucher à une consigne ou à la mentalité, c'est quitter le style : plus de bonus
  // ni de malus de confrontation (matchup), et l'écran le dit.
  setMentality(i) {
    const m = Math.round(i);
    if (!(m >= 0 && m <= 6)) return { ok: false, why: 'Mentalité hors limites' };
    this.setState({ mentality: m, preset: 'perso' });
    return { ok: true };
  },

  setConsigne(k, v) {
    let it = null;
    this.TAC_GROUPS().forEach((g) => g.items.forEach((x) => { if (x[0] === k) it = x; }));
    if (!it) return { ok: false, why: 'Réglage inconnu' };
    if (!(v >= 0 && v < it[2].length && v === Math.round(v))) return { ok: false, why: 'Valeur hors limites' };
    this.setState({ tac: Object.assign({}, this.state.tac, { [k]: v }), preset: 'perso' });
    return { ok: true };
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
      '5-3-2': { GB: [[50, 88]], DEF: [[8, 64], [29, 72], [50, 75], [71, 72], [92, 64]], MIL: [[26, 48], [50, 52], [74, 48]], ATT: [[36, 20], [64, 20]] },
      '4-2-4': { GB: [[50, 88]], DEF: [[14, 68], [38, 73], [62, 73], [86, 68]], MIL: [[36, 52], [64, 52]], ATT: [[12, 27], [38, 18], [62, 18], [88, 27]] },
      '3-4-3': { GB: [[50, 88]], DEF: [[25, 72], [50, 75], [75, 72]], MIL: [[10, 48], [37, 53], [63, 53], [90, 48]], ATT: [[20, 24], [50, 17], [80, 24]] },
      '4-1-4-1': { GB: [[50, 88]], DEF: [[14, 68], [38, 73], [62, 73], [86, 68]], MIL: [[12, 44], [37, 46], [50, 60], [63, 46], [88, 44]], ATT: [[50, 16]] }
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
    const need = this.lignesFormation(formation) || this.lignesFormation('4-3-3');
    const slots = [];
    ['GB', 'DEF', 'MIL', 'ATT'].forEach((pos, k) => { for (let i = 0; i < need[k]; i++) slots.push({ line: pos, slot: pos + i }); });
    const byId = {}; s.squad.forEach((p) => { byId[p.id] = p; });
    const pool = s.squad.filter((p) => !p.inj).slice().sort((a, b) => b.ovr - a.ovr);
    const used = new Set(), asg = {};
    // un joueur choisi pour le onze n'y joue pas s'il s'est blessé depuis : le poste repasse en automatique
    slots.forEach((sl) => { const id = lineup[sl.slot]; if (id != null && byId[id] && !byId[id].inj && !used.has(id)) { asg[sl.slot] = byId[id]; used.add(id); } });
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

  // §2 composition. La règle vivait dans l'écran Mon Club seulement : l'app téléphone
  // jouait toujours le onze automatique, sans que le directeur sportif puisse choisir.
  // Mettre un joueur à un poste : s'il était titulaire, les deux échangent leurs places ;
  // sinon le titulaire retourne sur le banc.
  assignSlot(slot, pid) {
    const s = this.state;
    if (s.match && !s.match.done) return { ok: false, why: 'Pendant le match, on change par les remplacements' };
    const p = s.squad.find((x) => x.id === pid);
    if (!p) return { ok: false, why: 'Joueur introuvable' };
    if (p.inj) return { ok: false, why: p.name + ' est blessé' };
    const lu = {}; this.pickXI(s.formation).forEach((x) => { lu[x.slot] = x.id; });
    if (!(slot in lu)) return { ok: false, why: 'Poste inconnu' };
    const cur = lu[slot], other = Object.keys(lu).find((k) => lu[k] === pid);
    if (other) lu[other] = cur;
    lu[slot] = pid;
    this.buzz(15);
    this.setState({ lineup: lu, sel: null });
    return { ok: true };
  },

  // Le onze redevient automatique : les meilleurs à leur poste.
  compositionAuto() { this.setState({ lineup: {}, sel: null }); return { ok: true }; },

  // Qui peut jouer à ce poste : tout l'effectif sauf le titulaire, le meilleur d'abord
  // une fois la pénalité hors poste retirée. Un blessé est listé, mais refusé.
  candidatsPoste(slot) {
    const s = this.state, xi = this.pickXI(s.formation), cur = xi.find((p) => p.slot === slot);
    if (!cur) return [];
    const inXI = new Set(xi.map((p) => p.id));
    return s.squad.filter((p) => p.id !== cur.id).map((p) => {
      const pen = this.penalty(p.pos, cur.line);
      return { p, pen, eff: Math.max(30, p.ovr - pen), titulaire: inXI.has(p.id), can: !p.inj,
        why: p.inj ? 'Blessé, ' + p.inj + ' match' + (p.inj > 1 ? 's' : '') : '' };
    }).sort((a, b) => (b.can - a.can) || (b.eff - a.eff));
  },

  ROLE_OPTS(line, slot, formation) {
    if (line === 'GB') return ['Gardien classique', 'Gardien libéro'];
    if (line === 'DEF') {
      const n = (this.lignesFormation(formation) || [1, 4])[1];
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

  // Le joueur tel que le moteur le reçoit : statistiques (moins la pénalité hors poste),
  // énergie, forme, moral, compétences, pied, rôle et consigne. Le coup d'envoi et les
  // remplacements passent tous deux par ici. Un remplaçant entrait sans ses compétences,
  // sa forme, son moral ni son pied : ses cartes ne comptaient plus une fois sur le terrain.
  joueurMoteur(p) {
    const s = this.state, st = {};
    this.cardStats(p).forEach((q) => { st[q.l] = Math.max(25, q.v - Math.round((p.pen || 0) * 0.6)); });
    return { name: p.name, ovr: p.ovr, st, energy: p.energy, form: p.form != null ? p.form : 70, morale: p.morale != null ? p.morale : 72,
      skills: this.skillsOf(p), foot: this.profile(p).foot, wf: this.profile(p).wf,
      role: s.roles[p.slot] || this.ROLE_OPTS(p.line, p.slot, s.formation)[0], duty: s.duties[p.slot] || 'Soutien' };
  },

  engineCfg(opp, xi, oxi, obench) {
    const s = this.state, S = this.styles(), st = S[opp.style] || S.equilibre;
    const coordsFrom = (form) => { const C = this.formCoords(form), out = []; ['GB', 'DEF', 'MIL', 'ATT'].forEach((l) => (C[l] || []).forEach(([fx, fy]) => out.push({ fx, fy, line: l }))); return out; };
    const statsOf = (p) => { const o = {}; this.cardStats(p).forEach((q) => { o[q.l] = Math.max(25, q.v - Math.round((p.pen || 0) * 0.6)); }); return o; };
    // §24 : l'avantage tactique préparé (plan, séance vidéo) s'ajoute pour UN match,
    // puis disparaît. C'est ce qui donne du poids à la préparation.
    const adv = (s.preset === 'perso' ? 0 : this.matchup(s.preset, opp.style)) + (s.nextAdv || 0);
    const syn = this.synergy(xi);
    const coh = Math.min(1.2, Math.max(0.7, 1 - xi.filter((p) => p.pen).length * 0.06 - (s.preset === 'perso' ? 0.04 : 0) - xi.filter((p) => p.fresh).length * 0.03 + (s.cohBonus || 0) + syn.score));
    // le nom du club est celui du directeur sportif ; l'avantage du terrain va à celui
    // qui reçoit selon le calendrier (§22). Sans calendrier, le club reçoit, comme avant.
    const H = { club: s.clubName || 'FC TonPseudo', sbonus: this.staffLv('adjoint') * 0.8, coach: this.COACHES().find((c) => c.id === (s.coach || 'tacticien')), coh, tac: s.tac, ment: s.mentality, adv, coords: coordsFrom(s.formation), home: !opp.exterieur, players: xi.map((p) => this.joueurMoteur(p)) };
    const A = { club: opp.club, home: !!opp.exterieur, tac: st.tac, ment: st.m, adv: -adv, coords: coordsFrom(st.form), players: oxi.map((p) => ({ name: p.name, ovr: p.ovr, st: statsOf(p), skills: this.skillsOf(p), foot: this.profile(p).foot, wf: this.profile(p).wf })), bench: (obench || []).map((p) => ({ name: p.name, ovr: p.ovr, st: statsOf(p) })) };
    return { sides: { H, A } };
  }
};

// LinkFoot : la colonne vertébrale de la progression (§70, §72, §81).
// Un seul axe commande tout : le niveau de club. Les cartes, le staff, le stade,
// le centre de formation et les packs lisent leurs paliers ici, et nulle part ailleurs.
// Un bouton qui refuse dit toujours pourquoi : plus aucune action morte dans l'interface.

const Tracks = {
  // Paliers de niveau de club exigés par chaque palier de chaque piste.
  // Index = le niveau que l'on veut atteindre. 0 = disponible dès le départ.
  GATES() {
    return {
      staff: [0, 2, 6, 11],                            // niveaux de staff 0 à 3
      stade: [0, 3, 7, 12, 18],                        // niveaux de stade 0 à 4
      academy: [0, 4, 9, 15],                          // niveaux de centre 0 à 3
      pack: { linkfoot: 0 }                            // §10 : un seul pack, ouvert dès le départ
    };
  },

  // Le niveau de club exigé pour atteindre `lvl` sur la piste `kind`.
  gateOf(kind, lvl) {
    const G = this.GATES()[kind];
    if (!G) return 0;
    return G[Math.max(0, Math.min(G.length - 1, lvl))] || 0;
  },

  // Verrou unique, utilisé par toutes les pistes et par les packs.
  lockOf(need) {
    const lvl = this.state.level || 1;
    return need > lvl ? { locked: true, need, why: 'Niveau de club ' + need + ' requis (tu es niveau ' + lvl + ')' } : { locked: false, need, why: '' };
  },

  // Le tableau de bord de la progression : la même forme pour toutes les pistes,
  // pour que l'interface les affiche de la même façon et dise la même chose.
  // { key, label, lvl, max, pct, nextLabel, cost, currency, lock, can, why }
  progressBoard() {
    const s = this.state, out = [];
    const row = (key, label, lvl, max, nextLabel, cost, currency, need, extra) => {
      const lock = this.lockOf(need), have = currency === 'shards' ? (s.shards || 0) : s.balance;
      const max_ = lvl >= max;
      out.push(Object.assign({
        key, label, lvl, max, pct: Math.round(lvl / max * 100), nextLabel: max_ ? null : nextLabel,
        cost: max_ ? 0 : cost, currency, locked: lock.locked && !max_,
        can: !max_ && !lock.locked && have >= cost,
        why: max_ ? 'Niveau maximum' : lock.locked ? lock.why : have < cost ? 'Il te manque ' + (cost - have) + (currency === 'shards' ? ' fragments' : ' jetons') : ''
      }, extra || {}));
    };

    const need = this.levelNeed(s.level);
    out.push({ key: 'club', label: 'Niveau de club', lvl: s.level, max: s.level + 1, pct: Math.round((s.xp / need) * 100),
      nextLabel: 'Niveau ' + (s.level + 1), cost: 0, currency: 'xp', locked: false, can: false,
      why: (need - s.xp) + ' XP avant le niveau ' + (s.level + 1), xp: s.xp, xpNeed: need });
    out.push({ key: 'division', label: 'Division', lvl: 6 - s.division, max: 5, pct: Math.round((6 - s.division) / 5 * 100),
      nextLabel: s.division > 1 ? 'Division ' + (s.division - 1) : null, cost: 0, currency: 'rang', locked: false, can: false,
      why: s.division > 1 ? 'Termine dans les 2 premiers de la division ' + s.division : 'Division maximale', division: s.division });

    this.STAFF_DEFS().forEach((d) => {
      const lv = this.staffLv(d.id);
      row('staff:' + d.id, d.label, lv, 3, d.eff[Math.min(3, lv + 1)], lv < 3 ? d.cost[lv] : 0, 'tokens', this.gateOf('staff', lv + 1), { eff: d.eff[lv], wage: d.wage[lv] });
    });
    const L = this.STADES(), sl = s.stade || 0;
    row('stade', 'Stade', sl, L.length - 1, sl < L.length - 1 ? L[sl + 1].name + ' · ' + L[sl + 1].cap + ' places' : null, sl < L.length - 1 ? L[sl + 1].cost : 0, 'tokens', this.gateOf('stade', sl + 1), { name: L[sl].name, cap: L[sl].cap });
    const A = this.ACADEMIES(), al = s.academy || 0;
    row('academy', 'Centre de formation', al, A.length - 1, al < A.length - 1 ? A[al + 1].name : null, al < A.length - 1 ? A[al + 1].cost : 0, 'tokens', this.gateOf('academy', al + 1), { name: A[al].name, note: A[al].note });

    // §12, §19 : la collection de compétences est une piste de progression comme les autres
    const inv = this.state.skillInv || [];
    out.push({ key: 'skills', label: 'Compétences', lvl: inv.length, max: Math.max(12, inv.length),
      pct: Math.min(100, Math.round(inv.length / 12 * 100)),
      nextLabel: inv.filter((k) => !k.on).length + ' en réserve', cost: 0, currency: 'cartes', locked: false, can: false,
      why: inv.length ? inv.filter((k) => k.on).length + ' équipées, ' + inv.filter((k) => !k.on).length + ' en réserve' : 'Ouvre un LinkFoot Pack pour en obtenir' });

    const col = this.collection();
    out.push({ key: 'collection', label: 'Collection', lvl: col.have, max: col.total, pct: Math.round(col.have / col.total * 100),
      nextLabel: col.have < col.total ? (col.total - col.have) + ' cartes manquantes' : null, cost: 0, currency: 'cartes', locked: false, can: false,
      why: col.have >= col.total ? 'Collection complète' : 'Ouvre des packs pour compléter' });
    return out;
  },

  // Résumé d'une ligne : la même phrase partout dans l'interface.
  trackLine(t) {
    if (t.currency === 'xp') return t.why;
    if (t.currency === 'rang') return t.why;
    if (t.currency === 'cartes') return t.lvl + ' / ' + t.max + ' · ' + t.why;
    return 'Niveau ' + t.lvl + ' / ' + t.max + (t.nextLabel ? ' · suivant : ' + t.nextLabel : '') + (t.why ? ' · ' + t.why : '');
  }
};

// LinkFoot : PlayerProgression (§5, §6, §20).
// Un joueur a UN niveau, monté par l'XP. Pas de second barème.
//
// §6 : monter un joueur doit être difficile et le devenir de plus en plus.
// L'argent aide (entraînement, fragments) mais ne remplace jamais le temps de jeu :
// l'XP d'entraînement est plafonnée par jour, celle des matchs ne l'est pas.
const PlayerXP = {
  // §6 : courbe exponentielle contrôlée, calée sur l'échelle demandée.
  // Un match rapporte 35 à 70 XP selon la performance.
  //   1→2 : 60 XP (~1 match, facile)        5→6 : 112 XP (~2 matchs, facile)
  //   10→11 : 246 XP (~5 matchs, difficile) 20→21 : 1 196 XP (~24 matchs, très difficile)
  //   30→31 : 5 760 XP (~115 matchs, extrêmement difficile)
  // Atteindre le niveau 20 demande environ 6 700 XP cumulés, soit ~135 matchs joués.
  playerXpNeed(l) { return Math.round(60 * Math.pow(1.17, Math.max(1, l) - 1)); },

  playerLevel(p) { return p && p.plv ? p.plv : 1; },
  playerXp(p) { return p && p.pxp ? p.pxp : 0; },

  playerProgress(p) {
    const lvl = this.playerLevel(p), xp = this.playerXp(p), need = this.playerXpNeed(lvl);
    return { lvl, xp, need, pct: Math.round(xp / need * 100), slots: this.skillSlots(p), worn: this.equippedOn(p.id).length };
  },

  // §5 : les caractéristiques cachées. Elles ne s'affichent pas telles quelles,
  // mais chacune a un effet réel, listé en commentaire à côté.
  hiddenOf(p) {
    if (p._hid) return p._hid;
    const r = this.seedR((p.id || 1) * 15485863 + 29);
    const pr = { pot: p.pot != null ? p.pot : 0 };
    const h = {
      potReel: Math.max(p.ovr, Math.min(99, (pr.pot || p.ovr + 8) + Math.round((r() - 0.5) * 8))),  // plafond réel de progression
      regularite: Math.round(35 + r() * 60),        // variance de la note de match
      grandsMatchs: Math.round(30 + r() * 65),      // bonus face à un adversaire mieux classé
      pression: Math.round(30 + r() * 65),          // bonus dans les 15 dernières minutes serrées
      progression: Math.round(55 + r() * 70),       // multiplicateur d'XP, 100 = normal
      blessure: Math.round(20 + r() * 70),          // risque de blessure
      adaptation: Math.round(35 + r() * 60)         // perte quand il joue hors de son poste
    };
    return h;
  },

  // La traduction des attributs cachés en effets réels sur le onze (§19, §22).
  // Appliquée dans engineCfg : rien ici n'est décoratif.
  hiddenMods(p, ctx) {
    const h = this.hiddenOf(p), c = ctx || {};
    const n = (v) => (v - 65) / 100;                 // 65 = la moyenne, donc effet nul
    const m = { dec: 0, sht: 0, pas: 0, phy: 0, def: 0, pace: 0, drain: 1, varia: 1 };
    m.varia = 1.35 - h.regularite / 150;             // régulier = moins de hauts et de bas
    if (c.strongerOpp) { m.dec += n(h.grandsMatchs) * 4; m.sht += n(h.grandsMatchs) * 3; }
    if (c.closeLate) { m.dec += n(h.pression) * 4; m.sht += n(h.pression) * 3; }
    if (c.outOfPos) { const pen = (1 - h.adaptation / 100) * 5; m.dec -= pen; m.pas -= pen; m.def -= pen; }
    m.drain = 0.86 + (100 - h.blessure) / 100 * 0.1;
    return m;
  },

  injuryRisk(p) { return 0.6 + this.hiddenOf(p).blessure / 100 * 0.9; },
  xpRate(p) { return this.hiddenOf(p).progression / 100; },

  // §6 : l'XP gagnée par un joueur sur un match. Jouer rapporte ; bien jouer rapporte plus.
  matchXp(p, stat) {
    const s = stat || {};
    const base = 14 + (s.min || 90) / 90 * 10;
    const perf = (s.goals || 0) * 9 + (s.assists || 0) * 6 + Math.max(0, ((s.rating || 6) - 6) * 7);
    return Math.max(1, Math.round((base + perf) * this.xpRate(p)));
  },

  // Donner de l'XP à un joueur. Le gain s'arrête net au potentiel réel (§5, §6).
  addPlayerXp(p, gain) {
    const h = this.hiddenOf(p);
    let lvl = this.playerLevel(p), xp = this.playerXp(p) + Math.max(0, Math.round(gain));
    const ups = [];
    const stats = {}; this.cardStats(p).forEach((q) => { stats[q.l] = q.v; });
    let ovr = p.ovr;
    let guard = 0;
    while (xp >= this.playerXpNeed(lvl) && guard++ < 60) {
      xp -= this.playerXpNeed(lvl); lvl++;
      if (ovr >= h.potReel) { ups.push({ lvl, gain: null, capped: true }); continue; }
      // la montée fait progresser les statistiques qui comptent pour son poste
      const w = this.statW(p.pos), keys = Object.keys(w).sort((a, b) => w[b] - w[a]);
      const k = keys[lvl % 3];
      if (stats[k] != null && stats[k] < 99) stats[k] += 1;
      const second = keys[(lvl + 1) % keys.length];
      if (lvl % 2 === 0 && stats[second] != null && stats[second] < 99) stats[second] += 1;
      ovr = Math.min(h.potReel, Math.max(ovr, this.ovrOf(p.pos, stats)));
      ups.push({ lvl, gain: k, capped: false });
    }
    return { plv: lvl, pxp: xp, st: stats, ovr, ups };
  },

  // §19 : appliquer la montée à l'effectif, et le dire.
  grantPlayerXp(id, gain, why) {
    const s = this.state, p = s.squad.find((x) => x.id === id);
    if (!p) return { ok: false, why: 'Joueur introuvable' };
    const res = this.addPlayerXp(p, gain);
    const squad = s.squad.map((x) => (x.id === id ? Object.assign({}, x, { plv: res.plv, pxp: res.pxp, st: res.st, ovr: res.ovr }) : x));
    const up = res.ups.length;
    this.setState({ squad, trainLog: p.name + ' +' + Math.round(gain) + ' XP' + (why ? ' (' + why + ')' : '')
      + (up ? ' · niveau ' + res.plv + (res.ups[up - 1].capped ? ' · potentiel atteint' : '') : '') });
    if (up) { this.buzz([30, 30, 60]); this.bumpQuest('levelup', up); }
    return { ok: true, lvl: res.plv, ups: res.ups };
  },

  // L'entraînement payé en fragments : il accélère, il ne remplace pas (§6).
  // Plafonné par jour pour que l'argent ne devienne jamais un raccourci (§29).
  SHARD_XP() { return { cost: 20, xp: 35, perDay: 6 }; },

  shardTrainInfo(p) {
    const s = this.state, D = this.SHARD_XP();
    const used = (s.caps && s.caps.shardTrain) || 0;
    const poor = (s.shards || 0) < D.cost;
    const capped = used >= D.perDay;
    const none = this.sessions() <= 0;
    return { cost: D.cost, xp: Math.round(D.xp * this.xpRate(p)), used, perDay: D.perDay, sessions: this.sessions(),
      can: !poor && !capped && !none,
      why: capped ? 'Limite du jour atteinte (' + D.perDay + ' séances intensives)'
        : none ? this.trainInfo().why
        : poor ? 'Il te manque ' + (D.cost - (s.shards || 0)) + ' fragments' : '' };
  },

  shardTrain(id) {
    const s = this.state, p = s.squad.find((x) => x.id === id);
    if (!p) return { ok: false, why: 'Joueur introuvable' };
    const info = this.shardTrainInfo(p);
    if (!info.can) return { ok: false, why: info.why };
    // une séance intensive consomme aussi une séance : c'est la même ressource partout
    if (!this.takeSession()) return { ok: false, why: this.trainInfo().why };
    this.setState({ shards: (s.shards || 0) - info.cost, caps: Object.assign({}, this.state.caps, { shardTrain: info.used + 1 }) });
    return this.grantPlayerXp(id, info.xp, 'séance intensive');
  }
};

// LinkFoot : QuestEngine et EconomyEngine (§7, §8, §29).
//
// §7 : l'argent doit être difficile à obtenir et chaque dépense doit compter.
// §29 : aucune source ne doit pouvoir produire une quantité infinie d'argent,
// donc chaque gain passe par `earn`, qui applique un plafond quotidien et
// écrit une ligne dans le journal. Rien n'arrive au solde par un autre chemin.
const Quests = {
  // Plafonds quotidiens, par source. `null` = pas de plafond (le match en est un :
  // il coûte du temps réel, donc il s'auto-limite).
  CAPS() {
    return { quest: 900, pack: null, match: null, prono: 400, mission: 600, vente: null, connexion: null, total: 2600 };
  },

  // Les récompenses de connexion : sept jours, dont deux packs. Elles passaient par
  // l'écran, sans plafond ni journal ; elles passent par earn() comme tout le reste (§7).
  DAILY_REWARDS() { return [100, 150, 200, 'linkfoot', 300, 400, 'linkfoot']; },

  claimDaily() {
    const s = this.state, D = this.DAILY_REWARDS(), i = s.dayStreak || 0;
    if (s.dayClaimed) return { ok: false, why: 'Déjà récupérée aujourd’hui' };
    if (i >= D.length) return { ok: false, why: 'Série de connexion complète' };
    const rw = D[i];
    this.setState({ dayClaimed: true, dayStreak: i + 1,
      freeQueue: typeof rw === 'string' ? (s.freeQueue || []).concat([rw]) : s.freeQueue });
    const got = typeof rw === 'number' ? this.earn(rw, 'connexion', 'Connexion, jour ' + (i + 1)) : null;
    this.buzz([30, 30, 60]);
    return { ok: true, reward: rw, got: got ? got.given : 0 };
  },

  // Les missions du jour. Même règle : la récompense passe par earn(), donc par le
  // plafond « mission » qui existait déjà mais que l'écran contournait.
  claimMission(id) {
    const s = this.state, m = (s.missions || []).find((x) => x.id === id);
    if (!m) return { ok: false, why: 'Mission inconnue' };
    if (m.claimed) return { ok: false, why: 'Déjà récupérée' };
    if (m.prog < m.goal) return { ok: false, why: 'Objectif non atteint (' + m.prog + ' sur ' + m.goal + ')' };
    const L = this.addXp(s, m.xp);
    this.setState({ missions: s.missions.map((x) => (x.id === id ? Object.assign({}, x, { claimed: true }) : x)),
      xp: L.xp, level: L.level, freeQueue: L.freeQueue, balance: s.balance + L.bonusBal,
      levelUp: L.ups.length ? { title: 'NIVEAU ' + L.level + ' !', sub: L.ups.map((u) => 'Niveau ' + u.level + ' : ' + u.text).join(' · ') } : s.levelUp });
    if (L.bonusBal) this.logMoney(L.bonusBal, 'Niveau ' + L.level + ' atteint');
    const got = this.earn(m.reward, 'mission', 'Mission : ' + m.label);
    this.buzz([30, 30, 60]);
    return { ok: true, got: got.given, capped: got.capped };
  },

  // §29 : le journal des transactions. 60 lignes gardées, assez pour une vérification
  // sans gonfler la sauvegarde.
  logMoney(amount, label) {
    const s = this.state, led = (s.ledger || []).slice(0, 59);
    led.unshift({ at: Date.now(), a: Math.round(amount), l: label });
    this.setState({ ledger: led });
    return led;
  },

  dayKey() { const d = new Date(); return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate(); },

  // Le seul chemin par lequel de l'argent entre dans le club.
  earn(amount, source, label) {
    const s = this.state, C = this.CAPS();
    const caps = Object.assign({}, s.caps);
    if (caps.day !== this.dayKey()) { Object.keys(caps).forEach((k) => { if (k !== 'day') caps[k] = 0; }); caps.day = this.dayKey(); }
    let give = Math.max(0, Math.round(amount));
    const capped = [];
    const lim = C[source];
    if (lim != null) {
      const used = caps[source] || 0;
      if (used + give > lim) { give = Math.max(0, lim - used); capped.push(source); }
      caps[source] = (caps[source] || 0) + give;
    }
    if (C.total != null) {
      const usedT = caps.total || 0;
      if (usedT + give > C.total) { give = Math.max(0, C.total - usedT); capped.push('total'); }
      caps.total = usedT + give;
    }
    this.setState({ balance: s.balance + give, caps });
    if (give) this.logMoney(give, label || source);
    return { given: give, asked: Math.round(amount), capped: capped.length ? capped : null };
  },

  // Dépenser. Refuse clairement plutôt que de ne rien faire.
  spend(amount, label) {
    const s = this.state, cost = Math.round(amount);
    if (s.balance < cost) return { ok: false, why: 'Il te manque ' + (cost - s.balance) + ' jetons' };
    this.setState({ balance: s.balance - cost });
    this.logMoney(-cost, label || 'dépense');
    return { ok: true };
  },

  // §8 : le catalogue de quêtes. `kind` est la clé bumpée par le jeu,
  // `goal` l'objectif, `reward` l'argent et `xp` l'XP de club.
  QUEST_DEFS() {
    return [
      { id: 'q_win3', kind: 'win', goal: 3, label: 'Gagner 3 matchs', reward: 220, xp: 80, tier: 1 },
      { id: 'q_assist5', kind: 'assist', goal: 5, label: 'Délivrer 5 passes décisives', reward: 260, xp: 90, tier: 2 },
      { id: 'q_lowscorer', kind: 'lowGoal', goal: 1, label: 'Marquer avec un joueur de niveau inférieur à 10', reward: 300, xp: 110, tier: 2 },
      { id: 'q_levelup', kind: 'levelup', goal: 3, label: 'Faire progresser un joueur de 3 niveaux', reward: 280, xp: 100, tier: 2 },
      { id: 'q_poss60', kind: 'poss60', goal: 1, label: 'Gagner un match avec 60 % de possession', reward: 320, xp: 120, tier: 3 },
      { id: 'q_streak3', kind: 'streak3', goal: 1, label: 'Remporter 3 matchs consécutifs', reward: 400, xp: 150, tier: 3 },
      { id: 'q_rotate5', kind: 'rotate', goal: 5, label: 'Faire jouer 5 joueurs différents', reward: 180, xp: 70, tier: 1 },
      { id: 'q_div', kind: 'division', goal: 1, label: 'Monter d’une division', reward: 700, xp: 300, tier: 4 },
      { id: 'q_grow20', kind: 'reach20', goal: 1, label: 'Amener un joueur normal au niveau 20', reward: 900, xp: 400, tier: 5 },
      { id: 'q_pack', kind: 'pack', goal: 3, label: 'Ouvrir 3 LinkFoot Packs', reward: 150, xp: 60, tier: 1 },
      { id: 'q_equip', kind: 'equip', goal: 2, label: 'Équiper 2 compétences', reward: 200, xp: 80, tier: 1 },
      { id: 'q_clean', kind: 'clean', goal: 2, label: 'Garder 2 fois sa cage inviolée', reward: 260, xp: 90, tier: 2 },
      { id: 'q_sell', kind: 'sell', goal: 1, label: 'Vendre un joueur plus cher que sa valeur de départ', reward: 240, xp: 80, tier: 3 },
      { id: 'q_youth', kind: 'youth', goal: 1, label: 'Faire jouer un joueur du centre de formation', reward: 300, xp: 110, tier: 3 }
    ];
  },

  // Les quêtes actives : quatre à la fois, choisies selon le niveau du club,
  // pour que les objectifs restent atteignables sans devenir une rente (§7).
  activeQuests() {
    const s = this.state;
    if (s.quests && s.quests.length) return s.quests;
    return this.rollQuests(s.level || 1);
  },

  rollQuests(level) {
    const D = this.QUEST_DEFS(), maxTier = level >= 15 ? 5 : level >= 10 ? 4 : level >= 5 ? 3 : 2;
    const pool = D.filter((q) => q.tier <= maxTier);
    const r = this.seedR((level || 1) * 7717 + 3), out = [], taken = {};
    while (out.length < 4 && out.length < pool.length) {
      const q = pool[Math.floor(r() * pool.length)];
      if (taken[q.id]) continue;
      taken[q.id] = 1;
      out.push(Object.assign({}, q, { prog: 0, claimed: false }));
    }
    return out;
  },

  bumpQuest(kind, n) {
    const s = this.state, qs = this.activeQuests();
    let touched = false;
    const next = qs.map((q) => {
      if (q.kind !== kind || q.claimed || q.prog >= q.goal) return q;
      touched = true;
      return Object.assign({}, q, { prog: Math.min(q.goal, q.prog + (n || 1)) });
    });
    if (touched) this.setState({ quests: next });
    return next;
  },

  claimQuest(id) {
    const s = this.state, qs = this.activeQuests();
    const q = qs.find((x) => x.id === id);
    if (!q) return { ok: false, why: 'Quête introuvable' };
    if (q.claimed) return { ok: false, why: 'Déjà récupérée' };
    if (q.prog < q.goal) return { ok: false, why: 'Objectif non atteint (' + q.prog + ' sur ' + q.goal + ')' };
    const got = this.earn(q.reward, 'quest', 'Quête : ' + q.label);
    const L = this.addXp(this.state, q.xp);
    // une quête terminée est remplacée : la liste reste à quatre, les gains restent plafonnés
    const fresh = this.QUEST_DEFS().filter((d) => !qs.some((x) => x.id === d.id) && d.tier <= (this.state.level >= 10 ? 5 : 3));
    const repl = fresh.length ? Object.assign({}, fresh[Math.floor(Math.random() * fresh.length)], { prog: 0, claimed: false }) : null;
    const next = qs.map((x) => (x.id === id ? (repl || Object.assign({}, x, { claimed: true })) : x));
    this.setState({ quests: next, xp: L.xp, level: L.level, freeQueue: L.freeQueue,
      balance: this.state.balance + L.bonusBal,
      levelUp: L.ups.length ? { title: 'NIVEAU ' + L.level + ' !', sub: L.ups.map((u) => 'Niveau ' + u.level + ' : ' + u.text).join(' · ') } : this.state.levelUp });
    if (L.bonusBal) this.logMoney(L.bonusBal, 'Niveau ' + L.level + ' atteint');   // §7 tout ce qui entre est tracé
    this.buzz([30, 30, 60]);
    return { ok: true, got: got.given, capped: got.capped, xp: q.xp };
  },

  // §9 : les pronostics. Ils portent sur le match que tu t'apprêtes à jouer, dans le jeu,
  // jamais sur un match réel. La mise est en jetons, le gain passe par `earn` et son
  // plafond : un pronostic ne peut pas devenir une source infinie d'argent (§29).
  PRONO_DEFS(opp, xi) {
    const me = this.metrics(xi || this.pickXI(this.state.formation)).ovr;
    const gap = me - (opp ? opp.ovr : me);
    // la cote suit l'écart de niveau : parier sur soi quand on est favori rapporte peu
    const pWin = Math.max(0.12, Math.min(0.84, 0.5 + gap * 0.028));
    const odd = (p) => Math.round((1 / Math.max(0.1, p)) * 10) / 10;
    const scorers = (xi || this.pickXI(this.state.formation)).filter((p) => p.line !== 'GB')
      .sort((a, b) => b.ovr - a.ovr).slice(0, 3);
    return [
      { id: 'win', label: 'Je gagne ce match', odd: odd(pWin) },
      { id: 'draw', label: 'Match nul', odd: odd(0.24) },
      { id: 'over', label: 'Plus de 2,5 buts au total', odd: odd(0.47) },
      { id: 'clean', label: 'Je ne prends aucun but', odd: odd(0.3) },
      { id: 'poss', label: 'J’ai plus de 55 % de possession', odd: odd(0.42) }
    ].concat(scorers.map((p) => ({ id: 'sc_' + p.id, label: p.name + ' marque', odd: odd(0.26), who: p.id })));
  },

  MAX_STAKE() { return 120; },

  placeProno(id, stake) {
    const s = this.state, bet = Math.max(10, Math.min(this.MAX_STAKE(), Math.round(stake || 40)));
    if ((s.pronos || []).some((p) => p.id === id)) return { ok: false, why: 'Pronostic déjà pris' };
    if ((s.pronos || []).length >= 3) return { ok: false, why: 'Trois pronostics par match au maximum' };
    const sp = this.spend(bet, 'Pronostic : ' + id);
    if (!sp.ok) return sp;
    const def = this.PRONO_DEFS(s.nextOpp).find((d) => d.id === id) || { odd: 2, label: id };
    this.setState({ pronos: (s.pronos || []).concat([{ id, stake: bet, odd: def.odd, label: def.label, who: def.who || null }]) });
    return { ok: true, stake: bet, odd: def.odd };
  },

  // Règlement après le coup de sifflet final. Rien n'est versé hors de `earn`.
  settlePronos(mt) {
    const s = this.state, bets = s.pronos || [];
    if (!bets.length) return { won: 0, lost: 0, lines: [] };
    const hit = (b) => {
      if (b.id === 'win') return mt.res === 'w';
      if (b.id === 'draw') return mt.res === 'd';
      if (b.id === 'over') return mt.hs + mt.as > 2;
      if (b.id === 'clean') return mt.as === 0;
      if (b.id === 'poss') return (mt.poss || 50) > 55;
      if (b.who) return (mt.scorers || []).indexOf(b.who) >= 0;
      return false;
    };
    const lines = [];
    let won = 0;
    bets.forEach((b) => {
      const okb = hit(b);
      if (okb) { const gain = Math.round(b.stake * b.odd); const g = this.earn(gain, 'prono', 'Pronostic gagné : ' + b.label); won += g.given; lines.push({ label: b.label, ok: true, gain: g.given, capped: !!g.capped }); }
      else lines.push({ label: b.label, ok: false, gain: -b.stake });
    });
    this.setState({ pronos: [], lastProno: lines });
    return { won, lost: bets.filter((b) => !hit(b)).length, lines };
  },

  // Ce que le match vient de produire comme avancement de quêtes (§19).
  questsAfterMatch(mt, st) {
    const res = mt.res;
    if (res === 'w') this.bumpQuest('win', 1);
    if (mt.as === 0) this.bumpQuest('clean', 1);
    if (mt.assists) this.bumpQuest('assist', mt.assists);
    if (mt.poss != null && mt.poss >= 60 && res === 'w') this.bumpQuest('poss60', 1);
    if (res === 'w' && (st.winStreak || 0) + 1 >= 3) this.bumpQuest('streak3', 1);
    if (mt.xi) {
      const seen = new Set((st.seenPlayers || []).concat(mt.xi.map((p) => p.id)));
      this.setState({ seenPlayers: Array.from(seen).slice(-40) });
      this.bumpQuest('rotate', 0);
      const qs = this.activeQuests().map((q) => (q.kind === 'rotate' && !q.claimed ? Object.assign({}, q, { prog: Math.min(q.goal, seen.size) }) : q));
      this.setState({ quests: qs });
      if (mt.xi.some((p) => p.youth)) this.bumpQuest('youth', 1);
      if (mt.scorers) mt.scorers.forEach((id) => {
        const p = st.squad.find((x) => x.id === id);
        if (p && this.playerLevel(p) < 10) this.bumpQuest('lowGoal', 1);
      });
    }
    if (st.squad.some((p) => this.playerLevel(p) >= 20 && (p.rar || 'normal') === 'normal')) this.bumpQuest('reach20', 1);
  }
};

// LinkFoot : création du club (§2, §3, §4, §27).
//
// Le principe : on commence avec peu. L'effectif de départ est fait de joueurs
// NORMAUX, faibles mais avec du potentiel, plus UN joueur rare offert qui aide
// sans décider des matchs à lui seul.
const Creation = {
  // §2 : ce que le directeur sportif choisit avant de recevoir son effectif.
  CREATION_STEPS() {
    return [
      { id: 'name', label: 'Nom du club', hint: 'Le nom qui s’affichera partout' },
      { id: 'kit', label: 'Couleurs et maillot', hint: 'Deux couleurs, un motif, un col' },
      { id: 'logo', label: 'Logo', hint: 'Forme et initiales' },
      { id: 'stade', label: 'Stade', hint: 'Terrain municipal au départ, agrandissable' },
      { id: 'pays', label: 'Pays et championnat', hint: 'Détermine la division de départ' }
    ];
  },

  COUNTRIES() {
    return [
      { id: 'fr', label: 'France', div: 4 }, { id: 'es', label: 'Espagne', div: 4 },
      { id: 'it', label: 'Italie', div: 4 }, { id: 'en', label: 'Angleterre', div: 4 },
      { id: 'de', label: 'Allemagne', div: 4 }, { id: 'pt', label: 'Portugal', div: 5 }
    ];
  },

  // §4 : la base du jeu. Note 46 à 58, jeunes, avec un vrai potentiel à développer.
  starterSquad(seed) {
    const r = this.seedR(seed || 20260101);
    const plan = [
      ['GB', 54], ['GB', 48], ['DEF', 55], ['DEF', 53], ['DEF', 51], ['DEF', 49], ['DEF', 47],
      ['MIL', 56], ['MIL', 54], ['MIL', 51], ['MIL', 48], ['ATT', 55], ['ATT', 52], ['ATT', 49]
    ];
    const F = ['A.', 'B.', 'C.', 'D.', 'E.', 'G.', 'H.', 'I.', 'J.', 'K.', 'L.', 'M.', 'N.', 'O.', 'R.', 'S.', 'T.', 'V.', 'Y.', 'Z.'];
    const L = ['Marvello', 'Ducasson', 'Ebongué', 'Halvorsen', 'Quintero', 'Belkadi-Roy', 'Stranieri', 'Okafor-Lemaire', 'Vasquet', 'Nyamsi', 'Gaudrel', 'Petrakis', 'Lindau', 'Moreau-Diaby', 'Castagne-Nil', 'Rivoire', 'Takamura', 'Ferbault', 'Ansaldi', 'Kowalevski', 'Dembrel', 'Soumahé'];
    const pris = new Set();
    return plan.map(([pos, ovr], i) => {
      const o = ovr + Math.round((r() - 0.5) * 4);
      const age = 17 + Math.floor(r() * 6);
      // un joueur normal jeune a du potentiel : c'est tout l'intérêt de le développer
      const pot = Math.min(88, o + 10 + Math.floor(r() * 18));
      // le tirage du nom reste à sa place dans la suite aléatoire : seul un doublon change d'initiale
      const name = this.nomUnique(F[Math.floor(r() * F.length)] + ' ' + L[Math.floor(r() * L.length)], pris);
      pris.add(name);
      return { id: i + 1, name, pos, ovr: o, pot, age, rar: 'normal', plv: 3, pxp: 0, scouted: true };
    });
  },

  // §3 : le joueur rare offert. Meilleure base, meilleur potentiel, une compétence
  // spéciale, mais une note qui reste loin de ce qui gagne un match tout seul.
  starterRare(seed) {
    const r = this.seedR((seed || 20260101) + 991);
    const POS = ['MIL', 'ATT', 'DEF'];
    const pos = POS[Math.floor(r() * POS.length)];
    const ovr = 66 + Math.floor(r() * 5);                 // 66 à 70 : utile, pas décisif
    const p = { id: 90, name: ['N. Oyelaran', 'M. Castellane', 'R. Esperanza', 'S. Haugen', 'K. Rakotoson'][Math.floor(r() * 5)],
      pos, ovr, pot: Math.min(92, ovr + 14 + Math.floor(r() * 8)), age: 19 + Math.floor(r() * 3),
      rar: 'rare', plv: 5, pxp: 0, scouted: true, gift: true };
    // sa compétence spéciale, tirée dans la rareté Rare et compatible avec son poste
    const D = this.SKILL_DEF(), pool = D.POSOK[pos] || D.POSOK.MIL;
    let sk = null;
    for (let i = 0; i < 20 && !sk; i++) {
      const cand = this.makeSkill(pool[Math.floor(r() * pool.length)], Math.floor(r() * D.C.length), 1, Math.floor(r() * 3));
      if (this.canEquipRaw(p, cand)) sk = cand;
    }
    p.skills = sk ? [sk] : [];
    return p;
  },

  // La vérification de compatibilité sans passer par l'inventaire (le joueur n'existe pas encore).
  canEquipRaw(p, sk) {
    const req = sk.req || this.skillReq(sk.eid, sk.rarIdx, sk.lvl - 1);
    if (req.pos.indexOf(p.pos) < 0) return false;
    const st = {}; this.genStatsFor(p).forEach((q) => { st[q.l] = q.v; });
    for (const k in req.stats) if ((st[k] || 0) < req.stats[k]) return false;
    return (p.plv || 1) >= req.lvl;
  },

  genStatsFor(p) { return this.cardStats(p); },

  // §2 : créer le club. Rien d'autre n'est donné : ni jetons en masse, ni pack gratuit
  // en série. Le premier LinkFoot Pack se mérite (§27).
  createClub(opts) {
    const o = opts || {}, seed = o.seed || Date.now() % 1000000;
    const country = this.COUNTRIES().find((c) => c.id === o.country) || this.COUNTRIES()[0];
    const squad = this.starterSquad(seed);
    const rare = this.starterRare(seed);
    const patch = {
      clubName: o.name || 'FC TonPseudo',
      country: country.id, division: country.div,
      kit: o.kit || this.state.kit,
      stade: 0, academy: 0, staff: { adjoint: 0, physique: 0, recruteur: 0, kine: 0 },
      squad: squad.concat([rare]),
      nextId: 200, nextSkillUid: 1, skillInv: [], collected: [], seenPlayers: [],
      balance: 600, shards: 0, xp: 0, level: 1,
      record: { w: 0, d: 0, l: 0 }, seasonP: 0, winStreak: 0,
      // la série de connexion repart de zéro : l'état de démonstration en était au jour 4
      dayStreak: 0, dayClaimed: false, market: null,
      quests: this.rollQuests(1), caps: { day: this.dayKey() }, ledger: [],
      freeQueue: ['linkfoot'],                      // un seul pack offert pour démarrer
      created: true,
      welcome: { title: 'CLUB CRÉÉ', sub: rare.name + ' (' + rare.pos + ' ' + rare.ovr + ', potentiel ' + rare.pot + ') rejoint le club. Le reste de l’effectif est à construire.' }
    };
    this.setState(patch);
    this.logMoney(600, 'Dotation de départ');
    return { ok: true, rare, squad };
  },

  // Le résumé affiché après la création : ce que le directeur sportif a en main.
  creationSummary() {
    const s = this.state, sq = s.squad || [];
    const rare = sq.find((p) => p.gift);
    const norm = sq.filter((p) => !p.gift);
    const avg = norm.length ? Math.round(norm.reduce((a, p) => a + p.ovr, 0) / norm.length) : 0;
    const pot = norm.length ? Math.round(norm.reduce((a, p) => a + (p.pot || p.ovr), 0) / norm.length) : 0;
    return {
      club: s.clubName || 'FC TonPseudo',
      count: sq.length, avg, pot,
      rare: rare ? { name: rare.name, pos: rare.pos, ovr: rare.ovr, potential: rare.pot,
        skill: (rare.skills && rare.skills[0]) ? rare.skills[0].name : null } : null,
      line: 'Effectif de ' + sq.length + ' joueurs, note moyenne ' + avg + ', potentiel moyen ' + pot + '.'
    };
  }
};

// LinkFoot : ce que l'écran affiche du multijoueur (§26).
//
// Ce module ne parle à personne. Il met en forme l'état en ligne pour l'interface,
// et surtout il répond proprement quand aucun serveur n'est branché : l'écran dit
// alors ce qu'il faut faire pour y remédier, au lieu d'afficher des boutons morts (§81).
const OnlineUI = {
  isOnline() { return !!(this.online && this.onlineState && !this.onlineState.offline); },

  onlineSummary() {
    const s = this.state, st = this.onlineState || {};
    const on = this.isOnline();
    return {
      connected: on,
      state: on ? 'En ligne' : this.online ? 'Serveur injoignable' : 'Hors ligne',
      // Le message s'adresse au joueur, pas au développeur : il dit ce qui se passe
      // et ce qu'il peut faire, pas comment le code est branché.
      why: on ? 'Ton équipe est publiée : les autres clubs peuvent te défier.' : this.online
        ? 'Le serveur ne répond pas. Tout le reste du jeu continue de fonctionner.'
        : 'Les matchs classés, les ligues entre amis et le classement arrivent bientôt. Le reste du jeu fonctionne sans eux.',
      error: s.onlineError || null,
      elo: s.elo || null,
      ladder: (st.ladder || []).slice(0, 20),
      leagues: st.leagues || [],
      challenges: st.challenges || [],
      feed: st.feed || null,
      market: st.market || null,
      last: s.lastVersus || null,
      lastLine: s.lastVersus
        ? 'Dernier match classé : ' + s.lastVersus.score.join(' - ') + ' contre ' + s.lastVersus.opponent
          + ' · Elo ' + (s.lastVersus.delta >= 0 ? '+' : '') + s.lastVersus.delta
        : 'Aucun match classé joué.'
    };
  },

  // Les actions proposées par l'écran. Chacune refuse avec sa raison si le serveur
  // n'est pas là : aucune ne fait semblant de marcher.
  onlineActions() {
    const can = this.isOnline();
    const refuse = () => Promise.resolve({ ok: false, why: this.onlineSummary().why });
    return {
      can,
      publish: () => (can ? this.goOnline() : refuse()),
      // §81 : si l'action n'est pas disponible, le bouton le dit au lieu de ne rien faire.
      ranked: (id) => (can ? this.playRanked(id) : refuse()),
      createLeague: (name) => (can ? this.online.createLeague(name, 2) : refuse()),
      joinLeague: (code) => (can ? this.online.joinLeague(code) : refuse()),
      refresh: () => (can ? Promise.all([this.refreshLadder(), this.refreshLeagues(), this.refreshChallenges(), this.refreshFeed(), this.refreshMarket()]) : refuse()),
      sell: (id, price) => (can ? this.sellOnline(id, price) : refuse()),
      buy: (listingId) => (can ? this.buyOnline(listingId) : refuse())
    };
  }
};

// LinkFoot : les séances et le matériel d'entraînement (§5, §6, §29).
//
// L'entraînement n'est pas illimité. Chaque séance consomme UNE séance en stock.
// On en reçoit deux par jour gratuitement, et le pack unique en donne à sa part
// « Objet ». C'est ce qui fait de l'entraînement une décision : avec trois séances en
// poche, on choisit qui on fait progresser, on ne lance pas tout.
const TrainPack = {
  // Deux séances offertes par jour, vingt en réserve au maximum : impossible
  // d'empiler trois mois d'entraînement pour tout lancer d'un coup (§29).
  SESSION_RULES() { return { freePerDay: 2, max: 20 }; },

  // Les séances disponibles, en remettant les gratuites du jour si on ne les a pas prises.
  sessions() {
    const s = this.state, R = this.SESSION_RULES();
    const caps = s.caps || {};
    if (caps.day !== this.dayKey()) return Math.min(R.max, (s.sessions || 0) + R.freePerDay);
    return s.sessions || 0;
  },

  // Appelé avant toute séance : remet les gratuites du jour si besoin, puis en retire une.
  takeSession() {
    const s = this.state, R = this.SESSION_RULES(), caps = Object.assign({}, s.caps || {});
    let have = s.sessions || 0;
    if (caps.day !== this.dayKey()) { have = Math.min(R.max, have + R.freePerDay); caps.day = this.dayKey(); }
    if (have <= 0) return false;
    this.setState({ sessions: have - 1, caps });
    return true;
  },

  addSessions(n) {
    const R = this.SESSION_RULES();
    this.setState({ sessions: Math.min(R.max, (this.state.sessions || 0) + Math.max(0, Math.round(n))) });
    return this.state.sessions;
  },

  // L'état de l'entraînement, pour que l'écran dise toujours pourquoi il refuse (§81).
  trainInfo() {
    const n = this.sessions(), R = this.SESSION_RULES();
    const busy = !!(this.state.match && !this.state.match.done);
    return {
      sessions: n, max: R.max, freePerDay: R.freePerDay,
      can: n > 0 && !busy,
      why: busy ? 'Impossible pendant un match'
        : n > 0 ? '' : 'Plus de séance. Tu en reçois ' + R.freePerDay + ' par jour, et le ' + this.THE_PACK().name + ' en donne parfois.',
      line: n + ' séance' + (n > 1 ? 's' : '') + ' en stock · ' + R.freePerDay + ' offertes par jour'
    };
  },

  // Le matériel d'entraînement : un objet par rareté. Il sort du pack unique, à la part
  // « Objet » et à la rareté tirée, donc un Stage Gold est aussi rare qu'un joueur Gold.
  TRAIN_LOTS() {
    return [
      { id: 'seance', rar: 'normal', label: 'Séance d’entraînement', desc: '+1 séance', sessions: 1 },
      { id: 'carte', rar: 'rare', label: 'Carte d’amélioration', desc: '+2 sur une statistique, au joueur de ton choix', up: 1 },
      { id: 'duo', rar: 'epic', label: 'Double séance', desc: '+2 séances', sessions: 2 },
      { id: 'specialise', rar: 'elite', label: 'Séance spécialisée', desc: '+3 séances et une carte d’amélioration', sessions: 3, up: 1 },
      { id: 'stage', rar: 'gold', label: 'Stage de pré-saison', desc: '+60 XP à tout l’effectif', squadXp: 60 },
      { id: 'masterclass', rar: 'legendary', label: 'Masterclass', desc: '+150 XP à tout l’effectif et trois cartes d’amélioration', squadXp: 150, up: 3 }
    ];
  },

  // Les cartes d'amélioration que le pack peut donner : les mêmes que celles déjà
  // utilisables sur la fiche d'un joueur. Rien de nouveau à comprendre.
  UPGRADE_CARDS() {
    return [['VIT', 'Vitesse'], ['ATQ', 'Attaque'], ['TIR', 'Tir'], ['PAS', 'Passe'], ['DRI', 'Dribble'], ['DÉF', 'Défense'], ['PHY', 'Physique']];
  },

  useUpgrade(pid, stat) {
    const s = this.state, key = 'up_' + stat, inv = Object.assign({}, s.inv || {});
    if (!(inv[key] > 0)) return { ok: false, why: 'Aucune carte ' + stat + ' en réserve' };
    const p = s.squad.find((x) => x.id === pid);
    if (!p) return { ok: false, why: 'Joueur introuvable' };
    const st = {}; this.cardStats(p).forEach((q) => { st[q.l] = q.v; });
    if (st[stat] == null) return { ok: false, why: 'Un gardien ne travaille pas cette statistique' };
    if (st[stat] >= 99) return { ok: false, why: stat + ' est déjà au maximum' };
    const h = this.hiddenOf(p);
    if (p.ovr >= h.potReel) return { ok: false, why: p.name + ' a atteint son potentiel' };
    st[stat] = Math.min(99, st[stat] + 2);
    inv[key]--;
    const ovr = Math.min(h.potReel, Math.max(p.ovr, this.ovrOf(p.pos, st)));
    this.buzz([25, 25, 50]);
    this.setState({ inv, squad: s.squad.map((x) => (x.id === pid ? Object.assign({}, x, { st, ovr }) : x)),
      trainLog: p.name + ' +2 ' + stat + (ovr > p.ovr ? ' · note ' + p.ovr + ' → ' + ovr : '') });
    return { ok: true, ovr };
  },

  // §19 : tout ce que le pack donne arrive immédiatement là où ça sert.
  // Ce que des objets d'entraînement donnent au club : séances, cartes d'amélioration,
  // XP de stage. Une seule fonction pour tout ce qui en donne (§3).
  appliquerObjetsEntrainement(lots) {
    if (!lots || !lots.length) return { sessions: 0, xp: 0, cards: [] };
    const s = this.state, R = this.SESSION_RULES(), inv = Object.assign({}, s.inv || {});
    let add = 0, xp = 0;
    const cards = [];
    lots.forEach((g) => {
      add += g.sessions || 0;
      xp += g.squadXp || 0;
      (g.stats || (g.stat ? [g.stat] : [])).forEach((k) => { inv['up_' + k] = (inv['up_' + k] || 0) + 1; cards.push(k); });
    });
    this.setState({ inv, sessions: Math.min(R.max, (s.sessions || 0) + add) });
    // un stage profite à tout l'effectif : c'est ce qui rend les lots rares désirables
    if (xp) this.state.squad.forEach((p) => this.grantPlayerXp(p.id, xp, 'stage'));
    return { sessions: add, xp, cards };
  },

  // §19 : l'écran d'entraînement ne propose que ce que le directeur sportif peut
  // réellement faire AUJOURD'HUI, avec ce qu'il a en réserve. Chaque ligne dit ce
  // qu'elle consomme et, si elle refuse, ce qui manque (§81).
  trainingOptions() {
    const ti = this.trainInfo(), inv = this.state.inv || {};
    const base = this.TRAININGS().map((t) => ({
      id: t.id, label: t.label, desc: t.desc, cost: '1 séance', kind: 'squad',
      can: ti.can, why: ti.can ? '' : ti.why
    }));
    // les cartes d'amélioration ouvrent des séances ciblées : on ne les propose
    // que si on en possède, et on dit sur quelle statistique elles portent
    const cards = this.UPGRADE_CARDS()
      .map(([k, label]) => ({ k, label, n: inv['up_' + k] || 0 }))
      .filter((x) => x.n > 0)
      .map((x) => ({
        id: 'up_' + x.k, label: 'Séance ciblée ' + x.label.toLowerCase(), kind: 'card', stat: x.k, n: x.n,
        desc: '+2 ' + x.k + ' sur le joueur de ton choix, sans consommer de séance',
        cost: x.n + ' carte' + (x.n > 1 ? 's' : ''), can: true, why: ''
      }));
    return base.concat(cards);
  }
};

// LinkFoot : le pack unique et le matériel de l'entraîneur (§8, §9, §24).
//
// §8 UN SEUL PACK. Le LinkFoot Pack est le seul pack du jeu : un seul bouton,
// « OUVRIR LE PACK », et chaque tirage peut donner un joueur, une compétence, un objet
// (séance, carte d'amélioration, causerie, plan tactique) ou des fragments quand le
// joueur tiré est déjà au club. Avant l'ouverture, il affiche les deux tables qui
// décident du tirage : la part de chaque famille et le taux de chaque rareté (§9).
//
// Il y a eu jusqu'à quatre packs (plus un Pack Compétence, un Pack Entraînement et un
// Pack Entraîneur). Ils ont été retirés : le §8 n'en veut qu'un, et deux d'entre eux
// vendaient des objets Gold à 1,8 % et 2,6 % par lot, au-dessus du « 1 % ou moins »
// du §12. Tout ce qu'ils donnaient sort du pack unique, à la rareté commune.
const Packs = {
  // L'écran Packs, dans le canvas comme dans l'app, lit cette forme : le pack, son
  // prix, ses deux tables de probabilités et ce qu'il a donné la dernière fois. Les
  // probabilités sont demandées à leurs propres fonctions, jamais recopiées (§29).
  KIOSQUE() {
    return [
      { key: 'linkfoot', def: this.THE_PACK(), family: 'Pack unique', principal: true,
        question: 'Joueur, compétence ou objet : un seul pack pour tout',
        odds: () => this.packOdds(this.THE_PACK()), kind: 'rarete',
        familles: () => this.packFamilies(),
        state: () => this.packState(this.THE_PACK()),
        useView: 'squad', useLabel: 'Joueurs dans l’effectif, compétences en réserve, objets à l’entraînement',
        last: 'lastCardPack' }
    ];
  },

  // La liste prête à afficher. Aucune fonction d'interface là-dedans : l'écran y branche
  // son bouton lui-même, parce que l'ouverture du pack a son animation.
  kiosque() {
    const s = this.state;
    return this.KIOSQUE().map((e) => {
      const st = e.state(), d = e.def;
      return {
        key: e.key, name: d.name, family: e.family, question: e.question,
        principal: !!e.principal,
        n: d.n, cost: d.cost, color: d.color, content: d.content,
        desc: d.n + ' tirages · ' + d.content,
        can: !!st.can, why: st.why || '', locked: !st.can,
        useView: e.useView, useLabel: e.useLabel,
        got: s[e.last] || '',
        kind: e.kind, odds: e.odds(),
        familles: e.familles ? e.familles() : null
      };
    });
  },

  // Le pack unique, tel que les écrans l'affichent.
  packPrincipal() { return this.kiosque()[0]; },

  // ---------- le matériel de l'entraîneur (§24) ----------
  // Il sort du pack unique, à la part « Objet » et à la rareté tirée. Chaque objet a
  // un effet réel, lu au moment où on s'en sert (§13).
  // Le matériel tactique. Chaque objet a un effet réel, lu au moment du match (§14, §81).
  COACH_ITEMS() {
    return [
      { id: 'causerie', rar: 'normal', label: 'Causerie d’avant-match', kind: 'meeting',
        desc: 'Moral +8 pour tout l’effectif, une fois', morale: 8 },
      { id: 'video', rar: 'rare', label: 'Séance vidéo', kind: 'meeting',
        desc: 'Révèle le style de l’adversaire et donne +1 d’avantage tactique au prochain match', adv: 1 },
      { id: 'atelier', rar: 'epic', label: 'Atelier tactique', kind: 'meeting',
        desc: 'Cohésion +4 %, durable', coh: 0.04 },
      { id: 'plan', rar: 'elite', label: 'Plan tactique', kind: 'plan',
        desc: 'Un style de jeu préparé : +2 d’avantage tactique quand tu l’utilises contre le bon adversaire', adv: 2 },
      { id: 'reunion', rar: 'gold', label: 'Réunion de groupe', kind: 'meeting',
        desc: 'Moral +15, cohésion +6 % et +40 XP à tout l’effectif', morale: 15, coh: 0.06, squadXp: 40 },
      { id: 'masterplan', rar: 'legendary', label: 'Plan de campagne', kind: 'plan',
        desc: 'Trois plans tactiques, moral +20 et cohésion +8 %', plans: 3, morale: 20, coh: 0.08 }
    ];
  },

  // Ranger le matériel de l'entraîneur sorti du pack. Une seule fonction pour tout
  // ce qui en donne (§3) : un objet fait la même chose d'où qu'il vienne.
  //
  // Un plan (simple ou de campagne) va dans la réserve de plans, la seule que lit
  // usePlan. Le plan de campagne promettait « trois plans tactiques, moral +20 et
  // cohésion +8 % » : il en donnait deux, rangés sous une clé que rien ne lisait, et
  // ni moral ni cohésion. Ce n'est pas une réunion qu'on tient plus tard : son moral
  // et sa cohésion s'appliquent à réception, ses trois plans vont en réserve.
  rangerObjetsCoach(lots) {
    if (!lots || !lots.length) return { plans: 0, morale: 0, coh: 0 };
    const s = this.state, coach = Object.assign({}, s.coachInv || {});
    let plans = 0, morale = 0, coh = 0;
    lots.forEach((g) => {
      if (g.kind === 'plan') {
        plans += g.plans || 1;
        morale += g.morale || 0;
        coh += g.coh || 0;
      } else coach[g.id] = (coach[g.id] || 0) + 1;
    });
    if (plans) coach.plan = (coach.plan || 0) + plans;
    const patch = { coachInv: coach };
    if (morale) patch.squad = s.squad.map((p) => Object.assign({}, p, { morale: Math.min(99, this.profile(p).morale + morale) }));
    if (coh) patch.cohBonus = Math.min(0.16, (s.cohBonus || 0) + coh);
    this.setState(patch);
    return { plans, morale, coh };
  },

  // ---------- la réunion d'équipe (§24) ----------
  // Ce que le directeur sportif peut faire avec son matériel, et ce qu'il lui manque.
  meetings() {
    const s = this.state, inv = s.coachInv || {};
    return this.COACH_ITEMS().filter((x) => x.kind === 'meeting').map((x) => {
      const n = inv[x.id] || 0;
      return Object.assign({}, x, {
        n, can: n > 0,
        why: n > 0 ? '' : 'Aucun(e) ' + x.label.toLowerCase() + ' en réserve : ça sort du ' + this.THE_PACK().name + ', à la part Objet.'
      });
    });
  },

  // Tenir une réunion : l'effet est immédiat et visible dans l'effectif (§19).
  holdMeeting(id) {
    const s = this.state, item = this.COACH_ITEMS().find((x) => x.id === id);
    if (!item || item.kind !== 'meeting') return { ok: false, why: 'Réunion inconnue' };
    const inv = Object.assign({}, s.coachInv || {});
    if (!(inv[id] > 0)) return { ok: false, why: 'Aucun(e) ' + item.label.toLowerCase() + ' en réserve' };
    inv[id]--;
    const patch = { coachInv: inv };
    let txt = item.label;
    if (item.morale) {
      patch.squad = s.squad.map((p) => {
        const pr = this.profile(p);
        return Object.assign({}, p, { morale: Math.min(99, pr.morale + item.morale) });
      });
      txt += ' · moral +' + item.morale;
    }
    if (item.coh) { patch.cohBonus = Math.min(0.16, (s.cohBonus || 0) + item.coh); txt += ' · cohésion +' + Math.round(item.coh * 100) + ' %'; }
    if (item.adv) { patch.nextAdv = (s.nextAdv || 0) + item.adv; txt += ' · +' + item.adv + ' d’avantage au prochain match'; }
    patch.trainLog = txt;
    this.buzz([25, 25, 50]);
    this.setState(patch);
    if (item.squadXp) this.state.squad.forEach((p) => this.grantPlayerXp(p.id, item.squadXp, item.label));
    return { ok: true, text: txt };
  },

  // Les plans tactiques préparés : un plan consommé donne un vrai avantage dans le match
  // qui suit, et seulement celui-là.
  plansLeft() { return (this.state.coachInv || {}).plan || 0; },

  usePlan(styleKey) {
    const s = this.state, inv = Object.assign({}, s.coachInv || {});
    if (!(inv.plan > 0)) return { ok: false, why: 'Aucun plan tactique en réserve : ça sort du ' + this.THE_PACK().name + ', à la part Objet.' };
    const S = this.styles();
    if (!S[styleKey]) return { ok: false, why: 'Style inconnu' };
    inv.plan--;
    this.setState({ coachInv: inv, preset: styleKey, tac: Object.assign({}, S[styleKey].tac), mentality: S[styleKey].m,
      nextAdv: (s.nextAdv || 0) + 2,
      trainLog: 'Plan tactique préparé : ' + S[styleKey].name + ' · +2 d’avantage au prochain match' });
    this.buzz([25, 25, 60]);
    return { ok: true, style: S[styleKey].name };
  }
};

// LinkFoot : ce que tes décisions ont fait, en chiffres du match (§1, §22, §47).
//
// Le directeur sportif ne touche jamais au ballon. Il compose, place, règle, prépare,
// équipe, entraîne, et le match se joue tout seul. Le problème, c'est qu'il n'a alors
// aucun moyen de savoir si ses réglages ont servi à quelque chose : il voit un score,
// pas une conséquence.
//
// Ce fichier répond à une seule question, après le coup de sifflet : qu'est-ce que
// chacune de tes décisions a produit sur le terrain ?
//
// DEUX RÈGLES, pour que ça reste honnête :
//
//   1. Une ligne n'apparaît que si tu as VRAIMENT bougé ce réglage. Rien ne s'affiche
//      pour un curseur laissé au milieu : ce serait du décor (§47).
//   2. Le chiffre vient du match qui vient d'être joué, jamais d'une estimation et
//      jamais d'un « sans ça, tu aurais fait X ». On ne rejoue pas la rencontre pour
//      inventer un contrefactuel : on dit ce qui s'est passé.
//
// Les réglages sont figés au coup d'envoi par matchPlan(), parce que certains se
// consomment pendant la rencontre : un plan tactique préparé ne vaut qu'un match, et
// l'état d'après ne saurait plus dire qu'il avait été préparé.
const Impact = {
  // Les décisions, photographiées avant le coup d'envoi.
  matchPlan() {
    const s = this.state, xi = this.pickXI(s.formation);
    const duty = {};
    xi.forEach((p) => { const d = s.duties[p.slot] || 'Soutien'; duty[d] = (duty[d] || 0) + 1; });
    const portees = xi.reduce((a, p) => a + (this.equippedOn ? this.equippedOn(p.id).length : 0), 0);
    return {
      formation: s.formation, mentality: s.mentality, preset: s.preset,
      tac: Object.assign({}, s.tac),
      adv: s.nextAdv || 0, coh: s.cohBonus || 0,
      adjoint: this.staffLv('adjoint'), duty, portees,
      moral: Math.round(xi.reduce((a, p) => a + this.profile(p).morale, 0) / (xi.length || 1)),
      fraicheur: Math.round(xi.reduce((a, p) => a + (p.fit != null ? p.fit : 100), 0) / (xi.length || 1))
    };
  },

  MENTALITES() { return ['Très défensive', 'Défensive', 'Prudente', 'Équilibrée', 'Positive', 'Offensive', 'Très offensive']; },

  // Chaque ligne : quand elle s'affiche, ce qu'elle a décidé, ce que ça a donné.
  // `m` rassemble les chiffres du match ; `pm` les ramène pour mille ballons joués,
  // sans quoi deux matchs de volumes différents ne se comparent pas.
  IMPACT_DEFS() {
    const n1 = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
    return [
      { id: 'mentalite',
        quand: (p) => p.mentality !== 3,
        titre: (p) => 'Mentalité ' + (this.MENTALITES()[p.mentality] || '').toLowerCase(),
        mesure: (m) => m.sh + ' frappes tentées, ' + m.advSh + ' concédées' },

      { id: 'formation',
        quand: (p) => p.formation !== '4-3-3',
        titre: (p) => 'Formation en ' + p.formation,
        mesure: (m) => m.advSh + ' tirs concédés, ' + m.tk + ' ballons récupérés' },

      { id: 'style',
        quand: (p) => p.preset && p.preset !== 'perso' && p.preset !== 'equilibre',
        titre: (p) => { const st = this.styles()[p.preset]; return 'Style ' + (st ? st.name : p.preset); },
        mesure: (m) => m.poss + ' % de possession' },

      { id: 'passe',
        quand: (p) => p.tac.pass !== 1,
        titre: (p) => (p.tac.pass === 0 ? 'Jeu court imposé' : 'Jeu direct imposé'),
        mesure: (m) => n1(m.pm('act_pass_long')) + ' longs ballons pour mille, contre '
          + n1(m.pm('act_pass_pass')) + ' passes au sol' },

      // Pas le nombre de tacles : une équipe qui presse a plus le ballon, donc elle tacle
      // MOINS, et le rapport aurait dit l'inverse de ce qui s'est passé. Ce qui montre
      // qu'un pressing a marché, c'est OÙ le ballon a été récupéré.
      { id: 'pressing',
        quand: (p) => p.tac.press !== 1 || p.tac.engage !== 1,
        titre: (p) => (p.tac.press >= 2 ? 'Pressing haut' : p.tac.press === 0 ? 'Bloc en retrait' : 'Pressing réglé'),
        mesure: (m) => m.recHaut + ' ballons récupérés dans la moitié adverse sur ' + m.rec
          + ', ' + m.fou + ' fautes' },

      { id: 'ligne',
        quand: (p) => p.tac.line !== 1,
        titre: (p) => (p.tac.line === 2 ? 'Ligne défensive haute' : 'Ligne défensive basse'),
        mesure: (m) => m.advOff + ' hors-jeu provoqués, ' + m.advSh + ' tirs concédés' },

      { id: 'couloirs',
        quand: (p) => p.tac.cross !== 1 || p.tac.width !== 1,
        titre: (p) => (p.tac.cross >= 2 ? 'Attaque par les couloirs' : 'Jeu resserré dans l’axe'),
        mesure: (m) => m.cross + ' centres, ' + m.cor + ' corners' },

      { id: 'consignes',
        quand: (p) => (p.duty.Attaque || 0) + (p.duty['Défense'] || 0) > 0,
        titre: (p) => (p.duty.Attaque || 0) + ' en consigne Attaque, ' + (p.duty['Défense'] || 0) + ' en Défense',
        mesure: (m) => n1(m.pm('boxRcv')) + ' ballons reçus dans la surface pour mille' },

      { id: 'plan',
        quand: (p) => p.adv > 0,
        titre: (p) => 'Plan tactique préparé, +' + p.adv + ' d’avantage',
        mesure: (m) => n1(m.xg) + ' de danger créé (xG), ' + m.on + ' frappes cadrées' },

      { id: 'reunion',
        quand: (p) => p.coh > 0,
        titre: (p) => 'Réunion tenue, cohésion +' + Math.round(p.coh * 100) + ' %',
        mesure: (m) => m.precision + ' % de passes réussies, sur ' + m.pa + ' tentées' },

      { id: 'competences',
        quand: (p) => p.portees > 0,
        titre: (p) => p.portees + ' compétence(s) équipée(s) sur le onze',
        mesure: (m) => m.drib + ' dribbles tentés, ' + m.dribOk + ' réussis, '
          + m.gestes + ' gestes de haut niveau' },

      { id: 'adjoint',
        quand: (p) => p.adjoint > 0,
        titre: (p) => 'Adjoint niveau ' + p.adjoint,
        mesure: (m) => m.precision + ' % de passes réussies' },

      { id: 'fraicheur',
        quand: (p) => p.fraicheur < 85,
        titre: (p) => 'Onze à ' + p.fraicheur + ' % de fraîcheur',
        mesure: (m) => m.tk + ' ballons récupérés, ' + n1(m.pm('act_shot')) + ' frappes pour mille' },

      { id: 'moral',
        quand: (p) => p.moral >= 80 || p.moral <= 55,
        titre: (p) => 'Effectif au moral ' + (p.moral >= 80 ? 'haut' : 'bas') + ' (' + p.moral + ')',
        mesure: (m) => n1(m.xg) + ' de danger créé (xG)' }
    ];
  },

  // Les chiffres du match, rassemblés une fois pour toutes les lignes.
  impactFigures(mt) {
    const H = (mt.st && mt.st.H) || {}, A = (mt.st && mt.st.A) || {}, cnt = mt.cnt || {};
    const dec = cnt.dec || 0;
    const gestes = [3, 4, 5].reduce((a, t) => a + (cnt['g' + t] || 0), 0);
    return {
      sh: H.sh || 0, on: H.on || 0, xg: H.xg || 0, cor: H.cor || 0, fou: H.fou || 0,
      yc: H.yc || 0, pa: H.pa || 0, pc: H.pc || 0, tk: H.tk || 0,
      advSh: A.sh || 0, advOff: A.off || 0,
      poss: mt.poss != null ? mt.poss : (mt.possNow != null ? mt.possNow : 50),
      cross: cnt.cross || 0, drib: cnt.drib || 0, dribOk: cnt.dribOk || 0, gestes,
      rec: cnt.rec_H || 0, recHaut: cnt.rec_H_haut || 0,
      precision: H.pa ? Math.round(H.pc / H.pa * 100) : 0,
      dec, pm: (k) => (dec ? (cnt[k] || 0) / dec * 1000 : 0)
    };
  },

  // Le rapport : une ligne par décision réellement prise, avec ce qu'elle a donné.
  // Vide si le directeur sportif n'a rien changé : c'est une réponse, pas un remplissage.
  impactReport(mt) {
    if (!mt) return [];
    const plan = mt.plan || this.matchPlan();
    const m = this.impactFigures(mt);
    if (!m.dec && !m.sh && !m.pa) return [];        // match pas encore joué : rien à dire
    return this.IMPACT_DEFS()
      .filter((d) => { try { return d.quand(plan); } catch (e) { return false; } })
      .map((d) => ({ id: d.id, titre: d.titre(plan), valeur: d.mesure(m) }));
  },

  // Une phrase pour l'accueil et le rapport : combien de décisions ont pesé.
  impactLine(mt) {
    const n = this.impactReport(mt).length;
    return n ? n + ' de tes décisions ont pesé sur ce match' : 'Aucun réglage changé : l’équipe a joué par défaut';
  }
};

// LinkFoot : classements et calendriers (§72, §75).
// Le même code sert pour la division solo du directeur sportif, une ligue entre amis,
// un tournoi ou un classement national : il n'existe qu'un seul système de classement
// dans tout le jeu (§3).
//
// Les règles sont écrites comme des MÉTHODES d'un objet, LeagueRules, pour deux raisons :
//   - Club les reçoit (Object.assign), et la division solo s'en sert par this.standings ;
//   - tools/sync-canvas.mjs les recopie dans l'écran Mon Club, qui ne peut rien importer.
// Aucune n'utilise `this`, et aucune n'appelle une autre : les exports nommés plus bas
// restent donc de simples fonctions, pour le serveur et les tournois.

const POINTS = { win: 3, draw: 1, loss: 0 };

const LeagueRules = {
  // Une ligne de classement vierge.
  emptyRow(id, name) {
    return { id, name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  },

  // Applique un résultat aux deux lignes concernées. Les lignes sont créées si besoin.
  // Victoire 3 points, nul 1, défaite 0 : les mêmes valeurs que POINTS.
  applyResult(rows, homeId, awayId, hs, as) {
    const get = (id) => {
      let r = rows.find((x) => x.id === id);
      if (!r) { r = { id, name: String(id), p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; rows.push(r); }
      return r;
    };
    const H = get(homeId), A = get(awayId);
    H.p++; A.p++; H.gf += hs; H.ga += as; A.gf += as; A.ga += hs;
    if (hs > as) { H.w++; A.l++; H.pts += 3; }
    else if (hs < as) { A.w++; H.l++; A.pts += 3; }
    else { H.d++; A.d++; H.pts += 1; A.pts += 1; }
    return rows;
  },

  // Tri officiel : points, puis différence de buts, puis buts marqués, puis victoires, puis nom.
  standings(rows) {
    return rows.slice()
      .map((r) => Object.assign({}, r, { gd: r.gf - r.ga }))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.w - a.w || String(a.name).localeCompare(String(b.name)))
      .map((r, i) => Object.assign(r, { rank: i + 1 }));
  },

  // Calendrier toutes rondes (méthode du cercle). `rounds` = 1 pour aller simple, 2 pour aller-retour.
  schedule(teamIds, rounds) {
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
  },

  // Promotion et relégation d'une division (§72).
  movements(table, opts) {
    const o = opts || {};
    const up = o.up != null ? o.up : 2, down = o.down != null ? o.down : 1;
    return {
      promoted: table.slice(0, up).map((r) => r.id),
      relegated: down ? table.slice(table.length - down).map((r) => r.id) : []
    };
  }
};

const emptyRow = LeagueRules.emptyRow;
const applyResult = LeagueRules.applyResult;
const standings = LeagueRules.standings;
const schedule = LeagueRules.schedule;
const movements = LeagueRules.movements;

// LinkFoot : la division du directeur sportif (§2 « compétitions », §22 « je progresse
// dans les divisions »).
//
// Avant, le classement de division était un décor : cinq clubs aux bilans figés
// (3-1-0, 2-1-1…), qui ne jouaient jamais et ne repartaient même pas de zéro à la saison
// suivante. N'importe quel adversaire comptait pour le championnat, et un match amical
// faisait avancer la saison.
//
// La division est maintenant un vrai championnat de six clubs, tenu avec les règles de
// classement communes à tout le jeu (league.js, §3) :
//   - un calendrier toutes rondes de cinq journées : chaque club rencontre chacun des
//     autres une fois, à domicile ou à l'extérieur ;
//   - ton match est joué par le moteur ; les deux autres matchs de la journée sont
//     simulés d'après la note et le style des clubs, avec une graine, donc reproductibles ;
//   - le classement est calculé, jamais écrit ; les deux premiers montent, le dernier
//     descend, et la saison suivante repart d'un nouveau calendrier.
// Seul le match prévu au calendrier compte. Les autres rencontres sont des amicaux.
const Division = {
  // Les clubs que l'on peut croiser en division. Tous fictifs. `base` est leur note en
  // division 4, celle où démarre un club créé en France : autour de la note d'un effectif
  // de départ (55), pour qu'un nouveau club joue sa division au lieu de la subir.
  // Chaque division plus haute ajoute 4 points, chaque division plus basse en retire 4.
  // L'ancienne échelle (62 à 72 en division 4) avait été réglée sur le club de
  // démonstration : un club neuf perdait tout, 0-5 et 0-8, et restait dernier.
  CLUBS_DIVISION() {
    return [
      { id: 'auteuil', club: 'Auteuil United', base: 57, color: '#2F8FE0', style: 'tiki' },
      { id: 'kop', club: 'Kop Bleu FC', base: 53, color: '#5CC8FF', style: 'contre' },
      { id: 'vieuxport', club: 'Olympique Vieux-Port', base: 58, color: '#6FD0F7', style: 'gegen' },
      { id: 'yoyo', club: 'Sporting Yoyo', base: 54, color: '#F2C66B', style: 'blocbas' },
      { id: 'canal', club: 'Real Canal FC', base: 50, color: '#FF8A65', style: 'direct' },
      { id: 'brindille', club: 'Calcio Brindille', base: 55, color: '#1B3FA0', style: 'catenaccio' },
      { id: 'dynamo', club: 'Dynamo Positif', base: 56, color: '#B98CFF', style: 'posit' },
      { id: 'fleches', club: 'Flèches du Nord', base: 52, color: '#FF4757', style: 'ailes' },
      { id: 'duel', club: 'Duel FC', base: 54, color: '#24B463', style: 'homme' },
      { id: 'phare', club: 'Racing du Phare', base: 51, color: '#E9A93A', style: 'vertical' },
      { id: 'tilleuls', club: 'AS Tilleuls', base: 52, color: '#43E0C2', style: 'blocmed' },
      { id: 'meridien', club: 'Méridien SC', base: 55, color: '#C39BFF', style: 'surcharge' }
    ];
  },

  DIVISION_RULES() { return { clubs: 6, up: 2, down: 1, top: 1, bottom: 5 }; },

  // Les cinq adversaires d'une division et d'une saison : tirés avec une graine, pour
  // que la même saison donne toujours la même division.
  clubsDeDivision(division, saison) {
    const r = this.seedR(division * 1009 + saison * 131 + 7);
    const pool = this.CLUBS_DIVISION().slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    return pool.slice(0, this.DIVISION_RULES().clubs - 1).map((c) => ({
      id: c.id, club: c.club, color: c.color, style: c.style,
      ovr: c.base + (4 - division) * 4 + Math.round((r() - 0.5) * 4)
    }));
  },

  // Une division neuve. `deja` : les résultats déjà joués cette saison par le club, quand
  // une ancienne sauvegarde n'avait pas encore de calendrier (on les rejoue dans l'ordre).
  nouvelleDivision(division, saison, deja) {
    const clubs = this.clubsDeDivision(division, saison);
    const ids = ['moi'].concat(clubs.map((c) => c.id));
    let lg = { saison, division, clubs, days: this.schedule(ids, 1), day: 0,
      rows: ids.map((id) => this.emptyRow(id, id === 'moi' ? 'moi' : clubs.find((c) => c.id === id).club)), results: [] };
    (deja || []).forEach((m) => { lg = this.journeeJouee(lg, m.hs, m.as).league; });
    return lg;
  },

  // La division en cours, telle qu'elle est ou telle qu'elle commence. Ne modifie rien :
  // un écran peut l'appeler à chaque rendu. Une ancienne partie (sans calendrier) reprend
  // ses résultats de la saison, pour que le classement ne reparte pas de zéro en cours de route.
  divisionCourante() {
    const s = this.state, lg = s.league;
    if (lg && lg.division === s.division && lg.day < lg.days.length) return lg;
    const rec = s.record || { w: 0, d: 0, l: 0 }, deja = [];
    if (!lg && (s.seasonP || 0) > 0) {
      for (let i = 0; i < rec.w; i++) deja.push({ hs: 1, as: 0 });
      for (let i = 0; i < rec.d; i++) deja.push({ hs: 1, as: 1 });
      for (let i = 0; i < rec.l; i++) deja.push({ hs: 0, as: 1 });
    }
    return this.nouvelleDivision(s.division, s.saison || 1, deja.slice(0, Math.min(deja.length, s.seasonP || 0, 4)));
  },

  // Le prochain match du club : l'adversaire, la journée, et où il se joue.
  prochainMatch() {
    const lg = this.divisionCourante();
    const m = lg.days[lg.day].find((x) => x.home === 'moi' || x.away === 'moi');
    const c = lg.clubs.find((x) => x.id === (m.home === 'moi' ? m.away : m.home));
    const S = this.styles()[c.style] || {};
    return { day: lg.day + 1, total: lg.days.length, domicile: m.home === 'moi',
      opp: { id: c.id, club: c.club, ovr: c.ovr, style: c.style, color: c.color, styleName: S.name || c.style,
        ligue: true, exterieur: m.home !== 'moi' } };
  },

  // Un adversaire compte pour le championnat seulement s'il est celui du calendrier.
  estAuCalendrier(opp) {
    if (!opp || opp.friendly) return false;
    return this.prochainMatch().opp.club === opp.club;
  },

  // Les autres matchs de la journée. Le moteur joue le tien ; ceux-là sont simulés d'après
  // la note et le style : un match complet du moteur prend dix à trente secondes sur un
  // téléphone, et en jouer deux de plus à chaque journée gèlerait l'application.
  // Buts selon une loi de Poisson ; l'écart de note et le duel de styles déplacent la
  // moyenne, le club qui reçoit a un léger avantage. La pente (0,14 but par point de note)
  // est mesurée sur le moteur : un effectif de départ y marque 3 buts et en encaisse 0,2
  // contre une équipe de 7 points plus faible, 1,7 contre 1 avec 3 points d'écart. Les
  // matchs simulés pèsent donc la note autant que les matchs joués.
  resultatRapide(home, away, graine) {
    const r = this.seedR(graine);
    const m = this.matchup(home.style, away.style);
    const lh = Math.max(0.15, Math.min(4.5, 1.4 + (home.ovr - away.ovr) * 0.14 + m * 0.15 + 0.15));
    const la = Math.max(0.15, Math.min(4.5, 1.2 + (away.ovr - home.ovr) * 0.14 - m * 0.15));
    const poisson = (l) => { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= r(); } while (p > L && k < 12); return k - 1; };
    return { hs: poisson(lh), as: poisson(la) };
  },

  // Une journée jouée : ton résultat (buts du club, buts de l'adversaire), puis les autres
  // matchs simulés. Fonction pure : elle rend la division suivante sans toucher à l'état.
  journeeJouee(lg0, buts, encaisses) {
    const lg = JSON.parse(JSON.stringify(lg0));
    const day = lg.days[lg.day], clubOf = (id) => lg.clubs.find((c) => c.id === id);
    day.forEach((m, i) => {
      let hs, as;
      if (m.home === 'moi') { hs = buts; as = encaisses; }
      else if (m.away === 'moi') { hs = encaisses; as = buts; }
      else ({ hs, as } = this.resultatRapide(clubOf(m.home), clubOf(m.away), lg.saison * 7919 + lg.division * 613 + lg.day * 97 + i * 13 + 1));
      this.applyResult(lg.rows, m.home, m.away, hs, as);
      lg.results.push({ day: lg.day + 1, home: m.home, away: m.away, hs, as });
    });
    lg.day++;
    return { league: lg, over: lg.day >= lg.days.length, table: this.table(lg) };
  },

  // Le classement, dans la forme que les écrans lisaient déjà : un club par ligne, `me`
  // pour le tien. Calculé avec standings(), la même règle que les ligues en ligne.
  table(lg0) {
    const s = this.state, lg = lg0 && lg0.rows ? lg0 : this.divisionCourante();
    const S = this.styles();
    return this.standings(lg.rows).map((r) => {
      const me = r.id === 'moi', c = me ? null : lg.clubs.find((x) => x.id === r.id);
      return { id: r.id, me, club: me ? (s.clubName || 'FC TonPseudo') : c.club,
        user: me ? 'Ton club' : ((S[c.style] || {}).name || c.style) + ' · note ' + c.ovr,
        style: me ? null : c.style, ovr: me ? null : c.ovr,
        w: r.w, d: r.d, l: r.l, p: r.p, pts: r.pts, gf: r.gf, ga: r.ga, gd: r.gd, rank: r.rank };
    });
  },

  // Où en est le club, en une phrase vraie. L'ancienne phrase de l'écran disait « bats-le
  // pour prendre la tête » même quand le club de devant avait déjà été joué, et « une
  // victoire et tu remontes » quand il manquait six points. Celle-ci lit le calendrier
  // et les points qui restent en jeu.
  situationDivision(lg0) {
    const lg = lg0 && lg0.rows ? lg0 : this.divisionCourante(), R = this.DIVISION_RULES();
    const t = this.table(lg), i = t.findIndex((r) => r.me), me = t[i];
    const reste = lg.days.length - lg.day, enJeu = reste * 3;
    const pts = (n) => n + ' pt' + (n > 1 ? 's' : '');
    const rang = (r) => (r.rank === 1 ? '1er' : r.rank + 'e');
    const ecart = (n) => (n ? 'à ' + pts(n) : 'à égalité de points');
    const journee = (id) => {
      for (let d = lg.day; d < lg.days.length; d++) {
        if (lg.days[d].some((m) => (m.home === 'moi' && m.away === id) || (m.away === 'moi' && m.home === id))) return d + 1;
      }
      return 0;
    };
    const fin = ' Il reste ' + reste + ' journée' + (reste > 1 ? 's' : '') + ', ' + enJeu + ' points en jeu.';
    if (!lg.day) return 'Saison ' + lg.saison + ' : ' + lg.days.length + ' journées, chaque club rencontre chacun des autres une fois. Les ' + R.up + ' premiers montent, le dernier descend.';
    if (!reste) return 'Saison terminée : ' + rang(me) + ' sur ' + t.length + '.';
    if (i < R.up) {
      const s = t[R.up];                                    // le premier club hors de la zone de montée
      return 'Tu es ' + rang(me) + ', dans la zone de montée. ' + s.club + ' (' + rang(s) + ') est ' + ecart(me.pts - s.pts) + ' derrière.'
        + (journee(s.id) ? ' Tu le joues à la journée ' + journee(s.id) + '.' : '') + fin;
    }
    const c = t[R.up - 1], manque = c.pts - me.pts;         // le dernier club de la zone de montée
    const dernier = R.down && i >= t.length - R.down;
    if (manque > enJeu) {
      if (dernier) {
        const s = t[t.length - R.down - 1];
        return 'La montée n’est plus possible cette saison. Tu es dernier, et le dernier descend : ' + s.club + ' (' + rang(s) + ') est ' + ecart(s.pts - me.pts) + '.' + fin;
      }
      const d = t[t.length - 1];
      return 'La montée n’est plus possible cette saison (' + pts(manque) + ' à reprendre). Le maintien : ' + d.club + ', dernier, est ' + ecart(me.pts - d.pts) + ' derrière toi.' + fin;
    }
    const duel = journee(c.id) ? ' Tu le joues à la journée ' + journee(c.id) + '.' : ' Tu l’as déjà joué : il faut qu’il perde des points ailleurs.';
    if (dernier) {
      const s = t[t.length - R.down - 1];
      return 'Tu es dernier, et le dernier descend : ' + s.club + ' (' + rang(s) + ') est ' + ecart(s.pts - me.pts) + '. La montée est ' + ecart(manque) + ', ' + c.club + ' (' + rang(c) + ').' + fin;
    }
    return 'La montée est ' + ecart(manque) + ' : ' + c.club + ' (' + rang(c) + ').' + duel + fin;
  },

  // Les résultats d'une journée, avec les noms : pour l'écran et pour le journal.
  resultatsDeJournee(day, lg0) {
    const s = this.state, lg = lg0 || this.divisionCourante();
    const nom = (id) => (id === 'moi' ? (s.clubName || 'FC TonPseudo') : lg.clubs.find((c) => c.id === id).club);
    return lg.results.filter((x) => x.day === day).map((x) => ({ home: nom(x.home), away: nom(x.away), hs: x.hs, as: x.as,
      moi: x.home === 'moi' || x.away === 'moi' }));
  }
};

// LinkFoot : les décisions pendant le match (§2 « remplacements, décisions pendant le
// match »), écrites une seule fois pour tous les écrans.
//
// Le match reste 100 % automatique (§14) : le directeur sportif ne touche jamais un
// joueur. Il décide depuis le banc, comme un entraîneur : il remplace, il donne une
// consigne de la voix, il joue une carte de match. L'écran Mon Club le faisait déjà,
// avec des règles écrites dans l'écran ; l'app téléphone, elle, ne pouvait que regarder
// la minute défiler. Les règles sont ici, et les deux écrans les appliquent.
//
// Trois défauts de l'écran Mon Club ont disparu au passage :
//   - un remplaçant entrait sans ses compétences, sa forme ni son moral (joueurMoteur) ;
//   - on pouvait remplacer un joueur expulsé, et l'équipe repassait à onze ;
//   - un joueur remplacé ne gagnait ni XP ni fatigue, et son but, s'il avait marqué
//     avant de sortir, n'était crédité à personne.
const Direct = {
  REGLES_DIRECT() { return { remplacements: 5 }; },

  // Les consignes de la voix, et ce qu'elles changent vraiment dans le moteur (setTP,
  // décisions, fautes). L'effet affiché est celui du code, pas une promesse.
  CRIS() {
    return [
      { id: 'encourager', label: 'Encourager', effet: 'Bonus collectif +1,5 : de meilleures décisions partout sur le terrain' },
      { id: 'exiger', label: 'Exiger plus', effet: 'Pressing plus large, engagement plus haut, jeu plus rapide, tirs plus tentés ; fatigue +8 %' },
      { id: 'resserrer', label: 'Resserrer le bloc', effet: 'Ligne plus basse, bloc plus court, engagement en retrait' },
      { id: 'calme', label: 'Garder la tête froide', effet: 'Moins de fautes et de cartons, passes plus sûres sous la pression' }
    ];
  },

  // ---------- §6 du cahier du match : le coaching tactique en direct ----------
  // Ce que le manager change depuis le banc, avec le vocabulaire d'avant le match. Chaque
  // réglage est lu par le moteur (setTP) ; la formation fait changer les joueurs de place.
  TACTIQUE_DIRECT() {
    return [
      { k: 'formation', label: 'Formation', options: this.FORMATIONS() },
      { k: 'mentalite', label: 'Mentalité', options: this.MENTALITES() },
      { k: 'pressing', label: 'Pressing', options: ['Faible', 'Moyen', 'Intense', 'Très intense'] },
      { k: 'bloc', label: 'Bloc', options: ['Bas', 'Moyen', 'Haut'] },
      { k: 'rythme', label: 'Rythme', options: ['Lent', 'Normal', 'Rapide'] },
      { k: 'largeur', label: 'Largeur', options: ['Étroite', 'Normale', 'Large'] }
    ];
  },

  // La valeur en cours d'un réglage, dans l'état tactique du match { formation, tac, ment }.
  valeurTactique(t, k) {
    if (k === 'formation') return this.FORMATIONS().indexOf(t.formation);
    if (k === 'mentalite') return t.ment;
    const tac = t.tac || {};
    return k === 'pressing' ? tac.press : k === 'bloc' ? tac.line : k === 'rythme' ? tac.tempo : k === 'largeur' ? tac.width : null;
  },

  // Ce qu'un réglage change dans les consignes lues par le moteur. Le bloc, c'est la
  // hauteur de la ligne ET celle où l'on commence à presser.
  patchTactique(k, v) {
    return k === 'pressing' ? { press: v } : k === 'bloc' ? { line: v, engage: v } : k === 'rythme' ? { tempo: v } : k === 'largeur' ? { width: v } : {};
  },

  // Changer de formation pendant le match : qui va où. Les plus défensifs remplissent la
  // défense, les plus offensifs l'attaque (la ligne occupée d'abord, puis le poste de la
  // carte, puis la hauteur sur le terrain) ; dans chaque ligne, chacun garde son côté.
  // Un expulsé passe en dernier : sa place reste vide, devant.
  placementFormation(xi, ancienne, nouvelle) {
    const C = this.formCoords(nouvelle), A = this.formCoords(ancienne) || C;
    if (!C) return null;
    const rang = { GB: 0, DEF: 1, MIL: 2, ATT: 3 };
    const ici = xi.map((p, i) => {
      const n = Number(String(p.slot || '').replace(/\D/g, '')) || 0, c = (A[p.line] || [])[n] || [50, 50];
      return { i, p, fx: c[0], score: (p.red ? 1000 : 0) + rang[p.line] * 10 + (rang[p.pos] != null ? rang[p.pos] : rang[p.line]) * 2 + (100 - c[1]) / 50 };
    });
    const coords = new Array(xi.length), slots = new Array(xi.length);
    ici.filter((q) => q.p.line === 'GB').forEach((q) => { coords[q.i] = { line: 'GB', fx: C.GB[0][0], fy: C.GB[0][1] }; slots[q.i] = 'GB0'; });
    const champ = ici.filter((q) => q.p.line !== 'GB').sort((a, b) => a.score - b.score);
    let k = 0;
    ['DEF', 'MIL', 'ATT'].forEach((l) => {
      const places = (C[l] || []).map((c, n) => ({ c, n })).sort((a, b) => a.c[0] - b.c[0]);
      champ.slice(k, k + places.length).sort((a, b) => a.fx - b.fx).forEach((q, j) => {
        const pl = places[j]; coords[q.i] = { line: l, fx: pl.c[0], fy: pl.c[1] }; slots[q.i] = l + pl.n;
      });
      k += places.length;
    });
    return { coords, slots };
  },

  // §7 L'AUTO COACH : ce que ferait un entraîneur à cette minute, et pourquoi. Une seule
  // liste de règles pour l'app et pour l'écran Mon Club ; en mode Assisté, la première est
  // proposée ; en mode Auto, elle est appliquée. Rien n'est tiré au hasard : la même
  // situation donne la même décision. `e` : l'état du direct (minute, score, onze avec
  // l'énergie et les cartons, banc, changements faits, consigne, cartes, tactique).
  conseilsCoach(e) {
    const out = [], min = e.minute || 0, diff = e.score[0] - e.score[1], v = (e.tactique && e.tactique.valeurs) || {};
    const xi = (e.xi || []).filter((p) => !p.red), champ = xi.filter((p) => p.line !== 'GB');
    const nom = (p) => p.name.split(' ').slice(1).join(' ') || p.name;
    const moy = champ.length ? champ.reduce((a, p) => a + p.energy, 0) / champ.length : 100;
    const cartes = {}; (e.cartes || []).forEach((c) => { cartes[c.id] = c.n; });
    // 1. les remplacements : le plus fatigué, ou un averti qu'un second jaune exclurait
    // jamais un gardien dans le champ ni un joueur de champ dans les buts, et pas un
    // remplaçant tellement plus faible que le changement ferait plus de mal que de bien
    const meilleur = (sortant) => (e.banc || []).filter((b) => !b.inj && (b.pos === 'GB') === (sortant.line === 'GB'))
      .map((b) => { const pen = this.penalty(b.pos, sortant.line); return { b, pen, eff: b.ovr - pen - (pen ? 4 : 0) + ((b.energy != null ? b.energy : 100) - 100) / 10 }; })
      .filter((x) => x.b.ovr - x.pen >= sortant.ovr - 14)
      .sort((a, c) => c.eff - a.eff)[0];
    if ((e.faits || 0) < (e.max || 5) && (e.banc || []).length && min >= 55) {
      const fatigue = champ.filter((p) => p.energy < 52).sort((a, c) => a.energy - c.energy)[0];
      const averti = min >= 60 && diff >= 0 ? champ.filter((p) => p.yc >= 1 && p.line !== 'ATT')[0] : null;
      const out1 = fatigue || averti;
      const r = out1 ? meilleur(out1) : null;
      if (r) out.push({ k: 'sub', slot: out1.slot, id: r.b.id, texte: r.b.name + ' remplace ' + out1.name,
        pourquoi: out1 === fatigue ? nom(out1) + ' est à ' + Math.round(out1.energy) + ' % d’énergie' : nom(out1) + ' est averti, un second jaune laisserait l’équipe à dix' });
      // mené dans le dernier quart d'heure : un attaquant frais à la place d'un attaquant qui
      // n'a pas marqué (le remplaçant prend la place de celui qui sort : un attaquant mis en
      // défense jouerait hors poste, d'où la formation à 4-2-4 plus bas pour ajouter du monde devant)
      if (diff < 0 && min >= 72) {
        const att = champ.filter((p) => p.line === 'ATT' && !p.buts).sort((a, c) => a.energy - c.energy)[0];
        const r2 = att ? meilleur(att) : null;
        if (att && r2 && r2.b.pos === 'ATT' && r2.b.ovr >= att.ovr - 4 && att.energy < 80) out.push({ k: 'sub', slot: att.slot, id: r2.b.id, texte: r2.b.name + ' remplace ' + att.name,
          pourquoi: 'mené à la ' + min + 'e : des jambes fraîches devant' });
      }
    }
    // 2. la tactique selon le score et la minute (le moteur lit chaque réglage)
    if (diff < 0 && min >= 70 && v.mentalite < 5) out.push({ k: 'tac', champ: 'mentalite', v: 5, texte: 'Mentalité : Offensive', pourquoi: 'mené à la ' + min + 'e' });
    if (diff < 0 && min >= 75 && v.pressing < 2 && moy >= 50) out.push({ k: 'tac', champ: 'pressing', v: 2, texte: 'Pressing : Intense', pourquoi: 'récupérer le ballon plus haut' });
    if (diff < 0 && min >= 82) {
      const f = e.tactique && e.tactique.formation, l = f ? this.lignesFormation(f) : null;
      if (l && l[3] < 4 && this.FORMATIONS().indexOf('4-2-4') >= 0) out.push({ k: 'form', formation: '4-2-4', texte: 'Formation : 4-2-4', pourquoi: 'tout pour revenir au score' });
    }
    if (diff > 0 && min >= 80 && v.mentalite > 2) out.push({ k: 'tac', champ: 'mentalite', v: 2, texte: 'Mentalité : Prudente', pourquoi: 'on mène : conserver' });
    if (diff > 0 && min >= 83 && v.bloc > 0) out.push({ k: 'tac', champ: 'bloc', v: 0, texte: 'Bloc : Bas', pourquoi: 'fermer les espaces dans le dos' });
    if (moy < 55 && v.pressing >= 2 && diff >= 0) out.push({ k: 'tac', champ: 'pressing', v: 1, texte: 'Pressing : Moyen', pourquoi: 'l’équipe est à ' + Math.round(moy) + ' % d’énergie' });
    // 3. la voix
    if (diff < 0 && min >= 70 && e.cri !== 'exiger') out.push({ k: 'cri', id: 'exiger', texte: 'Consigne : Exiger plus', pourquoi: 'mené en fin de match' });
    if (diff > 0 && min >= 78 && e.cri !== 'resserrer') out.push({ k: 'cri', id: 'resserrer', texte: 'Consigne : Resserrer le bloc', pourquoi: 'protéger l’avance' });
    // 4. les cartes de match (elles se gagnent : le coach ne les joue qu'au bon moment)
    if (diff === 0 && min >= 80 && cartes.finition > 0) out.push({ k: 'carte', id: 'finition', texte: 'Carte : Boost finition', pourquoi: 'match nul en fin de partie' });
    if (diff < 0 && min >= 60 && cartes.pressing > 0) out.push({ k: 'carte', id: 'pressing', texte: 'Carte : Pressing', pourquoi: 'mené : récupérer haut' });
    return out;
  },

  // Le joueur qui entre, au poste de celui qui sort. Hors de son poste, il perd des
  // points, comme au coup d'envoi. Il entre avec l'énergie qu'il a (sa forme physique),
  // pas avec 100 % d'office : un remplaçant fatigué reste fatigué.
  entrant(sortant, p) {
    const pen = this.penalty(p.pos, sortant.line);
    return Object.assign({}, p, { line: sortant.line, slot: sortant.slot, base: p.ovr, pen, ovr: Math.max(30, p.ovr - pen),
      energy: p.fit != null ? p.fit : 100, yc: 0, red: false });
  },

  // Un remplacement est-il possible ? `m` : { xi, banc, faits, done }, le onze tel qu'il
  // est sur le terrain (énergie, cartons, expulsions lus dans le moteur).
  remplacementInfo(m, slot, id) {
    const R = this.REGLES_DIRECT();
    if (!m || m.done) return { can: false, why: 'Aucun match en cours' };
    if ((m.faits || 0) >= R.remplacements) return { can: false, why: 'Les ' + R.remplacements + ' changements sont faits' };
    const out = (m.xi || []).find((p) => p.slot === slot);
    if (!out) return { can: false, why: 'Poste introuvable' };
    if (out.red) return { can: false, why: out.name + ' est expulsé : un joueur exclu ne se remplace pas' };
    if (!(m.banc || []).some((p) => p.id === id)) return { can: false, why: 'Ce joueur n’est pas sur le banc' };
    return { can: true, why: '' };
  },

  // Comment un match se termine, pour tous les écrans. Un amical nul se départage aux
  // tirs au but (§51) : l'écran Mon Club le faisait, l'app téléphone non, et le même
  // nul rapportait 25 jetons d'un côté, 60 ou 10 de l'autre.
  issueDuMatch(E, amical) {
    const f = E.state(), hs = f.score.H, as = f.score.A;
    let res = hs > as ? 'w' : hs === as ? 'd' : 'l', pso = null;
    if (amical && res === 'd') { pso = E.shootout(); res = pso.win === 'H' ? 'w' : 'l'; }
    const reward = (res === 'w' ? 120 : res === 'd' ? 50 : 20) * (amical ? 0.5 : 1);
    return { f: pso ? E.state() : f, hs, as, res, pso, reward };
  },

  // Qui a joué, et combien de temps : le onze final (énergie et cartons lus dans le
  // moteur, minutes pour ceux qui sont entrés), puis les remplacés, avec leur minute de
  // sortie et leur note à ce moment-là. Les notes suivent le même ordre que les joueurs.
  joueursDuMatch(xi, f, sortis, entres) {
    const fin = xi.map((p, i) => Object.assign({}, p,
      f && f.en ? { energy: f.en[i], yc: f.cards[i][0], red: f.cards[i][1] } : {},
      entres && entres[p.id] != null ? { min: Math.max(1, 90 - entres[p.id]) } : {}));
    const out = (sortis || []).map((p) => Object.assign({}, p, { sorti: true }));
    return { xi: fin.concat(out),
      rat: f && f.rat ? { H: f.rat.H.concat(out.map((p) => (p.note != null ? p.note : 6))), A: f.rat.A } : null };
  },

  // Une décision appliquée au match, en direct comme quand un match interrompu se rejoue.
  // `d` porte tout ce qu'il faut, l'entrant et son descripteur moteur compris : l'effectif
  // a pu changer depuis. Le remplacé est lu dans le moteur à cet instant (énergie, note).
  appliquerDecision(ctx, d) {
    let texte = '';
    if (d.k === 'sub') {
      const f = ctx.E.state(), i = ctx.xi.findIndex((p) => p.slot === d.slot);
      const sortant = Object.assign({}, ctx.xi[i], f.en ? { energy: f.en[i], yc: f.cards[i][0], red: f.cards[i][1], note: f.rat.H[i] } : {});
      ctx.sortis.push(Object.assign(sortant, { min: Math.max(1, d.minute) }));
      ctx.E.sub('H', i, d.desc);
      ctx.xi[i] = d.entrant; ctx.entres[d.entrant.id] = d.minute;
      ctx.banc = ctx.banc.filter((p) => p.id !== d.entrant.id); ctx.faits++;
      texte = d.entrant.name + ' remplace ' + sortant.name + (d.entrant.pen ? ' (hors poste, −' + d.entrant.pen + ')' : '');
    } else if (d.k === 'cri') {
      ctx.E.shout(d.id); ctx.cri = d.id;
      texte = 'Consigne : ' + ((this.CRIS().find((c) => c.id === d.id) || {}).label || d.id);
    } else if (d.k === 'carte') {
      ctx.E.card(d.id);
      texte = 'Carte jouée : ' + ((this.MATCH_CARDS().find((c) => c.id === d.id) || {}).label || d.id);
    } else if (d.k === 'tac') {
      // §6 un réglage changé depuis le banc : le moteur l'applique aux onze joueurs
      const t = ctx.tactique, patch = this.patchTactique(d.champ, d.v);
      t.tac = Object.assign({}, t.tac, patch);
      if (d.champ === 'mentalite') t.ment = d.v;
      ctx.E.reglage('H', patch, d.champ === 'mentalite' ? d.v : null);
      const def = this.TACTIQUE_DIRECT().find((x) => x.k === d.champ);
      texte = (def ? def.label : d.champ) + ' : ' + (def ? def.options[d.v] : d.v);
    } else if (d.k === 'form') {
      // §6 une autre formation : chacun prend sa nouvelle place, le moteur la joue
      ctx.E.formation('H', d.coords);
      ctx.xi = ctx.xi.map((p, i) => Object.assign({}, p, { line: d.coords[i].line, slot: d.slots[i] }));
      ctx.tactique.formation = d.formation;
      texte = 'Formation : ' + d.formation;
    }
    // §7 une décision de l'AUTO COACH dit qu'elle vient de lui, et pourquoi
    ctx.decisions.push({ minute: d.minute, texte: (d.auto ? 'Auto coach : ' : '') + texte + (d.pourquoi ? ' (' + d.pourquoi + ')' : ''), auto: !!d.auto });
  },

  // Un match qu'on suit et sur lequel on décide. Le moteur avance par tranches ; entre
  // deux tranches, l'écran peut remplacer, crier une consigne ou jouer une carte.
  //   avancer(ms)        une tranche de calcul (le match est le même qu'en un bloc
  //                      tant qu'aucune décision n'est prise)
  //   lancer()           le match se déroule seul, au rythme choisi, jusqu'au bout
  //   vitesse(v)         minutes de match par seconde ; Infinity pour le résultat direct
  //   pause(oui)         le temps s'arrête, les décisions restent possibles
  //   ecouter(fn)        fn(état) à chaque minute, à chaque décision, et à la fin
  //   terminer()         joue ce qui reste d'un coup et clôt le match
  // Il n'y a qu'un match en direct à la fois : il est rangé dans this.enDirect, pour
  // qu'un écran qui revient le retrouve au lieu d'en lancer un second.
  //
  // Et il est ENGAGÉ dès le coup d'envoi : la sauvegarde garde de quoi le rejouer
  // (state.matchEngage), avec chaque décision datée en pas de moteur. Fermer l'app pendant
  // le direct ne l'efface donc plus : au retour, reprendreMatch le rejoue à l'identique
  // jusqu'au bout. Sinon, un joueur mené pouvait fuir une défaite en fermant l'app.
  matchEnDirect(opp, opts) {
    const self = this, R = this.REGLES_DIRECT();
    const ctx = this.ouvrirMatch(opp, Object.assign({}, opts, { depart: true }));   // ouvrirMatch refuse un second match
    ctx.banc = this.benchOf(ctx.xi).map((p) => Object.assign({}, p, { energy: p.fit != null ? p.fit : 100, yc: 0, red: false }));
    Object.assign(ctx, { faits: 0, cri: null, decisions: [], sortis: [], entres: {}, ticks: 0 });
    this.setState({ matchEngage: { opp: ctx.opp, amical: ctx.amical, plan: ctx.plan, xi: ctx.xi, oxi: ctx.oxi, banc: ctx.banc,
      depart: ctx.depart, formation: ctx.tactique.formation, decisions: [] } });
    let dernier = { done: false, minute: 0, clock: "1'" }, rythme = 3, enPause = false, resultat = null, promesse = null;
    const ecouteurs = [];
    const vivant = (f) => ctx.xi.map((p, i) => Object.assign({}, p, f.en ? { energy: f.en[i], yc: f.cards[i][0], red: f.cards[i][1], note: f.rat.H[i] } : {}));
    const diffuser = () => { const e = api.etat(); ecouteurs.slice().forEach((fn) => fn(e)); };
    // §6 l'état tactique du match, pour l'écran : la formation et l'index de chaque réglage
    const etatTactique = () => {
      const t = ctx.tactique, valeurs = {};
      self.TACTIQUE_DIRECT().forEach((x) => { valeurs[x.k] = self.valeurTactique(t, x.k); });
      return { formation: t.formation, valeurs };
    };
    // §7 l'AUTO COACH : une fois par minute de match, il lit la situation (conseilsCoach).
    // En Assisté, il propose ; en Auto, il décide, au plus une fois toutes les deux minutes et
    // un changement toutes les quatre, comme un banc qui laisse le temps à ses choix.
    let conseil = null, coachMin = -1, dernierAuto = -99, dernierChangement = -99;
    const jouerConseil = (c, motif) => (c.k === 'sub' ? api.remplacer(c.slot, c.id, motif)
      : c.k === 'tac' ? api.tactique(c.champ, c.v, motif)
        : c.k === 'form' ? api.tactique('formation', self.FORMATIONS().indexOf(c.formation), motif)
          : c.k === 'cri' ? api.crier(c.id, motif) : c.k === 'carte' ? api.carte(c.id, motif) : { ok: false, why: 'Conseil inconnu' });
    const coachTour = () => {
      const mode = self.state.coachMode || 'manuel';
      if (mode === 'manuel' || dernier.done || resultat) { conseil = null; return; }
      if (dernier.minute === coachMin) return;
      coachMin = dernier.minute;
      const e = api.etat(); e.minute = dernier.minute;
      const liste = self.conseilsCoach(e).filter((c) => !(c.k === 'sub' && dernier.minute - dernierChangement < 4));
      if (mode === 'assiste') { const c = liste[0] || null; if ((c && c.texte) !== (conseil && conseil.texte)) { conseil = c; diffuser(); } return; }
      if (!liste.length || dernier.minute - dernierAuto < 2) return;
      for (const c of liste) {
        const r = jouerConseil(c, { auto: true, pourquoi: c.pourquoi });
        if (r.ok) { dernierAuto = dernier.minute; if (c.k === 'sub') dernierChangement = dernier.minute; break; }
      }
    };
    // décider : appliquer au moteur, puis l'écrire dans le match engagé (avec `plus`, dans le même setState)
    const decider = (d, plus, motif) => {
      d.t = ctx.ticks; d.minute = dernier.minute;
      if (motif && motif.auto) d.auto = true;
      if (motif && motif.pourquoi) d.pourquoi = motif.pourquoi;
      conseil = null;
      self.appliquerDecision(ctx, d);
      const m = self.state.matchEngage;
      self.setState(Object.assign({}, plus || {}, m ? { matchEngage: Object.assign({}, m, { decisions: m.decisions.concat([d]) }) } : {}));
      diffuser();
      return { ok: true };
    };
    // ---- le spectacle : les images du moteur montrées en temps réel autour des actions ----
    const S = { on: false, mode: 'lecture', tVue: 0, fin: 6, finPrec: 0, scanT: -1, vu: null, gel: null, vuT: -1, tourT: Date.now() };
    const DANGER = { pen: 1, corner: 1, fkd: 1, fkc: 1 };
    // la première image d'une action qui mérite d'être vue, parmi les images pas encore lues
    const chercher = () => {
      const imgs = ctx.E.images(); let prec = null, trouve = null;
      for (const f of imgs) {
        if (f.t > S.scanT) {
          const tir = f.fl && f.fl[4] === 'shot' && !(prec && prec.fl && prec.fl[4] === 'shot');
          const arrete = f.set && DANGER[f.set] && !(prec && prec.set === f.set);
          const ev = f.ev && f.ev.some((e) => e.k === 'goal' || e.k === 'card');
          if ((tir || arrete || ev) && !trouve) trouve = f;
          S.scanT = f.t;
        }
        prec = f;
      }
      return trouve;
    };
    const finImages = () => { const imgs = ctx.E.images(); return imgs.length ? imgs[imgs.length - 1].t : 0; };
    // un tour de la boucle en spectacle ; vrai quand le match est fini et entièrement montré
    const tourSpectacle = (dt) => {
      const vLect = 1.25 * rythme / 1.5, limite = Date.now() + 25;   // ×1 : 1,25 fois le temps réel
      if (S.mode === 'saut') {
        let f = null;
        while (!dernier.done && !f && Date.now() < limite) { api.avancer(6); f = chercher(); }
        if (!f && dernier.done) f = chercher();
        if (f) {
          const imgs = ctx.E.images();
          S.mode = 'lecture'; S.gel = null;
          S.tVue = Math.max(f.t - 7, S.finPrec, imgs.length ? imgs[0].t : 0); S.fin = f.t + 4.5;
          S.vuT = S.tVue - 0.001;   // ce qui s'est passé pendant le saut ne se rejoue pas à l'écran
          diffuser();
        } else if (dernier.done) return true;
        return false;
      }
      if (!enPause) S.tVue += dt * vLect;
      // le moteur garde à peine plus d'une seconde d'avance : une décision prise en regardant
      // s'applique au moment qu'on voit, à une seconde près
      const manque = Math.ceil((S.tVue + 1.2 - finImages()) / 0.1);
      if (manque > 0 && !dernier.done) { api.avancerPas(Math.min(manque, 400)); const f2 = chercher(); if (f2) S.fin = Math.max(S.fin, f2.t + 4.5); }
      const f3 = chercher(); if (f3) S.fin = Math.max(S.fin, f3.t + 4.5);
      if (dernier.done && S.tVue >= finImages()) return true;
      if (S.tVue > S.fin && !dernier.done) {
        S.mode = 'saut'; S.finPrec = S.fin;
        const v = api.vue(); S.gel = { A: v.A, B: v.B, fr: v.fr };
        diffuser();
      }
      return false;
    };
    const api = {
      opp: ctx.opp, amical: ctx.amical, meteo: ctx.E.weather ? ctx.E.weather().id : 'soleil',
      // le nom court d'un joueur (code 0 à 21), pour l'écrire au-dessus de sa tête
      nomJoueur(code) {
        if (code >= 11) return 'n°' + (code - 10) + ' · ' + ctx.opp.club.split(' ').slice(-1)[0];   // l'adversaire n'a pas de nom propre
        const p = ctx.E.player ? ctx.E.player(code) : null; return p ? p.short : '';
      },
      etat() {
        if (resultat) return { done: true, fini: true, resultat, decisions: ctx.decisions.slice(), opp: ctx.opp, amical: ctx.amical };
        const f = ctx.E.state();
        // en spectacle, l'écran est quelques secondes derrière le moteur : la minute, le score
        // et le fil sont ceux de l'image montrée, pour ne pas annoncer un but avant qu'on le voie
        const vu = S.on ? S.vu : null;
        const log = vu ? ctx.E.log.filter((l) => l.t <= vu.t + 1e-6) : ctx.E.log;
        return { done: false, fini: false, opp: ctx.opp, amical: ctx.amical,
          minute: vu ? Math.min(90, Math.floor(vu.m / 60)) : dernier.minute, clock: vu ? ctx.E.clockLabel(vu.m, vu.h) : dernier.clock,
          score: vu && vu.sc ? [vu.sc[0], vu.sc[1]] : [f.score.H, f.score.A], poss: f.poss, tirs: [f.st.H.sh, f.st.A.sh],
          xi: vivant(f), banc: ctx.banc.slice(), faits: ctx.faits, max: R.remplacements, cri: ctx.cri,
          cartes: self.MATCH_CARDS().map((c) => Object.assign({}, c, { n: (self.state.inv || {})[c.id] || 0 })),
          decisions: ctx.decisions.slice(), fil: log.slice(-6).map((l) => ({ text: l.text, k: l.k, s: l.s })),
          vitesse: rythme, pause: enPause, spectacle: S.on, saut: S.on && S.mode === 'saut',
          tactique: etatTactique(),
          coach: { mode: self.state.coachMode || 'manuel', conseil: conseil ? { texte: conseil.texte, pourquoi: conseil.pourquoi } : null } };
      },
      avancer(ms) {
        if (!dernier.done) { dernier = ctx.E.runFor(ms || 40); ctx.ticks += dernier.pas; coachTour(); }
        return dernier;
      },
      // les compteurs du moteur à cet instant (actions, récupérations, présence dans la
      // surface) : de quoi montrer ce qu'un changement tactique a changé (§40)
      compteurs() { return Object.assign({}, ctx.E.state().cnt || {}); },
      // exactement n pas de moteur (un dixième de seconde de jeu chacun)
      avancerPas(n) {
        if (!dernier.done && n > 0) { dernier = ctx.E.runTicks(n); ctx.ticks += dernier.pas; coachTour(); }
        return dernier;
      },
      // §6 changer un réglage depuis le banc (k : formation, mentalite, pressing, bloc,
      // rythme, largeur ; v : l'index de l'option dans TACTIQUE_DIRECT)
      tactique(k, v, motif) {
        if (dernier.done || resultat) return { ok: false, why: 'Le match est fini' };
        const def = self.TACTIQUE_DIRECT().find((x) => x.k === k);
        if (!def) return { ok: false, why: 'Réglage inconnu' };
        if (!(v >= 0 && v < def.options.length && v === Math.round(v))) return { ok: false, why: 'Valeur hors limites' };
        if (self.valeurTactique(ctx.tactique, k) === v) return { ok: false, why: 'C’est déjà le réglage en cours' };
        if (k === 'formation') {
          const f = def.options[v], pl = self.placementFormation(ctx.xi, ctx.tactique.formation, f);
          if (!pl) return { ok: false, why: 'Formation inconnue' };
          return decider({ k: 'form', formation: f, coords: pl.coords, slots: pl.slots }, null, motif);
        }
        return decider({ k: 'tac', champ: k, v }, null, motif);
      },
      // §7 qui décide sur le banc : 'manuel', 'assiste' (l'IA propose) ou 'auto' (l'IA décide)
      coach(mode) {
        if (['manuel', 'assiste', 'auto'].indexOf(mode) < 0) return { ok: false, why: 'Mode inconnu' };
        self.setState({ coachMode: mode }); conseil = null; coachMin = -1; coachTour(); diffuser();
        return { ok: true };
      },
      // le conseil proposé en mode Assisté, accepté par le manager
      appliquerConseil() {
        if (!conseil) return { ok: false, why: 'Aucun conseil en attente' };
        return jouerConseil(conseil, { pourquoi: conseil.pourquoi });
      },
      remplacer(slot, id, motif) {
        const xi = vivant(ctx.E.state());
        const info = self.remplacementInfo({ xi, banc: ctx.banc, faits: ctx.faits, done: dernier.done || !!resultat }, slot, id);
        if (!info.can) return { ok: false, why: info.why };
        const entrant = self.entrant(xi.find((p) => p.slot === slot), ctx.banc.find((p) => p.id === id));
        self.buzz(25);
        return decider({ k: 'sub', slot, entrant, desc: self.joueurMoteur(entrant) }, null, motif);
      },
      crier(id, motif) {
        if (!self.CRIS().some((x) => x.id === id)) return { ok: false, why: 'Consigne inconnue' };
        if (dernier.done || resultat) return { ok: false, why: 'Le match est fini' };
        if (ctx.cri === id) return { ok: false, why: 'C’est déjà la consigne en cours' };
        return decider({ k: 'cri', id }, null, motif);
      },
      carte(id, motif) {
        const c = self.MATCH_CARDS().find((x) => x.id === id), inv = Object.assign({}, self.state.inv || {});
        if (!c) return { ok: false, why: 'Carte inconnue' };
        if (dernier.done || resultat) return { ok: false, why: 'Le match est fini' };
        if (!(inv[id] > 0)) return { ok: false, why: 'Aucune carte ' + c.label + ' en réserve' };
        inv[id]--;
        self.buzz([30, 30, 60]);
        return decider({ k: 'carte', id }, { inv }, motif);   // la carte sort de la réserve dans la même écriture
      },
      vitesse(v) { rythme = v > 0 ? v : 3; diffuser(); },
      pause(oui) { enPause = !!oui; diffuser(); },
      ecouter(fn) { ecouteurs.push(fn); return () => { const k = ecouteurs.indexOf(fn); if (k >= 0) ecouteurs.splice(k, 1); }; },
      terminer() {
        if (resultat) return resultat;
        if (!dernier.done) { ctx.E.finish(); dernier = { done: true, minute: 90, clock: 'FIN' }; }
        self.enDirect = null;
        resultat = self.cloreMatch(ctx);
        resultat.decisions = ctx.decisions.slice();
        diffuser();
        return resultat;
      },
      // Le match se déroule seul. Le rythme se compte en minutes de match par seconde
      // réelle : à 3, un match dure trente secondes, le temps de voir venir et de décider.
      // §22 « je regarde les 22 joueurs jouer » : la vue 3D de l'app. Le moteur calcule
      // toujours en rapide (le match est le même, décisions comprises) et garde ses images ;
      // l'écran les montre en temps réel autour de chaque action (frappe, penalty, corner,
      // coup franc direct, carton, but) et saute le reste, comme les temps forts de Mon Club.
      spectacle(oui) {
        if (!!oui === S.on) return;
        S.on = !!oui;
        if (S.on) {
          ctx.E.capture(900);
          Object.assign(S, { mode: 'lecture', tVue: 0, fin: 6, finPrec: 0, scanT: -1, vu: null, gel: null, vuT: -1 });
          if (rythme === 3) rythme = 1.5;   // regarder se fait au rythme réel (×1), pas en accéléré
        }
        else ctx.E.capture(0);
        diffuser();
      },
      // l'image à montrer maintenant : { A, B, fr, evs, saut }
      vue() {
        const imgs = ctx.E.images();
        if (!S.on || !imgs.length) return { A: null };
        if (S.mode === 'saut' && S.gel) return Object.assign({}, S.gel, { evs: null, saut: true });
        const vLect = 1.25 * (rythme === Infinity ? 4 : rythme) / 1.5;
        let t = S.tVue;
        if (!enPause && !resultat) t += Math.min(0.2, (Date.now() - S.tourT) / 1000) * vLect;
        let lo = 0, hi = imgs.length - 1;
        if (t <= imgs[0].t) hi = 0; else if (t >= imgs[hi].t) lo = hi;
        else while (hi - lo > 1) { const mi = (lo + hi) >> 1; if (imgs[mi].t <= t) lo = mi; else hi = mi; }
        const A = imgs[lo], B = imgs[Math.min(imgs.length - 1, lo + 1)], fr = B.t > A.t ? Math.max(0, Math.min(1, (t - A.t) / (B.t - A.t))) : 0;
        const evs = [];
        for (const f of imgs) { if (f.t > S.vuT && f.t < A.t && f.ev) f.ev.forEach((e) => evs.push(e)); }
        const changeMinute = !S.vu || Math.floor(S.vu.m / 60) !== Math.floor(A.m / 60) || (S.vu.sc && A.sc && (S.vu.sc[0] !== A.sc[0] || S.vu.sc[1] !== A.sc[1]));
        S.vuT = A.t; S.vu = A;
        if (changeMinute) diffuser();
        return { A, B, fr, evs, saut: false };
      },
      lancer() {
        if (promesse) return promesse;
        promesse = new Promise((resolve) => {
          let t = Date.now(), cible = dernier.minute;
          const tour = () => {
            if (resultat) { resolve(resultat); return; }
            const now = Date.now(), dt = Math.min(1, (now - t) / 1000); t = now;
            if (S.on && rythme !== Infinity) { if (tourSpectacle(dt)) { resolve(api.terminer()); return; } S.tourT = Date.now(); setTimeout(tour, 30); return; }
            if (!enPause) cible = rythme === Infinity ? 999 : cible + dt * rythme;
            const avant = dernier.minute, limite = Date.now() + 30;
            while (!dernier.done && dernier.minute < cible && Date.now() < limite) api.avancer(rythme === Infinity ? 30 : 8);
            if (dernier.done) { resolve(api.terminer()); return; }
            if (dernier.minute !== avant) diffuser();
            setTimeout(tour, rythme === Infinity ? 0 : 40);
          };
          tour();
        });
        return promesse;
      }
    };
    this.enDirect = api;
    return api;
  },

  // Le match engagé puis interrompu (l'app fermée pendant le direct) : rejoué à
  // l'identique, même moteur au coup d'envoi, même graine, chaque décision au même pas,
  // puis joué jusqu'au bout et clos comme n'importe quel match.
  reprendreMatch() {
    const m = this.state.matchEngage;
    if (!m || this.enDirect || !m.depart) return null;
    const rnd = this.seedR(m.depart.seed);
    for (let i = 0; i < m.depart.tirages; i++) rnd();
    const E = this.makeEngine(Object.assign(JSON.parse(JSON.stringify(m.depart.cfg)), { rnd }));
    const H0 = m.depart.cfg.sides.H;
    const ctx = { E, xi: m.xi.slice(), oxi: m.oxi, opp: m.opp, plan: m.plan, amical: m.amical, banc: m.banc.slice(),
      faits: 0, cri: null, decisions: [], sortis: [], entres: {}, ticks: 0,
      tactique: { formation: m.formation || this.state.formation, tac: Object.assign({}, H0.tac), ment: H0.ment } };
    (m.decisions || []).forEach((d) => {
      const r = E.runTicks(d.t - ctx.ticks); ctx.ticks += r.pas;
      this.appliquerDecision(ctx, d);
    });
    E.finish();
    const res = this.cloreMatch(ctx);
    res.decisions = ctx.decisions.slice();
    res.repris = true;
    this.setState({ lastGain: 'Match interrompu contre ' + m.opp.club + ', joué jusqu’au bout : ' + res.score.join('-')
      + (this.state.lastGain ? ' · ' + this.state.lastGain : '') });
    return res;
  }
};

// LinkFoot : le match en 3D (§28 à §31, §49, §50, §53, §54 du cahier du match ; pack 3D
// du cahier design §11 dans pack3d).
//
// Un seul rendu pour deux écrans : l'écran Mon Club (three.js chargé depuis le CDN) et
// l'app téléphone (three.js de npm, dans un GLView). Il ne décide rien. Il lit les images
// que le moteur enregistre dix fois par seconde de jeu : les positions des 22 joueurs, le
// ballon et sa hauteur, le porteur, la trajectoire en cours, les joueurs au sol, le
// plongeon du gardien, le coup de pied arrêté, et les événements (but, carton, clameur).
// Ce que l'on voit est donc ce que le moteur a décidé, rien de plus.
//
// Tout est construit en géométrie, sans image ni modèle téléchargé : rien à charger, rien
// qui dépende d'un fichier tiers. Les rares textures (texte des panneaux, face du pack)
// sont peintes pixel par pixel en JavaScript pur (peintre), parce que l'app native n'a
// pas de <canvas> pour écrire du texte : le même code donne la même image dans un
// navigateur et sur téléphone.
//
//   const v = club.stade3d(THREE, { renderer, largeur, hauteur, maillot, adverse, meteo })
//   v.image(A, B, fr, evs)   A, B : deux images du moteur, fr entre 0 et 1 ; evs : les
//                            événements d'images sautées (avance rapide), facultatif
//   v.taille(l, h)           v.projeter(code) → { x, y } en pixels    v.detruire()
const Stade3D = {
  stade3d(T, o) {
    o = o || {};
    const PI = Math.PI, cl = (v, a, b) => Math.max(a, Math.min(b, v));
    const meteo = o.meteo || 'soleil', nuit = meteo === 'nocturne' || meteo === 'nuit';
    const scene = new T.Scene();
    const fond = nuit ? '#060A09' : meteo === 'pluie' ? '#1A2226' : meteo === 'neige' ? '#2A3236' : '#0B1210';
    scene.background = new T.Color(fond);
    scene.fog = new T.Fog(fond, 110, 250);
    const jetables = [];   // géométries et matériaux à libérer
    const g = (x) => { jetables.push(x); return x; };
    const mat = (c, opts) => g(new T.MeshLambertMaterial(Object.assign({ color: c }, opts || {})));
    const basique = (c, opts) => g(new T.MeshBasicMaterial(Object.assign({ color: c }, opts || {})));

    // ---- la lumière : des projecteurs, plus francs de nuit ----
    scene.add(new T.HemisphereLight(nuit ? '#A8C0D0' : '#E4F2FF', '#1C2A20', nuit ? 0.62 : 0.9));
    const cle = new T.DirectionalLight(nuit ? '#EEF4FF' : '#FFF6E2', nuit ? 1.55 : 1.9);
    cle.position.set(40, 80, 25);
    if (o.ombres) {
      cle.castShadow = true; cle.shadow.mapSize.set(1024, 1024); cle.shadow.bias = -0.0008;
      Object.assign(cle.shadow.camera, { left: -60, right: 60, top: 75, bottom: -75, near: 10, far: 220 });
    }
    scene.add(cle);
    const contre = new T.DirectionalLight('#9FD8FF', nuit ? 0.35 : 0.25); contre.position.set(-40, 50, -30); scene.add(contre);

    // ---- la pelouse : bandes tondues et lignes, en géométrie ----
    const sol = new T.Mesh(g(new T.PlaneGeometry(170, 220)), mat(nuit ? '#17361C' : '#1E4424'));
    sol.rotation.x = -PI / 2; sol.position.y = -0.03; scene.add(sol);
    const bandes = 16, LONG = 115, lb = LONG / bandes;
    const vertA = mat(nuit ? '#2E7634' : '#3B8E40'), vertB = mat(nuit ? '#286A2E' : '#337F38');
    const bandeGeo = g(new T.PlaneGeometry(78, lb));
    for (let i = 0; i < bandes; i++) {
      const m = new T.Mesh(bandeGeo, i % 2 ? vertA : vertB);
      m.rotation.x = -PI / 2; m.position.set(0, 0, -LONG / 2 + lb * (i + 0.5)); m.receiveShadow = !!o.ombres; scene.add(m);
    }
    const blanc = basique('#F4F7F2');
    const ligne = (x0, z0, x1, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0), m = new T.Mesh(g(new T.PlaneGeometry(L, 0.16)), blanc);
      m.rotation.x = -PI / 2; m.rotation.z = -Math.atan2(z1 - z0, x1 - x0);
      m.position.set((x0 + x1) / 2, 0.012, (z0 + z1) / 2); scene.add(m);
    };
    const anneau = (x, z, r, debut, ouverture) => {
      const m = new T.Mesh(g(new T.RingGeometry(r - 0.08, r + 0.08, 64, 1, debut || 0, ouverture || PI * 2)), blanc);
      m.rotation.x = -PI / 2; m.position.set(x, 0.012, z); scene.add(m);
    };
    const point = (x, z) => { const m = new T.Mesh(g(new T.CircleGeometry(0.2, 16)), blanc); m.rotation.x = -PI / 2; m.position.set(x, 0.013, z); scene.add(m); };
    ligne(-34, -52.5, 34, -52.5); ligne(-34, 52.5, 34, 52.5); ligne(-34, -52.5, -34, 52.5); ligne(34, -52.5, 34, 52.5); ligne(-34, 0, 34, 0);
    anneau(0, 0, 9.15); point(0, 0);
    const alpha = Math.acos(5.5 / 9.15);
    [-1, 1].forEach((d) => {
      const zg = d * 52.5, zs = zg - d * 16.5, zp = zg - d * 5.5;
      ligne(-20.16, zg, -20.16, zs); ligne(20.16, zg, 20.16, zs); ligne(-20.16, zs, 20.16, zs);
      ligne(-9.16, zg, -9.16, zp); ligne(9.16, zg, 9.16, zp); ligne(-9.16, zp, 9.16, zp);
      point(0, zg - d * 11);
      // l'arc de la surface, tourné vers le centre du terrain
      anneau(0, zg - d * 11, 9.15, d < 0 ? -PI / 2 - alpha : PI / 2 - alpha, 2 * alpha);
    });
    [[-34, -52.5, 0], [34, -52.5, PI / 2], [34, 52.5, PI], [-34, 52.5, -PI / 2]].forEach(([x, z, a]) => anneau(x, z, 1, a - PI / 2, PI / 2));

    // ---- les buts et leurs filets ----
    const poteauMat = g(new T.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.4 }));
    const filetMat = g(new T.LineBasicMaterial({ color: '#E8EEF2', transparent: true, opacity: 0.55 }));
    const filets = {};
    [-1, 1].forEach((d) => {
      const but = new T.Group();
      [-3.66, 3.66].forEach((x) => { const p = new T.Mesh(g(new T.CylinderGeometry(0.07, 0.07, 2.44, 10)), poteauMat); p.position.set(x, 1.22, 0); p.castShadow = !!o.ombres; but.add(p); });
      const barre = new T.Mesh(g(new T.CylinderGeometry(0.07, 0.07, 7.46, 10)), poteauMat); barre.rotation.z = PI / 2; barre.position.set(0, 2.44, 0); but.add(barre);
      const pts = [], P = 2.2;
      for (let i = 0; i <= 14; i++) { const x = -3.66 + i * 7.32 / 14; pts.push(x, 2.44, 0, x, 1.9, d * P, x, 1.9, d * P, x, 0, d * P); }
      for (let j = 0; j <= 6; j++) { const y = j * 1.9 / 6; pts.push(-3.66, y, d * P, 3.66, y, d * P); }
      for (let j = 1; j <= 4; j++) { const z = d * P * j / 4; pts.push(-3.66, 2.44 - (2.44 - 1.9) * j / 4, z, 3.66, 2.44 - (2.44 - 1.9) * j / 4, z); }
      [-3.66, 3.66].forEach((x) => { for (let j = 0; j <= 6; j++) { const y = j * 2.44 / 6; pts.push(x, y, 0, x, Math.min(y, 1.9), d * P); } });
      const geo = g(new T.BufferGeometry()); geo.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
      const filet = new T.LineSegments(geo, filetMat); but.add(filet); filets[d] = { filet, choc: 0 };
      but.position.z = d * 52.5; scene.add(but);
    });

    // ---- les panneaux, les tribunes, le public, les projecteurs ----
    let texPub = null;
    try { texPub = g(this.texture3d(T, this.panneauPub())); texPub.wrapS = T.RepeatWrapping; } catch (e) { texPub = null; }
    const panneau = (L, x, z, rot) => {
      let m2;
      if (texPub) { const t = texPub.clone(); t.needsUpdate = true; t.repeat.set(L / 42, 1); jetables.push(t); m2 = basique('#FFFFFF', { map: t }); }
      else m2 = basique('#2ECC71');
      const m = new T.Mesh(g(new T.BoxGeometry(L, 0.9, 0.12)), m2); m.position.set(x, 0.45, z); m.rotation.y = rot; scene.add(m);
    };
    panneau(105, -39, 0, PI / 2); panneau(105, 39, 0, -PI / 2);
    panneau(28, -21, -56.5, 0); panneau(28, 21, -56.5, 0); panneau(28, -21, 56.5, PI); panneau(28, 21, 56.5, PI);
    const gradins = mat('#1A2420'), toit = mat('#2A3530');
    const places = [];   // [x, y, z] de chaque spectateur, pour l'InstancedMesh
    const tribune = (L, rangs, axe, signe, dist) => {
      for (let k = 0; k < rangs; k++) {
        const b = new T.Mesh(g(new T.BoxGeometry(axe === 'x' ? 2.2 : L, 1.1, axe === 'x' ? L : 2.2)), gradins);
        const off = dist + k * 2.2;
        if (axe === 'x') b.position.set(signe * off, 0.55 + k * 1.1, 0); else b.position.set(0, 0.55 + k * 1.1, signe * off);
        scene.add(b);
        const n = Math.floor(L / 1.15);
        for (let i = 0; i < n; i++) {
          const u = -L / 2 + (i + 0.5) * L / n + (Math.random() - 0.5) * 0.3;
          if (axe === 'x') places.push([signe * (off - 0.3), 1.45 + k * 1.1, u]); else places.push([u, 1.45 + k * 1.1, signe * (off - 0.3)]);
        }
      }
      const t2 = new T.Mesh(g(new T.BoxGeometry(axe === 'x' ? 10 : L + 6, 0.5, axe === 'x' ? L + 6 : 10)), toit);
      if (axe === 'x') t2.position.set(signe * (dist + rangs * 2.2 - 3), 3 + rangs * 1.1 + 4, 0); else t2.position.set(0, 3 + rangs * 1.1 + 4, signe * (dist + rangs * 2.2 - 3));
      scene.add(t2);
    };
    // trois tribunes : la caméra est dans la quatrième, côté +X, comme à la télévision
    tribune(118, 7, 'x', -1, 43); tribune(80, 6, 'z', -1, 61); tribune(80, 6, 'z', 1, 61);
    const maillot = o.maillot || { c1: '#2ECC71', c2: '#0B1210' }, adverse = o.adverse || '#2F8FE0';
    const tons = [maillot.c1, maillot.c1, '#F2F4F7', adverse, '#F2C66B', '#C8D0D8', maillot.c2 || '#0B1210', '#FF6B5A'];
    const publicGeo = g(new T.BoxGeometry(0.55, 0.75, 0.45)), publicMat = g(new T.MeshLambertMaterial({ color: '#FFFFFF' }));
    const foule = new T.InstancedMesh(publicGeo, publicMat, places.length);
    const mx = new T.Matrix4(), coul = new T.Color();
    places.forEach((p, i) => { mx.makeTranslation(p[0], p[1], p[2]); foule.setMatrixAt(i, mx); coul.set(tons[(i * 7 + (i >> 3)) % tons.length]); foule.setColorAt(i, coul); });
    scene.add(foule);
    const lampe = basique('#FFFBEA');
    [[-48, -68], [48, -68], [-48, 68], [48, 68]].forEach(([x, z]) => {
      const mat2 = new T.Mesh(g(new T.CylinderGeometry(0.45, 0.7, 34, 8)), toit); mat2.position.set(x, 17, z); scene.add(mat2);
      const l = new T.Mesh(g(new T.BoxGeometry(6, 3, 0.6)), lampe); l.position.set(x, 34, z); l.lookAt(0, 0, 0); scene.add(l);
    });

    // ---- les joueurs : des footballeurs en géométrie, animés par leur vitesse ----
    const PEAUX = ['#F1C7A0', '#D9A273', '#A86F45', '#7A4A2C', '#5C3A22'], CHEV = ['#1E150F', '#0F0F0F', '#5A3A1E', '#C9A050', '#2E2118', '#7A2E1A'];
    const cyl = (r1, r2, h) => { const geo = g(new T.CylinderGeometry(r1, r2, h, 10)); geo.translate(0, -h / 2, 0); return geo; };
    const G = {
      tronc: g(new T.CylinderGeometry(0.21, 0.17, 0.6, 12)), tete: g(new T.SphereGeometry(0.14, 16, 12)),
      cheveux: g(new T.SphereGeometry(0.147, 16, 8, 0, PI * 2, 0, PI * 0.5)), cou: g(new T.CylinderGeometry(0.06, 0.07, 0.1, 8)),
      bras: cyl(0.06, 0.05, 0.3), avantBras: cyl(0.05, 0.042, 0.28), main: g(new T.SphereGeometry(0.05, 8, 6)),
      short: g(new T.BoxGeometry(0.4, 0.22, 0.25)), cuisse: cyl(0.078, 0.066, 0.42), tibia: cyl(0.062, 0.05, 0.42),
      chaussure: g(new T.BoxGeometry(0.1, 0.075, 0.25))
    };
    const lambert = {};
    const M = (c) => lambert[c] || (lambert[c] = mat(c));
    const ombreJoueur = basique('#000000', { transparent: true, opacity: 0.28, depthWrite: false });
    const ombreGeo = g(new T.CircleGeometry(0.42, 18));
    const ECH = 1.3;   // un peu plus grands que nature : lisibles sur un téléphone
    const fabrique = (code) => {
      const H = code < 11, i = H ? code : code - 11, gardien = i === 0;
      const tShirt = gardien ? (H ? '#F2C66B' : '#2B2F36') : H ? maillot.c1 : adverse;
      const tManche = gardien ? tShirt : H && maillot.pat === 'manches' ? (maillot.c2 || tShirt) : tShirt;
      const tShort = H ? (maillot.c2 && maillot.c2 !== maillot.c1 ? maillot.c2 : '#101814') : '#F2F4F7';
      const tChaus = H ? (gardien ? '#2B2F36' : maillot.c1) : adverse, peau = PEAUX[(i * 3 + (H ? 0 : 2)) % PEAUX.length];
      const racine = new T.Group(), corps = new T.Group(); corps.scale.setScalar(ECH); racine.add(corps);
      const hanche = new T.Group(); hanche.position.y = 0.92; corps.add(hanche);
      const jambe = (cote) => {
        const cuisse = new T.Group(); cuisse.position.set(cote * 0.1, -0.06, 0); hanche.add(cuisse);
        cuisse.add(new T.Mesh(G.cuisse, M(peau)));
        const genou = new T.Group(); genou.position.y = -0.42; cuisse.add(genou);
        const tib = new T.Mesh(G.tibia, M(tChaus)); genou.add(tib);
        const ch = new T.Mesh(G.chaussure, M(['#141414', '#F2F4F7', '#FF4757', '#1B4DFF'][(i + (H ? 0 : 1)) % 4])); ch.position.set(0, -0.44, 0.06); genou.add(ch);
        return { cuisse, genou };
      };
      const jg = jambe(-1), jd = jambe(1);
      const sh = new T.Mesh(G.short, M(tShort)); sh.position.y = -0.03; hanche.add(sh);
      const buste = new T.Group(); hanche.add(buste);
      const tr = new T.Mesh(G.tronc, M(tShirt)); tr.position.y = 0.3; buste.add(tr);
      const cou = new T.Mesh(G.cou, M(peau)); cou.position.y = 0.63; buste.add(cou);
      const tete = new T.Group(); tete.position.y = 0.78; buste.add(tete);
      tete.add(new T.Mesh(G.tete, M(peau)));
      const ch2 = new T.Mesh(G.cheveux, M(CHEV[(i * 5 + (H ? 1 : 3)) % CHEV.length])); ch2.position.y = 0.02; ch2.rotation.x = -0.25; tete.add(ch2);
      const bras = (cote) => {
        const ep = new T.Group(); ep.position.set(cote * 0.25, 0.56, 0); buste.add(ep);
        ep.add(new T.Mesh(G.bras, M(tManche)));
        const coude = new T.Group(); coude.position.y = -0.3; ep.add(coude);
        coude.add(new T.Mesh(G.avantBras, M(gardien ? '#F2F4F7' : peau)));
        const main = new T.Mesh(G.main, M(gardien ? '#F2F4F7' : peau)); main.position.y = -0.3; coude.add(main);
        return { ep, coude };
      };
      const bg = bras(-1), bd = bras(1);
      const ombre = new T.Mesh(ombreGeo, ombreJoueur); ombre.rotation.x = -PI / 2; ombre.position.y = 0.02; racine.add(ombre);
      racine.traverse((m) => { if (m.isMesh && m !== ombre) m.castShadow = !!o.ombres; });
      scene.add(racine);
      return { code, H, gardien, racine, corps, hanche, buste, tete, jg, jd, bg, bd, ombre, x: 0, z: 0, cap: H ? PI : 0, phase: Math.random() * 6, vit: 0, frappe: 0, fete: 0, visible: true };
    };
    const joueurs = []; for (let c = 0; c < 22; c++) joueurs.push(fabrique(c));

    // ---- le ballon, son ombre, l'anneau du porteur, la trajectoire ----
    // un icosaèdre subdivisé : les triangles qui touchent ses douze sommets d'origine font les douze pentagones noirs
    const ballonGeo = g(new T.IcosahedronGeometry(0.3, 2));
    {
      const pos = ballonGeo.attributes.position, cols = [], ico = new T.IcosahedronGeometry(1, 0), sommets = [];
      for (let k = 0; k < ico.attributes.position.count; k++) sommets.push(new T.Vector3().fromBufferAttribute(ico.attributes.position, k).normalize());
      ico.dispose();
      const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
      for (let f = 0; f < pos.count; f += 3) {
        a.fromBufferAttribute(pos, f); b.fromBufferAttribute(pos, f + 1); c.fromBufferAttribute(pos, f + 2);
        const centre = a.add(b).add(c).normalize(), noir = sommets.some((s) => s.dot(centre) > 0.95);
        for (let k = 0; k < 3; k++) cols.push(noir ? 0.07 : 0.97, noir ? 0.07 : 0.97, noir ? 0.08 : 0.95);
      }
      ballonGeo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    }
    const ballon = new T.Mesh(ballonGeo, g(new T.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
    ballon.castShadow = !!o.ombres; scene.add(ballon);
    const ombreBallon = new T.Mesh(g(new T.CircleGeometry(0.34, 18)), basique('#000000', { transparent: true, opacity: 0.38, depthWrite: false }));
    ombreBallon.rotation.x = -PI / 2; ombreBallon.position.y = 0.025; scene.add(ombreBallon);
    const anneauPorteur = new T.Mesh(g(new T.RingGeometry(0.62, 0.86, 32)), basique('#2ECC71', { transparent: true, opacity: 0.95, depthWrite: false }));
    anneauPorteur.rotation.x = -PI / 2; anneauPorteur.position.y = 0.03; scene.add(anneauPorteur);
    const trajGeo = g(new T.BufferGeometry()); trajGeo.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    const trajMat = g(new T.LineDashedMaterial({ color: '#FFFFFF', dashSize: 0.8, gapSize: 0.6, transparent: true, opacity: 0.6 }));
    const trajectoire = new T.Line(trajGeo, trajMat); trajectoire.visible = false; scene.add(trajectoire);
    // les cartons, au-dessus de la tête du joueur
    const cartonGeo = g(new T.PlaneGeometry(0.34, 0.48));
    const cartons = [];

    // ---- la météo (§54) : pluie et neige en particules ----
    let flocons = null;
    if (meteo === 'pluie' || meteo === 'neige') {
      const n = meteo === 'pluie' ? 1400 : 900, arr = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { arr[k * 3] = (Math.random() - 0.5) * 90; arr[k * 3 + 1] = Math.random() * 40; arr[k * 3 + 2] = (Math.random() - 0.5) * 90; }
      const geo = g(new T.BufferGeometry()); geo.setAttribute('position', new T.BufferAttribute(arr, 3));
      flocons = new T.Points(geo, g(new T.PointsMaterial({ color: meteo === 'pluie' ? '#B8D4E8' : '#FFFFFF', size: meteo === 'pluie' ? 0.12 : 0.3, transparent: true, opacity: meteo === 'pluie' ? 0.55 : 0.9, depthWrite: false })));
      scene.add(flocons);
    }

    // ---- la caméra : un plan de diffusion, sur le côté, qui suit le ballon ----
    const cam = new T.PerspectiveCamera(o.fov || 34, (o.largeur || 360) / (o.hauteur || 300), 0.5, 500);
    const C = { x: 0, z: 0, dist: 37, haut: 22, coupe: 0, cible: null, tremble: 0 };
    let W = o.largeur || 360, Hh = o.hauteur || 300;
    const vers = (x, y) => [x - 34, y - 52.5];   // moteur (0..68, 0..105) → scène

    // ---- les événements : but, carton, clameur ----
    let clameur = 0, fete = null, tJeu = 0, dernierA = null;
    const evenement = (e) => {
      if (!e) return;
      if (e.k === 'goal') {
        fete = { s: e.s, c: e.c, t: 0 }; clameur = 1; C.tremble = 0.6;
        const d = e.s === 'H' ? -1 : 1;   // le but attaqué par le camp qui marque (le domicile attaque vers y = 0)
        if (filets[d]) filets[d].choc = 1;
        if (e.c != null && joueurs[e.c]) C.cible = { code: e.c, t: 0, dur: 2.6 };   // §49 le plan serré sur le buteur
      } else if (e.k === 'card') {
        const m = new T.Mesh(cartonGeo, basique(e.col || '#FFD23F', { side: T.DoubleSide })); scene.add(m);
        cartons.push({ m, code: e.c, t: 0 });
        if (e.col === '#FF4757') clameur = Math.max(clameur, 0.6);
      } else if (e.k === 'roar') clameur = Math.max(clameur, e.v || 0.5);
    };

    // ---- une image ----
    const v3 = new T.Vector3();
    const image = (A, B, fr, evs) => {
      if (!A) { o.renderer.render(scene, cam); return; }
      B = B || A; fr = cl(fr || 0, 0, 1);
      if (A !== dernierA) {
        if (evs) evs.forEach(evenement);
        if (A.ev) A.ev.forEach(evenement);
        // la frappe : le joueur d'où part la trajectoire lève la jambe
        if (A.fl && (!dernierA || !dernierA.fl || dernierA.fl[0] !== A.fl[0] || dernierA.fl[1] !== A.fl[1])) {
          let best = null, bd = 2.8;
          for (const j of joueurs) { const dd = Math.hypot(A.P[j.code * 2] - A.fl[0], A.P[j.code * 2 + 1] - A.fl[1]); if (dd < bd) { bd = dd; best = j; } }
          if (best) best.frappe = 0.0001;
        }
        dernierA = A;
      }
      const t = A.t + ((B.t != null ? B.t : A.t) - A.t) * fr;
      const dt = cl(t - tJeu, 0, 0.5); tJeu = t;
      const bx = A.b[0] + (B.b[0] - A.b[0]) * fr, by = A.b[1] + (B.b[1] - A.b[1]) * fr, bz = A.b[2] + (B.b[2] - A.b[2]) * fr;
      const [BX, BZ] = vers(bx, by);
      // les joueurs
      const fa = A.fa || [], dv = A.dv;
      for (const j of joueurs) {
        const ax = A.P[j.code * 2], ay = A.P[j.code * 2 + 1], qx = B.P[j.code * 2], qy = B.P[j.code * 2 + 1];
        if (ax < -5) { j.racine.visible = false; continue; }   // expulsé
        j.racine.visible = true;
        const px = qx < -5 ? ax : ax + (qx - ax) * fr, py = qx < -5 ? ay : ay + (qy - ay) * fr;
        const [X, Z] = vers(px, py);
        const vx = qx < -5 ? 0 : (qx - ax) * 10, vz = qx < -5 ? 0 : (qy - ay) * 10, vit = Math.hypot(vx, vz);
        j.vit += (vit - j.vit) * cl(dt * 6, 0, 1);
        const capVise = j.vit > 0.7 ? Math.atan2(vx, vz) : Math.atan2(BX - X, BZ - Z);
        let dA = capVise - j.cap; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); j.cap += dA * cl(dt * 7, 0, 1);
        let dx = 0, y = 0, rotZ = 0, rotX = 0;
        // la course : foulée et bras selon la vitesse (§28)
        const amp = cl(j.vit / 7, 0, 1);
        j.phase += dt * (2 * PI) * (0.9 + j.vit * 0.22);
        const s = Math.sin(j.phase);
        j.jg.cuisse.rotation.x = s * amp * 0.85; j.jd.cuisse.rotation.x = -s * amp * 0.85;
        j.jg.genou.rotation.x = Math.max(0, -Math.cos(j.phase)) * amp * 1.2; j.jd.genou.rotation.x = Math.max(0, Math.cos(j.phase)) * amp * 1.2;
        j.bg.ep.rotation.set(-s * amp * 0.7, 0, -0.12); j.bd.ep.rotation.set(s * amp * 0.7, 0, 0.12);
        j.bg.coude.rotation.x = -0.5 * amp - 0.15; j.bd.coude.rotation.x = -0.5 * amp - 0.15;
        j.buste.rotation.x = amp * 0.22; y = Math.abs(Math.cos(j.phase)) * amp * 0.06;
        // la frappe
        if (j.frappe > 0) {
          j.frappe += dt / 0.4; const u = j.frappe;
          if (u >= 1) j.frappe = 0;
          // l'élan : la jambe part en arrière, puis fouette vers l'avant (rotation positive = vers l'arrière)
          else { j.jd.cuisse.rotation.x = u < 0.4 ? 0.7 * (u / 0.4) : 0.7 - 2.1 * ((u - 0.4) / 0.6); j.jd.genou.rotation.x = u < 0.4 ? 1.2 * (u / 0.4) : 1.2 * (1 - (u - 0.4) / 0.6); j.bg.ep.rotation.z = -0.8; j.bd.ep.rotation.z = 0.5; }
        }
        // le plongeon du gardien
        if (dv && dv[0] === j.code) {
          // le roulis se fait dans le repère du joueur : on le corrige selon qu'il regarde vers +Z ou -Z
          const e = Math.min(1, dv[2] * 1.5), sens = Math.cos(j.cap) >= 0 ? 1 : -1;
          rotZ = -dv[1] * 1.35 * e * sens; y = Math.sin(Math.min(1, dv[2]) * PI) * 0.55; dx = dv[1] * e * 1.7;
          j.bg.ep.rotation.set(0, 0, -2.6); j.bd.ep.rotation.set(0, 0, 2.6);
        }
        // au sol
        if (fa.includes(j.code)) { rotX = -1.35; y = 0.12; }
        // §50 la célébration : le camp qui marque saute, l'autre baisse la tête
        if (fete && fete.t < 4) {
          if ((j.H ? 'H' : 'A') === fete.s) {
            const prs = j.code === fete.c ? 1 : 0.7;
            y += Math.abs(Math.sin(fete.t * 5 + j.code)) * 0.45 * prs; j.bg.ep.rotation.set(0, 0, -2.5); j.bd.ep.rotation.set(0, 0, 2.5);
          } else { j.tete.rotation.x = 0.6; j.buste.rotation.x = 0.3; }
        } else j.tete.rotation.x = 0;
        j.racine.position.set(X + dx, 0, Z);
        j.racine.rotation.set(0, j.cap, 0);
        j.corps.position.y = y; j.corps.rotation.z = rotZ; j.corps.rotation.x = rotX;
        j.ombre.scale.setScalar(1 - Math.min(0.5, y * 0.6));
        j.x = X + dx; j.z = Z;
      }
      if (fete) { fete.t += dt; if (fete.t > 4.5) fete = null; }
      // le ballon
      const hb = 0.3 + Math.max(0, bz);
      const avant = ballon.position.clone();
      ballon.position.set(BX, hb, BZ);
      const roule = avant.distanceTo(ballon.position);
      ballon.rotation.x += roule * 2.2; ballon.rotation.z += roule * 0.5;
      ombreBallon.position.set(BX + bz * 0.18, 0.025, BZ + bz * 0.1); ombreBallon.scale.setScalar(1 + bz * 0.08);
      ombreBallon.material.opacity = cl(0.38 - bz * 0.03, 0.08, 0.38);
      // le porteur
      const own = A.o != null && A.o >= 0 ? joueurs[A.o] : null;
      anneauPorteur.visible = !!own && own.racine.visible;
      if (own) { anneauPorteur.position.set(own.x, 0.03, own.z); anneauPorteur.material.color.set(own.H ? '#2ECC71' : '#FFFFFF'); }
      // la trajectoire d'une passe en profondeur ou d'une frappe
      const fl = A.fl;
      if (fl && (fl[4] === 'shot' || fl[4] === 'through' || fl[4] === 'cross')) {
        const [x0, z0] = vers(fl[0], fl[1]), [x1, z1] = vers(fl[2], fl[3]);
        const pos = trajGeo.attributes.position; pos.setXYZ(0, x0, 0.05, z0); pos.setXYZ(1, x1, 0.05, z1); pos.needsUpdate = true;
        trajectoire.computeLineDistances();
        trajMat.color.set(fl[4] === 'shot' ? '#FFE14D' : fl[4] === 'through' ? '#2ECC71' : '#FFFFFF');
        trajectoire.visible = true;
      } else trajectoire.visible = false;
      // les filets qui tremblent
      Object.keys(filets).forEach((k) => { const f = filets[k]; f.choc = Math.max(0, f.choc - dt * 1.2); f.filet.position.z = Number(k) * Math.sin(f.choc * PI * 4) * 0.35 * f.choc; });
      // les cartons montent au-dessus du joueur, face caméra
      for (let k = cartons.length - 1; k >= 0; k--) {
        const ca = cartons[k]; ca.t += dt; const jj = joueurs[ca.code];
        if (ca.t > 2.2 || !jj) { scene.remove(ca.m); ca.m.material.dispose(); cartons.splice(k, 1); continue; }
        ca.m.position.set(jj.x, 3.1 + Math.min(0.4, ca.t), jj.z); ca.m.quaternion.copy(cam.quaternion);
      }
      // §53 le public : il se lève sur un but, frémit sur une occasion
      clameur = Math.max(0, clameur - dt * 0.35);
      if (clameur > 0.05) {
        const n = places.length, k0 = Math.floor(tJeu * 37) % 7;
        for (let i = k0; i < n; i += 7) { const p = places[i]; mx.makeTranslation(p[0], p[1] + Math.abs(Math.sin(tJeu * 9 + i)) * 0.5 * clameur, p[2]); foule.setMatrixAt(i, mx); }
        foule.instanceMatrix.needsUpdate = true;
      }
      // la neige et la pluie suivent la caméra
      if (flocons) {
        const arr = flocons.geometry.attributes.position.array, vy = meteo === 'pluie' ? 22 : 2.2;
        for (let k = 0; k < arr.length; k += 3) {
          arr[k + 1] -= vy * Math.max(dt, 0.016) * (meteo === 'pluie' ? 1 : 0.6);
          if (meteo === 'neige') arr[k] += Math.sin(tJeu + k) * 0.01;
          if (arr[k + 1] < 0) { arr[k + 1] = 38 + Math.random() * 4; arr[k] = C.x + (Math.random() - 0.5) * 90; arr[k + 2] = C.z + (Math.random() - 0.5) * 90; }
        }
        flocons.geometry.attributes.position.needsUpdate = true;
      }
      // la caméra : elle suit le ballon avec un temps d'avance, se rapproche dans la surface
      // et sur les coups de pied arrêtés, et part en plan serré sur le buteur (§49)
      const bvx = (B.b[0] - A.b[0]) * 10, bvy = (B.b[1] - A.b[1]) * 10;
      const proche = Math.abs(BZ) > 34 || !!A.set;
      const portrait = W / Math.max(1, Hh) < 1;
      // assez près pour lire les gestes sur un téléphone ; plus près encore dans la surface
      const distV = (proche ? 30 : 37) * (portrait ? 1.2 : 1), hautV = (proche ? 18 : 22) * (portrait ? 1.12 : 1);
      const k = cl(dt * 1.6, 0, 1);
      C.x += (cl(BX * 0.5 + bvx * 0.2, -16, 16) - C.x) * k;
      C.z += (cl(BZ + bvy * 0.35, -46, 46) - C.z) * k;
      C.dist += (distV - C.dist) * k; C.haut += (hautV - C.haut) * k;
      C.tremble = Math.max(0, C.tremble - dt);
      const tx = (Math.random() - 0.5) * C.tremble * 0.6, ty = (Math.random() - 0.5) * C.tremble * 0.6;
      if (C.cible && joueurs[C.cible.code] && C.cible.t < C.cible.dur) {
        C.cible.t += dt;
        const jj = joueurs[C.cible.code], u = Math.min(1, C.cible.t / 0.5);
        const ox = jj.x + 9 * (1 - 0.2 * u), oz = jj.z + (jj.z > 0 ? -5 : 5);
        cam.position.set(ox + tx, 3.4 + ty, oz);
        cam.lookAt(jj.x, 1.6, jj.z);
      } else {
        C.cible = null;
        cam.position.set(C.x + C.dist + tx, C.haut + ty, C.z * 0.94);
        cam.lookAt(C.x, 0, C.z);
      }
      o.renderer.render(scene, cam);
    };

    return {
      scene, camera: cam,
      image,
      evenement,
      taille(l, h) { W = l; Hh = h; cam.aspect = l / Math.max(1, h); cam.updateProjectionMatrix(); },
      // la position d'un joueur à l'écran, en pixels : pour écrire son nom au-dessus
      projeter(code) {
        const j = joueurs[code]; if (!j || !j.racine.visible) return null;
        v3.set(j.x, 2.6 * ECH, j.z).project(cam);
        if (v3.z > 1) return null;
        return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * Hh };
      },
      detruire() {
        scene.traverse((m) => { if (m.isInstancedMesh) m.dispose(); });
        jetables.forEach((x) => { try { x.dispose(); } catch (e) { /* déjà libéré */ } });
        cartons.forEach((c) => c.m.material.dispose());
      }
    };
  },

  // Le pack en 3D (cahier design §11 : « pack 3D, visuel central, glow, animation
  // d'ouverture, rareté »). Un sachet métallisé qui flotte et tourne, accroche la lumière
  // de deux projecteurs qui tournent autour, tremble à chaque toucher, puis éclate dans la
  // couleur de la rareté tirée. Même code pour Mon Club et pour l'app.
  //   const p = club.pack3d(THREE, { renderer, largeur, hauteur, couleur, nom, tirages })
  //   p.image(dt)   p.secouer(force)   p.ouvrir(couleur)   p.taille(l, h)   p.detruire()
  pack3d(T, o) {
    o = o || {};
    const jetables = [], g = (x) => { jetables.push(x); return x; };
    const scene = new T.Scene();
    const cam = new T.PerspectiveCamera(30, (o.largeur || 210) / (o.hauteur || 290), 0.1, 80);
    cam.position.set(0, 0, o.distance || 9);
    scene.add(new T.AmbientLight('#FFFFFF', 0.6));
    const cle = new T.DirectionalLight('#FFFFFF', 1.3); cle.position.set(3, 4, 7); scene.add(cle);
    // une couleur du jeu peut être un dégradé CSS (« linear-gradient(135deg, #2ECC71, #1E9E92) ») :
    // three.js ne lit que des couleurs simples, on garde donc les teintes qu'il contient
    const teintes = (c, defaut) => { const m = String(c || '').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g); return m && m.length ? m : [defaut]; };
    const [coul] = teintes(o.couleur, '#2ECC71');
    const l1 = new T.PointLight(coul, 40, 22), l2 = new T.PointLight('#43E0C2', 26, 22); scene.add(l1); scene.add(l2);
    // le sachet : un rectangle aux coins arrondis, extrudé, bords biseautés
    const w = 2.1, h = 2.9, r = 0.22, f = new T.Shape();
    f.moveTo(-w / 2 + r, -h / 2); f.lineTo(w / 2 - r, -h / 2); f.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    f.lineTo(w / 2, h / 2 - r); f.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); f.lineTo(-w / 2 + r, h / 2);
    f.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); f.lineTo(-w / 2, -h / 2 + r); f.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const geo = g(new T.ExtrudeGeometry(f, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 4, curveSegments: 10 }));
    geo.center();
    // la face : peinte en JavaScript pur (facePack), la même dans le navigateur et sur téléphone
    let tex = null;
    try { tex = g(this.texture3d(T, this.facePack({ couleur: o.couleur, nom: o.nom, tirages: o.tirages }))); tex.repeat.set(1 / w, 1 / h); tex.offset.set(0.5, 0.5); } catch (e) { tex = null; }
    const face = g(new T.MeshStandardMaterial({ color: tex ? '#FFFFFF' : coul, map: tex, metalness: 0.42, roughness: 0.3, transparent: true }));
    const tranche = g(new T.MeshStandardMaterial({ color: '#D7DED9', metalness: 0.92, roughness: 0.18, transparent: true }));
    const sachet = new T.Mesh(geo, [face, tranche]);
    const groupe = new T.Group(); groupe.add(sachet); scene.add(groupe);
    // l'éclat de l'ouverture : des paillettes qui partent dans toutes les directions
    const N = 180, pos = new Float32Array(N * 3), vit = [];
    for (let k = 0; k < N; k++) { const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), v = 2.5 + Math.random() * 4; vit.push([Math.sin(ph) * Math.cos(th) * v, Math.sin(ph) * Math.sin(th) * v, Math.cos(ph) * v]); }
    const pg = g(new T.BufferGeometry()); pg.setAttribute('position', new T.BufferAttribute(pos, 3));
    const pm = g(new T.PointsMaterial({ color: coul, size: 0.14, transparent: true, opacity: 0, depthWrite: false }));
    const eclat = new T.Points(pg, pm); scene.add(eclat);
    // le halo (§11 « glow ») : une lueur derrière le pack, quand l'écran n'en dessine pas déjà une
    let halo = null;
    if (o.halo) {
      try {
        const hp = this.peintre(64, 64, 1, 1);
        hp.fond((x, y, c) => { const v = Math.max(0, 1 - Math.sqrt((x - 0.5) * (x - 0.5) + (y - 0.5) * (y - 0.5)) * 2); c[0] = c[1] = c[2] = v * v; });
        const hm = g(new T.MeshBasicMaterial({ color: coul, map: g(this.texture3d(T, { data: hp.octets(), largeur: 64, hauteur: 64 }, true)),
          transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
        halo = new T.Mesh(g(new T.PlaneGeometry(7.5, 7.5)), hm); halo.position.z = -1.4; scene.add(halo);
      } catch (e) { halo = null; }
    }
    let t = 0, choc = 0, ouv = -1;
    return {
      secouer(force) { choc = Math.max(choc, Math.min(1, force || 0.5)); },
      ouvrir(c) { if (ouv >= 0) return; ouv = 0; const k = teintes(c, null)[0]; if (k) { pm.color.set(k); l1.color.set(k); if (halo) halo.material.color.set(k); } pos.fill(0); },
      // un pack neuf prend la place de celui qu'on vient d'ouvrir
      nouveau() {
        ouv = -1; choc = 0; face.opacity = tranche.opacity = 1; groupe.scale.setScalar(1); pm.opacity = 0;
        pm.color.set(coul); l1.color.set(coul); pos.fill(0); pg.attributes.position.needsUpdate = true;
        if (halo) { halo.material.color.set(coul); halo.scale.setScalar(1); }
      },
      image(dt) {
        dt = Math.max(0, Math.min(0.1, dt || 0.016)); t += dt; choc = Math.max(0, choc - dt * 1.6);
        // au repos : il flotte et tourne lentement ; secoué : il tremble et la lumière monte
        const jx = (Math.random() - 0.5) * choc * 0.18, jy = (Math.random() - 0.5) * choc * 0.18;
        groupe.position.set(jx, Math.sin(t * 1.3) * 0.09 + jy, 0);
        groupe.rotation.set(Math.sin(t * 0.7) * 0.1, Math.sin(t * 0.8) * 0.5 + choc * Math.sin(t * 40) * 0.12, choc * Math.sin(t * 33) * 0.08);
        l1.position.set(Math.cos(t * 1.1) * 4, Math.sin(t * 0.9) * 2.5, 3.2); l2.position.set(Math.cos(t * 1.1 + Math.PI) * 4, -Math.sin(t * 0.7) * 2.5, 3.2);
        l1.intensity = 40 + choc * 60;
        if (ouv >= 0) {
          ouv += dt;
          const u = Math.min(1, ouv / 0.9);
          groupe.scale.setScalar(1 + u * 0.35); groupe.rotation.y += u * u * 9;
          face.opacity = tranche.opacity = Math.max(0, 1 - Math.max(0, u - 0.35) / 0.4);
          pm.opacity = u < 0.15 ? u / 0.15 : Math.max(0, 1 - (u - 0.15) / 0.85);
          for (let k = 0; k < N; k++) { pos[k * 3] = vit[k][0] * ouv; pos[k * 3 + 1] = vit[k][1] * ouv; pos[k * 3 + 2] = vit[k][2] * ouv; }
          pg.attributes.position.needsUpdate = true;
          l1.intensity = 120 * (1 - u) + 10;
        }
        if (halo) {
          const u = ouv >= 0 ? Math.min(1, ouv / 0.9) : 0;
          halo.material.opacity = ouv >= 0 ? Math.max(0, 1 - u) : 0.5 + Math.sin(t * 2) * 0.08 + choc * 0.4;
          halo.scale.setScalar(1 + u * 0.7 + choc * 0.12);
        }
        o.renderer.render(scene, cam);
      },
      taille(l, h2) { cam.aspect = l / Math.max(1, h2); cam.updateProjectionMatrix(); },
      detruire() { jetables.forEach((x) => { try { x.dispose(); } catch (e) { /* déjà libéré */ } }); }
    };
  },

  // ---- un petit peintre en JavaScript pur ----
  // L'app téléphone n'a pas de <canvas> pour écrire du texte dans une texture : les textures
  // sont donc peintes ici, pixel par pixel, avec des formes lissées (traits, disques,
  // polygones) et un alphabet en traits (capitales, chiffres). On dessine en unités libres
  // (uL × uH, y vers le bas) ; octets() rend les pixels RGBA, prêts pour texture3d.
  peintre(L, H, uL, uH) {
    const px = new Float32Array(L * H * 3), cov = new Float32Array(L * H);
    const sx = uL / L, sy = uH / H, ps = (sx + sy) / 2;
    const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const rgb = (h) => {
      const m = String(h || '').match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
      const f = !m ? 'FFFFFF' : m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
      return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255);
    };
    // une couche : la couverture de plusieurs formes (le maximum, pour que deux traits qui se
    // croisent ne foncent pas le point commun), puis une seule fusion avec la couleur
    const couche = (formes, couleur, alpha) => {
      const col = rgb(couleur), al = alpha == null ? 1 : alpha;
      let i0 = L, j0 = H, i1 = -1, j1 = -1;
      formes.forEach((f) => {
        const a0 = Math.max(0, Math.floor(f.bb[0] / sx) - 1), a1 = Math.min(L - 1, Math.ceil(f.bb[2] / sx) + 1);
        const b0 = Math.max(0, Math.floor(f.bb[1] / sy) - 1), b1 = Math.min(H - 1, Math.ceil(f.bb[3] / sy) + 1);
        if (a0 < i0) i0 = a0; if (a1 > i1) i1 = a1; if (b0 < j0) j0 = b0; if (b1 > j1) j1 = b1;
        for (let j = b0; j <= b1; j++) for (let i = a0; i <= a1; i++) {
          const c = cl(0.5 - f.d((i + 0.5) * sx, (j + 0.5) * sy) / ps), q = j * L + i;
          if (c > cov[q]) cov[q] = c;
        }
      });
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const q = j * L + i; if (!cov[q]) continue;
        const a = cov[q] * al; cov[q] = 0;
        for (let c = 0; c < 3; c++) px[q * 3 + c] += (col[c] - px[q * 3 + c]) * a;
      }
    };
    // les formes : une distance signée (négative dedans) et un cadre
    const trait = (x0, y0, x1, y1, e) => {
      const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1e-9, r = e / 2;
      return { bb: [Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r],
        d: (x, y) => { const t = cl(((x - x0) * dx + (y - y0) * dy) / l2), ex = x - x0 - t * dx, ey = y - y0 - t * dy; return Math.sqrt(ex * ex + ey * ey) - r; } };
    };
    const disque = (cx, cy, r) => ({ bb: [cx - r, cy - r, cx + r, cy + r], d: (x, y) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) - r });
    const regulier = (cx, cy, R, n, a0) => {
      const apo = R * Math.cos(Math.PI / n), N = [];
      for (let k = 0; k < n; k++) { const a = a0 + (k + 0.5) * 2 * Math.PI / n; N.push([Math.cos(a), Math.sin(a)]); }
      return { bb: [cx - R, cy - R, cx + R, cy + R],
        d: (x, y) => { let m = -1e9; for (let k = 0; k < n; k++) { const v = (x - cx) * N[k][0] + (y - cy) * N[k][1]; if (v > m) m = v; } return m - apo; } };
    };
    // l'alphabet : hauteur de capitale 6, [chasse, tracé, tracé...], un tracé = une ligne brisée
    const arc = (cx, cy, rx, ry, a0, a1, n) => { const q = []; for (let k = 0; k <= n; k++) { const t = (a0 + (a1 - a0) * k / n) * Math.PI / 180; q.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); } return q; };
    const P = [[0, 6], [0, 0], [2.2, 0]].concat(arc(2.2, 1.65, 1.6, 1.65, -90, 90, 10), [[0, 3.3]]);
    const G = {
      ' ': [2.2],
      A: [4.4, [[0, 6], [2.2, 0], [4.4, 6]], [[0.85, 3.9], [3.55, 3.9]]],
      B: [3.9, [[0, 0], [0, 6]], [[0, 0], [2.1, 0]].concat(arc(2.1, 1.45, 1.45, 1.45, -90, 90, 10), [[0, 2.9]]), [[0, 2.9], [2.3, 2.9]].concat(arc(2.3, 4.45, 1.6, 1.55, -90, 90, 10), [[0, 6]])],
      C: [4.2, arc(2.2, 3, 2.2, 3, -48, -312, 18)],
      D: [4.2, [[0, 0], [0, 6], [1.6, 6]].concat(arc(1.6, 3, 2.6, 3, 90, -90, 16), [[0, 0]])],
      E: [3.6, [[3.6, 0], [0, 0], [0, 6], [3.6, 6]], [[0, 3], [3, 3]]],
      F: [3.5, [[3.5, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]],
      G: [4.4, arc(2.2, 3, 2.2, 3, -40, -360, 20).concat([[2.6, 3]])],
      H: [4.2, [[0, 0], [0, 6]], [[4.2, 0], [4.2, 6]], [[0, 3], [4.2, 3]]],
      I: [0, [[0, 0], [0, 6]]],
      J: [3.4, [[3.4, 0], [3.4, 4.3]].concat(arc(1.7, 4.3, 1.7, 1.7, 0, 160, 10))],
      K: [4, [[0, 0], [0, 6]], [[4, 0], [0, 3.8]], [[1.5, 2.4], [4, 6]]],
      L: [3.4, [[0, 0], [0, 6], [3.4, 6]]],
      M: [4.8, [[0, 6], [0, 0], [2.4, 4], [4.8, 0], [4.8, 6]]],
      N: [4.2, [[0, 6], [0, 0], [4.2, 6], [4.2, 0]]],
      O: [4.6, arc(2.3, 3, 2.3, 3, 0, 360, 24)],
      P: [3.8, P],
      Q: [4.6, arc(2.3, 3, 2.3, 3, 0, 360, 24), [[2.9, 4.4], [4.6, 6.2]]],
      R: [3.9, P, [[2.1, 3.3], [3.9, 6]]],
      S: [4, arc(2, 1.5, 1.9, 1.5, -20, -270, 14).concat(arc(2, 4.5, 2, 1.5, -90, 160, 14))],
      T: [4.2, [[0, 0], [4.2, 0]], [[2.1, 0], [2.1, 6]]],
      U: [4.2, [[0, 0]].concat(arc(2.1, 4, 2.1, 2, 180, 0, 14), [[4.2, 0]])],
      V: [4.4, [[0, 0], [2.2, 6], [4.4, 0]]],
      W: [6, [[0, 0], [1.4, 6], [3, 1.6], [4.6, 6], [6, 0]]],
      X: [4.2, [[0, 0], [4.2, 6]], [[4.2, 0], [0, 6]]],
      Y: [4.4, [[0, 0], [2.2, 3.2], [4.4, 0]], [[2.2, 3.2], [2.2, 6]]],
      Z: [4, [[0, 0], [4, 0], [0, 6], [4, 6]]],
      0: [4, arc(2, 3, 2, 3, 0, 360, 24)],
      1: [2.2, [[0, 1.3], [1.6, 0], [1.6, 6]]],
      2: [4, arc(2, 1.9, 1.9, 1.9, -160, 15, 14).concat([[0, 6], [4, 6]])],
      3: [4, arc(2, 1.5, 1.8, 1.5, -155, 90, 14).concat(arc(2, 4.5, 2, 1.5, -90, 155, 14))],
      4: [4, [[3, 6], [3, 0], [0, 4.2], [4, 4.2]]],
      5: [4, [[3.7, 0], [0.4, 0], [0.2, 2.7]].concat(arc(2, 4.1, 1.95, 1.9, -125, 150, 16))],
      6: [4, arc(2, 4.1, 1.95, 1.9, 0, 360, 20), [[0.06, 3.9], [0.8, 1.6], [2.6, 0]]],
      7: [4, [[0, 0], [4, 0], [1.4, 6]]],
      8: [4, arc(2, 1.45, 1.65, 1.45, 0, 360, 18), arc(2, 4.35, 1.95, 1.65, 0, 360, 20)],
      9: [4, arc(2, 1.95, 1.95, 1.95, 0, 360, 20), [[3.95, 2.1], [3.3, 4.3], [1.5, 6]]],
      '-': [2.4, [[0.2, 3.4], [2.2, 3.4]]],
      '.': [0, [[0, 5.9], [0, 6]]],
      '·': [0, [[0, 3], [0, 3.1]]]
    };
    const glyphes = (s) => {
      let t = String(s).toUpperCase();
      try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* sans normalize, un accent devient un blanc */ }
      return [...t].map((c) => G[c] || G[' ']);
    };
    const mesure = (s, cap, ep) => { const gl = glyphes(s), gap = 1.4 + ep; return gl.reduce((a, g, i) => a + g[0] + (i ? gap : 0), 0) * cap / 6; };
    // un texte en capitales : x au centre (ou à gauche), yBase la ligne de base, cap la hauteur
    // des capitales, ep l'épaisseur du trait en sixièmes de capitale
    const texte = (s, x, yBase, cap, ep, couleur, alpha, aGauche) => {
      const gl = glyphes(s), k = cap / 6, gap = 1.4 + ep, larg = mesure(s, cap, ep), formes = [];
      let x0 = aGauche ? x : x - larg / 2;
      const y0 = yBase - cap;
      gl.forEach((g) => {
        for (let t = 1; t < g.length; t++) {
          const l = g[t];
          for (let m = 1; m < l.length; m++) formes.push(trait(x0 + l[m - 1][0] * k, y0 + l[m - 1][1] * k, x0 + l[m][0] * k, y0 + l[m][1] * k, ep * k));
        }
        x0 += (g[0] + gap) * k;
      });
      couche(formes, couleur, alpha);
      return larg;
    };
    // le fond : f(x, y, c) écrit la couleur du point dans c (un seul tableau pour tous les points)
    const fond = (f) => {
      const c = [0, 0, 0];
      for (let j = 0; j < H; j++) for (let i = 0; i < L; i++) {
        f((i + 0.5) * sx, (j + 0.5) * sy, c);
        const q = (j * L + i) * 3; px[q] = c[0]; px[q + 1] = c[1]; px[q + 2] = c[2];
      }
    };
    // les lignes du bas d'abord : three.js lit la ligne 0 d'une DataTexture comme le bas de l'image
    const octets = () => {
      const out = new Uint8Array(L * H * 4);
      for (let j = 0; j < H; j++) {
        const r = H - 1 - j;
        for (let i = 0; i < L; i++) {
          const q = (j * L + i) * 3, w = (r * L + i) * 4;
          out[w] = Math.round(cl(px[q]) * 255); out[w + 1] = Math.round(cl(px[q + 1]) * 255); out[w + 2] = Math.round(cl(px[q + 2]) * 255); out[w + 3] = 255;
        }
      }
      return out;
    };
    return { L, H, ps, rgb, couche, trait, disque, regulier, texte, mesure, fond, octets };
  },

  // une image peinte devient une texture three.js (simple : sans mipmaps ni sRGB, pour un masque)
  texture3d(T, img, simple) {
    const t = new T.DataTexture(img.data, img.largeur, img.hauteur, T.RGBAFormat);
    t.magFilter = T.LinearFilter;
    if (simple) t.minFilter = T.LinearFilter;
    else { t.minFilter = T.LinearMipmapLinearFilter; t.generateMipmaps = true; if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace; }
    t.needsUpdate = true;
    return t;
  },

  // La face du pack (2,1 × 2,9 unités) : le dégradé de la couleur du pack, les reflets en
  // biais, le ballon LinkFoot, le nom et le nombre de tirages. Peinte une fois par pack.
  facePack(o) {
    o = o || {};
    const m = String(o.couleur || '').match(/#[0-9a-fA-F]{6}\b/g) || ['#2ECC71'];
    const cle = m.join(',') + '|' + (o.nom || '') + '|' + (o.tirages || 3);
    const cache = this.__facesPack || (this.__facesPack = {});
    if (cache[cle]) return cache[cle];
    const W = 2.1, H = 2.9, p = this.peintre(512, 512, W, H);
    const pierres = [[0, m[0]]].concat(m[1] ? [[0.3, m[1]]] : [], [[0.62, '#123A24'], [1, '#0B1210']]).map((z) => [z[0], p.rgb(z[1])]);
    const nx = 0.9206, ny = 0.3905, pas = 0.3397;   // les reflets : des bandes parallèles en biais
    p.fond((x, y, c) => {
      const t = (x * W + y * H) / (W * W + H * H);
      let k = 1; while (k < pierres.length - 1 && t > pierres[k][0]) k++;
      const a = pierres[k - 1], b = pierres[k], u = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])));
      const dx = x - 1.05, dy = y - 1.19, hal = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 1.23) * 0.35;
      const s = (x + 0.41) * nx + (y - 2.9) * ny, i = Math.round(s / pas);
      const ref = i >= 0 && i <= 8 ? (0.05 + (i % 3) * 0.03) * Math.max(0, Math.min(1, 0.5 - (Math.abs(s - i * pas) - 0.037) / p.ps)) : 0;
      for (let n = 0; n < 3; n++) { const v = a[1][n] + (b[1][n] - a[1][n]) * u, w = v + (1 - v) * hal; c[n] = w + (1 - w) * ref; }
    });
    p.couche([p.disque(1.05, 1.107, 0.377)], '#F2F4F7', 1);
    const taches = [0, 1, 2, 3, 4].map((k) => { const a = -Math.PI / 2 + k * 2 * Math.PI / 5; return p.disque(1.05 + Math.cos(a) * 0.328, 1.107 + Math.sin(a) * 0.328, 0.09); });
    p.couche([p.regulier(1.05, 1.107, 0.139, 5, -Math.PI / 2)].concat(taches), '#0B1210', 1);
    p.texte('LINKFOOT', 1.05, 1.925, 0.17, 1.15, '#F2F4F7', 1);
    p.texte(o.nom || 'LinkFoot Pack', 1.05, 2.13, 0.08, 1.1, '#F2F4F7', 0.85);
    p.texte((o.tirages || 3) + ' TIRAGES', 1.05, 2.457, 0.07, 1.2, m[0], 1);
    return (cache[cle] = { data: p.octets(), largeur: 512, hauteur: 512 });
  },

  // Le texte des panneaux du stade, réparti sur toute la largeur pour que la répétition
  // le long des panneaux tombe juste.
  panneauPub() {
    if (this.__panneauPub) return this.__panneauPub;
    const p = this.peintre(1024, 64, 1024, 64), mots = ['LINKFOOT', 'MON CLUB', 'DIRECTEUR SPORTIF'];
    const vert = p.rgb('#2ECC71'), larg = mots.map((t) => p.mesure(t, 24, 1.3));
    const blanc = (1024 - larg.reduce((a, b) => a + b, 0)) / mots.length;
    p.fond((x, y, c) => { c[0] = vert[0]; c[1] = vert[1]; c[2] = vert[2]; });
    let x = blanc / 2;
    mots.forEach((t, i) => { p.texte(t, x, 44, 24, 1.3, '#0B1210', 1, true); x += larg[i] + blanc; });
    return (this.__panneauPub = { data: p.octets(), largeur: 1024, hauteur: 64 });
  }
};

// LinkFoot : le journal (§26).
//
// Un classement est une liste de nombres. Un journal raconte ce que ces nombres
// veulent dire : qui monte, qui s'effondre, qui a planté un triplé samedi. Tout ce
// fichier ne fait que ça : transformer de VRAIS résultats en articles.
//
// Rien n'est inventé. Chaque article cite un match, un classement ou un transfert
// qui a réellement eu lieu. S'il n'y a pas de résultat, il n'y a pas d'article.
const News = {
  // Les rubriques, dans l'ordre où le journal les présente.
  NEWS_SECTIONS() {
    return [
      { id: 'une', label: 'À la une' },
      { id: 'resultats', label: 'Résultats' },
      { id: 'joueurs', label: 'Joueurs' },
      { id: 'marche', label: 'Mercato' },
      { id: 'classement', label: 'Classement' }
    ];
  },

  // Construit le journal à partir de ce que le serveur a renvoyé.
  // `feed` : { matches, ladder, movers, transfers, players }
  buildNews(feed) {
    const f = feed || {}, out = [];
    const when = (t) => {
      const d = Math.max(0, Date.now() - (t || Date.now()));
      const h = Math.floor(d / 3600000), m = Math.floor(d / 60000);
      return h >= 24 ? Math.floor(h / 24) + ' j' : h >= 1 ? h + ' h' : m >= 1 ? m + ' min' : 'à l’instant';
    };

    // À la une : le match le plus marquant, celui qui a le plus gros écart ou le plus de buts
    const ms = (f.matches || []).slice();
    if (ms.length) {
      const best = ms.slice().sort((a, b) => {
        const sa = Math.abs(a.score[0] - a.score[1]) * 2 + a.score[0] + a.score[1];
        const sb = Math.abs(b.score[0] - b.score[1]) * 2 + b.score[0] + b.score[1];
        return sb - sa;
      })[0];
      const gap = Math.abs(best.score[0] - best.score[1]);
      const win = best.score[0] > best.score[1] ? best.home : best.score[1] > best.score[0] ? best.away : null;
      out.push({
        section: 'une', kind: 'match', at: best.at,
        title: win
          ? (gap >= 4 ? win + ' passe le rouleau compresseur' : gap >= 2 ? win + ' s’impose nettement' : win + ' arrache la victoire')
          : 'Rien n’a pu les départager',
        sub: best.home + ' ' + best.score[0] + ' - ' + best.score[1] + ' ' + best.away,
        body: win
          ? (gap >= 4
            ? win + ' n’a laissé aucune chance à son adversaire et signe la performance de la journée.'
            : gap >= 2
              ? win + ' a contrôlé la rencontre de bout en bout.'
              : 'Un but d’écart, et une fin de match irrespirable.')
          : 'Les deux clubs se quittent dos à dos, sans trouver la faille.',
        ago: when(best.at)
      });
    }

    // Résultats : tous les matchs, du plus récent au plus ancien
    ms.sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 12).forEach((m) => {
      out.push({
        section: 'resultats', kind: 'score', at: m.at,
        title: m.home + ' ' + m.score[0] + ' - ' + m.score[1] + ' ' + m.away,
        sub: m.comp || 'Match classé',
        body: '', ago: when(m.at)
      });
    });

    // Joueurs : les hommes du match, et le joueur de la semaine
    const ps = (f.players || []).slice().sort((a, b) => (b.rating || 0) - (a.rating || 0));
    if (ps.length) {
      const star = ps[0];
      out.push({
        section: 'joueurs', kind: 'star', at: star.at,
        title: star.name + ', l’homme de la semaine',
        sub: star.club + ' · note ' + (star.rating || 0).toFixed(1) + (star.goals ? ' · ' + star.goals + ' but' + (star.goals > 1 ? 's' : '') : ''),
        body: star.goals >= 3 ? 'Un triplé qui restera.' : star.goals === 2 ? 'Un doublé décisif.' : star.goals === 1 ? 'Un but, et une prestation complète.' : 'Une démonstration sans marquer.',
        ago: when(star.at)
      });
      ps.slice(1, 6).forEach((p) => out.push({
        section: 'joueurs', kind: 'player', at: p.at,
        title: p.name, sub: p.club + ' · note ' + (p.rating || 0).toFixed(1) + (p.goals ? ' · ' + p.goals + ' but' + (p.goals > 1 ? 's' : '') : ''),
        body: '', ago: when(p.at)
      }));
    }

    // Mercato : les transferts réels
    (f.transfers || []).slice(0, 8).forEach((t) => out.push({
      section: 'marche', kind: 'transfer', at: t.at,
      title: t.player + ' quitte ' + t.from,
      sub: t.to + ' · ' + (t.price || 0).toLocaleString('fr-FR') + ' jetons',
      body: t.price >= 3000 ? 'Un transfert qui fera date.' : '',
      ago: when(t.at)
    }));

    // Classement : qui monte, qui descend
    (f.movers || []).slice(0, 6).forEach((m) => out.push({
      section: 'classement', kind: 'mover', at: m.at,
      title: m.club + (m.delta > 0 ? ' grimpe de ' + m.delta + ' place' + (m.delta > 1 ? 's' : '') : ' perd ' + (-m.delta) + ' place' + (m.delta < -1 ? 's' : '')),
      sub: (m.rank ? m.rank + 'e au classement' : '') + (m.elo ? ' · ' + m.elo + ' points' : ''),
      body: '', ago: when(m.at)
    }));
    const lad = (f.ladder || []).slice(0, 3);
    if (lad.length) out.push({
      section: 'classement', kind: 'top', at: Date.now(),
      title: lad[0].name + ' en tête',
      sub: lad.map((r, i) => (i + 1) + '. ' + r.name + ' ' + r.elo).join(' · '),
      body: '', ago: 'maintenant'
    });

    return out;
  },

  // Le journal tel que l'écran l'affiche, rubrique par rubrique.
  newsBySection(feed) {
    const all = this.buildNews(feed);
    return this.NEWS_SECTIONS().map((sec) => ({
      id: sec.id, label: sec.label,
      items: all.filter((x) => x.section === sec.id),
      empty: !all.some((x) => x.section === sec.id)
    }));
  },

  // Hors ligne, l'écran n'a rien à montrer. Plutôt qu'une page vide, il montre un
  // EXEMPLE construit depuis les données du club solo, clairement étiqueté comme tel.
  // Rien n'est inventé : ce sont les vrais résultats et le vrai classement de la
  // division (§22), et le vrai effectif.
  demoFeed() {
    const s = this.state, lg = this.divisionCourante(), tbl = this.table(lg);
    const now = Date.now();
    const joues = [];
    for (let d = lg.day; d >= 1 && joues.length < 6; d--) this.resultatsDeJournee(d, lg).forEach((x) => joues.push(Object.assign({ day: d }, x)));
    return {
      demo: true,
      matches: joues.slice(0, 6).map((x, i) => ({
        at: now - (i + 1) * 5400000,
        home: x.home, away: x.away,
        score: [x.hs, x.as], comp: 'Division ' + s.division + ' · journée ' + x.day
      })),
      // les joueurs qui ont joué, avec leur vraie note moyenne et leurs vrais buts (§18)
      players: s.squad.filter((p) => p.carriere && p.carriere.m).map((p, i) => ({
        at: now - i * 3600000, name: p.name, club: s.clubName || 'FC TonPseudo',
        rating: Math.round(p.carriere.n / p.carriere.m * 10) / 10, goals: p.carriere.b
      })),
      transfers: [],
      // le rang avant et après la dernière journée, recalculé depuis les résultats
      movers: (() => {
        if (!lg.day) return [];
        const avant = lg.rows.map((r) => this.emptyRow(r.id, r.name));
        lg.results.filter((x) => x.day < lg.day).forEach((x) => this.applyResult(avant, x.home, x.away, x.hs, x.as));
        const r0 = this.standings(avant).find((r) => r.id === 'moi').rank, r1 = tbl.find((c) => c.me).rank;
        return [{ at: now, club: s.clubName || 'FC TonPseudo', delta: r0 - r1, rank: r1, elo: null }];
      })(),
      // pas d'Elo hors ligne : le classement de la division, en points
      ladder: tbl.map((c, i) => ({ rank: i + 1, id: c.id, name: c.club, elo: c.pts + ' pt' + (c.pts > 1 ? 's' : ''),
        p: c.p, w: c.w, d: c.d, l: c.l, gf: c.gf, ga: c.ga })),
      leagues: [], tournaments: []
    };
  },

  // Les diapositives de l'écran En ligne : chacune répond à une question du §26.
  // Hors ligne, elles disent ce qui manque plutôt que de rester vides (§81).
  onlineSlides(feed) {
    const f = feed || {}, on = this.isOnline();
    const none = (what) => on ? 'Rien pour l’instant : ' + what : 'Disponible une fois le mode en ligne branché.';
    const lad = f.ladder || [];
    const best = lad.slice(0, 10);
    const players = (f.players || []).slice().sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 10);
    return [
      { id: 'journal', label: 'Le journal', sub: 'Ce qui s’est passé cette semaine',
        empty: !(f.matches || []).length, emptyWhy: none('aucun match n’a encore été joué en ligne.') },
      { id: 'ligue', label: 'Ligue en ligne', sub: 'Tes ligues entre amis',
        empty: !(f.leagues || []).length, emptyWhy: none('crée une ligue et partage son code.') },
      { id: 'tournoi', label: 'Tournoi', sub: 'Les coupes en cours',
        empty: !(f.tournaments || []).length, emptyWhy: none('aucun tournoi en cours.') },
      { id: 'classement', label: 'Classement', sub: 'Le général, tous clubs confondus',
        empty: !lad.length, emptyWhy: none('le classement se remplit au premier match classé.') },
      { id: 'equipes', label: 'Meilleures équipes', sub: 'Les dix premiers clubs',
        empty: !best.length, emptyWhy: none('aucun club classé.') },
      { id: 'joueurs', label: 'Meilleurs joueurs', sub: 'Les dix meilleures notes de la semaine',
        empty: !players.length, emptyWhy: none('aucune note enregistrée.') }
    ];
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
    const ctx = this.ouvrirMatch(opp, opts);
    ctx.E.finish();
    return this.cloreMatch(ctx);
  }

  // La même chose, mais sans geler l'écran. Un match fait 54 000 pas de calcul : deux
  // secondes sur un ordinateur, dix à trente sur un téléphone. En une seule boucle,
  // l'interface est morte pendant tout ce temps et le joueur croit à un plantage.
  //
  // La suite des pas est identique à celle de playMatch, donc le match l'est aussi,
  // au chiffre près. On ne va pas plus vite : on rend la main entre deux paquets.
  // `avance(minute, horloge)` est appelée au fil de l'eau : la minute pour une jauge,
  // l'horloge pour l'affichage, parce qu'elle sait écrire « 45+2' » et pas 47'.
  playMatchAsync(opp, opts, avance) {
    // `avance` reçoit aussi le match en direct : entre deux paquets, l'écran peut
    // remplacer, crier une consigne ou jouer une carte (direct.js). Sans décision, le
    // match est celui de playMatch, au chiffre près.
    const d = this.matchEnDirect(opp, opts);
    return new Promise((resolve) => {
      const paquet = () => {
        const r = d.avancer((opts && opts.tranche) || 40);
        if (r.done) { resolve(d.terminer()); return; }
        if (avance) avance(r.minute, r.clock, d);
        setTimeout(paquet, 0);
      };
      paquet();
    });
  }

  // Tout ce qui précède le coup d'envoi.
  ouvrirMatch(opp, opts) {
    // un seul match à la fois : un second ouvert pendant le direct compterait la journée deux fois
    if (this.enDirect) throw new Error('Un match est déjà en cours');
    const s = this.state, o = opts || {}, seed = o.seed != null ? o.seed : Date.now() % 100000;
    const xi = this.pickXI(s.formation).map((p) => Object.assign({}, p, { energy: p.fit != null ? p.fit : 100, yc: 0, red: false }));
    const styles = this.styles(), oppForm = (styles[opp.style] || {}).form || '4-4-2';
    const shapeA = this.baseShape(oppForm, 'A'), rnd = this.seedR(seed);
    const oxi = shapeA.map((b, i) => ({ id: 9000 + i, name: 'J' + i, pos: b.line, line: b.line, ovr: Math.round(opp.ovr + (rnd() - 0.5) * 8), energy: 100, yc: 0, red: false }));
    const obench = ['MIL', 'ATT', 'DEF'].map((pos, i) => ({ id: 9500 + i, name: 'B' + i, pos, ovr: Math.round(opp.ovr - 2) }));
    const plan = this.matchPlan();   // figé AVANT le coup d'envoi : le plan tactique se consomme
    // §22 seul le match prévu au calendrier compte pour la division ; tout autre match
    // est un amical, décidé ici, avant le coup d'envoi, et pas à l'arrivée
    const amical = !!o.friendly || !this.estAuCalendrier(opp);
    const cfg = this.engineCfg(opp, xi, oxi, obench);
    // pour le direct : de quoi rejouer ce match à l'identique s'il est interrompu (direct.js),
    // la graine, les tirages déjà faits (la note de chaque adversaire) et le moteur tel qu'il
    // est au coup d'envoi, puisque l'effectif ou la tactique peuvent changer d'ici là
    const depart = o.depart ? { seed, tirages: oxi.length, cfg: JSON.parse(JSON.stringify(cfg)) } : null;
    // §6 la tactique au coup d'envoi : le point de départ du coaching en direct
    const tactique = { formation: s.formation, tac: Object.assign({}, cfg.sides.H.tac), ment: cfg.sides.H.ment };
    const E = makeEngine(Object.assign(cfg, { rnd }));
    return { E, xi, oxi, opp, plan, amical, depart, tactique };
  }

  // Tout ce qui suit le coup de sifflet final.
  cloreMatch(ctx) {
    const { E, xi, oxi, opp, plan, amical } = ctx, s = this.state;
    // l'issue (avec les tirs au but d'un amical nul, §51) et la prime : direct.js, la
    // même règle que l'écran Mon Club ; un amical rapporte moitié moins (§22)
    const { f, hs, as, res, reward, pso } = this.issueDuMatch(E, amical);
    const logs = E.log.map((l) => (l.k === 'G' ? { m: l.m, text: l.text, k: l.k, s: l.s, by: l.by, as: l.as } : { m: l.m, text: l.text, k: l.k, s: l.s }));
    // qui a joué : le onze final puis les remplacés, avec leurs minutes
    const J = this.joueursDuMatch(xi, f, ctx.sortis, ctx.entres);
    // §19 : qui a marqué, qui a fait la passe, remplacés compris. Les quêtes et l'XP en dépendent.
    const { scorers, assisters } = this.buteursDuMatch(logs, J.xi);
    const mt = { opp, oxi, bench: this.benchOf(xi), hs, as, st: f.st, rat: J.rat || f.rat, res, reward, pso, done: true, ended: true, plan, friendly: !!amical,
      poss: f.poss, scorers, assisters, assists: assisters.length, cnt: f.cnt || {}, log: logs, xi: J.xi };
    const record = amical ? s.record : Object.assign({}, s.record, { [res]: s.record[res] + 1 });
    const base = Object.assign({}, this.state, { balance: s.balance + reward, record });
    const patch = this.afterMatch(mt, base);
    // le match est joué : il n'est plus « engagé » (direct.js)
    this.setState(Object.assign({ record, matchEngage: null }, patch));
    // poss : la vraie possession, en temps de ballon, pas en nombre de passes.
    // playVersus la renvoyait déjà ; elle manquait ici, donc rien hors de l'écran ne
    // pouvait vérifier qu'un style de possession garde effectivement le ballon.
    return { score: [hs, as], res, reward, pso: pso ? { H: pso.H, A: pso.A } : null, stats: f.st, poss: f.poss, cnt: f.cnt || {}, log: mt.log, patch,
      amical: !!amical, impact: this.impactReport(mt) };
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
Object.assign(Club.prototype, Players, Skills, Cards, Staff, Training, Transfer, Progression, Tactics, Tracks, PlayerXP, Quests, Creation, OnlineUI, TrainPack, Packs, News, Impact, LeagueRules, Division, Direct, Stade3D);

// LinkFoot : sauvegarde. Sérialise l'état du club, le relit, et le range
// où tu veux : mémoire, navigateur, ou ton serveur.

const SAVE_VERSION = 6;

// Ce qui est conservé d'une session à l'autre. Tout le reste (vue courante, animation de
// pack, horodatages d'affichage) est volatil et recalculé au chargement. Le match en cours,
// lui, est gardé sous la forme d'un match engagé (matchEngage), qui se rejoue au retour.
const PERSIST = [
  'formation', 'balance', 'preset', 'mentality', 'tac', 'roles', 'duties', 'lineup',
  'squad', 'nextId', 'record', 'kit', 'xp', 'level', 'dayStreak', 'dayClaimed',
  'winStreak', 'freePackAt', 'freeQueue', 'division', 'seasonP', 'missions',
  'staff', 'stade', 'academy', 'youth', 'inv', 'coach', 'coachMode', 'cohBonus', 'trainDone',
  // directeur sportif : inventaire de compétences, économie encadrée, quêtes, identité du club
  'skillInv', 'nextSkillUid', 'collected', 'seenPlayers', 'shards',
  'caps', 'ledger', 'quests', 'clubName', 'country', 'created', 'pronos', 'sessions', 'coachInv', 'nextAdv',
  // §17 transferts et finances : un joueur acheté ne revient pas sur le marché au
  // rechargement, et l'écran Finances garde le bilan du dernier match
  'market', 'lastFin',
  // §22 la division : calendrier, résultats et classement de la saison, et la saison d'avant
  'league', 'saison', 'lastSeason',
  // §2 un match engagé : fermer l'app pendant le direct ne l'efface pas, il se rejoue au retour
  'matchEngage'
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
  }),
  // v2 : avant l'inventaire de compétences, les quêtes et le journal des transactions.
  // Les anciennes parties repartent avec un effectif au niveau 1 et aucune compétence
  // en réserve ; rien n'est perdu, les joueurs gardent leurs statistiques.
  2: (st) => Object.assign({}, st, {
    skillInv: st.skillInv || [], nextSkillUid: st.nextSkillUid || 1,
    collected: st.collected || [], seenPlayers: st.seenPlayers || [],
    shards: st.shards || 0, caps: st.caps || {}, ledger: st.ledger || [],
    quests: st.quests || null, clubName: st.clubName || 'FC TonPseudo',
    country: st.country || 'fr', created: st.created !== false,
    squad: (st.squad || []).map((p) => Object.assign({ plv: 1, pxp: 0 }, p)),
    // les anciennes clés de packs n'existent plus : tout devient le pack unique
    freeQueue: (st.freeQueue || []).map(() => 'linkfoot')
  }),
  // v3 : avant les pronostics sur le match du jeu (§9).
  3: (st) => Object.assign({}, st, { pronos: st.pronos || [] }),
  // v4 : avant que l'entraînement ne coûte des séances (§6). Les anciennes parties
  // repartent avec trois séances en stock, de quoi reprendre sans se sentir puni.
  4: (st) => Object.assign({}, st, { sessions: st.sessions != null ? st.sessions : 3 }),
  // v5 : avant le Pack Entraîneur et son matériel tactique (§24).
  5: (st) => Object.assign({}, st, { coachInv: st.coachInv || {}, nextAdv: 0 })
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

// LinkFoot : match entre deux vrais clubs (§26, §73, §74).
//
// Le moteur est déterministe : à graine égale, le match est identique partout.
// Le serveur n'a donc pas besoin de stocker un film de match, seulement
// (club A, club B, graine). Les deux joueurs rejouent la même rencontre chez eux,
// avec les mêmes buts à la même minute, et personne ne peut la truquer de son côté
// puisque le score fait foi côté serveur (§29).


// L'état minimal d'un club à envoyer au serveur pour qu'il puisse jouer le match.
// On n'envoie ni le solde, ni l'inventaire, ni le journal : seulement l'équipe.
function teamSnapshot(club) {
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
function verifierEquipe(t) {
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

function versusCfg(home0, away0, seed) {
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
function playVersus(home, away, seed, opts) {
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
function verifyResult(home, away, seed, claimed) {
  const real = playVersus(home, away, seed);
  const ok = !!claimed && real.score[0] === claimed[0] && real.score[1] === claimed[1];
  return { ok, real: real.score, claimed: claimed || null };
}

root.LinkFoot = { makeEngine, Club, INITIAL_STATE, serialize, deserialize, SAVE_VERSION, MemoryStore, LocalStore, HttpStore, SaveManager,
  standings, schedule, applyResult, emptyRow, movements, createTournament, pendingMatches, reportResult, finalRanking, rewards, PAYOUTS,
  teamSnapshot, versusCfg, playVersus, verifyResult };
})(typeof window !== 'undefined' ? window : globalThis);
