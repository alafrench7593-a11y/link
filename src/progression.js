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
