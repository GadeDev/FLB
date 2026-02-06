import { C } from '../core/Constants';
<<<<<<< HEAD
import { Entity } from './Simulator';

export class Renderer {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  scale = 1;
=======
import { Vec2 } from '../core/Vector2';
import type { Entity } from './Types';
import type { SimResult } from './Simulator';

type Mode = 'MOVE' | 'PASS';

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  private dpr = 1;
  private cssW = 0;
  private cssH = 0;

  private trail: Vec2[] = [];
>>>>>>> e2a4063 (Initial commit: Football Line Break (PWA demo))

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
<<<<<<< HEAD
    // レスポンシブ対応 (アスペクト比維持)
=======
>>>>>>> e2a4063 (Initial commit: Football Line Break (PWA demo))
    const aspect = C.W / C.H;
    let w = window.innerWidth;
    let h = window.innerHeight;
    if (w / h > aspect) w = h * aspect;
    else h = w / aspect;
<<<<<<< HEAD
    
    this.canvas.width = C.W; // 内部解像度
    this.canvas.height = C.H;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  draw(entities: Entity[], passes: any[], time: number, result: string | null) {
    const ctx = this.ctx;
    
    // 1. Background (Grid)
    ctx.fillStyle = C.COLOR_FIELD;
    ctx.fillRect(0, 0, C.W, C.H);
    this.drawGrid();

    // 2. Goal & Lines
    ctx.strokeStyle = C.COLOR_LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, C.H - 50); ctx.lineTo(C.W, C.H - 50); // Offside Line ref
    ctx.stroke();

    // 3. Goal Area (Neon)
    ctx.shadowBlur = 20;
    ctx.shadowColor = C.COLOR_ACCENT;
    ctx.strokeStyle = C.COLOR_ACCENT;
    ctx.strokeRect(C.GOAL_MIN_X, C.H - 2, 200, 10);
    ctx.shadowBlur = 0;

    // 4. Entities
    entities.forEach(e => {
      const color = e.type === 'ALLY' ? C.COLOR_P_ALLY : 
                    e.type === 'ENEMY' ? C.COLOR_P_ENEMY : '#ffaa00';
      this.drawPlayer(e.pos.x, e.pos.y, color, e.id);
    });

    // 5. Ball & Trails (Glow)
    // ... ボール描画、軌跡エフェクト
    
