import type { GameEnding, GamePhase } from "./gameBlueprint.js";

export type MissionType =
  | "investigate"
  | "protect"
  | "conceal"
  | "collaborate"
  | "betray"
  | "reveal"
  | "decide";

export type MissionStatus =
  | "available"
  | "accepted"
  | "completed"
  | "failed";

export interface GameMission {
  id: string;
  type: MissionType;
  title: string;
  description: string;
  assignedPlayerIds: string[];
  targetPlayerId: string | null;
  objectRef: string | null;
  points: number;
  status: MissionStatus;
  private: boolean;
}

export interface GamePlayerState {
  playerId: string;
  score: number;
  completedMissionIds: string[];
}

export interface GameTvEvent {
  id: string;
  type: "transmission" | "warning" | "reveal" | "score_update";
  message: string;
  createdAt: number;
}

export interface GameInvestigation {
  playerId: string;
  objectRef: string;
  observation: string;
  createdAt: number;
  correct: boolean;
}

import type { FieldState } from "./fieldExpedition.js";

export interface GameState {
  witness?: import("./witnessExpedition.js").WitnessState;
  field?: FieldState;
  sessionCode: string;
  blueprintId: string;
  phase: GamePhase;
  /** The single public timeline consumed by both clients. `phase` remains for
   * compatibility with the original puzzle API. */
  timelinePhase?: "opening" | "investigation" | "contradiction" | "revelation" | "resolution" | "ending";
  completedObjectives: string[];
  discoveredEvidence: string[];
  completedInteractions: string[];
  ending: GameEnding | null;
  players?: GamePlayerState[];
  missions?: GameMission[];
  tvEvents?: GameTvEvent[];
  investigations?: GameInvestigation[];
}

export function createInitialGameState(
  sessionCode: string,
  blueprintId: string,
): GameState {
  return {
    sessionCode,
    blueprintId,
    phase: "opening",
    timelinePhase: "opening",
    completedObjectives: [],
    discoveredEvidence: [],
    completedInteractions: [],
    ending: null,
    players: [],
    missions: [],
    tvEvents: [],
    investigations: [],
  };
}
