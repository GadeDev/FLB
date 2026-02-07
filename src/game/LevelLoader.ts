import type { LevelData } from './Types';

export async function loadLevels(): Promise<LevelData[]> {
  try {
    // Viteの環境変数からベースURLを取得（GitHub Pages対応）
    const env = (import.meta as any).env;
    const base = env?.BASE_URL || './'; // './' に変更して相対パスで探させる
    const url = `${base}levels.json`;
    
    console.log(`Loading levels from: ${url}`); // デバッグ用

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Level load failed: ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("Failed to load levels, using fallback data:", e);
    // 読み込み失敗時の予備データ（ここにもGKを追加！）
    return [{
      id: 'L1', name: 'Fallback Level',
      p1: {x:180,y:500}, p2:{x:100,y:300}, p3:{x:260,y:300},
      gk: {x:180,y:30}, // ★GK追加
      defenders:[{x:180,y:200}], 
      goal:{x:100,y:0,w:160,h:20}
    }];
  }
}
