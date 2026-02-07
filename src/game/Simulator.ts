import { Vec2 } from '../core/Vector2';
import type { Entity, LevelData, Receiver, SimStateSnapshot, Tactic } from './Types';

type SimResult = { cleared: boolean; reason: 'GOAL' | 'INTERCEPT' | 'OUT' | 'NONE' };

const BALL_R = 10;
const PLAYER_R = 16;
const DEF_R = 18;
const PITCH_W = 360;
const PITCH_H = 720;

export class Simulator {
  entities: Entity[] = [];
  ball: Vec2 = new Vec2(0, 0);
  receiver: Receiver = 'P2';
  tactic: Tactic = 'PASS_TO_RECEIVER';
  goal = { x: 0, y: 0, w: 0, h: 0 };

  initFromLevel(level: LevelData, receiver: Receiver, tactic: Tactic) {
    this.receiver = receiver;
    this.tactic = tactic;
    this.goal = level.goal;

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

  run(): SimResult {
    const p1 = this.entities.find(e => e.id === 'P1')!;
    const recv = this.entities.find(e => e.id === this.receiver)!;
    const dir = recv.pos.sub(p1.pos).norm();
    let ball = p1.pos.clone();

    // 簡易シミュレーションループ
    for (let i = 0; i < 400; i++) {
      ball = ball.add(dir.mul(10)); // Speed 10
      
      // OUT判定
      if (ball.x < 0 || ball.x > PITCH_W || ball.y < 0 || ball.y > PITCH_H) {
        return { cleared: false, reason: 'OUT' };
      }
      
      // INTERCEPT判定
      for (const e of this.entities) {
        if (e.team === 'ENEMY' && ball.dist(e.pos) <= BALL_R + e.radius) {
          return { cleared: false, reason: 'INTERCEPT' };
        }
      }

      // GOAL判定
      if (ball.x > this.goal.x && ball.x < this.goal.x + this.goal.w &&
          ball.y > this.goal.y && ball.y < this.goal.y + this.goal.h) {
        return { cleared: true, reason: 'GOAL' };
      }

      // 味方到達判定
      if (ball.dist(recv.pos) <= BALL_R + recv.radius) {
        return { cleared: false, reason: 'NONE' };
      }
    }
    return { cleared: false, reason: 'NONE' };
  }
}
