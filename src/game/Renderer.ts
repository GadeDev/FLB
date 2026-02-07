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
    
    // ウィンドウサイズを直接取得して、画面いっぱいに使う
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    this.canvas.width = winW * dpr;
    this.canvas.height = winH * dpr;
    this.canvas.style.width = `${winW}px`;
    this.canvas.style.height = `${winH}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    // アスペクト比を維持しつつ、画面に収まる最大サイズを計算
    this.scale = Math.min(
      (winW * dpr) / PITCH_W, 
      (winH * dpr) / PITCH_H
    );
    
    // 中央寄せ
    this.offsetX = ((winW * dpr) - (PITCH_W * this.scale)) / 2;
    this.offsetY = ((winH * dpr) - (PITCH_H * this.scale)) / 2;

    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);
  }

  getGamePosition(clientX: number, clientY: number): Vec2 {
    const dpr = window.devicePixelRatio || 1;
    // getBoundingClientRectは使わず、ウィンドウ基準で計算
    // （canvasが全画面なので clientX/Y がそのままキャンバス上の座標に近い）
    
    // キャンバスの位置（通常は(0,0)だが、念のため）
    const rect = this.canvas.getBoundingClientRect();
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
    // 画面全体を塗りつぶし（黒帯部分も含めて）
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // 背景色（CSSと合わせるか、少し暗くしてピッチを目立たせる）
    this.ctx.fillStyle = '#0a0a0a'; 
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  drawPitch(goal: { x: number; y: number; w: number; h: number }) {
    const ctx = this.ctx;

    // --- 芝生（ゴール前を強調） ---
    // ペナルティエリア内と外で色を少し変えるなどして奥行きを出す
    ctx.fillStyle = '#2e7d32'; // ベースの緑
    ctx.fillRect(0, 0, PITCH_W, PITCH_H);

    // 芝目のボーダー（横縞）
    const stripeH = PITCH_H / 12;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let i = 0; i < 12; i++) {
        if (i % 2 === 0) ctx.fillRect(0, i * stripeH, PITCH_W, stripeH);
    }

    // --- ライン描画 ---
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 3;

    // 外枠
    ctx.strokeRect(0, 0, PITCH_W, PITCH_H);

    // ペナルティエリア（上＝敵陣）
    const penW = PITCH_W * 0.7; // 幅広め
    const penH = 140; 
    const penX = (PITCH_W - penW) / 2;
    ctx.strokeRect(penX, 0, penW, penH);

    // ゴールエリア
    const goalAreaW = PITCH_W * 0.3;
    const goalAreaH = 50;
    const goalAreaX = (PITCH_W - goalAreaW) / 2;
    ctx.strokeRect(goalAreaX, 0, goalAreaW, goalAreaH);

    // ペナルティアーク
    ctx.beginPath();
    ctx.arc(PITCH_W / 2, penH, 35, 0, Math.PI);
    ctx.stroke();

    // センターサークル（手前・半円）
    ctx.beginPath();
    ctx.arc(PITCH_W / 2, PITCH_H, 60, Math.PI, Math.PI * 2);
    ctx.stroke();
    
    // ハーフウェーライン
    ctx.beginPath();
    ctx.moveTo(0, PITCH_H);
    ctx.lineTo(PITCH_W, PITCH_H);
    ctx.stroke();

    // 敵ゴール（ネット）
    ctx.save();
    ctx.fillStyle = 'rgba(200, 200, 200, 0.2)';
    ctx.fillRect(goal.x, -15, goal.w, 15);
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // ネットの網目
    for(let i=0; i<=goal.w; i+=10) {
        ctx.moveTo(goal.x + i, -15);
        ctx.lineTo(goal.x + i, 0);
    }
    for(let j=0; j<=15; j+=5) {
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
        this.ctx.ellipse(e.pos.x, e.pos.y + 4, e.radius, e.radius * 0.6, 0, 0, Math.PI*2);
        this.ctx.fill();
    }

    for (const e of entities) {
      let color = '#ccc';
      let stroke = '#fff';
      
      if (e.type === 'GK') {
        color = '#f1c40f'; // GK: 黄色
        stroke = '#f39c12';
      } else if (e.team === 'ENEMY') {
        color = '#e74c3c'; // 敵: 赤
        stroke = '#c0392b';
      } else if (e.type === 'P1') {
        // P1（パサー）も操作可能なので、P2/P3と同じ色でOK、あるいは少し変える
        // ここでは統一感を出すため味方は同じ色（青系）にします
        const blink = Math.abs(Math.sin(this.time * 2)) * 0.3 + 0.7;
        color = `rgba(52, 152, 219, ${blink})`;
        stroke = '#2980b9';
      } else {
        // P2, P3
        const blink = Math.abs(Math.sin(this.time * 2)) * 0.3 + 0.7;
        color = `rgba(52, 152, 219, ${blink})`;
        stroke = '#2980b9';
      }

      this.drawCircle(e.pos, e.radius, color, stroke);
      
      // 背番号
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
    ctx.strokeStyle = '#f1c40f'; // ガイドは黄色で見やすく
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    
    ctx.setLineDash([]);
    // 矢印の頭
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const head = 12;
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - head * Math.cos(angle - Math.PI/6), to.y - head * Math.sin(angle - Math.PI/6));
    ctx.lineTo(to.x - head * Math.cos(angle + Math.PI/6), to.y - head * Math.sin(angle + Math.PI/6));
    ctx.fillStyle = '#f1c40f';
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
