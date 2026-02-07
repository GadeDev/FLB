import { Vec2 } from '../core/Vector2';
import type { Entity, LevelData, Receiver, Tactic } from './Types';

export type SimResult = 'GOAL' | 'INTERCEPT' | 'OUT' | 'OFFSIDE' | 'KEEPER_SAVE' | null;

const BALL_R = 8;
const PLAYER_R = 16;
const DEF_R = 20;
const GK_R = 18;

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
  tactic: Tactic = 'MAN_MARK';
  goal = { x: 0, y: 0, w: 0, h: 0 };
  
  result: SimResult = null;

  private time = 0;
  private phase: 'WAIT' | 'PASS' | 'SHOOT' = 'WAIT';
  private ballVel = new Vec2(0, 0);

  initFromLevel(level: LevelData, receiver: Receiver, tactic: Tactic) {
    this.receiver = receiver;
    this.tactic = tactic;
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

    if (level.gk) {
      this.entities.push(mkEnt('GK', 'GK', 'ENEMY', level.gk, GK_R));
    } else {
      this.entities.push(mkEnt('GK', 'GK', 'ENEMY', { x: this.goal.x + this.goal.w / 2, y: 30 }, GK_R));
    }

    this.ball = this.entities[0].pos.clone();
  }

  update(dt: number) {
    if (this.result) return;

    this.time += dt;
    const p1 = this.entities.find(e => e.id === 'P1')!;
    const recv = this.entities.find(e => e.id === this.receiver)!;
    
    // デコイの取得
    const decoyId = this.receiver === 'P2' ? 'P3' : 'P2';
    const decoy = this.entities.find(e => e.id === decoyId)!;
    
    const gk = this.entities.find(e => e.type === 'GK');
    const prevBall = this.ball.clone();

    // 1. 選手の移動（ラン）
    
    // 受け手：シュートフェーズ以外は前進
    if (this.phase !== 'SHOOT') {
      recv.pos.y -= PLAYER_SPD * dt;
    }

    // ★修正：デコイはフェーズに関係なく（resultが出るまで）動き続ける
    // 少し遅れて斜めに走る（スペースを作る動き）
    const decoySpd = PLAYER_SPD * 0.9;
    decoy.pos.y -= decoySpd * dt;
    
    // 横移動（速度アップ 40 -> 60）
    const spreadDir = (decoy.pos.x < recv.pos.x) ? -1 : 1;
    decoy.pos.x += spreadDir * 60 * dt;

    // 画面外に出ないようクランプ
    const margin = 20;
    decoy.pos.x = Math.max(margin, Math.min(PITCH_W - margin, decoy.pos.x));


    // 2. DFのAI（シュート中は動かないままでOK）
    if (this.phase !== 'SHOOT') {
      const defenders = this.entities.filter(e => e.type === 'DEF');
      for (const def of defenders) {
        if (this.tactic === 'MAN_MARK') {
          // マンツーマン
          const dx = recv.pos.x - def.pos.x;
          if (Math.abs(dx) < 100) {
            def.pos.x += Math.sign(dx) * 30 * dt;
          }
        } else {
          // ゾーン
          const distRecv = def.pos.dist(recv.pos);
          const distDecoy = def.pos.dist(decoy.pos);
          const target = (distDecoy < distRecv) ? decoy : recv;
          const dx = target.pos.x - def.pos.x;
          
          if (Math.abs(dx) < 80) {
            def.pos.x += Math.sign(dx) * 20 * dt;
          }
        }
      }
    }

    // 3. GKの動き
    if (gk && this.phase !== 'WAIT') {
        const targetX = Math.max(this.goal.x, Math.min(this.goal.x + this.goal.w, this.ball.x));
        gk.pos.x += (targetX - gk.pos.x) * 6 * dt;
    }

    // 4. フェーズ進行
    if (this.phase === 'WAIT') {
      this.ball = p1.pos.clone();

      if (this.time >= KICK_DELAY) {
        // ★修正：オフサイド判定
        // GKを除くDFのY座標（ゴールに近い順＝小さい順）
        const defendersY = this.entities
          .filter(e => e.team === 'ENEMY' && e.type !== 'GK')
          .map(e => e.pos.y)
          .sort((a, b) => a - b);
        
        // 上位2人目のYを採用（いなければ1人目、0人なら判定なし）
        const offsideLine = defendersY.length >= 2 ? defendersY[1] : (defendersY[0] ?? -9999);

        // ラインより前（Yが小さい）ならオフサイド
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

      // 到達判定
      if (this.ball.dist(recv.pos) <= BALL_R + recv.radius + 15) {
        this.phase = 'SHOOT';
        const goalCenter = new Vec2(this.goal.x + this.goal.w / 2, -10);
        this.ballVel = goalCenter.sub(this.ball).norm().mul(BALL_SHOOT_SPD);
      }

    } else if (this.phase === 'SHOOT') {
      this.ball = this.ball.add(this.ballVel.mul(dt));
    }

    // 5. 判定
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
