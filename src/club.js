// LinkFoot : état du club et règles du manager. Aucune dépendance au DOM ni à React.
// Le même code que l'interface utilise, sorti de la page pour tourner dans une app ou sur un serveur.
import { makeEngine } from './engine.js';
import { INITIAL_STATE } from './state.js';
import { Players } from './players.js';
import { Skills } from './skills.js';
import { Cards } from './cards.js';
import { Staff } from './staff.js';
import { Training } from './training.js';
import { Transfer } from './transfer.js';
import { Progression } from './progression.js';
import { Tactics } from './tactics.js';
import { Tracks } from './tracks.js';
import { PlayerXP } from './playerxp.js';
import { Quests } from './quests.js';
import { Creation } from './creation.js';
import { OnlineUI } from './onlineui.js';
import { TrainPack } from './trainpack.js';
import { Packs } from './packs.js';
import { Impact } from './impact.js';
import { LeagueRules } from './league.js';
import { Division } from './division.js';
import { Direct } from './direct.js';
import { Stade3D } from './stade3d.js';
import { News } from './news.js';

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
    const ctx = this.ouvrirMatch(opp, opts);
    ctx.E.finish();
    return this.cloreMatch(ctx);
  }

  // La même chose, mais sans geler l'écran. Un match fait 54 000 pas de calcul : deux
  // secondes sur un ordinateur, dix à trente sur un téléphone. En une seule boucle,
  // l'interface est morte pendant tout ce temps et le joueur croit à un plantage.
  //
  // La suite des pas est identique à celle de playMatch, donc le match l'est aussi,
  // au chiffre près. On ne va pas plus vite : on rend la main entre deux paquets.
  // `avance(minute, horloge)` est appelée au fil de l'eau : la minute pour une jauge,
  // l'horloge pour l'affichage, parce qu'elle sait écrire « 45+2' » et pas 47'.
  playMatchAsync(opp, opts, avance) {
    // `avance` reçoit aussi le match en direct : entre deux paquets, l'écran peut
    // remplacer, crier une consigne ou jouer une carte (direct.js). Sans décision, le
    // match est celui de playMatch, au chiffre près.
    const d = this.matchEnDirect(opp, opts);
    return new Promise((resolve) => {
      const paquet = () => {
        const r = d.avancer((opts && opts.tranche) || 40);
        if (r.done) { resolve(d.terminer()); return; }
        if (avance) avance(r.minute, r.clock, d);
        setTimeout(paquet, 0);
      };
      paquet();
    });
  }

  // Tout ce qui précède le coup d'envoi.
  ouvrirMatch(opp, opts) {
    // un seul match à la fois : un second ouvert pendant le direct compterait la journée deux fois
    if (this.enDirect) throw new Error('Un match est déjà en cours');
    const s = this.state, o = opts || {}, seed = o.seed != null ? o.seed : Date.now() % 100000;
    const xi = this.pickXI(s.formation).map((p) => Object.assign({}, p, { energy: p.fit != null ? p.fit : 100, yc: 0, red: false }));
    const styles = this.styles(), oppForm = (styles[opp.style] || {}).form || '4-4-2';
    const shapeA = this.baseShape(oppForm, 'A'), rnd = this.seedR(seed);
    const oxi = shapeA.map((b, i) => ({ id: 9000 + i, name: 'J' + i, pos: b.line, line: b.line, ovr: Math.round(opp.ovr + (rnd() - 0.5) * 8), energy: 100, yc: 0, red: false }));
    const obench = ['MIL', 'ATT', 'DEF'].map((pos, i) => ({ id: 9500 + i, name: 'B' + i, pos, ovr: Math.round(opp.ovr - 2) }));
    const plan = this.matchPlan();   // figé AVANT le coup d'envoi : le plan tactique se consomme
    // §22 seul le match prévu au calendrier compte pour la division ; tout autre match
    // est un amical, décidé ici, avant le coup d'envoi, et pas à l'arrivée
    const amical = !!o.friendly || !this.estAuCalendrier(opp);
    const cfg = this.engineCfg(opp, xi, oxi, obench);
    // pour le direct : de quoi rejouer ce match à l'identique s'il est interrompu (direct.js),
    // la graine, les tirages déjà faits (la note de chaque adversaire) et le moteur tel qu'il
    // est au coup d'envoi, puisque l'effectif ou la tactique peuvent changer d'ici là
    const depart = o.depart ? { seed, tirages: oxi.length, cfg: JSON.parse(JSON.stringify(cfg)) } : null;
    const E = makeEngine(Object.assign(cfg, { rnd }));
    return { E, xi, oxi, opp, plan, amical, depart };
  }

  // Tout ce qui suit le coup de sifflet final.
  cloreMatch(ctx) {
    const { E, xi, oxi, opp, plan, amical } = ctx, s = this.state;
    // l'issue (avec les tirs au but d'un amical nul, §51) et la prime : direct.js, la
    // même règle que l'écran Mon Club ; un amical rapporte moitié moins (§22)
    const { f, hs, as, res, reward, pso } = this.issueDuMatch(E, amical);
    const logs = E.log.map((l) => (l.k === 'G' ? { m: l.m, text: l.text, k: l.k, s: l.s, by: l.by, as: l.as } : { m: l.m, text: l.text, k: l.k, s: l.s }));
    // qui a joué : le onze final puis les remplacés, avec leurs minutes
    const J = this.joueursDuMatch(xi, f, ctx.sortis, ctx.entres);
    // §19 : qui a marqué, qui a fait la passe, remplacés compris. Les quêtes et l'XP en dépendent.
    const { scorers, assisters } = this.buteursDuMatch(logs, J.xi);
    const mt = { opp, oxi, bench: this.benchOf(xi), hs, as, st: f.st, rat: J.rat || f.rat, res, reward, pso, done: true, ended: true, plan, friendly: !!amical,
      poss: f.poss, scorers, assisters, assists: assisters.length, cnt: f.cnt || {}, log: logs, xi: J.xi };
    const record = amical ? s.record : Object.assign({}, s.record, { [res]: s.record[res] + 1 });
    const base = Object.assign({}, this.state, { balance: s.balance + reward, record });
    const patch = this.afterMatch(mt, base);
    // le match est joué : il n'est plus « engagé » (direct.js)
    this.setState(Object.assign({ record, matchEngage: null }, patch));
    // poss : la vraie possession, en temps de ballon, pas en nombre de passes.
    // playVersus la renvoyait déjà ; elle manquait ici, donc rien hors de l'écran ne
    // pouvait vérifier qu'un style de possession garde effectivement le ballon.
    return { score: [hs, as], res, reward, pso: pso ? { H: pso.H, A: pso.A } : null, stats: f.st, poss: f.poss, cnt: f.cnt || {}, log: mt.log, patch,
      amical: !!amical, impact: this.impactReport(mt) };
  }
  rand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  seedR(seed) { let x = (seed * 2654435761) % 4294967296; return () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; }; }

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

  // ================= CARTES : RARETÉS, CATALOGUE, PACKS (§56 à §65) =================
  // Les taux sont centralisés ici. Changer une valeur change le jeu partout.

  // Catalogue fixe de 500 cartes : des identifiants stables, donc des doublons réels et une collection qui a du sens.

  // Tirage d'une carte selon la table de raretés d'un pack (poids multiplicatifs).

  // Probabilités réelles d'un pack, affichées au joueur (§58).

  // §71 vendre un joueur : 75 % de sa valeur, interdit si l'effectif tombe sous 12

  // §70 une saison de plus : tout le monde prend un an, les anciens déclinent, les jeunes progressent

  // §60 à §63 niveaux de carte : les fragments issus des doublons servent à faire monter une carte.
   // index = niveau visé moins 1

}

// §80 : chaque domaine vit dans son fichier et vient se mélanger ici.
Object.assign(Club.prototype, Players, Skills, Cards, Staff, Training, Transfer, Progression, Tactics, Tracks, PlayerXP, Quests, Creation, OnlineUI, TrainPack, Packs, News, Impact, LeagueRules, Division, Direct, Stade3D);
