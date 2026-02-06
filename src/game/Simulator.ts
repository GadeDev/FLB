import { C, RNG } from '../core/Constants';
import { Vec2 } from '../core/Vector2';
import type { Entity, LevelData, Tactic } from './Types';

export type SimResult = 'GOAL' | 'OFFSIDE' | 'INTERCEPT' | 'GK_CATCH' | 'MISS';

type Phase = 'EDIT' | 'PREKICK' | 'PASS1' | 'PASS2' | 'DONE';

export class Simulator {
  readonly rng: RNG;

  entities: Entity[] = [];
  ball: Entity;

  time = 0;
  result: SimResult | null = null;

  private phase: Phase = 'EDIT';
  private kicked = false;

  private receiverId: 'P2' | 'P3' = 'P2';
  private timing: 'EARLY' | 'LATE' = 'EARLY';
  private tactic: Tactic = 'NORMAL';

  private pass1Target: Vec2 = new Vec2(500, 400);
  private pass2Target: Vec2 = new Vec2(C.CENTER.x, C.CENTER.y);

  private dfInterceptMul = 1.0;
  private dfSpeed = C.DF_SPD;

  constructor(seed: number) {
    this.rng = new RNG(seed);
    // dummy init; call reset()
    this.ball = {
      id: 'BALL',
      type: 'BALL',
      pos: new Vec2(0, 0),
      vel: Vec2.zero,
      radius: C.BALL_R,
    };
  }

  reset(level: LevelData, allyPositions: { p1: Vec2; p2: Vec2; p3: Vec2 }, receiver: 'P2' | 'P3') {
    this.time = 0;
    this.result = null;
    this.phase = 'EDIT';
    this.kicked = false;

    this.receiverId = receiver;
    this.timing = 'EARLY';
    this.tactic = level.tactic;

    // tactic params
    this.dfInterceptMul = 1.0;
    this.dfSpeed = C.DF_SPD;
    if (this.tactic === 'MID_BLOCK') {
      this.dfInterceptMul = 1.35;
      this.dfSpeed = 120;
    }

    // Allies
    const p1: Entity = { id: 'P1', type: 'ALLY', pos: allyPositions.p1, vel: Vec2.zero, radius: C.PLAYER_R };
    const p2: Entity = { id: 'P2', type: 'ALLY', pos: allyPositions.p2, vel: Vec2.zero, radius: C.PLAYER_R };
    const p3: Entity = { id: 'P3', type: 'ALLY', pos: allyPositions.p3, vel: Vec2.zero, radius: C.PLAYER_R };

    // Enemies
    const defenders: Entity[] = level.defenders.map(d => ({
      id: d.id,
      type: 'ENEMY',
      pos: new Vec2(d.x, d.y),
      vel: Vec2.zero,
      radius: C.PLAYER_R,
      interceptRadius: C.DF_INTERCEPT_R * this.dfInterceptMul
    }));

    if (this.tactic === 'HIGH_LINE') {
      defenders.forEach(d => { d.pos = new Vec2(d.pos.x, d.pos.y + 18); });
    }

    const gk: Entity = {
      id: 'GK',
      type: 'GK',
      pos: new Vec2(level.gk.x, level.gk.y),
      vel: Vec2.zero,
      radius: C.PLAYER_R,
      catchRadius: C.GK_CATCH_R
    };

    this.entities = [p1, p2, p3, ...defenders, gk];

    this.ball = {
      id: 'BALL',
      type: 'BALL',
      pos: new Vec2(p1.pos.x, p1.pos.y),
      vel: Vec2.zero,
      radius: C.BALL_R
    };

    this.pass2Target = new Vec2(C.CENTER.x, C.CENTER.y);
    this.pass1Target = this.getReceiver().pos;
  }

  setEdit(receiver: 'P2' | 'P3') {
    if (this.phase !== 'EDIT') return;
    this.receiverId = receiver;
    this.pass1Target = this.getReceiver().pos;
  }

  setTiming(t: 'EARLY' | 'LATE') {
    this.timing = t;
  }

  startRun() {
    if (this.phase !== 'EDIT') return;
    this.phase = 'PREKICK';
    this.time = 0;
    this.result = null;
    this.kicked = false;
    // ensure targets
    this.pass1Target = this.getReceiver().pos;
    this.ball.pos = new Vec2(this.getP1().pos.x, this.getP1().pos.y);
    this.ball.vel = Vec2.zero;
  }

  getTactic(): Tactic { return this.tactic; }
  getReceiverId(): 'P2' | 'P3' { return this.receiverId; }

  update(dt: number) {
    if (this.result) return;

    // fixed dt is expected; but we still split around kick time for determinism
    const kickTime = this.timing === 'EARLY' ? C.TIME_EARLY : C.TIME_LATE;

    let remaining = dt;
    while (remaining > 1e-6 && !this.result) {
      if (!this.kicked && this.time < kickTime) {
        const step = Math.min(remaining, kickTime - this.time);
        this.stepPreKick(step);
        this.time += step;
        remaining -= step;

        if (Math.abs(this.time - kickTime) < 1e-6) {
          this.onKick();
        }
      } else {
        // post-kick step
        this.stepPostKick(remaining);
        this.time += remaining;
        remaining = 0;
      }
    }
  }

