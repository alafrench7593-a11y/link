// Ce que le moteur LinkFoot a joué : le document « linkfoot-match » (docs/passerelle-ue5.md), lu
// pour le rendu. Les images sont à 10 par seconde ; entre deux, la position suit une courbe de
// Catmull-Rom (elle passe par chaque image du moteur), l'orientation le plus court chemin.
// Repère de la scène : X = x − 34, Z = y − 52,5 (mètres), Y vers le haut ; un joueur dont l'angle
// moteur est a regarde (cos a, sin a) dans le plan (X, Z), soit un lacet ψ = atan2(cos a, sin a).

export class Match {
  constructor(doc) {
    this.doc = doc;
    const ch = doc.images.champs;
    this.col = Object.fromEntries(ch.map((c, i) => [c, i]));
    this.lignes = doc.images.donnees;
    this.n = this.lignes.length;
    this.t0 = this.lignes[0][this.col.t] / 10;
    this.t1 = this.lignes[this.n - 1][this.col.t] / 10;
    this.joueurs = new Map(doc.joueurs.filter((j) => j.code != null && j.code >= 0).map((j) => [j.code, j]));
    this.actions = (doc.actions || []).slice().sort((a, b) => a.t - b.t);
  }

  index(t) {
    const f = (t - this.t0) * 10;
    const i = Math.max(0, Math.min(this.n - 2, Math.floor(f)));
    return [i, Math.max(0, Math.min(1, f - i))];
  }

  brut(i, code, champ) {
    i = Math.max(0, Math.min(this.n - 1, i));
    return this.lignes[i][this.col[champ + code]];
  }

  present(code, t) {
    const [i] = this.index(t);
    return this.brut(i, code, 'x') > -800 && this.brut(i + 1, code, 'x') > -800;
  }

  // position (m, repère de la scène) au temps t
  position(code, t) {
    const [i, u] = this.index(t);
    const p = (k) => [this.brut(k, code, 'x') / 100 - 34, this.brut(k, code, 'y') / 100 - 52.5];
    const a = p(i - 1), b = p(i), c = p(i + 1), d = p(i + 2);
    const cr = (k) => {
      const p0 = a[k], p1 = b[k], p2 = c[k], p3 = d[k];
      return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
    };
    return [cr(0), cr(1)];
  }

  vitesse(code, t) {
    const e = 0.05, a = this.position(code, t - e), b = this.position(code, t + e);
    return [(b[0] - a[0]) / (2 * e), (b[1] - a[1]) / (2 * e)];
  }

  // lacet (radians) : le corps regarde (sin ψ, cos ψ) dans le plan (X, Z)
  lacet(code, t) {
    const [i, u] = this.index(t);
    const a = this.brut(i, code, 'angle') / 1000, b = this.brut(i + 1, code, 'angle') / 1000;
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const ang = a + d * u;
    return Math.atan2(Math.cos(ang), Math.sin(ang));
  }

  energie(code, t) { const [i] = this.index(t); return this.brut(i, code, 'energie'); }
  etats(code, t) { const [i] = this.index(t); return this.brut(i, code, 'etats'); }

  porteur(t) { const [i] = this.index(t); return this.lignes[i][this.col.porteur]; }

