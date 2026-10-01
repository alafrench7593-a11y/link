// LinkFoot : ce que l'écran affiche du multijoueur (§26).
//
// Ce module ne parle à personne. Il met en forme l'état en ligne pour l'interface,
// et surtout il répond proprement quand aucun serveur n'est branché : l'écran dit
// alors ce qu'il faut faire pour y remédier, au lieu d'afficher des boutons morts (§81).
export const OnlineUI = {
  isOnline() { return !!(this.online && this.onlineState && !this.onlineState.offline); },

  onlineSummary() {
    const s = this.state, st = this.onlineState || {};
    const on = this.isOnline();
    return {
      connected: on,
      state: on ? 'En ligne' : this.online ? 'Serveur injoignable' : 'Hors ligne',
      // Le message s'adresse au joueur, pas au développeur : il dit ce qui se passe
      // et ce qu'il peut faire, pas comment le code est branché.
      why: on ? 'Ton équipe est publiée : les autres clubs peuvent te défier.' : this.online
        ? 'Le serveur ne répond pas. Tout le reste du jeu continue de fonctionner.'
        : 'Les matchs classés, les ligues entre amis et le classement arrivent bientôt. Le reste du jeu fonctionne sans eux.',
      error: s.onlineError || null,
      elo: s.elo || null,
      ladder: (st.ladder || []).slice(0, 20),
      leagues: st.leagues || [],
      challenges: st.challenges || [],
      feed: st.feed || null,
      market: st.market || null,
      last: s.lastVersus || null,
      lastLine: s.lastVersus
        ? 'Dernier match classé : ' + s.lastVersus.score.join(' - ') + ' contre ' + s.lastVersus.opponent
          + ' · Elo ' + (s.lastVersus.delta >= 0 ? '+' : '') + s.lastVersus.delta
        : 'Aucun match classé joué.'
    };
  },

  // Les actions proposées par l'écran. Chacune refuse avec sa raison si le serveur
  // n'est pas là : aucune ne fait semblant de marcher.
  onlineActions() {
    const can = this.isOnline();
    const refuse = () => Promise.resolve({ ok: false, why: this.onlineSummary().why });
    return {
      can,
      publish: () => (can ? this.goOnline() : refuse()),
      // §81 : si l'action n'est pas disponible, le bouton le dit au lieu de ne rien faire.
      ranked: (id) => (can ? this.playRanked(id) : refuse()),
      createLeague: (name) => (can ? this.online.createLeague(name, 2) : refuse()),
      joinLeague: (code) => (can ? this.online.joinLeague(code) : refuse()),
      refresh: () => (can ? Promise.all([this.refreshLadder(), this.refreshLeagues(), this.refreshChallenges(), this.refreshFeed(), this.refreshMarket()]) : refuse()),
      sell: (id, price) => (can ? this.sellOnline(id, price) : refuse()),
      buy: (listingId) => (can ? this.buyOnline(listingId) : refuse())
    };
  }
};
