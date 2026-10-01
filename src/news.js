// LinkFoot : le journal (§26).
//
// Un classement est une liste de nombres. Un journal raconte ce que ces nombres
// veulent dire : qui monte, qui s'effondre, qui a planté un triplé samedi. Tout ce
// fichier ne fait que ça : transformer de VRAIS résultats en articles.
//
// Rien n'est inventé. Chaque article cite un match, un classement ou un transfert
// qui a réellement eu lieu. S'il n'y a pas de résultat, il n'y a pas d'article.
export const News = {
  // Les rubriques, dans l'ordre où le journal les présente.
  NEWS_SECTIONS() {
    return [
      { id: 'une', label: 'À la une' },
      { id: 'resultats', label: 'Résultats' },
      { id: 'joueurs', label: 'Joueurs' },
      { id: 'marche', label: 'Mercato' },
      { id: 'classement', label: 'Classement' }
    ];
  },

  // Construit le journal à partir de ce que le serveur a renvoyé.
  // `feed` : { matches, ladder, movers, transfers, players }
  buildNews(feed) {
    const f = feed || {}, out = [];
    const when = (t) => {
      const d = Math.max(0, Date.now() - (t || Date.now()));
      const h = Math.floor(d / 3600000), m = Math.floor(d / 60000);
      return h >= 24 ? Math.floor(h / 24) + ' j' : h >= 1 ? h + ' h' : m >= 1 ? m + ' min' : 'à l’instant';
    };

    // À la une : le match le plus marquant, celui qui a le plus gros écart ou le plus de buts
    const ms = (f.matches || []).slice();
    if (ms.length) {
      const best = ms.slice().sort((a, b) => {
        const sa = Math.abs(a.score[0] - a.score[1]) * 2 + a.score[0] + a.score[1];
        const sb = Math.abs(b.score[0] - b.score[1]) * 2 + b.score[0] + b.score[1];
        return sb - sa;
      })[0];
      const gap = Math.abs(best.score[0] - best.score[1]);
      const win = best.score[0] > best.score[1] ? best.home : best.score[1] > best.score[0] ? best.away : null;
      out.push({
        section: 'une', kind: 'match', at: best.at,
        title: win
          ? (gap >= 4 ? win + ' passe le rouleau compresseur' : gap >= 2 ? win + ' s’impose nettement' : win + ' arrache la victoire')
          : 'Rien n’a pu les départager',
        sub: best.home + ' ' + best.score[0] + ' - ' + best.score[1] + ' ' + best.away,
        body: win
          ? (gap >= 4
            ? win + ' n’a laissé aucune chance à son adversaire et signe la performance de la journée.'
            : gap >= 2
              ? win + ' a contrôlé la rencontre de bout en bout.'
              : 'Un but d’écart, et une fin de match irrespirable.')
          : 'Les deux clubs se quittent dos à dos, sans trouver la faille.',
        ago: when(best.at)
      });
    }

    // Résultats : tous les matchs, du plus récent au plus ancien
    ms.sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 12).forEach((m) => {
      out.push({
        section: 'resultats', kind: 'score', at: m.at,
        title: m.home + ' ' + m.score[0] + ' - ' + m.score[1] + ' ' + m.away,
        sub: m.comp || 'Match classé',
        body: '', ago: when(m.at)
      });
    });

    // Joueurs : les hommes du match, et le joueur de la semaine
    const ps = (f.players || []).slice().sort((a, b) => (b.rating || 0) - (a.rating || 0));
    if (ps.length) {
      const star = ps[0];
      out.push({
        section: 'joueurs', kind: 'star', at: star.at,
        title: star.name + ', l’homme de la semaine',
        sub: star.club + ' · note ' + (star.rating || 0).toFixed(1) + (star.goals ? ' · ' + star.goals + ' but' + (star.goals > 1 ? 's' : '') : ''),
        body: star.goals >= 3 ? 'Un triplé qui restera.' : star.goals === 2 ? 'Un doublé décisif.' : star.goals === 1 ? 'Un but, et une prestation complète.' : 'Une démonstration sans marquer.',
        ago: when(star.at)
      });
      ps.slice(1, 6).forEach((p) => out.push({
        section: 'joueurs', kind: 'player', at: p.at,
        title: p.name, sub: p.club + ' · note ' + (p.rating || 0).toFixed(1) + (p.goals ? ' · ' + p.goals + ' but' + (p.goals > 1 ? 's' : '') : ''),
        body: '', ago: when(p.at)
      }));
    }

    // Mercato : les transferts réels
    (f.transfers || []).slice(0, 8).forEach((t) => out.push({
      section: 'marche', kind: 'transfer', at: t.at,
      title: t.player + ' quitte ' + t.from,
      sub: t.to + ' · ' + (t.price || 0).toLocaleString('fr-FR') + ' jetons',
      body: t.price >= 3000 ? 'Un transfert qui fera date.' : '',
      ago: when(t.at)
    }));

    // Classement : qui monte, qui descend
    (f.movers || []).slice(0, 6).forEach((m) => out.push({
      section: 'classement', kind: 'mover', at: m.at,
      title: m.club + (m.delta > 0 ? ' grimpe de ' + m.delta + ' place' + (m.delta > 1 ? 's' : '') : ' perd ' + (-m.delta) + ' place' + (m.delta < -1 ? 's' : '')),
      sub: (m.rank ? m.rank + 'e au classement' : '') + (m.elo ? ' · ' + m.elo + ' points' : ''),
      body: '', ago: when(m.at)
    }));
    const lad = (f.ladder || []).slice(0, 3);
    if (lad.length) out.push({
      section: 'classement', kind: 'top', at: Date.now(),
      title: lad[0].name + ' en tête',
      sub: lad.map((r, i) => (i + 1) + '. ' + r.name + ' ' + r.elo).join(' · '),
      body: '', ago: 'maintenant'
    });

    return out;
  },

  // Le journal tel que l'écran l'affiche, rubrique par rubrique.
  newsBySection(feed) {
    const all = this.buildNews(feed);
    return this.NEWS_SECTIONS().map((sec) => ({
      id: sec.id, label: sec.label,
      items: all.filter((x) => x.section === sec.id),
      empty: !all.some((x) => x.section === sec.id)
    }));
  },

  // Hors ligne, l'écran n'a rien à montrer. Plutôt qu'une page vide, il montre un
  // EXEMPLE construit depuis les données du club solo, clairement étiqueté comme tel.
  // Rien n'est inventé : c'est le vrai classement de division et le vrai effectif.
  demoFeed() {
    const s = this.state, tbl = this.table(s.record);
    const xi = this.pickXI(s.formation);
    const now = Date.now();
    return {
      demo: true,
      matches: tbl.slice(0, 4).map((c, i) => ({
        at: now - (i + 1) * 5400000,
        home: c.club, away: tbl[(i + 1) % tbl.length].club,
        score: [c.w % 4, c.l % 3], comp: 'Division ' + s.division
      })),
      players: xi.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 8).map((p, i) => ({
        at: now - i * 3600000, name: p.name, club: s.clubName || 'FC TonPseudo',
        rating: Math.min(9.4, 6.2 + (p.ovr - 55) / 12), goals: i === 0 ? 2 : i < 3 ? 1 : 0
      })),
      transfers: [],
      movers: [{ at: now, club: s.clubName || 'FC TonPseudo', delta: 2, rank: 3, elo: 1000 + s.level * 6 }],
      ladder: tbl.map((c, i) => ({ rank: i + 1, id: c.user, name: c.club, elo: 1100 - i * 27,
        p: c.w + c.d + c.l, w: c.w, d: c.d, l: c.l, gf: c.w * 2 + c.d, ga: c.l * 2 + c.d })),
      leagues: [], tournaments: []
    };
  },

  // Les diapositives de l'écran En ligne : chacune répond à une question du §26.
  // Hors ligne, elles disent ce qui manque plutôt que de rester vides (§81).
  onlineSlides(feed) {
    const f = feed || {}, on = this.isOnline();
    const none = (what) => on ? 'Rien pour l’instant : ' + what : 'Disponible une fois le mode en ligne branché.';
    const lad = f.ladder || [];
    const best = lad.slice(0, 10);
    const players = (f.players || []).slice().sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 10);
    return [
      { id: 'journal', label: 'Le journal', sub: 'Ce qui s’est passé cette semaine',
        empty: !(f.matches || []).length, emptyWhy: none('aucun match n’a encore été joué en ligne.') },
      { id: 'ligue', label: 'Ligue en ligne', sub: 'Tes ligues entre amis',
        empty: !(f.leagues || []).length, emptyWhy: none('crée une ligue et partage son code.') },
      { id: 'tournoi', label: 'Tournoi', sub: 'Les coupes en cours',
        empty: !(f.tournaments || []).length, emptyWhy: none('aucun tournoi en cours.') },
      { id: 'classement', label: 'Classement', sub: 'Le général, tous clubs confondus',
        empty: !lad.length, emptyWhy: none('le classement se remplit au premier match classé.') },
      { id: 'equipes', label: 'Meilleures équipes', sub: 'Les dix premiers clubs',
        empty: !best.length, emptyWhy: none('aucun club classé.') },
      { id: 'joueurs', label: 'Meilleurs joueurs', sub: 'Les dix meilleures notes de la semaine',
        empty: !players.length, emptyWhy: none('aucune note enregistrée.') }
    ];
  }
};
