
import type { GameEnding } from "./gameBlueprint.js";
import type { GameState } from "./gameState.js";

export type GameEvent =
  | { type: "start" }
  | { type: "complete_objective"; objectiveId: string }
  | { type: "discover_evidence"; evidenceId: string }
  | { type: "choose_ending"; ending: GameEnding };

const OBJECTIVE_ORDER = [
  "first-signal",
  "contradiction",
  "missing-witness",
] as const;

export function advanceGame(
  state: GameState,
  event: GameEvent,
): GameState {
  if (state.phase === "complete") {
    throw new Error("Game is already complete");
  }

  switch (event.type) {
    case "start":
      if (state.phase !== "opening") {
        throw new Error("Game has already started");
      }

      return { ...state, phase: "investigation" };

    case "complete_objective": {
      const nextObjective = OBJECTIVE_ORDER[
        state.completedObjectives.length
      ];

      if (event.objectiveId !== nextObjective) {
        throw new Error("Objective cannot be completed yet");
      }

      const completedObjectives = [
        ...state.completedObjectives,
        event.objectiveId,
      ];

      const nextPhase =
        event.objectiveId === "first-signal"
          ? "contradiction"
          : event.objectiveId === "contradiction"
            ? "revelation"
            : "resolution";

      return {
        ...state,
        phase: nextPhase,
        completedObjectives,
      };
    }

    case "discover_evidence":
      if (state.phase === "opening") {
        throw new Error("Game has not started");
      }

      if (state.discoveredEvidence.includes(event.evidenceId)) {
        return state;
      }

      return {
        ...state,
        discoveredEvidence: [
          ...state.discoveredEvidence,
          event.evidenceId,
        ],
      };

    case "choose_ending":
      if (state.phase !== "resolution") {
        throw new Error("Final decision is not available yet");
      }

      if (
        event.ending === "reconciliation" &&
        !state.discoveredEvidence.includes("missing-testimony")
      ) {
        throw new Error("Missing testimony has not been discovered");
      }

      return {
        ...state,
        phase: "complete",
        ending: event.ending,
      };
  }
}
