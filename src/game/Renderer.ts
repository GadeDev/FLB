import { Vec2 } from '../core/Vector2';
import type { Entity } from './Types';
import { PITCH_W, PITCH_H } from './Simulator';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private time = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    // 親要素(#app)のサイズを取得
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    
    // キャンバスの解像度をデバイスに合わせる
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    // CSS上のサイズも合わせる
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    // 描画設定リセット
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    // ★PC対応の肝：画面中央にアスペクト比維持で表示
    // 画面の幅・高さのうち、小さい方に合わせてスケールを決める
    const scale = Math.min(
      (rect.width * dpr) / PITCH_W, 
      (rect.height * dpr) / PITCH_H
    );
    
    // 中央寄せのためのオフセット計算
    const offsetX = ((rect.width * dpr) - (PITCH_W * scale)) / 2;
    const offsetY = ((rect.height * dpr) - (PITCH_H * scale)) / 2;

    this.ctx.translate(offsetX, offsetY);
    this.ctx.scale(scale, scale);
  }

  // ... (clear, drawPitch, drawEntities, drawArrow, drawCircle は変更なし) ...
  // ※前回のコードそのままでOKですが、念のため clear だけ再掲
  clear() {
    this.time += 0.05;
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#02050a'; // 背景色（CSSと合わせる）
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }
  
  // drawPitch, drawEntities... は前回のままでOK
  drawPitch(goal: { x: number; y: number; w: number; h: number }) {
    const ctx = this.ctx;
    // 背景（ピッチ内）
    ctx.fillStyle = '#08131F';
    ctx.fillRect(0, 0, PITCH_W, PITCH_H);
    
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    
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

    // ペナルティエリア（上）
    const penW = PITCH_W * 0.6;
    const penH = PITCH_W * 0.24;
    const penX = (PITCH_W - penW) / 2;
    ctx.strokeRect(penX, 0, penW, penH);

    // ゴールエリア（上）
    const goalAreaW = PITCH_W * 0.27;
    const goalAreaH = PITCH_W * 0.08;
    const goalAreaX = (PITCH_W - goalAreaW) / 2;
    ctx.strokeRect(goalAreaX, 0, goalAreaW, goalAreaH);

    // ペナルティアーク
    ctx.beginPath();
    ctx.arc(PITCH_W/2, penH, PITCH_W*0.1, 0, Math.PI, false);
    ctx.stroke();

    // 敵ゴール
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
        color = '#FFD700'; // 黄色
      } else if (e.team === 'ENEMY') {
        color = '#FF0055'; // 赤
      } else {
        // 味方（操作可能）は点滅させる
        const blink = Math.abs(Math.sin(this.time)) * 0.5 + 0.5;
        color = `rgba(0, 242, 255, ${blink})`; 
        stroke = '#00F2FF';
      }

      this.drawCircle(e.pos, e.radius, color, stroke);
      
      // ID表示
      this.ctx.fillStyle = '#000';
      this.ctx.font = 'bold 10px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(e.id, e.pos.x, e.pos.y);
    }
    // ボール
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
