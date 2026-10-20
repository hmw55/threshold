
import { describe, expect, it } from "vitest";
import { advanceGame } from "../src/game/gameEngine.js";
import { createInitialGameState } from "../src/game/gameState.js";
import type { GameEnding } from "../src/game/gameBlueprint.js";

function reachResolution() {
  let state = createInitialGameState("TEST01", "last-witness-v1");

  state = advanceGame(state, { type: "start" });
  state = advanceGame(state, {
    type: "complete_objective",
    objectiveId: "first-signal",
  });
  state = advanceGame(state, {
    type: "complete_objective",
    objectiveId: "contradiction",
  });
  state = advanceGame(state, {
    type: "complete_objective",
    objectiveId: "missing-witness",
  });

  return state;
}

describe("Last Witness game progression", () => {
  it("starts in the opening phase", () => {
    const state = createInitialGameState(
      "TEST01",
      "last-witness-v1",
    );

    expect(state.phase).toBe("opening");
    expect(state.completedObjectives).toEqual([]);
    expect(state.discoveredEvidence).toEqual([]);
    expect(state.ending).toBeNull();
  });

  it("starts the adventure", () => {
    const initial = createInitialGameState(
      "TEST01",
      "last-witness-v1",
    );

    const started = advanceGame(initial, { type: "start" });

    expect(started.phase).toBe("investigation");
    expect(initial.phase).toBe("opening");
  });

  it("advances through all three objectives in order", () => {
    let state = createInitialGameState(
      "TEST01",
      "last-witness-v1",
    );

    state = advanceGame(state, { type: "start" });
    expect(state.phase).toBe("investigation");

    state = advanceGame(state, {
      type: "complete_objective",
      objectiveId: "first-signal",
    });
    expect(state.phase).toBe("contradiction");

    state = advanceGame(state, {
      type: "complete_objective",
      objectiveId: "contradiction",
    });
    expect(state.phase).toBe("revelation");

    state = advanceGame(state, {
      type: "complete_objective",
      objectiveId: "missing-witness",
    });
    expect(state.phase).toBe("resolution");

    expect(state.completedObjectives).toEqual([
      "first-signal",
      "contradiction",
      "missing-witness",
    ]);
  });

  it.each(["preservation", "fracture"] as GameEnding[])(
    "allows the %s ending after completing objectives",
    (ending) => {
      const state = advanceGame(reachResolution(), {
        type: "choose_ending",
        ending,
      });

      expect(state.phase).toBe("complete");
      expect(state.ending).toBe(ending);
    },
  );

  it("unlocks reconciliation after discovering missing testimony", () => {
    let state = reachResolution();

    state = advanceGame(state, {
      type: "discover_evidence",
      evidenceId: "missing-testimony",
    });

    state = advanceGame(state, {
      type: "choose_ending",
      ending: "reconciliation",
    });

    expect(state.phase).toBe("complete");
    expect(state.ending).toBe("reconciliation");
  });

  it("rejects reconciliation without missing testimony", () => {
    expect(() =>
      advanceGame(reachResolution(), {
        type: "choose_ending",
        ending: "reconciliation",
      }),
    ).toThrow("Missing testimony has not been discovered");
  });

  it("rejects completing objectives out of order", () => {
    const initial = createInitialGameState(
      "TEST01",
      "last-witness-v1",
    );

    expect(() =>
      advanceGame(initial, {
        type: "complete_objective",
        objectiveId: "missing-witness",
      }),
    ).toThrow("Objective cannot be completed yet");
  });

  it("rejects choosing an ending before resolution", () => {
    const initial = createInitialGameState(
      "TEST01",
      "last-witness-v1",
    );

    expect(() =>
      advanceGame(initial, {
        type: "choose_ending",
        ending: "preservation",
      }),
    ).toThrow("Final decision is not available yet");
  });

  it("rejects changing a completed game", () => {
    const completed = advanceGame(reachResolution(), {
      type: "choose_ending",
      ending: "preservation",
    });

    expect(() =>
      advanceGame(completed, {
        type: "discover_evidence",
        evidenceId: "another-clue",
      }),
    ).toThrow("Game is already complete");
  });

  it("does not duplicate discovered evidence", () => {
    let state = advanceGame(
      createInitialGameState("TEST01", "last-witness-v1"),
      { type: "start" },
    );

    state = advanceGame(state, {
      type: "discover_evidence",
      evidenceId: "first-testimony",
    });

    state = advanceGame(state, {
      type: "discover_evidence",
      evidenceId: "first-testimony",
    });

    expect(state.discoveredEvidence).toEqual([
      "first-testimony",
    ]);
  });
});
