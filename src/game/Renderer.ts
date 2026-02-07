import { Vec2 } from '../core/Vector2';
import type { Entity } from './Types';

const PITCH_W = 360;
const PITCH_H = 720;

export class Renderer {
  private ctx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  // ★★★ 追加された機能：画面サイズ合わせ ★★★
  resize() {
    const dpr = window.devicePixelRatio || 1;
    // 親要素（枠）のサイズを取得
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    
    // キャンバスの画素数をデバイスに合わせてクッキリさせる
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    // CSS上のサイズも合わせる
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    // 描画設定のリセット
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    // 画面中央に、比率を保って最大表示する計算
    const scale = Math.min(
      (rect.width * dpr) / PITCH_W, 
      (rect.height * dpr) / PITCH_H
    );
    
    const offsetX = ((rect.width * dpr) - (PITCH_W * scale)) / 2;
    const offsetY = ((rect.height * dpr) - (PITCH_H * scale)) / 2;

    this.ctx.translate(offsetX, offsetY);
    this.ctx.scale(scale, scale);
  }

  clear() {
    // 全体をクリア（トランスフォームの影響を受けないようにリセットしてクリア）
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // 余白の色（PC背景と同じ色になじませる）
    this.ctx.fillStyle = '#08131F'; 
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  drawPitch(goal: { x: number; y: number; w: number; h: number }) {
    const ctx = this.ctx;
    
    // ピッチ（芝生）
    ctx.fillStyle = '#08131F';
    ctx.fillRect(0, 0, PITCH_W, PITCH_H);
    
    // ライン
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, PITCH_W - 20, PITCH_H - 20);
    
    // センターライン
    ctx.beginPath();
    ctx.moveTo(10, PITCH_H / 2);
    ctx.lineTo(PITCH_W - 10, PITCH_H / 2);
    ctx.stroke();

    // センターサークル
    ctx.beginPath();
    ctx.arc(PITCH_W/2, PITCH_H/2, 40, 0, Math.PI*2);
    ctx.stroke();

    // ペナルティエリア（簡易）
    ctx.strokeRect(60, 0, 240, 100); // 上
    ctx.strokeRect(60, PITCH_H - 100, 240, 100); // 下

    // ゴールエリア
    ctx.fillStyle = 'rgba(0, 255, 157, 0.1)';
    ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
    ctx.strokeStyle = '#00FF9D';
    ctx.strokeRect(goal.x, goal.y, goal.w, goal.h);
  }

  drawEntities(entities: Entity[], ball: Vec2) {
    for (const e of entities) {
      // チーム色
      const c = e.team === 'ALLY' ? '#00F2FF' : '#FF0055';
      this.drawCircle(e.pos, e.radius, c);
      
      // 背番号/ID
      this.ctx.fillStyle = '#000'; // 文字色
      this.ctx.font = 'bold 10px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(e.id, e.pos.x, e.pos.y);
    }
    // ボール
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
    
    // 枠線
    this.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }
}
