// LinkFoot : moteur de match. Aucune dépendance, aucun DOM.
// Entrée : une configuration { sides: { H, A } } produite par Club.engineCfg().
// Sortie : une API { next, finish, state, step, frame, sub, card, shout, shootout, ... }.

export function makeEngine(cfg) {
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
    // §59 la passerelle vers un rendu externe (Unreal Engine 5, docs/passerelle-ue5.md) : ce
    // que chaque joueur FAIT, horodaté, pour que le rendu choisisse le bon geste. Enregistré
    // seulement si cfg.pont est demandé, sans rien tirer au hasard ni rien changer au monde :
    // avec ou sans, le match est le même au chiffre près (test/passerelle.js).
    const PONT = !!(cfg && cfg.pont);
    let curAc = [];
    const act = PONT ? (p, a, d) => { curAc.push(Object.assign({ t: W.t, c: p ? p.code : -1, a }, d || null)); } : () => {};
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
      if (res !== 'block' && !gk.red) { W.dive = { c: gk.code, dir: Math.sign((tx - gk.x) * (s === 'H' ? 1 : -1)) || 1, t0: W.t, dur: f.dur + 0.2 }; act(gk, 'plongeon', { dir: W.dive.dir, dur: W.dive.dur, x: tx, y: ty, issue: res }); }
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
      W.fl = { x0: b.x, y0: b.y, z0: b.z, x1: tx, y1: ty, t0: W.t, dur, kind, from: p, to, aerial, apex, v: d / Math.max(0.1, dur), u: 0, offside: null, cpa: W.cpaEnCours || null };
      act(p, 'ballon', { fl: W.fl });
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
        W.fl = null; W.owner = null; const b = W.ball, ang = R() * 6.283; b.vx = Math.cos(ang) * 3.5 + (f ? (f.x1 - f.x0) / f.dur * 0.15 : 0); b.vy = Math.sin(ang) * 3.5 + (f ? (f.y1 - f.y0) / f.dur * 0.15 : 0); b.z = 0; W.last = q.s; q.beat = 0.35;
        act(q, 'controle', { niveau: 'rate', haut: !!(f && f.aerial), presse: no.d < 2 }); return;
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
      act(q, 'controle', { niveau: lvl, une_touche: !!q.oneTouch, haut: !!(f && f.aerial), presse: no.d < 2 });
      if (inBox(aOf(q.s, q.y), q.x)) { key(14, q.s, 'box'); W.cnt.boxRcv = (W.cnt.boxRcv || 0) + 1; W.cnt['boxRcv_' + q.s] = (W.cnt['boxRcv_' + q.s] || 0) + 1; }
    };
    const intercept = (q) => {
      const f = W.fl; W.fl = null; if (f && f.from) rt(f.from, -0.03); rt(q, 0.05); W.st[q.s].tk++;
      act(q, 'interception', { de: f && f.from ? f.from.code : -1 });
      gain(q, 'int'); com('Interception de ' + q.short);
    };
    const offsideCall = (q) => {
      W.st[q.s].off++; act(q, 'hors_jeu'); banner('HORS-JEU', q.short, '#F2F4F7', 1.4); com('Hors-jeu de ' + q.short + ', le drapeau se lève'); logE('Hors-jeu de ' + q.name + ' signalé', '#9AA3B0', 'O', q.s);
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
          if (R() < cl(0.5 + (gk.han - 65) / 90, 0.3, 0.8)) { rt(gk, 0.08); act(gk, 'prise_aerienne'); com(gk.short + ' sort et capte le ballon'); gkHold(gk); return true; }
        }
      }
      const cands = all().filter((q) => q.fall <= 0 && q.line !== 'GB' && hy(q.x - L.x, q.y - L.y) < 2.6);
      if (!cands.length) return false;
      const w = cands.map((q) => Math.pow((q.phy + (q.target ? 10 : 0)) / 70, 3.5) * (1.6 - hy(q.x - L.x, q.y - L.y) / 2.6) * (q.s === dS ? (isCross ? 2.1 : 1.1) : 1));
      let r = R() * w.reduce((a, v) => a + v, 0), win = cands[0];
      for (let k = 0; k < cands.length; k++) { r -= w[k]; if (r <= 0) { win = cands[k]; break; } }
      const b = W.ball; b.x = L.x; b.y = L.y; b.z = 1.8;
      act(win, 'duel_aerien', { autres: cands.filter((q) => q !== win).map((q) => q.code) });
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
        const geste = dbl ? 'double' : f.xg > 0.35 || (TR(gk, 'gk') > 0.5 && f.xg > 0.18) ? 'reflexe' : f.sv === 'lob' ? 'detente' : f.sv === 'rasSol' || f.sv === 'ferme' ? 'pied' : f.head ? 'claquette' : 'parade';
        if (r < cp) { act(gk, 'arret', { geste, issue: 'capte', tireur: p.code }); gkHold(gk); return; }
        if (r < cp + (1 - cp) * 0.55) { act(gk, 'arret', { geste, issue: 'corner', tireur: p.code }); com('Le gardien détourne en corner'); outBehind(o, b.x); return; }
        act(gk, 'arret', { geste, issue: 'repousse', tireur: p.code });
        b.vx = (R() - 0.5) * 9; b.vy = (s === 'H' ? 1 : -1) * (4 + R() * 5); b.z = 0.3; W.owner = null; W.last = o; return;
      }
      if (f.res === 'miss') {
        if (f.post) { act(p, 'poteau'); banner('POTEAU !', p.short, '#FFE14D', 1.4); com('Sur le poteau !'); b.vx = (R() - 0.5) * 8; b.vy = (s === 'H' ? 1 : -1) * (5 + R() * 6); W.owner = null; W.last = s; return; }
        banner('À CÔTÉ', p.short, '#F2F4F7', 1.1); com(p.short + ' manque le cadre'); setPiece('gk', o, b.x, b.y); return;
      }
      const bl = f.blocker;
      if (aOf(s, bl.y) > 92 && Math.abs(bl.x - 34) < 9 && R() < 0.012) { ownGoal(bl, p); return; }
      rt(bl, 0.06); W.st[o].tk++; act(bl, 'contre', { tireur: p.code }); banner('CONTRÉ !', bl.short, '#F2F4F7', 1.1); com('Frappe contrée par ' + bl.short);
      if (aOf(s, bl.y) > 95 && R() < 0.35) { outBehind(o, bl.x); return; }
      b.x = bl.x; b.y = bl.y; b.vx = (R() - 0.5) * 11; b.vy = (s === 'H' ? 1 : -1) * (2 + R() * 7) * (R() < 0.35 ? -1 : 1); b.z = 0; W.owner = null; W.last = o;
    };
    const ownGoal = (bl, shooter) => {
      const s = shooter.s, o = bl.s; W.score[s]++; rt(bl, -0.9); const b = W.ball; b.x = 34; b.y = yOf(s, PL + 1.3); b.z = 0.3;
      mark({ k: 'goal', s, c: bl.code, name: bl.short }); banner('CSC !', bl.short + ' · ' + W.score.H + ' - ' + W.score.A, s === 'H' ? '#2ECC71' : '#FF4757', 2.8);
      com('Malheureux ' + bl.short + ' : la frappe de ' + shooter.short + ' est déviée dans son propre but !');
      logE('BUT ! ' + bl.name + ' contre son camp, frappe déviée de ' + shooter.name + ' (' + W.score.H + '-' + W.score.A + ')', s === 'H' ? '#48E08B' : '#FF4757', 'G', s, { by: null, as: null, csc: bl.name });
      key(100, s, 'goal'); W.celK = 'calme'; W.cel = W.t + 3.2; W.celS = s; W.scorer = shooter; W.owner = null; W.fl = null;
      act(bl, 'but', { csc: true, tireur: shooter.code }); act(shooter, 'celebration', { genre: W.celK, fin: W.cel });
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
      act(p, 'but', { csc: false }); act(p, 'celebration', { genre: W.celK, fin: W.cel });
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
      W.cpaEnCours = k;
      if (k === 'pen') {
        const gk = TM[o].ps[0]; W.st[s].sh++; W.st[s].xg += 0.78;
        const pg = cl(0.78 + (p.sht - 70) * 0.004 - ((gk.red ? 30 : gk.ref) - 70) * 0.004, 0.62, 0.92), r = R();
        const res = r < pg ? 'goal' : r < pg + (1 - pg) * 0.66 ? 'save' : 'miss';
        if (res !== 'miss') W.st[s].on++;
        const side = R() < 0.5 ? -1 : 1, gy = yOf(s, PL), sgn = s === 'H' ? -1 : 1;
        const tx = res === 'miss' ? 34 + side * (4 + R() * 1.5) : 34 + side * (1.6 + R() * 1.6), ty = res === 'save' ? gy - sgn * 0.6 : gy + sgn * (res === 'goal' ? 1.2 : 2.5);
        const f = kick(p, tx, ty, 'shot', null, { v: 23, apex: res === 'miss' ? 1.8 : 0.5 }); Object.assign(f, { res, shooter: p, head: false, xg: 0.78, pen: true });
        if (!gk.red) { W.dive = { c: gk.code, dir: (res === 'save' ? side : -side) * (s === 'H' ? 1 : -1), t0: W.t, dur: f.dur + 0.2 }; act(gk, 'plongeon', { dir: W.dive.dir, dur: W.dive.dur, x: tx, y: ty, issue: res, penalty: true }); }
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
      act(fr, 'faute', { victime: vic.code, cause: cause || null, carton: card, penalty: !!pen, chute: 1.3 });
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
    const TACLE_TXT = { glisse: 'Tacle glissé de ', interception: 'Interception de ', tacle: 'Tacle de ' };
    const genreTacle = (d) => (TR(d, 'tackle') > 0.4 && R() < 0.45 ? 'glisse' : TR(d, 'press') > 0.4 && R() < 0.4 ? 'interception' : 'tacle');
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
            act(c, 'dribble', { geste: g.n, palier: g.tier, contre: bl.code, reussi: true });
            com(c.short + (g.tier >= 4 ? ' : ' + g.lab + ' sur ' + bl.short + ' !' : g.tier >= 3 ? ' élimine ' + bl.short + ' d’une ' + g.lab : ' élimine ' + bl.short + ' !'));
            // §23 un geste de haut palier mérite sa ligne dans le rapport : il reste rare,
            // donc il ne noie pas le fil des événements.
            if (g.tier >= 4) logE(c.name + ' : ' + g.lab + ' sur ' + bl.name, s === 'H' ? '#BDEBC9' : '#F2B6B6', 'skill', s);
            if (aOf(s, c.y) > 66) key(12 + g.tier * 2, s, 'drib'); c.vx *= 1.1 + g.gain * 0.08; c.vy *= 1.1 + g.gain * 0.08; }
          else { const pf = (inBox(aOf(s, c.y), c.x) ? 0.15 : 1) * 0.17 * [0.65, 1, 1.45][TM[o].tac.tackle] * (TM[o].shout === 'calme' ? 0.75 : 1) * (bl.yc >= 1 ? 0.14 : 1);
            act(c, 'dribble', { geste: g.n, palier: g.tier, contre: bl.code, reussi: false });
            if (R() < pf) { foul(bl, c, 'drib'); return; }
            rt(bl, 0.07); rt(c, -0.04); W.st[o].tk++;
            const genre = genreTacle(bl);
            act(bl, 'tacle', { genre, cible: c.code, reussi: true });
            com(TACLE_TXT[genre] + bl.short + ', ballon récupéré');
            if (R() < 0.7) gain(bl, 'tackle'); else { W.owner = null; const b = W.ball; b.vx = (R() - 0.5) * 8; b.vy = (R() - 0.5) * 8; W.last = o; }
            c.beat = 0.5; }
          return;
        }
      }
      const gk = TM[o].ps[0];
      if (!gk.red && gk.fall <= 0 && W.t >= gk.tkT && hy(gk.x - c.x, gk.y - c.y) < 2.2 && inBox(aOf(s, c.y), c.x)) {
        gk.tkT = W.t + 0.4;
        const r = R(), pw = cl(0.5 + (gk.div - c.dri) / 90, 0.25, 0.8);
        if (r < pw) { rt(gk, 0.15); act(gk, 'sortie_pieds', { cible: c.code, reussi: true }); com(gk.short + ' plonge dans les pieds de ' + c.short + ' !'); banner('ARRÊT !', gk.short, '#F2F4F7', 1.2); gkHold(gk); return; }
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
        if (r < pWin) { rt(d, 0.07); rt(c, -0.04); W.st[o].tk++; const genre = genreTacle(d); act(d, 'tacle', { genre, cible: c.code, reussi: true }); com(TACLE_TXT[genre] + d.short + ' !'); if (R() < 0.72) gain(d, 'tackle'); else { W.owner = null; const b = W.ball; b.vx = (R() - 0.5) * 9; b.vy = (R() - 0.5) * 9; W.last = o; } return; }
        if (r < pWin + pF) { foul(d, c, 'tackle'); return; }
        act(d, 'tacle', { genre: 'tacle', cible: c.code, reussi: false });
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
    // L'image de la passerelle, en plus de l'image ordinaire : pour chaque joueur (code 0 à 21)
    // l'orientation du corps (milliradians, repère du moteur), l'énergie, les états (au sol,
    // déséquilibré, porteur, exclu, sprint voulu, presse, appel), l'intention de l'IA et sa
    // cible ; les actions du pas ; une coupe quand le moteur replace tout le monde.
    const INTENTIONS = ['HOLD', 'SUPPORT', 'BUILD_UP', 'ATTACK_SPACE', 'DROP', 'OVERLAP', 'RECOVER', 'MARK', 'COVER'];
    const serAct = (a) => {
      if (!a.fl) return a;
      const f = a.fl, o = { t: a.t, c: a.c, a: f.kind === 'shot' ? 'tir' : f.kind === 'clear' ? 'degagement' : f.cpa === 'throw' ? 'touche' : 'passe',
        genre: f.kind, cpa: f.cpa, x0: f.x0, y0: f.y0, z0: f.z0, x1: f.x1, y1: f.y1, dur: f.dur, apex: f.apex, aerien: !!f.aerial, vers: f.to ? f.to.code : -1 };
      if (f.kind === 'shot') Object.assign(o, { variante: f.sv || null, issue: f.res, tete: !!f.head, cf: !!f.fk, penalty: !!f.pen, poteau: !!f.post, xg: f.xg });
      return o;
    };
    const imagePont = (f) => {
      const F = new Int16Array(22), E = new Uint8Array(22), S = new Uint8Array(22), I = new Uint8Array(22), T = new Float32Array(44);
      for (let k = 0; k < 22; k++) {
        const p = k < 11 ? TM.H.ps[k] : TM.A.ps[k - 11]; if (!p) continue;
        F[k] = Math.round(Math.atan2(p.fy, p.fx) * 1000);
        E[k] = Math.max(0, Math.min(100, Math.round(p.energy)));
        S[k] = (p.fall > 0 ? 1 : 0) | (p.beat > 0 ? 2 : 0) | (W.owner === p ? 4 : 0) | (p.red ? 8 : 0) | (p.urg > 0.9 ? 16 : 0) | (p.press ? 32 : 0) | (p.run ? 64 : 0) | (p.carry && p.carry.drib ? 128 : 0);
        I[k] = INTENTIONS.indexOf(p.intent) + 1;
        T[k * 2] = p.tx != null ? p.tx : p.x; T[k * 2 + 1] = p.ty != null ? p.ty : p.y;
      }
      Object.assign(f, { F, E, S, I, T });
      if (curAc.length) { f.ac = curAc.map(serAct); curAc = []; }
      if (Math.abs(W.lastTele - (W.t + DT)) < 1e-6) f.coupe = true;
    };
    const rec = () => {
      // en calcul rapide (runFor, runTicks, finish), rien n'est enregistré... sauf si l'écran
      // a demandé à regarder le match (capture) : l'image est alors gardée à part. L'image se
      // fabrique sans rien tirer au hasard ni rien changer au monde : le match reste le même.
      W.cpaEnCours = null;
      if (W.skip && !W.capt) { curEv = []; curAc = []; return; }
      const P = new Float32Array(44);
      for (let i = 0; i < 11; i++) { const h = TM.H.ps[i], a = TM.A.ps[i]; P[i * 2] = !h || h.red ? -9 : h.x; P[i * 2 + 1] = !h || h.red ? -9 : h.y; P[22 + i * 2] = !a || a.red ? -9 : a.x; P[23 + i * 2] = !a || a.red ? -9 : a.y; }
      const fa = []; all().forEach((p) => { if (p.fall > 0) fa.push(p.code); });
      const f = { t: W.t, m: W.clk, h: W.half, P, b: [W.ball.x, W.ball.y, W.ball.z], o: W.owner ? W.owner.code : -1, to: W.fl && W.fl.to ? W.fl.to.code : -1,
        fl: W.fl ? [W.fl.x0, W.fl.y0, W.fl.x1, W.fl.y1, W.fl.kind] : null, ev: curEv.length ? curEv : null, fa: fa.length ? fa : null, set: W.set ? W.set.kind : null, tk: W.set && W.set.taker ? W.set.taker.code : -1,
        dv: W.dive && W.t - W.dive.t0 < W.dive.dur + 1 ? [W.dive.c, W.dive.dir, Math.min(1, (W.t - W.dive.t0) / Math.max(0.2, W.dive.dur))] : null, sc: [W.score.H, W.score.A] };
      curEv = [];
      if (PONT) imagePont(f);
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
        act(np, 'remplacement', { sortant: old.name, entrant: np.name });
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
