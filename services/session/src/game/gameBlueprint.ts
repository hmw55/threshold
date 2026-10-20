export type GamePhase =
  | "opening"
  | "investigation"
  | "contradiction"
  | "revelation"
  | "resolution"
  | "complete";

export type GameEnding =
  | "preservation"
  | "fracture"
  | "reconciliation";

export interface GameObjective {
  id: string;
  phase: GamePhase;
  title: string;
  description: string;
  required: boolean;
}

export interface GameBlueprint {
  id: string;
  version: number;
  title: string;
  premise: string;
  objectives: GameObjective[];
  endings: GameEnding[];
}