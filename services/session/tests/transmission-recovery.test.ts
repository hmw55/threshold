
import { describe, expect, it } from "vitest";
import { advanceGame } from "../src/game/gameEngine.js";
import { createInitialGameState } from "../src/game/gameState.js";
import { completeInteraction } from "../src/game/interactionService.js";
import {
  recoverTransmission,
  transmissionFragments,
} from "../src/game/transmissionRecovery.js";

function createStartedGame() {
  return advanceGame(
    createInitialGameState("TEST01", "last-witness-v1"),
    { type: "start" },
  );
}

function createGameWithAnchor() {
  return completeInteraction(
    createStartedGame(),
    "inspect-anchor",
  );
}

describe("Recover the Transmission", () => {
  it("provides three distinct fragments", () => {
    expect(transmissionFragments).toHaveLength(3);

    expect(
      new Set(transmissionFragments.map(fragment => fragment.id)).size,
    ).toBe(3);
  });

  it("recovers the transmission when the correct fragment is selected", () => {
    const result = recoverTransmission(
      createGameWithAnchor(),
      "fragment-b",
    );

    expect(result.correct).toBe(true);
    expect(result.state.completedInteractions).toEqual([
      "inspect-anchor",
      "recover-transmission",
    ]);
    expect(result.state.phase).toBe("investigation");
  });

  it("does not advance for an incorrect fragment", () => {
    const state = createGameWithAnchor();

    const result = recoverTransmission(state, "fragment-a");

    expect(result.correct).toBe(false);
    expect(result.state).toBe(state);
    expect(result.state.completedInteractions).not.toContain(
      "recover-transmission",
    );
  });

  it("requires the anchor to be discovered first", () => {
    expect(() =>
      recoverTransmission(createStartedGame(), "fragment-b"),
    ).toThrow("Anchor must be discovered first");
  });

  it("rejects repeated recovery", () => {
    const state = recoverTransmission(
      createGameWithAnchor(),
      "fragment-b",
    ).state;

    expect(() =>
      recoverTransmission(state, "fragment-b"),
    ).toThrow("Transmission has already been recovered");
  });

  it("rejects unknown fragments", () => {
    expect(() =>
      recoverTransmission(
        createGameWithAnchor(),
        "fragment-unknown",
      ),
    ).toThrow("Unknown transmission fragment");
  });

  it("rejects recovery before the adventure starts", () => {
    const state = createInitialGameState(
      "TEST01",
      "last-witness-v1",
    );

    expect(() =>
      recoverTransmission(state, "fragment-b"),
    ).toThrow("Transmission recovery is not active");
  });

  it("does not mutate the original state", () => {
    const original = createGameWithAnchor();

    const result = recoverTransmission(original, "fragment-b");

    expect(original.completedInteractions).toEqual([
      "inspect-anchor",
    ]);

    expect(result.state.completedInteractions).toContain(
      "recover-transmission",
    );
  });
});
