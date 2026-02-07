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
const MIN_PASS_TIME = 0.2;

export class Simulator {
  entities: Entity[] = [];
  ball: Vec2 = new Vec2(0, 0);
  receiver: Receiver = 'P2';
  tactic: Tactic = 'MAN_MARK';
  goal = { x: 0, y: 0, w: 0, h: 0 };
  
  result: SimResult = null;
  
  public autoMessage: string | null = null;
  public nextActionLine: { from: Vec2, to: Vec2 } | null = null;

  private time = 0;
  private phase: 'WAIT' | 'PASS' | 'DECIDE' | 'SHOOT' = 'WAIT';
  private ballVel = new Vec2(0, 0);
  
  private passCount = 0;
  private passTime = 0;
  private freezeTimer = 0;
  
  private pendingPhase: 'PASS' | 'SHOOT' | null = null;
  private pendingBallVel: Vec2 = Vec2.zero;
  private pendingReceiver: string | null = null;

  initFromLevel(level: LevelData, receiver: Receiver, tactic: Tactic) {
    this.receiver = receiver;
    this.tactic = tactic;
    this.goal = level.goal;
    this.result = null;
    this.time = 0;
    this.phase = 'WAIT';
    this.ballVel = Vec2.zero;
    
    this.passCount = 0;
    this.passTime = 0;
    this.freezeTimer = 0;
    this.autoMessage = null;
    this.nextActionLine = null;
    this.pendingPhase = null;
    this.pendingReceiver = null;

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

    if (this.phase === 'DECIDE') {
      this.freezeTimer -= dt;
      if (this.freezeTimer <= 0) {
        this.executePendingAction();
      }
      return;
    }

    this.time += dt;

    const p1 = this.entities.find(e => e.id === 'P1')!;
    const targetId = this.pendingReceiver || this.receiver;
    const recv = this.entities.find(e => e.id === targetId)!;
    
    const decoyId = targetId === 'P2' ? 'P3' : 'P2';
    const decoy = this.entities.find(e => e.id === decoyId)!;
    
    const gk = this.entities.find(e => e.type === 'GK');
    const prevBall = this.ball.clone();

    // 1. 移動処理 (WAITとSHOOT以外)
    // ★修正: WAIT中は動かないように変更
    if (this.phase !== 'WAIT' && this.phase !== 'SHOOT') {
      recv.pos.y -= PLAYER_SPD * dt;

      const decoySpd = PLAYER_SPD * 0.9;
      decoy.pos.y -= decoySpd * dt;
      const spreadDir = (decoy.pos.x < recv.pos.x) ? -1 : 1;
      decoy.pos.x += spreadDir * 60 * dt;
      
      const margin = 20;
      decoy.pos.x = Math.max(margin, Math.min(PITCH_W - margin, decoy.pos.x));

      const defenders = this.entities.filter(e => e.type === 'DEF');
      for (const def of defenders) {
        if (this.tactic === 'MAN_MARK') {
          const dx = recv.pos.x - def.pos.x;
          if (Math.abs(dx) < 100) def.pos.x += Math.sign(dx) * 30 * dt;
        } else {
          const distRecv = def.pos.dist(recv.pos);
          const distDecoy = def.pos.dist(decoy.pos);
          const target = (distDecoy < distRecv) ? decoy : recv;
          const dx = target.pos.x - def.pos.x;
          if (Math.abs(dx) < 80) def.pos.x += Math.sign(dx) * 20 * dt;
        }
      }
    }

    if (gk && this.phase !== 'WAIT') {
        const targetX = Math.max(this.goal.x, Math.min(this.goal.x + this.goal.w, this.ball.x));
        gk.pos.x += (targetX - gk.pos.x) * 6 * dt;
    }

    // 2. フェーズ進行
    if (this.phase === 'WAIT') {
      this.ball = p1.pos.clone();

      if (this.time >= KICK_DELAY) {
        this.startPass(p1.pos, recv, 1);
      }

    } else if (this.phase === 'PASS') {
      this.passTime += dt;
      this.ball = this.ball.add(this.ballVel.mul(dt));

      if (this.passTime >= MIN_PASS_TIME && 
          this.ball.dist(recv.pos) <= BALL_R + recv.radius + 15) {
        
        this.ball = recv.pos.clone();
        this.startDecide(recv, decoy);
      }

    } else if (this.phase === 'SHOOT') {
      this.ball = this.ball.add(this.ballVel.mul(dt));
    }

    // 3. 判定
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

  private startPass(from: Vec2, targetEntity: Entity, count: number) {
    if (this.checkOffside(targetEntity)) {
      this.result = 'OFFSIDE';
      return;
    }

    this.phase = 'PASS';
    this.passCount = count;
    this.passTime = 0;
    this.autoMessage = count === 1 ? "PASS 1" : null;

    const dist = targetEntity.pos.dist(from);
    const arrivalTime = dist / BALL_PASS_SPD;
    const leadY = targetEntity.pos.y - (PLAYER_SPD * arrivalTime * 1.0);
    const targetPos = new Vec2(targetEntity.pos.x, leadY);
    
    this.ballVel = targetPos.sub(from).norm().mul(BALL_PASS_SPD);
  }

  private startDecide(currentHolder: Entity, otherAlly: Entity) {
    this.phase = 'DECIDE';
    this.freezeTimer = 0.35;

    const goalCenter = new Vec2(this.goal.x + this.goal.w / 2, -10);

    // ★修正: シュート優先条件を厳しく（近距離のみ）
    // 220px以内 かつ コースが空いている場合のみ即シュート
    const canShoot = currentHolder.pos.y < 220 && this.isPathClear(currentHolder.pos, goalCenter);

    if (canShoot) {
      this.setPendingShoot(currentHolder.pos, goalCenter, "AUTO: SHOOT!");
      return;
    }

    // ★修正: PASS2判定（PASS1の場合）
    if (this.passCount === 1) {
      // 実際のリードパス位置を計算して判定する
      const dist = otherAlly.pos.dist(currentHolder.pos);
      const arrivalTime = dist / BALL_PASS_SPD;
      const leadY = otherAlly.pos.y - (PLAYER_SPD * arrivalTime * 1.0);
      const leadTargetPos = new Vec2(otherAlly.pos.x, leadY);

      const isOffside = this.checkOffside(otherAlly);
      // リード位置へのコースチェック
      const canPass = this.isPathClear(currentHolder.pos, leadTargetPos);

      if (!isOffside && canPass) {
        // リード位置を渡してライン描画と実動作を一致させる
        this.setPendingPass(otherAlly, "AUTO: PASS → " + otherAlly.id, currentHolder.pos, leadTargetPos);
        return;
      }
    }

    // どれもダメなら強引にシュート
    this.setPendingShoot(currentHolder.pos, goalCenter, "AUTO: SHOOT (FORCED)");
  }

  private setPendingShoot(from: Vec2, target: Vec2, msg: string) {
    this.pendingPhase = 'SHOOT';
    this.pendingReceiver = null;
    this.pendingBallVel = target.sub(from).norm().mul(BALL_SHOOT_SPD);
    this.autoMessage = msg;
    this.nextActionLine = { from, to: target };
  }

  // ★修正: fromとtoを受け取り、プレビュー線を正確にする
  private setPendingPass(targetEntity: Entity, msg: string, from: Vec2, to: Vec2) {
    this.pendingPhase = 'PASS';
    this.pendingReceiver = targetEntity.id;
    this.autoMessage = msg;
    this.nextActionLine = { from, to }; // 実際のリード位置への線を表示
  }

  private executePendingAction() {
    if (this.pendingPhase === 'SHOOT') {
        this.phase = 'SHOOT';
        this.ballVel = this.pendingBallVel;
    } else if (this.pendingPhase === 'PASS') {
        const targetId = this.pendingReceiver;
        const target = this.entities.find(e => e.id === targetId)!;
        this.receiver = targetId as Receiver;
        this.startPass(this.ball, target, 2);
    }
  }

  private checkOffside(target: Entity): boolean {
    const defendersY = this.entities
      .filter(e => e.team === 'ENEMY' && e.type !== 'GK')
      .map(e => e.pos.y)
      .sort((a, b) => a - b);
    
    const offsideLine = defendersY.length >= 2 ? defendersY[1] : (defendersY[0] ?? -9999);
    return target.pos.y < offsideLine - 10;
  }

  private isPathClear(from: Vec2, to: Vec2): boolean {
    const defenders = this.entities.filter(e => e.type === 'DEF');
    for (const def of defenders) {
      if (this.checkCircleSegment(def.pos, def.radius + BALL_R, from, to)) {
        return false;
      }
    }
    return true;
  }

  private checkCircleSegment(center: Vec2, radius: number, p1: Vec2, p2: Vec2): boolean {
    const d = p2.sub(p1);
    const f = p1.sub(center);
    const a = d.x * d.x + d.y * d.y;
    const b = 2 * (f.x * d.x + f.y * d.y);
    const c = (f.x * f.x + f.y * f.y) - radius * radius;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return false;
    const sq = Math.sqrt(discriminant);
    const t1 = (-b - sq) / (2 * a);
    const t2 = (-b + sq) / (2 * a);
    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
  }
}
