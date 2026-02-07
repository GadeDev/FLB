import './style.css';
import { Renderer } from './game/Renderer';
import { Simulator, SimResult, PITCH_W, PITCH_H } from './game/Simulator';
import { Vec2 } from './core/Vector2';
import type { LevelData, Receiver, Tactic } from './game/Types';
import { loadLevels } from './game/LevelLoader';

type UIState = {
  levels: LevelData[];
  levelIndex: number;
  receiver: Receiver;
  tactic: Tactic;
  dragging: 'P1' | 'P2' | 'P3' | null;
  cleared: boolean;
  gameComplete: boolean;
  isRunning: boolean;
  dragOffset: Vec2;
  lastAutoMsg: string | null; // 追加: 重複表示防止
};

const state: UIState = {
  levels: [],
  levelIndex: 0,
  receiver: 'P2',
  tactic: 'MAN_MARK',
  dragging: null,
  cleared: false,
  gameComplete: false,
  isRunning: false,
  dragOffset: new Vec2(0, 0),
  lastAutoMsg: null
};

const canvas = document.querySelector<HTMLCanvasElement>('#c');
const renderer = canvas ? new Renderer(canvas) : null;
const sim = new Simulator();

if (renderer) {
  renderer.resize();
  window.addEventListener('resize', () => renderer.resize());
}

const elLevelDisplay = document.getElementById('level-display');
const btnReset = document.getElementById('btn-reset');
const btnP2 = document.getElementById('btn-p2');
const btnP3 = document.getElementById('btn-p3');
const btnTactic = document.getElementById('btn-tactic');
const btnExec = document.getElementById('btn-exec');
const btnNext = document.getElementById('btn-next');
const msgToast = document.getElementById('msg-toast');

function getLevel(): LevelData | null {
  return state.levels[state.levelIndex] || null;
}

function updateUI() {
  const lv = getLevel();
  if (!lv) return;

  if (state.gameComplete) {
    if (elLevelDisplay) elLevelDisplay.textContent = "全ステージクリア！";
    if (btnExec) {
      btnExec.textContent = "最初から";
      btnExec.style.display = 'block';
      (btnExec as HTMLButtonElement).disabled = false;
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
  
  if (btnTactic) {
    btnTactic.textContent = `TACTIC: ${state.tactic.replace('_', ' ')}`;
    (btnTactic as HTMLButtonElement).disabled = disabled;
    btnTactic.style.borderColor = state.tactic === 'MAN_MARK' ? '#00F2FF' : '#FFD700';
    btnTactic.style.color = state.tactic === 'MAN_MARK' ? '#fff' : '#FFD700';
  }

  if (btnExec) {
    btnExec.textContent = "KICK OFF";
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

  if (msg !== "全ステージクリア！") {
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
  state.lastAutoMsg = null; // リセット
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
      showToast("全ステージクリア！", true);
      updateUI();
    } else {
      showToast("GOAL!", true);
      setTimeout(() => {
        state.levelIndex++;
        initLevel();
      }, 1000);
    }
  } else {
    const msgs: Record<string, string> = {
      'INTERCEPT': 'INTERCEPTED',
      'KEEPER_SAVE': 'SAVED',
      'OUT': 'OUT OF BOUNDS',
      'OFFSIDE': 'OFFSIDE',
      'NONE': 'TIME UP'
    };
    showToast(msgs[res!] || 'MISS', false);
    
    setTimeout(() => {
      const lv = getLevel();
      if(lv) {
        sim.initFromLevel(lv, state.receiver, state.tactic);
        updateUI();
      }
    }, 1000);
  }
}

if (btnP2) btnP2.onclick = () => { if(!state.isRunning) { state.receiver = 'P2'; sim.receiver = 'P2'; updateUI(); } };
if (btnP3) btnP3.onclick = () => { if(!state.isRunning) { state.receiver = 'P3'; sim.receiver = 'P3'; updateUI(); } };
if (btnReset) btnReset.onclick = () => initLevel();
if (btnTactic) btnTactic.onclick = () => {
  if (!state.isRunning) {
    state.tactic = state.tactic === 'MAN_MARK' ? 'ZONAL' : 'MAN_MARK';
    sim.tactic = state.tactic;
    updateUI();
  }
};
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

function loop() {
  if (renderer && canvas) {
    if (state.isRunning) {
      sim.update(0.016);
      
      // ★自動判断メッセージの検知
      if (sim.autoMessage && sim.autoMessage !== state.lastAutoMsg) {
        showToast(sim.autoMessage, true);
        state.lastAutoMsg = sim.autoMessage;
      }

      if (sim.result) {
        handleResult(sim.result);
      }
    }

    renderer.clear();
    const lv = getLevel();
    if (lv) {
      renderer.drawPitch(lv.goal);
      renderer.drawEntities(sim.entities, sim.ball);
      
      // ★予定ラインの描画（Simulatorが情報を持っていれば）
      if (sim.nextActionLine) {
        renderer.drawArrow(sim.nextActionLine.from, sim.nextActionLine.to);
      }

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

function pickEntity(pos: Vec2): 'P1' | 'P2' | 'P3' | null {
  for (const id of ['P1', 'P2', 'P3'] as const) {
    const e = sim.entities.find(en => en.id === id);
    if (!e) continue;
    if (pos.dist(e.pos) <= e.radius + 30) return id;
  }
  return null;
}

if (canvas && renderer) {
  canvas.addEventListener('pointerdown', e => {
    if (state.isRunning || state.gameComplete) return;
    const p = renderer.getGamePosition(e.clientX, e.clientY);
    const id = pickEntity(p);
    if (id) {
      state.dragging = id;
      canvas.setPointerCapture(e.pointerId);
      const ent = sim.entities.find(en => en.id === id);
      if (ent) {
        state.dragOffset = ent.pos.sub(p);
        state.dragOffset.y -= 40; 
      }
    }
  });

  canvas.addEventListener('pointermove', e => {
    if (!state.dragging) return;
    const p = renderer.getGamePosition(e.clientX, e.clientY);
    const ent = sim.entities.find(en => en.id === state.dragging);
    if (!ent) return;
    
    const targetPos = p.add(state.dragOffset);
    const margin = 20;
    const x = Math.max(margin, Math.min(PITCH_W - margin, targetPos.x));
    const y = Math.max(margin, Math.min(PITCH_H - margin, targetPos.y));
    ent.pos = new Vec2(x, y);

    if (ent.id === 'P1') sim.ball = ent.pos.clone();
  });

  canvas.addEventListener('pointerup', e => {
    state.dragging = null;
    canvas.releasePointerCapture(e.pointerId);
  });
}

async function boot() {
  state.levels = await loadLevels();
  if (state.levels.length > 0) {
    initLevel();
    loop();
  }
}
boot();
