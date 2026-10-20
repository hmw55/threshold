
import { describe, expect, it } from "vitest";
import { advanceGame } from "../src/game/gameEngine.js";
import { createInitialGameState } from "../src/game/gameState.js";
import { investigateAnchor } from "../src/game/anchorInvestigation.js";
import type { BoundPuzzle } from "../src/game/puzzleBinding.js";

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

describe("Find the Anchor investigation", () => {
  it("completes the interaction when the correct object is selected", () => {
    const state = createStartedGame();

    const result = investigateAnchor(
      state,
      firstPuzzle,
      "observed-3",
    );

    expect(result.correct).toBe(true);
    expect(result.state.completedInteractions).toContain(
      "inspect-anchor",
    );
    expect(result.state.phase).toBe("investigation");
  });

  it("does not advance when the wrong object is selected", () => {
    const state = createStartedGame();

    const result = investigateAnchor(
      state,
      firstPuzzle,
      "observed-4",
    );

    expect(result.correct).toBe(false);
    expect(result.state).toBe(state);
    expect(result.state.completedInteractions).toEqual([]);
  });

  it("rejects repeated successful investigations", () => {
    const state = investigateAnchor(
      createStartedGame(),
      firstPuzzle,
      "observed-3",
    ).state;

    expect(() =>
      investigateAnchor(state, firstPuzzle, "observed-3"),
    ).toThrow("Anchor has already been discovered");
  });

  it("rejects investigations before the adventure starts", () => {
    const state = createInitialGameState(
      "TEST01",
      "last-witness-v1",
    );

    expect(() =>
      investigateAnchor(state, firstPuzzle, "observed-3"),
    ).toThrow("Anchor investigation is not active");
  });

  it("rejects an unrelated puzzle binding", () => {
    const invalidPuzzle = {
      ...firstPuzzle,
      objectiveId: "contradiction",
    };

    expect(() =>
      investigateAnchor(
        createStartedGame(),
        invalidPuzzle,
        "observed-3",
      ),
    ).toThrow("Invalid anchor puzzle");
  });

  it("does not mutate the original state", () => {
    const original = createStartedGame();

    const result = investigateAnchor(
      original,
      firstPuzzle,
      "observed-3",
    );

    expect(original.completedInteractions).toEqual([]);
    expect(result.state.completedInteractions).toEqual([
      "inspect-anchor",
    ]);
  });
});
