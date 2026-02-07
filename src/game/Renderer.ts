import { Vec2 } from '../core/Vector2';
import type { Entity } from './Types';
import { PITCH_W, PITCH_H } from './Simulator';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private time = 0;
  
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  // 上部の余白（ゴールネット表示用）
  private readonly TOP_MARGIN = 40; 

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    this.canvas.width = winW * dpr;
    this.canvas.height = winH * dpr;
    this.canvas.style.width = `${winW}px`;
    this.canvas.style.height = `${winH}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    // ★修正: ゴールネット(-20px付近)が見えるように、論理的な高さを拡張して計算
    const logicalHeight = PITCH_H + this.TOP_MARGIN + 20; // 下にも少し余裕を

    this.scale = Math.min(
      (winW * dpr) / PITCH_W, 
      (winH * dpr) / logicalHeight
    );
    
    // 中央寄せ（上部にマージンを持たせて下にずらす）
    this.offsetX = ((winW * dpr) - (PITCH_W * this.scale)) / 2;
    this.offsetY = ((winH * dpr) - (PITCH_H * this.scale)) / 2 + (this.TOP_MARGIN * this.scale);

    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);
  }

  getGamePosition(clientX: number, clientY: number): Vec2 {
    const dpr = window.devicePixelRatio || 1;
    const x = clientX * dpr;
    const y = clientY * dpr;

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
    this.ctx.fillStyle = '#050505'; // 背景色
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  drawPitch(goal: { x: number; y: number; w: number; h: number }) {
    const ctx = this.ctx;

    // 芝生
    ctx.fillStyle = '#2E7D32'; 
    ctx.fillRect(0, 0, PITCH_W, PITCH_H);

    // 芝目ボーダー
    const stripeH = PITCH_H / 10;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) ctx.fillRect(0, i * stripeH, PITCH_W, stripeH);
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 3;

    // 外枠
    ctx.strokeRect(0, 0, PITCH_W, PITCH_H);

    // ペナルティエリア
    const penW = 220;
    const penH = 110; 
    const penX = (PITCH_W - penW) / 2;
    ctx.strokeRect(penX, 0, penW, penH);

    // ゴールエリア
    const goalAreaW = 100;
    const goalAreaH = 35;
    const goalAreaX = (PITCH_W - goalAreaW) / 2;
    ctx.strokeRect(goalAreaX, 0, goalAreaW, goalAreaH);

    // ペナルティアーク
    ctx.beginPath();
    ctx.arc(PITCH_W / 2, penH, 35, 0, Math.PI);
    ctx.stroke();

    // センターサークル
    ctx.beginPath();
    ctx.arc(PITCH_W / 2, PITCH_H, 50, Math.PI, Math.PI * 2);
    ctx.stroke();
    
    // センタースポット
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(PITCH_W / 2, PITCH_H, 4, 0, Math.PI * 2);
    ctx.fill();

    // ★敵ゴール（ネット） - Y座標マイナスエリアを描画
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(goal.x, -20, goal.w, 20); // 上に飛び出す
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // 縦線
    for(let i=0; i<=goal.w; i+=10) {
        ctx.moveTo(goal.x + i, -20);
        ctx.lineTo(goal.x + i, 0);
    }
    // 横線
    for(let j=0; j<=20; j+=5) {
        ctx.moveTo(goal.x, -j);
        ctx.lineTo(goal.x + goal.w, -j);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawEntities(entities: Entity[], ball: Vec2) {
    // 影
    this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
    for (const e of entities) {
        this.ctx.beginPath();
        this.ctx.ellipse(e.pos.x, e.pos.y + 5, e.radius, e.radius * 0.6, 0, 0, Math.PI*2);
        this.ctx.fill();
    }

    for (const e of entities) {
      let color = '#ccc';
      let stroke = '#fff';
      
      if (e.type === 'GK') {
        color = '#F1C40F';
        stroke = '#D4AC0D';
      } else if (e.team === 'ENEMY') {
        color = '#E74C3C';
        stroke = '#C0392B';
      } else {
        // 味方
        const blink = Math.abs(Math.sin(this.time * 3)) * 0.2 + 0.8;
        color = `rgba(52, 152, 219, ${blink})`;
        stroke = '#2980B9';
      }

      this.drawCircle(e.pos, e.radius, color, stroke);
      
      this.ctx.fillStyle = '#fff';
      this.ctx.font = 'bold 12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(e.id, e.pos.x, e.pos.y);
    }

    // ボール
    this.ctx.beginPath();
    this.ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2);
    this.ctx.fillStyle = '#fff';
    this.ctx.fill();
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  drawArrow(from: Vec2, to: Vec2) {
    const ctx = this.ctx;
    ctx.strokeStyle = '#F39C12';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    
    ctx.setLineDash([]);
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const head = 12;
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - head * Math.cos(angle - Math.PI/6), to.y - head * Math.sin(angle - Math.PI/6));
    ctx.lineTo(to.x - head * Math.cos(angle + Math.PI/6), to.y - head * Math.sin(angle + Math.PI/6));
    ctx.fillStyle = '#F39C12';
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
