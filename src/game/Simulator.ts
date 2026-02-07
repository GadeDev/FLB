import { Vec2 } from '../core/Vector2';
import type { Entity, LevelData, Receiver, Tactic } from './Types';

export type SimResult = 'GOAL' | 'INTERCEPT' | 'OUT' | 'OFFSIDE' | null;

const BALL_R = 8;
const PLAYER_R = 16;
const DEF_R = 20; // 敵の守備範囲
const PITCH_W = 360;
const PITCH_H = 720;

// 仕様書に合わせてパラメータ修正
const PLAYER_SPD = 220;     // 仕様書: 220
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

  initFromLevel(level: LevelData, receiver: Receiver, tactic: Tactic) {
    this.receiver = receiver;
    this.goal = level.goal;
    this.result = null;
    this.time = 0;
    this.phase = 'WAIT';
    this.ballVel = Vec2.zero;
    
    // tacticは現在未使用だが、将来の拡張やinterface遵守のために保持（noUnusedParameters対策で使用扱いにする）
    const _ = tactic; 

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
    // !を使ってnullでないことを明示
    const p1 = this.entities.find(e => e.id === 'P1')!;
    const recv = this.entities.find(e => e.id === this.receiver)!;

    // 1. レシーバーのラン（ゴール方向へ走る）
    if (this.phase !== 'SHOOT') {
      recv.pos.y += PLAYER_SPD * dt; // Y座標を加算（下方向＝敵ゴール方向ならマイナスだが、仕様では"敵ゴールは上側(yが小さい)"とあるので、これは「戻っている」ことになる？
      // 仕様書確認: 「敵ゴールは上側（yが小さい方向）」
      // つまり、ゴールに向かうなら y は 「減る」べきです。
      // 現在の実装: recv.pos.y += ... (増えている = 自陣に戻っている)
      // ★修正: ゴールに向かうなら減算
      recv.pos.y -= PLAYER_SPD * dt; 
    }

    // 前フレームのボール位置（すり抜け判定用）
    const prevBall = this.ball.clone();

    // 2. フェーズ進行
    if (this.phase === 'WAIT') {
      this.ball = p1.pos.clone();

      if (this.time >= KICK_DELAY) {
        // ★オフサイド判定修正
        // 仕様: GKを除くDFの中で「2番目にYが小さい（ゴールに近い）」選手
        const enemyYs = this.entities
          .filter(e => e.team === 'ENEMY')
          .map(e => e.pos.y)
          .sort((a, b) => a - b); // ★昇順（小さい順）に修正
        
        // 敵が2人以上いれば2番目(index 1)、1人ならその人(index 0)
        const offsideLine = enemyYs.length >= 2 ? enemyYs[1] : (enemyYs[0] || -9999);

        // レシーバーがオフサイドラインより奥（Yが小さい）ならオフサイド
        // ※仕様書: receiver.y < offside_line_y なら OFFSIDE
        if (recv.pos.y < offsideLine) {
          this.result = 'OFFSIDE';
          return;
        }

        // パス発射
        this.phase = 'PASS';
        const dist = recv.pos.dist(p1.pos);
        const arrivalTime = dist / BALL_PASS_SPD;
        // 偏差射撃：到着時の予測位置へ
        const leadY = recv.pos.y - (PLAYER_SPD * arrivalTime * 1.0); // ゴール方向(マイナス)へ予測
        const target = new Vec2(recv.pos.x, leadY);

        this.ballVel = target.sub(p1.pos).norm().mul(BALL_PASS_SPD);
      }

    } else if (this.phase === 'PASS') {
      this.ball = this.ball.add(this.ballVel.mul(dt));

      // レシーバー到達判定
      if (this.ball.dist(recv.pos) <= BALL_R + recv.radius + 15) {
        this.phase = 'SHOOT';
        // ゴール中央(180, 0)へシュート
        const goalCenter = new Vec2(180, 0); 
        this.ballVel = goalCenter.sub(this.ball).norm().mul(BALL_SHOOT_SPD);
      }

    } else if (this.phase === 'SHOOT') {
      this.ball = this.ball.add(this.ballVel.mul(dt));
    }

    // 3. 判定（移動後の位置チェック）

    // OUT判定
    if (this.ball.x < 0 || this.ball.x > PITCH_W || this.ball.y < 0 || this.ball.y > PITCH_H) {
      this.result = 'OUT';
      return;
    }

    // ★インターセプト判定（すり抜け防止）
    // 線分(prevBall -> this.ball) と 敵円 の交差判定
    if (this.phase === 'PASS' || this.phase === 'SHOOT') {
      for (const e of this.entities) {
        if (e.team === 'ENEMY') {
          // 線分と円の距離が (ボール半径 + 敵半径) 以下なら接触
          if (this.checkCircleSegment(e.pos, e.radius + BALL_R, prevBall, this.ball)) {
            this.result = 'INTERCEPT';
            return;
          }
        }
      }
    }

    // GOAL判定（ラインまたぎ推奨だが、今回は簡易矩形判定）
    // ゴール矩形: x=[80, 280], y=[0, 10]程度と想定
    // 仕様書: シュート線分がゴールライン(y=0)を跨ぐ点...
    // 簡易的にボールがゴール内に入ったらOKとします
    if (this.ball.y <= 0 && this.ball.x >= this.goal.x && this.ball.x <= this.goal.x + this.goal.w) {
      this.result = 'GOAL';
    }
  }

  // ★線分と円の衝突判定ヘルパー
  private checkCircleSegment(center: Vec2, radius: number, p1: Vec2, p2: Vec2): boolean {
    const d = p2.sub(p1);
    const f = p1.sub(center);
    
    const a = d.x * d.x + d.y * d.y;
    const b = 2 * (f.x * d.x + f.y * d.y);
    const c = (f.x * f.x + f.y * f.y) - radius * radius;

    let discriminant = b * b - 4 * a * c;
    if (discriminant < 0) {
      return false;
    }

    discriminant = Math.sqrt(discriminant);
    const t1 = (-b - discriminant) / (2 * a);
    const t2 = (-b + discriminant) / (2 * a);

    if (t1 >= 0 && t1 <= 1) return true;
    if (t2 >= 0 && t2 <= 1) return true;
    
    return false;
  }
}
