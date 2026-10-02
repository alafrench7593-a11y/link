// LinkFoot : Marché des transferts : valeur, offres, vente (§71).
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
export const Transfer = {
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