  // ---- le ballon ----
  // Trois régimes, ceux du moteur (src/engine.js, ballStep et flightStep) :
  // - en vol (passe, tir, dégagement) : la formule du moteur, u = (t − t0) / durée ; les images à
  //   10 par seconde la suivent à 2 cm près, la formule donne les instants entre deux images ;
  // - porté : devant le porteur, à 0,5 m + 0,07 m par m/s (au plus 1 m), plus l'oscillation du
  //   dribble ; calculé depuis la position rendue du porteur, il reste collé à ses pieds ;
  // - libre : les images du moteur, en courbe de Catmull-Rom.
  // Le moteur pose le ballon d'un coup chez le nouveau porteur (une réception, un tacle) : le rendu
  // fait ce transfert en 0,35 s, depuis le régime d'avant (le vol qui arrive, l'ancien porteur).
  preparerBallon() {
    if (this.vols) return;
    const col = this.col, L = this.lignes, tImg = (k) => L[k][col.t] / 10;
    this.vols = [];
    for (const a of this.actions) {
      if (a.x1 == null || !(a.dur > 0)) continue;
      const v = { t0: a.t0 != null ? a.t0 : a.t, dur: a.dur, x0: a.x0, y0: a.y0, z0: a.z0 || 0, x1: a.x1, y1: a.y1, apex: a.apex || 0, lineaire: !!a.aerien || a.a === 'tir', c: a.c, action: a };
      // une touche part des mains du lanceur, au-dessus de sa tête (le moteur la fait partir du sol) :
      // le rendu ajoute cette hauteur au départ, éteinte avant l'arrivée (le ballon arrive où le moteur le dit)
      if (a.a === 'touche' && a.cpa === 'throw') v.levee = 2.1;
      // la formule vaut tant que les images du moteur la suivent (une interception la coupe)
      v.fin = v.t0;
      for (let k = 0; k < this.n; k++) {
        const tk = tImg(k);
        if (tk <= v.t0 + 1e-6) continue;
        if (tk > v.t0 + v.dur + 1e-6) break;
        const p = this.volEn(v, tk, false), r = L[k];
        if (Math.hypot(p[0] - r[col.bx] / 100, p[1] - r[col.by] / 100, p[2] - r[col.bz] / 100) > 0.25) break;
        v.fin = tk;
      }
      this.vols.push(v);
    }
    // les possessions : suites d'images au même porteur
    this.possessions = [];
    for (let k = 0; k < this.n; k++) {
      const c = L[k][col.porteur];
      if (c < 0) continue;
      const der = this.possessions[this.possessions.length - 1];
      if (der && der.c === c && der.ke === k - 1) { der.ke = k; continue; }
      this.possessions.push({ c, ks: k, ke: k });
    }
    for (const p of this.possessions) {
      p.tb = tImg(Math.max(0, p.ks - 1));
      p.te = tImg(p.ke);
      // ce qui précède : un vol qui arrive, un autre porteur, ou le ballon libre
      const avant = p.ks > 0 ? L[p.ks - 1][col.porteur] : -1;
      const vol = this.vols.find((v) => v.t0 < p.tb + 0.11 && v.fin >= p.tb - 1e-6);
      p.avant = vol ? { vol } : avant >= 0 ? { c: avant } : { image: Math.max(0, p.ks - 1) };
      if (vol) {
        // le vol va jusqu'au bout quand le ballon arrive là où la formule le mène (une réception, un
        // arrêt), sinon jusqu'à la dernière image qui la suit (une déviation)
        const r = L[p.ks], fin = this.volEn(vol, vol.t0 + vol.dur);
        p.avant.tFin = Math.hypot(fin[0] - r[col.bx] / 100, fin[1] - r[col.by] / 100) < 0.3 ? vol.t0 + vol.dur : vol.fin;
      }
      // le transfert commence quand le ballon arrive (ou dès l'image d'avant)
      p.tTransfert = vol ? Math.max(p.tb, p.avant.tFin) : p.tb;
      // un gardien qui capte garde le ballon dans les mains
      const gb = this.joueurs.get(p.c);
      p.mains = !!(gb && gb.poste === 'GB' && this.actions.some((a) => a.c === p.c && (a.a === 'arret' || a.a === 'prise_aerienne') && Math.abs(a.t - tImg(p.ks)) < 0.25));
      // le lanceur d'une touche tient le ballon dans ses mains jusqu'au lancer
      if (this.actions.some((a) => a.c === p.c && a.a === 'touche' && a.cpa === 'throw' && Math.abs((a.t0 != null ? a.t0 : a.t) - p.te) < 0.3)) p.mains = true;
    }
    // Le contrôle d'un ballon haut (le moteur l'écrit quand personne ne dispute un ballon long,
    // ballon à la hauteur z de l'action) : le ballon descend jusqu'à cette hauteur, le joueur
    // l'amortit, puis il tombe à ses pieds pendant le transfert. L'instant du contact (tHaut) est
    // celui où la descente du vol passe à cette hauteur ; le geste s'y ancre (mouvement.js).
    for (const a of this.actions) {
      if (a.a !== 'controle' || !a.haut) continue;
      const p = this.possessions.find((q) => q.c === a.c && Math.abs(tImg(q.ks) - a.t) < 0.25);
      if (!p) continue;
      // la descente passe à la hauteur du contrôle entre deux images d'avant la réception
      const h = a.z || 1.15, z = (k) => L[k][col.bz] / 100;
      for (let k = p.ks - 1; k > Math.max(0, p.ks - 15); k--) {
        if (!(z(k - 1) >= h && z(k) < h)) continue;
        const u = (z(k - 1) - h) / (z(k - 1) - z(k)), tc = tImg(k - 1) + u * (tImg(k) - tImg(k - 1));
        const x = (L[k - 1][col.bx] + u * (L[k][col.bx] - L[k - 1][col.bx])) / 100, y = (L[k - 1][col.by] + u * (L[k][col.by] - L[k - 1][col.by])) / 100;
        a.tHaut = tc; p.tb = Math.min(p.tb, tc); p.tTransfert = tc; p.avant = { point: [x, y, h] };
        break;
      }
    }
  }

