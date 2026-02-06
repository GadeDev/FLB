export const C = {
  W: 1000,
  H: 700,
  FPS: 60,
  DT: 1 / 60,
  
  // Coordinates
  GOAL_Y: 700,
  GOAL_MIN_X: 400,
  GOAL_MAX_X: 600,
  CENTER: { x: 500, y: 700 }, // Target for 2nd pass

  // Physics
  PLAYER_R: 16,
  PLAYER_SPD: 220,
  BALL_R: 8,
  BALL_SPD: 520,
  GK_CATCH_R: 34,
  GK_SPD: 260,
  DF_INTERCEPT_R: 26,
  DF_SPD: 200,

  // Timing
  TIME_EARLY: 0.10,
  TIME_LATE: 0.35,

  // Colors
  COLOR_BG: '#0a0e17',
  COLOR_FIELD: '#111827',
  COLOR_LINE: '#1f2937',
  COLOR_P_ALLY: '#00f2ff', // Cyan
  COLOR_P_ENEMY: '#ff0055', // Magenta
  COLOR_BALL: '#ffffff',
  COLOR_ACCENT: '#00ff9d',
};

// Seeded Random for determinism
export class RNG {
  private seed: number;
  constructor(seed: number) { this.seed = seed; }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}
