import { Vec2 } from '../core/Vector2';
import type { Entity } from './Types';

const PITCH_W = 360;
const PITCH_H = 720;

export class Renderer {
  private ctx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  // 画面リサイズ機能
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    const scale = Math.min((rect.width * dpr) / PITCH_W, (rect.height * dpr) / PITCH_H);
    const offsetX = ((rect.width * dpr) - (PITCH_W * scale)) / 2;
    const offsetY = ((rect.height * dpr) - (PITCH_H * scale)) / 2;

    this.ctx.translate(offsetX, offsetY);
    this.ctx.scale(scale, scale);
  }

  clear() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#08131F'; 
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  drawPitch(goal: { x: number; y: number; w: number; h: number }) {
    const ctx = this.ctx;
    ctx.fillStyle = '#08131F';
    ctx.fillRect(0, 0, PITCH_W, PITCH_H);
    
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, PITCH_W - 20, PITCH_H - 20);
    
    ctx.beginPath();
    ctx.moveTo(10, PITCH_H / 2);
    ctx.lineTo(PITCH_W - 10, PITCH_H / 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 255, 157, 0.1)';
    ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
    ctx.strokeStyle = '#00FF9D';
    ctx.strokeRect(goal.x, goal.y, goal.w, goal.h);
  }

  drawEntities(entities: Entity[], ball: Vec2) {
    for (const e of entities) {
      const c = e.team === 'ALLY' ? '#00F2FF' : '#FF0055';
      this.drawCircle(e.pos, e.radius, c);
      
      this.ctx.fillStyle = '#000';
      this.ctx.font = 'bold 10px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(e.id, e.pos.x, e.pos.y);
    }
    this.drawCircle(ball, 8, '#ffffff');
  }

  drawArrow(from: Vec2, to: Vec2) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawCircle(p: Vec2, r: number, color: string) {
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }
}
