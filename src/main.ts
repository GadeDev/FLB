import './style.css';
import { Renderer } from './game/Renderer';
import { Simulator, SimResult } from './game/Simulator';
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
  gameComplete: boolean;
  isRunning: boolean;
};

const state: UIState = {
  levels: [],
  levelIndex: 0,
  receiver: 'P2',
  tactic: 'PASS_TO_RECEIVER',
  dragging: null,
  cleared: false,
  gameComplete: false,
  isRunning: false,
};

// --- DOM Elements ---
const canvas = document.querySelector<HTMLCanvasElement>('#c');
const renderer = canvas ? new Renderer(canvas) : null;
const sim = new Simulator();

// ★ここがPC表示修正のカギです★
if (renderer) {
  renderer.resize();
  window.addEventListener('resize', () => renderer.resize());
}

const elLevelDisplay = document.getElementById('level-display');
const btnReset = document.getElementById('btn-reset');
const btnP2 = document.getElementById('btn-p2');
const btnP3 = document.getElementById('btn-p3');
const btnExec = document.getElementById('btn-exec');
const btnNext = document.getElementById('btn-next');
const msgToast = document.getElementById('msg-toast');

// --- Functions ---
function getLevel(): LevelData | null {
  return state.levels[state.levelIndex] || null;
}

function updateUI() {
  const lv = getLevel();
  if (!lv) return;

  if (state.gameComplete) {
    if (elLevelDisplay) elLevelDisplay.textContent = "COMPLETE";
    if (btnExec) {
      btnExec.textContent = "RESTART";
      btnExec.style.display = 'block';
    }
    if (btnNext) btnNext.classList.add('hidden');
    return;
  }

  if (elLevelDisplay) {
    elLevelDisplay.textContent = `LV.${String(state.levelIndex + 1).padStart(2, '0')}`;
  }
  
  const disabled = state.isRunning;
  if (btnP2) {
    btnP2.classList.toggle('active', state.receiver === 'P2');
    (btnP2 as HTMLButtonElement).disabled = disabled;
  }
  if (btnP3) {
    btnP3.classList.toggle('active', state.receiver === 'P3');
    (btnP3 as HTMLButtonElement).disabled = disabled;
  }

  if (btnExec) {
    btnExec.textContent = "EXECUTE";
    btnExec.style.display = state.cleared ? 'none' : 'block';
    (btnExec as HTMLButtonElement).disabled = disabled;
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
  state.isRunning = false;
  sim.initFromLevel(lv, state.receiver, state.tactic);
  updateUI();
}

function handleResult(res: SimResult) {
  state.isRunning = false;

  if (res === 'GOAL') {
    state.cleared = true;
    updateUI();

    const isLastLevel = state.levelIndex >= state.levels.length - 1;
    if (isLastLevel) {
      state.gameComplete = true;
      showToast("CLEAR ALL", true);
      updateUI();
    } else {
      showToast("GOAL!", true);
      setTimeout(() => {
        state.levelIndex++;
        initLevel();
      }, 900);
    }
  } else {
    const msgs: Record<string, string> = {
      'INTERCEPT': 'INTERCEPTED!',
      'OUT': 'OUT OF BOUNDS',
      'OFFSIDE': 'OFFSIDE!',
      'NONE': 'TIME UP'
    };
    showToast(msgs[res!] || 'MISS', false);
    
    setTimeout(() => {
      sim.initFromLevel(getLevel()!, state.receiver, state.tactic);
      updateUI();
    }, 1000);
  }
}

// --- Events ---
if (btnP2) btnP2.onclick = () => { if(!state.isRunning) { state.receiver = 'P2'; sim.receiver = 'P2'; updateUI(); } };
if (btnP3) btnP3.onclick = () => { if(!state.isRunning) { state.receiver = 'P3'; sim.receiver = 'P3'; updateUI(); } };
if (btnReset) btnReset.onclick = () => initLevel();

if (btnExec) btnExec.onclick = () => {
  if (state.gameComplete) {
    state.levelIndex = 0;
    state.gameComplete = false;
    msgToast?.classList.add('hidden');
    initLevel();
    return;
  }
  if (state.isRunning || state.cleared) return;

  state.isRunning = true;
  updateUI();
};

// --- Loop ---
function loop() {
  if (renderer && canvas) {
    if (state.isRunning) {
      sim.update(0.016);
      if (sim.result) {
        handleResult(sim.result);
      }
    }

    renderer.clear();
    const lv = getLevel();
    if (lv) {
      renderer.drawPitch(lv.goal);
      renderer.drawEntities(sim.entities, sim.ball);

      if (!state.isRunning && !state.gameComplete) {
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

// --- Drag ---
function canvasToLocal(e: PointerEvent): Vec2 {
  if (!canvas) return new Vec2(0,0);
  const rect = canvas.getBoundingClientRect();
  const scaleX = PITCH_W / rect.width;
  const scaleY = PITCH_H / rect.height;
  return new Vec2((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
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
    if (state.isRunning || state.gameComplete) return;
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
    
    const margin = 20;
    const x = Math.max(margin, Math.min(PITCH_W - margin, p.x));
    const y = Math.max(margin, Math.min(PITCH_H - margin, p.y));
    ent.pos = new Vec2(x, y);

    if (ent.id === 'P1') sim.ball = ent.pos.clone();
  });
  canvas.addEventListener('pointerup', e => {
    state.dragging = null;
    canvas.releasePointerCapture(e.pointerId);
  });
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
