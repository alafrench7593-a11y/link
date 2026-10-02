// LinkFoot : les séances et le matériel d'entraînement (§5, §6, §29).
//
// L'entraînement n'est pas illimité. Chaque séance consomme UNE séance en stock.
// On en reçoit deux par jour gratuitement, et le pack unique en donne à sa part
// « Objet ». C'est ce qui fait de l'entraînement une décision : avec trois séances en
// poche, on choisit qui on fait progresser, on ne lance pas tout.
export const TrainPack = {
  // Deux séances offertes par jour, vingt en réserve au maximum : impossible
  // d'empiler trois mois d'entraînement pour tout lancer d'un coup (§29).
  SESSION_RULES() { return { freePerDay: 2, max: 20 }; },

  // Les séances disponibles, en remettant les gratuites du jour si on ne les a pas prises.
  sessions() {
    const s = this.state, R = this.SESSION_RULES();
    const caps = s.caps || {};
    if (caps.day !== this.dayKey()) return Math.min(R.max, (s.sessions || 0) + R.freePerDay);
    return s.sessions || 0;
  },

  // Appelé avant toute séance : remet les gratuites du jour si besoin, puis en retire une.
  takeSession() {
    const s = this.state, R = this.SESSION_RULES(), caps = Object.assign({}, s.caps || {});
    let have = s.sessions || 0;
    if (caps.day !== this.dayKey()) { have = Math.min(R.max, have + R.freePerDay); caps.day = this.dayKey(); }
    if (have <= 0) return false;
    this.setState({ sessions: have - 1, caps });
    return true;
  },

  addSessions(n) {
    const R = this.SESSION_RULES();
    this.setState({ sessions: Math.min(R.max, (this.state.sessions || 0) + Math.max(0, Math.round(n))) });
    return this.state.sessions;
  },

  // L'état de l'entraînement, pour que l'écran dise toujours pourquoi il refuse (§81).
  trainInfo() {
    const n = this.sessions(), R = this.SESSION_RULES();
    const busy = !!(this.state.match && !this.state.match.done);
    return {
      sessions: n, max: R.max, freePerDay: R.freePerDay,
      can: n > 0 && !busy,
      why: busy ? 'Impossible pendant un match'
        : n > 0 ? '' : 'Plus de séance. Tu en reçois ' + R.freePerDay + ' par jour, et le ' + this.THE_PACK().name + ' en donne parfois.',
      line: n + ' séance' + (n > 1 ? 's' : '') + ' en stock · ' + R.freePerDay + ' offertes par jour'
    };
  },

  // Le matériel d'entraînement : un objet par rareté. Il sort du pack unique, à la part
  // « Objet » et à la rareté tirée, donc un Stage Gold est aussi rare qu'un joueur Gold.
  TRAIN_LOTS() {
    return [
      { id: 'seance', rar: 'normal', label: 'Séance d’entraînement', desc: '+1 séance', sessions: 1 },
      { id: 'carte', rar: 'rare', label: 'Carte d’amélioration', desc: '+2 sur une statistique, au joueur de ton choix', up: 1 },
      { id: 'duo', rar: 'epic', label: 'Double séance', desc: '+2 séances', sessions: 2 },
      { id: 'specialise', rar: 'elite', label: 'Séance spécialisée', desc: '+3 séances et une carte d’amélioration', sessions: 3, up: 1 },
      { id: 'stage', rar: 'gold', label: 'Stage de pré-saison', desc: '+60 XP à tout l’effectif', squadXp: 60 },
      { id: 'masterclass', rar: 'legendary', label: 'Masterclass', desc: '+150 XP à tout l’effectif et trois cartes d’amélioration', squadXp: 150, up: 3 }
    ];
  },

  // Les cartes d'amélioration que le pack peut donner : les mêmes que celles déjà
  // utilisables sur la fiche d'un joueur. Rien de nouveau à comprendre.
  UPGRADE_CARDS() {
    return [['VIT', 'Vitesse'], ['ATQ', 'Attaque'], ['TIR', 'Tir'], ['PAS', 'Passe'], ['DRI', 'Dribble'], ['DÉF', 'Défense'], ['PHY', 'Physique']];
  },

  useUpgrade(pid, stat) {
    const s = this.state, key = 'up_' + stat, inv = Object.assign({}, s.inv || {});
    if (!(inv[key] > 0)) return { ok: false, why: 'Aucune carte ' + stat + ' en réserve' };
    const p = s.squad.find((x) => x.id === pid);
    if (!p) return { ok: false, why: 'Joueur introuvable' };
    const st = {}; this.cardStats(p).forEach((q) => { st[q.l] = q.v; });
    if (st[stat] == null) return { ok: false, why: 'Un gardien ne travaille pas cette statistique' };
    if (st[stat] >= 99) return { ok: false, why: stat + ' est déjà au maximum' };
    const h = this.hiddenOf(p);
    if (p.ovr >= h.potReel) return { ok: false, why: p.name + ' a atteint son potentiel' };
    st[stat] = Math.min(99, st[stat] + 2);
    inv[key]--;
    const ovr = Math.min(h.potReel, Math.max(p.ovr, this.ovrOf(p.pos, st)));
    this.buzz([25, 25, 50]);
    this.setState({ inv, squad: s.squad.map((x) => (x.id === pid ? Object.assign({}, x, { st, ovr }) : x)),
      trainLog: p.name + ' +2 ' + stat + (ovr > p.ovr ? ' · note ' + p.ovr + ' → ' + ovr : '') });
    return { ok: true, ovr };
  },

  // §19 : tout ce que le pack donne arrive immédiatement là où ça sert.
  // Ce que des objets d'entraînement donnent au club : séances, cartes d'amélioration,
  // XP de stage. Une seule fonction pour tout ce qui en donne (§3).
  appliquerObjetsEntrainement(lots) {
    if (!lots || !lots.length) return { sessions: 0, xp: 0, cards: [] };
    const s = this.state, R = this.SESSION_RULES(), inv = Object.assign({}, s.inv || {});
    let add = 0, xp = 0;
    const cards = [];
    lots.forEach((g) => {
      add += g.sessions || 0;
      xp += g.squadXp || 0;
      (g.stats || (g.stat ? [g.stat] : [])).forEach((k) => { inv['up_' + k] = (inv['up_' + k] || 0) + 1; cards.push(k); });
    });
    this.setState({ inv, sessions: Math.min(R.max, (s.sessions || 0) + add) });
    // un stage profite à tout l'effectif : c'est ce qui rend les lots rares désirables
    if (xp) this.state.squad.forEach((p) => this.grantPlayerXp(p.id, xp, 'stage'));
    return { sessions: add, xp, cards };
  },

  // §19 : l'écran d'entraînement ne propose que ce que le directeur sportif peut
  // réellement faire AUJOURD'HUI, avec ce qu'il a en réserve. Chaque ligne dit ce
  // qu'elle consomme et, si elle refuse, ce qui manque (§81).
  trainingOptions() {
    const ti = this.trainInfo(), inv = this.state.inv || {};
    const base = this.TRAININGS().map((t) => ({
      id: t.id, label: t.label, desc: t.desc, cost: '1 séance', kind: 'squad',
      can: ti.can, why: ti.can ? '' : ti.why
    }));
    // les cartes d'amélioration ouvrent des séances ciblées : on ne les propose
    // que si on en possède, et on dit sur quelle statistique elles portent
    const cards = this.UPGRADE_CARDS()
      .map(([k, label]) => ({ k, label, n: inv['up_' + k] || 0 }))
      .filter((x) => x.n > 0)
      .map((x) => ({
        id: 'up_' + x.k, label: 'Séance ciblée ' + x.label.toLowerCase(), kind: 'card', stat: x.k, n: x.n,
        desc: '+2 ' + x.k + ' sur le joueur de ton choix, sans consommer de séance',
        cost: x.n + ' carte' + (x.n > 1 ? 's' : ''), can: true, why: ''
      }));
    return base.concat(cards);
  }
};
