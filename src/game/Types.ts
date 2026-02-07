import { Vec2 } from '../core/Vector2';

export type Receiver = 'P2' | 'P3';
// 戦術を具体的に定義（未使用エラーを防ぐため、実際に使う値にする）
export type Tactic = 'MAN_MARK' | 'ZONAL';

export type EntityType = 'P1' | 'P2' | 'P3' | 'DEF' | 'GK' | 'BALL';

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
  gk?: { x: number; y: number };
  defenders: Array<{ x: number; y: number; r?: number }>;
  goal: { x: number; y: number; w: number; h: number };
}
