// Types de linkfoot-engine. Suffisants pour l'autocomplétion et le typage d'intégration ;
// l'état interne du club reste volontairement ouvert.

export interface Tactics {
  width: number; tempo: number; pass: number; behind: number; cross: number; dribble: number;
  longshot: number; patience: number; line: number; engage: number; press: number; trap: number;
  tackle: number; lost: number; won: number; gk: number; corners: number; freekicks: number;
  mark: number; fullbacks: number; overload: number; ptrap: number; timewaste: number;
}

export interface Player {
  id: number; name: string; pos: 'GB' | 'DEF' | 'MIL' | 'ATT'; ovr: number;
  st?: Record<string, number>; fit?: number; inj?: number; form?: number; morale?: number;
  pot?: number; age?: number; youth?: boolean;
  plv?: number; pxp?: number; rar?: string; gift?: boolean; scouted?: boolean;
  [k: string]: unknown;
}

export interface Opponent { club: string; ovr: number; style: string; user?: string; color?: string; friendly?: boolean; exterieur?: boolean; }

/** §22 Une division solo : ses clubs, son calendrier, ses lignes de classement et ses résultats. */
export interface DivisionState {
  saison: number; division: number; day: number;
  clubs: Array<{ id: string; club: string; color: string; style: string; ovr: number }>;
  days: Array<Array<{ home: string; away: string }>>;
  rows: Array<{ id: string; name: string; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number }>;
  results: Array<{ day: number; home: string; away: string; hs: number; as: number }>;
}
export interface DivisionRow {
  id: string; me: boolean; club: string; user: string; style: string | null; ovr: number | null;
  w: number; d: number; l: number; p: number; pts: number; gf: number; ga: number; gd: number; rank: number;
}

export interface SideStats { sh: number; on: number; xg: number; pa: number; pc: number; tk: number; off: number; cor: number; fou: number; yc: number; rc: number; }

export interface Decision { minute: number; texte: string; }
/** Une image du moteur (dix par seconde de jeu) : ce que lisent les vues 2D et 3D. */
export interface MatchFrame {
  /** temps de jeu en secondes, horloge, mi-temps */
  t: number; m: number; h: 1 | 2;
  /** x, y des 22 joueurs (code 0 à 10 : nous, 11 à 21 : l'adversaire), -9 si exclu */
  P: Float32Array;
  /** le ballon : x, y, hauteur */
  b: [number, number, number];
  /** porteur (code) ou -1, destinataire visé */
  o: number; to: number;
  /** trajectoire en cours : x0, y0, x1, y1, nature */
  fl: [number, number, number, number, string] | null;
  ev: Array<{ k: string; s?: 'H' | 'A'; c?: number; name?: string; text?: string; col?: string }> | null;
  /** joueurs au sol, coup de pied arrêté et tireur, plongeon du gardien [code, côté, avancement], score */
  fa: number[] | null; set: string | null; tk: number; dv: [number, number, number] | null; sc: [number, number];
}
/** Ce que la vue du direct montre maintenant : deux images, l'avancement entre elles, les
 *  événements des images sautées, et si l'on est entre deux actions (avance rapide). */
