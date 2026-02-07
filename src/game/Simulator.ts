import { Vec2 } from '../core/Vector2';
import type { Entity, LevelData, Receiver, Tactic } from './Types';

// 結果の型に 'PASS' を追加
export type SimResult = { cleared: boolean; reason: 'GOAL' | 'PASS' | 'INTERCEPT' | 'OUT' | 'NONE' };

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

    // Entity作成
    const p1: Entity = { id: 'P1', type: 'P1', team: 'ALLY', pos: Vec2.from(level.p1), radius: PLAYER_R };
    const p2: Entity = { id: 'P2', type: 'P2', team: 'ALLY', pos: Vec2.from(level.p2), radius: PLAYER_R };
    const p3: Entity = { id: 'P3', type: 'P3', team: 'ALLY', pos: Vec2.from(level.p3), radius: PLAYER_R };

    const defenders: Entity[] = level.defenders.map((d, i) => ({
      id: `D${i + 1}`,
      type: 'DEF',
      team: 'ENEMY',
      pos: Vec2.from(d),
      radius: d.r ?? DEF_R
    }));

    this.entities = [p1, p2, p3, ...defenders];
    this.ball = p1.pos.clone();
  }

  run(): SimResult {
    const p1 = this.entities.find(e => e.id === 'P1')!;
    const recv = this.entities.find(e => e.id === this.receiver)!;

    // パス方向と速度
    const dir = recv.pos.sub(p1.pos).norm();
    const speed = 10;

    let ball = p1.pos.clone();
    const maxSteps = 600; 

    for (let step = 0; step < maxSteps; step++) {
      ball = ball.add(dir.mul(speed));
      this.ball = ball;

      // 1. OUT判定
      if (ball.x < 0 || ball.x > PITCH_W || ball.y < 0 || ball.y > PITCH_H) {
        return { cleared: false, reason: 'OUT' };
      }

      // 2. INTERCEPT判定
      for (const d of this.entities) {
        if (d.team !== 'ENEMY') continue;
        if (ball.dist(d.pos) <= BALL_R + d.radius) {
          return { cleared: false, reason: 'INTERCEPT' };
        }
      }

      // 3. PASS成功判定（レシーバーに到達）
      if (ball.dist(recv.pos) <= BALL_R + recv.radius) {
        return { cleared: true, reason: 'PASS' };
      }

      // 4. GOAL判定（ゴール枠内）
      const g = this.goal;
      const inGoal =
        ball.x >= g.x &&
        ball.x <= g.x + g.w &&
        ball.y >= g.y &&
        ball.y <= g.y + g.h;

      if (inGoal) return { cleared: true, reason: 'GOAL' };
    }

    return { cleared: false, reason: 'NONE' };
  }
}
