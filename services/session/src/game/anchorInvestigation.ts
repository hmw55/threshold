
import type { GameState } from "./gameState.js";
import type { BoundPuzzle } from "./puzzleBinding.js";
import { completeInteraction } from "./interactionService.js";

export interface AnchorInvestigationResult {
  correct: boolean;
  state: GameState;
  narration: string;
}

export function investigateAnchor(
  state: GameState,
  puzzle: BoundPuzzle,
  selectedObjectRef: string,
): AnchorInvestigationResult {
  if (state.phase !== "investigation") {
    throw new Error("Anchor investigation is not active");
  }

  if (state.completedInteractions.includes("inspect-anchor")) {
    throw new Error("Anchor has already been discovered");
  }

  if (puzzle.objectiveId !== "first-signal") {
    throw new Error("Invalid anchor puzzle");
  }

  if (selectedObjectRef !== puzzle.objectRef) {
    return {
      correct: false,
      state,
      narration:
        "The object holds no trace of the signal. Search again.",
    };
  }

  return {
    correct: true,
    state: completeInteraction(state, "inspect-anchor"),
    narration:
      "A faint pulse emerges from the object. Something was recorded here.",
  };
}
