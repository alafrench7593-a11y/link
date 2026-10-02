// LinkFoot : Cartes : raretés, catalogue de 500, packs, collection, fragments et niveaux (§56 à §65).
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
export const Cards = {
  // §11 et §16 : six raretés, taux exacts du cahier des charges, affichés avant l'ouverture.
  // `pw` est la bande de puissance d'une compétence qui tombe dans cette rareté (§17) :
  // plus une compétence est forte, plus elle est rare, et plus son taux de drop est faible.
  RARITY() {
    return [
      { id: 'normal', label: 'Normal', rate: 0.70, lo: 48, hi: 64, pw: [0, 19], shards: 1, tint: '#9AA3B0', color: 'linear-gradient(135deg, #AEB9C2, #5E6672)', ink: '#171B21' },
      { id: 'rare', label: 'Rare', rate: 0.20, lo: 62, hi: 74, pw: [20, 39], shards: 4, tint: '#4FA8E8', color: 'linear-gradient(135deg, #4FA8E8, #2F8FE0)', ink: '#06101F' },
      { id: 'epic', label: 'Épique', rate: 0.07, lo: 71, hi: 81, pw: [40, 59], shards: 12, tint: '#C39BFF', color: 'linear-gradient(135deg, #C39BFF, #7B4FD8)', ink: '#120A24' },
      { id: 'elite', label: 'Élite', rate: 0.02, lo: 78, hi: 87, pw: [60, 74], shards: 30, tint: '#2ECC71', color: 'linear-gradient(135deg, #2ECC71, #1E9E92)', ink: '#04201C' },
      { id: 'gold', label: 'Gold', rate: 0.009, lo: 84, hi: 92, pw: [75, 89], shards: 80, tint: '#FFC24A', color: 'linear-gradient(135deg, #FFE59A, #E9A93A)', ink: '#241703' },
      { id: 'legendary', label: 'Legendary', rate: 0.001, lo: 88, hi: 96, pw: [90, 100], shards: 200, tint: '#FF4757', color: 'linear-gradient(135deg, #FF9F6B, #FF4F7B)', ink: '#2A0812' }
    ];
  },

  // La rareté d'une compétence se déduit de sa puissance réelle (§17), jamais l'inverse.
  rarityOfPower(pw) {
    const R = this.RARITY(), v = Math.max(0, Math.min(100, pw));
    return R.find((x) => v >= x.pw[0] && v <= x.pw[1]) || R[0];
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

  // §10 : UN SEUL PACK. Pas de catalogue de packs à comprendre, un seul bouton.
  // §28 : son coût, son contenu possible et ses probabilités sont affichés avant l'ouverture.
  PACK_DEFS() {
    return [
      { key: 'linkfoot', name: 'LinkFoot Pack', n: 3, cost: 250, req: 0, w: {},
        color: 'linear-gradient(135deg, #2ECC71, #1E9E92)', fx: 'gold',
        content: 'joueur, compétence, objet ou fragments' }
    ];
  },

  THE_PACK() { return this.PACK_DEFS()[0]; },

  packState(def) {
    const s = this.state, lock = this.lockOf(def.req || 0);
    const poor = s.balance < def.cost;
    return { locked: lock.locked, need: lock.need, can: !lock.locked && !poor,
      why: lock.locked ? lock.why : poor ? 'Il te manque ' + (def.cost - s.balance) + ' jetons' : '' };
  },

  // Les packs offerts (quotidien, série, niveau, promotion) tirent dans la même liste
  // que les packs achetés : plus de clé inventée qui ne correspond à aucun pack.
  packByKey(key) { return this.PACK_DEFS().find((d) => d.key === key) || this.PACK_DEFS()[0]; },

  packName(key) { return this.packByKey(key).name; },

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

  // §10 : le contenu d'un pack. Un tirage = une rareté (taux du §11), puis le lot :
  // un joueur, une compétence de cette rareté, ou des fragments si le lot est un doublon.
  // Tirage côté système, jamais côté affichage (§29).
  // §8 LE pack principal donne TOUT : joueurs, compétences, objets (séances, cartes
  // d'amélioration, causeries, plans tactiques) et ressources (fragments, quand un
  // joueur tiré est déjà au club). Chaque tirage choisit d'abord sa FAMILLE selon ces
  // parts, puis sa RARETÉ selon RARITY. Les deux sont affichées avant l'ouverture
  // (§9) : jusqu'ici, la part joueur / compétence n'était écrite nulle part.
  PACK_SLOTS() {
    return [
      { kind: 'player', w: 0.40, label: 'Joueur' },
      { kind: 'skill', w: 0.45, label: 'Compétence' },
      { kind: 'objet', w: 0.15, label: 'Objet' }
    ];
  },

  drawSlot(rnd) {
    const S = this.PACK_SLOTS(), q = (rnd || Math.random)();
    let a = 0; for (const x of S) { a += x.w; if (q <= a) return x.kind; }
    return S[S.length - 1].kind;
  },

  // §9 : la part de chaque famille, en pourcentage, pour l'affichage avant l'ouverture.
  // Lue dans PACK_SLOTS, la table même du tirage : changer une part ici change le
  // tirage ET l'affichage, jamais l'un sans l'autre.
  packFamilies() {
    const S = this.PACK_SLOTS(), t = S.reduce((a, x) => a + x.w, 0) || 1;
    return S.map((x) => ({ kind: x.kind, label: x.label, pct: x.w / t * 100 }));
  },

  // Ce qu'un objet fait, en quelques mots, lu dans ses propres champs : la carte
  // révélée ne peut donc pas promettre autre chose que ce que l'objet applique.
  // Une réunion se range en réserve et agit le jour où on la tient : la carte le dit.
  objetCourt(o) {
    if (!o) return '';
    const p = [];
    if (o.kind === 'meeting') p.push('à tenir');
    if (o.sessions) p.push('+' + o.sessions + ' séance' + (o.sessions > 1 ? 's' : ''));
    const cartes = o.stats || (o.stat ? [o.stat] : []);
    if (cartes.length) p.push('carte' + (cartes.length > 1 ? 's' : '') + ' +2 ' + cartes.join(', '));
    if (o.squadXp) p.push('+' + o.squadXp + ' XP à l’effectif');
    if (o.kind === 'plan') p.push((o.plans || 1) + ' plan' + ((o.plans || 1) > 1 ? 's' : '') + ' tactique' + ((o.plans || 1) > 1 ? 's' : ''));
    if (o.morale) p.push('moral +' + o.morale);
    if (o.coh) p.push('cohésion +' + Math.round(o.coh * 100) + ' %');
    if (o.adv && o.kind !== 'plan') p.push('+' + o.adv + ' d’avantage');
    return p.join(' · ');
  },

  // Un tirage complet : rareté, puis famille (joueur, compétence ou objet) de cette rareté.
  drawLot(rnd, owned) {
    const R = this.RARITY(), r = rnd || Math.random;
    let q = r(), pick = R[0];
    for (let i = 0; i < R.length; i++) { q -= R[i].rate; if (q <= 0) { pick = R[i]; break; } }
    const slot = this.drawSlot(r);
    if (slot === 'skill') {
      const sk = this.rollSkill(pick.id, r);
      return { kind: 'skill', rar: pick.id, skill: sk, name: sk.name, ovr: sk.power, label: pick.label, color: pick.color, shards: pick.shards };
    }
    if (slot === 'objet') {
      // Un objet de la rareté tirée, pris dans les deux tables du matériel (entraînement
      // et entraîneur) : une seule source pour ce qu'un objet fait.
      const tous = this.TRAIN_LOTS().map((x) => Object.assign({ famille: 'entrainement' }, x))
        .concat(this.COACH_ITEMS().map((x) => Object.assign({ famille: 'tactique' }, x)));
      const ici = tous.filter((x) => x.rar === pick.id);
      const liste = ici.length ? ici : tous.filter((x) => x.rar === 'normal');
      const obj = liste[Math.floor(r() * liste.length)];
      const U = this.UPGRADE_CARDS();
      return { kind: 'objet', rar: pick.id, name: obj.label, label: pick.label, color: pick.color, shards: pick.shards,
        objet: Object.assign({}, obj, {
          stat: obj.up ? U[Math.floor(r() * U.length)][0] : null,
          stats: obj.up > 1 ? Array.from({ length: obj.up }, () => U[Math.floor(r() * U.length)][0]) : null
        }) };
    }
    const pool = this.CARD_POOL().filter((c) => c.rar === pick.id);
    const c = pool[Math.floor(r() * pool.length)];
    const dup = owned && owned.has(c.id);
    return dup
      ? { kind: 'shards', rar: pick.id, name: c.name, ovr: c.ovr, label: pick.label, color: pick.color, dup: true, shards: pick.shards, id: c.id, pos: c.pos }
      : { kind: 'player', rar: pick.id, name: c.name, ovr: c.ovr, pos: c.pos, id: c.id, label: pick.label, color: pick.color, shards: pick.shards };
  },

  // L'ouverture complète, côté règles : l'écran ne fait que l'animer.
  openPack(opts) {
    const o = opts || {}, s = this.state, def = this.THE_PACK();
    if (!o.free) { const st2 = this.packState(def); if (!st2.can) return { ok: false, why: st2.why }; }
    const r = o.rnd || Math.random;
    const owned = new Set((s.squad || []).map((p) => p.id).concat(s.collected || []));
    const got = [];
    let shards = 0;
    for (let i = 0; i < def.n; i++) {
      const lot = this.drawLot(r, owned);
      if (lot.kind === 'player') owned.add(lot.id);
      if (lot.kind === 'shards') shards += lot.shards;
      got.push(lot);
    }
    const order = this.RARITY().map((x) => x.id);
    got.sort((a, b) => order.indexOf(b.rar) - order.indexOf(a.rar) || (b.ovr || 0) - (a.ovr || 0));
    return { ok: true, def, got, shards, free: !!o.free };
  },

  // Encaisser le pack : les joueurs entrent dans l'effectif, les compétences dans l'inventaire,
  // les doublons en fragments. §19 : tout est immédiatement disponible partout.
  commitPack(res) {
    if (!res || !res.ok) return { ok: false };
    const s = this.state, def = res.def;
    const squad = s.squad.slice(), inv = (s.skillInv || []).slice(), collected = (s.collected || []).slice();
    let uid = s.nextSkillUid || 1;
    res.got.forEach((g) => {
      if (g.kind === 'player') {
        const p = this.cardToPlayer(g);
        p.name = this.nomUnique(p.name, new Set(squad.map((x) => x.name)));
        squad.push(p); collected.push(g.id);
      }
      else if (g.kind === 'skill') { inv.push(Object.assign({}, g.skill, { uid: uid++, on: null })); }
    });
    const objets = res.got.filter((g) => g.kind === 'objet').map((g) => g.objet);
    const cost = res.free ? 0 : def.cost;
    this.setState({ squad, skillInv: inv, collected, nextSkillUid: uid,
      shards: (s.shards || 0) + res.shards,
      balance: s.balance - cost,
      // ce que le kiosque affiche sous la carte du pack : le dernier tirage, en clair
      lastCardPack: res.got.map((g) => g.name + ' (' + g.label + ')').join(' · '),
      missions: this.bumpMission(s.missions, 'pack', 1),
      freeQueue: res.free ? s.freeQueue.slice(1) : s.freeQueue });
    if (!res.free) this.logMoney(-cost, 'Ouverture ' + def.name);
    // §3 une seule source de vérité : un objet sorti du pack passe par les fonctions
    // qui rangent le matériel, les mêmes pour tout ce qui en donne.
    this.appliquerObjetsEntrainement(objets.filter((o) => o.famille !== 'tactique'));
    this.rangerObjetsCoach(objets.filter((o) => o.famille === 'tactique'));
    this.bumpQuest('pack', 1);
    return { ok: true };
  },

  // Une carte du catalogue devient un vrai joueur de l'effectif (§19).
  cardToPlayer(c) {
    return { id: c.id, name: c.name, pos: c.pos, ovr: c.ovr, rar: c.rar, fresh: true, scouted: true,
      plv: 1, pxp: 0, pot: Math.min(97, c.ovr + 4 + Math.floor(Math.random() * 10)) };
  },

  // La rareté d'un joueur de l'effectif, déduite de sa note quand la carte n'en porte pas.
  rarityFor(p) {
    const R = this.RARITY();
    if (p.rar) { const hit = R.find((x) => x.id === p.rar); if (hit) return hit; }
    for (let i = R.length - 1; i >= 0; i--) if (p.ovr >= R[i].lo) return R[i];
    return R[0];
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
