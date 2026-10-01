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
  pot?: number; age?: number; youth?: boolean; [k: string]: unknown;
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

  // Progression : une seule échelle de raretés, un seul axe de niveaux (src/tracks.js).
  RARITY(): Rarity[];
  rarityOf(id: string): Rarity;
  rarityFor(p: Player): Rarity;
  GATES(): { card: number[]; staff: number[]; stade: number[]; academy: number[]; pack: Record<string, number> };
  gateOf(kind: 'card' | 'staff' | 'stade' | 'academy', lvl: number): number;
  lockOf(need: number): { locked: boolean; need: number; why: string };
  progressBoard(): Track[];
  trackLine(t: Track): string;
  unlocksAt(level: number): string[];
  PACK_DEFS(): PackDef[];
  packState(def: PackDef): { locked: boolean; need: number; can: boolean; why: string };
  packByKey(key: string): PackDef;
  packName(key: string): string;
  packOdds(def: PackDef): Array<{ id: string; label: string; color: string; pct: number }>;
  drawCard(packWeights?: Record<string, number>, rnd?: () => number): Card;
  CARD_POOL(): Card[];
  collection(): { have: number; total: number };
  cardLevel(p: Player): number;
  upgradeInfo(p: Player): { lvl: number; max: boolean; cost: number; rar: string; rarLabel: string; locked: boolean; need: number; can: boolean; why: string };
  levelUpPlayer(id: number): { ok: boolean; why?: string; lvl?: number };
  levelNeed(level: number): number;
}

/** Le résultat commun à toutes les actions qui peuvent refuser : la raison est toujours dite. */
export interface ActionResult { ok: boolean; why?: string; lvl?: number; }

export interface Rarity { id: string; label: string; rate: number; lo: number; hi: number; shards: number; tint: string; color: string; ink: string; }
export interface Card { id: number; name: string; pos: string; ovr: number; rar: string; }
export interface PackDef { key: string; name: string; n: number; cost: number; req: number; w: Record<string, number>; color: string; fx: string; }

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
