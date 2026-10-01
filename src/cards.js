// LinkFoot : Cartes : raretés, catalogue de 500, packs, collection, fragments et niveaux (§56 à §65).
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
export const Cards = {
  RARITY() {
    return [
      { id: 'normal', label: 'Normal', rate: 0.55, lo: 48, hi: 64, shards: 1, color: 'linear-gradient(135deg, #AEB9C2, #6F8077)', ink: '#0B1210' },
      { id: 'common', label: 'Commun', rate: 0.25, lo: 56, hi: 70, shards: 2, color: 'linear-gradient(135deg, #CFE0D4, #8FA89A)', ink: '#0B1210' },
      { id: 'rare', label: 'Rare', rate: 0.12, lo: 64, hi: 77, shards: 5, color: 'linear-gradient(135deg, #7FB0FF, #3E6BFF)', ink: '#06101F' },
      { id: 'epic', label: 'Épique', rate: 0.05, lo: 71, hi: 83, shards: 12, color: 'linear-gradient(135deg, #C39BFF, #7B4FD8)', ink: '#120A24' },
      { id: 'elite', label: 'Élite', rate: 0.02, lo: 77, hi: 88, shards: 30, color: 'linear-gradient(135deg, #4FDCC4, #1E9E92)', ink: '#04201C' },
      { id: 'gold', label: 'Or', rate: 0.009, lo: 82, hi: 92, shards: 80, color: 'linear-gradient(135deg, #FFE59A, #E9A93A)', ink: '#241703' },
      { id: 'legendary', label: 'Légendaire', rate: 0.001, lo: 86, hi: 95, shards: 200, color: 'linear-gradient(135deg, #FF9F6B, #FF4F7B)', ink: '#2A0812' }
    ];
  },

  rarityOf(id) { return this.RARITY().find((r) => r.id === id) || this.RARITY()[0]; },

  CARD_POOL() {
    if (this._pool) return this._pool;
    const R = this.RARITY(), r = this.seedR(424242);
    const F = ['A.', 'B.', 'C.', 'D.', 'E.', 'F.', 'G.', 'H.', 'I.', 'J.', 'K.', 'L.', 'M.', 'N.', 'O.', 'P.', 'R.', 'S.', 'T.', 'V.', 'Y.', 'Z.'];
    const L = ['Marvello', 'Ducasson', 'Ebongué', 'Halvorsen', 'Quintero', 'Belkadi-Roy', 'Stranieri', 'Okafor-Lemaire', 'Vasquet', 'Nyamsi', 'Gaudrel', 'Petrakis', 'Lindau', 'Moreau-Diaby', 'Castagne-Nil', 'Rivoire', 'Takamura', 'Ferbault', 'Ansaldi', 'Kowalevski', 'Dembrel', 'Soumahé', 'Varnier', 'Okonkwé', 'Delacroix-Sy', 'Ferrandi', 'Braxton', 'Kessler', 'Mbaloula', 'Arroyo-Faye', 'Lindqvist', 'Rouvière', 'Adebanjo', 'Castellane', 'Moulinet', 'Tavares', 'Bellanger', 'Cissoko-Vidal', 'Ngoumou', 'Rakotoson', 'Esperanza', 'Haugen', 'Pirlotti', 'Zemmouri', 'Okonjo', 'Vanthier', 'Bramante', 'Keita-Marsal'];
    const POS = ['GB', 'DEF', 'DEF', 'DEF', 'MIL', 'MIL', 'MIL', 'ATT', 'ATT'];
    const pool = [];
    // la part de chaque rareté dans le catalogue suit les taux, avec au moins une carte par rareté
    const counts = R.map((x) => Math.max(1, Math.round(x.rate * 500)));
    counts[0] += 500 - counts.reduce((a2, v) => a2 + v, 0);   // le catalogue fait exactement 500 cartes
    R.forEach((rar, ri) => {
      for (let k = 0; k < counts[ri]; k++) {
        const id = 50000 + pool.length;
        pool.push({ id, name: F[Math.floor(r() * F.length)] + ' ' + L[Math.floor(r() * L.length)],
          pos: POS[Math.floor(r() * POS.length)], ovr: rar.lo + Math.floor(r() * (rar.hi - rar.lo + 1)), rar: rar.id });
      }
    });
    return (this._pool = pool);
  },

  drawCard(packWeights, rnd) {
    const R = this.RARITY(), w = R.map((x) => x.rate * ((packWeights || {})[x.id] != null ? packWeights[x.id] : 1));
    let t = w.reduce((a, v) => a + v, 0), q = (rnd || Math.random)() * t, pick = R[0];
    for (let i = 0; i < R.length; i++) { q -= w[i]; if (q <= 0) { pick = R[i]; break; } }
    const pool = this.CARD_POOL().filter((c) => c.rar === pick.id);
    return pool[Math.floor((rnd || Math.random)() * pool.length)];
  },

  PACK_DEFS() {
    return [
      { key: 'basic', name: 'Pack Basic', n: 3, cost: 150, w: {}, color: 'linear-gradient(135deg, #AEB9C2, #6F8077)', fx: 'bronze' },
      { key: 'premium', name: 'Pack Premium', n: 4, cost: 400, w: { normal: 0.4, common: 1.2, rare: 2.2, epic: 2.5, elite: 2, gold: 1.6, legendary: 1.4 }, color: 'linear-gradient(135deg, #F2F6F4, #AEB9C2)', fx: 'silver' },
      { key: 'elite', name: 'Pack Élite', n: 3, cost: 900, w: { normal: 0.1, common: 0.5, rare: 2, epic: 4, elite: 5, gold: 3, legendary: 2.5 }, color: 'linear-gradient(135deg, #4FDCC4, #1E9E92)', fx: 'silver' },
      { key: 'gold', name: 'Pack Or', n: 3, cost: 2000, w: { normal: 0, common: 0.2, rare: 1.2, epic: 4, elite: 8, gold: 9, legendary: 6 }, color: 'linear-gradient(135deg, #FFE59A, #E9A93A)', fx: 'gold' },
      { key: 'special', name: 'Pack Spécial', n: 2, cost: 1200, w: { normal: 0, common: 0, rare: 2, epic: 5, elite: 6, gold: 5, legendary: 4 }, color: 'linear-gradient(135deg, #FF9F6B, #FF4F7B)', fx: 'gold' }
    ];
  },

  packOdds(def) {
    const R = this.RARITY(), w = R.map((x) => x.rate * ((def.w || {})[x.id] != null ? def.w[x.id] : 1));
    const t = w.reduce((a, v) => a + v, 0) || 1;
    return R.map((x, i) => ({ id: x.id, label: x.label, color: x.color, pct: (w[i] / t * 100) }));
  },

  collection() {
    const owned = new Set((this.state.squad || []).concat(this.state.collected || []).map((p) => p.id != null ? p.id : p));
    const pool = this.CARD_POOL();
    const have = pool.filter((c) => owned.has(c.id)).length;
    return { have, total: pool.length };
  },

  UPGRADE_COST() { return [0, 25, 60, 140, 320]; },

  cardLevel(p) { return p.lvl || 1; },

  upgradeInfo(p) {
    const lvl = this.cardLevel(p), max = lvl >= 5;
    const cost = max ? 0 : this.UPGRADE_COST()[lvl];
    return { lvl, max, cost, can: !max && (this.state.shards || 0) >= cost };
  },

  levelUpPlayer(id) {
    const s = this.state, p = s.squad.find((x) => x.id === id);
    if (!p) return { ok: false, why: 'Joueur introuvable' };
    const info = this.upgradeInfo(p);
    if (info.max) return { ok: false, why: 'Niveau maximum' };
    if (!info.can) return { ok: false, why: 'Il te manque ' + (info.cost - (s.shards || 0)) + ' fragments' };
    const st = {}; this.cardStats(p).forEach((q) => { st[q.l] = q.v; });
    const w = this.statW(p.pos), keys = Object.keys(w).sort((a, b) => w[b] - w[a]).slice(0, 2);
    keys.forEach((k) => { if (st[k] != null && st[k] < 99) st[k] += 2; });
    const ovr = Math.max(p.ovr, this.ovrOf(p.pos, st));
    this.buzz([30, 30, 60]);
    this.setState({ shards: (s.shards || 0) - info.cost,
      squad: s.squad.map((x) => (x.id === id ? Object.assign({}, x, { st, ovr, lvl: info.lvl + 1 }) : x)),
      trainLog: p.name + ' passe niveau ' + (info.lvl + 1) + ' · ' + keys.map((k) => '+2 ' + k).join(', ') });
    return { ok: true, lvl: info.lvl + 1 };
  },

  MATCH_CARDS() {
    return [
      { id: 'energie', label: 'Boost énergie', desc: '+15 % d’énergie pour tout le XI', icon: 'M13 2 3 14h7l-1 8 10-12h-7z' },
      { id: 'motivation', label: 'Motivation', desc: 'Décision et finition +, 20 minutes', icon: 'M12 2 15 8l7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z' },
      { id: 'pressing', label: 'Pressing', desc: 'Pressing haut et intense, 15 minutes', icon: 'M4 12h16M12 4l8 8-8 8' },
      { id: 'bloc', label: 'Bloc défensif', desc: 'Bloc bas, défense renforcée, 15 minutes', icon: 'M12 2 20 5v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5z' },
      { id: 'contre', label: 'Contre-attaque', desc: 'Vitesse et transitions rapides, 15 minutes', icon: 'M3 17 9 11l4 4 8-8M14 7h7v7' },
      { id: 'finition', label: 'Boost finition', desc: 'Tir +5, 15 minutes', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' }
    ];
  },

  UPGRADE_CARDS() { return [['VIT', 'Vitesse'], ['ATQ', 'Attaque'], ['TIR', 'Tir'], ['PAS', 'Passe'], ['DRI', 'Dribble'], ['DÉF', 'Défense'], ['PHY', 'Physique']]; },

  useUpgrade(pid, stat) {
    const s = this.state, key = 'up_' + stat, inv = Object.assign({}, s.inv || {}); if (!(inv[key] > 0)) return;
    const p = s.squad.find((q) => q.id === pid); if (!p) return;
    const st = {}; this.cardStats(p).forEach((q) => { st[q.l] = q.v; }); if (st[stat] == null || st[stat] >= 99) return;
    st[stat] = Math.min(99, st[stat] + 2); inv[key]--; this.buzz(30);
    this.setState({ inv, squad: s.squad.map((q) => (q.id === pid ? Object.assign({}, q, { st, ovr: Math.max(q.ovr, this.ovrOf(q.pos, st)) }) : q)) });
  }
};
