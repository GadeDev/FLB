import { Vec2 } from '../core/Vector2';
import type { Entity, LevelData, Receiver, Tactic } from './Types';

export type SimResult = 'GOAL' | 'INTERCEPT' | 'OUT' | 'OFFSIDE' | 'KEEPER_SAVE' | null;

const BALL_R = 8;
const PLAYER_R = 16;
const DEF_R = 20;
const GK_R = 18;

// フィールドサイズ（敵陣のみ）
export const PITCH_W = 360;
export const PITCH_H = 600;

const PLAYER_SPD = 220;
const BALL_PASS_SPD = 420;
const BALL_SHOOT_SPD = 750;
const KICK_DELAY = 0.25;

export class Simulator {
  entities: Entity[] = [];
  ball: Vec2 = new Vec2(0, 0);
  receiver: Receiver = 'P2';
  goal = { x: 0, y: 0, w: 0, h: 0 };
  
  result: SimResult = null;

  private time = 0;
  private phase: 'WAIT' | 'PASS' | 'SHOOT' = 'WAIT';
  private ballVel = new Vec2(0, 0);

  initFromLevel(level: LevelData, receiver: Receiver, _tactic: Tactic) {
    this.receiver = receiver;
    this.goal = level.goal;
    this.result = null;
    this.time = 0;
    this.phase = 'WAIT';
    this.ballVel = Vec2.zero;

    const mkEnt = (id: string, type: any, team: any, pos: {x:number, y:number}, r: number): Entity => ({
      id, type, team, pos: Vec2.from(pos), radius: r
    });

    this.entities = [
      mkEnt('P1', 'P1', 'ALLY', level.p1, PLAYER_R),
      mkEnt('P2', 'P2', 'ALLY', level.p2, PLAYER_R),
      mkEnt('P3', 'P3', 'ALLY', level.p3, PLAYER_R),
      ...level.defenders.map((d, i) => mkEnt(`D${i+1}`, 'DEF', 'ENEMY', d, d.r ?? DEF_R))
    ];

    // ★GKの確実な追加
    if (level.gk) {
      this.entities.push(mkEnt('GK', 'GK', 'ENEMY', level.gk, GK_R));
    } else {
      // データになくても強制追加
      this.entities.push(mkEnt('GK', 'GK', 'ENEMY', { x: this.goal.x + this.goal.w / 2, y: 30 }, GK_R));
    }

    this.ball = this.entities[0].pos.clone();
  }

  update(dt: number) {
    if (this.result) return;

    this.time += dt;
    const p1 = this.entities.find(e => e.id === 'P1')!;
    const recv = this.entities.find(e => e.id === this.receiver)!;
    const gk = this.entities.find(e => e.type === 'GK');
    const prevBall = this.ball.clone();

    // 1. レシーバーのラン
    if (this.phase !== 'SHOOT') {
      recv.pos.y -= PLAYER_SPD * dt;
    }

    // 2. GKの動き（横移動でボールを追う）
    if (gk && this.phase !== 'WAIT') {
        const targetX = Math.max(this.goal.x, Math.min(this.goal.x + this.goal.w, this.ball.x));
        gk.pos.x += (targetX - gk.pos.x) * 6 * dt; // 少し反応速度アップ
    }

    // 3. フェーズ進行
    if (this.phase === 'WAIT') {
      this.ball = p1.pos.clone();

      if (this.time >= KICK_DELAY) {
        // オフサイド判定
        const defendersY = this.entities
          .filter(e => e.team === 'ENEMY' && e.type !== 'GK')
          .map(e => e.pos.y)
          .sort((a, b) => a - b);
        
        const offsideLine = defendersY.length > 0 ? defendersY[0] : -9999;

        if (recv.pos.y < offsideLine - 10) {
          this.result = 'OFFSIDE';
          return;
        }

        this.phase = 'PASS';
        const dist = recv.pos.dist(p1.pos);
        const arrivalTime = dist / BALL_PASS_SPD;
        const leadY = recv.pos.y - (PLAYER_SPD * arrivalTime * 1.0);
        const target = new Vec2(recv.pos.x, leadY);

        this.ballVel = target.sub(p1.pos).norm().mul(BALL_PASS_SPD);
      }

    } else if (this.phase === 'PASS') {
      this.ball = this.ball.add(this.ballVel.mul(dt));

      if (this.ball.dist(recv.pos) <= BALL_R + recv.radius + 15) {
        this.phase = 'SHOOT';
        const goalCenter = new Vec2(this.goal.x + this.goal.w / 2, -10);
        this.ballVel = goalCenter.sub(this.ball).norm().mul(BALL_SHOOT_SPD);
      }

    } else if (this.phase === 'SHOOT') {
      this.ball = this.ball.add(this.ballVel.mul(dt));
    }

    // 4. 判定
    if (this.ball.x < 0 || this.ball.x > PITCH_W || this.ball.y < -50 || this.ball.y > PITCH_H + 50) {
      this.result = 'OUT';
      return;
    }

    if (this.phase === 'PASS' || this.phase === 'SHOOT') {
      for (const e of this.entities) {
        if (e.team === 'ENEMY') {
          if (this.checkCircleSegment(e.pos, e.radius + BALL_R, prevBall, this.ball)) {
            this.result = e.type === 'GK' ? 'KEEPER_SAVE' : 'INTERCEPT';
            return;
          }
        }
      }
    }

    if (this.ball.y <= 0 && this.ball.x >= this.goal.x && this.ball.x <= this.goal.x + this.goal.w) {
      this.result = 'GOAL';
    }
  }

  private checkCircleSegment(center: Vec2, radius: number, p1: Vec2, p2: Vec2): boolean {
    const d = p2.sub(p1);
    const f = p1.sub(center);
    const a = d.x * d.x + d.y * d.y;
    const b = 2 * (f.x * d.x + f.y * d.y);
    const c = (f.x * f.x + f.y * f.y) - radius * radius;

    let discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return false;

    discriminant = Math.sqrt(discriminant);
    const t1 = (-b - discriminant) / (2 * a);
    const t2 = (-b + discriminant) / (2 * a);

    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
  }
}
