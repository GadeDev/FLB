import { Vec2 } from '../core/Vector2';
import type { LevelData, LevelsFile, Tactic } from './Types';

function toLevel(file: LevelsFile, index: number): LevelData {
  const src = file.levels[index];
  const seed = src.seed ?? 12345 + index * 1000;
  const label = src.label ?? `DAILY #${String(index + 1).padStart(3, '0')}`;
  return {
    id: src.id,
    label,
    seed,
    tactic: src.tactic as Tactic,
    defenders: src.defenders.map(d => ({
      id: d.id as any,
      x: d.x,
      y: d.y
    })),
    gk: { x: src.gk.x, y: src.gk.y }
  };
}

export function fallbackLevel(): LevelData {
  return {
    id: 'daily_001',
    label: 'DAILY #001',
    seed: 12345,
    tactic: 'HIGH_LINE',
    defenders: [
      { id: 'D1', x: 400, y: 500 },
      { id: 'D2', x: 500, y: 520 },
      { id: 'D3', x: 600, y: 500 }
    ],
    gk: { x: 500, y: 650 }
  };
}

export async function loadFirstLevel(): Promise<LevelData> {
  const levels = await loadLevels();
  return levels[0] ?? fallbackLevel();
}

/**
 * Load all levels from public/levels.json.
 *
 * IMPORTANT: use import.meta.env.BASE_URL so this works on GitHub Pages (/FLB/) and locally.
 */
export async function loadLevels(): Promise<LevelData[]> {
  try {
    const url = `${import.meta.env.BASE_URL}levels.json`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [fallbackLevel()];
    const file = (await res.json()) as LevelsFile;
    if (!file.levels || file.levels.length === 0) return [fallbackLevel()];
    return file.levels.map((_, i) => toLevel(file, i));
  } catch {
    return [fallbackLevel()];
  }
}

// Placement constraints (logic coords)
export const Placement = {
  p1Rect: { minX: 150, maxX: 850, minY: 80, maxY: 210 },
  p23Rect: { minX: 120, maxX: 880, minY: 240, maxY: 560 },
  clampToRect(p: Vec2, rect: {minX:number;maxX:number;minY:number;maxY:number}): Vec2 {
    return new Vec2(
      Math.max(rect.minX, Math.min(rect.maxX, p.x)),
      Math.max(rect.minY, Math.min(rect.maxY, p.y))
    );
  }
};
