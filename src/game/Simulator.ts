import { Vec2 } from '../core/Vector2';
import type { Entity, LevelData, Receiver, Tactic } from './Types';

export type SimResult = 'GOAL' | 'INTERCEPT' | 'OUT' | 'OFFSIDE' | null;

const BALL_R = 8;
const PLAYER_R = 16;
const DEF_R = 20;
const PITCH_W = 360;
const PITCH_H = 720;

// パラメータ調整
const PLAYER_SPD = 150;     // 選手の走る速さ
const BALL_PASS_SPD = 420;  // パスの速さ
const BALL_SHOOT_SPD = 750; // シュートの速さ
const KICK_DELAY = 0.25;    // キックまでのタメ時間（秒）

export class Simulator {
  entities: Entity[] = [];
  ball: Vec2 = new Vec2(0, 0);
  receiver: Receiver = 'P2';
  goal = { x: 0, y: 0, w: 0, h: 0 };
  
  // 実行結果
  result: SimResult = null;

  // 内部状態
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

    // Entity作成
    const mkEnt = (id: string, type: any, team: any, pos: {x:number, y:number}, r: number): Entity => ({
      id, type, team, pos: Vec2.from(pos), radius: r
    });

    this.entities = [
      mkEnt('P1', 'P1', 'ALLY', level.p1, PLAYER_R),
      mkEnt('P2', 'P2', 'ALLY', level.p2, PLAYER_R),
      mkEnt('P3', 'P3', 'ALLY', level.p3, PLAYER_R),
      ...level.defenders.map((d, i) => mkEnt(`D${i+1}`, 'DEF', 'ENEMY', d, d.r ?? DEF_R))
    ];

    this.ball = this.entities[0].pos.clone(); // P1の位置
  }

  // 1フレーム更新（アニメーション用）
  update(dt: number) {
    if (this.result) return; // 決着がついたら更新しない

    this.time += dt;
    const p1 = this.entities.find(e => e.id === 'P1')!;
    const recv = this.entities.find(e => e.id === this.receiver)!;

    // 1. レシーバーのラン（常にゴール方向へ走る）
    // シュートフェーズ以外はずっと走る（ラインブレイク）
    if (this.phase !== 'SHOOT') {
      recv.pos.y += PLAYER_SPD * dt;
    }

    // 2. フェーズ進行
    if (this.phase === 'WAIT') {
      this.ball = p1.pos.clone(); // ボールは足元

      // キックタイミング到達
      if (this.time >= KICK_DELAY) {
        // ★ オフサイド判定 ★
        // 敵の中で「2番目にYが大きい（奥にいる）」選手を探す。いなければ一番奥。
        const enemyYs = this.entities
          .filter(e => e.team === 'ENEMY')
          .map(e => e.pos.y)
          .sort((a, b) => b - a);
        
        const offsideLine = enemyYs.length >= 2 ? enemyYs[1] : (enemyYs[0] || 9999);

        if (recv.pos.y > offsideLine) {
          this.result = 'OFFSIDE';
          return;
        }

        // パス発射（スルーパス）
        this.phase = 'PASS';
        
        // 未来位置予測（偏差射撃）
        const dist = recv.pos.dist(p1.pos);
        const arrivalTime = dist / BALL_PASS_SPD;
        const leadY = recv.pos.y + (PLAYER_SPD * arrivalTime * 1.1); // 少し前へ出す
        const target = new Vec2(recv.pos.x, leadY);

        this.ballVel = target.sub(p1.pos).norm().mul(BALL_PASS_SPD);
      }

    } else if (this.phase === 'PASS') {
      // ボール移動
      this.ball = this.ball.add(this.ballVel.mul(dt));

      // レシーバー到達判定
      if (this.ball.dist(recv.pos) <= BALL_R + recv.radius + 8) {
        this.phase = 'SHOOT';
        
        // ゴール中央へシュート
        const goalCenter = new Vec2(
          this.goal.x + this.goal.w / 2,
          this.goal.y + this.goal.h / 2
        );
        this.ballVel = goalCenter.sub(this.ball).norm().mul(BALL_SHOOT_SPD);
      }

    } else if (this.phase === 'SHOOT') {
      // ボール移動
      this.ball = this.ball.add(this.ballVel.mul(dt));
    }

    // 3. 接触・判定
    
    // OUT
    if (this.ball.x < 0 || this.ball.x > PITCH_W || this.ball.y < 0 || this.ball.y > PITCH_H) {
      this.result = 'OUT';
      return;
    }

    // INTERCEPT（パス中・シュート中）
    if (this.phase === 'PASS' || this.phase === 'SHOOT') {
      for (const e of this.entities) {
        if (e.team === 'ENEMY') {
          if (this.ball.dist(e.pos) <= BALL_R + e.radius) {
            this.result = 'INTERCEPT';
            return;
          }
        }
      }
    }

    // GOAL
    if (this.ball.x >= this.goal.x && this.ball.x <= this.goal.x + this.goal.w &&
        this.ball.y >= this.goal.y && this.ball.y <= this.goal.y + this.goal.h) {
      this.result = 'GOAL';
    }
  }
}
