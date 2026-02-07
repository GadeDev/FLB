import './style.css';
import { Renderer } from './game/Renderer';
import { Simulator } from './game/Simulator';
import { Vec2 } from './core/Vector2';
import type { LevelData, Receiver, Tactic } from './game/Types';
import { loadLevels } from './game/LevelLoader';

// Constants
const PITCH_W = 360;
const PITCH_H = 720;

// Collision tuning
const COLLISION_PAD = 2; // ちょい余白

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
const canvas = document.querySelector<HTMLCanvasElement>('#c');
const renderer = canvas ? new Renderer(canvas) : null;
const sim = new Simulator();

const elLevelDisplay = document.getElementById('level-display');
const btnReset = document.getElementById('btn-reset');
const btnP2 = document.getElementById('btn-p2');
const btnP3 = document.getElementById('btn-p3');
const btnExec = document.getElementById('btn-exec');
const btnNext = document.getElementById('btn-next');
const msgToast = document.getElementById('msg-toast');

// --- Helper Functions ---
function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function getLevel(): LevelData | null {
  return state.levels[state.levelIndex] || null;
}

// 方式A：クリア時に自動で次へ
let autoNextTimer: number | null = null;
function scheduleAutoNext() {
  if (autoNextTimer !== null) window.clearTimeout(autoNextTimer);
  autoNextTimer = window.setTimeout(() => {
    if (state.levels.length <= 0) return;
    state.levelIndex = (state.levelIndex + 1) % state.levels.length;
    initLevel();
  }, 900);
}

function updateUI() {
  const lv = getLevel();
  if (!lv) return;

  if (elLevelDisplay) {
    elLevelDisplay.textContent = `LV.${String(state.levelIndex + 1).padStart(2, '0')}`;
  }

  if (btnP2) btnP2.classList.toggle('active', state.receiver === 'P2');
  if (btnP3) btnP3.classList.toggle('active', state.receiver === 'P3');

  // 方式A：Nextボタンは基本出さない（出したいならここを調整）
  if (btnNext) btnNext.classList.add('hidden');

  if (btnExec) {
    btnExec.style.display = state.cleared ? 'none' : 'block';
  }
}

function showToast(msg: string, isGood: boolean) {
  if (!msgToast) return;
  msgToast.textContent = msg;
  msgToast.classList.remove('hidden');
  msgToast.style.color = isGood ? '#00F2FF' : '#FF0055';
  msgToast.style.borderColor = isGood ? '#00F2FF' : '#FF0055';

  msgToast.style.animation = 'none';
  void msgToast.offsetWidth;
  msgToast.style.animation = 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

  setTimeout(() => {
    msgToast.classList.add('hidden');
  }, 2000);
}

function initLevel() {
  const lv = getLevel();
  if (!lv) return;

  state.cleared = false;

  // クリア→自動遷移予約が残ってたら止める
  if (autoNextTimer !== null) {
    window.clearTimeout(autoNextTimer);
    autoNextTimer = null;
  }

  sim.initFromLevel(lv, state.receiver, state.tactic);
  updateUI();
}

// --- Collision helpers (drag) ---
function isOverlappingAny(movingId: string, pos: Vec2, radius: number): boolean {
  for (const other of sim.entities) {
    if (other.id === movingId) continue;
    const minDist = radius + other.radius + COLLISION_PAD;
    if (pos.dist(other.pos) < minDist) return true;
  }
  return false;
}

// --- Event Listeners ---
if (btnP2) btnP2.onclick = () => {
  state.receiver = 'P2';
  sim.receiver = 'P2';
  updateUI();
};

if (btnP3) btnP3.onclick = () => {
  state.receiver = 'P3';
  sim.receiver = 'P3';
  updateUI();
};

if (btnReset) btnReset.onclick = () => initLevel();

// 方式Aなので基本使わないが、残しておく（テスト用）
if (btnNext) btnNext.onclick = () => {
  state.levelIndex = (state.levelIndex + 1) % state.levels.length;
  initLevel();
};

if (btnExec) btnExec.onclick = () => {
  const res = sim.run();

  if (res.cleared) {
    state.cleared = true;
    showToast('GOAL!', true);
    updateUI();

    // ✅ 方式A：クリアしたら自動で次へ
    scheduleAutoNext();
  } else {
    const msgs: Record<string, string> = {
      INTERCEPT: 'INTERCEPTED!',
      OUT: 'OUT OF BOUNDS',
      NONE: 'MISSED TARGET',
    };
    showToast(msgs[res.reason] || 'MISS', false);
  }
};

// --- Canvas Drag Interaction ---
function canvasToLocal(e: PointerEvent): Vec2 {
  if (!canvas) return new Vec2(0, 0);
  const rect = canvas.getBoundingClientRect();
  const scaleX = PITCH_W / rect.width;
  const scaleY = PITCH_H / rect.height;
  return new Vec2((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
}

function pickEntity(x: number, y: number): 'P1' | 'P2' | 'P3' | null {
  const pos = new Vec2(x, y);
  for (const id of ['P1', 'P2', 'P3'] as const) {
    const e = sim.entities.find((en) => en.id === id);
    if (!e) continue;
    if (pos.dist(e.pos) <= e.radius + 15) return id;
  }
  return null;
}

if (canvas) {
  canvas.addEventListener('pointerdown', (e) => {
    if (state.cleared) return; // クリア後は操作しない（自動遷移するため）
    const p = canvasToLocal(e);
    const id = pickEntity(p.x, p.y);
    if (id) {
      state.dragging = id;
      canvas.setPointerCapture(e.pointerId);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!state.dragging) return;
    const p = canvasToLocal(e);
    const ent = sim.entities.find((en) => en.id === state.dragging);
    if (!ent) return;

    const prev = ent.pos.clone();

    // 半径に応じて外周マージンを変える
    const margin = ent.radius + 4;
    const candidate = new Vec2(
      clamp(p.x, margin, PITCH_W - margin),
      clamp(p.y, margin, PITCH_H - margin)
    );

    // ✅ コリジョン：他のコマと重なる位置なら動かさない（元に戻す）
    if (isOverlappingAny(ent.id, candidate, ent.radius)) {
      ent.pos = prev;
      return;
    }

    ent.pos = candidate;

    if (ent.id === 'P1') sim.ball = ent.pos.clone();
  });

  canvas.addEventListener('pointerup', (e) => {
    state.dragging = null;
    canvas.releasePointerCapture(e.pointerId);
  });
}

// --- Game Loop ---
function loop() {
  if (renderer && canvas) {
    renderer.clear();

    const lv = getLevel();
    if (lv) {
      renderer.drawPitch(lv.goal);
      renderer.drawEntities(sim.entities, sim.ball);

      const p1 = sim.entities.find((en) => en.id === 'P1');
      const recv = sim.entities.find((en) => en.id === state.receiver);
      if (p1 && recv) {
        renderer.drawArrow(p1.pos, recv.pos);
      }
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
