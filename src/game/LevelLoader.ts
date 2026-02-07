import type { LevelData } from './Types';

export async function loadLevels(): Promise<LevelData[]> {
  try {
    const env = (import.meta as any).env;
    const base = env?.BASE_URL || './';
    
    // キャッシュ対策
    const url = `${base}levels.json?t=${Date.now()}`;
    
    console.log(`Loading levels from: ${url}`);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Level load failed: ${res.status}`);
    const levels = await res.json();
    
    // 座標調整
    return levels.map((l: any) => ({
      ...l,
      // ★修正: P1の位置を上に上げて(450)、下部のボタン被りを防ぐ
      p1: { x: l.p1.x, y: Math.min(l.p1.y, 450) },
      p2: { x: l.p2.x, y: l.p2.y * 0.85 },
      p3: { x: l.p3.x, y: l.p3.y * 0.85 },
      gk: l.gk ? { x: l.gk.x, y: l.gk.y } : { x: 180, y: 30 },
      defenders: l.defenders.map((d: any) => ({ x: d.x, y: d.y * 0.9 })),
      goal: l.goal
    }));

  } catch (e) {
    console.error("Using fallback levels:", e);
    // 予備データ
    return [{
      id: 'L1', name: 'Fallback',
      p1: {x:180,y:450}, // ここも修正
      p2:{x:100,y:300}, p3:{x:260,y:300},
      gk: {x:180,y:30}, 
      defenders:[{x:180,y:200}], 
      goal:{x:100,y:0,w:160,h:20}
    }];
  }
}
