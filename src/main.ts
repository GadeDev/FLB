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
  gameComplete: boolean; // 全クリフラグ
};

const state: UIState = {
  levels: [],
  levelIndex: 0,
  receiver: 'P2',
  tactic: 'PASS_TO_RECEIVER',
  dragging: null,
  cleared: false,
  gameComplete: false,
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
const btnNext = document.getElementById('btn-next'); // 保険用（通常は隠す）
const msgToast = document.getElementById('msg-toast');

// --- Helper Functions ---
function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function getLevel(): LevelData | null {
  return state.levels[state.levelIndex] || null;
}

function updateUI() {
  const lv = getLevel();
  if (!lv) return;

  // 全クリ時の表示
  if (state.gameComplete) {
    if (elLevelDisplay) elLevelDisplay.textContent = "COMPLETE";
    if (btnExec) {
      btnExec.textContent = "RESTART";
      btnExec.style.display = 'block';
    }
    if (btnNext) btnNext.classList.add('hidden');
    return;
  }

  // 通常時の表示
  if (elLevelDisplay) {
    elLevelDisplay.textContent = `LV.${String(state.levelIndex + 1).padStart(2, '0')}`;
  }
  
  if (btnP2) btnP2.classList.toggle('active', state.receiver === 'P2');
  if (btnP3) btnP3.classList.toggle('active', state.receiver === 'P3');

  if (btnExec) {
    btnExec.textContent = "EXECUTE";
    // クリア済みならボタンを隠す（自動遷移待ち）
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

  // 全クリのときは消さない（余韻）
  if (msg !== "CLEAR ALL") {
    setTimeout(() => {
      msgToast.classList.add('hidden');
    }, 1500);
  }
}

function initLevel() {
  const lv = getLevel();
  if (!lv) return;
  state.cleared = false;
  state.gameComplete = false;
  sim.initFromLevel(lv, state.receiver, state.tactic);
  updateUI();
}

// --- Event Listeners ---

if (btnP2) btnP2.onclick = () => { if(!state.gameComplete) { state.receiver = 'P2'; sim.receiver = 'P2'; updateUI(); } };
if (btnP3) btnP3.onclick = () => { if(!state.gameComplete) { state.receiver = 'P3'; sim.receiver = 'P3'; updateUI(); } };

if (btnReset) btnReset.onclick = () => initLevel();

// EXECUTEボタン（兼RESTARTボタン）
if (btnExec) btnExec.onclick = () => {
  // 全クリ状態ならリスタート
  if (state.gameComplete) {
    state.levelIndex = 0;
    state.gameComplete = false;
    msgToast?.classList.add('hidden');
    initLevel();
    return;
  }

  if (state.cleared) return; // 連打防止

  const res = sim.run();
  
  if (res.cleared) {
    state.cleared = true;
    updateUI(); // ボタンを隠す

    // 最終ステージかどうか判定
    const isLastLevel = state.levelIndex >= state.levels.length - 1;

    if (isLastLevel) {
      // 全クリア！
      state.gameComplete = true;
      showToast("CLEAR ALL", true);
      updateUI(); // RESTARTボタンを表示
    } else {
      // 通常クリア
      const msg = res.reason === 'GOAL' ? 'GOAL!' : 'NICE PASS!';
      showToast(msg, true);
      
      // 0.9秒後に次へ
      setTimeout(() => {
        state.levelIndex++;
        initLevel();
      }, 900);
    }

  } else {
    // 失敗
    const msgs: Record<string, string> = {
      'INTERCEPT': 'INTERCEPTED!',
      'OUT': 'OUT OF BOUNDS',
      'NONE': 'MISSED TARGET'
    };
    showToast(msgs[res.reason] || 'MISS', false);
  }
};

// --- Canvas Interaction ---
function canvasToLocal(e: PointerEvent): Vec2 {
  if (!canvas) return new Vec2(0,0);
  const rect = canvas.getBoundingClientRect();
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
    if (pos.dist(e.pos) <= e.radius + 15) return id;
  }
  return null;
}

if (canvas) {
  canvas.addEventListener('pointerdown', e => {
    if (state.gameComplete) return;
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

    ent.pos = new Vec2(clamp(p.x, 20, PITCH_W - 20), clamp(p.y, 20, PITCH_H - 20));

    if (ent.id === 'P1') sim.ball = ent.pos.clone();
  });

  canvas.addEventListener('pointerup', e => {
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

      if (!state.gameComplete) {
        const p1 = sim.entities.find(e => e.id === 'P1');
        const recv = sim.entities.find(e => e.id === state.receiver);
        if (p1 && recv) {
          renderer.drawArrow(p1.pos, recv.pos);
        }
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