  private stepPreKick(dt: number) {
    // Runner (P2) only moves before kick time
    const p2 = this.getP2();
    p2.pos = new Vec2(p2.pos.x, p2.pos.y + C.PLAYER_SPD * dt);

    // Man mark defender follows in all phases
    if (this.tactic === 'MAN_MARK') {
      const d1 = this.entities.find(e => e.id === 'D1' && e.type === 'ENEMY');
      if (d1) {
        const dir = p2.pos.sub(d1.pos).norm();
        d1.pos = d1.pos.add(dir.mul(this.dfSpeed * dt));
      }
    }
  }

  private onKick() {
    this.kicked = true;

    // OFFSIDE check at kick moment
    const defendersY = this.entities
      .filter(e => e.type === 'ENEMY')
      .map(e => e.pos.y)
      .sort((a, b) => b - a);

    const offsideLineY = defendersY[1] ?? 0;
    const receiver = this.getReceiver();
    if (receiver.pos.y > offsideLineY) {
      this.result = 'OFFSIDE';
      this.phase = 'DONE';
      this.ball.vel = Vec2.zero;
      return;
    }

    // set pass1 target snapshot at kick
    this.pass1Target = new Vec2(receiver.pos.x, receiver.pos.y);

    // initiate PASS1
    this.phase = 'PASS1';
    this.ball.pos = new Vec2(this.getP1().pos.x, this.getP1().pos.y);
    this.ball.vel = this.pass1Target.sub(this.ball.pos).norm().mul(C.BALL_SPD);
  }

  private stepPostKick(dt: number) {
    // tactics: sweeper GK (only if the pass end is high)
    const gk = this.getGK();
    if (this.phase === 'PASS1') {
      if (this.pass1Target.y >= 520) {
        const target = new Vec2(C.W * 0.5, 590);
        const dir = target.sub(gk.pos).norm();
        gk.pos = gk.pos.add(dir.mul(C.GK_SPD * dt));
      }
    }

    // Man mark continues
    if (this.tactic === 'MAN_MARK') {
      const p2 = this.getP2();
      const d1 = this.entities.find(e => e.id === 'D1' && e.type === 'ENEMY');
      if (d1) {
        const dir = p2.pos.sub(d1.pos).norm();
        d1.pos = d1.pos.add(dir.mul(this.dfSpeed * dt));
      }
    }

    // move ball
    const prev = new Vec2(this.ball.pos.x, this.ball.pos.y);
    const next = this.ball.pos.add(this.ball.vel.mul(dt));
    this.ball.pos = next;

    // intercept / catch (segment vs circle)
    const hit = this.checkSegmentHits(prev, next);
    if (hit) {
      this.result = hit;
      this.phase = 'DONE';
      this.ball.vel = Vec2.zero;
      return;
    }

    // phase target switching
    if (this.phase === 'PASS1') {
      if (this.ball.pos.dist(this.pass1Target) <= C.BALL_SPD * dt) {
        // arrive at receiver, start shot
        this.ball.pos = new Vec2(this.pass1Target.x, this.pass1Target.y);
        this.phase = 'PASS2';
        this.ball.vel = this.pass2Target.sub(this.ball.pos).norm().mul(C.BALL_SPD);
      }
    }

    // goal line check
    if (this.ball.pos.y >= C.GOAL_Y) {
      if (this.ball.pos.x >= C.GOAL_MIN_X && this.ball.pos.x <= C.GOAL_MAX_X) {
        this.result = 'GOAL';
      } else {
        this.result = 'MISS';
      }
      this.phase = 'DONE';
      this.ball.vel = Vec2.zero;
    }
  }

  private checkSegmentHits(prev: Vec2, next: Vec2): SimResult | null {
    // defenders
    for (const df of this.entities.filter(e => e.type === 'ENEMY')) {
      const r = (df.interceptRadius ?? C.DF_INTERCEPT_R) + C.BALL_R;
      const d = Vec2.distSegmentPoint(prev, next, df.pos);
      if (d <= r) return 'INTERCEPT';
    }
    // GK only checks against shot segment (PASS2)
    if (this.phase === 'PASS2') {
      const gk = this.getGK();
      const r = (gk.catchRadius ?? C.GK_CATCH_R) + C.BALL_R;
      const d = Vec2.distSegmentPoint(prev, next, gk.pos);
      if (d <= r) return 'GK_CATCH';
    }
    return null;
  }

  // getters
  private getP1(): Entity {
    const e = this.entities.find(x => x.id === 'P1')!;
    return e;
  }
  private getP2(): Entity {
    const e = this.entities.find(x => x.id === 'P2')!;
    return e;
  }
  private getReceiver(): Entity {
    const e = this.entities.find(x => x.id === this.receiverId)!;
    return e;
  }
  private getGK(): Entity {
    const e = this.entities.find(x => x.type === 'GK')!;
    return e;
  }
}
