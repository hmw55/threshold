
import { describe, expect, it } from "vitest";
import { advanceGame } from "../src/game/gameEngine.js";
import { createInitialGameState } from "../src/game/gameState.js";
import { completeInteraction } from "../src/game/interactionService.js";

function createStartedGame() {
  return advanceGame(
    createInitialGameState("TEST01", "last-witness-v1"),
    { type: "start" },
  );
}

describe("Last Witness interaction progression", () => {
  it("completes the first available interaction", () => {
    const state = completeInteraction(
      createStartedGame(),
      "inspect-anchor",
    );

    expect(state.completedInteractions).toEqual([
      "inspect-anchor",
    ]);
    expect(state.phase).toBe("investigation");
  });

  it("rejects interactions with missing prerequisites", () => {
    const state = createStartedGame();

    expect(() =>
      completeInteraction(state, "recover-transmission"),
    ).toThrow("Missing prerequisites: inspect-anchor");

    expect(state.completedInteractions).toEqual([]);
  });

  it("completes investigation interactions in sequence", () => {
    let state = createStartedGame();

    for (const id of [
      "inspect-anchor",
      "recover-transmission",
      "reconstruct-signal",
    ]) {
      state = completeInteraction(state, id);
    }

    expect(state.completedInteractions).toEqual([
      "inspect-anchor",
      "recover-transmission",
      "reconstruct-signal",
    ]);
  });

  it("rejects interactions from another phase", () => {
    expect(() =>
      completeInteraction(
        createStartedGame(),
        "collect-testimonies",
      ),
    ).toThrow("Interaction is not currently active");
  });

  it("rejects duplicate interactions", () => {
    const state = completeInteraction(
      createStartedGame(),
      "inspect-anchor",
    );

    expect(() =>
      completeInteraction(state, "inspect-anchor"),
    ).toThrow("Interaction has already been completed");
  });

  it("rejects unknown interactions", () => {
    expect(() =>
      completeInteraction(
        createStartedGame(),
        "invented-interaction",
      ),
    ).toThrow("Unknown interaction");
  });

  it("rejects completing interactions before the game starts", () => {
    const state = createInitialGameState(
      "TEST01",
      "last-witness-v1",
    );

    expect(() =>
      completeInteraction(state, "inspect-anchor"),
    ).toThrow("Interaction is not currently active");
  });

  it("does not mutate the original game state", () => {
    const original = createStartedGame();

    const updated = completeInteraction(
      original,
      "inspect-anchor",
    );

    expect(original.completedInteractions).toEqual([]);
    expect(updated.completedInteractions).toEqual([
      "inspect-anchor",
    ]);
  });
});
