import type { LevelData } from './Types';

export async function loadLevels(): Promise<LevelData[]> {
  try {
    // GitHub Pages対応（/FLB/などのパスを考慮）
    const base = import.meta.env.BASE_URL || '/';
    const url = `${base}levels.json`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error('Level load failed');
    return await res.json();
  } catch (e) {
    console.error(e);
    // エラー時の予備データ
    return [{
      id: 'L1', name: 'Fallback',
      p1: {x:140,y:620}, p2:{x:120,y:460}, p3:{x:260,y:500},
      defenders:[{x:200,y:530}], goal:{x:150,y:40,w:160,h:20}
    }];
  }
}
