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
  
  // UI連携用プロパティ
  public autoMessage: string | null = null;
  public nextActionLine: { from: Vec2, to: Vec2 } | null = null;

  private time = 0;
  private phase: 'WAIT' | 'PASS' | 'SHOOT' = 'WAIT';
  private ballVel = new Vec2(0, 0);
  
  // 新機能用ステート
  private passCount = 0;
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
    
    // リセット
    this.passCount = 0;
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

    // ★演出用の一時停止
    if (this.freezeTimer > 0) {
      this.freezeTimer -= dt;
      if (this.freezeTimer <= 0) {
        // 停止終了：決定されたアクションを実行
        this.executePendingAction();
      }
      return; // 停止中は更新しない
    }

    this.time += dt;
    const p1 = this.entities.find(e => e.id === 'P1')!;
    
    // 現在のターゲット（PASS1ならP2/P3、PASS2なら変更後のターゲット）
    // pendingReceiverがあるならそちらを優先（PASS2移行直前など）
    const targetId = this.pendingReceiver || this.receiver;
    const recv = this.entities.find(e => e.id === targetId)!;
    
    // デコイの取得（現在のターゲットではない方）
    const decoyId = targetId === 'P2' ? 'P3' : 'P2';
    const decoy = this.entities.find(e => e.id === decoyId)!;
    
    const gk = this.entities.find(e => e.type === 'GK');
    const prevBall = this.ball.clone();

    // 1. 選手の移動
    if (this.phase !== 'SHOOT') {
      // 受け手は前進
      recv.pos.y -= PLAYER_SPD * dt;

      // デコイも動き続ける（スペースを作る）
      const decoySpd = PLAYER_SPD * 0.9;
      decoy.pos.y -= decoySpd * dt;
      const spreadDir = (decoy.pos.x < recv.pos.x) ? -1 : 1;
      decoy.pos.x += spreadDir * 60 * dt;
      
      const margin = 20;
      decoy.pos.x = Math.max(margin, Math.min(PITCH_W - margin, decoy.pos.x));
    }

    // 2. DFのAI
    if (this.phase !== 'SHOOT') {
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

    // 3. GK
    if (gk && this.phase !== 'WAIT') {
        const targetX = Math.max(this.goal.x, Math.min(this.goal.x + this.goal.w, this.ball.x));
        gk.pos.x += (targetX - gk.pos.x) * 6 * dt;
    }

    // 4. フェーズ進行
    if (this.phase === 'WAIT') {
      this.ball = p1.pos.clone();

      if (this.time >= KICK_DELAY) {
        // ★OFFSIDE判定（方式A：キック時のみ）
        const offsideY = this.getOffsideLineY();
        // ターゲットがラインより奥（Yが小さい）ならOUT
        if (recv.pos.y < offsideY - 10) {
          this.result = 'OFFSIDE';
          return;
        }

        this.phase = 'PASS';
        this.passCount = 1; // 1本目
        
        // パス開始計算
        const dist = recv.pos.dist(p1.pos);
        const arrivalTime = dist / BALL_PASS_SPD;
        const leadY = recv.pos.y - (PLAYER_SPD * arrivalTime * 1.0);
        const target = new Vec2(recv.pos.x, leadY);
        this.ballVel = target.sub(p1.pos).norm().mul(BALL_PASS_SPD);
      }

    } else if (this.phase === 'PASS') {
      this.ball = this.ball.add(this.ballVel.mul(dt));

      // ボールが受け手に到達
      if (this.ball.dist(recv.pos) <= BALL_R + recv.radius + 15) {
        // 到達位置にボールを補正
        this.ball = recv.pos.clone();
        
        // 次の行動を決定して一時停止
        this.decideNextAction(recv, decoy);
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

  // 自動判断ロジック
  private decideNextAction(currentHolder: Entity, otherAlly: Entity) {
    // 0.35秒停止
    this.freezeTimer = 0.35;

    // ゴール中心
    const goalCenter = new Vec2(this.goal.x + this.goal.w / 2, -10);

    // A. シュートコースチェック
    // GK以外のDFに遮られないか確認（GKはKEEPER_SAVEで判定するのでパスチェックには含めない方針だが、
    // 「DFに遮られない」という要件なのでDEFのみチェック）
    if (this.isPathClear(currentHolder.pos, goalCenter)) {
      this.setPendingShoot(currentHolder.pos, goalCenter, "AUTO: SHOOT!");
      return;
    }

    // B. パス2チェック（まだ1本目の場合のみ）
    if (this.passCount === 1) {
      // オフサイドチェック
      const offsideY = this.getOffsideLineY();
      const isOffside = otherAlly.pos.y < offsideY - 10;
      
      // パスコースチェック
      const canPass = this.isPathClear(currentHolder.pos, otherAlly.pos);

      if (!isOffside && canPass) {
        this.setPendingPass(currentHolder.pos, otherAlly, "AUTO: PASS → " + otherAlly.id);
        return;
      }
    }

    // C. どちらもダメなら強引にシュート
    this.setPendingShoot(currentHolder.pos, goalCenter, "AUTO: SHOOT (FORCED)");
  }

  private setPendingShoot(from: Vec2, target: Vec2, msg: string) {
    this.pendingPhase = 'SHOOT';
    this.pendingReceiver = null; // 特定の受け手なし
    this.pendingBallVel = target.sub(from).norm().mul(BALL_SHOOT_SPD);
    
    // UI用
    this.autoMessage = msg;
    this.nextActionLine = { from, to: target };
  }

  private setPendingPass(from: Vec2, targetEntity: Entity, msg: string) {
    this.pendingPhase = 'PASS';
    this.pendingReceiver = targetEntity.id; // レシーバー切り替え
    this.passCount = 2; // 2本目

    // リードパス計算
    const dist = targetEntity.pos.dist(from);
    const arrivalTime = dist / BALL_PASS_SPD;
    const leadY = targetEntity.pos.y - (PLAYER_SPD * arrivalTime * 1.0);
    const targetPos = new Vec2(targetEntity.pos.x, leadY);

    this.pendingBallVel = targetPos.sub(from).norm().mul(BALL_PASS_SPD);

    // UI用
    this.autoMessage = msg;
    this.nextActionLine = { from, to: targetPos };
  }

  private executePendingAction() {
    if (this.pendingPhase) {
      this.phase = this.pendingPhase;
      this.ballVel = this.pendingBallVel;
      if (this.pendingReceiver) {
        this.receiver = this.pendingReceiver as Receiver;
      }
    }
    // メッセージ等はクリアせず、トースト表示用に残すか適宜消す
    // ここではそのまま残し、main.ts側で検知させる
  }

  // ヘルパー：パスコースがDFに遮られていないか
  private isPathClear(from: Vec2, to: Vec2): boolean {
    const defenders = this.entities.filter(e => e.type === 'DEF'); // GKは除く
    for (const def of defenders) {
      // 線分と円の接触判定
      if (this.checkCircleSegment(def.pos, def.radius + BALL_R, from, to)) {
        return false; // 遮られた
      }
    }
    return true;
  }

  // ヘルパー：オフサイドライン取得（GK除くDFの2番目）
  private getOffsideLineY(): number {
    const defendersY = this.entities
      .filter(e => e.team === 'ENEMY' && e.type !== 'GK')
      .map(e => e.pos.y)
      .sort((a, b) => a - b); // 昇順

    if (defendersY.length === 0) return -9999;
    if (defendersY.length === 1) return defendersY[0];
    return defendersY[1];
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
