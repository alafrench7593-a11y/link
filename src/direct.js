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
  matchEnDirect(opp, opts) {
    const self = this, R = this.REGLES_DIRECT(), ctx = this.ouvrirMatch(opp, opts);   // ouvrirMatch refuse un second match
    ctx.banc = this.benchOf(ctx.xi).map((p) => Object.assign({}, p, { energy: p.fit != null ? p.fit : 100, yc: 0, red: false }));
    Object.assign(ctx, { faits: 0, cri: null, decisions: [], sortis: [], entres: {} });
    let dernier = { done: false, minute: 0, clock: "1'" }, rythme = 3, enPause = false, resultat = null, promesse = null;
    const ecouteurs = [];
    const vivant = (f) => ctx.xi.map((p, i) => Object.assign({}, p, f.en ? { energy: f.en[i], yc: f.cards[i][0], red: f.cards[i][1], note: f.rat.H[i] } : {}));
    const noter = (texte) => { ctx.decisions.push({ minute: dernier.minute, texte }); diffuser(); };
    const diffuser = () => { const e = api.etat(); ecouteurs.slice().forEach((fn) => fn(e)); };
    const api = {
      opp: ctx.opp, amical: ctx.amical,
      etat() {
        if (resultat) return { done: true, fini: true, resultat, decisions: ctx.decisions.slice(), opp: ctx.opp, amical: ctx.amical };
        const f = ctx.E.state();
        return { done: false, fini: false, opp: ctx.opp, amical: ctx.amical, minute: dernier.minute, clock: dernier.clock,
          score: [f.score.H, f.score.A], poss: f.poss, tirs: [f.st.H.sh, f.st.A.sh],
          xi: vivant(f), banc: ctx.banc.slice(), faits: ctx.faits, max: R.remplacements, cri: ctx.cri,
          cartes: self.MATCH_CARDS().map((c) => Object.assign({}, c, { n: (self.state.inv || {})[c.id] || 0 })),
          decisions: ctx.decisions.slice(), fil: ctx.E.log.slice(-6).map((l) => ({ text: l.text, k: l.k, s: l.s })),
          vitesse: rythme, pause: enPause };
      },
      avancer(ms) { if (!dernier.done) dernier = ctx.E.runFor(ms || 40); return dernier; },
      remplacer(slot, id) {
        const f = ctx.E.state(), xi = vivant(f);
        const info = self.remplacementInfo({ xi, banc: ctx.banc, faits: ctx.faits, done: dernier.done || !!resultat }, slot, id);
        if (!info.can) return { ok: false, why: info.why };
        const i = xi.findIndex((p) => p.slot === slot), sortant = xi[i];
        const entrant = self.entrant(sortant, ctx.banc.find((p) => p.id === id));
        ctx.sortis.push(Object.assign({}, sortant, { min: Math.max(1, dernier.minute) }));
        ctx.E.sub('H', i, self.joueurMoteur(entrant));
        ctx.xi[i] = entrant; ctx.entres[entrant.id] = dernier.minute;
        ctx.banc = ctx.banc.filter((p) => p.id !== id); ctx.faits++;
        self.buzz(25);
        noter(entrant.name + ' remplace ' + sortant.name + (entrant.pen ? ' (hors poste, −' + entrant.pen + ')' : ''));
        return { ok: true };
      },
      crier(id) {
        const c = self.CRIS().find((x) => x.id === id);
        if (!c) return { ok: false, why: 'Consigne inconnue' };
        if (dernier.done || resultat) return { ok: false, why: 'Le match est fini' };
        if (ctx.cri === id) return { ok: false, why: 'C’est déjà la consigne en cours' };
        ctx.E.shout(id); ctx.cri = id;
        noter('Consigne : ' + c.label);
        return { ok: true };
      },
      carte(id) {
        const c = self.MATCH_CARDS().find((x) => x.id === id), inv = Object.assign({}, self.state.inv || {});
        if (!c) return { ok: false, why: 'Carte inconnue' };
        if (dernier.done || resultat) return { ok: false, why: 'Le match est fini' };
        if (!(inv[id] > 0)) return { ok: false, why: 'Aucune carte ' + c.label + ' en réserve' };
        if (!ctx.E.card(id)) return { ok: false, why: 'Le moteur a refusé la carte' };
        inv[id]--; self.setState({ inv });
        self.buzz([30, 30, 60]);
        noter('Carte jouée : ' + c.label);
        return { ok: true };
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
      lancer() {
        if (promesse) return promesse;
        promesse = new Promise((resolve) => {
          let t = Date.now(), cible = dernier.minute;
          const tour = () => {
            if (resultat) { resolve(resultat); return; }
            const now = Date.now(), dt = Math.min(1, (now - t) / 1000); t = now;
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
  }
};
