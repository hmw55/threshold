
import { beforeEach, describe, expect, it } from "vitest";
import { advanceGame } from "../src/game/gameEngine.js";
import { createInitialGameState } from "../src/game/gameState.js";
import {
  clearSessions,
  deleteSession,
  loadGameState,
  saveGameState,
  saveSession,
} from "../src/sessionStore.js";

function createTestSession(code: string) {
  saveSession(code, {
    code,
    players: [],
    thresholds: [],
    status: "awaiting_players",
    phase: "lobby",
  });
}

describe("Game state persistence", () => {
  beforeEach(() => {
    clearSessions();
  });

  it("saves and restores a game state", () => {
    createTestSession("TEST01");

    const state = createInitialGameState(
      "TEST01",
      "last-witness-v1",
    );

    saveGameState(state);

    expect(loadGameState("TEST01")).toEqual(state);
  });

  it("persists game progression updates", () => {
    createTestSession("TEST01");

    const initial = createInitialGameState(
      "TEST01",
      "last-witness-v1",
    );

    saveGameState(initial);

    const started = advanceGame(initial, {
      type: "start",
    });

    saveGameState(started);

    expect(loadGameState("TEST01")).toEqual(started);
    expect(loadGameState("TEST01")?.phase).toBe(
      "investigation",
    );
  });

  it("isolates game states between expeditions", () => {
    createTestSession("TEST01");
    createTestSession("TEST02");

    const first = createInitialGameState(
      "TEST01",
      "last-witness-v1",
    );

    const second = advanceGame(
      createInitialGameState(
        "TEST02",
        "last-witness-v1",
      ),
      { type: "start" },
    );

    saveGameState(first);
    saveGameState(second);

    expect(loadGameState("TEST01")?.phase).toBe("opening");
    expect(loadGameState("TEST02")?.phase).toBe(
      "investigation",
    );
  });

  it("returns null for an expedition without game state", () => {
    createTestSession("TEST01");

    expect(loadGameState("TEST01")).toBeNull();
  });

  it("deletes game state when the expedition is deleted", () => {
    createTestSession("TEST01");

    saveGameState(
      createInitialGameState(
        "TEST01",
        "last-witness-v1",
      ),
    );

    deleteSession("TEST01");

    expect(loadGameState("TEST01")).toBeNull();
  });
});