export interface VueDirect { A: MatchFrame | null; B?: MatchFrame; fr?: number; evs?: MatchFrame['ev']; saut?: boolean; }
/** §2 Le match en direct (src/direct.js). */
export interface MatchDirect {
  opp: Opponent; amical: boolean;
  /** §54 la météo du match : soleil, nuit, pluie ou neige */
  meteo: string;
  /** le nom court d'un joueur, pour l'écrire au-dessus de lui dans la vue */
  nomJoueur(code: number): string;
  etat(): {
    done: boolean; fini: boolean; minute?: number; clock?: string; score?: [number, number]; poss?: number; tirs?: [number, number];
    xi?: Array<Player & { slot: string; line: string; energy: number; yc: number; red: boolean; note: number }>;
    banc?: Player[]; faits?: number; max?: number; cri?: string | null;
    cartes?: Array<{ id: string; label: string; desc: string; n: number }>;
    decisions: Decision[]; fil?: Array<{ text: string; k: string; s: string }>; vitesse?: number; pause?: boolean;
    resultat?: MatchResult;
  };
  avancer(ms?: number): { done: boolean; minute: number; clock: string; pas: number };
  /** exactement n pas de moteur (un dixième de seconde de jeu chacun) */
  avancerPas(n: number): { done: boolean; minute: number; clock: string; pas: number };
  /** §22 regarder le match : les images autour de chaque action en temps réel, le reste sauté.
   *  Le match joué reste le même (le moteur calcule toujours en rapide). */
  spectacle(oui: boolean): void;
  vue(): VueDirect;
  remplacer(slot: string, playerId: number): ActionResult;
  crier(id: string): ActionResult;
  carte(id: string): ActionResult;
  /** Minutes de match par seconde réelle ; Infinity pour le résultat direct. */
  vitesse(v: number): void;
  pause(oui: boolean): void;
  ecouter(fn: (etat: ReturnType<MatchDirect['etat']>) => void): () => void;
  lancer(): Promise<MatchResult>;
  terminer(): MatchResult;
}
export interface MatchResult {
  score: [number, number];
  res: 'w' | 'd' | 'l';
  reward: number;
  stats: { H: SideStats; A: SideStats };
  log: Array<{ m: number; text: string; k?: string; s?: 'H' | 'A'; by?: string | null; as?: string | null }>;
  patch: Record<string, unknown>;
  /** §22 un amical : hors calendrier, moitié de la prime, tirs au but en cas de nul (§51). */
  amical?: boolean;
  pso?: { H: number; A: number } | null;
  poss?: number;
  /** les décisions prises depuis le banc pendant le direct */
  decisions?: Decision[];
}

export interface ClubState {
  formation: string; balance: number; preset: string; mentality: number; tac: Tactics;
  squad: Player[]; division: number; seasonP: number; record: { w: number; d: number; l: number };
  xp: number; level: number; staff: { adjoint: number; physique: number; recruteur: number; kine: number };
  stade: number; academy: number; youth: number[]; coach?: string;
  [k: string]: unknown;
}

