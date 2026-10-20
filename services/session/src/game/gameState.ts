import type { GameEnding, GamePhase } from "./gameBlueprint.js";

export interface GameState {
  sessionCode: string;
  blueprintId: string;
  phase: GamePhase;
  completedObjectives: string[];
  discoveredEvidence: string[];
  completedInteractions: string[];
  ending: GameEnding | null;
}

export function createInitialGameState(
  sessionCode: string,
  blueprintId: string,
): GameState {
  return {
    sessionCode,
    blueprintId,
    phase: "opening",
    completedObjectives: [],
    discoveredEvidence: [],
    completedInteractions: [],
    ending: null,
  };
}