// LinkFoot : Fiches joueurs : statistiques, note globale, profil (âge, nationalité, pied, forme).
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
export const Players = {
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
