import { Vec2 } from '../core/Vector2';
import type { Entity, LevelData, Receiver, Tactic } from './Types';

export type SimResult = 'GOAL' | 'INTERCEPT' | 'OUT' | 'OFFSIDE' | null;

const BALL_R = 8;
const PLAYER_R = 16;
const DEF_R = 20;
const PITCH_W = 360;
const PITCH_H = 720;

const PLAYER_SPD = 150;     // 選手の走る速さ
const BALL_PASS_SPD = 420;  // パスの速さ
const BALL_SHOOT_SPD = 750; // シュートの速さ
const KICK_DELAY = 0.25;    // キックまでのタメ時間

export class Simulator {
  entities: Entity[] = [];
  ball: Vec2 = new Vec2(0, 0);
  receiver: Receiver = 'P2';
  goal = { x: 0, y: 0, w: 0, h: 0 };
  
  result: SimResult = null;

  private time = 0;
  private phase: 'WAIT' | 'PASS' | 'SHOOT' = 'WAIT';
  private ballVel = new Vec2(0, 0);

  initFromLevel(level: LevelData, receiver: Receiver, tactic: Tactic) {
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

    this.ball = this.entities[0].pos.clone();
  }

  update(dt: number) {
    if (this.result) return;

    this.time += dt;
    const p1 = this.entities.find(e => e.id === 'P1')!;
    const recv = this.entities.find(e => e.id === this.receiver)!;

    // 1. レシーバーのラン
    if (this.phase !== 'SHOOT') {
      recv.pos.y += PLAYER_SPD * dt;
    }

    // 2. フェーズ進行
    if (this.phase === 'WAIT') {
      this.ball = p1.pos.clone();

      if (this.time >= KICK_DELAY) {
        // オフサイド判定
        const enemyYs = this.entities
          .filter(e => e.team === 'ENEMY')
          .map(e => e.pos.y)
          .sort((a, b) => b - a);
        
        const offsideLine = enemyYs.length >= 2 ? enemyYs[1] : (enemyYs[0] || 9999);

        // 少し緩めの判定（+10pxまで許容）
        if (recv.pos.y > offsideLine + 10) {
          this.result = 'OFFSIDE';
          return;
        }

        this.phase = 'PASS';
        const dist = recv.pos.dist(p1.pos);
        const arrivalTime = dist / BALL_PASS_SPD;
        const leadY = recv.pos.y + (PLAYER_SPD * arrivalTime * 1.1);
        const target = new Vec2(recv.pos.x, leadY);

        this.ballVel = target.sub(p1.pos).norm().mul(BALL_PASS_SPD);
      }

    } else if (this.phase === 'PASS') {
      this.ball = this.ball.add(this.ballVel.mul(dt));

      if (this.ball.dist(recv.pos) <= BALL_R + recv.radius + 15) {
        this.phase = 'SHOOT';
        const goalCenter = new Vec2(this.goal.x + this.goal.w / 2, this.goal.y + this.goal.h / 2);
        this.ballVel = goalCenter.sub(this.ball).norm().mul(BALL_SHOOT_SPD);
      }

    } else if (this.phase === 'SHOOT') {
      this.ball = this.ball.add(this.ballVel.mul(dt));
    }

    // 3. 判定
    if (this.ball.x < 0 || this.ball.x > PITCH_W || this.ball.y < 0 || this.ball.y > PITCH_H) {
      this.result = 'OUT';
      return;
    }

    if (this.phase === 'PASS' || this.phase === 'SHOOT') {
      for (const e of this.entities) {
        if (e.team === 'ENEMY' && this.ball.dist(e.pos) <= BALL_R + e.radius) {
          this.result = 'INTERCEPT';
          return;
        }
      }
    }

    if (this.ball.x >= this.goal.x && this.ball.x <= this.goal.x + this.goal.w &&
        this.ball.y >= this.goal.y && this.ball.y <= this.goal.y + this.goal.h) {
      this.result = 'GOAL';
    }
  }
}