export declare class Club {
  state: ClubState;
  constructor(state?: Partial<ClubState>);
  setState(patch: Partial<ClubState> | ((s: ClubState) => Partial<ClubState>)): ClubState;
  onChange(fn: (s: ClubState) => void): () => void;
  playMatch(opp: Opponent, opts?: { seed?: number; friendly?: boolean }): MatchResult;
  /** Le même match, par paquets : `avance` reçoit aussi le match en direct, pour décider entre deux paquets. */
  playMatchAsync(opp: Opponent, opts?: { seed?: number; friendly?: boolean; tranche?: number }, avance?: (minute: number, horloge: string, direct: MatchDirect) => void): Promise<MatchResult>;
  /** §2 Un match qu'on suit et sur lequel on décide depuis le banc. Engagé dans la sauvegarde dès le coup d'envoi. */
  matchEnDirect(opp: Opponent, opts?: { seed?: number; friendly?: boolean }): MatchDirect;
  /** Le match en direct en cours, s'il y en a un (un seul à la fois). */
  enDirect: MatchDirect | null;
  /** Rejoue à l'identique, jusqu'au bout, un match engagé puis interrompu (l'app fermée pendant le direct). */
  reprendreMatch(): (MatchResult & { repris: true; decisions: Decision[] }) | null;
  REGLES_DIRECT(): { remplacements: number };
  /** §28 le match en 3D, le même rendu dans l'écran Mon Club et dans l'app (three.js passé en T). */
  stade3d(T: unknown, o: { renderer: unknown; largeur: number; hauteur: number; maillot?: { c1?: string; c2?: string }; adverse?: string; meteo?: string; ombres?: boolean }): Vue3D;
  /** §11 le pack en 3D : il flotte, tremble, éclate dans la couleur de la meilleure rareté. */
  pack3d(T: unknown, o: { renderer: unknown; largeur: number; hauteur: number; couleur?: string; nom?: string; tirages?: number; distance?: number; halo?: boolean }): Pack3DVue;
  /** Une texture peinte en JavaScript pur (pas de <canvas> sur téléphone), en RGBA, ligne du bas d'abord. */
  facePack(o: { couleur?: string; nom?: string; tirages?: number }): ImagePeinte;
  panneauPub(): ImagePeinte;
  CRIS(): Array<{ id: 'encourager' | 'exiger' | 'resserrer' | 'calme'; label: string; effet: string }>;
  /** §2 Composition : un joueur à un poste (échange s'il était titulaire). Un blessé est refusé. */
  assignSlot(slot: string, playerId: number): ActionResult;
  compositionAuto(): ActionResult;
  candidatsPoste(slot: string): Array<{ p: Player; pen: number; eff: number; titulaire: boolean; can: boolean; why: string }>;
  pickXI(formation: string): Player[];
  benchOf(xi: Player[]): Player[];
  metrics(xi: Player[]): { ovr: number; [k: string]: number };
  profile(p: Player): Record<string, unknown>;
  synergy(xi: Player[]): { score: number; labels: string[] };
  finances(state: ClubState, res: 'w' | 'd' | 'l'): { gate: number; wages: number; net: number };
  marketList(): Array<Player & { price: number }>;
  /** §17 Transferts : la règle d'achat, une seule fois pour tous les écrans. */
  MARKET_RULES(): { maxSquad: number };
  buyInfo(m: (Player & { price: number }) | undefined): { can: boolean; why: string };
  buyPlayer(id: number): { ok: boolean; why?: string; price?: number };
  sellPlayer(id: number): { ok: boolean; why?: string; price?: number };
  /** Vendre : 60 % de la valeur ; refusé pendant un match, sous 12 joueurs, ou pour un titulaire. */
  sellInfo(p: Player | undefined): { can: boolean; why: string; price: number };
  /** §22 La division : six clubs, cinq journées, les deux premiers montent, le dernier descend. */
  DIVISION_RULES(): { clubs: number; up: number; down: number; top: number; bottom: number };
  divisionCourante(): DivisionState;
  prochainMatch(): { day: number; total: number; domicile: boolean; opp: Opponent & { id: string; ligue: true; exterieur: boolean; styleName: string } };
  /** Seul l'adversaire du calendrier compte pour le championnat ; les autres matchs sont des amicaux. */
  estAuCalendrier(opp: Opponent | undefined): boolean;
  table(lg?: DivisionState): DivisionRow[];
  /** Une phrase vraie sur la situation : qui est devant, si on le joue encore, les points en jeu. */
  situationDivision(lg?: DivisionState): string;
  resultatsDeJournee(day: number, lg?: DivisionState): Array<{ home: string; away: string; hs: number; as: number; moi: boolean }>;
  /** Fonction pure : la journée jouée (ton score + les autres matchs simulés), sans toucher à l'état. */
  journeeJouee(lg: DivisionState, buts: number, encaisses: number): { league: DivisionState; over: boolean; table: DivisionRow[] };
  resultatRapide(home: { ovr: number; style: string }, away: { ovr: number; style: string }, graine: number): { hs: number; as: number };
  /** §17 Tactique : formations, consignes et styles, réglés par le module. */
  FORMATIONS(): string[];
  TAC_GROUPS(): Array<{ title: string; color: string; items: Array<[string, string, string[]]> }>;
  setFormation(f: string): ActionResult;
  applyStyle(key: string, opts?: { formation?: boolean }): ActionResult;
  setMentality(level: number): ActionResult;
  setConsigne(key: string, value: number): ActionResult;
  hireStaff(id: 'adjoint' | 'physique' | 'recruteur' | 'kine'): ActionResult;
  staffLv(id: string): number;
  staffWages(): number;
  upgradeStade(): ActionResult;
  upgradeAcademy(): ActionResult;
  engineCfg(opp: Opponent, xi: Player[], oxi: Player[], obench: Player[]): unknown;
  STAFF_DEFS(): Array<{ id: string; label: string; cost: number[]; wage: number[]; eff: string[] }>;
  STADES(): Array<{ name: string; cap: number; mult: number; cost: number }>;
  ACADEMIES(): Array<{ name: string; note: string; cost: number }>;
  COACHES(): Array<{ id: string; label: string; desc: string; [k: string]: unknown }>;

  // Directeur sportif : compétences, niveaux de joueur, quêtes, économie, création.
  SKILL_DEF(): { E: unknown[]; C: unknown[]; POSOK: Record<string, string[]>; LVL: string[] };
  skillCount(): number;
  GRADES(): number;
  rawPower(eid: string, cid: number, lvl: number, grade: number): number;
  skillPower(eid: string, cid: number, lvl: number, grade: number): number;
  SKILL_INDEX(): Record<string, Array<[string, number, number, number, number]>>;
  makeSkill(eid: string, cid: number, lvl: number, grade: number): Skill;
  rollSkill(rarityId: string, rnd?: () => number): Skill;
  innateSkills(p: Player): Skill[];
  skillsOf(p: Player): Skill[];
  skillReq(eid: string, lvl: number, grade: number, power?: number): SkillReq;
  canEquip(p: Player, sk: Skill): { ok: boolean; why: string };
  skillSlots(p: Player): number;
  equippedOn(playerId: number): Skill[];
  equipSkill(uid: number, playerId: number): ActionResult;
  unequipSkill(uid: number): ActionResult;
  skillInventory(): Array<Skill & { onName: string | null; fitCount: number; miss: string; reqLine: string }>;
  reqLine(sk: Skill): string;

