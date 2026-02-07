import type { LevelData } from './Types';

export async function loadLevels(): Promise<LevelData[]> {
  try {
    const env = (import.meta as any).env;
    const base = env?.BASE_URL || './';
    const url = `${base}levels.json`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Level load failed: ${res.status}`);
    const levels = await res.json();
    
    // ★重要：読み込んだデータのY座標を調整（720用データを600用に補正）
    // 単純にYを少し減らすか、比率で縮小する
    return levels.map((l: any) => ({
      ...l,
      p1: { x: l.p1.x, y: Math.min(l.p1.y, 550) }, // P1が下すぎないように
      p2: { x: l.p2.x, y: l.p2.y * 0.85 }, // 全体的に少し上へ
      p3: { x: l.p3.x, y: l.p3.y * 0.85 },
      gk: l.gk ? { x: l.gk.x, y: l.gk.y } : undefined,
      defenders: l.defenders.map((d: any) => ({ x: d.x, y: d.y * 0.9 })),
      goal: l.goal
    }));

  } catch (e) {
    console.error("Fallback levels loaded:", e);
    // 予備データ（最初から600サイズに合わせる）
    return [{
      id: 'L1', name: 'Fallback',
      p1: {x:180,y:520}, p2:{x:100,y:300}, p3:{x:260,y:300},
      gk: {x:180,y:30},
      defenders:[{x:180,y:200}], 
      goal:{x:100,y:0,w:160,h:20}
    }];
  }
}
