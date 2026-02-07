import { Vec2 } from '../core/Vector2';
import type { Entity } from './Types';
import { PITCH_W, PITCH_H } from './Simulator';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private time = 0;
  
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    // 親要素(#app)のサイズを基準にする
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    // 画面いっぱいに表示（アスペクト比維持）
    this.scale = Math.min(
      (rect.width * dpr) / PITCH_W, 
      (rect.height * dpr) / PITCH_H
    );
    
    this.offsetX = ((rect.width * dpr) - (PITCH_W * this.scale)) / 2;
    this.offsetY = ((rect.height * dpr) - (PITCH_H * this.scale)) / 2;

    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);
  }

  getGamePosition(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const x = (clientX - rect.left) * dpr;
    const y = (clientY - rect.top) * dpr;

    return new Vec2(
      (x - this.offsetX) / this.scale,
      (y - this.offsetY) / this.scale
    );
  }

  clear() {
    this.time += 0.05;
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    // 画面外の余白部分の描画（暗いスタジアム色）
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#121212'; 
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  drawPitch(goal: { x: number; y: number; w: number; h: number }) {
    const ctx = this.ctx;

    // --- 芝生（ストライプ模様） ---
    // ベースの芝色
    ctx.fillStyle = '#1b4d3e'; // 深い緑
    ctx.fillRect(0, 0, PITCH_W, PITCH_H);

    // 縞模様（明るい緑）を一定間隔で描く
    const stripeHeight = 60; // 縞の太さ
    ctx.fillStyle = '#235c4b'; // 少し明るい緑
    for (let y = 0; y < PITCH_H; y += stripeHeight * 2) {
        ctx.fillRect(0, y, PITCH_W, stripeHeight);
    }

    // --- ライン（発光表現） ---
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2.5;
    
    // 外枠
    ctx.strokeRect(0, 0, PITCH_W, PITCH_H);
    
    // センターライン
    ctx.beginPath();
    ctx.moveTo(0, PITCH_H / 2);
    ctx.lineTo(PITCH_W, PITCH_H / 2);
    ctx.stroke();

    // センターサークル
    const centerR = PITCH_W * 0.13;
    ctx.beginPath();
    ctx.arc(PITCH_W/2, PITCH_H/2, centerR, 0, Math.PI*2);
    ctx.stroke();

    // ペナルティエリアなど
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

    // 影のリセット（重くなるので必要なところだけ）
    ctx.shadowBlur = 0;

    // --- 敵ゴール（危険エリアっぽく） ---
    ctx.fillStyle = 'rgba(255, 50, 50, 0.3)';
    ctx.fillRect(goal.x, goal.y - 10, goal.w, 10);
    ctx.strokeStyle = '#FF4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(goal.x, goal.y - 10, goal.w, 10);
  }

  drawEntities(entities: Entity[], ball: Vec2) {
    // 選手の下に影を落とす
    this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
    for (const e of entities) {
        this.ctx.beginPath();
        this.ctx.arc(e.pos.x + 2, e.pos.y + 4, e.radius, 0, Math.PI * 2);
        this.ctx.fill();
    }

    for (const e of entities) {
      let color = '#ccc';
      let stroke = '#fff';
      let glowColor = 'rgba(255,255,255,0)';
      
      if (e.type === 'GK') {
        color = '#FFD700'; // ゴールド
        stroke = '#FFFACD';
      } else if (e.team === 'ENEMY') {
        color = '#E63946'; // 赤
        stroke = '#FF9999';
      } else if (e.type === 'P1') {
        color = '#1D3557'; // 濃紺（固定パサー）
        stroke = '#457B9D';
      } else {
        // 操作可能キャラ（点滅＋発光）
        const blink = Math.abs(Math.sin(this.time * 2)) * 0.4 + 0.6;
        color = `rgba(0, 180, 216, ${blink})`; // シアン
        stroke = '#90E0EF';
        glowColor = `rgba(0, 242, 255, ${blink * 0.6})`;
      }

      // 発光設定
      if (glowColor !== 'rgba(255,255,255,0)') {
          this.ctx.shadowBlur = 15;
          this.ctx.shadowColor = glowColor;
      } else {
          this.ctx.shadowBlur = 0;
      }

      this.drawCircle(e.pos, e.radius, color, stroke);
      
      this.ctx.shadowBlur = 0; // 文字には影をつけない
      
      // ID（背番号っぽく）
      this.ctx.fillStyle = '#fff';
      this.ctx.font = 'bold 12px "Arial", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(e.id, e.pos.x, e.pos.y);
    }

    // ボール（強く発光）
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = '#fff';
    this.drawCircle(ball, 8, '#ffffff', '#ddd');
    this.ctx.shadowBlur = 0;
  }

  drawArrow(from: Vec2, to: Vec2) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(0, 242, 255, 0.6)'; // ネオンブルー
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    
    // 矢印の先端
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const headLen = 10;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - headLen * Math.cos(angle - Math.PI / 6), to.y - headLen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - headLen * Math.cos(angle + Math.PI / 6), to.y - headLen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }

  private drawCircle(p: Vec2, r: number, color: string, stroke: string) {
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.strokeStyle = stroke;
    this.ctx.lineWidth = 3; // 枠線を少し太く
    this.ctx.stroke();
  }
}
