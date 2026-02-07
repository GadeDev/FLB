import './style.css';
import { Renderer } from './game/Renderer';
import { Simulator } from './game/Simulator';
import { Vec2 } from './core/Vector2';
import type { LevelData, Receiver, Tactic } from './game/Types';
import { loadLevels } from './game/LevelLoader';

// Constants
const PITCH_W = 360;
const PITCH_H = 720;

// State
type UIState = {
  levels: LevelData[];
  levelIndex: number;
  receiver: Receiver;
  tactic: Tactic;
  dragging: 'P1' | 'P2' | 'P3' | null;
  cleared: boolean;
};

const state: UIState = {
  levels: [],
  levelIndex: 0,
  receiver: 'P2',
  tactic: 'PASS_TO_RECEIVER',
  dragging: null,
  cleared: false,
};

// --- DOM Elements ---
// HTMLにある要素を取得します
const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const renderer = new Renderer(canvas);
const sim = new Simulator();

const elLevelDisplay = document.getElementById('level-display')!;
const btnReset = document.getElementById('btn-reset')!;
const btnP2 = document.getElementById('btn-p2')!;
const btnP3 = document.getElementById('btn-p3')!;
const btnExec = document.getElementById('btn-exec')!;
const btnNext = document.getElementById('btn-next')!;
const msgToast = document.getElementById('msg-toast')!;

// --- Helper Functions ---
function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function getLevel(): LevelData {
  return state.levels[state.levelIndex];
}

function updateUI() {
  const lv = getLevel();
  elLevelDisplay.textContent = `LV.${String(state.levelIndex + 1).padStart(2, '0')}`;
  
  // レシーバーボタンの見た目更新
  btnP2.classList.toggle('active', state.receiver === 'P2');
  btnP3.classList.toggle('active', state.receiver === 'P3');

  // クリア時のボタン切り替え
  if (state.cleared) {
    btnNext.classList.remove('hidden');
    btnExec.style.display = 'none';
  } else {
    btnNext.classList.add('hidden');
    btnExec.style.display = 'block';
  }
}

function showToast(msg: string, isGood: boolean) {
  msgToast.textContent = msg;
  msgToast.classList.remove('hidden');
  msgToast.style.color = isGood ? '#00F2FF' : '#FF0055';
  msgToast.style.borderColor = isGood ? '#00F2FF' : '#FF0055';
  
  setTimeout(() => {
    msgToast.classList.add('hidden');
  }, 1500);
}

function initLevel() {
  const lv = getLevel();
  state.cleared = false;
  sim.initFromLevel(lv, state.receiver, state.tactic);
  updateUI();
}

// --- Event Listeners ---

btnP2.onclick = () => { state.receiver = 'P2'; sim.receiver = 'P2'; updateUI(); };
btnP3.onclick = () => { state.receiver = 'P3'; sim.receiver = 'P3'; updateUI(); };

btnReset.onclick = () => initLevel();

btnNext.onclick = () => {
  state.levelIndex = (state.levelIndex + 1) % state.levels.length;
  initLevel();
};

btnExec.onclick = () => {
  const res = sim.run();
  
  if (res.cleared) {
    state.cleared = true;
    showToast('GOAL!', true);
    updateUI(); // 次へボタンを表示
  } else {
    showToast(res.reason, false);
  }
};

// --- Canvas Drag Interaction ---
// PC/スマホ両対応の座標計算
function canvasToLocal(e: PointerEvent): Vec2 {
  const rect = canvas.getBoundingClientRect();
  // キャンバスの表示サイズと内部解像度(360x720)の比率を計算
  const scaleX = PITCH_W / rect.width;
  const scaleY = PITCH_H / rect.height;
  return new Vec2(
    (e.clientX - rect.left) * scaleX,
    (e.clientY - rect.top) * scaleY
  );
}

function pickEntity(x: number, y: number): 'P1' | 'P2' | 'P3' | null {
  const pos = new Vec2(x, y);
  for (const id of ['P1', 'P2', 'P3'] as const) {
    const e = sim.entities.find(en => en.id === id);
    if (!e) continue;
    // 当たり判定を少し大きめに（操作しやすく）
    if (pos.dist(e.pos) <= e.radius + 15) return id;
  }
  return null;
}

canvas.addEventListener('pointerdown', e => {
  const p = canvasToLocal(e);
  const id = pickEntity(p.x, p.y);
  if (id) {
    state.dragging = id;
    canvas.setPointerCapture(e.pointerId);
  }
});

canvas.addEventListener('pointermove', e => {
  if (!state.dragging) return;
  const p = canvasToLocal(e);
  const ent = sim.entities.find(en => en.id === state.dragging);
  if (!ent) return;

  // 画面外に出ないように制限
  ent.pos = new Vec2(clamp(p.x, 20, PITCH_W - 20), clamp(p.y, 20, PITCH_H - 20));

  // P1を動かしたらボールもついてくる
  if (ent.id === 'P1') sim.ball = ent.pos.clone();
});

canvas.addEventListener('pointerup', e => {
  state.dragging = null;
  canvas.releasePointerCapture(e.pointerId);
});

// --- Game Loop ---
function loop() {
  renderer.clear();

  const lv = getLevel();
  if (lv) {
    renderer.drawPitch(lv.goal);
    renderer.drawEntities(sim.entities, sim.ball);

    // パスラインのプレビュー（矢印）
    const p1 = sim.entities.find(e => e.id === 'P1');
    const recv = sim.entities.find(e => e.id === state.receiver);
    if (p1 && recv) {
      renderer.drawArrow(p1.pos, recv.pos);
    }
  }
  requestAnimationFrame(loop);
}

// --- Boot ---
async function boot() {
  state.levels = await loadLevels();
  if (state.levels.length > 0) {
    initLevel();
    loop();
  }
}
boot();
