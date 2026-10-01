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
  hireStaff(id: 'adjoint' | 'physique' | 'recruteur' | 'kine'): void;
  staffLv(id: string): number;
  staffWages(): number;
  upgradeStade(): void;
  upgradeAcademy(): void;
  engineCfg(opp: Opponent, xi: Player[], oxi: Player[], obench: Player[]): unknown;
  STAFF_DEFS(): Array<{ id: string; label: string; cost: number[]; wage: number[]; eff: string[] }>;
  STADES(): Array<{ name: string; cap: number; mult: number; cost: number }>;
  ACADEMIES(): Array<{ name: string; note: string; cost: number }>;
  COACHES(): Array<{ id: string; label: string; desc: string; [k: string]: unknown }>;
  TRAININGS(): Array<{ id: string; label: string; desc: string; [k: string]: unknown }>;
}

export interface MatchEngine {
  next(): unknown;
  finish(): void;
  step(): boolean;
  frame(): unknown;
  state(): { score: { H: number; A: number }; st: { H: SideStats; A: SideStats }; [k: string]: unknown };
  log: Array<{ m: number; text: string; k?: string; s?: 'H' | 'A'; color?: string }>;
  setHuman(i: number): void;
  human(): number | undefined;
  bestSwitch(): number;
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
