import { Vec2 } from '../core/Vector2';

export type Tactic = 'NORMAL' | 'HIGH_LINE' | 'MID_BLOCK' | 'MAN_MARK';

export type EntityType = 'ALLY' | 'ENEMY' | 'GK' | 'BALL';

export type EntityId = 'P1' | 'P2' | 'P3' | 'BALL' | 'GK' | `D${number}`;

export interface Entity {
  id: EntityId;
  type: EntityType;
  pos: Vec2;      // logic coords (origin bottom-left)
  vel: Vec2;
  radius: number; // collision radius (player/ball)
  // additional radii for judging
  interceptRadius?: number; // ENEMY
  catchRadius?: number;     // GK
}

export interface LevelData {
  id: string;
  label: string;
  seed: number;
  tactic: Tactic;
  defenders: { id: EntityId; x: number; y: number }[];
  gk: { x: number; y: number };
}

export interface LevelsFile {
  levels: Array<{
    id: string;
    tactic: Tactic;
    defenders: { id: string; x: number; y: number }[];
    gk: { x: number; y: number };
    seed?: number;
    label?: string;
  }>;
}

export interface EditStateSnapshot {
  p1: Vec2;
  p2: Vec2;
  p3: Vec2;
  receiver: 'P2' | 'P3';
}
