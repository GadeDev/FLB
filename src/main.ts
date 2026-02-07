import './style.css';
import { Renderer } from './game/Renderer';
import { Simulator } from './game/Simulator';
import { Vec2 } from './core/Vector2';
import type { LevelData, Receiver, Tactic } from './game/Types';
import { loadLevels } from './game/LevelLoader';

const PITCH_W = 360;
const PITCH_H = 720;

type UIState = {
  levels: LevelData[];
  levelIndex: number;
  receiver: Receiver;
  tactic: Tactic;
  dragging: 'P1' | 'P2' | 'P3' | null;
  cleared: boolean;
  reason: 'GOAL' | 'INTERCEPT' | 'OUT' | 'NONE';
  autoNextAt: number | null;
};

const state: UIState = {
  levels: [],
  levelIndex: 0,
  receiver: 'P2',
  tactic: 'PASS_TO_RECEIVER',
  dragging: null,
  cleared: false,
  reason: 'NONE',
  autoNextAt: null
};

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="wrap">
    <div class="topbar">
      <div class="title">LINE BREAK LAB</div>
      <div class="controls">
        <button id="prev">Prev</button>
        <div id="levelName" class="levelName">-</div>
        <button id="next">Next</button>
        <button id="reset">Reset</button>
      </div>
    </div>

    <div class="canvasWrap">
      <canvas id="c" width="${PITCH_W}" height="${PITCH_H}"></canvas>
    </div>

    <div class="bottom">
      <div class="row">
        <div class="label">Receiver</div>
        <button class="chip" id="recvP2">P2</button>
        <button class="chip" id="recvP3">P3</button>
      </div>

      <div class="row">
        <div class="label">Play</div>
        <button id="simulate" class="primary">Simulate</button>
      </div>

      <div id="msg" class="msg"></div>
      <div class="hint">Drag P1/P2/P3 to reposition. Receiver = pass target.</div>
    </div>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const renderer = new Renderer(canvas);
const sim = new Simulator();

const elPrev = document.querySelector<HTMLButtonElement>('#prev')!;
const elNext = document.querySelector<HTMLButtonElement>('#next')!;
const elReset = document.querySelector<HTMLButtonElement>('#reset')!;
const elSim = document.querySelector<HTMLButtonElement>('#simulate')!;
const elName = document.querySelector<HTMLDivElement>('#levelName')!;
const elMsg = document.querySelector<HTMLDivElement>('#msg')!;
const elP2 = document.querySelector<HTMLButtonElement>('#recvP2')!;
const elP3 = document.querySelector<HTMLButtonElement>('#recvP3')!;

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function getLevel(): LevelData {
  return state.levels[state.levelIndex];
}

function applyReceiverUI() {
  elP2.classList.toggle('active', state.receiver === 'P2');
  elP3.classList.toggle('active', state.receiver === 'P3');
}

function setMsg(text: string) {
  elMsg.textContent = text;
}

function initLevel() {
  const lv = getLevel();
  elName.textContent = `${lv.id}: ${lv.name}`;
  state.cleared = false;
  state.reason = 'NONE';
  state.autoNextAt = null;

  sim.initFromLevel(lv, state.receiver, state.tactic);
  applyReceiverUI();
  setMsg('');
}

function prevLevel() {
  state.levelIndex = (state.levelIndex - 1 + state.levels.length) % state.levels.length;
  initLevel();
}

function nextLevel() {
  state.levelIndex = (state.levelIndex + 1) % state.levels.length;
  initLevel();
}

elPrev.onclick = () => prevLevel();
elNext.onclick = () => nextLevel();
elReset.onclick = () => initLevel();

elP2.onclick = () => {
  state.receiver = 'P2';
  sim.receiver = 'P2';
  applyReceiverUI();
};
elP3.onclick = () => {
  state.receiver = 'P3';
  sim.receiver = 'P3';
  applyReceiverUI();
};

elSim.onclick = () => {
  const res = sim.run();
  state.cleared = res.cleared;
  state.reason = res.reason;

  if (res.cleared) {
    setMsg('CLEARED! Auto next...');
    // 方式A：クリア時に自動で次へ（2秒後）
    state.autoNextAt = performance.now() + 2000;
  } else {
    const map: Record<typeof res.reason, string> = {
      GOAL: 'GOAL',
      INTERCEPT: 'INTERCEPTED',
      OUT: 'OUT',
      NONE: '...'
    };
    setMsg(map[res.reason]);
  }
};

// ドラッグで選手配置
function pickEntity(x: number, y: number): 'P1' | 'P2' | 'P3' | null {
  const pos = new Vec2(x, y);
  for (const id of ['P1', 'P2', 'P3'] as const) {
    const e = sim.entities.find(en => en.id === id);
    if (!e) continue;
    if (pos.dist(e.pos) <= e.radius + 8) return id;
  }
  return null;
}

function canvasToLocal(e: PointerEvent): Vec2 {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (PITCH_W / rect.width);
  const y = (e.clientY - rect.top) * (PITCH_H / rect.height);
  return new Vec2(x, y);
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
  ent.pos = new Vec2(clamp(p.x, 10, PITCH_W - 10), clamp(p.y, 10, PITCH_H - 10));
  if (ent.id === 'P1') sim.ball = ent.pos.clone();
});

canvas.addEventListener('pointerup', e => {
  state.dragging = null;
  try {
    canvas.releasePointerCapture(e.pointerId);
  } catch {}
});

function loop() {
  renderer.clear();

  const lv = getLevel();
  renderer.drawPitch(lv.goal);
  renderer.drawEntities(sim.entities, sim.ball);

  const p1 = sim.entities.find(e => e.id === 'P1')!;
  const recv = sim.entities.find(e => e.id === state.receiver)!;
  renderer.drawArrow(p1.pos, recv.pos);

  // HUD
  const hud = `${lv.id}/${state.levels.length}  Receiver:${state.receiver}`;
  renderer.drawHud(hud);

  // Auto next
  if (state.autoNextAt && performance.now() >= state.autoNextAt) {
    state.autoNextAt = null;
    nextLevel();
  }

  requestAnimationFrame(loop);
}

async function boot() {
  state.levels = await loadLevels();
  if (!state.levels.length) throw new Error('No levels');
  initLevel();
  loop();
}
boot();
