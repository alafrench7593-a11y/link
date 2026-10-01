// LinkFoot : Staff, stade, centre de formation, synergies et finances.
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
export const Staff = {
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
