import './style.css';
import { C } from './core/Constants';
import { Vec2 } from './core/Vector2';
import { AudioSynth } from './core/AudioSynth';
import { Renderer } from './game/Renderer';
import { Simulator, type SimResult } from './game/Simulator';
import { loadLevels, Placement } from './game/LevelLoader';
import type { EditStateSnapshot, LevelData } from './game/Types';

type Mode = 'MOVE' | 'PASS';
type State = 'EDIT' | 'RUN';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const audio = new AudioSynth();
const simulator = new Simulator(12345);

let level: LevelData | null = null;
let levels: LevelData[] = [];
let levelIndex = 0;

let autoNextTimer: number | null = null;

let state: State = 'EDIT';
let mode: Mode = 'MOVE';
let timing: 'EARLY' | 'LATE' = 'EARLY';
let receiver: 'P2' | 'P3' = 'P2';

let dragId: 'P1' | 'P2' | 'P3' | null = null;
let passDrag = false;

let history: EditStateSnapshot[] = [];
let initialSnapshot: EditStateSnapshot | null = null;

const elMode = document.getElementById('btn-mode') as HTMLButtonElement;
const elUndo = document.getElementById('btn-undo') as HTMLButtonElement;
const elReset = document.getElementById('btn-reset') as HTMLButtonElement;
const elTiming = document.getElementById('btn-timing') as HTMLButtonElement;
const elRun = document.getElementById('btn-run') as HTMLButtonElement;
const elRetry = document.getElementById('btn-retry') as HTMLButtonElement;
const elResult = document.getElementById('screen-result') as HTMLDivElement;
const elResultTitle = document.getElementById('result-title') as HTMLHeadingElement;
const elResultReason = document.getElementById('result-reason') as HTMLParagraphElement;
const elTactic = document.getElementById('tactic-tag') as HTMLDivElement;
const elLevelBadge = document.getElementById('level-badge') as HTMLDivElement;
const elHint = document.getElementById('hint-text') as HTMLSpanElement;

function clearAutoNext() {
  if (autoNextTimer !== null) {
    window.clearTimeout(autoNextTimer);
    autoNextTimer = null;
  }
}

function snap(): EditStateSnapshot {
  const ents = simulator.entities;
  const p1 = ents.find(e => e.id === 'P1')!.pos;
  const p2 = ents.find(e => e.id === 'P2')!.pos;
  const p3 = ents.find(e => e.id === 'P3')!.pos;
  return {
    p1: new Vec2(p1.x, p1.y),
    p2: new Vec2(p2.x, p2.y),
    p3: new Vec2(p3.x, p3.y),
    receiver
  };
}

function restore(s: EditStateSnapshot) {
  receiver = s.receiver;
  const p1 = simulator.entities.find(e => e.id === 'P1')!;
  const p2 = simulator.entities.find(e => e.id === 'P2')!;
  const p3 = simulator.entities.find(e => e.id === 'P3')!;
  p1.pos = new Vec2(s.p1.x, s.p1.y);
  p2.pos = new Vec2(s.p2.x, s.p2.y);
  p3.pos = new Vec2(s.p3.x, s.p3.y);
  simulator.setEdit(receiver);
  updateHint();
}

function pushHistory() {
  if (history.length === 0) history.push(snap());
  else {
    const last = history[history.length - 1];
    const cur = snap();
    const same =
      Math.abs(last.p1.x - cur.p1.x) < 0.01 && Math.abs(last.p1.y - cur.p1.y) < 0.01 &&
      Math.abs(last.p2.x - cur.p2.x) < 0.01 && Math.abs(last.p2.y - cur.p2.y) < 0.01 &&
      Math.abs(last.p3.x - cur.p3.x) < 0.01 && Math.abs(last.p3.y - cur.p3.y) < 0.01 &&
      last.receiver === cur.receiver;
    if (!same) history.push(cur);
  }
}

function updateHint() {
  if (state === 'RUN') {
    elHint.textContent = 'Simulation running…';
    return;
  }
  if (mode === 'MOVE') {
    elHint.textContent = 'MOVE mode: drag P1 / P2 / P3 to position.';
  } else {
    elHint.textContent = 'PASS mode: drag from P1 to P2/P3 to set receiver.';
  }
}