    // 6. Effect (Confetti on Goal)
    if (result === 'GOAL') {
       // ... 紙吹雪パーティクル描画
    }
  }
  
  private drawPlayer(x: number, y: number, color: string, label: string) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(x, y, C.PLAYER_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // ID Label
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 4);
  }

  private drawGrid() {
    // 50px間隔の薄いグリッド
    this.ctx.strokeStyle = '#1f293733';
    this.ctx.lineWidth = 1;
    // ...
=======

    this.cssW = Math.max(1, Math.floor(w));
    this.cssH = Math.max(1, Math.floor(h));

    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;

    this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    this.canvas.width = Math.floor(C.W * this.dpr);
    this.canvas.height = Math.floor(C.H * this.dpr);

    // draw in logic coords
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  clientToLogic(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;
    const x = nx * C.W;
    const y = (1 - ny) * C.H; // invert (bottom-left origin)
    return new Vec2(x, y);
  }

  draw(
    entities: Entity[],
    ball: Entity,
    receiverId: 'P2' | 'P3',
    mode: Mode,
    timing: 'EARLY' | 'LATE',
    result: SimResult | null
  ) {
    const ctx = this.ctx;

    // background pitch
    ctx.fillStyle = C.COLOR_FIELD;
    ctx.fillRect(0, 0, C.W, C.H);

    this.drawPitch(ctx);
    this.drawOffsideLine(ctx, entities);

    // planned pass lines (only when no result)
    if (!result) {
      const p1 = entities.find(e => e.id === 'P1')!;
      const r = entities.find(e => e.id === receiverId)!;
      const goal = new Vec2(C.CENTER.x, C.CENTER.y);
      this.drawPassLine(ctx, p1.pos, r.pos, C.COLOR_P_ALLY, mode === 'PASS');
      this.drawPassLine(ctx, r.pos, goal, C.COLOR_ACCENT, false, true);
      this.drawHUDHint(ctx, mode, timing);
    }

    // entities
    for (const e of entities) {
      if (e.type === 'GK') this.drawPlayer(ctx, e.pos, '#FFB000', e.id);
      else if (e.type === 'ENEMY') this.drawPlayer(ctx, e.pos, C.COLOR_P_ENEMY, e.id);
      else this.drawPlayer(ctx, e.pos, C.COLOR_P_ALLY, e.id);
    }

    // ball + trail
    this.trail.push(new Vec2(ball.pos.x, ball.pos.y));
    if (this.trail.length > 18) this.trail.shift();
    this.drawBall(ctx, ball.pos);

    // result effects
    if (result === 'GOAL') {
      this.drawGoalBurst(ctx);
    }
  }

  private toCanvasY(yLogic: number): number {
    return C.H - yLogic;
  }

  private drawPitch(ctx: CanvasRenderingContext2D) {
    // subtle grid
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    const step = 50;
    for (let x = 0; x <= C.W; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, C.H);
      ctx.stroke();
    }
    for (let y = 0; y <= C.H; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(C.W, y);
      ctx.stroke();
    }

    // pitch border
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, C.W - 40, C.H - 40);

    // goal mouth (top)
    const gx = C.GOAL_MIN_X;
    const gy = 20;
    const gw = C.GOAL_MAX_X - C.GOAL_MIN_X;
    ctx.shadowBlur = 18;
    ctx.shadowColor = C.COLOR_ACCENT;
    ctx.strokeStyle = C.COLOR_ACCENT;
    ctx.lineWidth = 4;
    ctx.strokeRect(gx, gy, gw, 12);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private drawOffsideLine(ctx: CanvasRenderingContext2D, entities: Entity[]) {
    const ys = entities.filter(e => e.type === 'ENEMY').map(e => e.pos.y).sort((a, b) => b - a);
    const lineY = ys[1] ?? 0;
    const y = this.toCanvasY(lineY);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(C.W - 40, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '12px ui-sans-serif';
    ctx.fillText('OFFSIDE LINE', 44, y - 8);
    ctx.restore();
  }

  private drawPassLine(
    ctx: CanvasRenderingContext2D,
    from: Vec2,
    to: Vec2,
    color: string,
    emphasize: boolean,
    thin = false
  ) {
    const x1 = from.x;
    const y1 = this.toCanvasY(from.y);
    const x2 = to.x;
    const y2 = this.toCanvasY(to.y);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = thin ? 3 : 5;
    ctx.globalAlpha = emphasize ? 1.0 : 0.75;
    ctx.shadowBlur = emphasize ? 22 : 14;
    ctx.shadowColor = color;
    ctx.setLineDash(thin ? [8, 10] : []);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, pos: Vec2, color: string, label: string) {
    const x = pos.x;
    const y = this.toCanvasY(pos.y);

    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowBlur = 16;
    ctx.shadowColor = color;

    ctx.beginPath();
    ctx.arc(x, y, C.PLAYER_R, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = '11px ui-sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
    ctx.restore();
  }

  private drawBall(ctx: CanvasRenderingContext2D, pos: Vec2) {
    ctx.save();
    // trail
    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      const alpha = (i + 1) / this.trail.length;
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.25})`;
      ctx.beginPath();
      ctx.arc(p.x, this.toCanvasY(p.y), C.BALL_R * (0.6 + alpha * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }

    // ball core
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#ffffff';
    ctx.beginPath();
    ctx.arc(pos.x, this.toCanvasY(pos.y), C.BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawGoalBurst(ctx: CanvasRenderingContext2D) {
    // quick burst at goal center
    const cx = C.CENTER.x;
    const cy = 32;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.shadowBlur = 24;
    ctx.shadowColor = C.COLOR_P_ALLY;
    ctx.strokeStyle = 'rgba(0,242,255,0.9)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10;
      const r1 = 10;
      const r2 = 70;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawHUDHint(ctx: CanvasRenderingContext2D, mode: Mode, timing: 'EARLY' | 'LATE') {
    // small status in canvas corner (keeps "game feel" even if UI overlay is hidden by browser)
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '12px ui-sans-serif';
    ctx.fillText(`MODE: ${mode}   TIMING: ${timing}`, 42, 34);
    ctx.restore();
>>>>>>> e2a4063 (Initial commit: Football Line Break (PWA demo))
  }
}
