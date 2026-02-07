import { Vec2 } from '../core/Vector2';
import type { Entity } from './Types';

const PITCH_W = 360;
const PITCH_H = 720;

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context not available');
    this.ctx = ctx;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  clear() {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
  }

  drawPitch(goal: { x: number; y: number; w: number; h: number }) {
    const { ctx } = this;

    // 背景
    ctx.fillStyle = '#0b1622';
    ctx.fillRect(0, 0, PITCH_W, PITCH_H);

    // 外枠
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, PITCH_W - 16, PITCH_H - 16);

    // センターライン
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(16, PITCH_H / 2);
    ctx.lineTo(PITCH_W - 16, PITCH_H / 2);
    ctx.stroke();

    // ゴール
    ctx.fillStyle = 'rgba(0, 255, 170, 0.18)';
    ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
    ctx.strokeStyle = 'rgba(0,255,170,0.6)';
    ctx.strokeRect(goal.x, goal.y, goal.w, goal.h);
  }

  drawEntities(entities: Entity[], ball: Vec2) {
    for (const e of entities) this.drawEntity(e);
    this.drawBall(ball);
  }

  private drawEntity(e: Entity) {
    const { ctx } = this;
    const p = e.pos;

    // チームで色分け
    const ally = e.team === 'ALLY';
    const enemy = e.team === 'ENEMY';

    ctx.beginPath();
    ctx.arc(p.x, p.y, e.radius, 0, Math.PI * 2);

    if (ally) ctx.fillStyle = 'rgba(120, 160, 255, 0.95)';
    else if (enemy) ctx.fillStyle = 'rgba(255, 120, 120, 0.95)';
    else ctx.fillStyle = 'rgba(255,255,255,0.8)';

    ctx.fill();

    // ラベル
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e.type, p.x, p.y);
  }

  private drawBall(p: Vec2) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
  }

  drawArrow(from: Vec2, to: Vec2) {
    const { ctx } = this;
    const dir = to.sub(from).norm();
    const end = to.sub(dir.mul(18));

    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    // arrow head
    const left = new Vec2(-dir.y, dir.x);
    const a = end.add(left.mul(8)).sub(dir.mul(8));
    const b = end.sub(left.mul(8)).sub(dir.mul(8));

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.closePath();
    ctx.fill();
  }

  drawHud(text: string) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(text, 12, 12);
  }
}
