// LinkFoot : les décisions pendant le match (§2 « remplacements, décisions pendant le
// match »), écrites une seule fois pour tous les écrans.
//
// Le match reste 100 % automatique (§14) : le directeur sportif ne touche jamais un
// joueur. Il décide depuis le banc, comme un entraîneur : il remplace, il donne une
// consigne de la voix, il joue une carte de match. L'écran Mon Club le faisait déjà,
// avec des règles écrites dans l'écran ; l'app téléphone, elle, ne pouvait que regarder
// la minute défiler. Les règles sont ici, et les deux écrans les appliquent.
//
// Trois défauts de l'écran Mon Club ont disparu au passage :
//   - un remplaçant entrait sans ses compétences, sa forme ni son moral (joueurMoteur) ;
//   - on pouvait remplacer un joueur expulsé, et l'équipe repassait à onze ;
//   - un joueur remplacé ne gagnait ni XP ni fatigue, et son but, s'il avait marqué
//     avant de sortir, n'était crédité à personne.
export const Direct = {
  REGLES_DIRECT() { return { remplacements: 5 }; },

  // Les consignes de la voix, et ce qu'elles changent vraiment dans le moteur (setTP,
  // décisions, fautes). L'effet affiché est celui du code, pas une promesse.
  CRIS() {
    return [
      { id: 'encourager', label: 'Encourager', effet: 'Bonus collectif +1,5 : de meilleures décisions partout sur le terrain' },
      { id: 'exiger', label: 'Exiger plus', effet: 'Pressing plus large, engagement plus haut, jeu plus rapide, tirs plus tentés ; fatigue +8 %' },
      { id: 'resserrer', label: 'Resserrer le bloc', effet: 'Ligne plus basse, bloc plus court, engagement en retrait' },
      { id: 'calme', label: 'Garder la tête froide', effet: 'Moins de fautes et de cartons, passes plus sûres sous la pression' }
    ];
  },

  // ---------- §6 du cahier du match : le coaching tactique en direct ----------
  // Ce que le manager change depuis le banc, avec le vocabulaire d'avant le match. Chaque
  // réglage est lu par le moteur (setTP) ; la formation fait changer les joueurs de place.
  TACTIQUE_DIRECT() {
    return [
      { k: 'formation', label: 'Formation', options: this.FORMATIONS() },
      { k: 'mentalite', label: 'Mentalité', options: this.MENTALITES() },
      { k: 'pressing', label: 'Pressing', options: ['Faible', 'Moyen', 'Intense', 'Très intense'] },
      { k: 'bloc', label: 'Bloc', options: ['Bas', 'Moyen', 'Haut'] },
      { k: 'rythme', label: 'Rythme', options: ['Lent', 'Normal', 'Rapide'] },
      { k: 'largeur', label: 'Largeur', options: ['Étroite', 'Normale', 'Large'] }
    ];
  },

  // La valeur en cours d'un réglage, dans l'état tactique du match { formation, tac, ment }.
  valeurTactique(t, k) {
    if (k === 'formation') return this.FORMATIONS().indexOf(t.formation);
    if (k === 'mentalite') return t.ment;
    const tac = t.tac || {};
    return k === 'pressing' ? tac.press : k === 'bloc' ? tac.line : k === 'rythme' ? tac.tempo : k === 'largeur' ? tac.width : null;
  },

  // Ce qu'un réglage change dans les consignes lues par le moteur. Le bloc, c'est la
  // hauteur de la ligne ET celle où l'on commence à presser.
  patchTactique(k, v) {
    return k === 'pressing' ? { press: v } : k === 'bloc' ? { line: v, engage: v } : k === 'rythme' ? { tempo: v } : k === 'largeur' ? { width: v } : {};
  },

  // Changer de formation pendant le match : qui va où. Les plus défensifs remplissent la
  // défense, les plus offensifs l'attaque (la ligne occupée d'abord, puis le poste de la
  // carte, puis la hauteur sur le terrain) ; dans chaque ligne, chacun garde son côté.
  // Un expulsé passe en dernier : sa place reste vide, devant.
  placementFormation(xi, ancienne, nouvelle) {
    const C = this.formCoords(nouvelle), A = this.formCoords(ancienne) || C;
    if (!C) return null;
    const rang = { GB: 0, DEF: 1, MIL: 2, ATT: 3 };
    const ici = xi.map((p, i) => {
      const n = Number(String(p.slot || '').replace(/\D/g, '')) || 0, c = (A[p.line] || [])[n] || [50, 50];
      return { i, p, fx: c[0], score: (p.red ? 1000 : 0) + rang[p.line] * 10 + (rang[p.pos] != null ? rang[p.pos] : rang[p.line]) * 2 + (100 - c[1]) / 50 };
    });
    const coords = new Array(xi.length), slots = new Array(xi.length);
    ici.filter((q) => q.p.line === 'GB').forEach((q) => { coords[q.i] = { line: 'GB', fx: C.GB[0][0], fy: C.GB[0][1] }; slots[q.i] = 'GB0'; });
    const champ = ici.filter((q) => q.p.line !== 'GB').sort((a, b) => a.score - b.score);
    let k = 0;
    ['DEF', 'MIL', 'ATT'].forEach((l) => {
      const places = (C[l] || []).map((c, n) => ({ c, n })).sort((a, b) => a.c[0] - b.c[0]);
      champ.slice(k, k + places.length).sort((a, b) => a.fx - b.fx).forEach((q, j) => {
        const pl = places[j]; coords[q.i] = { line: l, fx: pl.c[0], fy: pl.c[1] }; slots[q.i] = l + pl.n;
      });
      k += places.length;
    });
    return { coords, slots };
  },

  // §7 L'AUTO COACH : ce que ferait un entraîneur à cette minute, et pourquoi. Une seule
  // liste de règles pour l'app et pour l'écran Mon Club ; en mode Assisté, la première est
  // proposée ; en mode Auto, elle est appliquée. Rien n'est tiré au hasard : la même
  // situation donne la même décision. `e` : l'état du direct (minute, score, onze avec
  // l'énergie et les cartons, banc, changements faits, consigne, cartes, tactique).
  conseilsCoach(e) {
    const out = [], min = e.minute || 0, diff = e.score[0] - e.score[1], v = (e.tactique && e.tactique.valeurs) || {};
    const xi = (e.xi || []).filter((p) => !p.red), champ = xi.filter((p) => p.line !== 'GB');
    const nom = (p) => p.name.split(' ').slice(1).join(' ') || p.name;
    const moy = champ.length ? champ.reduce((a, p) => a + p.energy, 0) / champ.length : 100;
    const cartes = {}; (e.cartes || []).forEach((c) => { cartes[c.id] = c.n; });
    // 1. les remplacements : le plus fatigué, ou un averti qu'un second jaune exclurait
    // jamais un gardien dans le champ ni un joueur de champ dans les buts, et pas un
    // remplaçant tellement plus faible que le changement ferait plus de mal que de bien
    const meilleur = (sortant) => (e.banc || []).filter((b) => !b.inj && (b.pos === 'GB') === (sortant.line === 'GB'))
      .map((b) => { const pen = this.penalty(b.pos, sortant.line); return { b, pen, eff: b.ovr - pen - (pen ? 4 : 0) + ((b.energy != null ? b.energy : 100) - 100) / 10 }; })
      .filter((x) => x.b.ovr - x.pen >= sortant.ovr - 14)
      .sort((a, c) => c.eff - a.eff)[0];
    if ((e.faits || 0) < (e.max || 5) && (e.banc || []).length && min >= 55) {
      const fatigue = champ.filter((p) => p.energy < 52).sort((a, c) => a.energy - c.energy)[0];
      const averti = min >= 60 && diff >= 0 ? champ.filter((p) => p.yc >= 1 && p.line !== 'ATT')[0] : null;
      const out1 = fatigue || averti;
      const r = out1 ? meilleur(out1) : null;
      if (r) out.push({ k: 'sub', slot: out1.slot, id: r.b.id, texte: r.b.name + ' remplace ' + out1.name,
        pourquoi: out1 === fatigue ? nom(out1) + ' est à ' + Math.round(out1.energy) + ' % d’énergie' : nom(out1) + ' est averti, un second jaune laisserait l’équipe à dix' });
      // mené dans le dernier quart d'heure : un attaquant frais à la place d'un attaquant qui
      // n'a pas marqué (le remplaçant prend la place de celui qui sort : un attaquant mis en
      // défense jouerait hors poste, d'où la formation à 4-2-4 plus bas pour ajouter du monde devant)
      if (diff < 0 && min >= 72) {
        const att = champ.filter((p) => p.line === 'ATT' && !p.buts).sort((a, c) => a.energy - c.energy)[0];
        const r2 = att ? meilleur(att) : null;
        if (att && r2 && r2.b.pos === 'ATT' && r2.b.ovr >= att.ovr - 4 && att.energy < 80) out.push({ k: 'sub', slot: att.slot, id: r2.b.id, texte: r2.b.name + ' remplace ' + att.name,
          pourquoi: 'mené à la ' + min + 'e : des jambes fraîches devant' });
      }
    }
    // 2. la tactique selon le score et la minute (le moteur lit chaque réglage)
    if (diff < 0 && min >= 70 && v.mentalite < 5) out.push({ k: 'tac', champ: 'mentalite', v: 5, texte: 'Mentalité : Offensive', pourquoi: 'mené à la ' + min + 'e' });
    if (diff < 0 && min >= 75 && v.pressing < 2 && moy >= 50) out.push({ k: 'tac', champ: 'pressing', v: 2, texte: 'Pressing : Intense', pourquoi: 'récupérer le ballon plus haut' });
    if (diff < 0 && min >= 82) {
      const f = e.tactique && e.tactique.formation, l = f ? this.lignesFormation(f) : null;
      if (l && l[3] < 4 && this.FORMATIONS().indexOf('4-2-4') >= 0) out.push({ k: 'form', formation: '4-2-4', texte: 'Formation : 4-2-4', pourquoi: 'tout pour revenir au score' });
    }
    if (diff > 0 && min >= 80 && v.mentalite > 2) out.push({ k: 'tac', champ: 'mentalite', v: 2, texte: 'Mentalité : Prudente', pourquoi: 'on mène : conserver' });
    if (diff > 0 && min >= 83 && v.bloc > 0) out.push({ k: 'tac', champ: 'bloc', v: 0, texte: 'Bloc : Bas', pourquoi: 'fermer les espaces dans le dos' });
    if (moy < 55 && v.pressing >= 2 && diff >= 0) out.push({ k: 'tac', champ: 'pressing', v: 1, texte: 'Pressing : Moyen', pourquoi: 'l’équipe est à ' + Math.round(moy) + ' % d’énergie' });
    // 3. la voix
    if (diff < 0 && min >= 70 && e.cri !== 'exiger') out.push({ k: 'cri', id: 'exiger', texte: 'Consigne : Exiger plus', pourquoi: 'mené en fin de match' });
    if (diff > 0 && min >= 78 && e.cri !== 'resserrer') out.push({ k: 'cri', id: 'resserrer', texte: 'Consigne : Resserrer le bloc', pourquoi: 'protéger l’avance' });
    // 4. les cartes de match (elles se gagnent : le coach ne les joue qu'au bon moment)
    if (diff === 0 && min >= 80 && cartes.finition > 0) out.push({ k: 'carte', id: 'finition', texte: 'Carte : Boost finition', pourquoi: 'match nul en fin de partie' });
    if (diff < 0 && min >= 60 && cartes.pressing > 0) out.push({ k: 'carte', id: 'pressing', texte: 'Carte : Pressing', pourquoi: 'mené : récupérer haut' });
    return out;
  },

  // Le joueur qui entre, au poste de celui qui sort. Hors de son poste, il perd des
  // points, comme au coup d'envoi. Il entre avec l'énergie qu'il a (sa forme physique),
  // pas avec 100 % d'office : un remplaçant fatigué reste fatigué.
  entrant(sortant, p) {
    const pen = this.penalty(p.pos, sortant.line);
    return Object.assign({}, p, { line: sortant.line, slot: sortant.slot, base: p.ovr, pen, ovr: Math.max(30, p.ovr - pen),
      energy: p.fit != null ? p.fit : 100, yc: 0, red: false });
  },

  // Un remplacement est-il possible ? `m` : { xi, banc, faits, done }, le onze tel qu'il
  // est sur le terrain (énergie, cartons, expulsions lus dans le moteur).
  remplacementInfo(m, slot, id) {
    const R = this.REGLES_DIRECT();
    if (!m || m.done) return { can: false, why: 'Aucun match en cours' };
    if ((m.faits || 0) >= R.remplacements) return { can: false, why: 'Les ' + R.remplacements + ' changements sont faits' };
    const out = (m.xi || []).find((p) => p.slot === slot);
    if (!out) return { can: false, why: 'Poste introuvable' };
    if (out.red) return { can: false, why: out.name + ' est expulsé : un joueur exclu ne se remplace pas' };
    if (!(m.banc || []).some((p) => p.id === id)) return { can: false, why: 'Ce joueur n’est pas sur le banc' };
    return { can: true, why: '' };
  },

  // Comment un match se termine, pour tous les écrans. Un amical nul se départage aux
  // tirs au but (§51) : l'écran Mon Club le faisait, l'app téléphone non, et le même
  // nul rapportait 25 jetons d'un côté, 60 ou 10 de l'autre.
  issueDuMatch(E, amical) {
    const f = E.state(), hs = f.score.H, as = f.score.A;
    let res = hs > as ? 'w' : hs === as ? 'd' : 'l', pso = null;
    if (amical && res === 'd') { pso = E.shootout(); res = pso.win === 'H' ? 'w' : 'l'; }
    const reward = (res === 'w' ? 120 : res === 'd' ? 50 : 20) * (amical ? 0.5 : 1);
    return { f: pso ? E.state() : f, hs, as, res, pso, reward };
  },

  // Qui a joué, et combien de temps : le onze final (énergie et cartons lus dans le
  // moteur, minutes pour ceux qui sont entrés), puis les remplacés, avec leur minute de
  // sortie et leur note à ce moment-là. Les notes suivent le même ordre que les joueurs.
  joueursDuMatch(xi, f, sortis, entres) {
    const fin = xi.map((p, i) => Object.assign({}, p,
      f && f.en ? { energy: f.en[i], yc: f.cards[i][0], red: f.cards[i][1] } : {},
      entres && entres[p.id] != null ? { min: Math.max(1, 90 - entres[p.id]) } : {}));
    const out = (sortis || []).map((p) => Object.assign({}, p, { sorti: true }));
    return { xi: fin.concat(out),
      rat: f && f.rat ? { H: f.rat.H.concat(out.map((p) => (p.note != null ? p.note : 6))), A: f.rat.A } : null };
  },

  // Une décision appliquée au match, en direct comme quand un match interrompu se rejoue.
  // `d` porte tout ce qu'il faut, l'entrant et son descripteur moteur compris : l'effectif
  // a pu changer depuis. Le remplacé est lu dans le moteur à cet instant (énergie, note).
  appliquerDecision(ctx, d) {
    let texte = '';
    if (d.k === 'sub') {
      const f = ctx.E.state(), i = ctx.xi.findIndex((p) => p.slot === d.slot);
      const sortant = Object.assign({}, ctx.xi[i], f.en ? { energy: f.en[i], yc: f.cards[i][0], red: f.cards[i][1], note: f.rat.H[i] } : {});
      ctx.sortis.push(Object.assign(sortant, { min: Math.max(1, d.minute) }));
      ctx.E.sub('H', i, d.desc);
      ctx.xi[i] = d.entrant; ctx.entres[d.entrant.id] = d.minute;
      ctx.banc = ctx.banc.filter((p) => p.id !== d.entrant.id); ctx.faits++;
      texte = d.entrant.name + ' remplace ' + sortant.name + (d.entrant.pen ? ' (hors poste, −' + d.entrant.pen + ')' : '');
    } else if (d.k === 'cri') {
      ctx.E.shout(d.id); ctx.cri = d.id;
      texte = 'Consigne : ' + ((this.CRIS().find((c) => c.id === d.id) || {}).label || d.id);
    } else if (d.k === 'carte') {
      ctx.E.card(d.id);
      texte = 'Carte jouée : ' + ((this.MATCH_CARDS().find((c) => c.id === d.id) || {}).label || d.id);
    } else if (d.k === 'tac') {
      // §6 un réglage changé depuis le banc : le moteur l'applique aux onze joueurs
      const t = ctx.tactique, patch = this.patchTactique(d.champ, d.v);
      t.tac = Object.assign({}, t.tac, patch);
      if (d.champ === 'mentalite') t.ment = d.v;
      ctx.E.reglage('H', patch, d.champ === 'mentalite' ? d.v : null);
      const def = this.TACTIQUE_DIRECT().find((x) => x.k === d.champ);
      texte = (def ? def.label : d.champ) + ' : ' + (def ? def.options[d.v] : d.v);
    } else if (d.k === 'form') {
      // §6 une autre formation : chacun prend sa nouvelle place, le moteur la joue
      ctx.E.formation('H', d.coords);
      ctx.xi = ctx.xi.map((p, i) => Object.assign({}, p, { line: d.coords[i].line, slot: d.slots[i] }));
      ctx.tactique.formation = d.formation;
      texte = 'Formation : ' + d.formation;
    }
    // §7 une décision de l'AUTO COACH dit qu'elle vient de lui, et pourquoi
    ctx.decisions.push({ minute: d.minute, texte: (d.auto ? 'Auto coach : ' : '') + texte + (d.pourquoi ? ' (' + d.pourquoi + ')' : ''), auto: !!d.auto });
  },

  // Un match qu'on suit et sur lequel on décide. Le moteur avance par tranches ; entre
  // deux tranches, l'écran peut remplacer, crier une consigne ou jouer une carte.
  //   avancer(ms)        une tranche de calcul (le match est le même qu'en un bloc
  //                      tant qu'aucune décision n'est prise)
  //   lancer()           le match se déroule seul, au rythme choisi, jusqu'au bout
  //   vitesse(v)         minutes de match par seconde ; Infinity pour le résultat direct
  //   pause(oui)         le temps s'arrête, les décisions restent possibles
  //   ecouter(fn)        fn(état) à chaque minute, à chaque décision, et à la fin
  //   terminer()         joue ce qui reste d'un coup et clôt le match
  // Il n'y a qu'un match en direct à la fois : il est rangé dans this.enDirect, pour
  // qu'un écran qui revient le retrouve au lieu d'en lancer un second.
  //
  // Et il est ENGAGÉ dès le coup d'envoi : la sauvegarde garde de quoi le rejouer
  // (state.matchEngage), avec chaque décision datée en pas de moteur. Fermer l'app pendant
  // le direct ne l'efface donc plus : au retour, reprendreMatch le rejoue à l'identique
  // jusqu'au bout. Sinon, un joueur mené pouvait fuir une défaite en fermant l'app.
  matchEnDirect(opp, opts) {
    const self = this, R = this.REGLES_DIRECT();
    // pont : le moteur enregistre aussi ce que lit le rendu réel de la vue 3D (orientation, états,
    // actions : passerelle.js), sans rien changer au match
    const ctx = this.ouvrirMatch(opp, Object.assign({}, opts, { depart: true, pont: true }));   // ouvrirMatch refuse un second match
    ctx.banc = this.benchOf(ctx.xi).map((p) => Object.assign({}, p, { energy: p.fit != null ? p.fit : 100, yc: 0, red: false }));
    Object.assign(ctx, { faits: 0, cri: null, decisions: [], sortis: [], entres: {}, ticks: 0 });
    this.setState({ matchEngage: { opp: ctx.opp, amical: ctx.amical, plan: ctx.plan, xi: ctx.xi, oxi: ctx.oxi, banc: ctx.banc,
      depart: ctx.depart, formation: ctx.tactique.formation, decisions: [] } });
    let dernier = { done: false, minute: 0, clock: "1'" }, rythme = 3, enPause = false, resultat = null, promesse = null;
    const ecouteurs = [];
    const vivant = (f) => ctx.xi.map((p, i) => Object.assign({}, p, f.en ? { energy: f.en[i], yc: f.cards[i][0], red: f.cards[i][1], note: f.rat.H[i] } : {}));
    const diffuser = () => { const e = api.etat(); ecouteurs.slice().forEach((fn) => fn(e)); };
    // §6 l'état tactique du match, pour l'écran : la formation et l'index de chaque réglage
    const etatTactique = () => {
      const t = ctx.tactique, valeurs = {};
      self.TACTIQUE_DIRECT().forEach((x) => { valeurs[x.k] = self.valeurTactique(t, x.k); });
      return { formation: t.formation, valeurs };
    };
    // §7 l'AUTO COACH : une fois par minute de match, il lit la situation (conseilsCoach).
    // En Assisté, il propose ; en Auto, il décide, au plus une fois toutes les deux minutes et
    // un changement toutes les quatre, comme un banc qui laisse le temps à ses choix.
    let conseil = null, coachMin = -1, dernierAuto = -99, dernierChangement = -99;
    const jouerConseil = (c, motif) => (c.k === 'sub' ? api.remplacer(c.slot, c.id, motif)
      : c.k === 'tac' ? api.tactique(c.champ, c.v, motif)
        : c.k === 'form' ? api.tactique('formation', self.FORMATIONS().indexOf(c.formation), motif)
          : c.k === 'cri' ? api.crier(c.id, motif) : c.k === 'carte' ? api.carte(c.id, motif) : { ok: false, why: 'Conseil inconnu' });
    const coachTour = () => {
      const mode = self.state.coachMode || 'manuel';
      if (mode === 'manuel' || dernier.done || resultat) { conseil = null; return; }
      if (dernier.minute === coachMin) return;
      coachMin = dernier.minute;
      const e = api.etat(); e.minute = dernier.minute;
      const liste = self.conseilsCoach(e).filter((c) => !(c.k === 'sub' && dernier.minute - dernierChangement < 4));
      if (mode === 'assiste') { const c = liste[0] || null; if ((c && c.texte) !== (conseil && conseil.texte)) { conseil = c; diffuser(); } return; }
      if (!liste.length || dernier.minute - dernierAuto < 2) return;
      for (const c of liste) {
        const r = jouerConseil(c, { auto: true, pourquoi: c.pourquoi });
        if (r.ok) { dernierAuto = dernier.minute; if (c.k === 'sub') dernierChangement = dernier.minute; break; }
      }
    };
    // décider : appliquer au moteur, puis l'écrire dans le match engagé (avec `plus`, dans le même setState)
    const decider = (d, plus, motif) => {
      d.t = ctx.ticks; d.minute = dernier.minute;
      if (motif && motif.auto) d.auto = true;
      if (motif && motif.pourquoi) d.pourquoi = motif.pourquoi;
      conseil = null;
      self.appliquerDecision(ctx, d);
      const m = self.state.matchEngage;
      self.setState(Object.assign({}, plus || {}, m ? { matchEngage: Object.assign({}, m, { decisions: m.decisions.concat([d]) }) } : {}));
      diffuser();
      return { ok: true };
    };
    // ---- le spectacle : les images du moteur montrées en temps réel autour des actions ----
    const S = { on: false, mode: 'lecture', tVue: 0, fin: 6, finPrec: 0, scanT: -1, vu: null, gel: null, vuT: -1, tourT: Date.now() };
    const DANGER = { pen: 1, corner: 1, fkd: 1, fkc: 1 };
    // la première image d'une action qui mérite d'être vue, parmi les images pas encore lues
    const chercher = () => {
      const imgs = ctx.E.images(); let prec = null, trouve = null;
      for (const f of imgs) {
        if (f.t > S.scanT) {
          const tir = f.fl && f.fl[4] === 'shot' && !(prec && prec.fl && prec.fl[4] === 'shot');
          const arrete = f.set && DANGER[f.set] && !(prec && prec.set === f.set);
          const ev = f.ev && f.ev.some((e) => e.k === 'goal' || e.k === 'card');
          if ((tir || arrete || ev) && !trouve) trouve = f;
          S.scanT = f.t;
        }
        prec = f;
      }
      return trouve;
    };
    const finImages = () => { const imgs = ctx.E.images(); return imgs.length ? imgs[imgs.length - 1].t : 0; };
    // un tour de la boucle en spectacle ; vrai quand le match est fini et entièrement montré
    const tourSpectacle = (dt) => {
      const vLect = 1.25 * rythme / 1.5, limite = Date.now() + 25;   // ×1 : 1,25 fois le temps réel
      if (S.mode === 'saut') {
        let f = null;
        while (!dernier.done && !f && Date.now() < limite) { api.avancer(6); f = chercher(); }
        if (!f && dernier.done) f = chercher();
        if (f) {
          const imgs = ctx.E.images();
          S.mode = 'lecture'; S.gel = null;
          S.tVue = Math.max(f.t - 7, S.finPrec, imgs.length ? imgs[0].t : 0); S.fin = f.t + 4.5;
          S.vuT = S.tVue - 0.001;   // ce qui s'est passé pendant le saut ne se rejoue pas à l'écran
          diffuser();
        } else if (dernier.done) return true;
        return false;
      }
      if (!enPause) S.tVue += dt * vLect;
      // le moteur garde à peine plus d'une seconde d'avance : une décision prise en regardant
      // s'applique au moment qu'on voit, à une seconde près
      const manque = Math.ceil((S.tVue + 1.2 - finImages()) / 0.1);
      if (manque > 0 && !dernier.done) { api.avancerPas(Math.min(manque, 400)); const f2 = chercher(); if (f2) S.fin = Math.max(S.fin, f2.t + 4.5); }
      const f3 = chercher(); if (f3) S.fin = Math.max(S.fin, f3.t + 4.5);
      if (dernier.done && S.tVue >= finImages()) return true;
      if (S.tVue > S.fin && !dernier.done) {
        S.mode = 'saut'; S.finPrec = S.fin;
        const v = api.vue(); S.gel = { A: v.A, B: v.B, fr: v.fr, t: v.t };
        diffuser();
      }
      return false;
    };
    const api = {
      opp: ctx.opp, amical: ctx.amical, meteo: ctx.E.weather ? ctx.E.weather().id : 'soleil',
      // le nom court d'un joueur (code 0 à 21), pour l'écrire au-dessus de sa tête
      nomJoueur(code) {
        if (code >= 11) return 'n°' + (code - 10) + ' · ' + ctx.opp.club.split(' ').slice(-1)[0];   // l'adversaire n'a pas de nom propre
        const p = ctx.E.player ? ctx.E.player(code) : null; return p ? p.short : '';
      },
      etat() {
        if (resultat) return { done: true, fini: true, resultat, decisions: ctx.decisions.slice(), opp: ctx.opp, amical: ctx.amical };
        const f = ctx.E.state();
        // en spectacle, l'écran est quelques secondes derrière le moteur : la minute, le score
        // et le fil sont ceux de l'image montrée, pour ne pas annoncer un but avant qu'on le voie
        const vu = S.on ? S.vu : null;
        const log = vu ? ctx.E.log.filter((l) => l.t <= vu.t + 1e-6) : ctx.E.log;
        return { done: false, fini: false, opp: ctx.opp, amical: ctx.amical,
          minute: vu ? Math.min(90, Math.floor(vu.m / 60)) : dernier.minute, clock: vu ? ctx.E.clockLabel(vu.m, vu.h) : dernier.clock,
          score: vu && vu.sc ? [vu.sc[0], vu.sc[1]] : [f.score.H, f.score.A], poss: f.poss, tirs: [f.st.H.sh, f.st.A.sh],
          xi: vivant(f), banc: ctx.banc.slice(), faits: ctx.faits, max: R.remplacements, cri: ctx.cri,
          cartes: self.MATCH_CARDS().map((c) => Object.assign({}, c, { n: (self.state.inv || {})[c.id] || 0 })),
          decisions: ctx.decisions.slice(), fil: log.slice(-6).map((l) => ({ text: l.text, k: l.k, s: l.s })),
          vitesse: rythme, pause: enPause, spectacle: S.on, saut: S.on && S.mode === 'saut',
          tactique: etatTactique(),
          coach: { mode: self.state.coachMode || 'manuel', conseil: conseil ? { texte: conseil.texte, pourquoi: conseil.pourquoi } : null } };
      },
      avancer(ms) {
        if (!dernier.done) { dernier = ctx.E.runFor(ms || 40); ctx.ticks += dernier.pas; coachTour(); }
        return dernier;
      },
      // les compteurs du moteur à cet instant (actions, récupérations, présence dans la
      // surface) : de quoi montrer ce qu'un changement tactique a changé (§40)
      compteurs() { return Object.assign({}, ctx.E.state().cnt || {}); },
      // exactement n pas de moteur (un dixième de seconde de jeu chacun)
      avancerPas(n) {
        if (!dernier.done && n > 0) { dernier = ctx.E.runTicks(n); ctx.ticks += dernier.pas; coachTour(); }
        return dernier;
      },
      // §6 changer un réglage depuis le banc (k : formation, mentalite, pressing, bloc,
      // rythme, largeur ; v : l'index de l'option dans TACTIQUE_DIRECT)
      tactique(k, v, motif) {
        if (dernier.done || resultat) return { ok: false, why: 'Le match est fini' };
        const def = self.TACTIQUE_DIRECT().find((x) => x.k === k);
        if (!def) return { ok: false, why: 'Réglage inconnu' };
        if (!(v >= 0 && v < def.options.length && v === Math.round(v))) return { ok: false, why: 'Valeur hors limites' };
        if (self.valeurTactique(ctx.tactique, k) === v) return { ok: false, why: 'C’est déjà le réglage en cours' };
        if (k === 'formation') {
          const f = def.options[v], pl = self.placementFormation(ctx.xi, ctx.tactique.formation, f);
          if (!pl) return { ok: false, why: 'Formation inconnue' };
          return decider({ k: 'form', formation: f, coords: pl.coords, slots: pl.slots }, null, motif);
        }
        return decider({ k: 'tac', champ: k, v }, null, motif);
      },
      // §7 qui décide sur le banc : 'manuel', 'assiste' (l'IA propose) ou 'auto' (l'IA décide)
      coach(mode) {
        if (['manuel', 'assiste', 'auto'].indexOf(mode) < 0) return { ok: false, why: 'Mode inconnu' };
        self.setState({ coachMode: mode }); conseil = null; coachMin = -1; coachTour(); diffuser();
        return { ok: true };
      },
      // le conseil proposé en mode Assisté, accepté par le manager
      appliquerConseil() {
        if (!conseil) return { ok: false, why: 'Aucun conseil en attente' };
        return jouerConseil(conseil, { pourquoi: conseil.pourquoi });
      },
      remplacer(slot, id, motif) {
        const xi = vivant(ctx.E.state());
        const info = self.remplacementInfo({ xi, banc: ctx.banc, faits: ctx.faits, done: dernier.done || !!resultat }, slot, id);
        if (!info.can) return { ok: false, why: info.why };
        const entrant = self.entrant(xi.find((p) => p.slot === slot), ctx.banc.find((p) => p.id === id));
        self.buzz(25);
        return decider({ k: 'sub', slot, entrant, desc: self.joueurMoteur(entrant) }, null, motif);
      },
      crier(id, motif) {
        if (!self.CRIS().some((x) => x.id === id)) return { ok: false, why: 'Consigne inconnue' };
        if (dernier.done || resultat) return { ok: false, why: 'Le match est fini' };
        if (ctx.cri === id) return { ok: false, why: 'C’est déjà la consigne en cours' };
        return decider({ k: 'cri', id }, null, motif);
      },
      carte(id, motif) {
        const c = self.MATCH_CARDS().find((x) => x.id === id), inv = Object.assign({}, self.state.inv || {});
        if (!c) return { ok: false, why: 'Carte inconnue' };
        if (dernier.done || resultat) return { ok: false, why: 'Le match est fini' };
        if (!(inv[id] > 0)) return { ok: false, why: 'Aucune carte ' + c.label + ' en réserve' };
        inv[id]--;
        self.buzz([30, 30, 60]);
        return decider({ k: 'carte', id }, { inv }, motif);   // la carte sort de la réserve dans la même écriture
      },
      vitesse(v) { rythme = v > 0 ? v : 3; diffuser(); },
      pause(oui) { enPause = !!oui; diffuser(); },
      ecouter(fn) { ecouteurs.push(fn); return () => { const k = ecouteurs.indexOf(fn); if (k >= 0) ecouteurs.splice(k, 1); }; },
      terminer() {
        if (resultat) return resultat;
        if (!dernier.done) { ctx.E.finish(); dernier = { done: true, minute: 90, clock: 'FIN' }; }
        self.enDirect = null;
        resultat = self.cloreMatch(ctx);
        resultat.decisions = ctx.decisions.slice();
        diffuser();
        return resultat;
      },
      // Le match se déroule seul. Le rythme se compte en minutes de match par seconde
      // réelle : à 3, un match dure trente secondes, le temps de voir venir et de décider.
      // §22 « je regarde les 22 joueurs jouer » : la vue 3D de l'app. Le moteur calcule
      // toujours en rapide (le match est le même, décisions comprises) et garde ses images ;
      // l'écran les montre en temps réel autour de chaque action (frappe, penalty, corner,
      // coup franc direct, carton, but) et saute le reste, comme les temps forts de Mon Club.
      spectacle(oui) {
        if (!!oui === S.on) return;
        S.on = !!oui;
        if (S.on) {
          ctx.E.capture(900);
          Object.assign(S, { mode: 'lecture', tVue: 0, fin: 6, finPrec: 0, scanT: -1, vu: null, gel: null, vuT: -1 });
          if (rythme === 3) rythme = 1.5;   // regarder se fait au rythme réel (×1), pas en accéléré
        }
        else ctx.E.capture(0);
        diffuser();
      },
      // l'image à montrer maintenant : { A, B, fr, evs, saut }, et pour le rendu réel (labo/reel.js)
      // toutes les images gardées (imgs) et l'instant montré (t, temps du moteur)
      vue() {
        const imgs = ctx.E.images();
        if (!S.on || !imgs.length) return { A: null };
        if (S.mode === 'saut' && S.gel) return Object.assign({}, S.gel, { evs: null, saut: true, imgs });
        const vLect = 1.25 * (rythme === Infinity ? 4 : rythme) / 1.5;
        let t = S.tVue;
        if (!enPause && !resultat) t += Math.min(0.2, (Date.now() - S.tourT) / 1000) * vLect;
        let lo = 0, hi = imgs.length - 1;
        if (t <= imgs[0].t) hi = 0; else if (t >= imgs[hi].t) lo = hi;
        else while (hi - lo > 1) { const mi = (lo + hi) >> 1; if (imgs[mi].t <= t) lo = mi; else hi = mi; }
        const A = imgs[lo], B = imgs[Math.min(imgs.length - 1, lo + 1)], fr = B.t > A.t ? Math.max(0, Math.min(1, (t - A.t) / (B.t - A.t))) : 0;
        const evs = [];
        for (const f of imgs) { if (f.t > S.vuT && f.t < A.t && f.ev) f.ev.forEach((e) => evs.push(e)); }
        const changeMinute = !S.vu || Math.floor(S.vu.m / 60) !== Math.floor(A.m / 60) || (S.vu.sc && A.sc && (S.vu.sc[0] !== A.sc[0] || S.vu.sc[1] !== A.sc[1]));
        S.vuT = A.t; S.vu = A;
        if (changeMinute) diffuser();
        return { A, B, fr, evs, saut: false, imgs, t: A.t + (B.t - A.t) * fr };
      },
      // la feuille de match (passerelle.js) : qui porte quel code, son poste, son corps, son
      // visage ; le rendu réel en habille les 22 joueurs
      feuille() {
        if (ctx.feuille === undefined) { try { ctx.feuille = self.feuillePont(ctx); } catch (e) { ctx.feuille = null; } }
        return ctx.feuille;
      },
      lancer() {
        if (promesse) return promesse;
        promesse = new Promise((resolve) => {
          let t = Date.now(), cible = dernier.minute;
          const tour = () => {
            if (resultat) { resolve(resultat); return; }
            const now = Date.now(), dt = Math.min(1, (now - t) / 1000); t = now;
            if (S.on && rythme !== Infinity) { if (tourSpectacle(dt)) { resolve(api.terminer()); return; } S.tourT = Date.now(); setTimeout(tour, 30); return; }
            if (!enPause) cible = rythme === Infinity ? 999 : cible + dt * rythme;
            const avant = dernier.minute, limite = Date.now() + 30;
            while (!dernier.done && dernier.minute < cible && Date.now() < limite) api.avancer(rythme === Infinity ? 30 : 8);
            if (dernier.done) { resolve(api.terminer()); return; }
            if (dernier.minute !== avant) diffuser();
            setTimeout(tour, rythme === Infinity ? 0 : 40);
          };
          tour();
        });
        return promesse;
      }
    };
    this.enDirect = api;
    return api;
  },

  // Le match engagé puis interrompu (l'app fermée pendant le direct) : rejoué à
  // l'identique, même moteur au coup d'envoi, même graine, chaque décision au même pas,
  // puis joué jusqu'au bout et clos comme n'importe quel match.
  reprendreMatch() {
    const m = this.state.matchEngage;
    if (!m || this.enDirect || !m.depart) return null;
    const rnd = this.seedR(m.depart.seed);
    for (let i = 0; i < m.depart.tirages; i++) rnd();
    const E = this.makeEngine(Object.assign(JSON.parse(JSON.stringify(m.depart.cfg)), { rnd }));
    const H0 = m.depart.cfg.sides.H;
    const ctx = { E, xi: m.xi.slice(), oxi: m.oxi, opp: m.opp, plan: m.plan, amical: m.amical, banc: m.banc.slice(),
      faits: 0, cri: null, decisions: [], sortis: [], entres: {}, ticks: 0,
      tactique: { formation: m.formation || this.state.formation, tac: Object.assign({}, H0.tac), ment: H0.ment } };
    (m.decisions || []).forEach((d) => {
      const r = E.runTicks(d.t - ctx.ticks); ctx.ticks += r.pas;
      this.appliquerDecision(ctx, d);
    });
    E.finish();
    const res = this.cloreMatch(ctx);
    res.decisions = ctx.decisions.slice();
    res.repris = true;
    this.setState({ lastGain: 'Match interrompu contre ' + m.opp.club + ', joué jusqu’au bout : ' + res.score.join('-')
      + (this.state.lastGain ? ' · ' + this.state.lastGain : '') });
    return res;
  }
};
