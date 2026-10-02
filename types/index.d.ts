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

export interface Opponent { club: string; ovr: number; style: string; user?: string; color?: string; }

export interface SideStats { sh: number; on: number; xg: number; pa: number; pc: number; tk: number; off: number; cor: number; fou: number; yc: number; rc: number; }

export interface MatchResult {
  score: [number, number];
  res: 'w' | 'd' | 'l';
  reward: number;
  stats: { H: SideStats; A: SideStats };
  log: Array<{ m: number; text: string; k?: string; s?: 'H' | 'A' }>;
  patch: Record<string, unknown>;
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
  playMatch(opp: Opponent, opts?: { seed?: number }): MatchResult;
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
  TRAIN_PACK(): PackDef;
  TRAIN_LOTS(): TrainLot[];
  trainPackOdds(): Array<{ id: string; label: string; rarLabel: string; color: string; pct: number; desc: string }>;
  drawTrainLot(rnd?: () => number): TrainLot;
  openTrainPack(opts?: { free?: boolean; rnd?: () => number }): { ok: boolean; why?: string; def?: PackDef; got?: TrainLot[]; free?: boolean };
  commitTrainPack(res: unknown): { ok: boolean; sessions?: number; xp?: number; cards?: string[] };
  trainPackState(): { can: boolean; why: string; cost: number };
  trainingOptions(): Array<{ id: string; label: string; desc: string; cost: string; kind: 'squad' | 'card'; stat?: string; n?: number; can: boolean; why: string }>;
  PACK_REGISTRY(): Array<PackDef & { family: string; question: string; view: string }>;
  SKILL_PACK(): PackDef;
  skillPackOdds(): Array<{ id: string; label: string; color: string; pct: number }>;
  skillPackState(): { can: boolean; why: string; cost: number };
  openSkillPack(opts?: { free?: boolean; rnd?: () => number }): { ok: boolean; why?: string; def?: PackDef; got?: unknown[]; free?: boolean };
  commitSkillPack(res: unknown): { ok: boolean; added?: number };
  COACH_PACK(): PackDef;
  COACH_ITEMS(): CoachItem[];
  coachPackOdds(): Array<{ id: string; label: string; rarLabel: string; color: string; pct: number; desc: string }>;
  coachPackState(): { can: boolean; why: string; cost: number };
  openCoachPack(opts?: { free?: boolean; rnd?: () => number }): { ok: boolean; why?: string; def?: PackDef; got?: CoachItem[]; free?: boolean };
  commitCoachPack(res: unknown): { ok: boolean; added?: string[] };
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
  /** Le pack principal tel que le kiosque l'affiche. */
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
/** Un lot du Pack Entraînement : des séances, une carte d'amélioration, ou un stage. */
export interface TrainLot {
  id: string; rar: string; rate: number; label: string; desc: string;
  sessions?: number; up?: number; squadXp?: number; stat?: string | null; stats?: string[] | null;
}

/** Un objet du Pack Entraîneur : une causerie, un atelier, un plan tactique. */
export interface CoachItem {
  id: string; rar: string; rate: number; label: string; kind: 'meeting' | 'plan'; desc: string;
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

/** Une entrée du kiosque : le pack principal (principal: true) ou un pack ciblé. */
export interface KiosqueEntry {
  key: string; name: string; family: string; question: string; principal: boolean;
  n: number; cost: number; color: string; content?: string; desc: string;
  can: boolean; why: string; locked: boolean; useView: string; useLabel: string; got: string;
  kind: 'rarete' | 'lots'; odds: Array<{ label: string; pct: number; color: string; rarLabel?: string; desc?: string }>;
  familles: Array<{ kind: string; label: string; pct: number }> | null;
}

/** Le résultat commun à toutes les actions qui peuvent refuser : la raison est toujours dite. */
export interface ActionResult { ok: boolean; why?: string; lvl?: number; }

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
