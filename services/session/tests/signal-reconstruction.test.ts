
import { describe, expect, it } from "vitest";
import { advanceGame } from "../src/game/gameEngine.js";
import { createInitialGameState } from "../src/game/gameState.js";
import { completeInteraction } from "../src/game/interactionService.js";
import {
  reconstructSignal,
  signalFragments,
} from "../src/game/signalReconstruction.js";

function createStartedGame() {
  return advanceGame(
    createInitialGameState("TEST01", "last-witness-v1"),
    { type: "start" },
  );
}

function createGameWithTransmission() {
  let state = createStartedGame();

  state = completeInteraction(state, "inspect-anchor");
  state = completeInteraction(state, "recover-transmission");

  return state;
}

describe("Reconstruct the Signal", () => {
  it("provides three distinct fragments", () => {
    expect(signalFragments).toHaveLength(3);

    expect(
      new Set(signalFragments.map(fragment => fragment.id)).size,
    ).toBe(3);
  });

  it("completes reconstruction for the correct sequence", () => {
    const result = reconstructSignal(
      createGameWithTransmission(),
      ["voice", "event", "record"],
    );

    expect(result.correct).toBe(true);
    expect(result.state.completedInteractions).toEqual([
      "inspect-anchor",
      "recover-transmission",
      "reconstruct-signal",
    ]);
    expect(result.state.phase).toBe("investigation");
  });

  it("does not advance for an incorrect sequence", () => {
    const state = createGameWithTransmission();

    const result = reconstructSignal(
      state,
      ["event", "voice", "record"],
    );

    expect(result.correct).toBe(false);
    expect(result.state).toBe(state);
  });

  it("requires transmission recovery first", () => {
    const state = completeInteraction(
      createStartedGame(),
      "inspect-anchor",
    );

    expect(() =>
      reconstructSignal(state, ["voice", "event", "record"]),
    ).toThrow("Transmission must be recovered first");
  });

  it("rejects duplicate fragments", () => {
    expect(() =>
      reconstructSignal(
        createGameWithTransmission(),
        ["voice", "voice", "record"],
      ),
    ).toThrow("Invalid signal fragment sequence");
  });

  it("rejects missing fragments", () => {
    expect(() =>
      reconstructSignal(
        createGameWithTransmission(),
        ["voice", "event"],
      ),
    ).toThrow("Invalid signal fragment sequence");
  });

  it("rejects unknown fragments", () => {
    expect(() =>
      reconstructSignal(
        createGameWithTransmission(),
        ["voice", "event", "unknown"],
      ),
    ).toThrow("Invalid signal fragment sequence");
  });

  it("rejects repeated reconstruction", () => {
    const state = reconstructSignal(
      createGameWithTransmission(),
      ["voice", "event", "record"],
    ).state;

    expect(() =>
      reconstructSignal(state, ["voice", "event", "record"]),
    ).toThrow("Signal has already been reconstructed");
  });

  it("rejects reconstruction before the game starts", () => {
    const state = createInitialGameState(
      "TEST01",
      "last-witness-v1",
    );

    expect(() =>
      reconstructSignal(state, ["voice", "event", "record"]),
    ).toThrow("Signal reconstruction is not active");
  });

  it("does not mutate the original state", () => {
    const original = createGameWithTransmission();

    const result = reconstructSignal(
      original,
      ["voice", "event", "record"],
    );

    expect(original.completedInteractions).toEqual([
      "inspect-anchor",
      "recover-transmission",
    ]);

    expect(result.state.completedInteractions).toContain(
      "reconstruct-signal",
    );
  });
});
