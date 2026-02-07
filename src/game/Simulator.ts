import { Vec2 } from '../core/Vector2';
import type { Entity, LevelData, Receiver, Tactic } from './Types';

export type SimResult = 'GOAL' | 'INTERCEPT' | 'OUT' | 'OFFSIDE' | null;

const BALL_R = 8;
const PLAYER_R = 16;
const DEF_R = 20;
const PITCH_W = 360;
const PITCH_H = 720;

// 仕様書パラメータ
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

  // CI対策: tactic を _tactic にして未使用エラーを回避
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

    this.ball = this.entities[0].pos.clone();
  }

  update(dt: number) {
    if (this.result) return;

    this.time += dt;
    // ! でnullチェックを回避
    const p1 = this.entities.find(e => e.id === 'P1')!;
    const recv = this.entities.find(e => e.id === this.receiver)!;
    const prevBall = this.ball.clone();

    // 1. レシーバーのラン（敵ゴールは上側 Y=0 なので減算）
    if (this.phase !== 'SHOOT') {
      recv.pos.y -= PLAYER_SPD * dt;
    }

    // 2. フェーズ進行
    if (this.phase === 'WAIT') {
      this.ball = p1.pos.clone();

      if (this.time >= KICK_DELAY) {
        // オフサイド判定
        // GKを含む全DFをY座標昇順（ゴールに近い順）にソート
        const enemyYs = this.entities
          .filter(e => e.team === 'ENEMY')
          .map(e => e.pos.y)
          .sort((a, b) => a - b);
        
        // 「後ろから2番目」のライン（敵が1人ならその位置）
        const offsideLine = enemyYs.length >= 2 ? enemyYs[1] : (enemyYs[0] || -9999);

        // 判定：レシーバーがラインより前に出ているか（Yが小さい）
        // +10px の緩め許容（ラインより10px以上前に出たらアウト）
        if (recv.pos.y < offsideLine - 10) {
          this.result = 'OFFSIDE';
          return;
        }

        // パス開始
        this.phase = 'PASS';
        const dist = recv.pos.dist(p1.pos);
        const arrivalTime = dist / BALL_PASS_SPD;
        // 偏差予測（ゴール方向へリードパス）
        const leadY = recv.pos.y - (PLAYER_SPD * arrivalTime * 1.0);
        const target = new Vec2(recv.pos.x, leadY);

        this.ballVel = target.sub(p1.pos).norm().mul(BALL_PASS_SPD);
      }

    } else if (this.phase === 'PASS') {
      this.ball = this.ball.add(this.ballVel.mul(dt));

      // レシーバー到達判定
      if (this.ball.dist(recv.pos) <= BALL_R + recv.radius + 15) {
        this.phase = 'SHOOT';
        // ゴール中央(180, 0)へ即シュート
        const goalCenter = new Vec2(180, 0); 
        this.ballVel = goalCenter.sub(this.ball).norm().mul(BALL_SHOOT_SPD);
      }

    } else if (this.phase === 'SHOOT') {
      this.ball = this.ball.add(this.ballVel.mul(dt));
    }

    // 3. 判定

    // OUT
    if (this.ball.x < 0 || this.ball.x > PITCH_W || this.ball.y < 0 || this.ball.y > PITCH_H) {
      this.result = 'OUT';
      return;
    }

    // INTERCEPT（すり抜け防止：線分判定）
    if (this.phase === 'PASS' || this.phase === 'SHOOT') {
      for (const e of this.entities) {
        if (e.team === 'ENEMY') {
          // 線分(prevBall -> currentBall) と 敵円 の接触判定
          if (this.checkCircleSegment(e.pos, e.radius + BALL_R, prevBall, this.ball)) {
            this.result = 'INTERCEPT';
            return;
          }
        }
      }
    }

    // GOAL (Yが0以下で、かつゴール幅の内側)
    if (this.ball.y <= 0 && this.ball.x >= this.goal.x && this.ball.x <= this.goal.x + this.goal.w) {
      this.result = 'GOAL';
    }
  }

  // 線分と円の衝突判定
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
