// LinkFoot : la division du directeur sportif (§2 « compétitions », §22 « je progresse
// dans les divisions »).
//
// Avant, le classement de division était un décor : cinq clubs aux bilans figés
// (3-1-0, 2-1-1…), qui ne jouaient jamais et ne repartaient même pas de zéro à la saison
// suivante. N'importe quel adversaire comptait pour le championnat, et un match amical
// faisait avancer la saison.
//
// La division est maintenant un vrai championnat de six clubs, tenu avec les règles de
// classement communes à tout le jeu (league.js, §3) :
//   - un calendrier toutes rondes de cinq journées : chaque club rencontre chacun des
//     autres une fois, à domicile ou à l'extérieur ;
//   - ton match est joué par le moteur ; les deux autres matchs de la journée sont
//     simulés d'après la note et le style des clubs, avec une graine, donc reproductibles ;
//   - le classement est calculé, jamais écrit ; les deux premiers montent, le dernier
//     descend, et la saison suivante repart d'un nouveau calendrier.
// Seul le match prévu au calendrier compte. Les autres rencontres sont des amicaux.
export const Division = {
  // Les clubs que l'on peut croiser en division. Tous fictifs. `base` est leur note en
  // division 4, celle où démarre un club créé en France : autour de la note d'un effectif
  // de départ (55), pour qu'un nouveau club joue sa division au lieu de la subir.
  // Chaque division plus haute ajoute 4 points, chaque division plus basse en retire 4.
  // L'ancienne échelle (62 à 72 en division 4) avait été réglée sur le club de
  // démonstration : un club neuf perdait tout, 0-5 et 0-8, et restait dernier.
  CLUBS_DIVISION() {
    return [
      { id: 'auteuil', club: 'Auteuil United', base: 57, color: '#2F8FE0', style: 'tiki' },
      { id: 'kop', club: 'Kop Bleu FC', base: 53, color: '#5CC8FF', style: 'contre' },
      { id: 'vieuxport', club: 'Olympique Vieux-Port', base: 58, color: '#6FD0F7', style: 'gegen' },
      { id: 'yoyo', club: 'Sporting Yoyo', base: 54, color: '#F2C66B', style: 'blocbas' },
      { id: 'canal', club: 'Real Canal FC', base: 50, color: '#FF8A65', style: 'direct' },
      { id: 'brindille', club: 'Calcio Brindille', base: 55, color: '#1B3FA0', style: 'catenaccio' },
      { id: 'dynamo', club: 'Dynamo Positif', base: 56, color: '#B98CFF', style: 'posit' },
      { id: 'fleches', club: 'Flèches du Nord', base: 52, color: '#FF4757', style: 'ailes' },
      { id: 'duel', club: 'Duel FC', base: 54, color: '#24B463', style: 'homme' },
      { id: 'phare', club: 'Racing du Phare', base: 51, color: '#E9A93A', style: 'vertical' },
      { id: 'tilleuls', club: 'AS Tilleuls', base: 52, color: '#43E0C2', style: 'blocmed' },
      { id: 'meridien', club: 'Méridien SC', base: 55, color: '#C39BFF', style: 'surcharge' }
    ];
  },

  DIVISION_RULES() { return { clubs: 6, up: 2, down: 1, top: 1, bottom: 5 }; },

  // Les cinq adversaires d'une division et d'une saison : tirés avec une graine, pour
  // que la même saison donne toujours la même division.
  clubsDeDivision(division, saison) {
    const r = this.seedR(division * 1009 + saison * 131 + 7);
    const pool = this.CLUBS_DIVISION().slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    return pool.slice(0, this.DIVISION_RULES().clubs - 1).map((c) => ({
      id: c.id, club: c.club, color: c.color, style: c.style,
      ovr: c.base + (4 - division) * 4 + Math.round((r() - 0.5) * 4)
    }));
  },

  // Une division neuve. `deja` : les résultats déjà joués cette saison par le club, quand
  // une ancienne sauvegarde n'avait pas encore de calendrier (on les rejoue dans l'ordre).
  nouvelleDivision(division, saison, deja) {
    const clubs = this.clubsDeDivision(division, saison);
    const ids = ['moi'].concat(clubs.map((c) => c.id));
    let lg = { saison, division, clubs, days: this.schedule(ids, 1), day: 0,
      rows: ids.map((id) => this.emptyRow(id, id === 'moi' ? 'moi' : clubs.find((c) => c.id === id).club)), results: [] };
    (deja || []).forEach((m) => { lg = this.journeeJouee(lg, m.hs, m.as).league; });
    return lg;
  },

  // La division en cours, telle qu'elle est ou telle qu'elle commence. Ne modifie rien :
  // un écran peut l'appeler à chaque rendu. Une ancienne partie (sans calendrier) reprend
  // ses résultats de la saison, pour que le classement ne reparte pas de zéro en cours de route.
  divisionCourante() {
    const s = this.state, lg = s.league;
    if (lg && lg.division === s.division && lg.day < lg.days.length) return lg;
    const rec = s.record || { w: 0, d: 0, l: 0 }, deja = [];
    if (!lg && (s.seasonP || 0) > 0) {
      for (let i = 0; i < rec.w; i++) deja.push({ hs: 1, as: 0 });
      for (let i = 0; i < rec.d; i++) deja.push({ hs: 1, as: 1 });
      for (let i = 0; i < rec.l; i++) deja.push({ hs: 0, as: 1 });
    }
    return this.nouvelleDivision(s.division, s.saison || 1, deja.slice(0, Math.min(deja.length, s.seasonP || 0, 4)));
  },

  // Le prochain match du club : l'adversaire, la journée, et où il se joue.
  prochainMatch() {
    const lg = this.divisionCourante();
    const m = lg.days[lg.day].find((x) => x.home === 'moi' || x.away === 'moi');
    const c = lg.clubs.find((x) => x.id === (m.home === 'moi' ? m.away : m.home));
    const S = this.styles()[c.style] || {};
    return { day: lg.day + 1, total: lg.days.length, domicile: m.home === 'moi',
      opp: { id: c.id, club: c.club, ovr: c.ovr, style: c.style, color: c.color, styleName: S.name || c.style,
        ligue: true, exterieur: m.home !== 'moi' } };
  },

  // Un adversaire compte pour le championnat seulement s'il est celui du calendrier.
  estAuCalendrier(opp) {
    if (!opp || opp.friendly) return false;
    return this.prochainMatch().opp.club === opp.club;
  },

  // Les autres matchs de la journée. Le moteur joue le tien ; ceux-là sont simulés d'après
  // la note et le style : un match complet du moteur prend dix à trente secondes sur un
  // téléphone, et en jouer deux de plus à chaque journée gèlerait l'application.
  // Buts selon une loi de Poisson ; l'écart de note et le duel de styles déplacent la
  // moyenne, le club qui reçoit a un léger avantage. La pente (0,14 but par point de note)
  // est mesurée sur le moteur : un effectif de départ y marque 3 buts et en encaisse 0,2
  // contre une équipe de 7 points plus faible, 1,7 contre 1 avec 3 points d'écart. Les
  // matchs simulés pèsent donc la note autant que les matchs joués.
  resultatRapide(home, away, graine) {
    const r = this.seedR(graine);
    const m = this.matchup(home.style, away.style);
    const lh = Math.max(0.15, Math.min(4.5, 1.4 + (home.ovr - away.ovr) * 0.14 + m * 0.15 + 0.15));
    const la = Math.max(0.15, Math.min(4.5, 1.2 + (away.ovr - home.ovr) * 0.14 - m * 0.15));
    const poisson = (l) => { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= r(); } while (p > L && k < 12); return k - 1; };
    return { hs: poisson(lh), as: poisson(la) };
  },

  // Une journée jouée : ton résultat (buts du club, buts de l'adversaire), puis les autres
  // matchs simulés. Fonction pure : elle rend la division suivante sans toucher à l'état.
  journeeJouee(lg0, buts, encaisses) {
    const lg = JSON.parse(JSON.stringify(lg0));
    const day = lg.days[lg.day], clubOf = (id) => lg.clubs.find((c) => c.id === id);
    day.forEach((m, i) => {
      let hs, as;
      if (m.home === 'moi') { hs = buts; as = encaisses; }
      else if (m.away === 'moi') { hs = encaisses; as = buts; }
      else ({ hs, as } = this.resultatRapide(clubOf(m.home), clubOf(m.away), lg.saison * 7919 + lg.division * 613 + lg.day * 97 + i * 13 + 1));
      this.applyResult(lg.rows, m.home, m.away, hs, as);
      lg.results.push({ day: lg.day + 1, home: m.home, away: m.away, hs, as });
    });
    lg.day++;
    return { league: lg, over: lg.day >= lg.days.length, table: this.table(lg) };
  },

  // Le classement, dans la forme que les écrans lisaient déjà : un club par ligne, `me`
  // pour le tien. Calculé avec standings(), la même règle que les ligues en ligne.
  table(lg0) {
    const s = this.state, lg = lg0 && lg0.rows ? lg0 : this.divisionCourante();
    const S = this.styles();
    return this.standings(lg.rows).map((r) => {
      const me = r.id === 'moi', c = me ? null : lg.clubs.find((x) => x.id === r.id);
      return { id: r.id, me, club: me ? (s.clubName || 'FC TonPseudo') : c.club,
        user: me ? 'Ton club' : ((S[c.style] || {}).name || c.style) + ' · note ' + c.ovr,
        style: me ? null : c.style, ovr: me ? null : c.ovr,
        w: r.w, d: r.d, l: r.l, p: r.p, pts: r.pts, gf: r.gf, ga: r.ga, gd: r.gd, rank: r.rank };
    });
  },

  // Où en est le club, en une phrase vraie. L'ancienne phrase de l'écran disait « bats-le
  // pour prendre la tête » même quand le club de devant avait déjà été joué, et « une
  // victoire et tu remontes » quand il manquait six points. Celle-ci lit le calendrier
  // et les points qui restent en jeu.
  situationDivision(lg0) {
    const lg = lg0 && lg0.rows ? lg0 : this.divisionCourante(), R = this.DIVISION_RULES();
    const t = this.table(lg), i = t.findIndex((r) => r.me), me = t[i];
    const reste = lg.days.length - lg.day, enJeu = reste * 3;
    const pts = (n) => n + ' pt' + (n > 1 ? 's' : '');
    const rang = (r) => (r.rank === 1 ? '1er' : r.rank + 'e');
    const ecart = (n) => (n ? 'à ' + pts(n) : 'à égalité de points');
    const journee = (id) => {
      for (let d = lg.day; d < lg.days.length; d++) {
        if (lg.days[d].some((m) => (m.home === 'moi' && m.away === id) || (m.away === 'moi' && m.home === id))) return d + 1;
      }
      return 0;
    };
    const fin = ' Il reste ' + reste + ' journée' + (reste > 1 ? 's' : '') + ', ' + enJeu + ' points en jeu.';
    if (!lg.day) return 'Saison ' + lg.saison + ' : ' + lg.days.length + ' journées, chaque club rencontre chacun des autres une fois. Les ' + R.up + ' premiers montent, le dernier descend.';
    if (!reste) return 'Saison terminée : ' + rang(me) + ' sur ' + t.length + '.';
    if (i < R.up) {
      const s = t[R.up];                                    // le premier club hors de la zone de montée
      return 'Tu es ' + rang(me) + ', dans la zone de montée. ' + s.club + ' (' + rang(s) + ') est ' + ecart(me.pts - s.pts) + ' derrière.'
        + (journee(s.id) ? ' Tu le joues à la journée ' + journee(s.id) + '.' : '') + fin;
    }
    const c = t[R.up - 1], manque = c.pts - me.pts;         // le dernier club de la zone de montée
    const dernier = R.down && i >= t.length - R.down;
    if (manque > enJeu) {
      if (dernier) {
        const s = t[t.length - R.down - 1];
        return 'La montée n’est plus possible cette saison. Tu es dernier, et le dernier descend : ' + s.club + ' (' + rang(s) + ') est ' + ecart(s.pts - me.pts) + '.' + fin;
      }
      const d = t[t.length - 1];
      return 'La montée n’est plus possible cette saison (' + pts(manque) + ' à reprendre). Le maintien : ' + d.club + ', dernier, est ' + ecart(me.pts - d.pts) + ' derrière toi.' + fin;
    }
    const duel = journee(c.id) ? ' Tu le joues à la journée ' + journee(c.id) + '.' : ' Tu l’as déjà joué : il faut qu’il perde des points ailleurs.';
    if (dernier) {
      const s = t[t.length - R.down - 1];
      return 'Tu es dernier, et le dernier descend : ' + s.club + ' (' + rang(s) + ') est ' + ecart(s.pts - me.pts) + '. La montée est ' + ecart(manque) + ', ' + c.club + ' (' + rang(c) + ').' + fin;
    }
    return 'La montée est ' + ecart(manque) + ' : ' + c.club + ' (' + rang(c) + ').' + duel + fin;
  },

  // Les résultats d'une journée, avec les noms : pour l'écran et pour le journal.
  resultatsDeJournee(day, lg0) {
    const s = this.state, lg = lg0 || this.divisionCourante();
    const nom = (id) => (id === 'moi' ? (s.clubName || 'FC TonPseudo') : lg.clubs.find((c) => c.id === id).club);
    return lg.results.filter((x) => x.day === day).map((x) => ({ home: nom(x.home), away: nom(x.away), hs: x.hs, as: x.as,
      moi: x.home === 'moi' || x.away === 'moi' }));
  }
};