  playerXpNeed(level: number): number;
  playerLevel(p: Player): number;
  playerXp(p: Player): number;
  playerProgress(p: Player): { lvl: number; xp: number; need: number; pct: number; slots: number; worn: number };
  hiddenOf(p: Player): HiddenAttrs;
  hiddenMods(p: Player, ctx?: { strongerOpp?: boolean; closeLate?: boolean; outOfPos?: boolean }): Record<string, number>;
  matchXp(p: Player, stat: { min?: number; goals?: number; assists?: number; rating?: number }): number;
  addPlayerXp(p: Player, gain: number): { plv: number; pxp: number; st: Record<string, number>; ovr: number; ups: unknown[] };
  grantPlayerXp(id: number, gain: number, why?: string): ActionResult;
  SHARD_XP(): { cost: number; xp: number; perDay: number };
  SESSION_RULES(): { freePerDay: number; max: number };
  sessions(): number;
  takeSession(): boolean;
  addSessions(n: number): number;
  trainInfo(): { sessions: number; max: number; freePerDay: number; can: boolean; why: string; line: string };
  TRAIN_LOTS(): TrainLot[];
  trainingOptions(): Array<{ id: string; label: string; desc: string; cost: string; kind: 'squad' | 'card'; stat?: string; n?: number; can: boolean; why: string }>;
  COACH_ITEMS(): CoachItem[];
  meetings(): Array<CoachItem & { n: number; can: boolean; why: string }>;
  holdMeeting(id: string): { ok: boolean; why?: string; text?: string };
  plansLeft(): number;
  usePlan(styleKey: string): { ok: boolean; why?: string; style?: string };
  styleList(): Array<{ k: string; name: string; [key: string]: unknown }>;
  NEWS_SECTIONS(): Array<{ id: string; label: string }>;
  buildNews(feed: unknown): NewsItem[];
  newsBySection(feed: unknown): Array<{ id: string; label: string; items: NewsItem[]; empty: boolean }>;
  onlineSlides(feed: unknown): Array<{ id: string; label: string; sub: string; empty: boolean; emptyWhy: string }>;
  demoFeed(): Record<string, unknown>;
  UPGRADE_CARDS(): Array<[string, string]>;
  useUpgrade(playerId: number, stat: string): { ok: boolean; why?: string; ovr?: number };
  TRAININGS(): Array<{ id: string; label: string; desc: string; [k: string]: unknown }>;
  train(id: string): { ok: boolean; why?: string; gains?: string[]; hurt?: string[] };
  shardTrainInfo(p: Player): { cost: number; xp: number; used: number; perDay: number; can: boolean; why: string };
  shardTrain(id: number): ActionResult;

  CAPS(): Record<string, number | null>;
  earn(amount: number, source: string, label?: string): { given: number; asked: number; capped: string[] | null };
  spend(amount: number, label?: string): ActionResult;
  logMoney(amount: number, label: string): Array<{ at: number; a: number; l: string }>;
  PRONO_DEFS(opp?: Opponent, xi?: Player[]): Array<{ id: string; label: string; odd: number; who?: number }>;
  MAX_STAKE(): number;
  placeProno(id: string, stake: number): { ok: boolean; why?: string; stake?: number; odd?: number };
  settlePronos(mt: unknown): { won: number; lost: number; lines: Array<{ label: string; ok: boolean; gain: number }> };
  QUEST_DEFS(): Quest[];
  activeQuests(): Quest[];
  rollQuests(level: number): Quest[];
  bumpQuest(kind: string, n?: number): Quest[];
  claimQuest(id: string): { ok: boolean; why?: string; got?: number; xp?: number };
  /** §7 Connexion et missions : leurs gains passent aussi par earn(). */
  DAILY_REWARDS(): Array<number | string>;
  claimDaily(): { ok: boolean; why?: string; reward?: number | string; got?: number };
  claimMission(id: string): { ok: boolean; why?: string; got?: number; capped?: string[] | null };

