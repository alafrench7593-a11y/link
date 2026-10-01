// LinkFoot : le registre des packs (§10, §11, §28).
//
// LA RÈGLE QUI LES REND LISIBLES : un pack ne donne qu'UNE SEULE famille de choses.
// S'il en donnait deux, personne ne saurait lequel ouvrir, et c'est exactement ce que
// le §10 voulait éviter. Il y a donc quatre packs, et chacun répond à une question
// précise que le directeur sportif se pose.
//
//   LinkFoot Pack     j'ai besoin de joueurs          cartes du catalogue
//   Pack Compétence   j'ai besoin de compétences     compétences seules, aucun joueur
//   Pack Entraînement j'ai besoin de temps           séances et cartes d'amélioration
//   Pack Entraîneur   j'ai besoin d'idées            plans tactiques, causeries, vidéo
//
// Les taux de chacun sont affichés avant l'ouverture et calculés côté système (§11, §29).
export const Packs = {
  PACK_REGISTRY() {
    return [
      Object.assign({}, this.THE_PACK(), { family: 'cartes', question: 'Il me faut des joueurs', view: 'packs' }),
      Object.assign({}, this.SKILL_PACK(), { family: 'compétences', question: 'Il me faut des compétences', view: 'skills' }),
      Object.assign({}, this.TRAIN_PACK(), { family: 'entraînement', question: 'Il me faut du temps d’entraînement', view: 'train' }),
      Object.assign({}, this.COACH_PACK(), { family: 'tactique', question: 'Il me faut des idées de jeu', view: 'train' })
    ];
  },

  // ---------- LE KIOSQUE ----------
  // Les quatre packs au même endroit, décrits de la même façon. Avant, chacun vivait
  // dans l'écran où on utilise son contenu : il fallait ouvrir trois écrans pour voir
  // trois prix. Maintenant on achète ici et on utilise là-bas, et chaque pack dit où
  // son contenu finit (`useView`, `useLabel`).
  //
  // La méthode ne décide RIEN : elle lit les quatre définitions existantes, demande
  // leurs probabilités et leur état à leurs propres fonctions, et les met dans la même
  // forme. Un pack ajouté ailleurs apparaît ici sans toucher à l'interface.
  KIOSQUE() {
    return [
      { key: 'linkfoot', def: this.THE_PACK(), family: 'Joueurs',
        question: 'Il me faut des joueurs',
        odds: () => this.packOdds(this.THE_PACK()), kind: 'rarete',
        state: () => this.packState(this.THE_PACK()),
        useView: 'squad', useLabel: 'Les cartes arrivent dans l’effectif',
        last: 'lastCardPack' },
      { key: 'skill', def: this.SKILL_PACK(), family: 'Compétences',
        question: 'Il me faut des compétences',
        odds: () => this.skillPackOdds(), kind: 'rarete',
        state: () => this.skillPackState(),
        useView: 'skills', useLabel: 'Les compétences vont en réserve, à équiper dans Compétences',
        last: 'lastSkillPack' },
      { key: 'train', def: this.TRAIN_PACK(), family: 'Entraînement',
        question: 'Il me faut du temps d’entraînement',
        odds: () => this.trainPackOdds(), kind: 'lots',
        state: () => this.trainPackState(),
        useView: 'train', useLabel: 'Séances et cartes utilisables dans Entraînement',
        last: 'lastTrainPack' },
      { key: 'coach', def: this.COACH_PACK(), family: 'Tactique',
        question: 'Il me faut des idées de jeu',
        odds: () => this.coachPackOdds(), kind: 'lots',
        state: () => this.coachPackState(),
        useView: 'train', useLabel: 'Causeries et plans utilisables dans Entraînement',
        last: 'lastCoachPack' }
    ];
  },

  // La liste prête à afficher. Aucune fonction d'interface là-dedans : l'écran y branche
  // son bouton lui-même, parce que l'ouverture du pack de cartes a une animation et que
  // les trois autres n'en ont pas.
  kiosque() {
    const s = this.state;
    return this.KIOSQUE().map((e) => {
      const st = e.state(), d = e.def;
      return {
        key: e.key, name: d.name, family: e.family, question: e.question,
        n: d.n, cost: d.cost, color: d.color, content: d.content,
        desc: d.n + ' tirages · ' + d.content,
        can: !!st.can, why: st.why || '', locked: !st.can,
        useView: e.useView, useLabel: e.useLabel,
        got: s[e.last] || '',
        kind: e.kind, odds: e.odds()
      };
    });
  },

  // Combien coûte le kiosque entier, et ce que le solde permet d'ouvrir maintenant.
  kiosqueSummary() {
    const k = this.kiosque();
    return { n: k.length, open: k.filter((x) => x.can).length,
      cheapest: k.reduce((a, x) => (a == null || x.cost < a ? x.cost : a), null) };
  },

  // ---------- Pack Compétence ----------
  // Il ne contient QUE des compétences, aux taux du §11. C'est le pack qu'on ouvre
  // quand l'effectif est là mais que personne ne sort du lot.
  SKILL_PACK() {
    return {
      key: 'skill', name: 'Pack Compétence', n: 2, cost: 320,
      content: 'compétences uniquement, aucun joueur',
      color: 'linear-gradient(135deg, #C39BFF, #7B4FD8)', fx: 'silver'
    };
  },

  skillPackOdds() {
    return this.RARITY().map((r) => ({ id: r.id, label: r.label, color: r.tint, pct: r.rate * 100 }));
  },

  skillPackState() {
    const def = this.SKILL_PACK(), s = this.state, poor = s.balance < def.cost;
    return { can: !poor, why: poor ? 'Il te manque ' + (def.cost - s.balance) + ' jetons' : '', cost: def.cost };
  },

  openSkillPack(opts) {
    const o = opts || {}, s = this.state, def = this.SKILL_PACK();
    if (!o.free && s.balance < def.cost) return { ok: false, why: 'Il te manque ' + (def.cost - s.balance) + ' jetons' };
    const r = o.rnd || Math.random, R = this.RARITY(), got = [];
    for (let i = 0; i < def.n; i++) {
      let q = r(), pick = R[0];
      for (let k = 0; k < R.length; k++) { q -= R[k].rate; if (q <= 0) { pick = R[k]; break; } }
      const sk = this.rollSkill(pick.id, r);
      got.push({ kind: 'skill', rar: pick.id, label: pick.label, color: pick.tint, skill: sk, name: sk.name, power: sk.power });
    }
    const order = R.map((x) => x.id);
    got.sort((a, b) => order.indexOf(b.rar) - order.indexOf(a.rar) || b.power - a.power);
    return { ok: true, def, got, free: !!o.free };
  },

  commitSkillPack(res) {
    if (!res || !res.ok) return { ok: false };
    const s = this.state, def = res.def;
    const inv = (s.skillInv || []).slice();
    let uid = s.nextSkillUid || 1;
    res.got.forEach((g) => inv.push(Object.assign({}, g.skill, { uid: uid++, on: null })));
    const cost = res.free ? 0 : def.cost;
    this.setState({ skillInv: inv, nextSkillUid: uid, balance: s.balance - cost,
      lastSkillPack: res.got.map((g) => g.name + ' (' + g.label + ')').join(' · '),
      missions: this.bumpMission(s.missions, 'pack', 1) });
    if (!res.free) this.logMoney(-cost, 'Ouverture ' + def.name);
    this.bumpQuest('pack', 1);
    return { ok: true, added: res.got.length };
  },

  // ---------- Pack Entraîneur ----------
  // Il ne donne ni joueur ni compétence : il donne des IDÉES, c'est-à-dire du matériel
  // que le directeur sportif utilise avant un match ou à l'entraînement (§24).
  COACH_PACK() {
    return {
      key: 'coach', name: 'Pack Entraîneur', n: 2, cost: 260,
      content: 'plans tactiques, causeries, séances vidéo',
      color: 'linear-gradient(135deg, #F2C66B, #E9A93A)', fx: 'silver'
    };
  },

  // Le matériel tactique. Chaque objet a un effet réel, lu au moment du match (§14, §81).
  COACH_ITEMS() {
    return [
      { id: 'causerie', rar: 'normal', rate: 0.44, label: 'Causerie d’avant-match', kind: 'meeting',
        desc: 'Moral +8 pour tout l’effectif, une fois', morale: 8 },
      { id: 'video', rar: 'rare', rate: 0.28, label: 'Séance vidéo', kind: 'meeting',
        desc: 'Révèle le style de l’adversaire et donne +1 d’avantage tactique au prochain match', adv: 1 },
      { id: 'atelier', rar: 'epic', rate: 0.17, label: 'Atelier tactique', kind: 'meeting',
        desc: 'Cohésion +4 %, durable', coh: 0.04 },
      { id: 'plan', rar: 'elite', rate: 0.08, label: 'Plan tactique', kind: 'plan',
        desc: 'Un style de jeu préparé : +2 d’avantage tactique quand tu l’utilises contre le bon adversaire', adv: 2 },
      { id: 'reunion', rar: 'gold', rate: 0.026, label: 'Réunion de groupe', kind: 'meeting',
        desc: 'Moral +15, cohésion +6 % et +40 XP à tout l’effectif', morale: 15, coh: 0.06, squadXp: 40 },
      { id: 'masterplan', rar: 'legendary', rate: 0.004, label: 'Plan de campagne', kind: 'plan',
        desc: 'Trois plans tactiques, moral +20 et cohésion +8 %', plans: 3, morale: 20, coh: 0.08 }
    ];
  },

  coachPackOdds() {
    const L = this.COACH_ITEMS(), R = this.RARITY();
    const t = L.reduce((a, x) => a + x.rate, 0) || 1;
    return L.map((x) => {
      const r = R.find((y) => y.id === x.rar) || R[0];
      return { id: x.id, label: x.label, rarLabel: r.label, color: r.tint, pct: x.rate / t * 100, desc: x.desc };
    });
  },

  coachPackState() {
    const def = this.COACH_PACK(), s = this.state, poor = s.balance < def.cost;
    return { can: !poor, why: poor ? 'Il te manque ' + (def.cost - s.balance) + ' jetons' : '', cost: def.cost };
  },

  openCoachPack(opts) {
    const o = opts || {}, s = this.state, def = this.COACH_PACK();
    if (!o.free && s.balance < def.cost) return { ok: false, why: 'Il te manque ' + (def.cost - s.balance) + ' jetons' };
    const r = o.rnd || Math.random, L = this.COACH_ITEMS(), tot = L.reduce((a, x) => a + x.rate, 0), got = [];
    for (let i = 0; i < def.n; i++) {
      let q = r() * tot, pick = L[0];
      for (const x of L) { q -= x.rate; if (q <= 0) { pick = x; break; } }
      got.push(pick);
    }
    const order = this.RARITY().map((x) => x.id);
    got.sort((a, b) => order.indexOf(b.rar) - order.indexOf(a.rar));
    return { ok: true, def, got, free: !!o.free };
  },

  commitCoachPack(res) {
    if (!res || !res.ok) return { ok: false };
    const s = this.state, def = res.def;
    const coach = Object.assign({}, s.coachInv || {});
    res.got.forEach((g) => {
      coach[g.id] = (coach[g.id] || 0) + 1;
      if (g.plans) coach.plan = (coach.plan || 0) + g.plans - 1;   // le plan de campagne contient trois plans
    });
    const cost = res.free ? 0 : def.cost;
    this.setState({ coachInv: coach, balance: s.balance - cost,
      lastCoachPack: res.got.map((g) => g.label).join(' · ') });
    if (!res.free) this.logMoney(-cost, 'Ouverture ' + def.name);
    this.bumpQuest('pack', 1);
    return { ok: true, added: res.got.map((g) => g.label) };
  },

  // ---------- la réunion d'équipe (§24) ----------
  // Ce que le directeur sportif peut faire avec son matériel, et ce qu'il lui manque.
  meetings() {
    const s = this.state, inv = s.coachInv || {};
    return this.COACH_ITEMS().filter((x) => x.kind === 'meeting').map((x) => {
      const n = inv[x.id] || 0;
      return Object.assign({}, x, {
        n, can: n > 0,
        why: n > 0 ? '' : 'Aucun(e) ' + x.label.toLowerCase() + ' en réserve. Ouvre un ' + this.COACH_PACK().name + '.'
      });
    });
  },

  // Tenir une réunion : l'effet est immédiat et visible dans l'effectif (§19).
  holdMeeting(id) {
    const s = this.state, item = this.COACH_ITEMS().find((x) => x.id === id);
    if (!item || item.kind !== 'meeting') return { ok: false, why: 'Réunion inconnue' };
    const inv = Object.assign({}, s.coachInv || {});
    if (!(inv[id] > 0)) return { ok: false, why: 'Aucun(e) ' + item.label.toLowerCase() + ' en réserve' };
    inv[id]--;
    const patch = { coachInv: inv };
    let txt = item.label;
    if (item.morale) {
      patch.squad = s.squad.map((p) => {
        const pr = this.profile(p);
        return Object.assign({}, p, { morale: Math.min(99, pr.morale + item.morale) });
      });
      txt += ' · moral +' + item.morale;
    }
    if (item.coh) { patch.cohBonus = Math.min(0.16, (s.cohBonus || 0) + item.coh); txt += ' · cohésion +' + Math.round(item.coh * 100) + ' %'; }
    if (item.adv) { patch.nextAdv = (s.nextAdv || 0) + item.adv; txt += ' · +' + item.adv + ' d’avantage au prochain match'; }
    patch.trainLog = txt;
    this.buzz([25, 25, 50]);
    this.setState(patch);
    if (item.squadXp) this.state.squad.forEach((p) => this.grantPlayerXp(p.id, item.squadXp, item.label));
    return { ok: true, text: txt };
  },

  // Les plans tactiques préparés : un plan consommé donne un vrai avantage dans le match
  // qui suit, et seulement celui-là.
  plansLeft() { return (this.state.coachInv || {}).plan || 0; },

  usePlan(styleKey) {
    const s = this.state, inv = Object.assign({}, s.coachInv || {});
    if (!(inv.plan > 0)) return { ok: false, why: 'Aucun plan tactique en réserve. Ouvre un ' + this.COACH_PACK().name + '.' };
    const S = this.styles();
    if (!S[styleKey]) return { ok: false, why: 'Style inconnu' };
    inv.plan--;
    this.setState({ coachInv: inv, preset: styleKey, tac: Object.assign({}, S[styleKey].tac), mentality: S[styleKey].m,
      nextAdv: (s.nextAdv || 0) + 2,
      trainLog: 'Plan tactique préparé : ' + S[styleKey].name + ' · +2 d’avantage au prochain match' });
    this.buzz([25, 25, 60]);
    return { ok: true, style: S[styleKey].name };
  }
};
