// LinkFoot : PlayerProgression (§5, §6, §20).
// Un joueur a UN niveau, monté par l'XP. Pas de second barème.
//
// §6 : monter un joueur doit être difficile et le devenir de plus en plus.
// L'argent aide (entraînement, fragments) mais ne remplace jamais le temps de jeu :
// l'XP d'entraînement est plafonnée par jour, celle des matchs ne l'est pas.
export const PlayerXP = {
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
