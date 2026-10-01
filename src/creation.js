// LinkFoot : création du club (§2, §3, §4, §27).
//
// Le principe : on commence avec peu. L'effectif de départ est fait de joueurs
// NORMAUX, faibles mais avec du potentiel, plus UN joueur rare offert qui aide
// sans décider des matchs à lui seul.
export const Creation = {
  // §2 : ce que le directeur sportif choisit avant de recevoir son effectif.
  CREATION_STEPS() {
    return [
      { id: 'name', label: 'Nom du club', hint: 'Le nom qui s’affichera partout' },
      { id: 'kit', label: 'Couleurs et maillot', hint: 'Deux couleurs, un motif, un col' },
      { id: 'logo', label: 'Logo', hint: 'Forme et initiales' },
      { id: 'stade', label: 'Stade', hint: 'Terrain municipal au départ, agrandissable' },
      { id: 'pays', label: 'Pays et championnat', hint: 'Détermine la division de départ' }
    ];
  },

  COUNTRIES() {
    return [
      { id: 'fr', label: 'France', div: 4 }, { id: 'es', label: 'Espagne', div: 4 },
      { id: 'it', label: 'Italie', div: 4 }, { id: 'en', label: 'Angleterre', div: 4 },
      { id: 'de', label: 'Allemagne', div: 4 }, { id: 'pt', label: 'Portugal', div: 5 }
    ];
  },

  // §4 : la base du jeu. Note 46 à 58, jeunes, avec un vrai potentiel à développer.
  starterSquad(seed) {
    const r = this.seedR(seed || 20260101);
    const plan = [
      ['GB', 54], ['GB', 48], ['DEF', 55], ['DEF', 53], ['DEF', 51], ['DEF', 49], ['DEF', 47],
      ['MIL', 56], ['MIL', 54], ['MIL', 51], ['MIL', 48], ['ATT', 55], ['ATT', 52], ['ATT', 49]
    ];
    const F = ['A.', 'B.', 'C.', 'D.', 'E.', 'G.', 'H.', 'I.', 'J.', 'K.', 'L.', 'M.', 'N.', 'O.', 'R.', 'S.', 'T.', 'V.', 'Y.', 'Z.'];
    const L = ['Marvello', 'Ducasson', 'Ebongué', 'Halvorsen', 'Quintero', 'Belkadi-Roy', 'Stranieri', 'Okafor-Lemaire', 'Vasquet', 'Nyamsi', 'Gaudrel', 'Petrakis', 'Lindau', 'Moreau-Diaby', 'Castagne-Nil', 'Rivoire', 'Takamura', 'Ferbault', 'Ansaldi', 'Kowalevski', 'Dembrel', 'Soumahé'];
    return plan.map(([pos, ovr], i) => {
      const o = ovr + Math.round((r() - 0.5) * 4);
      const age = 17 + Math.floor(r() * 6);
      // un joueur normal jeune a du potentiel : c'est tout l'intérêt de le développer
      const pot = Math.min(88, o + 10 + Math.floor(r() * 18));
      return { id: i + 1, name: F[Math.floor(r() * F.length)] + ' ' + L[Math.floor(r() * L.length)],
        pos, ovr: o, pot, age, rar: 'normal', plv: 3, pxp: 0, scouted: true };
    });
  },

  // §3 : le joueur rare offert. Meilleure base, meilleur potentiel, une compétence
  // spéciale, mais une note qui reste loin de ce qui gagne un match tout seul.
  starterRare(seed) {
    const r = this.seedR((seed || 20260101) + 991);
    const POS = ['MIL', 'ATT', 'DEF'];
    const pos = POS[Math.floor(r() * POS.length)];
    const ovr = 66 + Math.floor(r() * 5);                 // 66 à 70 : utile, pas décisif
    const p = { id: 90, name: ['N. Oyelaran', 'M. Castellane', 'R. Esperanza', 'S. Haugen', 'K. Rakotoson'][Math.floor(r() * 5)],
      pos, ovr, pot: Math.min(92, ovr + 14 + Math.floor(r() * 8)), age: 19 + Math.floor(r() * 3),
      rar: 'rare', plv: 5, pxp: 0, scouted: true, gift: true };
    // sa compétence spéciale, tirée dans la rareté Rare et compatible avec son poste
    const D = this.SKILL_DEF(), pool = D.POSOK[pos] || D.POSOK.MIL;
    let sk = null;
    for (let i = 0; i < 20 && !sk; i++) {
      const cand = this.makeSkill(pool[Math.floor(r() * pool.length)], Math.floor(r() * D.C.length), 1, Math.floor(r() * 3));
      if (this.canEquipRaw(p, cand)) sk = cand;
    }
    p.skills = sk ? [sk] : [];
    return p;
  },

  // La vérification de compatibilité sans passer par l'inventaire (le joueur n'existe pas encore).
  canEquipRaw(p, sk) {
    const req = sk.req || this.skillReq(sk.eid, sk.rarIdx, sk.lvl - 1);
    if (req.pos.indexOf(p.pos) < 0) return false;
    const st = {}; this.genStatsFor(p).forEach((q) => { st[q.l] = q.v; });
    for (const k in req.stats) if ((st[k] || 0) < req.stats[k]) return false;
    return (p.plv || 1) >= req.lvl;
  },

  genStatsFor(p) { return this.cardStats(p); },

  // §2 : créer le club. Rien d'autre n'est donné : ni jetons en masse, ni pack gratuit
  // en série. Le premier LinkFoot Pack se mérite (§27).
  createClub(opts) {
    const o = opts || {}, seed = o.seed || Date.now() % 1000000;
    const country = this.COUNTRIES().find((c) => c.id === o.country) || this.COUNTRIES()[0];
    const squad = this.starterSquad(seed);
    const rare = this.starterRare(seed);
    const patch = {
      clubName: o.name || 'FC TonPseudo',
      country: country.id, division: country.div,
      kit: o.kit || this.state.kit,
      stade: 0, academy: 0, staff: { adjoint: 0, physique: 0, recruteur: 0, kine: 0 },
      squad: squad.concat([rare]),
      nextId: 200, nextSkillUid: 1, skillInv: [], collected: [], seenPlayers: [],
      balance: 600, shards: 0, xp: 0, level: 1,
      record: { w: 0, d: 0, l: 0 }, seasonP: 0, winStreak: 0,
      quests: this.rollQuests(1), caps: { day: this.dayKey() }, ledger: [],
      freeQueue: ['linkfoot'],                      // un seul pack offert pour démarrer
      created: true,
      welcome: { title: 'CLUB CRÉÉ', sub: rare.name + ' (' + rare.pos + ' ' + rare.ovr + ', potentiel ' + rare.pot + ') rejoint le club. Le reste de l’effectif est à construire.' }
    };
    this.setState(patch);
    this.logMoney(600, 'Dotation de départ');
    return { ok: true, rare, squad };
  },

  // Le résumé affiché après la création : ce que le directeur sportif a en main.
  creationSummary() {
    const s = this.state, sq = s.squad || [];
    const rare = sq.find((p) => p.gift);
    const norm = sq.filter((p) => !p.gift);
    const avg = norm.length ? Math.round(norm.reduce((a, p) => a + p.ovr, 0) / norm.length) : 0;
    const pot = norm.length ? Math.round(norm.reduce((a, p) => a + (p.pot || p.ovr), 0) / norm.length) : 0;
    return {
      club: s.clubName || 'FC TonPseudo',
      count: sq.length, avg, pot,
      rare: rare ? { name: rare.name, pos: rare.pos, ovr: rare.ovr, potential: rare.pot,
        skill: (rare.skills && rare.skills[0]) ? rare.skills[0].name : null } : null,
      line: 'Effectif de ' + sq.length + ' joueurs, note moyenne ' + avg + ', potentiel moyen ' + pot + '.'
    };
  }
};
