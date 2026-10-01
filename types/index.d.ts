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
  train(id: string): void;
  marketList(): Array<Player & { price: number }>;
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
  TRAININGS(): Array<{ id: string; label: string; desc: string; [k: string]: unknown }>;

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
  PACK_SLOTS(): Array<{ kind: string; w: number }>;
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
export interface Quest { id: string; kind: string; goal: number; label: string; reward: number; xp: number; tier: number; prog?: number; claimed?: boolean; }
export type PackLot =
  | { kind: 'player'; rar: string; id: number; name: string; pos: string; ovr: number; label: string; color: string; shards: number }
  | { kind: 'skill'; rar: string; skill: Skill; name: string; ovr: number; label: string; color: string; shards: number }
  | { kind: 'shards'; rar: string; id: number; name: string; ovr: number; label: string; color: string; dup: true; shards: number; pos: string };

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
