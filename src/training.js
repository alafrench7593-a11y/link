// LinkFoot : Entraînement, forme, énergie et blessures (§68, §69).
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
export const Training = {
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
