import { Vec2 } from '../core/Vector2';
import type { Entity } from './Types';

const PITCH_W = 360;
const PITCH_H = 720;

export class Renderer {
  private ctx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    // 親要素のサイズに合わせる
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    // 描画設定（内部解像度360x720を画面いっぱいに引き伸ばす）
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scale = Math.min(rect.width / PITCH_W, rect.height / PITCH_H);
    this.ctx.scale(scale, scale);
    
    // 中央寄せ
    const offsetX = (rect.width - PITCH_W * scale) / 2 / scale;
    const offsetY = (rect.height - PITCH_H * scale) / 2 / scale;
    this.ctx.translate(offsetX, offsetY);
  }

  clear() {
    // 全体をクリア（トランスフォームの影響を受けないようにリセットしてクリア）
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#02050a'; // 余白の色
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  drawPitch(goal: { x: number; y: number; w: number; h: number }) {
    const ctx = this.ctx;
    // 芝生
    ctx.fillStyle = '#08131F';
    ctx.fillRect(0, 0, PITCH_W, PITCH_H);
    
    // ライン
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, PITCH_W - 20, PITCH_H - 20);
    ctx.beginPath();
    ctx.moveTo(10, PITCH_H / 2);
    ctx.lineTo(PITCH_W - 10, PITCH_H / 2);
    ctx.stroke();

    // ゴールエリア
    ctx.fillStyle = 'rgba(0, 255, 157, 0.1)';
    ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
    ctx.strokeStyle = '#00FF9D';
    ctx.strokeRect(goal.x, goal.y, goal.w, goal.h);
  }

  drawEntities(entities: Entity[], ball: Vec2) {
    for (const e of entities) {
      const c = e.team === 'ALLY' ? '#00F2FF' : '#FF0055';
      this.drawCircle(e.pos, e.radius, c);
      // 文字
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '10px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(e.id, e.pos.x, e.pos.y);
    }
    this.drawCircle(ball, 8, '#fff');
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
  }
}
