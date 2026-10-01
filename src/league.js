// LinkFoot : classements et calendriers (§72, §75).
// Pure logique, aucune dépendance : le même code sert pour une division solo,
// une ligue entre amis ou un classement national.

export const POINTS = { win: 3, draw: 1, loss: 0 };

// Une ligne de classement vierge.
export function emptyRow(id, name) {
  return { id, name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
}

// Applique un résultat aux deux lignes concernées. Les lignes sont créées si besoin.
export function applyResult(rows, homeId, awayId, hs, as) {
  const get = (id) => {
    let r = rows.find((x) => x.id === id);
    if (!r) { r = emptyRow(id, String(id)); rows.push(r); }
    return r;
  };
  const H = get(homeId), A = get(awayId);
  H.p++; A.p++; H.gf += hs; H.ga += as; A.gf += as; A.ga += hs;
  if (hs > as) { H.w++; A.l++; H.pts += POINTS.win; A.pts += POINTS.loss; }
  else if (hs < as) { A.w++; H.l++; A.pts += POINTS.win; H.pts += POINTS.loss; }
  else { H.d++; A.d++; H.pts += POINTS.draw; A.pts += POINTS.draw; }
  return rows;
}

// Tri officiel : points, puis différence de buts, puis buts marqués, puis victoires, puis nom.
export function standings(rows) {
  return rows.slice()
    .map((r) => Object.assign({}, r, { gd: r.gf - r.ga }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.w - a.w || String(a.name).localeCompare(String(b.name)))
    .map((r, i) => Object.assign(r, { rank: i + 1 }));
}

// Calendrier toutes rondes (méthode du cercle). `rounds` = 1 pour aller simple, 2 pour aller-retour.
export function schedule(teamIds, rounds) {
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
}

// Promotion et relégation d'une division (§72).
export function movements(table, opts) {
  const o = opts || {};
  const up = o.up != null ? o.up : 2, down = o.down != null ? o.down : 1;
  return {
    promoted: table.slice(0, up).map((r) => r.id),
    relegated: down ? table.slice(table.length - down).map((r) => r.id) : []
  };
}