  CREATION_STEPS(): Array<{ id: string; label: string; hint: string }>;
  COUNTRIES(): Array<{ id: string; label: string; div: number }>;
  starterSquad(seed?: number): Player[];
  starterRare(seed?: number): Player;
  createClub(opts?: { name?: string; country?: string; kit?: unknown; seed?: number }): { ok: boolean; rare: Player; squad: Player[] };
  creationSummary(): { club: string; count: number; avg: number; pot: number; rare: unknown; line: string };

  valueOf(p: Player): number;
  valueBreakdown(p: Player): { value: number; lvl: number; rar: string; skills: number; line: string };

  // Progression : une seule échelle de raretés, un seul axe de niveaux (src/tracks.js).
  RARITY(): Rarity[];
  rarityOf(id: string): Rarity;
  rarityFor(p: Player): Rarity;
  GATES(): { card: number[]; staff: number[]; stade: number[]; academy: number[]; pack: Record<string, number> };
  gateOf(kind: 'staff' | 'stade' | 'academy', lvl: number): number;
  lockOf(need: number): { locked: boolean; need: number; why: string };
  progressBoard(): Track[];
  trackLine(t: Track): string;
  unlocksAt(level: number): string[];
  PACK_DEFS(): PackDef[];
  THE_PACK(): PackDef;
  /** §8 Les familles du pack principal et leur part, la table même du tirage. */
  PACK_SLOTS(): Array<{ kind: 'player' | 'skill' | 'objet'; w: number; label: string }>;
  /** §9 Les mêmes parts, en pourcentage, pour l'affichage avant l'ouverture. */
  packFamilies(): Array<{ kind: 'player' | 'skill' | 'objet'; label: string; pct: number }>;
  /** Ce qu'un objet fait, en quelques mots, lu dans ses propres champs. */
  objetCourt(o: PackObjet): string;
  /** Le pack unique, tel que l'écran Packs l'affiche. */
  packPrincipal(): KiosqueEntry;
  kiosque(): KiosqueEntry[];
  appliquerObjetsEntrainement(lots: PackObjet[]): { sessions: number; xp: number; cards: string[] };
  rangerObjetsCoach(lots: PackObjet[]): { plans: number; morale: number; coh: number };
  drawLot(rnd?: () => number, owned?: Set<number>): PackLot;
  openPack(opts?: { free?: boolean; rnd?: () => number }): { ok: boolean; why?: string; def?: PackDef; got?: PackLot[]; shards?: number; free?: boolean };
  commitPack(res: unknown): { ok: boolean };
  cardToPlayer(c: Card): Player;
  rarityOfPower(power: number): Rarity;
  packState(def: PackDef): { locked: boolean; need: number; can: boolean; why: string };
  packByKey(key: string): PackDef;
  packName(key: string): string;
  packOdds(def: PackDef): Array<{ id: string; label: string; color: string; pct: number }>;
  drawCard(packWeights?: Record<string, number>, rnd?: () => number): Card;
  CARD_POOL(): Card[];
  collection(): { have: number; total: number };
  levelNeed(level: number): number;
}

export interface Skill {
  id: string; eid: string; cid: string; cidx: number; lvlIdx: number; grade: number;
  name: string; cat: string; rar: string; rarIdx: number; rarLabel: string; color: string;
  lvl: number; power: number; eff: Record<string, unknown>; req: SkillReq; desc: string;
  uid?: number; on?: number | null;
}
export interface SkillReq { pos: string[]; stats: Record<string, number>; lvl: number; power?: number; }
export interface HiddenAttrs {
  potReel: number; regularite: number; grandsMatchs: number; pression: number;
  progression: number; blessure: number; adaptation: number;
}
/** Le matériel d'entraînement (un objet par rareté) : séances, carte d'amélioration, stage. */
export interface TrainLot {
  id: string; rar: string; label: string; desc: string;
  sessions?: number; up?: number; squadXp?: number; stat?: string | null; stats?: string[] | null;
}

/** Le matériel de l'entraîneur (un objet par rareté) : causerie, atelier, plan tactique. */
export interface CoachItem {
  id: string; rar: string; label: string; kind: 'meeting' | 'plan'; desc: string;
  morale?: number; coh?: number; adv?: number; squadXp?: number; plans?: number;
}

