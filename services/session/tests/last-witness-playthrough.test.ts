
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


function playThroughPuzzles() {
  let state = createInitialGameState(
    "TEST01",
    "last-witness-v1",
  );

  state = advanceGame(state, { type: "start" });

  // Act I: The First Signal
  for (const interactionId of [
    "inspect-anchor",
    "recover-transmission",
    "reconstruct-signal",
  ]) {
    state = completeInteraction(state, interactionId);
  }

  const first = submitPuzzleAnswer(state, firstPuzzle, {
    type: "select_object",
    objectRef: "observed-3",
  });

  expect(first.correct).toBe(true);
  expect(first.state.phase).toBe("contradiction");

  state = first.state;

  // Act II: The Contradiction
  for (const interactionId of [
    "collect-testimonies",
    "compare-accounts",
    "reconstruct-timeline",
  ]) {
    state = completeInteraction(state, interactionId);
  }

  const second = submitContradictionAnswer(
    state,
    "witness-mara",
  );

  expect(second.correct).toBe(true);
  expect(second.state.phase).toBe("revelation");

  state = second.state;

  // Act III: The Missing Witness
  for (const interactionId of [
    "inspect-archive",
    "locate-receiver",
    "decode-testimony",
  ]) {
    state = completeInteraction(state, interactionId);
  }

  const third = submitMissingWitnessAnswer(
    state,
    "silent-transmission",
  );

  expect(third.correct).toBe(true);
  expect(third.state.phase).toBe("resolution");

  return third.state;
}

describe("The Last Witness complete playthrough", () => {
  it("completes all three puzzles and discovers the missing testimony", () => {
    const state = playThroughPuzzles();

    expect(state.completedObjectives).toEqual([
      "first-signal",
      "contradiction",
      "missing-witness",
    ]);

    expect(state.discoveredEvidence).toContain(
      "missing-testimony",
    );

    expect(state.ending).toBeNull();
  });

  it.each([
    "preservation",
    "fracture",
    "reconciliation",
  ] as const)("can complete the %s ending", (ending) => {
    const state = playThroughPuzzles();

    const completed = advanceGame(state, {
      type: "choose_ending",
      ending,
    });

    expect(completed.phase).toBe("complete");
    expect(completed.ending).toBe(ending);
    expect(completed.completedObjectives).toHaveLength(3);
  });

  it("does not advance after an incorrect final answer", () => {
    let state = createInitialGameState(
      "TEST01",
      "last-witness-v1",
    );

    state = advanceGame(state, { type: "start" });

    for (const id of [
      "inspect-anchor",
      "recover-transmission",
      "reconstruct-signal",
    ]) {
      state = completeInteraction(state, id);
    }

    state = submitPuzzleAnswer(state, firstPuzzle, {
      type: "select_object",
      objectRef: "observed-3",
    }).state;

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

    for (const id of [
      "inspect-archive",
      "locate-receiver",
      "decode-testimony",
    ]) {
      state = completeInteraction(state, id);
    }

    const result = submitMissingWitnessAnswer(
      state,
      "mara-lied",
    );

    expect(result.correct).toBe(false);
    expect(result.state.phase).toBe("revelation");
    expect(result.state.discoveredEvidence).not.toContain(
      "missing-testimony",
    );
    expect(result.state.completedObjectives).toHaveLength(2);
  });

  it("cannot choose an ending before solving the final puzzle", () => {
    const state = advanceGame(
      createInitialGameState("TEST01", "last-witness-v1"),
      { type: "start" },
    );

    expect(() =>
      advanceGame(state, {
        type: "choose_ending",
        ending: "reconciliation",
      }),
    ).toThrow("Final decision is not available yet");
  });
});
