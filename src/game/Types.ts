import { Vec2 } from '../core/Vector2';

export type Receiver = 'P2' | 'P3';
export type Mode = 'EDIT' | 'SIM' | 'RESULT';
export type Tactic = 'NORMAL' | 'PASS_TO_RECEIVER';

export type EntityType = 'P1' | 'P2' | 'P3' | 'DEF' | 'BALL';

export interface Entity {
  id: string;
  type: EntityType;         // ★重要：Renderer/Simulatorが参照
  pos: Vec2;                // ★Vec2 class
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

export interface EditStateSnapshot {
  p1: Vec2;
  p2: Vec2;
  p3: Vec2;
  receiver: Receiver;
}

export interface SimStateSnapshot {
  entities: Entity[];
  ball: Vec2;
  receiver: Receiver;
  tactic: Tactic;
}

export interface ResultStateSnapshot {
  cleared: boolean;
  reason: 'GOAL' | 'INTERCEPT' | 'OUT' | 'NONE';
}