export interface Quest { id: string; kind: string; goal: number; label: string; reward: number; xp: number; tier: number; prog?: number; claimed?: boolean; }
export type PackLot =
  | { kind: 'player'; rar: string; id: number; name: string; pos: string; ovr: number; label: string; color: string; shards: number }
  | { kind: 'skill'; rar: string; skill: Skill; name: string; ovr: number; label: string; color: string; shards: number }
  | { kind: 'shards'; rar: string; id: number; name: string; ovr: number; label: string; color: string; dup: true; shards: number; pos: string }
  | { kind: 'objet'; rar: string; name: string; label: string; color: string; shards: number; objet: PackObjet };

/** Un objet sorti d'un pack : séance, carte d'amélioration, stage, causerie, plan… */
export interface PackObjet {
  id: string; rar: string; label: string; desc: string; famille?: 'entrainement' | 'tactique'; kind?: string;
  sessions?: number; up?: number; stat?: string | null; stats?: string[] | null; squadXp?: number;
  morale?: number; coh?: number; adv?: number; plans?: number;
}

/** Le pack unique tel que l'écran l'affiche (principal: true). */
export interface KiosqueEntry {
  key: string; name: string; family: string; question: string; principal: boolean;
  n: number; cost: number; color: string; content?: string; desc: string;
  can: boolean; why: string; locked: boolean; useView: string; useLabel: string; got: string;
  kind: 'rarete' | 'lots'; odds: Array<{ label: string; pct: number; color: string; rarLabel?: string; desc?: string }>;
  familles: Array<{ kind: string; label: string; pct: number }> | null;
}

/** Le résultat commun à toutes les actions qui peuvent refuser : la raison est toujours dite. */
export interface ActionResult { ok: boolean; why?: string; lvl?: number; }

export interface ImagePeinte { data: Uint8Array; largeur: number; hauteur: number; }
export interface Vue3D {
  scene: unknown; camera: unknown;
  /** dessine l'instant entre deux images du moteur (fr de 0 à 1) ; evs : événements des images sautées */
  image(A: MatchFrame | null, B?: MatchFrame, fr?: number, evs?: MatchFrame['ev']): void;
  taille(largeur: number, hauteur: number): void;
  /** où se trouve un joueur à l'écran, en pixels du rendu */
  projeter(code: number): { x: number; y: number } | null;
  detruire(): void;
}
export interface Pack3DVue {
  secouer(force?: number): void;
  /** l'éclat, dans une couleur (#RRGGBB ou dégradé CSS : la première teinte compte) */
  ouvrir(couleur?: string): void;
  /** un pack neuf prend la place de celui qu'on vient d'ouvrir */
  nouveau(): void;
  image(dt: number): void;
  taille(largeur: number, hauteur: number): void;
  detruire(): void;
}

export interface Rarity { id: string; label: string; rate: number; lo: number; hi: number; pw: [number, number]; shards: number; tint: string; color: string; ink: string; }
export interface Card { id: number; name: string; pos: string; ovr: number; rar: string; }
export interface PackDef { key: string; name: string; n: number; cost: number; req: number; w: Record<string, number>; color: string; fx: string; content?: string; }

/** Une ligne du tableau de progression : la même forme pour toutes les pistes. */
export interface Track {
  key: string; label: string; lvl: number; max: number; pct: number;
  nextLabel: string | null; cost: number; currency: 'xp' | 'rang' | 'tokens' | 'shards' | 'cartes';
  locked: boolean; can: boolean; why: string; [k: string]: unknown;
}

export interface MatchEngine {
  next(): unknown;
  finish(): void;
  /** n pas de calcul rapide (un dixième de seconde de jeu chacun) */
  runTicks(n: number): { done: boolean; minute: number; clock: string; pas: number };
  /** garder les n dernières images même en calcul rapide (sans changer le match) */
  capture(n: number): void;
  images(): MatchFrame[];
  step(): boolean;
  frame(): unknown;
  state(): { score: { H: number; A: number }; st: { H: SideStats; A: SideStats }; [k: string]: unknown };
  log: Array<{ m: number; text: string; k?: string; s?: 'H' | 'A'; color?: string }>;
  setLive(v: boolean): void;
  sub(side: 'H' | 'A', i: number, player: Player): void;
  shout(k: string): void;
  card(kind: string): boolean;
}

export declare function makeEngine(cfg: unknown): MatchEngine;
export declare function INITIAL_STATE(): ClubState;

