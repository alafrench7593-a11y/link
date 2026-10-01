// LinkFoot : Progression du club : niveaux, missions, suites de match, saison, vieillissement (§70, §72).
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
export const Progression = {
  levelNeed(l) { return 300 + l * 100; },

  addXp(st, gain) {
    let xp = st.xp + gain, level = st.level, bal = 0, queue = st.freeQueue.slice(), ups = [];
    while (xp >= this.levelNeed(level)) {
      xp -= this.levelNeed(level); level++;
      bal += 100 + level * 20;
      // un pack offert tous les 5 niveaux, pris dans la vraie liste des packs
      const key = level % 5 === 0 ? (level >= 15 ? 'gold' : level >= 10 ? 'elite' : 'premium') : null;
      if (key) queue.push(key);
      // ce que ce niveau débloque, dit une seule fois, au moment où ça arrive
      const opened = this.unlocksAt(level);
      ups.push({ level, text: '+' + (100 + level * 20) + ' jetons' + (key ? ' + ' + this.packName(key) + ' offert' : '') + (opened.length ? ' · débloque ' + opened.join(', ') : '') });
    }
    return { xp, level, bonusBal: bal, freeQueue: queue, ups };
  },

  // Ce que le niveau `l` ouvre : lu dans les paliers, jamais écrit en dur deux fois.
  unlocksAt(l) {
    const G = this.GATES(), out = [];
    G.card.forEach((n, i) => { if (n === l && i > 1) out.push('niveau de carte ' + i); });
    G.staff.forEach((n, i) => { if (n === l && i > 0) out.push('staff niveau ' + i); });
    G.stade.forEach((n, i) => { if (n === l && i > 0) out.push(this.STADES()[i].name); });
    G.academy.forEach((n, i) => { if (n === l && i > 0) out.push(this.ACADEMIES()[i].name); });
    this.PACK_DEFS().forEach((d) => { if ((d.req || 0) === l) out.push(d.name); });
    return out;
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
      if (rank <= 2 && st.division > 1) { patch.division = st.division - 1; patch.balance += 500; patch.freeQueue = patch.freeQueue.concat(['gold']); over = { title: 'PROMU EN DIVISION ' + patch.division + ' !', sub: 'Fin de saison : ' + rank + 'e. +500 jetons et un Pack Or. Les adversaires seront plus forts.' + ygTxt }; }
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
