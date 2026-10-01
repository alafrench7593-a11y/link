// LinkFoot : état du club et règles du manager. Aucune dépendance au DOM ni à React.
// Le même code que l'interface utilise, sorti de la page pour tourner dans une app ou sur un serveur.
import { makeEngine } from './engine.js';
import { INITIAL_STATE } from './state.js';

export class Club {
  constructor(state) {
    this.state = Object.assign({}, INITIAL_STATE(), state || {});
    this._listeners = [];
  }
  // --- compatibilité avec le code de l'interface : setState fusionne, buzz et later ne font rien ici
  setState(patch) {
    Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch);
    this._listeners.forEach((fn) => fn(this.state));
    return this.state;
  }
  onChange(fn) { this._listeners.push(fn); return () => { this._listeners = this._listeners.filter((f) => f !== fn); }; }
  buzz() {}
  later(fn) { return setTimeout(fn, 0); }
  makeEngine(cfg) { return makeEngine(cfg); }

  // --- un match complet, sans interface : construit le moteur, le déroule, applique les suites
  playMatch(opp, opts) {
    const s = this.state, o = opts || {};
    const xi = this.pickXI(s.formation).map((p) => Object.assign({}, p, { energy: p.fit != null ? p.fit : 100, yc: 0, red: false }));
    const styles = this.styles(), oppForm = (styles[opp.style] || {}).form || '4-4-2';
    const shapeA = this.baseShape(oppForm, 'A'), rnd = this.seedR(o.seed != null ? o.seed : Date.now() % 100000);
    const oxi = shapeA.map((b, i) => ({ id: 9000 + i, name: 'J' + i, pos: b.line, line: b.line, ovr: Math.round(opp.ovr + (rnd() - 0.5) * 8), energy: 100, yc: 0, red: false }));
    const obench = ['MIL', 'ATT', 'DEF'].map((pos, i) => ({ id: 9500 + i, name: 'B' + i, pos, ovr: Math.round(opp.ovr - 2) }));
    const E = makeEngine(Object.assign(this.engineCfg(opp, xi, oxi, obench), { rnd }));
    E.finish();
    const f = E.state();
    const hs = f.score.H, as = f.score.A;
    const res = hs > as ? 'w' : hs === as ? 'd' : 'l', reward = res === 'w' ? 120 : res === 'd' ? 50 : 20;
    const mt = { opp, oxi, bench: this.benchOf(xi), hs, as, st: f.st, rat: f.rat, res, reward, done: true, ended: true,
      log: E.log.map((l) => ({ m: l.m, text: l.text, k: l.k, s: l.s })),
      xi: f.en ? xi.map((p, i) => Object.assign({}, p, { energy: f.en[i], yc: f.cards[i][0], red: f.cards[i][1] })) : xi };
    const record = Object.assign({}, s.record, { [res]: s.record[res] + 1 });
    const base = Object.assign({}, this.state, { balance: s.balance + reward, record });
    const patch = this.afterMatch(mt, base);
    this.setState(Object.assign({ record }, patch));
    return { score: [hs, as], res, reward, stats: f.st, log: mt.log, patch };
  }
  rand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  seedR(seed) { let x = (seed * 2654435761) % 4294967296; return () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; }; }
  statW(pos) {
    return { ATT: { ATQ: 0.28, TIR: 0.2, DRI: 0.16, VIT: 0.16, PAS: 0.1, PHY: 0.08, 'DÉF': 0.02 }, MIL: { PAS: 0.26, DRI: 0.17, 'DÉF': 0.14, ATQ: 0.12, PHY: 0.11, TIR: 0.1, VIT: 0.1 }, DEF: { 'DÉF': 0.38, PHY: 0.22, VIT: 0.15, PAS: 0.12, DRI: 0.05, ATQ: 0.04, TIR: 0.04 }, GB: { 'RÉF': 0.3, PLO: 0.25, MAI: 0.2, PLA: 0.15, 'DÉG': 0.05, VIT: 0.05 } }[pos] || this.statW('MIL');
  }
  ovrOf(pos, st) { const w = this.statW(pos); let a = 0, t = 0; for (const k in w) { a += (st[k] != null ? st[k] : 50) * w[k]; t += w[k]; } return Math.round(a / t); }
  genStats(pos, target, seed) {
    const r = this.seedR(seed);
    const bias = { GB: { VIT: -14, PLO: 4, 'RÉF': 6, MAI: 2, 'DÉG': -6, PLA: 3 }, DEF: { VIT: -2, ATQ: -20, TIR: -16, PAS: -6, DRI: -8, 'DÉF': 8, PHY: 6 }, MIL: { VIT: 0, ATQ: 0, TIR: -2, PAS: 6, DRI: 4, 'DÉF': -6, PHY: -2 }, ATT: { VIT: 6, ATQ: 8, TIR: 6, PAS: -3, DRI: 5, 'DÉF': -28, PHY: -3 } }[pos] || {};
    const st = {}; for (const k in bias) st[k] = target + bias[k] + Math.round((r() - 0.5) * 12);
    for (let i = 0; i < 5; i++) { for (const k in st) st[k] = Math.max(25, Math.min(99, st[k])); const d = target - this.ovrOf(pos, st); if (!d) break; for (const k in st) st[k] += d; }
    for (const k in st) st[k] = Math.max(25, Math.min(99, st[k]));
    return st;
  }
  cardStats(p) {
    const st = p.st || this.genStats(p.pos, p.base != null ? p.base : p.ovr, p.id * 31 + 7);
    const order = p.pos === 'GB' ? ['VIT', 'PLO', 'RÉF', 'MAI', 'DÉG', 'PLA'] : ['VIT', 'ATQ', 'TIR', 'PAS', 'DRI', 'DÉF', 'PHY'];
    return order.map((l) => ({ l, v: st[l] != null ? st[l] : 50 }));
  }
  profile(p) {
    const r = this.seedR((p.id || 1) * 7919 + 13);
    const NAT = ['France', 'France', 'France', 'Sénégal', 'Maroc', 'Algérie', 'Brésil', 'Argentine', 'Espagne', 'Italie', 'Portugal', 'Belgique', 'Côte d’Ivoire', 'Cameroun', 'Nigeria', 'Pays-Bas', 'Allemagne', 'Japon', 'Norvège', 'Pologne'];
    const PERSO = ['Leader', 'Solitaire', 'Travailleur', 'Talent naturel', 'Showman', 'Compétiteur', 'Professionnel', 'Instable', 'Généreux', 'Ambitieux', 'Discret', 'Charismatique'];
    const age = p.age != null ? p.age : 17 + Math.floor(r() * 18);
    const base = p.ovr;
    const pot = p.pot != null ? p.pot : Math.min(96, base + Math.max(0, Math.round((28 - age) * 1.4 + r() * 8)));
    const perso = PERSO[Math.floor(r() * PERSO.length)];
    const foot = r() < 0.72 ? 'Droit' : r() < 0.9 ? 'Gauche' : 'Ambidextre';
    const h = 165 + Math.floor(r() * 30) + (p.pos === 'GB' ? 10 : p.pos === 'DEF' ? 4 : 0);
    const form = p.form != null ? p.form : 70, morale = p.morale != null ? p.morale : 72;
    const value = this.valueOf(Object.assign({}, p, { age, pot, form }));
    const salary = Math.round(value / 60 / 10) * 10;
    return { age, pot, perso, foot, height: h, weight: Math.round(h * 0.42 - 8 + r() * 6), nat: NAT[Math.floor(r() * NAT.length)], value, salary, contract: p.contract != null ? p.contract : 1 + Math.floor(r() * 3), form, morale, fit: p.fit != null ? p.fit : 100, inj: p.inj || 0, skills: this.skillsOf(p), hidden: !p.scouted };
  }
  valueOf(p) {
    const age = p.age != null ? p.age : this.profile(p).age, pot = p.pot != null ? p.pot : p.ovr;
    const ageK = age <= 21 ? 1.35 : age <= 25 ? 1.2 : age <= 29 ? 1 : age <= 32 ? 0.7 : 0.45;
    const formK = 0.85 + ((p.form != null ? p.form : 70) - 50) / 200;
    return Math.round(Math.pow(Math.max(40, p.ovr) / 10, 3.2) * ageK * formK * (1 + Math.max(0, pot - p.ovr) / 40) / 3) * 10;
  }
  SKILL_DEF() {
    if (this._skill) return this._skill;
    const E = [
      ['tueur', 'Tueur', 'Attaque', { sht: 6 }, 'finition sur les grosses occasions'],
      ['visionnaire', 'Visionnaire', 'Passe', { pas: 5, dec: 4 }, 'passes qui créent le danger'],
      ['laser', 'Passe laser', 'Passe', { pas: 7 }, 'précision des passes longues'],
      ['chef', 'Chef d’orchestre', 'Tactique', { dec: 6, pas: 3 }, 'contrôle du rythme'],
      ['renard', 'Renard des surfaces', 'Attaque', { sht: 4, dec: 4 }, 'déplacements dans la surface'],
      ['sprinter', 'Sprinter', 'Physique', { pace: 7 }, 'exploitation des espaces en contre'],
      ['pressing', 'Pressing fou', 'Défense', { def: 4, pace: 3, drain: 1.25 }, 'pressing plus intense, plus fatigant'],
      ['gladiateur', 'Gladiateur', 'Physique', { phy: 7 }, 'duels physiques'],
      ['calme', 'Calme absolu', 'Mental', { dec: 6, pas: 2 }, 'moins d’erreurs sous pression'],
      ['mur', 'Mur', 'Défense', { def: 8 }, 'interventions dans sa surface'],
      ['acier', 'Mental d’acier', 'Mental', { dec: 5, sht: 2 }, 'résiste à la pression des grands moments'],
      ['dribbleur', 'Funambule', 'Dribble', { dri: 7 }, 'dribbles réussis'],
      ['aerien', 'Tour de contrôle', 'Coup de pied arrêté', { phy: 5, def: 3, sht: 2 }, 'jeu de tête'],
      ['moteur', 'Moteur', 'Physique', { drain: 0.8, pace: 2 }, 'endurance, fatigue plus lente'],
      ['leader', 'Leader', 'Leadership', { team: { dec: 2 } }, 'concentration des coéquipiers'],
      ['meneur', 'Meneur', 'Collectif', { team: { pas: 2 } }, 'jeu collectif autour de lui'],
      ['grinta', 'Grinta', 'Mental', { phy: 5, def: 3, pace: 3, team: { phy: 1 } }, 'agressivité et pressing quand l’équipe est menée'],
      ['clutch', 'Clutch', 'Spécial', { sht: 5, dec: 5 }, 'dernières minutes d’un match serré'],
      ['gk_reflex', 'Réflexes félins', 'Gardien', { ref: 7 }, 'parades réflexes'],
      ['gk_mains', 'Mains sûres', 'Gardien', { han: 7 }, 'ballons captés, pas de rebond']
    ];
    const C = [
      ['always', 'en permanence', 1.0], ['trail70', 'quand l’équipe est menée après la 70e', 1.9], ['closeLate', 'dans les 15 dernières minutes d’un match serré', 1.8],
      ['leading', 'quand l’équipe mène', 1.3], ['first15', 'dans le premier quart d’heure', 1.4], ['momentum', 'pendant 6 minutes après une action décisive', 1.7],
      ['tired', 'quand son énergie passe sous 55 %', 1.5], ['home', 'à domicile', 1.25], ['counter', 'en phase de contre', 1.6], ['box', 'dans une surface de réparation', 1.5],
      ['setpiece', 'sur coup de pied arrêté', 1.6], ['pressed', 'quand l’équipe subit le pressing', 1.5], ['derby', 'contre un adversaire mieux classé', 1.4], ['second', 'en seconde période', 1.2]
    ];
    const RAR = [['commune', 'Commune', 0.55, '#B4C0BA'], ['normale', 'Normale', 0.75, '#EEF3EF'], ['rare', 'Rare', 1.0, '#7FB0FF'], ['elite', 'Élite', 1.25, '#C39BFF'], ['mythique', 'Mythique', 1.5, '#FFC24A'], ['legendaire', 'Légendaire', 1.8, '#FF6B5C']];
    const POSOK = { GB: ['gk_reflex', 'gk_mains', 'calme', 'leader', 'acier', 'moteur'], DEF: ['mur', 'gladiateur', 'aerien', 'leader', 'calme', 'moteur', 'grinta', 'pressing', 'laser', 'sprinter', 'acier'], MIL: ['visionnaire', 'laser', 'chef', 'meneur', 'moteur', 'pressing', 'dribbleur', 'calme', 'grinta', 'clutch', 'gladiateur', 'sprinter'], ATT: ['tueur', 'renard', 'sprinter', 'dribbleur', 'clutch', 'aerien', 'grinta', 'acier', 'gladiateur', 'visionnaire'] };
    return (this._skill = { E, C, RAR, POSOK, LVL: ['I', 'II', 'III', 'IV', 'V'] });
  }
  skillCount() { const D = this.SKILL_DEF(); let n = 0; for (const pos in D.POSOK) n += D.POSOK[pos].length; return n * D.C.length * D.RAR.length * D.LVL.length; }
  makeSkill(eid, cid, rar, lvl, cond) {
    const D = this.SKILL_DEF(), e = D.E.find((x) => x[0] === eid), c = D.C[cid], R2 = D.RAR[rar];
    const mult = R2[2] * (0.7 + lvl * 0.15) * c[2] * 0.55;
    const eff = {}; for (const k in e[3]) eff[k] = k === 'drain' ? e[3][k] : k === 'team' ? Object.fromEntries(Object.entries(e[3][k]).map(([a, v]) => [a, v * mult])) : e[3][k] * mult;
    const name = e[1] + (lvl ? ' ' + D.LVL[lvl] : '') + (c[0] === 'always' ? '' : ' · ' + ['', 'grinta', 'clutch', 'dominant', 'précoce', 'momentum', 'increvable', 'local', 'contre', 'surface', 'CPA', 'sous pression', 'outsider', '2e MT'][cid]);
    return { id: eid + ':' + cid + ':' + rar + ':' + lvl, eid, cid: c[0], name, cat: e[2], rar: R2[0], rarLabel: R2[1], color: R2[3], lvl: lvl + 1, eff, desc: e[4] + (c[0] === 'always' ? '' : ', ' + c[1]) + '.' };
  }
  skillsOf(p) {
    if (p.skills) return p.skills;
    const D = this.SKILL_DEF(), r = this.seedR((p.id || 1) * 104729 + 3), pool = D.POSOK[p.pos] || D.POSOK.MIL;
    const n = p.ovr >= 80 ? 3 : p.ovr >= 68 ? 2 : 1, out = [];
    for (let i = 0; i < n; i++) {
      const q = r(), rar = q < 0.42 ? 0 : q < 0.7 ? 1 : q < 0.87 ? 2 : q < 0.95 ? 3 : q < 0.99 ? 4 : 5;
      out.push(this.makeSkill(pool[Math.floor(r() * pool.length)], Math.floor(r() * D.C.length), Math.min(rar, p.ovr >= 75 ? 5 : 3), Math.min(4, Math.floor(r() * 2 + (p.ovr - 55) / 12)), null));
    }
    return out;
  }
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
      S('ailes', 'Couloirs', 'Jeu sur les ailes', '4-4-2', 4, { width: 2, cross: 2, dribble: 1, fullbacks: 1 }, 'Débordements et centres : on étire le bloc adverse sur toute la largeur.', 'Idéal avec des ailiers rapides', ['blocbas', 'bus', 'catenaccio'], ['contre', 'blocmed'], 'wide'),
      S('surcharge', 'Couloirs', 'Surcharge et renversement', '4-3-3', 4, { width: 2, pass: 1, patience: 1, overload: 1, fullbacks: 2 }, 'On attire l’adversaire d’un côté à 5 contre 3, puis on renverse vers un ailier seul de l’autre côté.', 'Très utilisé dans le foot moderne', ['homme', 'blocmed', 'catenaccio'], ['gegen', 'contre'], 'wide'),
      S('pistons', 'Couloirs', 'Pistons en 3-5-2', '3-5-2', 4, { width: 2, cross: 1, behind: 1, fullbacks: 1, line: 1 }, 'Trois défenseurs centraux et deux pistons qui font tout le couloir : largeur et solidité.', 'Système favori de nombreux entraîneurs italiens', ['blocbas', 'bus', 'kick'], ['contre', 'homme'], 'wide')
    ];
    this._styles = {};
    list.forEach((x) => { this._styles[x.k] = x; });
    this._styleList = list;
    return this._styles;
  }
  matchup(a, b) {
    const S = this.styles(), A = S[a], B = S[b];
    if (!A || !B) return 0;
    let v = (A.beats.includes(b) ? 1 : 0) - (A.weak.includes(b) ? 1 : 0) + (B.weak.includes(a) ? 1 : 0) - (B.beats.includes(a) ? 1 : 0);
    return Math.max(-2, Math.min(2, v));
  }
  levelNeed(l) { return 300 + l * 100; }
  addXp(st, gain) {
    let xp = st.xp + gain, level = st.level, bal = 0, queue = st.freeQueue.slice(), ups = [];
    while (xp >= this.levelNeed(level)) { xp -= this.levelNeed(level); level++; const pack = level % 5 === 0; bal += 100 + level * 20; if (pack) queue.push('or'); ups.push({ level, text: '+' + (100 + level * 20) + ' jetons' + (pack ? ' + Pack Or offert' : '') }); }
    return { xp, level, bonusBal: bal, freeQueue: queue, ups };
  }
  table(rec) {
    const others = [
      { user: '@Massilia13', club: 'Olympique Vieux-Port', w: 3, d: 1, l: 0 }, { user: '@Lina_psg', club: 'Auteuil United', w: 2, d: 1, l: 1 },
      { user: '@Yohan_foot', club: 'Sporting Yoyo', w: 2, d: 0, l: 2 }, { user: '@KopBleu', club: 'Kop Bleu FC', w: 1, d: 1, l: 2 }, { user: '@Nina_foot', club: 'Real Canal FC', w: 0, d: 2, l: 2 }
    ];
    return others.concat([{ user: 'Toi', club: 'FC TonPseudo', w: rec.w, d: rec.d, l: rec.l, me: true }])
      .map((c) => Object.assign({}, c, { pts: c.w * 3 + c.d, p: c.w + c.d + c.l })).sort((a, b) => b.pts - a.pts || b.w - a.w);
  }
  bumpMission(ms, id, n) { return ms.map((m) => (m.id === id && !m.claimed ? Object.assign({}, m, { prog: Math.min(m.goal, m.prog + n) }) : m)); }
  afterMatch(mt, st) {
    const res = mt.res, win = res === 'w';
    const winStreak = win ? st.winStreak + 1 : 0;
    const mult = winStreak >= 5 ? 2 : winStreak >= 3 ? 1.5 : winStreak >= 2 ? 1.2 : 1;
    const bonus = Math.round(mt.reward * (mult - 1));
    const xpGain = (win ? 100 : res === 'd' ? 50 : 25) + mt.hs * 10 + (mt.as === 0 ? 20 : 0);
    let missions = this.bumpMission(st.missions, 'play', 1);
    if (win) missions = this.bumpMission(missions, 'win', 1);
    if (mt.hs) missions = this.bumpMission(missions, 'goals', mt.hs);
    let squad = st.squad, prog = '';
    if (win || mt.hs >= 2) {
      const c = mt.xi.filter((p) => p.line !== 'GB'); let pk = c[this.rand(0, c.length - 1)]; if (mt.rat) { let bi = 0; mt.rat.H.forEach((v, k) => { if (v > mt.rat.H[bi]) bi = k; }); if (mt.xi[bi]) pk = mt.xi[bi]; }
      const cur = squad.find((p) => p.id === pk.id);
      if (cur && cur.ovr < 99) {
        const st = {}; this.cardStats(cur).forEach((q) => { st[q.l] = q.v; }); const w = this.statW(cur.pos), keys = Object.keys(w).sort((a2, b2) => w[b2] - w[a2]), gains = {};
        let ovr = this.ovrOf(cur.pos, st), guard = 0;
        while (ovr <= cur.ovr && guard++ < 20) { const k = keys[this.rand(0, 2)]; if (st[k] < 99) { st[k]++; gains[k] = (gains[k] || 0) + 1; } ovr = this.ovrOf(cur.pos, st); }
        squad = squad.map((p) => (p.id === pk.id ? Object.assign({}, p, { st, ovr: Math.max(ovr, cur.ovr) }) : p));
        prog = cur.name + ' progresse ' + cur.ovr + ' → ' + Math.max(ovr, cur.ovr) + ' (' + Object.keys(gains).map((k) => '+' + gains[k] + ' ' + k).join(', ') + ')';
      }
    }
    squad = this.applyFitness(squad, mt, null);
    const F = this.finances(st, res); const inv = Object.assign({}, st.inv || {}); if (win) { const drop = ['energie', 'motivation', 'pressing', 'bloc', 'contre', 'finition', 'up_VIT', 'up_TIR', 'up_PAS', 'up_DÉF'][this.rand(0, 9)]; inv[drop] = (inv[drop] || 0) + 1; }
    const L = this.addXp(st, xpGain);
    const patch = { winStreak, missions, squad, inv, lastFin: 'Recette ' + F.gate + ' · salaires −' + F.wages + ' · net ' + (F.net >= 0 ? '+' : '') + F.net + ' jetons', coachAdvice: null, xp: L.xp, level: L.level, freeQueue: L.freeQueue, balance: st.balance + bonus + L.bonusBal + this.finances(st, res).net,
      lastGain: '+' + xpGain + ' XP' + (bonus ? ' · série de ' + winStreak + ' victoires x' + mult + ' (+' + bonus + ' jetons)' : '') + (prog ? ' · ' + prog : '') };
    let over = L.ups.length ? { title: 'NIVEAU ' + L.level + ' !', sub: L.ups.map((u) => 'Niveau ' + u.level + ' : ' + u.text).join(' · ') } : null;
    const seasonP = st.seasonP + 1;
    if (seasonP >= 5) {
      const tbl = this.table(st.record), rank = tbl.findIndex((c) => c.me) + 1, last = tbl.length;
      // le centre de formation sort un jeune à chaque fin de saison
      const yg = this.youthPlayer(st);
      let ygTxt = '';
      if (yg) { patch.squad = (patch.squad || st.squad).concat([yg]); patch.youth = (st.youth || []).concat([yg.id]); ygTxt = ' Le centre sort ' + yg.name + ' (' + yg.pos + ' ' + yg.ovr + ', potentiel ' + yg.pot + ').'; }
      if (rank <= 2 && st.division > 1) { patch.division = st.division - 1; patch.balance += 500; patch.freeQueue = patch.freeQueue.concat(['or']); over = { title: 'PROMU EN DIVISION ' + patch.division + ' !', sub: 'Fin de saison : ' + rank + 'e. +500 jetons et un Pack Or. Les adversaires seront plus forts.' + ygTxt }; }
      else if (rank === last && st.division < 5) { patch.division = st.division + 1; over = { title: 'RELÉGUÉ EN DIVISION ' + patch.division, sub: 'Fin de saison : ' + rank + 'e sur ' + last + '. Les adversaires seront plus faibles, mais la recette du match baisse.' + ygTxt }; }
      else over = over || { title: 'FIN DE SAISON', sub: rank + 'e de la division ' + st.division + '. Termine dans les 2 premiers pour monter, évite la dernière place.' + ygTxt };
      patch.seasonP = 0; patch.record = { w: 0, d: 0, l: 0 };
    } else patch.seasonP = seasonP;
    if (over) { patch.levelUp = over; this.buzz([60, 40, 60, 40, 200]); }
    return patch;
  }
  applyFitness(squad, mt, training) {
    const played = new Set(mt ? mt.xi.map((p) => p.id) : []);
    return squad.map((p) => {
      const pr = this.profile(p); let fit = pr.fit, inj = pr.inj, form = pr.form, morale = pr.morale;
      if (mt) {
        const xp = mt.xi.find((q) => q.id === p.id);
        if (xp) {
          const rat = mt.rat && mt.rat.H[mt.xi.indexOf(xp)] || 6;
          fit = Math.min(100, Math.max(20, Math.round((xp.energy != null ? xp.energy * 0.45 + 52 : fit - 10) + this.staffLv('physique') * 5)));   // une semaine de récupération entre deux matchs
          form = Math.round(Math.max(20, Math.min(99, form * 0.75 + (rat - 6) * 12 + 18)));
          morale = Math.round(Math.max(20, Math.min(99, morale + (mt.res === 'w' ? 6 : mt.res === 'd' ? 1 : -5) + (rat >= 7.5 ? 4 : 0))));
          const risk = (0.012 + Math.max(0, 60 - (xp.energy != null ? xp.energy : 70)) / 600 + (pr.age >= 31 ? 0.01 : 0)) * (xp.red ? 0 : 1) * (1 - this.staffLv('physique') * 0.18);
          if (!inj && this.rand(0, 999) / 1000 < risk) { const base = 1 + this.rand(0, 3) + (this.rand(0, 9) === 0 ? 3 : 0); inj = Math.max(1, Math.round(base * (1 - this.staffLv('kine') * 0.2))); }
        } else { fit = Math.min(100, fit + 30 + this.staffLv('physique') * 5); morale = Math.max(20, morale - (played.size ? 2 : 0)); if (inj) inj -= 1 + (this.staffLv('kine') >= 2 && this.rand(0, 1) ? 1 : 0); if (inj < 0) inj = 0; }
      }
      if (training) { const T = training; fit = Math.max(15, Math.min(100, fit + T.fit)); form = Math.max(20, Math.min(99, form + T.form)); if (inj && T.id === 'repos') inj = Math.max(0, inj - 1); }
      return Object.assign({}, p, { age: pr.age, pot: pr.pot, fit, inj, form, morale, contract: pr.contract, skills: pr.skills });
    });
  }
  TRAININGS() {
    return [
      { id: 'repos', label: 'Repos', desc: 'Énergie +25, soigne les blessés plus vite', fit: 25, form: -2, gain: null, risk: 0 },
      { id: 'physique', label: 'Physique', desc: 'VIT et PHY progressent, énergie −10', fit: -10, form: 3, gain: ['VIT', 'PHY'], risk: 0.06 },
      { id: 'technique', label: 'Technique', desc: 'PAS et DRI progressent', fit: -6, form: 4, gain: ['PAS', 'DRI'], risk: 0.03 },
      { id: 'tir', label: 'Finition', desc: 'ATQ et TIR progressent', fit: -6, form: 4, gain: ['ATQ', 'TIR'], risk: 0.03 },
      { id: 'defense', label: 'Défense', desc: 'DÉF et PHY progressent', fit: -8, form: 3, gain: ['DÉF', 'PHY'], risk: 0.04 },
      { id: 'collectif', label: 'Collectif', desc: 'Cohésion +, forme +', fit: -5, form: 6, gain: null, risk: 0.02, coh: 0.04 }
    ];
  }
  train(id) {
    const s = this.state, T = this.TRAININGS().find((t) => t.id === id); if (!T || s.match && !s.match.done) return;
    let squad = this.applyFitness(s.squad, null, T), lines = [];
    if (T.gain) squad = squad.map((p) => {
      if (p.pos === 'GB' || p.inj || this.rand(0, 99) > 45 + (p.pot - p.ovr) * 4 * (s.coach === 'formateur' ? 2 : 1)) return p;
      const st = {}; this.cardStats(p).forEach((q) => { st[q.l] = q.v; }); const k = T.gain[this.rand(0, T.gain.length - 1)];
      if (st[k] >= 99 || p.ovr >= p.pot) return p; st[k]++; const ovr = Math.max(p.ovr, this.ovrOf(p.pos, st)); lines.push(p.name.split(' ').slice(1).join(' ') + ' +1 ' + k);
      return Object.assign({}, p, { st, ovr });
    });
    const hurt = [];
    if (T.risk) squad = squad.map((p) => { if (!p.inj && this.rand(0, 999) / 1000 < T.risk) { hurt.push(p.name); return Object.assign({}, p, { inj: 1 + this.rand(0, 2) }); } return p; });
    this.buzz(20);
    this.setState({ squad, cohBonus: Math.min(0.12, (s.cohBonus || 0) + (T.coh || 0)), trainLog: 'Séance ' + T.label + (lines.length ? ' · ' + lines.slice(0, 3).join(', ') : '') + (hurt.length ? ' · blessé : ' + hurt.join(', ') : ''), trainDone: (s.trainDone || 0) + 1 });
  }
  COACHES() {
    return [
      { id: 'tacticien', label: 'Tacticien', tactique: 88, motivation: 62, gestion: 74, dev: 66, desc: 'Bonus tactique en match, adaptation fine au score' },
      { id: 'motivateur', label: 'Motivateur', tactique: 64, motivation: 90, gestion: 80, dev: 62, desc: 'Moral et forme remontent plus vite, meilleure fin de match' },
      { id: 'defensif', label: 'Défensif', tactique: 80, motivation: 66, gestion: 72, dev: 64, desc: 'Bloc plus solide, moins de buts encaissés' },
      { id: 'offensif', label: 'Offensif', tactique: 78, motivation: 74, gestion: 66, dev: 66, desc: 'Plus d’occasions créées, défense plus exposée' },
      { id: 'formateur', label: 'Formateur', tactique: 66, motivation: 70, gestion: 70, dev: 92, desc: 'Les jeunes progressent deux fois plus vite à l’entraînement' },
      { id: 'gestionnaire', label: 'Gestionnaire', tactique: 70, motivation: 72, gestion: 92, dev: 72, desc: 'Moins de blessures, salaires mieux négociés' }
    ];
  }
  MATCH_CARDS() {
    return [
      { id: 'energie', label: 'Boost énergie', desc: '+15 % d’énergie pour tout le XI', icon: 'M13 2 3 14h7l-1 8 10-12h-7z' },
      { id: 'motivation', label: 'Motivation', desc: 'Décision et finition +, 20 minutes', icon: 'M12 2 15 8l7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z' },
      { id: 'pressing', label: 'Pressing', desc: 'Pressing haut et intense, 15 minutes', icon: 'M4 12h16M12 4l8 8-8 8' },
      { id: 'bloc', label: 'Bloc défensif', desc: 'Bloc bas, défense renforcée, 15 minutes', icon: 'M12 2 20 5v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5z' },
      { id: 'contre', label: 'Contre-attaque', desc: 'Vitesse et transitions rapides, 15 minutes', icon: 'M3 17 9 11l4 4 8-8M14 7h7v7' },
      { id: 'finition', label: 'Boost finition', desc: 'Tir +5, 15 minutes', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' }
    ];
  }
  UPGRADE_CARDS() { return [['VIT', 'Vitesse'], ['ATQ', 'Attaque'], ['TIR', 'Tir'], ['PAS', 'Passe'], ['DRI', 'Dribble'], ['DÉF', 'Défense'], ['PHY', 'Physique']]; }
  useUpgrade(pid, stat) {
    const s = this.state, key = 'up_' + stat, inv = Object.assign({}, s.inv || {}); if (!(inv[key] > 0)) return;
    const p = s.squad.find((q) => q.id === pid); if (!p) return;
    const st = {}; this.cardStats(p).forEach((q) => { st[q.l] = q.v; }); if (st[stat] == null || st[stat] >= 99) return;
    st[stat] = Math.min(99, st[stat] + 2); inv[key]--; this.buzz(30);
    this.setState({ inv, squad: s.squad.map((q) => (q.id === pid ? Object.assign({}, q, { st, ovr: Math.max(q.ovr, this.ovrOf(q.pos, st)) }) : q)) });
  }
  STAFF_DEFS() {
    return [
      { id: 'adjoint', label: 'Entraîneur adjoint', cost: [400, 900, 1800], wage: [0, 12, 26, 48], eff: ['Aucun', 'Bonus tactique +0,8 en match', 'Bonus tactique +1,6 en match', 'Bonus tactique +2,4 en match'] },
      { id: 'physique', label: 'Préparateur physique', cost: [350, 800, 1600], wage: [0, 10, 22, 42], eff: ['Aucun', 'Récupération +5, blessures −18 %', 'Récupération +10, blessures −36 %', 'Récupération +15, blessures −54 %'] },
      { id: 'recruteur', label: 'Recruteur', cost: [300, 750, 1500], wage: [0, 9, 20, 38], eff: ['Aucun', 'Marché +2 de note', 'Marché +4 de note, stats révélées', 'Marché +6 de note, stats révélées'] },
      { id: 'kine', label: 'Kinésithérapeute', cost: [320, 760, 1500], wage: [0, 9, 20, 38], eff: ['Aucun', 'Blessures −20 %', 'Blessures −40 %', 'Blessures −60 %'] }
    ];
  }
  staffLv(id) { const st = this.state.staff || {}; return st[id] || 0; }
  staffWages() { return this.STAFF_DEFS().reduce((a, d) => a + d.wage[this.staffLv(d.id)], 0); }
  hireStaff(id) {
    const s = this.state, d = this.STAFF_DEFS().find((x) => x.id === id), lv = this.staffLv(id);
    if (!d || lv >= 3) return; const cost = d.cost[lv]; if (s.balance < cost) return;
    this.buzz([25, 25, 50]);
    this.setState({ balance: s.balance - cost, staff: Object.assign({}, s.staff, { [id]: lv + 1 }), staffLog: d.label + ' niveau ' + (lv + 1) + ' recruté' });
  }
  STADES() {
    return [
      { name: 'Terrain municipal', cap: 800, mult: 1, cost: 0 },
      { name: 'Stade de quartier', cap: 2500, mult: 1.3, cost: 900 },
      { name: 'Enceinte couverte', cap: 8000, mult: 1.7, cost: 2200 },
      { name: 'Stade de division', cap: 20000, mult: 2.2, cost: 4800 },
      { name: 'Grand stade LinkFoot', cap: 45000, mult: 3, cost: 9500 }
    ];
  }
  upgradeStade() {
    const s = this.state, L = this.STADES(), lv = s.stade || 0; if (lv >= L.length - 1) return;
    const cost = L[lv + 1].cost; if (s.balance < cost) return;
    this.buzz([25, 25, 60]); this.setState({ balance: s.balance - cost, stade: lv + 1, staffLog: L[lv + 1].name + ' construit' });
  }
  ACADEMIES() {
    return [
      { name: 'Aucun centre', note: 'Pas de jeune formé', cost: 0, lo: 0, hi: 0, potLo: 0, potHi: 0 },
      { name: 'École de foot', note: '1 jeune par saison · note 48 à 56 · potentiel 68 à 78', cost: 700, lo: 48, hi: 56, potLo: 68, potHi: 78 },
      { name: 'Centre de formation', note: '1 jeune par saison · note 54 à 62 · potentiel 74 à 85', cost: 2000, lo: 54, hi: 62, potLo: 74, potHi: 85 },
      { name: 'Académie d’élite', note: '1 jeune par saison · note 58 à 66 · potentiel 80 à 92', cost: 5000, lo: 58, hi: 66, potLo: 80, potHi: 92 }
    ];
  }
  upgradeAcademy() {
    const s = this.state, A = this.ACADEMIES(), lv = s.academy || 0; if (lv >= A.length - 1) return;
    const cost = A[lv + 1].cost; if (s.balance < cost) return;
    this.buzz([25, 25, 60]); this.setState({ balance: s.balance - cost, academy: lv + 1, staffLog: A[lv + 1].name + ' ouvert' });
  }
  youthPlayer(st) {
    const A = this.ACADEMIES()[st.academy || 0]; if (!A.lo) return null;
    const r = this.seedR(st.division * 311 + st.seasonP * 97 + (st.youth || []).length * 13 + 7);
    const F = ['A.', 'B.', 'C.', 'E.', 'I.', 'K.', 'L.', 'M.', 'N.', 'R.', 'S.', 'T.', 'Y.'];
    const L = ['Baptiste', 'Covelli', 'Diarra-Noel', 'Ewane', 'Fontenay', 'Greco', 'Hadji-Lenoir', 'Istvan', 'Jourdain', 'Keita-Marsal', 'Lombardi', 'Novak', 'Oyelaran', 'Prunier', 'Sagnol-Diaz', 'Terrasse', 'Vukovic'];
    const POS = ['GB', 'DEF', 'DEF', 'MIL', 'MIL', 'MIL', 'ATT', 'ATT'];
    const bonus = st.coach === 'formateur' ? 3 : 0;
    const ovr = A.lo + Math.floor(r() * (A.hi - A.lo + 1)) + bonus;
    const pot = Math.max(ovr + 6, A.potLo + Math.floor(r() * (A.potHi - A.potLo + 1)) + bonus);
    return { id: 30000 + (st.division * 100) + Math.floor(r() * 900), name: F[Math.floor(r() * F.length)] + ' ' + L[Math.floor(r() * L.length)], pos: POS[Math.floor(r() * POS.length)], ovr, pot, age: 16 + Math.floor(r() * 4), youth: true, fresh: true, scouted: true };
  }
  synergy(xi) {
    const nat = {}, labels = [];
    xi.forEach((p) => { const n = this.profile(p).nat || '—'; nat[n] = (nat[n] || 0) + 1; });
    let sc = 0;
    Object.keys(nat).sort((a, b) => nat[b] - nat[a]).forEach((n) => { if (nat[n] >= 3) { sc += (nat[n] - 2) * 0.03; labels.push(n + ' ×' + nat[n]); } });
    const fit = xi.filter((p) => !p.pen).length; sc += (fit - 9) * 0.014;
    const form = xi.length ? xi.reduce((a, p) => a + this.profile(p).form, 0) / xi.length : 70;
    sc += (form - 70) * 0.0035;
    return { score: Math.max(-0.18, Math.min(0.3, sc)), labels };
  }
  finances(st, res) {
    const base = [0, 700, 520, 380, 260, 180][st.division] + (res === 'w' ? 60 : 0);
    const gate = Math.round(base * this.STADES()[st.stade || 0].mult);
    const wages = Math.round(st.squad.reduce((a, p) => a + this.profile(p).salary, 0) / 10 * (st.coach === 'gestionnaire' ? 0.85 : 1)) + this.staffWages();
    return { gate, wages, net: gate - wages };
  }
  marketList() {
    const s = this.state; if (s.market && s.market.week === s.seasonP + s.division * 10) return s.market.list;
    const POS = ['GB', 'DEF', 'DEF', 'MIL', 'MIL', 'ATT'], r = this.seedR(s.division * 977 + s.seasonP * 31 + 5);
    const list = []; const F = ['A.', 'B.', 'C.', 'D.', 'E.', 'G.', 'H.', 'I.', 'J.', 'K.', 'L.', 'M.', 'N.', 'O.', 'R.', 'S.', 'T.', 'V.', 'Y.', 'Z.'];
    const L = ['Marvello', 'Ducasson', 'Ebongué', 'Halvorsen', 'Quintero', 'Belkadi-Roy', 'Stranieri', 'Okafor-Lemaire', 'Vasquet', 'Nyamsi', 'Gaudrel', 'Petrakis', 'Lindau', 'Moreau-Diaby', 'Castagne-Nil', 'Rivoire', 'Takamura', 'Ferbault', 'Ansaldi', 'Kowalevski', 'Dembrel', 'Soumahé'];
    for (let i = 0; i < 6; i++) {
      const ovr = 55 + Math.floor(r() * 12) + (5 - s.division) * 3 + this.staffLv('recruteur') * 2, id = 20000 + s.division * 1000 + s.seasonP * 100 + i;
      const p = { id, name: F[Math.floor(r() * F.length)] + ' ' + L[Math.floor(r() * L.length)], pos: POS[Math.floor(r() * POS.length)], ovr };
      list.push(Object.assign(p, { scouted: this.staffLv('recruteur') >= 2, price: this.valueOf(Object.assign({}, p, this.profile(p))) }));
    }
    return list;
  }
  formCoords(f) {
    return {
      '4-3-3': { GB: [[50, 88]], DEF: [[14, 68], [38, 73], [62, 73], [86, 68]], MIL: [[26, 49], [50, 54], [74, 49]], ATT: [[20, 24], [50, 17], [80, 24]] },
      '4-4-2': { GB: [[50, 88]], DEF: [[14, 68], [38, 73], [62, 73], [86, 68]], MIL: [[12, 46], [37, 51], [63, 51], [88, 46]], ATT: [[36, 20], [64, 20]] },
      '4-2-3-1': { GB: [[50, 88]], DEF: [[14, 68], [38, 73], [62, 73], [86, 68]], MIL: [[36, 56], [64, 56], [16, 34], [50, 36], [84, 34]], ATT: [[50, 15]] },
      '3-5-2': { GB: [[50, 88]], DEF: [[25, 72], [50, 75], [75, 72]], MIL: [[9, 46], [30, 52], [50, 42], [70, 52], [91, 46]], ATT: [[36, 19], [64, 19]] },
      '5-3-2': { GB: [[50, 88]], DEF: [[8, 64], [29, 72], [50, 75], [71, 72], [92, 64]], MIL: [[26, 48], [50, 52], [74, 48]], ATT: [[36, 20], [64, 20]] }
    }[f];
  }
  penalty(pos, line) {
    if (pos === line) return 0;
    if (pos === 'GB' || line === 'GB') return 30;
    const o = { DEF: 0, MIL: 1, ATT: 2 };
    return Math.abs(o[pos] - o[line]) === 1 ? 6 : 13;
  }
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
  }
  benchOf(xi) { const ids = new Set(xi.map((p) => p.id)); return this.state.squad.filter((p) => !ids.has(p.id) && !p.inj).sort((a, b) => b.ovr - a.ovr).slice(0, 7); }
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
  }
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
  }
  baseShape(formation, side) {
    const C = this.formCoords(formation), out = [];
    ['GB', 'DEF', 'MIL', 'ATT'].forEach((l) => (C[l] || []).forEach(([x, y]) => {
      const hy = 50 + (y - 50) * 0.82 + 3;
      out.push(side === 'H' ? { x, y: hy, line: l } : { x: 100 - x, y: 100 - hy, line: l });
    }));
    return out;
  }
  engineCfg(opp, xi, oxi, obench) {
    const s = this.state, S = this.styles(), st = S[opp.style] || S.equilibre;
    const coordsFrom = (form) => { const C = this.formCoords(form), out = []; ['GB', 'DEF', 'MIL', 'ATT'].forEach((l) => (C[l] || []).forEach(([fx, fy]) => out.push({ fx, fy, line: l }))); return out; };
    const statsOf = (p) => { const o = {}; this.cardStats(p).forEach((q) => { o[q.l] = Math.max(25, q.v - Math.round((p.pen || 0) * 0.6)); }); return o; };
    const adv = s.preset === 'perso' ? 0 : this.matchup(s.preset, opp.style);
    const syn = this.synergy(xi);
    const coh = Math.min(1.2, Math.max(0.7, 1 - xi.filter((p) => p.pen).length * 0.06 - (s.preset === 'perso' ? 0.04 : 0) - xi.filter((p) => p.fresh).length * 0.03 + (s.cohBonus || 0) + syn.score));
    const H = { club: 'FC TonPseudo', sbonus: this.staffLv('adjoint') * 0.8, coach: this.COACHES().find((c) => c.id === (s.coach || 'tacticien')), coh, tac: s.tac, ment: s.mentality, adv, coords: coordsFrom(s.formation), players: xi.map((p) => ({ name: p.name, ovr: p.ovr, st: statsOf(p), energy: p.energy, form: p.form != null ? p.form : 70, morale: p.morale != null ? p.morale : 72, skills: this.skillsOf(p), role: s.roles[p.slot] || this.ROLE_OPTS(p.line, p.slot, s.formation)[0], duty: s.duties[p.slot] || 'Soutien' })) };
    const A = { club: opp.club, tac: st.tac, ment: st.m, adv: -adv, coords: coordsFrom(st.form), players: oxi.map((p) => ({ name: p.name, ovr: p.ovr, st: statsOf(p), skills: this.skillsOf(p) })), bench: (obench || []).map((p) => ({ name: p.name, ovr: p.ovr, st: statsOf(p) })) };
    return { sides: { H, A } };
  }
}
