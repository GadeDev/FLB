import type { LevelData, LevelsFile } from './Types';

const LS_KEY = 'flb_level_index';

export class StageManager {
  levels: LevelData[] = [];
  index = 0;

  get current(): LevelData {
    return this.levels[Math.max(0, Math.min(this.index, this.levels.length - 1))];
  }

  async loadAll(): Promise<void> {
    const base = (import.meta as any).env?.BASE_URL ?? '/';
    const url = base.endsWith('/') ? `${base}levels.json` : `${base}/levels.json`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`levels.json fetch failed: ${res.status}`);

    const file = (await res.json()) as LevelsFile;
    this.levels = file.levels ?? [];

    const saved = Number(localStorage.getItem(LS_KEY) ?? '0');
    this.index = Number.isFinite(saved) ? saved : 0;
    this.index = Math.max(0, Math.min(this.index, this.levels.length - 1));
  }

  setIndex(i: number) {
    this.index = Math.max(0, Math.min(i, this.levels.length - 1));
    localStorage.setItem(LS_KEY, String(this.index));
  }

  next() {
    if (this.levels.length === 0) return;
    const ni = (this.index + 1) % this.levels.length;
    this.setIndex(ni);
  }

  prev() {
    if (this.levels.length === 0) return;
    const pi = (this.index - 1 + this.levels.length) % this.levels.length;
    this.setIndex(pi);
  }

  resetProgress() {
    this.setIndex(0);
  }
}
