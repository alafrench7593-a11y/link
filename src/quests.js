// LinkFoot : QuestEngine et EconomyEngine (§7, §8, §29).
//
// §7 : l'argent doit être difficile à obtenir et chaque dépense doit compter.
// §29 : aucune source ne doit pouvoir produire une quantité infinie d'argent,
// donc chaque gain passe par `earn`, qui applique un plafond quotidien et
// écrit une ligne dans le journal. Rien n'arrive au solde par un autre chemin.
export const Quests = {
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
