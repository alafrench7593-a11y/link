// LinkFoot : le pack unique et le matériel de l'entraîneur (§8, §9, §24).
//
// §8 UN SEUL PACK. Le LinkFoot Pack est le seul pack du jeu : un seul bouton,
// « OUVRIR LE PACK », et chaque tirage peut donner un joueur, une compétence, un objet
// (séance, carte d'amélioration, causerie, plan tactique) ou des fragments quand le
// joueur tiré est déjà au club. Avant l'ouverture, il affiche les deux tables qui
// décident du tirage : la part de chaque famille et le taux de chaque rareté (§9).
//
// Il y a eu jusqu'à quatre packs (plus un Pack Compétence, un Pack Entraînement et un
// Pack Entraîneur). Ils ont été retirés : le §8 n'en veut qu'un, et deux d'entre eux
// vendaient des objets Gold à 1,8 % et 2,6 % par lot, au-dessus du « 1 % ou moins »
// du §12. Tout ce qu'ils donnaient sort du pack unique, à la rareté commune.
export const Packs = {
  // L'écran Packs, dans le canvas comme dans l'app, lit cette forme : le pack, son
  // prix, ses deux tables de probabilités et ce qu'il a donné la dernière fois. Les
  // probabilités sont demandées à leurs propres fonctions, jamais recopiées (§29).
  KIOSQUE() {
    return [
      { key: 'linkfoot', def: this.THE_PACK(), family: 'Pack unique', principal: true,
        question: 'Joueur, compétence ou objet : un seul pack pour tout',
        odds: () => this.packOdds(this.THE_PACK()), kind: 'rarete',
        familles: () => this.packFamilies(),
        state: () => this.packState(this.THE_PACK()),
        useView: 'squad', useLabel: 'Joueurs dans l’effectif, compétences en réserve, objets à l’entraînement',
        last: 'lastCardPack' }
    ];
  },

  // La liste prête à afficher. Aucune fonction d'interface là-dedans : l'écran y branche
  // son bouton lui-même, parce que l'ouverture du pack a son animation.
  kiosque() {
    const s = this.state;
    return this.KIOSQUE().map((e) => {
      const st = e.state(), d = e.def;
      return {
        key: e.key, name: d.name, family: e.family, question: e.question,
        principal: !!e.principal,
        n: d.n, cost: d.cost, color: d.color, content: d.content,
        desc: d.n + ' tirages · ' + d.content,
        can: !!st.can, why: st.why || '', locked: !st.can,
        useView: e.useView, useLabel: e.useLabel,
        got: s[e.last] || '',
        kind: e.kind, odds: e.odds(),
        familles: e.familles ? e.familles() : null
      };
    });
  },

  // Le pack unique, tel que les écrans l'affichent.
  packPrincipal() { return this.kiosque()[0]; },

  // ---------- le matériel de l'entraîneur (§24) ----------
  // Il sort du pack unique, à la part « Objet » et à la rareté tirée. Chaque objet a
  // un effet réel, lu au moment où on s'en sert (§13).
  // Le matériel tactique. Chaque objet a un effet réel, lu au moment du match (§14, §81).
  COACH_ITEMS() {
    return [
      { id: 'causerie', rar: 'normal', label: 'Causerie d’avant-match', kind: 'meeting',
        desc: 'Moral +8 pour tout l’effectif, une fois', morale: 8 },
      { id: 'video', rar: 'rare', label: 'Séance vidéo', kind: 'meeting',
        desc: 'Révèle le style de l’adversaire et donne +1 d’avantage tactique au prochain match', adv: 1 },
      { id: 'atelier', rar: 'epic', label: 'Atelier tactique', kind: 'meeting',
        desc: 'Cohésion +4 %, durable', coh: 0.04 },
      { id: 'plan', rar: 'elite', label: 'Plan tactique', kind: 'plan',
        desc: 'Un style de jeu préparé : +2 d’avantage tactique quand tu l’utilises contre le bon adversaire', adv: 2 },
      { id: 'reunion', rar: 'gold', label: 'Réunion de groupe', kind: 'meeting',
        desc: 'Moral +15, cohésion +6 % et +40 XP à tout l’effectif', morale: 15, coh: 0.06, squadXp: 40 },
      { id: 'masterplan', rar: 'legendary', label: 'Plan de campagne', kind: 'plan',
        desc: 'Trois plans tactiques, moral +20 et cohésion +8 %', plans: 3, morale: 20, coh: 0.08 }
    ];
  },

  // Ranger le matériel de l'entraîneur sorti du pack. Une seule fonction pour tout
  // ce qui en donne (§3) : un objet fait la même chose d'où qu'il vienne.
  //
  // Un plan (simple ou de campagne) va dans la réserve de plans, la seule que lit
  // usePlan. Le plan de campagne promettait « trois plans tactiques, moral +20 et
  // cohésion +8 % » : il en donnait deux, rangés sous une clé que rien ne lisait, et
  // ni moral ni cohésion. Ce n'est pas une réunion qu'on tient plus tard : son moral
  // et sa cohésion s'appliquent à réception, ses trois plans vont en réserve.
  rangerObjetsCoach(lots) {
    if (!lots || !lots.length) return { plans: 0, morale: 0, coh: 0 };
    const s = this.state, coach = Object.assign({}, s.coachInv || {});
    let plans = 0, morale = 0, coh = 0;
    lots.forEach((g) => {
      if (g.kind === 'plan') {
        plans += g.plans || 1;
        morale += g.morale || 0;
        coh += g.coh || 0;
      } else coach[g.id] = (coach[g.id] || 0) + 1;
    });
    if (plans) coach.plan = (coach.plan || 0) + plans;
    const patch = { coachInv: coach };
    if (morale) patch.squad = s.squad.map((p) => Object.assign({}, p, { morale: Math.min(99, this.profile(p).morale + morale) }));
    if (coh) patch.cohBonus = Math.min(0.16, (s.cohBonus || 0) + coh);
    this.setState(patch);
    return { plans, morale, coh };
  },

  // ---------- la réunion d'équipe (§24) ----------
  // Ce que le directeur sportif peut faire avec son matériel, et ce qu'il lui manque.
  meetings() {
    const s = this.state, inv = s.coachInv || {};
    return this.COACH_ITEMS().filter((x) => x.kind === 'meeting').map((x) => {
      const n = inv[x.id] || 0;
      return Object.assign({}, x, {
        n, can: n > 0,
        why: n > 0 ? '' : 'Aucun(e) ' + x.label.toLowerCase() + ' en réserve : ça sort du ' + this.THE_PACK().name + ', à la part Objet.'
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
    if (!(inv.plan > 0)) return { ok: false, why: 'Aucun plan tactique en réserve : ça sort du ' + this.THE_PACK().name + ', à la part Objet.' };
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
