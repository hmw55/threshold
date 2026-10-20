
import { describe, expect, it } from "vitest";
import { advanceGame } from "../src/game/gameEngine.js";
import { createInitialGameState } from "../src/game/gameState.js";
import {
  submitPuzzleAnswer,
  submitContradictionAnswer,
  submitMissingWitnessAnswer,
} from "../src/game/gameplayService.js";
import type { BoundPuzzle } from "../src/game/puzzleBinding.js";
import { completeInteraction } from "../src/game/interactionService.js";

const firstPuzzle: BoundPuzzle = {
  puzzleId: "first-signal-puzzle",
  objectiveId: "first-signal",
  objectRef: "observed-3",
  clue: "Seek the place where a thousand voices speak, but none can answer.",
  successNarration: "The first witness awakens.",
  failureNarration: "The signal remains silent.",
};

function createStartedGame() {
  return advanceGame(
    createInitialGameState("TEST01", "last-witness-v1"),
    { type: "start" },
  );
}

function completeInteractions(
  state: ReturnType<typeof createStartedGame>,
  interactionIds: string[],
) {
  return interactionIds.reduce(
    (current, interactionId) =>
      completeInteraction(current, interactionId),
    state,
  );
}

function prepareFirstSignal() {
  return completeInteractions(createStartedGame(), [
    "inspect-anchor",
    "recover-transmission",
    "reconstruct-signal",
  ]);
}