export interface SavePayload { v: number; at: string; state: Partial<ClubState>; }
export declare const SAVE_VERSION: number;
export declare function serialize(club: Club | { state: ClubState }): SavePayload;
export declare function deserialize(data: SavePayload | null): Partial<ClubState> | null;

export interface Store {
  load(): Promise<SavePayload | null>;
  save(payload: SavePayload): Promise<unknown>;
  clear(): Promise<unknown>;
}
export declare class MemoryStore implements Store { load(): Promise<SavePayload | null>; save(p: SavePayload): Promise<void>; clear(): Promise<void>; }
export declare class LocalStore implements Store { constructor(key?: string); load(): Promise<SavePayload | null>; save(p: SavePayload): Promise<boolean>; clear(): Promise<void>; }
export declare class HttpStore implements Store {
  constructor(opts: { url: string; headers?: Record<string, string>; fetch?: typeof fetch });
  load(): Promise<SavePayload | null>; save(p: SavePayload): Promise<boolean>; clear(): Promise<void>;
}
export declare class SaveManager {
  constructor(club: Club, store: Store, opts?: { delay?: number; onError?: (e: Error) => void });
  lastSavedAt: number | null;
  load(): Promise<boolean>;
  save(): Promise<boolean>;
  start(): this;
  stop(): this;
}


// ---------- jouer contre de vraies personnes (§26, §29) ----------

/** L'instantané d'équipe envoyé au serveur : l'équipe, rien d'autre. */
export interface TeamSnapshot {
  club: string; division: number; level: number; ovr: number;
  formation: string; preset: string; tac: Record<string, number>; mentality: number;
  coach: string | null; staffAdjoint: number; cohBonus: number;
  roles: Record<string, string>; duties: Record<string, string>;
  xi: Array<Record<string, unknown>>; bench: Array<Record<string, unknown>>;
}

export interface VersusResult {
  seed: number; home: string; away: string;
  score: [number, number];
  pso: { H: number; A: number; kicks: unknown[] } | null;
  res: 'h' | 'a' | 'd';
  st: Record<string, SideStats>; rat: Record<string, number[]>; poss: number;
  log: Array<{ m: number; text: string; k?: string; s?: 'H' | 'A' }>;
}

export declare function teamSnapshot(club: Club): TeamSnapshot;
export declare function versusCfg(home: TeamSnapshot, away: TeamSnapshot, seed: number): unknown;
export declare function playVersus(home: TeamSnapshot, away: TeamSnapshot, seed: number, opts?: { shootout?: boolean }): VersusResult;
export declare function verifyResult(home: TeamSnapshot, away: TeamSnapshot, seed: number, claimed: [number, number]): { ok: boolean; real: [number, number]; claimed: [number, number] | null };

export interface OnlineReply { ok: boolean; status?: number; why?: string; [k: string]: unknown; }

export declare class OnlineClient {
  constructor(opts: { url: string; headers?: Record<string, string>; fetch?: typeof fetch; onError?: (e: unknown) => void });
  call(method: string, path: string, body?: unknown): Promise<OnlineReply>;
  publishTeam(club: Club): Promise<OnlineReply>;
  team(id: string): Promise<OnlineReply>;
  versus(id: string): Promise<OnlineReply>;
  openPack(free?: boolean): Promise<OnlineReply>;
  balance(): Promise<OnlineReply>;
  ladder(): Promise<OnlineReply>;
  wallet(): Promise<OnlineReply>;
  createLeague(name: string, rounds?: number): Promise<OnlineReply>;
  joinLeague(code: string): Promise<OnlineReply>;
  startLeague(id: string): Promise<OnlineReply>;
  playLeagueDay(id: string): Promise<OnlineReply>;
  league(id: string): Promise<OnlineReply>;
  myLeagues(): Promise<OnlineReply>;
  challenge(to: string, msg?: string): Promise<OnlineReply>;
  myChallenges(): Promise<OnlineReply>;
  acceptChallenge(id: string): Promise<OnlineReply>;
  createTournament(opts: unknown): Promise<OnlineReply>;
  playTournament(id: string): Promise<OnlineReply>;
  tournament(id: string): Promise<OnlineReply>;
}

export declare function connectOnline(club: Club, online: OnlineClient): Club;

/** Un article du journal, construit depuis un vrai résultat. */
export interface NewsItem { section: string; kind: string; at: number; title: string; sub: string; body: string; ago: string; }
