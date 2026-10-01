// LinkFoot : état de départ d'un club. Tout l'état du jeu tient dans cet objet,
// ce qui le rend sérialisable tel quel (voir save.js).
// Un joueur de l'effectif de démonstration. Son niveau découle de sa note :
// un joueur à 66 est déjà construit, un joueur à 58 débute (§6).
const P = (id, name, pos, ovr) => ({ id, name, pos, ovr, plv: Math.max(1, Math.round((ovr - 46) / 3.5)), pxp: 0 });

export function INITIAL_STATE() {
  return {
      speed: 1, view: 'home', formation: '4-3-3', balance: 1000, preset: 'equilibre', mentality: 3,
      tac: { width: 1, tempo: 1, pass: 1, behind: 0, cross: 1, dribble: 0, longshot: 0, patience: 0, line: 1, engage: 1, press: 1, trap: 0, tackle: 1, lost: 1, won: 1, gk: 0, corners: 0, freekicks: 0, mark: 0, fullbacks: 1, overload: 0, ptrap: 0, timewaste: 0 }, famFilter: null,
      roles: {}, duties: {}, lineup: {}, sel: null,
      squad: [
        P(1, 'T. Varnier', 'GB', 66), P(2, 'L. Okonkwé', 'DEF', 64), P(3, 'M. Delacroix-Sy', 'DEF', 67), P(4, 'J. Ferrandi', 'DEF', 62), P(5, 'A. Braxton', 'DEF', 65),
        P(6, 'N. Kessler', 'MIL', 68), P(7, 'Y. Mbaloula', 'MIL', 63), P(8, 'D. Arroyo-Faye', 'MIL', 66), P(9, 'S. Lindqvist', 'MIL', 61),
        P(10, 'K. Rouvière', 'ATT', 69), P(11, 'B. Adebanjo', 'ATT', 64), P(12, 'E. Castellane', 'ATT', 62), P(13, 'R. Moulinet', 'GB', 58), P(14, 'I. Tavares', 'DEF', 59)
      ],
      nextId: 100, pack: null, match: null, record: { w: 1, d: 1, l: 0 },
      // §12, §19 : l'inventaire de compétences. Une compétence obtenue dans un pack
      // arrive ici, puis s'équipe sur un joueur compatible, puis agit dans le match.
      skillInv: [], nextSkillUid: 1, collected: [], seenPlayers: [],
      // §7, §29 : l'économie encadrée. `caps` compte les gains du jour par source,
      // `ledger` garde le journal des transactions.
      shards: 0, caps: {}, ledger: [], quests: null, clubName: 'FC TonPseudo', country: 'fr', created: true,
      kit: { c1: '#2ECC71', c2: '#0C1210', pat: 'uni', collar: 'rond', sponsor: true }, showKit: false, cam: '2d',
      xp: 340, level: 7, dayStreak: 3, dayClaimed: false, winStreak: 0, showHub: false, levelUp: null, now: Date.now(), freePackAt: Date.now() + 90000, freeQueue: [],
      division: 4, seasonP: 2, lastGain: null,
      staff: { adjoint: 0, physique: 0, recruteur: 0, kine: 0 }, stade: 0, academy: 0, youth: [],
      missions: [
        { id: 'play', label: 'Joue 3 matchs', goal: 3, prog: 0, reward: 100, xp: 30, claimed: false },
        { id: 'win', label: 'Gagne 1 match', goal: 1, prog: 0, reward: 150, xp: 50, claimed: false },
        { id: 'goals', label: 'Marque 3 buts', goal: 3, prog: 0, reward: 100, xp: 40, claimed: false },
        { id: 'pack', label: 'Ouvre un pack', goal: 1, prog: 0, reward: 80, xp: 20, claimed: false },
        { id: 'counter', label: 'Joue avec un style qui contre l’adversaire', goal: 1, prog: 0, reward: 120, xp: 60, claimed: false }
      ]
    };
}
