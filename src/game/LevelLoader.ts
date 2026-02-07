import type { LevelData } from './Types';

export async function loadLevels(): Promise<LevelData[]> {
  try {
    // NOTE:
    // - Vite exposes the app base path via `import.meta.env.BASE_URL`.
    // - CI環境で `import.meta.env` の型が拾えず build が落ちるケースがあるため、
    //   実行時の挙動は同じに保ちつつ型チェックを確実に通すため `any` で参照します。
    const base = ((import.meta as any).env?.BASE_URL as string | undefined) ?? '/';
    const url = `${base}levels.json`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load levels.json: ${res.status}`);
    const json = (await res.json()) as LevelData[];
    return json;
  } catch (e) {
    console.error(e);
    // フォールバック（最低1面は必ず遊べる）
    const fallback: LevelData[] = [
      {
        id: 'L1',
        name: 'Tutorial',
        p1: { x: 140, y: 620 },
        p2: { x: 120, y: 460 },
        p3: { x: 260, y: 500 },
        defenders: [{ x: 220, y: 540 }],
        goal: { x: 150, y: 40, w: 160, h: 26 }
      }
    ];
    return fallback;
  }
}
