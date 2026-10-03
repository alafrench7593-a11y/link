// LinkFoot → Unreal Engine 5 : la passerelle, côté LinkFoot (docs/passerelle-ue5.md).
//
// Le moteur LinkFoot reste la seule autorité. Il décide tout : qui court où, qui passe, qui
// tire, ce que devient le ballon, le score. Un rendu externe (Unreal Engine 5 ici, mais aussi
// bien la vue three.js de l'app) lit ce que le moteur a décidé et le transforme en
// mouvements humains. Il ne décide rien : s'il décidait, deux cerveaux joueraient deux
// matchs différents, et l'écran ne montrerait plus le match qui compte.
//
// Ce fichier fabrique ce que le rendu lit :
//   - la feuille de match : qui est qui, de la carte au personnage (§36), ses statistiques,
//     les attributs que le moteur en tire, ses compétences, son état, son corps, son visage ;
//   - le document du match : dix images par seconde, les actions horodatées (passe, tir,
//     contrôle, dribble, tacle, plongeon, arrêt...), les événements, le résultat ;
//   - une empreinte, pour vérifier que deux rendus lisent bien le même match.
// Et il contrôle ce document (§55) : vitesses, téléportations, ballon, gardien, ligne.
//
// Le format est versionné (format « linkfoot-match », version 1). Les positions restent dans
// le repère du moteur (mètres, terrain de 68 sur 105) ; versUnreal() donne la conversion.
export const Passerelle = {
  PASSERELLE() {
    return {
      format: 'linkfoot-match', version: 1, hz: 10, pas: 0.1,
      // l'ordre des intentions de l'IA (code 1 à 9 ; 0 : aucune)
      intentions: ['HOLD', 'SUPPORT', 'BUILD_UP', 'ATTACK_SPACE', 'DROP', 'OVERLAP', 'RECOVER', 'MARK', 'COVER'],
      // les bits d'état d'un joueur, dans chaque image
      etats: { au_sol: 1, desequilibre: 2, porteur: 4, exclu: 8, sprint: 16, presse: 32, appel: 64, dribble: 128 },
      cpa: ['', 'ko', 'corner', 'fkc', 'fkd', 'fk', 'throw', 'gk', 'pen'],
      // ce que contient une ligne d'image : l'en-tête, puis 6 valeurs par joueur (code 0 à 21)
      tete: ['t', 'horloge', 'mi_temps', 'coupe', 'bx', 'by', 'bz', 'porteur', 'score_d', 'score_e', 'cpa', 'tireur'],
      joueur: ['x', 'y', 'angle', 'energie', 'etats', 'intention'],
      cible: ['cx', 'cy']
    };
  },

  // Le repère du moteur vers celui d'Unreal : centimètres, X vers le but que le domicile
  // attaque au coup d'envoi, Y vers la droite vue de dessus, Z vers le haut. Sans miroir :
  // la vue de dessus du moteur et celle d'Unreal se superposent.
  versUnreal(x, y, z) { return { X: (52.5 - y) * 100, Y: (x - 34) * 100, Z: (z || 0) * 100 }; },
  // l'orientation du corps (milliradians, repère du moteur) en lacet Unreal (degrés)
  lacetUnreal(angle) { const a = angle / 1000; return Math.atan2(Math.cos(a), -Math.sin(a)) * 180 / Math.PI; },

  // cyrb53 : une empreinte rapide, en JavaScript pur (navigateur, téléphone, serveur)
  empreintePont(str, graine) {
    let h1 = 0xdeadbeef ^ (graine || 0), h2 = 0x41c6ce57 ^ (graine || 0);
    for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  },

  // L'empreinte des images, sur les entiers eux-mêmes (cyrb53, ligne par ligne). Un lecteur la
  // recalcule en lisant (le cœur C++ d'Unreal, unreal/LinkFoot/Source/LinkFootCore) : s'il
  // trouve la même, il a lu exactement les nombres que le moteur a écrits, quelle que soit la
  // façon dont le JSON les a formatés.
  empreinteImagesPont(donnees) {
    let h1 = 0xdeadbeef ^ donnees.length, h2 = 0x41c6ce57 ^ donnees.length;
    for (const row of donnees) for (const v of row) { h1 = Math.imul(h1 ^ v, 2654435761); h2 = Math.imul(h2 ^ v, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return String(4294967296 * (2097151 & h2) + (h1 >>> 0));
  },

  // §36 une carte, un joueur, un personnage : le même numéro de bout en bout. Une carte
  // améliorée reste le même personnage ; c'est ce qu'il sait faire qui change.
  personnagePont(id) { return 'LF-' + String(id).padStart(5, '0'); },
  // Un adversaire n'a pas de carte : ses joueurs prennent une identité propre à son club, la
  // même à chaque rencontre, et différente d'un club à l'autre (pas de onze clones).
  personnageAdverse(club, i) { return 'ADV-' + String(this.empreintePont(club || 'adv') % 100000).padStart(5, '0') + '-' + String(i).padStart(2, '0'); },

  // Un tirage propre à un personnage et à une clé : chaque trait a le sien. En ajouter un ne
  // change aucun des autres, et un personnage garde son corps, son visage et son caractère
  // d'une version à l'autre (§36 : LF-00127 une fois pour toutes).
  tiragePont(perso, cle) { return this.seedR(this.empreintePont(perso + ':' + cle) % 2147483647 || 1)(); },

  // §4 et §8 le corps (cahier de la passerelle), et §7 à §10 du cahier « qualité visuelle » :
  // les seize mesures d'un corps paramétrique (MetaHuman), qui racontent la carte. La taille et
  // le poids sont ceux du profil (déjà affichés sur la fiche) ; les proportions vont de 0 à 1
  // (0,5 : un footballeur professionnel moyen) et découlent des statistiques : un rapide a les
  // jambes, les cuisses et les mollets, et peu de masse grasse ; un physique fort les épaules,
  // le torse, le cou et les muscles ; un défenseur central est plus large ; un gardien a
  // l'envergure, les bras et les mains. Chaque mesure a aussi sa part propre au personnage :
  // deux joueurs du même poste n'ont pas la même silhouette (§8). Le corps ne change pas le
  // jeu : les attributs restent le facteur principal.
  morphologie(p, stats, perso) {
    const pr = this.profile(p), st = stats || {};
    const cl = (v) => Math.round(Math.max(0, Math.min(1, v)) * 100) / 100;
    const bruit = (cle, a) => (this.tiragePont(perso, 'corps:' + cle) - 0.5) * 2 * (a || 0.07);
    const n = (k, d) => (st[k] != null ? st[k] : d);
    const VIT = n('VIT', 60), PHY = n('PHY', 60), DEF = n('DÉF', 55), gb = p.pos === 'GB', def = p.pos === 'DEF', att = p.pos === 'ATT';
    const h = pr.height, kg = pr.weight, imc = kg / Math.pow(h / 100, 2);
    const muscles = cl((PHY - 40) / 60 + bruit('muscles'));
    const masse = cl((imc - 19) / 7);
    const grasse = cl(0.5 + (imc - 22) * 0.1 - (VIT - 60) / 90 - (PHY - 60) / 220 + bruit('grasse'));
    const bras = cl(gb ? 0.78 + (n('PLO', 60) - 60) / 160 + bruit('bras', 0.04) : 0.45 + bruit('bras'));
    const pieds = cl(0.5 + bruit('pieds', 0.12));
    const carrure = muscles > 0.7 && masse > 0.55 ? 'massive' : muscles > 0.5 ? 'athletique' : muscles < 0.3 && masse < 0.4 ? 'fine' : 'equilibree';
    return {
      taille_cm: h, poids_kg: kg, carrure,
      epaules: cl(0.35 + (PHY - 50) / 100 + (gb || def ? 0.1 : 0) + bruit('epaules')),
      poitrine: cl(0.3 + (PHY - 50) / 90 + (def ? 0.08 : 0) + (att && PHY > 70 ? 0.05 : 0) + bruit('poitrine')),
      ventre: cl(0.3 + grasse * 0.45 + (imc - 22) * 0.04 + bruit('ventre', 0.05)),
      bassin: cl(0.45 + (PHY - 60) / 200 + bruit('bassin')),
      bras,
      mains: cl(0.45 + (gb ? 0.18 + (n('MAI', 60) - 60) / 220 : 0) + bruit('mains', 0.08)),
      jambes: cl(0.45 + (VIT - 60) / 120 + bruit('jambes')),
      cuisses: cl(0.35 + (VIT - 60) / 100 + (PHY - 60) / 120 + (def ? 0.04 : 0) + bruit('cuisses')),
      mollets: cl(0.35 + (VIT - 60) / 110 + (PHY - 60) / 200 + bruit('mollets')),
      cou: cl(0.3 + (PHY - 50) / 100 + (def || gb ? 0.05 : 0) + (DEF - 55) / 400 + bruit('cou')),
      tete: cl(0.5 + bruit('tete', 0.1)),
      pieds,
      muscles, masse, masse_grasse: grasse,
      // en unités : ce qu'un corps paramétrique sait viser directement
      masse_grasse_pct: Math.round((6.5 + grasse * 8) * 10) / 10,
      envergure_cm: Math.round(h * (1 + (bras - 0.5) * 0.12)),
      pointure: Math.round((h * 0.15 * (0.96 + 0.08 * pieds) + 1.5) * 1.5),
      posture: cl(0.5 + bruit('posture'))
    };
  },

  // §5 à §7 du cahier de la passerelle, §2 à §6 du cahier « qualité visuelle » : le visage, la
  // peau, les yeux, les cheveux et la barbe. Originaux, tirés d'une graine propre au
  // personnage, jamais copiés sur un vrai joueur, et rien n'est déduit de la nationalité.
  // teint : 0 (très clair) à 9 (très foncé). La texture des cheveux et la couleur des yeux et
  // des cheveux tiennent compte du teint, sans rien exclure : un corps crédible, pas un cliché.
  apparencePont(perso) {
    const r = this.seedR(this.empreintePont(perso + ':visage') % 2147483647 || 1);
    const t = (cle) => this.tiragePont(perso, 'visage:' + cle);
    // un tirage pondéré : [[valeur, poids], ...]
    const pese = (cle, liste) => { const tot = liste.reduce((a, x) => a + x[1], 0); let u = t(cle) * tot; for (const [v, w] of liste) { if ((u -= w) < 0) return v; } return liste[liste.length - 1][0]; };
    const teint = Math.min(9, Math.floor(t('teint') * 10)), f = teint / 9;
    const texture = pese('texture', [['raides', 0.10 + 0.40 * (1 - f)], ['ondules', 0.10 + 0.30 * (1 - f)], ['boucles', 0.20 + 0.10 * f], ['crepus', 0.05 + 0.55 * f]]);
    // §5 les coiffures : courts, dégradés, afro, boucles, frisés, dreadlocks, longs, attachés, rasés
    const styles = { raides: [['ras', 1], ['court', 3], ['degrade', 3], ['long', 1], ['attache', 1]],
      ondules: [['ras', 1], ['court', 3], ['degrade', 2], ['long', 1.5], ['attache', 1]],
      boucles: [['ras', 1], ['court', 2], ['degrade', 2], ['boucles', 3], ['long', 0.7], ['attache', 0.8], ['dreadlocks', 0.5]],
      crepus: [['ras', 1.5], ['court', 2], ['degrade', 3], ['afro', 1.5], ['frises', 1.5], ['dreadlocks', 1], ['tresses', 0.8]] }[texture];
    return {
      graine: this.empreintePont(perso) % 2147483647,
      visage: Array.from({ length: 8 }, () => Math.round(r() * 1000) / 1000),
      teint,
      texture_cheveux: texture,
      coiffure: pese('coiffure', styles),
      cheveux: pese('cheveux', [['noir', 0.3 + 0.6 * f], ['brun_fonce', 0.3], ['brun', 0.25 * (1 - f) + 0.05], ['chatain', 0.2 * (1 - f)], ['blond', 0.12 * (1 - f) + 0.01], ['roux', 0.05 * (1 - f) + 0.005]]),
      // §6 la pilosité faciale : rasé, très courte, courte, moyenne, longue, moustache, bouc
      barbe: pese('barbe', [['aucune', 0.3], ['tres_courte', 0.25], ['courte', 0.17], ['moyenne', 0.1], ['longue', 0.03], ['moustache', 0.04], ['bouc', 0.11]]),
      sourcils: Math.floor(t('sourcils') * 6),
      // 0 marron foncé, 1 marron, 2 noisette, 3 vert, 4 bleu, 5 gris
      yeux: pese('yeux', [[0, 0.25 + 0.5 * f], [1, 0.3], [2, 0.12 * (1 - f) + 0.02], [3, 0.08 * (1 - f) + 0.01], [4, 0.15 * (1 - f) + 0.01], [5, 0.05 * (1 - f) + 0.005]])
    };
  },

  // §27 du cahier « qualité visuelle » : la personnalité qui se voit, en six tempéraments
  // subtils (agressif, calme, expressif, réservé, énergique, confiant). Elle prolonge la
  // personnalité de la fiche (profile().perso) et les compétences ; chaque trait garde sa
  // part propre au personnage. Elle ne change rien au match : le rendu s'en sert pour
  // l'expressivité du visage, la façon de célébrer, de protester, de réclamer le ballon.
  personnalitePont(p, stats, perso, competences) {
    const pr = this.profile(p), st = stats || {}, eff = new Set((competences || []).map((k) => k.eid || k.effet));
    const cl = (v) => Math.round(Math.max(0.1, Math.min(0.9, v)) * 100) / 100;
    const bruit = (cle) => (this.tiragePont(perso, 'caractere:' + cle) - 0.5) * 0.24;
    const fiche = { Leader: { confiance: 0.2, expressivite: 0.05 }, Solitaire: { expressivite: -0.2, calme: 0.05 }, Travailleur: { energie: 0.2 },
      'Talent naturel': { confiance: 0.1, calme: 0.1 }, Showman: { expressivite: 0.3, confiance: 0.05 }, 'Compétiteur': { agressivite: 0.15, energie: 0.1 },
      Professionnel: { calme: 0.15, agressivite: -0.1 }, Instable: { agressivite: 0.2, calme: -0.25, expressivite: 0.1 }, 'Généreux': { energie: 0.1, expressivite: 0.1 },
      Ambitieux: { confiance: 0.1, agressivite: 0.1 }, Discret: { expressivite: -0.25, agressivite: -0.1 }, Charismatique: { confiance: 0.15, expressivite: 0.15 } }[pr.perso] || {};
    const c = (k, d) => (st[k] != null ? st[k] : d), a = (k) => fiche[k] || 0, s = (...l) => l.filter((e) => eff.has(e)).length * 0.12;
    const agressivite = cl(0.4 + (c('DÉF', 55) - 55) / 250 + (c('PHY', 60) - 60) / 300 + s('gladiateur', 'mur', 'grinta', 'pressing') + a('agressivite') + bruit('agressivite'));
    const calme = cl(0.5 + s('calme', 'clutch', 'acier') + a('calme') - (agressivite - 0.5) * 0.3 + bruit('calme'));
    const expressivite = cl(0.45 + s('leader', 'chef') * 0.5 + a('expressivite') + bruit('expressivite'));
    const energie = cl(0.45 + (c('VIT', 60) - 60) / 150 + s('moteur', 'pressing', 'sprinter') + a('energie') + bruit('energie'));
    const confiance = cl(0.45 + ((p.ovr || 65) - 65) / 80 + s('leader', 'chef', 'meneur', 'clutch', 'tueur') * 0.7 + a('confiance') + bruit('confiance'));
    const traits = { agressif: agressivite, calme, expressif: expressivite, reserve: Math.round((1 - expressivite) * 100) / 100, energique: energie, confiant: confiance };
    const type = Object.keys(traits).reduce((m, k) => (traits[k] > traits[m] ? k : m), 'calme');
    return { type, agressivite, calme, expressivite, energie, confiance };
  },

  // La feuille de match : tout ce qui ne bouge pas pendant le match. `ctx` vient de
  // ouvrirMatch : les attributs sont lus dans le moteur lui-même (E.player), pas recalculés,
  // pour qu'il n'existe qu'une formule (§3).
  feuillePont(ctx) {
    const { E, xi, oxi, opp, cfg } = ctx, s = this.state;
    const R2 = (v) => Math.round(v * 1000) / 1000;
    const moteur = (q) => (q ? {
      vitesse_max: R2(q.vmax), acceleration: R2(q.acc0), agilite: R2(q.agi0), equilibre: R2(q.bal0),
      vitesse: q.pace, tir: q.sht, passe: q.pas, dribble: q.dri, defense: q.def, physique: q.phy, decision: q.dec,
      gardien: q.line === 'GB' ? { reflexes: q.ref, prise: q.han, plongeon: q.div, degagement: q.kick, placement: q.gpos } : null
    } : null);
    const competences = (l) => (l || []).map((k) => ({ id: k.id, effet: k.eid, nom: k.name, categorie: k.cat, condition: k.cid, puissance: k.power, rarete: k.rar }));
    const statsDe = (p) => { const o = {}; this.cardStats(p).forEach((q) => { o[q.l] = q.v; }); return o; };
    const notre = (p, code) => {
      const st = statsDe(p), perso = this.personnagePont(p.id), pr = this.profile(p);
      const d = code != null ? cfg.sides.H.players[code] : null;
      return { code, camp: 'H', id: p.id, carte: p.id, personnage: perso, nom: p.name, poste: p.pos, ligne: p.line || p.pos, poste_tactique: p.slot || null,
        role: d ? d.role || null : null, devoir: d ? d.duty || null : null,
        numero: code != null ? code + 1 : null, note: p.ovr, rarete: p.rar || this.rarityFor(p).id, niveau: p.plv || 1,
        stats: st, moteur: code != null ? moteur(E.player(code)) : null, competences: competences(this.skillsOf(p)),
        etat: { forme: p.form != null ? p.form : 70, moral: p.morale != null ? p.morale : 72, energie: p.energy != null ? p.energy : (p.fit != null ? p.fit : 100), blessure: p.inj || 0 },
        pied: pr.foot, pied_faible: pr.wf, morphologie: this.morphologie(p, st, perso), apparence: this.apparencePont(perso),
        personnalite: this.personnalitePont(p, st, perso, this.skillsOf(p)) };
    };
    const adverse = (d, i, code) => {
      const perso = this.personnageAdverse(opp.club, i), st = d.st || {};
      const p = { id: 90000 + (this.empreintePont(perso) % 9000), pos: d.pos || d.line || 'MIL', ovr: d.ovr };
      // un adversaire n'a pas de carte, et ses notes sont retirées à chaque match : son corps et
      // son caractère se tirent de son personnage seul, pour qu'il reste le même d'un match à l'autre
      const u = (k) => Math.round(45 + 45 * this.tiragePont(perso, 'stable:' + k));
      const stable = { VIT: u('VIT'), PHY: u('PHY'), 'DÉF': u('DEF'), PLO: u('PLO'), MAI: u('MAI') };
      const pStable = { id: p.id, pos: p.pos, ovr: 60 + Math.round(20 * this.tiragePont(perso, 'stable:note')) };
      return { code, camp: 'A', id: null, carte: null, personnage: perso, nom: d.name, poste: p.pos, ligne: d.line || p.pos, poste_tactique: null,
        role: d.role || null, devoir: d.duty || null,
        numero: code != null ? code - 10 : null, note: d.ovr, rarete: null, niveau: null,
        stats: st, moteur: code != null ? moteur(E.player(code)) : null, competences: [],
        etat: { forme: 70, moral: 72, energie: 100, blessure: 0 }, pied: 'Droit', pied_faible: 3,
        morphologie: this.morphologie(pStable, stable, perso), apparence: this.apparencePont(perso), personnalite: this.personnalitePont(pStable, stable, perso, []) };
    };
    const A = cfg.sides.A;
    const joueurs = xi.map((p, i) => notre(p, i))
      .concat(oxi.map((p, i) => adverse(Object.assign({}, p, { st: A.players[i].st }), i, 11 + i)))
      .concat(this.benchOf(xi).map((p) => notre(p, null)))
      .concat((A.bench || []).map((d, i) => adverse(d, 11 + i, null)));
    const equipe = (side, nom, kit) => ({
      club: nom, maillot: kit, formation: side === 'H' ? s.formation : (this.styles()[opp.style] || {}).form || '4-4-2',
      mentalite: cfg.sides[side].ment, tactique: Object.assign({}, cfg.sides[side].tac),
      entraineur: side === 'H' && cfg.sides.H.coach ? cfg.sides.H.coach.id : null, style: side === 'A' ? opp.style || null : s.preset || null
    });
    return {
      equipes: { H: equipe('H', s.clubName || 'FC TonPseudo', { c1: (s.kit || {}).c1, c2: (s.kit || {}).c2, motif: (s.kit || {}).pat || 'uni' }),
        A: equipe('A', opp.club, { c1: opp.color || '#2F8FE0', c2: '#F2F4F7', motif: 'uni' }) },
      joueurs
    };
  },

  // Une image du moteur, en ligne du document : l'en-tête, puis 6 valeurs par joueur (code 0 à
  // 21) ; en débogage, les cibles de l'IA. Le rendu réel de l'app (rendu/labo/reel.js) lit ainsi
  // le match en direct, image par image, comme le document d'un match fini.
  lignePont(f, debug) {
    const cm = (v) => Math.round(v * 100), cpa = this.PASSERELLE().cpa;
    const row = [Math.round((f.t + 0.1) * 10), Math.round(f.m), f.h, f.coupe ? 1 : 0, cm(f.b[0]), cm(f.b[1]), cm(f.b[2]), f.o,
      f.sc[0], f.sc[1], Math.max(0, cpa.indexOf(f.set || '')), f.tk];
    for (let k = 0; k < 22; k++) row.push(cm(f.P[k * 2]), cm(f.P[k * 2 + 1]), f.F[k], f.E[k], f.S[k], f.I[k]);
    if (debug) for (let k = 0; k < 22; k++) row.push(cm(f.T[k * 2]), cm(f.T[k * 2 + 1]));
    return row;
  },

  // Une action du moteur telle que le document l'écrit : à l'instant du geste (le ballon part
  // de x0, y0 à cet instant), les nombres au centième, l'xG au millième.
  actionPont(a) {
    const b = {};
    Object.keys(a).forEach((k) => { const v = a[k]; b[k] = typeof v === 'number' && !Number.isInteger(v) ? (k === 'xg' ? Math.round(v * 1000) / 1000 : Math.round(v * 100) / 100) : v; });
    b.t = Math.round(a.t * 10) / 10;
    return b;
  },

  // Les noms des colonnes d'une ligne d'image.
  champsPont(debug) {
    const P = this.PASSERELLE();
    return P.tete.concat(...Array.from({ length: 22 }, (_, k) => P.joueur.map((c) => c + k)), debug ? [].concat(...Array.from({ length: 22 }, (_, k) => P.cible.map((c) => c + k))) : []);
  },

  // Le document du match, à partir des images que le moteur a gardées (capture).
  documentPont(ctx, opts) {
    const o = opts || {}, E = ctx.E, P = this.PASSERELLE();
    const imgs = E.images();
    if (!imgs.length || !imgs[0].F) throw new Error('Pas d’images de passerelle : ouvrir le match avec { pont: true } et E.capture()');
    const donnees = imgs.map((f) => this.lignePont(f, o.debug));
    const actions = [];
    imgs.forEach((f) => (f.ac || []).forEach((a) => actions.push(this.actionPont(a))));
    const evenements = [];
    imgs.forEach((f) => (f.ev || []).forEach((e) => evenements.push(Object.assign({ t: Math.round((f.t + 0.1) * 10) / 10 }, e))));
    const champs = this.champsPont(o.debug);
    // la feuille du coup d'envoi (matchPont la prend avant de jouer) : relue en fin de match,
    // un titulaire remplacé recevait les attributs du moteur de son remplaçant, qui porte
    // désormais son code (E.player)
    const feuille = ctx.feuille || this.feuillePont(ctx);
    const doc = {
      format: P.format, version: P.version,
      moteur: { hz: P.hz, pas: P.pas, graine: ctx.seed != null ? ctx.seed : null },
      repere: { unite: 'm', terrain: [68, 105], images_en: 'cm', angles_en: 'mrad',
        unreal: 'X = (52,5 − y) × 100 ; Y = (x − 34) × 100 ; Z = z × 100 (cm) ; lacet = atan2(cos a, −sin a)' },
      codes: { intentions: P.intentions, etats: P.etats, cpa: P.cpa },
      match: { competition: ctx.amical ? 'amical' : 'championnat', meteo: E.weather ? E.weather().id : 'soleil', domicile: !(ctx.opp && ctx.opp.exterieur),
        debut: donnees[0][0] / 10, fin: donnees[donnees.length - 1][0] / 10 },
      equipes: feuille.equipes, joueurs: feuille.joueurs,
      images: { champs, donnees }, actions, evenements
    };
    doc.empreinte = String(this.empreintePont(JSON.stringify([donnees, actions])));
    doc.empreinte_images = this.empreinteImagesPont(donnees);
    return doc;
  },

  // §71 Une délibération du moteur : ce que le porteur a choisi, à quel rang de ses options
  // (0 : la meilleure à ses yeux ; il se trompe parfois, selon sa lecture du jeu), et les
  // trois meilleures qu'il a écartées. bascule : sans sa compétence, il aurait préféré autre
  // chose (le même calcul que le compteur bascule_ du moteur). Les espérances sont celles du
  // moteur, sans unité : elles se comparent entre elles, à la même décision.
  decisionPont(W, p, ch, opts) {
    const r5 = (v) => Math.round(v * 1e5) / 1e5;
    const option = (x) => {
      const o = { k: x.k, ev: r5(x.ev) };
      const genre = x.k === 'pass' ? (x.kind === 'pass' && x.aerial ? 'long' : x.kind) : x.k === 'carry' ? x.label : x.k === 'cross' ? x.nm : null;
      if (genre) o.genre = genre;
      if (x.k === 'pass' && x.q) o.vers = x.q.code;
      return o;
    };
    const d = { t: Math.round(W.t * 10) / 10, c: p.code, choix: option(ch), rang: opts.indexOf(ch), autres: opts.filter((x) => x !== ch).slice(0, 3).map(option) };
    if (opts.some((x) => x.sans !== undefined)) {
      let sansB = null, sansEv = -Infinity;
      for (const x of opts) { const v = x.sans === null ? -Infinity : x.sans !== undefined ? x.sans : x.ev; if (v > sansEv) { sansEv = v; sansB = x; } }
      if (sansB !== opts[0]) d.bascule = true;
    }
    return d;
  },

  // Jouer un match en gardant tout ce que la passerelle transmet. C'est le vrai match :
  // résultat, XP, finances et division s'appliquent comme avec playMatch, au chiffre près.
  // En mode débogage (debug), le document porte en plus les cibles de l'IA à chaque image
  // et les délibérations du moteur à chaque décision (§71) : un observateur, sans effet
  // sur le match.
  matchPont(opp, opts) {
    const o = Object.assign({}, opts, { pont: true });
    const decisions = o.debug ? [] : null;
    if (decisions) {
      const autre = typeof o.dbg === 'function' ? o.dbg : null;
      o.dbg = (W, p, ch, opts2) => { decisions.push(this.decisionPont(W, p, ch, opts2)); if (autre) autre(W, p, ch, opts2); };
    }
    const ctx = this.ouvrirMatch(opp, o);
    // la feuille de match se lit au coup d'envoi : c'est là que chaque code porte son titulaire
    ctx.feuille = this.feuillePont(ctx);
    ctx.E.capture(1e9);
    ctx.E.finish();
    const doc = this.documentPont(ctx, o);
    if (decisions) doc.decisions = decisions;
    const resultat = this.cloreMatch(ctx);
    const st = ctx.E.state();
    doc.resultat = { score: resultat.score, tirs_au_but: resultat.pso, possession: resultat.poss, stats: resultat.stats,
      notes: { H: st.rat ? st.rat.H : null, A: st.rat ? st.rat.A : null }, journal: resultat.log };
    return { resultat, document: doc };
  },

  // Lire une ligne d'image : ce qu'un rendu fait en premier.
  lireImagePont(doc, i) {
    const row = doc.images.donnees[i], P = this.PASSERELLE(), n = P.tete.length, J = P.joueur.length;
    const joueurs = [];
    for (let k = 0; k < 22; k++) {
      const b = n + k * J, x = row[b] / 100, y = row[b + 1] / 100;
      joueurs.push({ code: k, present: x > -5, x, y, angle: row[b + 2], energie: row[b + 3], etats: row[b + 4], intention: row[b + 5] ? P.intentions[row[b + 5] - 1] : null });
    }
    return { t: row[0] / 10, horloge: row[1], mi_temps: row[2], coupe: !!row[3], ballon: [row[4] / 100, row[5] / 100, row[6] / 100], porteur: row[7],
      score: [row[8], row[9]], cpa: P.cpa[row[10]] || null, tireur: row[11], joueurs };
  },

  // §55 Ce que le rendu ne doit jamais avoir à cacher, vérifié sur le document lui-même :
  // vitesses et accélérations impossibles, téléportations hors des coupes, joueurs hors du
  // terrain ou l'un dans l'autre, ballon loin de son porteur, gardien hors de l'angle de
  // tir, ligne défensive cassée, joueurs immobiles sans raison. Chaque mesure est comptée ;
  // test/passerelle.js fixe ce qui est tolérable.
  verifierPont(doc) {
    const P = this.PASSERELLE(), D = doc.images.donnees, n = P.tete.length, J = P.joueur.length, dt = 0.1;
    const vmax = {}; doc.joueurs.forEach((j) => { if (j.code != null && j.moteur) vmax[j.code] = j.moteur.vitesse_max; });
    // les cibles de l'IA ne sont dans le document qu'en mode débogage (debug) : sans elles, on
    // ne sait pas si un joueur arrêté attend à sa place ou n'y va pas
    const cib = doc.images.champs.indexOf('cx0');
    const defenseurs = { H: doc.joueurs.filter((j) => j.code != null && j.code < 11 && j.ligne === 'DEF').map((j) => j.code),
      A: doc.joueurs.filter((j) => j.code != null && j.code >= 11 && j.ligne === 'DEF').map((j) => j.code) };
    const pos = (row, k) => [row[n + k * J] / 100, row[n + k * J + 1] / 100];
    const present = (row, k) => row[n + k * J] > -500;
    // les instants où un code change de personne ou de statut : remplacement, expulsion
    const sauts = new Set();
    (doc.actions || []).forEach((a) => { if (a.a === 'remplacement' || (a.a === 'faute' && (a.carton === 'R' || a.carton === 'R2'))) sauts.add(a.c + ':' + Math.round(a.t * 10)); });
    const c = { images: D.length, vitesse: 0, vitesse_max_vue: 0, acceleration: 0, teleportation: 0, hors_terrain: 0, chevauchement: 0, ballon_loin: 0,
      gardien_hors_angle: 0, gardien_mesures: 0, ligne_cassee: 0, ligne_mesures: 0, immobile: 0, coupes: 0 };
    const exemples = [];
    const note = (k, quoi) => { c[k]++; if (exemples.length < 12 && !exemples.some((e) => e.k === k)) exemples.push(Object.assign({ k }, quoi)); };
    const immobile = new Array(22).fill(0), chev = new Map();
    for (let i = 1; i < D.length; i++) {
      const a = D[i - 1], b = D[i];
      if (b[3] || b[0] - a[0] !== 1) { c.coupes++; continue; }   // coupe du moteur, ou pas manquant (célébration)
      const enJeu = !b[10] && !(a[10]);
      for (let k = 0; k < 22; k++) {
        if (!present(a, k) || !present(b, k)) continue;
        const [x0, y0] = pos(a, k), [x1, y1] = pos(b, k), v = Math.hypot(x1 - x0, y1 - y0) / dt;
        if (x1 < -1.6 || x1 > 69.6 || y1 < -2.1 || y1 > 107.1) note('hors_terrain', { t: b[0] / 10, code: k, x: x1, y: y1 });
        if (sauts.has(k + ':' + a[0]) || sauts.has(k + ':' + b[0])) continue;
        const lim = (vmax[k] || 9) * 1.25;
        if (v > c.vitesse_max_vue && v < 40) c.vitesse_max_vue = Math.round(v * 100) / 100;
        if (v > 40) note('teleportation', { t: b[0] / 10, code: k, m: Math.round(v * dt * 100) / 100 });
        else if (v > lim) note('vitesse', { t: b[0] / 10, code: k, v: Math.round(v * 10) / 10, vmax: vmax[k] });
        if (i > 1 && !D[i - 1][3] && a[0] - D[i - 2][0] === 1 && present(D[i - 2], k)) {
          const [xm, ym] = pos(D[i - 2], k), ax = (x1 - 2 * x0 + xm) / (dt * dt), ay = (y1 - 2 * y0 + ym) / (dt * dt);
          if (Math.hypot(ax, ay) > 14 && v < 40) note('acceleration', { t: b[0] / 10, code: k, a: Math.round(Math.hypot(ax, ay)) });
        }
        // immobile sans raison : arrêté plus de 8 s, ballon en jeu, alors que sa cible est à plus de 3 m
        const loin = cib >= 0 && Math.hypot(b[cib + k * 2] / 100 - x1, b[cib + k * 2 + 1] / 100 - y1) > 3;
        if (v < 0.2 && enJeu && loin && !(b[n + k * J + 4] & 9)) immobile[k]++; else immobile[k] = 0;
        if (immobile[k] === 80) note('immobile', { t: b[0] / 10, code: k });
      }
      // l'un dans l'autre : deux joueurs à moins de 40 cm pendant plus d'une demi-seconde
      for (let p = 0; p < 22; p++) for (let q = p + 1; q < 22; q++) {
        if (!present(b, p) || !present(b, q)) continue;
        const [xp, yp] = pos(b, p), [xq, yq] = pos(b, q), key = p * 22 + q;
        if (Math.abs(xp - xq) < 0.4 && Math.abs(yp - yq) < 0.4 && Math.hypot(xp - xq, yp - yq) < 0.4) { const v2 = (chev.get(key) || 0) + 1; chev.set(key, v2); if (v2 === 6) note('chevauchement', { t: b[0] / 10, codes: [p, q] }); }
        else chev.delete(key);
      }
      // le ballon colle à son porteur : 1,4 m au plus (la touche de balle en conduite, 0,5 à 1 m
      // devant lui, plus le rebond du dribble)
      const pr = b[7];
      if (pr >= 0 && present(b, pr) && enJeu) { const [xp, yp] = pos(b, pr); const d = Math.hypot(b[4] / 100 - xp, b[5] / 100 - yp); if (d > 1.4) note('ballon_loin', { t: b[0] / 10, code: pr, d: Math.round(d * 100) / 100 }); }
      // le gardien dans l'angle : quand un adversaire a le ballon à moins de 30 m du but, le
      // gardien doit être entre le ballon et sa cage (dans le triangle ballon / poteaux élargi)
      ['H', 'A'].forEach((side) => {
        const g = side === 'H' ? 0 : 11; if (!present(b, g) || pr < 0 || (side === 'H' ? pr < 11 : pr >= 11) || !enJeu) return;
        const gy = side === 'H' ? 105 : 0, bx = b[4] / 100, by = b[5] / 100, [xg, yg] = pos(b, g);
        if (Math.hypot(bx - 34, by - gy) > 30) return;
        c.gardien_mesures++;
        const vb = [bx - 34, by - gy], vg = [xg - 34, yg - gy], nb = Math.hypot(vb[0], vb[1]) || 1, ng = Math.hypot(vg[0], vg[1]);
        const ang = ng < 0.5 ? 0 : Math.acos(Math.max(-1, Math.min(1, (vb[0] * vg[0] + vb[1] * vg[1]) / (nb * ng)))) * 180 / Math.PI;
        if (ang > 35 || ng > nb) note('gardien_hors_angle', { t: b[0] / 10, code: g, angle: Math.round(ang) });
      });
      // la ligne défensive : quand l'équipe défend, ses défenseurs (ligne DEF de la feuille) ne
      // s'étalent pas sur plus de 12 m de profondeur (hors celui qui presse ou qui est au sol)
      ['H', 'A'].forEach((side) => {
        if (pr < 0 || (side === 'H' ? pr < 11 : pr >= 11) || !enJeu) return;
        const prof = defenseurs[side].filter((k) => present(b, k) && !(b[n + k * J + 4] & 33)).map((k) => pos(b, k)[1]);
        if (prof.length < 3) return;
        c.ligne_mesures++;
        const e = Math.max(...prof) - Math.min(...prof);
        if (e > 12) note('ligne_cassee', { t: b[0] / 10, camp: side, ecart: Math.round(e) });
      });
    }
    const pct = (a, b) => (b ? Math.round(a / b * 1000) / 10 : 0);
    return { compte: c, taux: { gardien_hors_angle: pct(c.gardien_hors_angle, c.gardien_mesures), ligne_cassee: pct(c.ligne_cassee, c.ligne_mesures) }, exemples };
  }
};
