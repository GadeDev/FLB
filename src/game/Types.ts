// src/game/Types.ts
// Football Line Break (FLB) - shared types for game logic / renderer / loader

// -----------------------------
// Basic primitives
// -----------------------------
export type Vec2Like = { x: number; y: number };

// -----------------------------
// IDs
// -----------------------------
export type PlayerId = 'P1' | 'P2' | 'P3' | 'P4';
export type DefenderId = 'D1' | 'D2' | 'D3' | 'D4' | 'D5';

// -----------------------------
// Tactics / Rules
// -----------------------------
export type Tactic = 'HIGH_LINE' | 'MID_BLOCK' | 'MAN_MARK';

export type Timing = 'EARLY' | 'LATE';

// -----------------------------
// Level file (levels.json)
// -----------------------------
export type LevelDefender = {
  id: DefenderId;
  x: number;
  y: number;

  /**
   * Optional per-defender radius override (logic units).
   * If omitted, simulator should use global config dfInterceptRadius.
   */
  interceptRadius?: number;

  /**
   * Optional per-defender speed override (logic units / sec).
   * If omitted, simulator should use global config dfSpeed.
   */
  speed?: number;
};

export type LevelGK = {
  x: number;
  y: number;

  /**
   * Optional per-level GK catch radius override.
   */
  catchRadius?: number;

  /**
   * Optional per-level GK speed override.
   */
  speed?: number;
};

export type LevelData = {
  id: string;
  label: string;
  seed: number;

  tactic: Tactic;

  defenders: LevelDefender[];
  gk: LevelGK;

  /**
   * MAN_MARK only:
   * which player is targeted by the marker defender
   */
  markTarget?: PlayerId;

  /**
   * MAN_MARK only:
   * which defender is the marker
   */
  markerId?: DefenderId;

  /**
   * Optional sweeper GK trigger (if your logic supports it)
   * Example: if first pass end Y > threshold, GK moves to target point.
   */
  sweeperGK?: {
    enabled: boolean;
    triggerY: number; // if first pass end y > triggerY => activate
    target: Vec2Like; // GK moves toward this point
  };
};

export type LevelsFile = {
  version: number;
  levels: LevelData[];
};

// -----------------------------
// Runtime entities
// -----------------------------
export type PlayerRole = 'PASSER' | 'RUNNER' | 'DECOY' | 'FREE';

export type PlayerState = {
  id: PlayerId;
  role: PlayerRole;
  pos: Vec2Like;
  vel: Vec2Like;

  // Used for planning phase (drag placement restrictions etc.)
  isSelected?: boolean;

  // For RUNNER timing
  runTiming?: Timing;
};

export type DefenderState = {
  id: DefenderId;
  pos: Vec2Like;
  vel: Vec2Like;

  interceptRadius: number;
  speed: number;
};

export type GKState = {
  pos: Vec2Like;
  vel: Vec2Like;

  catchRadius: number;
  speed: number;
};

export type BallState = {
  pos: Vec2Like;
  prevPos: Vec2Like;

  // unit/sec
  speed: number;

  // planning/sim
  isMoving: boolean;
};

// -----------------------------
// Pass plan (player input)
// -----------------------------
export type FirstPassTarget = Exclude<PlayerId, 'P1'>; // P2 / P3 / P4

export type PassPlan = {
  /**
   * First pass is always from P1 to one of (P2/P3/P4).
   */
  first: {
    from: 'P1';
    to: FirstPassTarget;
  };

  /**
   * Second pass is fixed: receiver -> goal center (shoot line).
   * Keep it explicit so the simulator doesn't infer.
   */
  second: {
    from: FirstPassTarget;
    to: 'GOAL';
  };

  /**
   * Runner timing for P2 only.
   */
  timing: Timing;
};

// -----------------------------
// Simulation phases / results
// -----------------------------
export type GamePhase = 'PLANNING' | 'SIMULATING' | 'RESULT';

export type FailReason =
  | 'OFFSIDE'
  | 'INTERCEPT'
  | 'GK_CATCH'
  | 'MISS';

export type SimOutcome =
  | { type: 'GOAL' }
  | { type: 'FAIL'; reason: FailReason };

export type JudgeEvent =
  | { type: 'OFFSIDE'; receiver: PlayerId; offsideLineY: number }
  | { type: 'INTERCEPT'; by: DefenderId }
  | { type: 'GK_CATCH' }
  | { type: 'MISS' }
  | { type: 'GOAL' };

// -----------------------------
// Config (shared constants)
// -----------------------------
export type GameConfig = {
  // sizes
  playerRadius: number;
  ballRadius: number;

  // speeds
  playerSpeed: number; // runner move speed
  ballSpeed: number;
  dfSpeed: number;
  gkSpeed: number;

  // radii
  dfInterceptRadius: number;
  gkCatchRadius: number;

  // physics tick
  dt: number; // e.g. 1 / 60

  // field / goal in logic coordinates
  field: {
    width: number;   // e.g. 1000
    height: number;  // e.g. 700
  };

  goal: {
    y: number;        // goal line y (top edge), e.g. 700
    xMin: number;     // e.g. 400
    xMax: number;     // e.g. 600
    center: Vec2Like; // e.g. { x: 500, y: 700 }
  };

  // placement constraints (planning)
  placement: {
    p1Rect: { minX: number; maxX: number; minY: number; maxY: number };
    p23Rect: { minX: number; maxX: number; minY: number; maxY: number };
    // P4 uses same as P2/P3 by default
  };

  // optional snap radius for selecting pass receiver by drag end
  receiverSnapRadius: number;

  // optional: High Line trap shift
  highLineShiftY: number; // negative means shift down; positive means up
};

// -----------------------------
// Helper types for UI layer
// -----------------------------
export type PointerMode = 'MOVE' | 'PASS';

export type UIState = {
  mode: PointerMode;
  timing: Timing;
  selectedPlayer?: PlayerId;
  passTarget?: FirstPassTarget; // current chosen receiver
};