  volEn(v, t, visuel = true) {
    const u = Math.max(0, Math.min(1, (t - v.t0) / v.dur));
    const e = v.lineaire ? u : 1 - Math.pow(1 - u, 1.35);
    const levee = visuel && v.levee ? v.levee * (1 - u) * (1 - u) : 0;
    return [v.x0 + (v.x1 - v.x0) * e, v.y0 + (v.y1 - v.y0) * e, v.z0 * (1 - u) + (v.apex ? 4 * v.apex * u * (1 - u) : 0) + levee];
  }

  // le ballon porté par c au temps t (mètres, repère du moteur), selon la règle du moteur
  ballonPorte(c, t) {
    const p = this.position(c, t), v = this.vitesse(c, t), sp = Math.hypot(v[0], v[1]);
    let fx, fy;
    if (sp > 0.4) { fx = v[0] / sp; fy = v[1] / sp; }
    else { const [i] = this.index(t), a = this.brut(i, c, 'angle') / 1000; fx = Math.cos(a); fy = Math.sin(a); }
    const [i] = this.index(t);
    const drible = (this.brut(i, c, 'etats') & 128) ? Math.abs(Math.sin(t * 9)) * 0.35 : 0;
    const off = 0.5 + Math.min(0.5, sp * 0.07) + drible;
    return [p[0] + 34 + fx * off, p[1] + 52.5 + fy * off, 0];
  }

  ballonImages(t) {
    const [i, u] = this.index(t);
    const g = (k, c) => this.lignes[Math.max(0, Math.min(this.n - 1, k))][this.col[c]] / 100;
    const cr = (c) => {
      const p0 = g(i - 1, c), p1 = g(i, c), p2 = g(i + 1, c), p3 = g(i + 2, c);
      return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
    };
    return [cr('bx'), cr('by'), Math.max(0, g(i, 'bz') * (1 - u) + g(i + 1, 'bz') * u)];
  }

