// LinkFoot : SkillEngine (§12 à §20).
// 20 effets x 14 conditions x 6 raretés x 5 niveaux = plus de 10 000 combinaisons,
// générées à la demande, jamais stockées en dur.
//
// Trois règles tiennent tout le module :
//   1. une compétence a une PUISSANCE calculée, et sa RARETÉ en découle (§16, §17) :
//      une compétence très forte ne peut pas tomber souvent.
//   2. une compétence a des PRÉREQUIS (poste, statistiques, niveau) : elle n'est pas
//      équipable sur n'importe qui (§15).
//   3. une compétence équipée change le comportement du joueur dans le moteur (§14) :
//      ses effets sont lus par tactics.js puis par engine.js. Rien de décoratif.
export const Skills = {
  SKILL_DEF() {
    if (this._skill) return this._skill;
    // [id, nom, catégorie, effets, description, prérequis]
    // `req` : statistiques minimum à la rareté Élite, mises à l'échelle selon la rareté.
    const E = [
      ['tueur', 'Tueur', 'Tir', { sht: 6 }, 'finition sur les grosses occasions', { TIR: 72, ATQ: 66 }],
      ['visionnaire', 'Visionnaire', 'Passe', { pas: 5, dec: 4 }, 'passes qui créent le danger', { PAS: 72 }],
      ['laser', 'Passe laser', 'Passe', { pas: 7 }, 'précision des passes longues', { PAS: 75 }],
      ['chef', 'Chef d’orchestre', 'Tactique', { dec: 6, pas: 3 }, 'contrôle du rythme', { PAS: 68 }],
      ['renard', 'Renard des surfaces', 'Finition', { sht: 4, dec: 4 }, 'déplacements dans la surface', { ATQ: 70 }],
      ['sprinter', 'Sprinter', 'Vitesse', { pace: 7 }, 'exploitation des espaces en contre', { VIT: 75 }],
      ['pressing', 'Pressing fou', 'Pressing', { def: 4, pace: 3, drain: 1.25 }, 'pressing plus intense, plus fatigant', { PHY: 68, VIT: 64 }],
      ['gladiateur', 'Gladiateur', 'Physique', { phy: 7 }, 'duels physiques', { PHY: 75 }],
      ['calme', 'Calme absolu', 'Mental', { dec: 6, pas: 2 }, 'moins d’erreurs sous pression', {}],
      ['mur', 'Mur', 'Défense', { def: 8 }, 'interventions dans sa surface', { 'DÉF': 75 }],
      ['acier', 'Mental d’acier', 'Mental', { dec: 5, sht: 2 }, 'résiste à la pression des grands moments', {}],
      ['dribbleur', 'Funambule', 'Dribble', { dri: 7 }, 'dribbles réussis', { DRI: 75 }],
      ['aerien', 'Tour de contrôle', 'Coup de pied arrêté', { phy: 5, def: 3, sht: 2 }, 'jeu de tête', { PHY: 70 }],
      ['moteur', 'Moteur', 'Physique', { drain: 0.8, pace: 2 }, 'endurance, fatigue plus lente', { PHY: 64 }],
      ['leader', 'Leader', 'Leadership', { team: { dec: 2 } }, 'concentration des coéquipiers', {}],
      ['meneur', 'Meneur', 'Collectif', { team: { pas: 2 } }, 'jeu collectif autour de lui', { PAS: 66 }],
      ['grinta', 'Grinta', 'Mental', { phy: 5, def: 3, pace: 3, team: { phy: 1 } }, 'agressivité et pressing quand l’équipe est menée', { PHY: 66 }],
      ['clutch', 'Clutch', 'Situationnel', { sht: 5, dec: 5 }, 'dernières minutes d’un match serré', { TIR: 66 }],
      ['gk_reflex', 'Réflexes félins', 'Gardien', { ref: 7 }, 'parades réflexes', { 'RÉF': 72 }],
      ['gk_mains', 'Mains sûres', 'Gardien', { han: 7 }, 'ballons captés, pas de rebond', { MAI: 72 }],
      // §10 les deux catégories qui manquaient. Elles ont un vrai effet en match
      // (§13) : le Perforateur multiplie ses appels dans le dos de la défense et les
      // masque mieux, le Contre éclair joue vers l'avant dès la récupération.
      ['perforateur', 'Perforateur', 'Attaque', { pace: 3, dec: 3 }, 'appels dans le dos de la défense', { ATQ: 72, VIT: 70 }],
      ['eclair', 'Contre éclair', 'Transition', { pace: 4, pas: 3 }, 'joue vers l’avant dès la récupération', { VIT: 68, PAS: 66 }]
    ];
    // [id, libellé, multiplicateur, raccourci]
    // Plus la condition est étroite, plus l'effet est fort quand elle se produit.
    const C = [
      ['always', 'en permanence', 1.0, ''], ['trail70', 'quand l’équipe est menée après la 70e', 1.9, 'grinta'], ['closeLate', 'dans les 15 dernières minutes d’un match serré', 1.8, 'clutch'],
      ['leading', 'quand l’équipe mène', 1.3, 'dominant'], ['first15', 'dans le premier quart d’heure', 1.4, 'précoce'], ['momentum', 'pendant 6 minutes après une action décisive', 1.7, 'momentum'],
      ['tired', 'quand son énergie passe sous 55 %', 1.5, 'increvable'], ['home', 'à domicile', 1.25, 'local'], ['counter', 'en phase de contre', 1.6, 'contre'], ['box', 'dans une surface de réparation', 1.5, 'surface'],
      ['setpiece', 'sur coup de pied arrêté', 1.6, 'CPA'], ['pressed', 'quand l’équipe subit le pressing', 1.5, 'sous pression'], ['derby', 'contre un adversaire mieux classé', 1.4, 'outsider'], ['second', 'en seconde période', 1.2, '2e MT']
    ];
    const POSOK = {
      GB: ['gk_reflex', 'gk_mains', 'calme', 'leader', 'acier', 'moteur'],
      DEF: ['mur', 'gladiateur', 'aerien', 'leader', 'calme', 'moteur', 'grinta', 'pressing', 'laser', 'sprinter', 'acier'],
      MIL: ['visionnaire', 'laser', 'chef', 'meneur', 'moteur', 'pressing', 'dribbleur', 'calme', 'grinta', 'clutch', 'gladiateur', 'sprinter', 'eclair'],
      ATT: ['tueur', 'renard', 'sprinter', 'dribbleur', 'clutch', 'aerien', 'grinta', 'acier', 'gladiateur', 'visionnaire', 'perforateur', 'eclair']
    };
    // Les compétences avec lesquelles un joueur peut NAÎTRE. Figées sur les vingt
    // d'origine : une compétence ajoutée au jeu s'obtient (pack, récompense) et
    // s'équipe, mais ne change pas rétroactivement les joueurs déjà générés. Sans ce
    // gel, ajouter une compétence redistribuait les compétences innées de tout
    // l'effectif de départ, et donc changeait tous les matchs déjà joués.
    const INNEES = new Set(['tueur', 'visionnaire', 'laser', 'chef', 'renard', 'sprinter', 'pressing', 'gladiateur',
      'calme', 'mur', 'acier', 'dribbleur', 'aerien', 'moteur', 'leader', 'meneur', 'grinta', 'clutch', 'gk_reflex', 'gk_mains']);
    return (this._skill = { E, C, POSOK, INNEES, LVL: ['I', 'II', 'III', 'IV', 'V'] });
  },

  // Le nombre réel de combinaisons : l'objectif du §12 est de dépasser 10 000.
  skillCount() {
    const D = this.SKILL_DEF();
    return D.E.length * D.C.length * D.LVL.length * this.GRADES();
  },

  // §17 : la puissance réelle d'une compétence, de 0 à 100.
  // Elle se calcule à partir de l'effet, de l'étroitesse de la condition, du niveau
  // et du grade du tirage. La RARETÉ EN DÉCOULE : elle n'entre jamais dans le calcul,
  // sinon le raisonnement tourne en rond. C'est la règle du §16 et du §17.
  GRADES() { return 8; },

  rawPower(eid, cid, lvl, grade) {
    const D = this.SKILL_DEF(), e = D.E.find((x) => x[0] === eid), c = D.C[cid];
    if (!e || !c) return 0;
    let raw = 0;
    for (const k in e[3]) {
      if (k === 'drain') raw += Math.abs(1 - e[3][k]) * 16;
      else if (k === 'team') for (const t in e[3][k]) raw += e[3][k][t] * 3.4;   // un effet collectif pèse lourd
      else raw += e[3][k];
    }
    return raw * c[2] * (0.6 + lvl * 0.2) * (0.7 + grade * 0.1);
  },

  // Mise à l'échelle sur 0-100. L'exposant étale volontairement le haut du spectre :
  // très peu de combinaisons atteignent Gold et Legendary, ce qui est exactement
  // ce que demande le §18.
  skillPower(eid, cid, lvl, grade) {
    const raw = this.rawPower(eid, cid, lvl, grade);
    // l'échelle est calée pour que la combinaison la plus forte du jeu atteigne 100
    // sans que rien ne s'y empile : chaque rareté est plus étroite que la précédente.
    return Math.max(0, Math.min(100, Math.round(100 * Math.pow(raw / 38.5, 1.9))));
  },

  // L'index des combinaisons, rangées par rareté. Construit une fois, à la demande.
  // C'est lui qui garantit qu'un tirage Legendary tire vraiment dans les compétences
  // les plus puissantes du jeu, et pas dans une approximation.
  SKILL_INDEX() {
    if (this._skIdx) return this._skIdx;
    const D = this.SKILL_DEF(), G = this.GRADES(), R = this.RARITY();
    const by = {}; R.forEach((r) => { by[r.id] = []; });
    for (let ei = 0; ei < D.E.length; ei++) {
      for (let ci = 0; ci < D.C.length; ci++) {
        for (let l = 0; l < D.LVL.length; l++) {
          for (let g = 0; g < G; g++) {
            const pw = this.skillPower(D.E[ei][0], ci, l, g);
            by[this.rarityOfPower(pw).id].push([D.E[ei][0], ci, l, g, pw]);
          }
        }
      }
    }
    return (this._skIdx = by);
  },

  // §15 : ce qu'une compétence exige du joueur qui la porte.
  // L'exigence suit la PUISSANCE : une compétence forte demande un joueur fort.
  skillReq(eid, lvl, grade, power) {
    const D = this.SKILL_DEF(), e = D.E.find((x) => x[0] === eid);
    if (!e) return { pos: [], stats: {}, lvl: 1 };
    const pw = power != null ? power : this.skillPower(eid, 0, lvl, grade);
    const scale = 0.74 + pw / 100 * 0.42;            // 0,74 au plus faible, 1,16 au plus fort
    const stats = {};
    for (const k in e[5]) stats[k] = Math.round(e[5][k] * scale);
    const pos = [];
    for (const p2 in D.POSOK) if (D.POSOK[p2].indexOf(eid) >= 0) pos.push(p2);
    // le niveau exigé suit la puissance : les compétences Normal les plus modestes
    // sont portables dès le départ, les Legendary demandent un joueur construit.
    return { pos, stats, lvl: 1 + Math.round(pw / 5.5), power: pw };
  },

  // §15 : ce joueur peut-il porter cette compétence ? La réponse dit toujours pourquoi.
  canEquip(p, sk) {
    if (!p || !sk) return { ok: false, why: 'Compétence ou joueur introuvable' };
    const req = sk.req || this.skillReq(sk.eid, sk.lvlIdx || sk.lvl - 1, sk.grade || 0, sk.power);
    if (req.pos.indexOf(p.pos) < 0) return { ok: false, why: 'Réservée aux ' + req.pos.join(', ') };
    const st = {}; this.cardStats(p).forEach((q) => { st[q.l] = q.v; });
    for (const k in req.stats) {
      if ((st[k] || 0) < req.stats[k]) return { ok: false, why: k + ' ' + (st[k] || 0) + ' sur ' + req.stats[k] + ' requis' };
    }
    const lvl = this.playerLevel(p);
    if (lvl < req.lvl) return { ok: false, why: 'Joueur niveau ' + lvl + ', il en faut ' + req.lvl };
    const worn = this.equippedOn(p.id).length;
    if (worn >= this.skillSlots(p)) return { ok: false, why: 'Emplacements pleins (' + worn + ' sur ' + this.skillSlots(p) + ')' };
    return { ok: true, why: '' };
  },

  // Le nombre de compétences qu'un joueur peut porter : il augmente avec son niveau.
  skillSlots(p) { const l = this.playerLevel(p); return l >= 25 ? 4 : l >= 15 ? 3 : l >= 6 ? 2 : 1; },

  equippedOn(id) { return (this.state.skillInv || []).filter((k) => k.on === id); },

  makeSkill(eid, cid, lvl, grade) {
    const D = this.SKILL_DEF(), e = D.E.find((x) => x[0] === eid), c = D.C[cid];
    const g = grade || 0;
    const power = this.skillPower(eid, cid, lvl, g);
    const R = this.rarityOfPower(power), rarIdx = this.RARITY().findIndex((x) => x.id === R.id);
    // l'effet réel appliqué par le moteur suit la même échelle que la puissance
    const mult = (0.46 + power / 100 * 1.05) * 0.62;
    const eff = {};
    for (const k in e[3]) eff[k] = k === 'drain' ? e[3][k] : k === 'team' ? Object.fromEntries(Object.entries(e[3][k]).map(([a, v]) => [a, v * mult])) : e[3][k] * mult;
    const name = e[1] + (lvl ? ' ' + D.LVL[lvl] : '') + (c[3] ? ' · ' + c[3] : '');
    return {
      id: eid + ':' + cid + ':' + lvl + ':' + g, eid, cid: c[0], cidx: cid, lvlIdx: lvl, grade: g,
      name, cat: e[2], rar: R.id, rarIdx, rarLabel: R.label, color: R.tint, lvl: lvl + 1, power, eff,
      req: this.skillReq(eid, lvl, g, power),
      desc: e[4] + (c[0] === 'always' ? '' : ', ' + c[1]) + '.'
    };
  },

  // §17 : tirer une compétence d'une rareté, c'est tirer uniformément parmi les
  // combinaisons dont la puissance tombe dans la bande de cette rareté. Aucune
  // compétence très puissante ne peut donc sortir à un taux élevé.
  rollSkill(rarId, rnd) {
    const r = rnd || Math.random, idx = this.SKILL_INDEX();
    let list = idx[rarId];
    if (!list || !list.length) {
      // bande vide : on descend d'un cran plutôt que de rendre n'importe quoi
      const R = this.RARITY(); let i = Math.max(0, R.findIndex((x) => x.id === rarId));
      while (i > 0 && (!idx[R[i].id] || !idx[R[i].id].length)) i--;
      list = idx[R[i].id];
    }
    const pick = list[Math.floor(r() * list.length)];
    return this.makeSkill(pick[0], pick[1], pick[2], pick[3]);
  },

  // Les compétences d'un joueur pendant un match : celles qu'on lui a équipées,
  // plus celles qu'il porte de naissance. Le moteur ne lit que cette liste (§19).
  skillsOf(p) {
    const worn = this.state && this.state.skillInv ? this.equippedOn(p.id) : [];
    if (p.skills) return p.skills.concat(worn);
    return this.innateSkills(p).concat(worn);
  },

  // Les compétences innées : ce avec quoi un joueur arrive. Un joueur normal en a peu
  // et de faible rareté : c'est au directeur sportif de le construire (§4, §27).
  innateSkills(p) {
    const r = this.seedR((p.id || 1) * 104729 + 3), R = this.RARITY();
    const pool = this.SKILL_DEF().POSOK[p.pos] || this.SKILL_DEF().POSOK.MIL;
    const n = p.ovr >= 82 ? 2 : p.ovr >= 68 ? 1 : 0;
    const capIdx = Math.max(0, R.findIndex((x) => x.id === this.rarityFor(p).id));
    const idx = this.SKILL_INDEX(), out = [];
    for (let i = 0; i < n; i++) {
      let q = r(), ri = 0;
      for (let k = 0; k < R.length; k++) { q -= R[k].rate; if (q <= 0) { ri = k; break; } }
      ri = Math.min(ri, capIdx);
      // une compétence innée reste compatible avec le poste du joueur
      const nee = this.SKILL_DEF().INNEES;
      const band = (idx[R[ri].id] || []).filter((x) => pool.indexOf(x[0]) >= 0 && nee.has(x[0]));
      const list = band.length ? band : (idx[R[0].id] || []).filter((x) => pool.indexOf(x[0]) >= 0 && nee.has(x[0]));
      if (!list.length) continue;
      const pick = list[Math.floor(r() * list.length)];
      out.push(this.makeSkill(pick[0], pick[1], pick[2], pick[3]));
    }
    return out;
  },

  // §19 : équiper change immédiatement le joueur, donc le moteur, donc le match.
  equipSkill(uid, playerId) {
    const s = this.state, inv = (s.skillInv || []).slice();
    const i = inv.findIndex((k) => k.uid === uid);
    if (i < 0) return { ok: false, why: 'Compétence introuvable' };
    const p = s.squad.find((x) => x.id === playerId);
    if (!p) return { ok: false, why: 'Joueur introuvable' };
    const chk = this.canEquip(p, inv[i]);
    if (!chk.ok) return { ok: false, why: 'COMPÉTENCE INCOMPATIBLE · ' + chk.why };
    inv[i] = Object.assign({}, inv[i], { on: playerId });
    this.buzz([25, 25, 50]);
    this.setState({ skillInv: inv, trainLog: p.name + ' apprend ' + inv[i].name });
    this.bumpQuest('equip', 1);
    return { ok: true };
  },

  unequipSkill(uid) {
    const s = this.state, inv = (s.skillInv || []).slice();
    const i = inv.findIndex((k) => k.uid === uid);
    if (i < 0) return { ok: false, why: 'Compétence introuvable' };
    inv[i] = Object.assign({}, inv[i], { on: null });
    this.setState({ skillInv: inv });
    return { ok: true };
  },

  // L'inventaire tel que l'écran Compétences l'affiche : pour chaque compétence,
  // qui la porte et, sinon, qui pourrait la porter.
  skillInventory() {
    const s = this.state, inv = s.skillInv || [];
    return inv.map((k) => {
      const on = k.on ? s.squad.find((p) => p.id === k.on) : null;
      const fits = s.squad.filter((p) => this.canEquip(p, k).ok);
      // §81 : quand personne ne peut la porter, on dit ce qui manque, pas « incompatible ».
      let miss = '';
      if (!fits.length && !on) {
        const req = k.req || this.skillReq(k.eid, k.lvlIdx || k.lvl - 1, k.grade || 0, k.power);
        const cands = s.squad.filter((p) => req.pos.indexOf(p.pos) >= 0);
        if (!cands.length) miss = 'Aucun ' + req.pos.join(' ni ') + ' dans ton effectif';
        else {
          const best = cands.map((p) => this.canEquip(p, k)).find((x) => x.why);
          const closest = cands.sort((a, b2) => this.playerLevel(b2) - this.playerLevel(a))[0];
          miss = this.canEquip(closest, k).why + ' (ton meilleur candidat : ' + closest.name + ')';
          if (!miss && best) miss = best.why;
        }
      }
      return Object.assign({}, k, {
        onName: on ? on.name : null,
        fitCount: fits.length,
        fits: fits.map((p) => ({ id: p.id, name: p.name, pos: p.pos, ovr: p.ovr })),
        miss,
        reqLine: this.reqLine(k)
      });
    });
  },

  reqLine(k) {
    const req = k.req || this.skillReq(k.eid, k.lvlIdx || k.lvl - 1, k.grade || 0, k.power);
    const st = Object.keys(req.stats).map((x) => x + ' ' + req.stats[x]);
    return [req.pos.join('/'), st.join(', '), 'niveau ' + req.lvl].filter(Boolean).join(' · ');
  }
};
