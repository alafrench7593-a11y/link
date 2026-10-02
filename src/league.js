// LinkFoot : classements et calendriers (§72, §75).
// Le même code sert pour la division solo du directeur sportif, une ligue entre amis,
// un tournoi ou un classement national : il n'existe qu'un seul système de classement
// dans tout le jeu (§3).
//
// Les règles sont écrites comme des MÉTHODES d'un objet, LeagueRules, pour deux raisons :
//   - Club les reçoit (Object.assign), et la division solo s'en sert par this.standings ;
//   - tools/sync-canvas.mjs les recopie dans l'écran Mon Club, qui ne peut rien importer.
// Aucune n'utilise `this`, et aucune n'appelle une autre : les exports nommés plus bas
// restent donc de simples fonctions, pour le serveur et les tournois.

export const POINTS = { win: 3, draw: 1, loss: 0 };

export const LeagueRules = {
  // Une ligne de classement vierge.
  emptyRow(id, name) {
    return { id, name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  },

  // Applique un résultat aux deux lignes concernées. Les lignes sont créées si besoin.
  // Victoire 3 points, nul 1, défaite 0 : les mêmes valeurs que POINTS.
  applyResult(rows, homeId, awayId, hs, as) {
    const get = (id) => {
      let r = rows.find((x) => x.id === id);
      if (!r) { r = { id, name: String(id), p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; rows.push(r); }
      return r;
    };
    const H = get(homeId), A = get(awayId);
    H.p++; A.p++; H.gf += hs; H.ga += as; A.gf += as; A.ga += hs;
    if (hs > as) { H.w++; A.l++; H.pts += 3; }
    else if (hs < as) { A.w++; H.l++; A.pts += 3; }
    else { H.d++; A.d++; H.pts += 1; A.pts += 1; }
    return rows;
  },

  // Tri officiel : points, puis différence de buts, puis buts marqués, puis victoires, puis nom.
  standings(rows) {
    return rows.slice()
      .map((r) => Object.assign({}, r, { gd: r.gf - r.ga }))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.w - a.w || String(a.name).localeCompare(String(b.name)))
      .map((r, i) => Object.assign(r, { rank: i + 1 }));
  },

  // Calendrier toutes rondes (méthode du cercle). `rounds` = 1 pour aller simple, 2 pour aller-retour.
  schedule(teamIds, rounds) {
    const t = teamIds.slice();
    if (t.length % 2) t.push(null);                 // exempt
    const n = t.length, half = n / 2, out = [];
    let arr = t.slice();
    for (let r = 0; r < (n - 1) * (rounds || 1); r++) {
      const day = [];
      for (let i = 0; i < half; i++) {
        const a = arr[i], b = arr[n - 1 - i];
        if (a == null || b == null) continue;
        day.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
      }
      out.push(day);
      arr = [arr[0]].concat([arr[n - 1]], arr.slice(1, n - 1));   // rotation
    }
    return out;
  },

  // Promotion et relégation d'une division (§72).
  movements(table, opts) {
    const o = opts || {};
    const up = o.up != null ? o.up : 2, down = o.down != null ? o.down : 1;
    return {
      promoted: table.slice(0, up).map((r) => r.id),
      relegated: down ? table.slice(table.length - down).map((r) => r.id) : []
    };
  }
};

export const emptyRow = LeagueRules.emptyRow;
export const applyResult = LeagueRules.applyResult;
export const standings = LeagueRules.standings;
export const schedule = LeagueRules.schedule;
export const movements = LeagueRules.movements;
