// LinkFoot : Marché des transferts : valeur, offres, vente (§71).
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
export const Transfer = {
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
