// LinkFoot : Tactiques, formations, rôles, composition et passerelle vers le moteur (§40 à §43).
// Méthodes mélangées dans Club (voir club.js). Pas d'état propre : tout passe par this.state.
export const Tactics = {
  styles() {
    if (this._styles) return this._styles;
    const D = { width: 1, tempo: 1, pass: 1, behind: 0, cross: 1, dribble: 0, longshot: 0, patience: 0, line: 1, engage: 1, press: 1, trap: 0, tackle: 1, lost: 1, won: 1, gk: 0, mark: 0, fullbacks: 1, overload: 0, ptrap: 0, timewaste: 0 };
    const S = (k, fam, name, form, m, tac, desc, ref, beats, weak, threat) => ({ k, fam, name, form, m, tac: Object.assign({}, D, tac), desc, ref, beats, weak, threat });
    const list = [
      S('equilibre', 'Équilibre', 'Équilibré', '4-3-3', 3, {}, 'Aucun excès : un peu de tout, idéal pour découvrir l’adversaire.', 'La base de toutes les équipes', [], [], 'mid'),
      S('tiki', 'Possession', 'Tiki-taka', '4-3-3', 4, { tempo: 0, pass: 0, cross: 0, patience: 1, line: 2, engage: 2, press: 2, trap: 1, lost: 0 }, 'Passes courtes à l’infini, 65 % de possession, on fatigue l’adversaire avec le ballon.', 'Popularisé par le Barça de la fin des années 2000', ['direct', 'kick', 'blocmed'], ['contre', 'gegen', 'bus'], 'keep'),
      S('posit', 'Possession', 'Jeu de position', '4-3-3', 4, { tempo: 1, pass: 0, patience: 1, width: 2, line: 2, engage: 2, press: 2, lost: 0, fullbacks: 2 }, 'Chaque joueur occupe une zone précise pour créer des supériorités numériques entre les lignes.', 'La méthode Guardiola', ['blocbas', 'blocmed', 'homme'], ['gegen', 'contre'], 'keep'),
      S('relation', 'Possession', 'Jeu relationnel', '4-2-3-1', 4, { tempo: 1, pass: 0, dribble: 1, patience: 1, width: 0, overload: 2, line: 1, lost: 0 }, 'Les joueurs se rapprochent du ballon et combinent en petits triangles, sans positions fixes.', 'Style de Fluminense, très brésilien', ['homme', 'blocmed'], ['gegen', 'blocbas'], 'keep'),
      S('total', 'Possession', 'Football total', '4-3-3', 5, { tempo: 2, pass: 1, behind: 1, dribble: 1, line: 2, engage: 2, press: 2, trap: 1, lost: 0, fullbacks: 1 }, 'Tout le monde attaque, tout le monde défend, permutations permanentes. Très fatigant.', 'L’Ajax et les Pays-Bas des années 70', ['blocmed', 'catenaccio', 'bus'], ['contre', 'direct'], 'keep'),
      S('gegen', 'Pressing', 'Gegenpressing', '4-3-3', 4, { tempo: 2, behind: 1, line: 2, engage: 2, press: 2, trap: 1, lost: 0, won: 0, ptrap: 2 }, 'Dès la perte du ballon, on presse à 5 pour le récupérer en moins de 8 secondes.', 'La signature de Klopp', ['tiki', 'posit', 'relation'], ['direct', 'kick'], 'press'),
      S('blochaut', 'Pressing', 'Bloc haut', '4-4-2', 4, { line: 2, engage: 2, press: 2, trap: 1, lost: 0, ptrap: 1 }, 'Ligne défensive très haute et piège du hors-jeu : l’adversaire étouffe dans son camp.', 'Utilisé par la plupart des grosses équipes', ['tiki', 'relation', 'bus'], ['contre', 'vertical', 'direct'], 'press'),
      S('homme', 'Pressing', 'Pressing homme à homme', '3-5-2', 4, { line: 2, engage: 2, press: 2, tackle: 2, mark: 2, lost: 0 }, 'Chaque joueur suit son adversaire direct partout sur le terrain. Duels, duels, duels.', 'Bielsa et Gasperini', ['posit', 'tiki', 'pistons'], ['relation', 'surcharge', 'vertical'], 'press'),
      S('blocmed', 'Défensif', 'Bloc médian', '4-4-2', 2, { width: 0, line: 1, engage: 1, press: 1, lost: 1, won: 0, ptrap: 2 }, 'On attend au milieu de terrain, on ferme l’axe et on presse seulement dans les zones pièges.', 'Très utilisé en sélection nationale', ['contre', 'direct', 'kick', 'vertical'], ['posit', 'total', 'surcharge'], 'mid'),
      S('blocbas', 'Défensif', 'Bloc bas', '4-4-2', 1, { width: 0, pass: 2, longshot: 1, line: 0, engage: 0, press: 0, tackle: 2, lost: 1, gk: 1, fullbacks: 0 }, 'Deux lignes de 4 collées devant la surface : aucun espace dans le dos, on attend l’erreur.', 'L’arme des outsiders', ['contre', 'vertical', 'kick', 'relation'], ['posit', 'ailes', 'pistons'], 'low'),
      S('catenaccio', 'Défensif', 'Catenaccio', '5-3-2', 1, { width: 0, pass: 2, behind: 1, line: 0, engage: 0, press: 1, tackle: 2, mark: 2, gk: 1, fullbacks: 0 }, 'Un libéro derrière la défense, marquage individuel strict et contres éclairs.', 'Le verrou italien des années 60', ['tiki', 'gegen', 'vertical'], ['ailes', 'total', 'surcharge'], 'low'),
      S('bus', 'Défensif', 'Garer le bus', '5-3-2', 0, { width: 0, tempo: 0, pass: 2, line: 0, engage: 0, press: 0, tackle: 2, gk: 1, fullbacks: 0, timewaste: 1 }, 'Les 11 joueurs derrière le ballon, on défend le score coûte que coûte.', 'Le plan anti-favori', ['tiki', 'posit'], ['ailes', 'total', 'blochaut', 'pistons'], 'low'),
      S('contre', 'Transition', 'Contre-attaque', '4-4-2', 2, { tempo: 2, pass: 2, behind: 1, dribble: 1, line: 0, engage: 0, won: 0, gk: 1 }, 'On récupère bas et on se projette en 3 passes dans le dos d’une défense montée.', 'Le classique des équipes rapides', ['tiki', 'posit', 'blochaut', 'total', 'ailes'], ['blocbas', 'blocmed'], 'space'),
      S('vertical', 'Transition', 'Transitions verticales', '4-2-3-1', 3, { tempo: 2, pass: 2, behind: 1, line: 1, engage: 1, press: 1, won: 0 }, 'Dès la récupération, le ballon va vers l’avant : peu de passes, beaucoup de vitesse.', 'Leicester champion en 2016', ['blochaut', 'homme', 'gegen'], ['blocbas', 'blocmed', 'catenaccio'], 'space'),
      S('direct', 'Direct', 'Jeu direct', '4-4-2', 4, { width: 2, tempo: 2, pass: 2, behind: 1, cross: 2, longshot: 1, tackle: 2, gk: 1 }, 'Longs ballons vers un grand attaquant, on gagne les deuxièmes ballons.', 'Le foot anglais traditionnel', ['gegen', 'blochaut', 'total'], ['blocmed', 'tiki', 'posit'], 'space'),
      S('kick', 'Direct', 'Kick and rush', '4-4-2', 5, { width: 2, tempo: 2, pass: 2, behind: 1, cross: 2, longshot: 1, engage: 2, press: 2, tackle: 2, gk: 1 }, 'On balance devant et on court : intensité maximale, peu de construction.', 'Le football d’avant, 100 % engagement', ['gegen', 'homme'], ['blocbas', 'blocmed', 'tiki'], 'space'),
      S('ailes', 'Couloirs', 'Jeu sur les ailes', '4-3-3', 4, { width: 2, cross: 2, dribble: 1, fullbacks: 1 }, 'Débordements et centres : on étire le bloc adverse sur toute la largeur.', 'Idéal avec des ailiers rapides', ['blocbas', 'bus', 'catenaccio'], ['contre', 'blocmed'], 'wide'),
      S('surcharge', 'Couloirs', 'Surcharge et renversement', '4-3-3', 4, { width: 2, pass: 1, patience: 1, overload: 1, fullbacks: 2 }, 'On attire l’adversaire d’un côté à 5 contre 3, puis on renverse vers un ailier seul de l’autre côté.', 'Très utilisé dans le foot moderne', ['homme', 'blocmed', 'catenaccio'], ['gegen', 'contre'], 'wide'),
      S('pistons', 'Couloirs', 'Pistons en 3-5-2', '3-5-2', 4, { width: 2, cross: 2, behind: 1, fullbacks: 2, line: 1 }, 'Trois défenseurs centraux et deux pistons qui font tout le couloir : largeur et solidité.', 'Système favori de nombreux entraîneurs italiens', ['blocbas', 'bus', 'kick'], ['contre', 'homme'], 'wide')
    ];
    this._styles = {};
    list.forEach((x) => { this._styles[x.k] = x; });
    this._styleList = list;
    return this._styles;
  },

  // La liste des styles, dans l'ordre d'affichage.
  styleList() { this.styles(); return this._styleList; },

  matchup(a, b) {
    const S = this.styles(), A = S[a], B = S[b];
    if (!A || !B) return 0;
    let v = (A.beats.includes(b) ? 1 : 0) - (A.weak.includes(b) ? 1 : 0) + (B.weak.includes(a) ? 1 : 0) - (B.beats.includes(a) ? 1 : 0);
    return Math.max(-2, Math.min(2, v));
  },

  formCoords(f) {
    return {
      '4-3-3': { GB: [[50, 88]], DEF: [[14, 68], [38, 73], [62, 73], [86, 68]], MIL: [[26, 49], [50, 54], [74, 49]], ATT: [[20, 24], [50, 17], [80, 24]] },
      '4-4-2': { GB: [[50, 88]], DEF: [[14, 68], [38, 73], [62, 73], [86, 68]], MIL: [[12, 46], [37, 51], [63, 51], [88, 46]], ATT: [[36, 20], [64, 20]] },
      '4-2-3-1': { GB: [[50, 88]], DEF: [[14, 68], [38, 73], [62, 73], [86, 68]], MIL: [[36, 56], [64, 56], [16, 34], [50, 36], [84, 34]], ATT: [[50, 15]] },
      '3-5-2': { GB: [[50, 88]], DEF: [[25, 72], [50, 75], [75, 72]], MIL: [[9, 46], [30, 52], [50, 42], [70, 52], [91, 46]], ATT: [[36, 19], [64, 19]] },
      '5-3-2': { GB: [[50, 88]], DEF: [[8, 64], [29, 72], [50, 75], [71, 72], [92, 64]], MIL: [[26, 48], [50, 52], [74, 48]], ATT: [[36, 20], [64, 20]] }
    }[f];
  },

  penalty(pos, line) {
    if (pos === line) return 0;
    if (pos === 'GB' || line === 'GB') return 30;
    const o = { DEF: 0, MIL: 1, ATT: 2 };
    return Math.abs(o[pos] - o[line]) === 1 ? 6 : 13;
  },

  pickXI(formation, lineup) {
    const s = this.state; lineup = lineup || s.lineup || {};
    const need = { '4-3-3': [1, 4, 3, 3], '4-4-2': [1, 4, 4, 2], '4-2-3-1': [1, 4, 5, 1], '3-5-2': [1, 3, 5, 2], '5-3-2': [1, 5, 3, 2] }[formation];
    const slots = [];
    ['GB', 'DEF', 'MIL', 'ATT'].forEach((pos, k) => { for (let i = 0; i < need[k]; i++) slots.push({ line: pos, slot: pos + i }); });
    const byId = {}; s.squad.forEach((p) => { byId[p.id] = p; });
    const pool = s.squad.filter((p) => !p.inj).slice().sort((a, b) => b.ovr - a.ovr);
    const used = new Set(), asg = {};
    slots.forEach((sl) => { const id = lineup[sl.slot]; if (id != null && byId[id] && !used.has(id)) { asg[sl.slot] = byId[id]; used.add(id); } });
    slots.forEach((sl) => {
      if (asg[sl.slot]) return;
      const p = pool.find((q) => !used.has(q.id) && q.pos === sl.line) || pool.find((q) => !used.has(q.id) && q.pos !== 'GB') || pool.find((q) => !used.has(q.id));
      if (p) { asg[sl.slot] = p; used.add(p.id); }
    });
    return slots.filter((sl) => asg[sl.slot]).map((sl) => {
      const p = asg[sl.slot], pen = this.penalty(p.pos, sl.line);
      return Object.assign({}, p, { line: sl.line, slot: sl.slot, base: p.ovr, pen, ovr: Math.max(30, p.ovr - pen) });
    });
  },

  benchOf(xi) { const ids = new Set(xi.map((p) => p.id)); return this.state.squad.filter((p) => !ids.has(p.id) && !p.inj).sort((a, b) => b.ovr - a.ovr).slice(0, 7); },

  ROLE_OPTS(line, slot, formation) {
    if (line === 'GB') return ['Gardien classique', 'Gardien libéro'];
    if (line === 'DEF') {
      const n = { '4-3-3': 4, '4-4-2': 4, '4-2-3-1': 4, '3-5-2': 3, '5-3-2': 5 }[formation];
      const i = Number(slot.slice(3));
      const wide = n >= 4 && (i === 0 || i === n - 1);
      return wide ? ['Latéral', 'Latéral offensif', 'Piston', 'Latéral inversé'] : ['Défenseur central', 'Défenseur relanceur', 'Stoppeur', 'Libéro'];
    }
    if (line === 'MIL') return ['Milieu central', 'Récupérateur', 'Meneur reculé', 'Box-to-box', 'Mezzala', 'Meneur avancé', 'Ailier'];
    return ['Avant-centre', 'Renard des surfaces', 'Faux 9', 'Pivot', 'Ailier inversé', 'Attaquant de pointe'];
  },

  metrics(xi) {
    const s = this.state, t = s.tac, m = s.mentality - 3;
    const ovr = xi.reduce((a, p) => a + p.ovr, 0) / xi.length;
    let atk = 0, def = 0, ctrl = 0, press = 0, fat = 0;
    atk += m * 1.3; def -= m * 1.0;
    atk += (t.width - 1) * 0.6; ctrl -= (t.width - 1) * 0.3;
    atk += (t.tempo - 1) * 0.8; ctrl -= (t.tempo - 1) * 1.2; fat += (t.tempo - 1) * 1.5;
    ctrl -= (t.pass - 1) * 1.5; atk += (t.pass - 1) * 0.3;
    if (t.behind) atk += 0.7;
    if (t.dribble) { atk += 0.5; ctrl -= 0.3; }
    if (t.longshot) atk += 0.3;
    if (t.patience) { ctrl += 1.5; atk -= 0.4; }
    def += (1 - t.line) * 1.0; press += (t.line - 1) * 0.8;
    press += (t.engage - 1) * 1.0; fat += (t.engage - 1) * 0.8;
    press += (t.press - 1) * 1.6; fat += (t.press - 1) * 2; def += (t.press - 1) * 0.4;
    if (t.trap) def += 0.4;
    def += (t.tackle - 1) * 0.3;
    if (t.lost === 0) { press += 1; fat += 0.8; } else def += 0.6;
    if (t.won === 0) atk += 0.6; else ctrl += 0.8;
    if (t.gk === 0) ctrl += 0.6; else atk += 0.2;
    if (t.mark === 0) def += 0.3; if (t.mark === 2) { press += 0.8; def -= 0.2; fat += 0.4; }
    if (t.fullbacks === 0) { def += 0.5; atk -= 0.3; } if (t.fullbacks === 1) { atk += 0.4; def -= 0.3; } if (t.fullbacks === 2) ctrl += 0.8;
    if (t.overload === 1 || t.overload === 3) { atk += 0.4; ctrl += 0.2; } if (t.overload === 2) ctrl += 0.5;
    if (t.ptrap === 1) press += 0.6; if (t.ptrap === 2) { press += 0.4; def += 0.2; }
    xi.forEach((p) => {
      const r = s.roles[p.slot], d = s.duties[p.slot] || 'Soutien';
      if (d === 'Attaque') { atk += 0.35; def -= 0.25; }
      if (d === 'Défense') { def += 0.35; atk -= 0.25; }
      if (r === 'Meneur reculé' || r === 'Défenseur relanceur' || r === 'Faux 9') ctrl += 0.5;
      if (r === 'Box-to-box' || r === 'Piston') { atk += 0.3; fat += 0.4; }
      if (r === 'Récupérateur' || r === 'Stoppeur') def += 0.4;
      if (r === 'Renard des surfaces' || r === 'Attaquant de pointe') atk += 0.4;
      if (r === 'Gardien libéro') ctrl += 0.3;
    });
    return { ovr, atk, def, ctrl, press, fat: Math.max(0, fat) };
  },

  baseShape(formation, side) {
    const C = this.formCoords(formation), out = [];
    ['GB', 'DEF', 'MIL', 'ATT'].forEach((l) => (C[l] || []).forEach(([x, y]) => {
      const hy = 50 + (y - 50) * 0.82 + 3;
      out.push(side === 'H' ? { x, y: hy, line: l } : { x: 100 - x, y: 100 - hy, line: l });
    }));
    return out;
  },

  engineCfg(opp, xi, oxi, obench) {
    const s = this.state, S = this.styles(), st = S[opp.style] || S.equilibre;
    const coordsFrom = (form) => { const C = this.formCoords(form), out = []; ['GB', 'DEF', 'MIL', 'ATT'].forEach((l) => (C[l] || []).forEach(([fx, fy]) => out.push({ fx, fy, line: l }))); return out; };
    const statsOf = (p) => { const o = {}; this.cardStats(p).forEach((q) => { o[q.l] = Math.max(25, q.v - Math.round((p.pen || 0) * 0.6)); }); return o; };
    // §24 : l'avantage tactique préparé (plan, séance vidéo) s'ajoute pour UN match,
    // puis disparaît. C'est ce qui donne du poids à la préparation.
    const adv = (s.preset === 'perso' ? 0 : this.matchup(s.preset, opp.style)) + (s.nextAdv || 0);
    const syn = this.synergy(xi);
    const coh = Math.min(1.2, Math.max(0.7, 1 - xi.filter((p) => p.pen).length * 0.06 - (s.preset === 'perso' ? 0.04 : 0) - xi.filter((p) => p.fresh).length * 0.03 + (s.cohBonus || 0) + syn.score));
    const H = { club: 'FC TonPseudo', sbonus: this.staffLv('adjoint') * 0.8, coach: this.COACHES().find((c) => c.id === (s.coach || 'tacticien')), coh, tac: s.tac, ment: s.mentality, adv, coords: coordsFrom(s.formation), home: true, players: xi.map((p) => ({ name: p.name, ovr: p.ovr, st: statsOf(p), energy: p.energy, form: p.form != null ? p.form : 70, morale: p.morale != null ? p.morale : 72, skills: this.skillsOf(p), foot: this.profile(p).foot, wf: this.profile(p).wf, role: s.roles[p.slot] || this.ROLE_OPTS(p.line, p.slot, s.formation)[0], duty: s.duties[p.slot] || 'Soutien' })) };
    const A = { club: opp.club, tac: st.tac, ment: st.m, adv: -adv, coords: coordsFrom(st.form), players: oxi.map((p) => ({ name: p.name, ovr: p.ovr, st: statsOf(p), skills: this.skillsOf(p), foot: this.profile(p).foot, wf: this.profile(p).wf })), bench: (obench || []).map((p) => ({ name: p.name, ovr: p.ovr, st: statsOf(p) })) };
    return { sides: { H, A } };
  }
};
