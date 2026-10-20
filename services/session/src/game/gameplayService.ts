
import { advanceGame } from "./gameEngine.js";
import type { GameState } from "./gameState.js";
import {
  verifyPuzzleAnswer,
  type BoundPuzzle,
  type PuzzleAnswer,
} from "./puzzleBinding.js";
import {
  contradictionPuzzle,
  verifyContradictionAnswer,
} from "./contradictionPuzzle.js";
import {
  missingWitnessPuzzle,
  verifyMissingWitnessAnswer,
} from "./missingWitnessPuzzle.js";

function requireInteraction(
  state: GameState,
  interactionId: string,
): void {
  if (!state.completedInteractions.includes(interactionId)) {
    throw new Error(
      `Required interaction not completed: ${interactionId}`,
    );
  }
}

export interface PuzzleAttemptResult {
  correct: boolean;
  narration: string;
  state: GameState;
}

export function submitPuzzleAnswer(
  state: GameState,
  puzzle: BoundPuzzle,
  answer: PuzzleAnswer,
): PuzzleAttemptResult {
  if (state.phase === "complete") {
    throw new Error("Game is already complete");
  }

  const nextObjective =
    state.completedObjectives.length === 0
      ? "first-signal"
      : state.completedObjectives.length === 1
        ? "contradiction"
        : state.completedObjectives.length === 2
          ? "missing-witness"
          : null;

  const expectedPhase =
    nextObjective === "first-signal"
      ? "investigation"
      : nextObjective === "contradiction"
        ? "contradiction"
        : nextObjective === "missing-witness"
          ? "revelation"
          : null;

  if (
    nextObjective === null ||
    puzzle.objectiveId !== nextObjective ||
    state.phase !== expectedPhase
  ) {
    throw new Error("Puzzle is not currently active");
  }

  requireInteraction(state, "reconstruct-signal");

  if (!verifyPuzzleAnswer(puzzle, answer)) {
    return {
      correct: false,
      narration: puzzle.failureNarration,
      state,
    };
  }

  return {
    correct: true,
    narration: puzzle.successNarration,
    state: advanceGame(state, {
      type: "complete_objective",
      objectiveId: puzzle.objectiveId,
    }),
  };
}


export interface ContradictionAttemptResult {
  correct: boolean;
  narration: string;
  state: GameState;
}

export function submitContradictionAnswer(
  state: GameState,
  statementId: string,
): ContradictionAttemptResult {
  if (state.phase === "complete") {
    throw new Error("Game is already complete");
  }

  if (
    state.phase !== "contradiction" ||
    !state.completedObjectives.includes("first-signal") ||
    state.completedObjectives.includes("contradiction")
  ) {
    throw new Error("Contradiction puzzle is not currently active");
  }

  requireInteraction(state, "reconstruct-timeline");

  const correct = verifyContradictionAnswer(
    contradictionPuzzle,
    statementId,
  );

  if (!correct) {
    return {
      correct: false,
      narration: contradictionPuzzle.failureNarration,
      state,
    };
  }

  return {
    correct: true,
    narration: contradictionPuzzle.successNarration,
    state: advanceGame(state, {
      type: "complete_objective",
      objectiveId: "contradiction",
    }),
  };
}


export interface MissingWitnessAttemptResult {
  correct: boolean;
  narration: string;
  state: GameState;
}

export function submitMissingWitnessAnswer(
  state: GameState,
  choiceId: string,
): MissingWitnessAttemptResult {
  if (state.phase === "complete") {
    throw new Error("Game is already complete");
  }

  if (
    state.phase !== "revelation" ||
    !state.completedObjectives.includes("first-signal") ||
    !state.completedObjectives.includes("contradiction") ||
    state.completedObjectives.includes("missing-witness")
  ) {
    throw new Error(
      "Missing Witness puzzle is not currently active",
    );
  }

  requireInteraction(state, "decode-testimony");

  const correct = verifyMissingWitnessAnswer(
    missingWitnessPuzzle,
    choiceId,
  );

  if (!correct) {
    return {
      correct: false,
      narration: missingWitnessPuzzle.failureNarration,
      state,
    };
  }

  const withEvidence = advanceGame(state, {
    type: "discover_evidence",
    evidenceId: missingWitnessPuzzle.discoveredEvidenceId,
  });

  const completed = advanceGame(withEvidence, {
    type: "complete_objective",
    objectiveId: missingWitnessPuzzle.objectiveId,
  });

  return {
    correct: true,
    narration: missingWitnessPuzzle.successNarration,
    state: completed,
  };
}
