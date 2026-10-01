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
    const logs = E.log.map((l) => ({ m: l.m, text: l.text, k: l.k, s: l.s }));
    // §19 : qui a marqué, qui a fait la passe. Les quêtes et l'XP des joueurs en dépendent.
    const scorers = [], assisters = [];
    logs.filter((l) => l.k === 'G' && l.s === 'H').forEach((l) => {
      xi.forEach((p) => {
        if (l.text.indexOf('BUT ! ' + p.name) >= 0) scorers.push(p.id);
        else if (l.text.indexOf('servi par ' + p.name) >= 0 || l.text.indexOf('sur un centre de ' + p.name) >= 0) assisters.push(p.id);
      });
    });
    const mt = { opp, oxi, bench: this.benchOf(xi), hs, as, st: f.st, rat: f.rat, res, reward, done: true, ended: true,
      poss: f.poss, scorers, assisters, assists: assisters.length, cnt: f.cnt || {}, log: logs,
      xi: f.en ? xi.map((p, i) => Object.assign({}, p, { energy: f.en[i], yc: f.cards[i][0], red: f.cards[i][1] })) : xi };
    const record = Object.assign({}, s.record, { [res]: s.record[res] + 1 });
    const base = Object.assign({}, this.state, { balance: s.balance + reward, record });
    const patch = this.afterMatch(mt, base);
    this.setState(Object.assign({ record }, patch));
    return { score: [hs, as], res, reward, stats: f.st, cnt: f.cnt || {}, log: mt.log, patch };
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
Object.assign(Club.prototype, Players, Skills, Cards, Staff, Training, Transfer, Progression, Tactics, Tracks, PlayerXP, Quests, Creation, OnlineUI, TrainPack, Packs);
