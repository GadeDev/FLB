import type { LevelData } from './Types';

export async function loadLevels(): Promise<LevelData[]> {
  try {
    const env = (import.meta as any).env;
    const base = env?.BASE_URL || './';
    
    // ★修正：キャッシュ対策（?v=時刻）を追加して、常に最新のJSONを読むようにする
    const url = `${base}levels.json?v=${Date.now()}`;
    
    console.log(`Loading levels from: ${url}`);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Level load failed: ${res.status}`);
    const levels = await res.json();
    
    // 座標調整とGKデータの安全な取り込み
    return levels.map((l: any) => ({
      ...l,
      // フィールドサイズ(600px)に合わせてY座標を調整
      p1: { x: l.p1.x, y: Math.min(l.p1.y, 550) },
      p2: { x: l.p2.x, y: l.p2.y * 0.85 },
      p3: { x: l.p3.x, y: l.p3.y * 0.85 },
      // GKデータがあれば採用、なければ undefined (Simulatorでデフォルト生成される)
      gk: l.gk ? { x: l.gk.x, y: l.gk.y } : undefined,
      defenders: l.defenders.map((d: any) => ({ x: d.x, y: d.y * 0.9 })),
      goal: l.goal
    }));

  } catch (e) {
    console.error("Using fallback levels due to error:", e);
    // 予備データ（GK付き）
    return [{
      id: 'L1', name: 'Fallback',
      p1: {x:180,y:520}, p2:{x:100,y:300}, p3:{x:260,y:300},
      gk: {x:180,y:30}, // ★GK
      defenders:[{x:180,y:200}], 
      goal:{x:100,y:0,w:160,h:20}
    }];
  }
}