function setMode(m: Mode) {
  mode = m;
  elMode.textContent = m;
  updateHint();
}

function setTiming(t: 'EARLY' | 'LATE') {
  timing = t;
  elTiming.textContent = t;
  simulator.setTiming(timing);
}

function updateBadges() {
  if (!level) return;
  const suffix = levels.length >= 2 ? `  ${levelIndex + 1}/${levels.length}` : '';
  elLevelBadge.textContent = `${level.label}${suffix}`;
  elTactic.textContent = `TACTIC: ${level.tactic.replace('_', ' ')}`;
}

function makeDefaultSnapshot(): EditStateSnapshot {
  const p1 = Placement.clampToRect(new Vec2(500, 140), Placement.p1Rect);
  const p2 = Placement.clampToRect(new Vec2(460, 330), Placement.p23Rect);
  const p3 = Placement.clampToRect(new Vec2(540, 330), Placement.p23Rect);
  return { p1, p2, p3, receiver: 'P2' };
}

function loadLevelAt(index: number) {
  if (levels.length === 0) return;
  clearAutoNext();

  levelIndex = ((index % levels.length) + levels.length) % levels.length;
  level = levels[levelIndex];

  history = [];
  receiver = 'P2';
  timing = 'EARLY';
  initialSnapshot = makeDefaultSnapshot();

  hideResult();
  simulator.reset(level, { p1: initialSnapshot.p1, p2: initialSnapshot.p2, p3: initialSnapshot.p3 }, receiver);
  simulator.setTiming(timing);

  state = 'EDIT';
  setMode('MOVE');
  setTiming('EARLY');
  updateBadges();
  updateHint();
}

function nextLevel() {
  if (levels.length === 0) return;
  loadLevelAt(levelIndex + 1);
}

function findAllyAt(pos: Vec2): 'P1' | 'P2' | 'P3' | null {
  const ents = simulator.entities.filter(e => e.type === 'ALLY');
  let best: { id: any; d: number } | null = null;
  for (const e of ents) {
    const d = e.pos.dist(pos);
    if (d <= C.PLAYER_R + 12) {
      if (!best || d < best.d) best = { id: e.id, d };
    }
  }
  return best ? (best.id as any) : null;
}

function applyConstraints() {
  const p1 = simulator.entities.find(e => e.id === 'P1')!;
  const p2 = simulator.entities.find(e => e.id === 'P2')!;
  const p3 = simulator.entities.find(e => e.id === 'P3')!;
  p1.pos = Placement.clampToRect(p1.pos, Placement.p1Rect);
  p2.pos = Placement.clampToRect(p2.pos, Placement.p23Rect);
  p3.pos = Placement.clampToRect(p3.pos, Placement.p23Rect);

  const players = [p1, p2, p3];
  for (let iter = 0; iter < 3; iter++) {
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i];
        const b = players[j];
        const delta = b.pos.sub(a.pos);
        const dist = delta.len();
        const min = C.PLAYER_R * 2;
        if (dist > 0 && dist < min) {
          const push = delta.norm().mul((min - dist) * 0.5);
          a.pos = a.pos.add(push.mul(-1));
          b.pos = b.pos.add(push);
        }
      }
    }
  }

  p1.pos = Placement.clampToRect(p1.pos, Placement.p1Rect);
  p2.pos = Placement.clampToRect(p2.pos, Placement.p23Rect);
  p3.pos = Placement.clampToRect(p3.pos, Placement.p23Rect);
}

function onPointerDown(ev: PointerEvent) {
  if (state !== 'EDIT') return;
  const pos = renderer.clientToLogic(ev.clientX, ev.clientY);

  if (mode === 'MOVE') {
    const id = findAllyAt(pos);
    if (id) {
      pushHistory();
      dragId = id;
      canvas.setPointerCapture(ev.pointerId);
      audio.play('tap');
    }
  } else {
    const id = findAllyAt(pos);
    if (id === 'P1') {
      pushHistory();
      passDrag = true;
      canvas.setPointerCapture(ev.pointerId);
      audio.play('tap');
    } else if (id === 'P2' || id === 'P3') {
      pushHistory();
      receiver = id;
      simulator.setEdit(receiver);
      audio.play('tap');
      updateHint();
    }
  }
}

