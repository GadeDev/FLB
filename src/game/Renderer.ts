import { Vec2 } from '../core/Vector2';
import type { Entity } from './Types';
import { PITCH_W, PITCH_H } from './Simulator';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private time = 0;
  
  // 座標変換用のパラメータを保持
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    // スケールとオフセットを計算して保存
    this.scale = Math.min(
      (rect.width * dpr) / PITCH_W, 
      (rect.height * dpr) / PITCH_H
    );
    
    this.offsetX = ((rect.width * dpr) - (PITCH_W * this.scale)) / 2;
    this.offsetY = ((rect.height * dpr) - (PITCH_H * this.scale)) / 2;

    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);
  }

  // ★重要：画面上のクリック位置をゲーム内座標に変換する
  getGamePosition(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // キャンバス上のピクセル位置（DPR考慮）
    const x = (clientX - rect.left) * dpr;
    const y = (clientY - rect.top) * dpr;

    // 逆変換： (ピクセル - オフセット) / スケール
    return new Vec2(
      (x - this.offsetX) / this.scale,
      (y - this.offsetY) / this.scale
    );
  }

  clear() {
    this.time += 0.05;
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#02050a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  drawPitch(goal: { x: number; y: number; w: number; h: number }) {
    const ctx = this.ctx;
    ctx.fillStyle = '#08131F';
    ctx.fillRect(0, 0, PITCH_W, PITCH_H);
    
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    
    ctx.strokeRect(0, 0, PITCH_W, PITCH_H);
    ctx.beginPath();
    ctx.moveTo(0, PITCH_H / 2);
    ctx.lineTo(PITCH_W, PITCH_H / 2);
    ctx.stroke();

    const centerR = PITCH_W * 0.13;
    ctx.beginPath();
    ctx.arc(PITCH_W/2, PITCH_H/2, centerR, 0, Math.PI*2);
    ctx.stroke();

    const penW = PITCH_W * 0.6;
    const penH = PITCH_W * 0.24;
    const penX = (PITCH_W - penW) / 2;
    ctx.strokeRect(penX, 0, penW, penH);

    const goalAreaW = PITCH_W * 0.27;
    const goalAreaH = PITCH_W * 0.08;
    const goalAreaX = (PITCH_W - goalAreaW) / 2;
    ctx.strokeRect(goalAreaX, 0, goalAreaW, goalAreaH);

    ctx.beginPath();
    ctx.arc(PITCH_W/2, penH, PITCH_W*0.1, 0, Math.PI, false);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 50, 50, 0.2)';
    ctx.fillRect(goal.x, goal.y - 10, goal.w, 10);
    ctx.strokeStyle = '#FF3333';
    ctx.strokeRect(goal.x, goal.y - 10, goal.w, 10);
  }

  drawEntities(entities: Entity[], ball: Vec2) {
    for (const e of entities) {
      let color = '#ccc';
      let stroke = 'rgba(255,255,255,0.5)';
      
      if (e.type === 'GK') {
        color = '#FFD700';
      } else if (e.team === 'ENEMY') {
        color = '#FF0055';
      } else {
        const blink = Math.abs(Math.sin(this.time)) * 0.5 + 0.5;
        color = `rgba(0, 242, 255, ${blink})`; 
        stroke = '#00F2FF';
      }

      this.drawCircle(e.pos, e.radius, color, stroke);
      
      this.ctx.fillStyle = '#000';
      this.ctx.font = 'bold 10px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(e.id, e.pos.x, e.pos.y);
    }
    this.drawCircle(ball, 8, '#ffffff', '#fff');
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

  private drawCircle(p: Vec2, r: number, color: string, stroke: string) {
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.strokeStyle = stroke;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }
}
