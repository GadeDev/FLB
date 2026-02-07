export type Tactic =
  | 'HIGH_LINE'
  | 'MID_BLOCK'
  | 'LOW_BLOCK'
  | 'MAN_MARK'
  | 'ZONE'
  | 'NORMAL';

export type DefenderId = 'D1' | 'D2' | 'D3' | 'D4';

export type Entity = {
  id: string;
  kind: 'player' | 'defender' | 'gk' | 'ball';
  pos: { x: number; y: number };
};

export type LevelData = {
  id: string;
  label: string;
  seed: number;
  tactic: Tactic;
  defenders: { id: DefenderId; x: number; y: number }[];
  gk: { x: number; y: number };
};

export type LevelsFile = {
  levels: Array<{
    id: string;
    label?: string;
    seed?: number;
    tactic: Tactic;
    defenders: Array<{ id: DefenderId; x: number; y: number }>;
    gk: { x: number; y: number };
  }>;
};

export type EditStateSnapshot = {
  tactic: Tactic;
  defenders: { id: DefenderId; x: number; y: number }[];
  gk: { x: number; y: number };
};
