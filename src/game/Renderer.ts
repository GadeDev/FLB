import { C } from '../core/Constants';
import { Vec2 } from '../core/Vector2';
import type { Entity } from './Types';
import type { SimResult } from './Simulator';

type Mode = 'MOVE' | 'PASS';

// Renderer draws in LOGIC coordinates (C.W x C.H) with bottom-left origin.
// Canvas Y is flipped internally.
export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  private dpr = 1;
  private cssW = 0;
  private cssH = 0;

  private trail: Vec2[] = [];
  private lastNow = 0;
  private t = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    // alpha:false gives crisper result on mobile and avoids blending artifacts
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const aspect = C.W / C.H;
    let w = window.innerWidth;
    let h = window.innerHeight;

    // Keep a fixed aspect ratio game surface, center it via CSS.
    if (w / h > aspect) w = h * aspect;
    else h = w / aspect;

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
    const now = performance.now() / 1000;
    const dt = this.lastNow ? Math.min(0.033, now - this.lastNow) : 1 / 60;
    this.lastNow = now;
    this.t += dt;

    const ctx = this.ctx;

    // Field base
    this.drawFieldBase(ctx);
    this.drawFieldLines(ctx);

    // Tactical line
    this.drawOffsideLine(ctx, entities);

    // Planned pass lines (only when no result)
    if (!result) {
      const p1 = entities.find(e => e.id === 'P1')!;
      const r = entities.find(e => e.id === receiverId)!;
      const goal = new Vec2(C.CENTER.x, C.CENTER.y);
      this.drawPassLine(ctx, p1.pos, r.pos, C.COLOR_P_ALLY, mode === 'PASS', false);
      this.drawPassLine(ctx, r.pos, goal, C.COLOR_ACCENT, false, true);
      this.drawCornerHUD(ctx, mode, timing);
    }

    // Entities
    for (const e of entities) {
      if (e.type === 'GK') this.drawPlayer(ctx, e.pos, '#FFB000', e.id, false);
      else if (e.type === 'ENEMY') this.drawPlayer(ctx, e.pos, C.COLOR_P_ENEMY, e.id, false);
      else this.drawPlayer(ctx, e.pos, C.COLOR_P_ALLY, e.id, e.id === receiverId);
    }

    // Ball + trail
    this.trail.push(new Vec2(ball.pos.x, ball.pos.y));
    if (this.trail.length > 22) this.trail.shift();
    this.drawBall(ctx, ball.pos);

    // Result effects
    if (result === 'GOAL') this.drawGoalBurst(ctx);
  }

  private toCanvasY(yLogic: number): number {
    return C.H - yLogic;
  }

  private drawFieldBase(ctx: CanvasRenderingContext2D) {
    // A dark-blue football "lab" vibe (Supercell-style: clean + punchy)
    const g = ctx.createLinearGradient(0, 0, 0, C.H);
    g.addColorStop(0, '#06101c');
    g.addColorStop(0.55, '#08131F');
    g.addColorStop(1, '#050c16');

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, C.W, C.H);

    // Subtle stripes
    ctx.save();
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(0,242,255,0.10)' : 'rgba(255,0,85,0.08)';
      ctx.fillRect(0, (C.H / 14) * i, C.W, C.H / 14);
    }
    ctx.restore();

    // Vignette
    ctx.save();
    const vg = ctx.createRadialGradient(C.W / 2, C.H / 2, 120, C.W / 2, C.H / 2, 520);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, C.W, C.H);
    ctx.restore();
  }

  private drawFieldLines(ctx: CanvasRenderingContext2D) {
    const line = 'rgba(255,255,255,0.12)';
    const lineSoft = 'rgba(255,255,255,0.08)';

    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = line;

    // Outer border
    ctx.strokeRect(24, 24, C.W - 48, C.H - 48);

    // Halfway line
    ctx.lineWidth = 2;
    ctx.strokeStyle = lineSoft;
    ctx.beginPath();
    ctx.moveTo(24, C.H / 2);
    ctx.lineTo(C.W - 24, C.H / 2);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(C.W / 2, C.H / 2, 92, 0, Math.PI * 2);
    ctx.stroke();

    // Penalty box (top side, because goal is at logic y=700 => canvas top)
    const boxW = 360;
    const boxH = 150;
    const boxX = (C.W - boxW) / 2;
    const boxY = 24;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // 6-yard box
    const sixW = 220;
    const sixH = 70;
    const sixX = (C.W - sixW) / 2;
    const sixY = 24;
    ctx.strokeRect(sixX, sixY, sixW, sixH);

    // Goal mouth glow
    const gx = C.GOAL_MIN_X;
    const gw = C.GOAL_MAX_X - C.GOAL_MIN_X;
    const gy = 18;
    ctx.shadowBlur = 18;
    ctx.shadowColor = C.COLOR_ACCENT;
    ctx.strokeStyle = C.COLOR_ACCENT;
    ctx.lineWidth = 4;
    ctx.strokeRect(gx, gy, gw, 12);

    // Net hints
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,255,157,0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = gx + (gw / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x, gy + 12);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawOffsideLine(ctx: CanvasRenderingContext2D, entities: Entity[]) {
    // Second-highest defender Y in logic space -> convert to canvas space
    const ys = entities
      .filter(e => e.type === 'ENEMY')
      .map(e => e.pos.y)
      .sort((a, b) => b - a);

    const lineY = ys[1] ?? 0;
    const y = this.toCanvasY(lineY);

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -(this.t * 30) % 20;

    ctx.shadowBlur = 14;
    ctx.shadowColor = 'rgba(255,255,255,0.10)';

    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(C.W - 40, y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // Label pill
    const text = 'OFFSIDE LINE';
    ctx.font = '12px ui-sans-serif';
    const tw = ctx.measureText(text).width;
    const px = 44;
    const py = Math.max(36, y - 22);

    ctx.fillStyle = 'rgba(10, 14, 23, 0.55)';
    this.roundRect(ctx, px - 6, py - 14, tw + 16, 22, 10);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillText(text, px + 2, py);

    ctx.restore();
  }

  private drawPassLine(
    ctx: CanvasRenderingContext2D,
    from: Vec2,
    to: Vec2,
    color: string,
    emphasize: boolean,
    isShot: boolean
  ) {
    const x1 = from.x;
    const y1 = this.toCanvasY(from.y);
    const x2 = to.x;
    const y2 = this.toCanvasY(to.y);

    // Animated dashed (gives "flow")
    const dash = isShot ? [6, 10] : [14, 10];
    const width = isShot ? 3.5 : 5;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.globalAlpha = emphasize ? 1.0 : 0.78;
    ctx.shadowBlur = emphasize ? 26 : 18;
    ctx.shadowColor = color;

    ctx.setLineDash(dash);
    ctx.lineDashOffset = -(this.t * (isShot ? 60 : 45)) % 100;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // Arrow head
    this.drawArrowHead(ctx, x1, y1, x2, y2, color, isShot ? 10 : 12);

    ctx.restore();
  }

  private drawArrowHead(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    size: number
  ) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / len;
    const uy = dy / len;

    const bx = x2 - ux * 14;
    const by = y2 - uy * 14;

    const px = -uy;
    const py = ux;

    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(bx + px * size * 0.55, by + py * size * 0.55);
    ctx.lineTo(bx - px * size * 0.55, by - py * size * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, pos: Vec2, color: string, label: string, isSelected: boolean) {
    const x = pos.x;
    const y = this.toCanvasY(pos.y);

    // Outer glow
    ctx.save();
    ctx.shadowBlur = isSelected ? 26 : 18;
    ctx.shadowColor = color;

    // Gradient fill
    const g = ctx.createRadialGradient(x - 6, y - 6, 4, x, y, C.PLAYER_R + 6);
    g.addColorStop(0, 'rgba(255,255,255,0.22)');
    g.addColorStop(0.22, color);
    g.addColorStop(1, 'rgba(0,0,0,0.65)');

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, C.PLAYER_R + 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Edge stroke
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.stroke();

    // Selected ring
    if (isSelected) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,255,157,0.85)';
      ctx.shadowBlur = 18;
      ctx.shadowColor = 'rgba(0,255,157,0.45)';
      ctx.beginPath();
      ctx.arc(x, y, C.PLAYER_R + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '11px ui-sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + 0.5);

    ctx.restore();
  }

  private drawBall(ctx: CanvasRenderingContext2D, pos: Vec2) {
    const x = pos.x;
    const y = this.toCanvasY(pos.y);

    ctx.save();

    // Trail blobs
    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      const alpha = (i + 1) / this.trail.length;
      const r = C.BALL_R * (0.6 + alpha * 0.9);
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.18})`;
      ctx.beginPath();
      ctx.arc(p.x, this.toCanvasY(p.y), r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ball core (slight gradient)
    const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, C.BALL_R + 6);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(160,190,255,0.55)');

    ctx.fillStyle = g;
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x, y, C.BALL_R, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawGoalBurst(ctx: CanvasRenderingContext2D) {
    // Quick burst at goal center
    const cx = C.CENTER.x;
    const cy = 32;

    const pulse = 0.5 + 0.5 * Math.sin(this.t * 10);

    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.shadowBlur = 26;
    ctx.shadowColor = C.COLOR_P_ALLY;

    ctx.strokeStyle = `rgba(0,242,255,${0.7 + 0.25 * pulse})`;
    ctx.lineWidth = 4;

    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10;
      const r1 = 10;
      const r2 = 74 + pulse * 22;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }

    // Shock ring
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(0,255,157,${0.25 + 0.25 * pulse})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 46 + pulse * 18, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  private drawCornerHUD(ctx: CanvasRenderingContext2D, mode: Mode, timing: 'EARLY' | 'LATE') {
    // Small status in canvas corner (keeps "game feel" even if UI overlay is hidden)
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '12px ui-sans-serif';
    ctx.fillText(`MODE: ${mode}   TIMING: ${timing}`, 42, 34);
    ctx.restore();
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
}