  // { p: [X, Y, Z] (centre du ballon posé au sol à Y = 0, repère de la scène), porteur, regime, mains }
  ballon(t) {
    this.preparerBallon();
    const scene = (q) => [q[0] - 34, q[2], q[1] - 52.5];
    // avant une touche, le lanceur a le ballon dans les mains (1,2 s), quel que soit le régime du moteur
    const lancer = this.vols.find((v) => v.levee && t >= v.t0 - 1.2 && t < v.t0);
    if (lancer) {
      const p = this.position(lancer.c, t);
      return { p: [p[0], 2.1, p[1]], porteur: lancer.c, regime: 'porte', mains: true, te: lancer.t0 };
    }
    const pos = this.possessions.find((p) => t >= p.tb - 1e-9 && t <= p.te + 1e-9);
    if (pos) {
      let q = this.ballonPorte(pos.c, t);
      const k = (t - pos.tTransfert) / 0.35;
      if (k < 1) {
        const a = pos.avant;
        const avant = a.point ? a.point : a.vol ? this.volEn(a.vol, Math.min(t, a.tFin)) : a.c != null ? this.ballonPorte(a.c, t) : this.ballonImages(pos.tb);
        const s = k <= 0 ? 0 : k * k * (3 - 2 * k);
        q = [avant[0] + (q[0] - avant[0]) * s, avant[1] + (q[1] - avant[1]) * s, avant[2] * (1 - s)];
      }
      return { p: scene(q), porteur: pos.c, regime: 'porte', mains: pos.mains && k >= 1, te: pos.te, pos };
    }
    const vol = this.vols.find((v) => t >= v.t0 - 1e-9 && t <= v.fin + 1e-9);
    if (vol) return { p: scene(this.volEn(vol, t)), porteur: -1, regime: 'vol', vol };
    return { p: scene(this.ballonImages(t)), porteur: -1, regime: 'libre' };
  }

  // ---- la conduite de balle (rendu seulement) ----
  // Le moteur garde le ballon à une distance fixe devant le porteur. Un joueur qui court balle au
  // pied la pousse et la rattrape : le rendu ajoute cette respiration autour de la position du
  // moteur (au plus 0,35 m le long de la course), avec une touche du pied au début de chaque
  // cycle ; elle s'éteint avant une frappe, pour que le ballon parte d'où le moteur le fait partir.
  preparerConduite() {
    if (this.conduitePrete) return;
    this.preparerBallon();
    for (const p of this.possessions) {
      p.touches = [];
      if (p.mains) continue;
      p.debutConduite = p.tTransfert + 0.35;
      p.finConduite = p.te - 0.15;
      const der = p.te - 0.45;
      for (let t = p.debutConduite; t < der; ) {
        p.touches.push(t);
        const v = this.vitesse(p.c, t);
        t += Math.max(0.45, Math.min(1.0, 0.35 + 0.1 * Math.hypot(v[0], v[1])));
      }
      if (p.touches.length) {
        const tn = p.touches[p.touches.length - 1], v = this.vitesse(p.c, tn);
        p.touches.push(tn + Math.max(0.45, Math.min(1.0, 0.35 + 0.1 * Math.hypot(v[0], v[1]))));
      }
    }
    this.conduitePrete = true;
  }

  // l'écart (m) le long de la course, au temps t, pour la possession p
  ecartConduite(p, t) {
    const T = p.touches;
    if (!T || T.length < 2 || t <= T[0] || t >= p.finConduite) return 0;
    let k = 0;
    while (k < T.length - 2 && t >= T[k + 1]) k++;
    const tau = Math.max(0, Math.min(1, (t - T[k]) / (T[k + 1] - T[k])));
    const v = this.vitesse(p.c, t), sp = Math.hypot(v[0], v[1]);
    const lisse = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    const A = Math.max(0.1, Math.min(0.35, 0.05 * sp)) * lisse((t - p.debutConduite) / 0.3) * lisse((p.finConduite - t) / 0.3);
    return A * (-1 + 4 * tau * (1 - tau));
  }

  // le ballon tel qu'on le voit : celui du moteur, plus la conduite
  ballonVisuel(t) {
    const b = this.ballon(t);
    if (b.regime !== 'porte' || b.mains) return b;
    this.preparerConduite();
    const d = this.ecartConduite(b.pos, t);
    if (d === 0) return b;
    const v = this.vitesse(b.porteur, t), sp = Math.hypot(v[0], v[1]);
    let fx, fz;
    if (sp > 0.4) { fx = v[0] / sp; fz = v[1] / sp; } else { const a = this.lacet(b.porteur, t); fx = Math.sin(a); fz = Math.cos(a); }
    return Object.assign({}, b, { p: [b.p[0] + fx * d, b.p[1], b.p[2] + fz * d], conduite: d });
  }
}
