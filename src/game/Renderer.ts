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
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    // キャンバスの内部解像度を画面サイズに合わせる
    this.canvas.width = winW * dpr;
    this.canvas.height = winH * dpr;
    
    // CSSサイズ
    this.canvas.style.width = `${winW}px`;
    this.canvas.style.height = `${winH}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    // ★重要：画面全体に収まる最大サイズ（contain）を計算
    this.scale = Math.min(
      (winW * dpr) / PITCH_W, 
      (winH * dpr) / PITCH_H
    );
    
    // 中央寄せオフセット
    this.offsetX = ((winW * dpr) - (PITCH_W * this.scale)) / 2;
    this.offsetY = ((winH * dpr) - (PITCH_H * this.scale)) / 2;

    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);
  }

  getGamePosition(clientX: number, clientY: number): Vec2 {
    const dpr = window.devicePixelRatio || 1;
    // clientX/Y は画面左上からの座標。canvasは全画面なのでそのまま使える
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
    // 余白部分の色（CSS背景となじませる）
    this.ctx.fillStyle = '#000'; 
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  drawPitch(goal: { x: number; y: number; w: number; h: number }) {
    const ctx = this.ctx;

    // 芝生（ゴール前・敵陣）
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

    // ペナルティエリア（上）
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

    // センターサークル（下・半円）
    ctx.beginPath();
    ctx.arc(PITCH_W / 2, PITCH_H, 50, Math.PI, Math.PI * 2);
    ctx.stroke();
    
    // センタースポット
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(PITCH_W / 2, PITCH_H, 4, 0, Math.PI * 2);
    ctx.fill();

    // 敵ゴール
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(goal.x, -20, goal.w, 20);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<=goal.w; i+=10) {
        ctx.moveTo(goal.x + i, -20);
        ctx.lineTo(goal.x + i, 0);
    }
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
        color = '#F1C40F'; // GK: 黄色
        stroke = '#D4AC0D';
      } else if (e.team === 'ENEMY') {
        color = '#E74C3C'; // 敵: 赤
        stroke = '#C0392B';
      } else {
        // 味方（P1, P2, P3）
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
