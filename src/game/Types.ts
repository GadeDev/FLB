import { Vec2 } from '../core/Vector2';

export type Receiver = 'P2' | 'P3';
export type Tactic = 'NORMAL' | 'PASS_TO_RECEIVER';
export type EntityType = 'P1' | 'P2' | 'P3' | 'DEF' | 'BALL';

export interface Entity {
  id: string;
  type: EntityType;
  pos: Vec2;
  radius: number;
  team: 'ALLY' | 'ENEMY' | 'NEUTRAL';
}

export interface LevelData {
  id: string;
  name: string;
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  p3: { x: number; y: number };
  defenders: Array<{ x: number; y: number; r?: number }>;
  goal: { x: number; y: number; w: number; h: number };
}
