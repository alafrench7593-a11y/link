// LinkFoot : ce que tes décisions ont fait, en chiffres du match (§1, §22, §47).
//
// Le directeur sportif ne touche jamais au ballon. Il compose, place, règle, prépare,
// équipe, entraîne, et le match se joue tout seul. Le problème, c'est qu'il n'a alors
// aucun moyen de savoir si ses réglages ont servi à quelque chose : il voit un score,
// pas une conséquence.
//
// Ce fichier répond à une seule question, après le coup de sifflet : qu'est-ce que
// chacune de tes décisions a produit sur le terrain ?
//
// DEUX RÈGLES, pour que ça reste honnête :
//
//   1. Une ligne n'apparaît que si tu as VRAIMENT bougé ce réglage. Rien ne s'affiche
//      pour un curseur laissé au milieu : ce serait du décor (§47).
//   2. Le chiffre vient du match qui vient d'être joué, jamais d'une estimation et
//      jamais d'un « sans ça, tu aurais fait X ». On ne rejoue pas la rencontre pour
//      inventer un contrefactuel : on dit ce qui s'est passé.
//
// Les réglages sont figés au coup d'envoi par matchPlan(), parce que certains se
// consomment pendant la rencontre : un plan tactique préparé ne vaut qu'un match, et
// l'état d'après ne saurait plus dire qu'il avait été préparé.
export const Impact = {
  // Les décisions, photographiées avant le coup d'envoi.
  matchPlan() {
    const s = this.state, xi = this.pickXI(s.formation);
    const duty = {};
    xi.forEach((p) => { const d = s.duties[p.slot] || 'Soutien'; duty[d] = (duty[d] || 0) + 1; });
    const portees = xi.reduce((a, p) => a + (this.equippedOn ? this.equippedOn(p.id).length : 0), 0);
    return {
      formation: s.formation, mentality: s.mentality, preset: s.preset,
      tac: Object.assign({}, s.tac),
      adv: s.nextAdv || 0, coh: s.cohBonus || 0,
      adjoint: this.staffLv('adjoint'), duty, portees,
      moral: Math.round(xi.reduce((a, p) => a + this.profile(p).morale, 0) / (xi.length || 1)),
      fraicheur: Math.round(xi.reduce((a, p) => a + (p.fit != null ? p.fit : 100), 0) / (xi.length || 1))
    };
  },

  MENTALITES() { return ['Très défensive', 'Défensive', 'Prudente', 'Équilibrée', 'Positive', 'Offensive', 'Très offensive']; },

  // Chaque ligne : quand elle s'affiche, ce qu'elle a décidé, ce que ça a donné.
  // `m` rassemble les chiffres du match ; `pm` les ramène pour mille ballons joués,
  // sans quoi deux matchs de volumes différents ne se comparent pas.
  IMPACT_DEFS() {
    const n1 = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
    return [
      { id: 'mentalite',
        quand: (p) => p.mentality !== 3,
        titre: (p) => 'Mentalité ' + (this.MENTALITES()[p.mentality] || '').toLowerCase(),
        mesure: (m) => m.sh + ' frappes tentées, ' + m.advSh + ' concédées' },

      { id: 'formation',
        quand: (p) => p.formation !== '4-3-3',
        titre: (p) => 'Formation en ' + p.formation,
        mesure: (m) => m.advSh + ' tirs concédés, ' + m.tk + ' ballons récupérés' },

      { id: 'style',
        quand: (p) => p.preset && p.preset !== 'perso' && p.preset !== 'equilibre',
        titre: (p) => { const st = this.styles()[p.preset]; return 'Style ' + (st ? st.name : p.preset); },
        mesure: (m) => m.poss + ' % de possession' },

      { id: 'passe',
        quand: (p) => p.tac.pass !== 1,
        titre: (p) => (p.tac.pass === 0 ? 'Jeu court imposé' : 'Jeu direct imposé'),
        mesure: (m) => n1(m.pm('act_pass_long')) + ' longs ballons pour mille, contre '
          + n1(m.pm('act_pass_pass')) + ' passes au sol' },

      // Pas le nombre de tacles : une équipe qui presse a plus le ballon, donc elle tacle
      // MOINS, et le rapport aurait dit l'inverse de ce qui s'est passé. Ce qui montre
      // qu'un pressing a marché, c'est OÙ le ballon a été récupéré.
      { id: 'pressing',
        quand: (p) => p.tac.press !== 1 || p.tac.engage !== 1,
        titre: (p) => (p.tac.press >= 2 ? 'Pressing haut' : p.tac.press === 0 ? 'Bloc en retrait' : 'Pressing réglé'),
        mesure: (m) => m.recHaut + ' ballons récupérés dans la moitié adverse sur ' + m.rec
          + ', ' + m.fou + ' fautes' },

      { id: 'ligne',
        quand: (p) => p.tac.line !== 1,
        titre: (p) => (p.tac.line === 2 ? 'Ligne défensive haute' : 'Ligne défensive basse'),
        mesure: (m) => m.advOff + ' hors-jeu provoqués, ' + m.advSh + ' tirs concédés' },

      { id: 'couloirs',
        quand: (p) => p.tac.cross !== 1 || p.tac.width !== 1,
        titre: (p) => (p.tac.cross >= 2 ? 'Attaque par les couloirs' : 'Jeu resserré dans l’axe'),
        mesure: (m) => m.cross + ' centres, ' + m.cor + ' corners' },

      { id: 'consignes',
        quand: (p) => (p.duty.Attaque || 0) + (p.duty['Défense'] || 0) > 0,
        titre: (p) => (p.duty.Attaque || 0) + ' en consigne Attaque, ' + (p.duty['Défense'] || 0) + ' en Défense',
        mesure: (m) => n1(m.pm('boxRcv')) + ' ballons reçus dans la surface pour mille' },

      { id: 'plan',
        quand: (p) => p.adv > 0,
        titre: (p) => 'Plan tactique préparé, +' + p.adv + ' d’avantage',
        mesure: (m) => n1(m.xg) + ' de danger créé (xG), ' + m.on + ' frappes cadrées' },

      { id: 'reunion',
        quand: (p) => p.coh > 0,
        titre: (p) => 'Réunion tenue, cohésion +' + Math.round(p.coh * 100) + ' %',
        mesure: (m) => m.precision + ' % de passes réussies, sur ' + m.pa + ' tentées' },

      { id: 'competences',
        quand: (p) => p.portees > 0,
        titre: (p) => p.portees + ' compétence(s) équipée(s) sur le onze',
        mesure: (m) => m.drib + ' dribbles tentés, ' + m.dribOk + ' réussis, '
          + m.gestes + ' gestes de haut niveau' },

      { id: 'adjoint',
        quand: (p) => p.adjoint > 0,
        titre: (p) => 'Adjoint niveau ' + p.adjoint,
        mesure: (m) => m.precision + ' % de passes réussies' },

      { id: 'fraicheur',
        quand: (p) => p.fraicheur < 85,
        titre: (p) => 'Onze à ' + p.fraicheur + ' % de fraîcheur',
        mesure: (m) => m.tk + ' ballons récupérés, ' + n1(m.pm('act_shot')) + ' frappes pour mille' },

      { id: 'moral',
        quand: (p) => p.moral >= 80 || p.moral <= 55,
        titre: (p) => 'Effectif au moral ' + (p.moral >= 80 ? 'haut' : 'bas') + ' (' + p.moral + ')',
        mesure: (m) => n1(m.xg) + ' de danger créé (xG)' }
    ];
  },

  // Les chiffres du match, rassemblés une fois pour toutes les lignes.
  impactFigures(mt) {
    const H = (mt.st && mt.st.H) || {}, A = (mt.st && mt.st.A) || {}, cnt = mt.cnt || {};
    const dec = cnt.dec || 0;
    const gestes = [3, 4, 5].reduce((a, t) => a + (cnt['g' + t] || 0), 0);
    return {
      sh: H.sh || 0, on: H.on || 0, xg: H.xg || 0, cor: H.cor || 0, fou: H.fou || 0,
      yc: H.yc || 0, pa: H.pa || 0, pc: H.pc || 0, tk: H.tk || 0,
      advSh: A.sh || 0, advOff: A.off || 0,
      poss: mt.poss != null ? mt.poss : (mt.possNow != null ? mt.possNow : 50),
      cross: cnt.cross || 0, drib: cnt.drib || 0, dribOk: cnt.dribOk || 0, gestes,
      rec: cnt.rec_H || 0, recHaut: cnt.rec_H_haut || 0,
      precision: H.pa ? Math.round(H.pc / H.pa * 100) : 0,
      dec, pm: (k) => (dec ? (cnt[k] || 0) / dec * 1000 : 0)
    };
  },

  // Le rapport : une ligne par décision réellement prise, avec ce qu'elle a donné.
  // Vide si le directeur sportif n'a rien changé : c'est une réponse, pas un remplissage.
  impactReport(mt) {
    if (!mt) return [];
    const plan = mt.plan || this.matchPlan();
    const m = this.impactFigures(mt);
    if (!m.dec && !m.sh && !m.pa) return [];        // match pas encore joué : rien à dire
    return this.IMPACT_DEFS()
      .filter((d) => { try { return d.quand(plan); } catch (e) { return false; } })
      .map((d) => ({ id: d.id, titre: d.titre(plan), valeur: d.mesure(m) }));
  },

  // Une phrase pour l'accueil et le rapport : combien de décisions ont pesé.
  impactLine(mt) {
    const n = this.impactReport(mt).length;
    return n ? n + ' de tes décisions ont pesé sur ce match' : 'Aucun réglage changé : l’équipe a joué par défaut';
  }
};