describe("Last Witness gameplay service", () => {
  it("advances the game when the correct object is selected", () => {
    const state = prepareFirstSignal();

    const result = submitPuzzleAnswer(state, firstPuzzle, {
      type: "select_object",
      objectRef: "observed-3",
    });

    expect(result.correct).toBe(true);
    expect(result.narration).toBe(firstPuzzle.successNarration);
    expect(result.state.phase).toBe("contradiction");
    expect(result.state.completedObjectives).toEqual([
      "first-signal",
    ]);
  });

  it("does not advance the game for an incorrect object", () => {
    const state = prepareFirstSignal();

    const result = submitPuzzleAnswer(state, firstPuzzle, {
      type: "select_object",
      objectRef: "observed-4",
    });

    expect(result.correct).toBe(false);
    expect(result.narration).toBe(firstPuzzle.failureNarration);
    expect(result.state).toBe(state);
    expect(result.state.phase).toBe("investigation");
  });

  it("rejects a puzzle that is not currently active", () => {
    const state = createStartedGame();

    const inactivePuzzle: BoundPuzzle = {
      ...firstPuzzle,
      puzzleId: "contradiction-puzzle",
      objectiveId: "contradiction",
    };

    expect(() =>
      submitPuzzleAnswer(state, inactivePuzzle, {
        type: "select_object",
        objectRef: "observed-3",
      }),
    ).toThrow("Puzzle is not currently active");
  });

  it("rejects answers after the game is complete", () => {
    let state = createStartedGame();

    for (const objectiveId of [
      "first-signal",
      "contradiction",
      "missing-witness",
    ]) {
      state = advanceGame(state, {
        type: "complete_objective",
        objectiveId,
      });
    }

    state = advanceGame(state, {
      type: "choose_ending",
      ending: "preservation",
    });

    expect(() =>
      submitPuzzleAnswer(state, firstPuzzle, {
        type: "select_object",
        objectRef: "observed-3",
      }),
    ).toThrow("Game is already complete");
  });

  it("rejects replaying an already completed puzzle", () => {
    const state = submitPuzzleAnswer(
      prepareFirstSignal(),
      firstPuzzle,
      {
        type: "select_object",
        objectRef: "observed-3",
      },
    ).state;

    expect(() =>
      submitPuzzleAnswer(state, firstPuzzle, {
        type: "select_object",
        objectRef: "observed-3",
      }),
    ).toThrow("Puzzle is not currently active");
  });

  it("rejects solving a puzzle before the adventure starts", () => {
    const state = createInitialGameState(
      "TEST01",
      "last-witness-v1",
    );

    expect(() =>
      submitPuzzleAnswer(state, firstPuzzle, {
        type: "select_object",
        objectRef: "observed-3",
      }),
    ).toThrow("Puzzle is not currently active");

    expect(state.phase).toBe("opening");
    expect(state.completedObjectives).toEqual([]);
  });


  describe("The Contradiction", () => {
    function reachContradiction() {
      const first = submitPuzzleAnswer(
        prepareFirstSignal(),
        firstPuzzle,
        {
          type: "select_object",
          objectRef: "observed-3",
        },
      ).state;

      return completeInteractions(first, [
        "collect-testimonies",
        "compare-accounts",
        "reconstruct-timeline",
      ]);
    }

    it("advances to revelation when the correct witness is selected", () => {
      const state = reachContradiction();

      const result = submitContradictionAnswer(
        state,
        "witness-mara",
      );

      expect(result.correct).toBe(true);
      expect(result.state.phase).toBe("revelation");
      expect(result.state.completedObjectives).toEqual([
        "first-signal",
        "contradiction",
      ]);
    });

    it("rejects an incorrect witness without advancing", () => {
      const state = reachContradiction();

      const result = submitContradictionAnswer(
        state,
        "witness-ada",
      );

      expect(result.correct).toBe(false);
      expect(result.state).toBe(state);
      expect(result.state.phase).toBe("contradiction");
    });

    it("rejects solving the contradiction before reaching it", () => {
      const state = createStartedGame();

      expect(() =>
        submitContradictionAnswer(
          state,
          "witness-mara",
        ),
      ).toThrow(
        "Contradiction puzzle is not currently active",
      );
    });

    it("rejects replaying the contradiction", () => {
      const state = submitContradictionAnswer(
        reachContradiction(),
        "witness-mara",
      ).state;

      expect(() =>
        submitContradictionAnswer(
          state,
          "witness-mara",
        ),
      ).toThrow(
        "Contradiction puzzle is not currently active",
      );
    });

    it("rejects contradiction answers after the game ends", () => {
      let state = reachContradiction();

      state = submitContradictionAnswer(
        state,
        "witness-mara",
      ).state;

      state = advanceGame(state, {
        type: "complete_objective",
        objectiveId: "missing-witness",
      });

      state = advanceGame(state, {
        type: "choose_ending",
        ending: "preservation",
      });

      expect(() =>
        submitContradictionAnswer(
          state,
          "witness-mara",
        ),
      ).toThrow("Game is already complete");
    });
  });


  describe("Last Witness checkpoint prerequisites", () => {
    it("blocks the first signal until its investigation is complete", () => {
      const state = createStartedGame();

      expect(() =>
        submitPuzzleAnswer(state, firstPuzzle, {
          type: "select_object",
          objectRef: "observed-3",
        }),
      ).toThrow(
        "Required interaction not completed: reconstruct-signal",
      );
    });

    it("blocks the contradiction until the timeline is reconstructed", () => {
      const state = submitPuzzleAnswer(
        prepareFirstSignal(),
        firstPuzzle,
        {
          type: "select_object",
          objectRef: "observed-3",
        },
      ).state;

      expect(() =>
        submitContradictionAnswer(state, "witness-mara"),
      ).toThrow(
        "Required interaction not completed: reconstruct-timeline",
      );
    });

    it("blocks the missing witness until testimony is decoded", () => {
      let state = submitPuzzleAnswer(
        prepareFirstSignal(),
        firstPuzzle,
        {
          type: "select_object",
          objectRef: "observed-3",
        },
      ).state;

      for (const id of [
        "collect-testimonies",
        "compare-accounts",
        "reconstruct-timeline",
      ]) {
        state = completeInteraction(state, id);
      }

      state = submitContradictionAnswer(
        state,
        "witness-mara",
      ).state;

      expect(() =>
        submitMissingWitnessAnswer(
          state,
          "silent-transmission",
        ),
      ).toThrow(
        "Required interaction not completed: decode-testimony",
      );
    });
  });
});
