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
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    // 画面いっぱいに表示
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
    // 画面外の余白（黒帯部分）をスタジアムの床色にする
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#111'; 
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  // ★ハーフコート描画に刷新★
  drawPitch(goal: { x: number; y: number; w: number; h: number }) {
    const ctx = this.ctx;

    // --- 芝生（リアルなチェッカー模様） ---
    // ベース色
    ctx.fillStyle = '#2c5e2e'; // 落ち着いた緑
    ctx.fillRect(0, 0, PITCH_W, PITCH_H);

    // 芝目（横ストライプ）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    const stripeH = PITCH_H / 10;
    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) ctx.fillRect(0, i * stripeH, PITCH_W, stripeH);
    }

    // --- ライン描画 ---
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 0;

    // 1. 外枠（タッチライン & ゴールライン）
    ctx.strokeRect(0, 0, PITCH_W, PITCH_H);

    // 2. ペナルティエリア（上部・敵陣）
    // 実際の比率に近いサイズ感で描画
    const penW = PITCH_W * 0.7; // 幅の70%
    const penH = 130; // 16.5m相当の深さ
    const penX = (PITCH_W - penW) / 2;
    ctx.strokeRect(penX, 0, penW, penH);

    // 3. ゴールエリア（小さい枠）
    const goalAreaW = PITCH_W * 0.3;
    const goalAreaH = 45; // 5.5m相当
    const goalAreaX = (PITCH_W - goalAreaW) / 2;
    ctx.strokeRect(goalAreaX, 0, goalAreaW, goalAreaH);

    // 4. ペナルティアーク（半円）
    ctx.beginPath();
    ctx.arc(PITCH_W / 2, penH, 35, 0, Math.PI); // 半径9.15m相当
    ctx.stroke();

    // 5. ペナルティスポット
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(PITCH_W / 2, 90, 2, 0, Math.PI * 2); // ゴールから11m相当
    ctx.fill();

    // 6. コーナーアーク（左上・右上のみ）
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI / 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(PITCH_W, 0, 15, Math.PI / 2, Math.PI);
    ctx.stroke();

    // 7. ハーフウェーライン（画面最下部）
    ctx.beginPath();
    ctx.moveTo(0, PITCH_H);
    ctx.lineTo(PITCH_W, PITCH_H);
    ctx.stroke();

    // 8. センターサークル（画面下部・半円）
    ctx.beginPath();
    ctx.arc(PITCH_W / 2, PITCH_H, 50, Math.PI, Math.PI * 2);
    ctx.stroke();

    // 9. センタースポット
    ctx.beginPath();
    ctx.arc(PITCH_W / 2, PITCH_H, 3, 0, Math.PI * 2);
    ctx.fill();

    // --- 敵ゴール（ネットの表現） ---
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(goal.x, -15, goal.w, 15);
    // ネットの網目
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<=goal.w; i+=10) { // 縦線
        ctx.moveTo(goal.x + i, -15);
        ctx.lineTo(goal.x + i, 0);
    }
    for(let j=0; j<=15; j+=5) { // 横線
        ctx.moveTo(goal.x, -j);
        ctx.lineTo(goal.x + goal.w, -j);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawEntities(entities: Entity[], ball: Vec2) {
    // 影を描画（立体感）
    this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (const e of entities) {
        this.ctx.beginPath();
        this.ctx.ellipse(e.pos.x, e.pos.y + 5, e.radius, e.radius * 0.6, 0, 0, Math.PI*2);
        this.ctx.fill();
    }
    this.ctx.beginPath();
    this.ctx.ellipse(ball.x, ball.y + 3, 6, 4, 0, 0, Math.PI*2);
    this.ctx.fill();

    for (const e of entities) {
      let color = '#ccc';
      let stroke = '#fff';
      let textColor = '#fff';
      
      if (e.type === 'GK') {
        color = '#F4D03F'; // 黄色ユニ
        stroke = '#D4AC0D';
        textColor = '#000';
      } else if (e.team === 'ENEMY') {
        color = '#E74C3C'; // 赤ユニ
        stroke = '#C0392B';
      } else if (e.type === 'P1') {
        color = '#2E86C1'; // 青ユニ（パサー）
        stroke = '#1B4F72';
      } else {
        // 操作可能キャラ（点滅）
        const blink = Math.abs(Math.sin(this.time * 2)) * 0.3 + 0.7;
        color = `rgba(52, 152, 219, ${blink})`; // 明るい青
        stroke = '#AED6F1';
      }

      this.drawCircle(e.pos, e.radius, color, stroke);
      
      // 背番号
      this.ctx.fillStyle = textColor;
      this.ctx.font = 'bold 11px "Arial", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(e.id, e.pos.x, e.pos.y);
    }

    // ボール（サッカーボール風）
    this.ctx.beginPath();
    this.ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2);
    this.ctx.fillStyle = '#fff';
    this.ctx.fill();
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
    // ボールの模様（簡易）
    this.ctx.fillStyle = '#000';
    this.ctx.beginPath();
    this.ctx.arc(ball.x, ball.y, 3, 0, Math.PI*2);
    this.ctx.fill();
  }

  drawArrow(from: Vec2, to: Vec2) {
    const ctx = this.ctx;
    // ガイドラインを目立つ色に
    ctx.strokeStyle = '#F1C40F'; 
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 矢印先端
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const headLen = 12;
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - headLen * Math.cos(angle - Math.PI / 6), to.y - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(to.x - headLen * Math.cos(angle + Math.PI / 6), to.y - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = '#F1C40F';
    ctx.fill();
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