function onPointerMove(ev: PointerEvent) {
  if (state !== 'EDIT') return;
  const pos = renderer.clientToLogic(ev.clientX, ev.clientY);

  if (dragId) {
    const e = simulator.entities.find(x => x.id === dragId)!;
    e.pos = pos;
    applyConstraints();
  }
}

function onPointerUp(ev: PointerEvent) {
  if (state !== 'EDIT') return;
  const pos = renderer.clientToLogic(ev.clientX, ev.clientY);

  if (dragId) {
    dragId = null;
    applyConstraints();
    simulator.setEdit(receiver);
    return;
  }

  if (passDrag) {
    passDrag = false;
    const target = findAllyAt(pos);
    if (target === 'P2' || target === 'P3') {
      receiver = target;
      simulator.setEdit(receiver);
      audio.play('draw');
    }
    updateHint();
  }
}

function startRun() {
  if (!level) return;
  if (state !== 'EDIT') return;

  clearAutoNext();
  hideResult();

  applyConstraints();
  simulator.setEdit(receiver);
  simulator.setTiming(timing);
  simulator.startRun();
  state = 'RUN';
  updateHint();
  audio.play('kick');
}

function showResult(res: SimResult) {
  const reason: Record<SimResult, string> = {
    GOAL: 'PERFECT BREAK!',
    OFFSIDE: 'TOO EARLY. You were beyond the line.',
    INTERCEPT: 'BLOCKED. Defender intercepted.',
    GK_CATCH: 'SAVED. Keeper got it.',
    MISS: 'MISSED. Hit outside the goal frame.'
  };

  elResultTitle.textContent = res;
  elResultReason.textContent = reason[res];
  elResult.classList.remove('hidden');

  if (res === 'GOAL') {
    elRetry.textContent = 'NEXT';
    elRetry.onclick = () => nextLevel();
    clearAutoNext();
    autoNextTimer = window.setTimeout(() => {
      nextLevel();
    }, 900);
  } else {
    elRetry.textContent = 'RETRY';
    elRetry.onclick = () => retry();
  }

  if (res === 'GOAL') {
    audio.play('goal');
    if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
  } else {
    audio.play('whistle');
    if (navigator.vibrate) navigator.vibrate(120);
  }
}

function hideResult() {
  elResult.classList.add('hidden');
}

function retry() {
  if (!level || !initialSnapshot) return;
  clearAutoNext();
  hideResult();
  const s = snap();
  simulator.reset(level, { p1: s.p1, p2: s.p2, p3: s.p3 }, s.receiver);
  state = 'EDIT';
  updateBadges();
  updateHint();
}

function undo() {
  if (!level) return;
  if (state !== 'EDIT') return;
  if (history.length === 0) return;
  const s = history.pop()!;
  simulator.reset(level, { p1: s.p1, p2: s.p2, p3: s.p3 }, s.receiver);
  restore(s);
}

function resetAll() {
  if (!level || !initialSnapshot) return;
  if (state !== 'EDIT') return;
  history = [];
  simulator.reset(level, { p1: initialSnapshot.p1, p2: initialSnapshot.p2, p3: initialSnapshot.p3 }, initialSnapshot.receiver);
  restore(initialSnapshot);
}

async function init() {
  levels = await loadLevels();
  if (levels.length === 0) levels = [];
  loadLevelAt(0);

  elMode.addEventListener('click', () => setMode(mode === 'MOVE' ? 'PASS' : 'MOVE'));
  elUndo.addEventListener('click', undo);
  elReset.addEventListener('click', resetAll);
  elTiming.addEventListener('click', () => setTiming(timing === 'EARLY' ? 'LATE' : 'EARLY'));
  elRun.addEventListener('click', startRun);

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', () => { dragId = null; passDrag = false; });

  loop();
}

function loop() {
  requestAnimationFrame(loop);

  if (state === 'RUN') {
    simulator.update(C.DT);
    if (simulator.result) {
      state = 'EDIT';
      showResult(simulator.result);
    }
  }

  renderer.draw(simulator.entities, simulator.ball, receiver, mode, timing, simulator.result);
}

init();
