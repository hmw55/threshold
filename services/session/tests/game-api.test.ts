
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetSessionsForTesting } from "../src/app.js";
import { createInitialGameState } from "../src/game/gameState.js";
import { advanceGame } from "../src/game/gameEngine.js";
import {
  loadGameState,
  getEnvironment,
  saveGameState,
} from "../src/sessionStore.js";

describe("Last Witness game API", () => {
  beforeEach(() => {
    resetSessionsForTesting();
  });

  async function setup() {
    const created = await request(app)
      .post("/sessions")
      .send({ deviceId: "tv-1" })
      .expect(201);

    const code = created.body.code as string;

    const joined = await request(app)
      .post(`/sessions/${code}/join`)
      .send({ name: "Mack" })
      .expect(201);

    return {
      code,
      playerId: joined.body.player.id as string,
      playerToken: joined.body.playerToken as string,
    };
  }

  function authenticatedGet(context: Awaited<ReturnType<typeof setup>>) {
    return request(app)
      .get(`/sessions/${context.code}/game`)
      .set("X-Player-Id", context.playerId)
      .set("Authorization", `Bearer ${context.playerToken}`);
  }

  it("rejects unknown expeditions", async () => {
    const response = await request(app)
      .get("/sessions/ZZZZ/game")
      .expect(404);

    expect(response.body.error).toBe("session_not_found");
  });

  it("rejects requests without player credentials", async () => {
    const context = await setup();

    const response = await request(app)
      .get(`/sessions/${context.code}/game`)
      .expect(401);

    expect(response.body.error).toBe(
      "invalid_player_credentials",
    );
  });

  it("rejects invalid player credentials", async () => {
    const context = await setup();

    const response = await request(app)
      .get(`/sessions/${context.code}/game`)
      .set("X-Player-Id", context.playerId)
      .set("Authorization", "Bearer invalid")
      .expect(401);

    expect(response.body.error).toBe(
      "invalid_player_credentials",
    );
  });

  it("rejects access before the expedition is playing", async () => {
    const context = await setup();

    const response = await authenticatedGet(context).expect(409);

    expect(response.body.error).toBe("game_not_available");
  });

  it("returns an initialization error when no game exists", async () => {
    const context = await setup();

    // Establish the expedition lifecycle using the existing API.
    await request(app)
      .post(`/sessions/${context.code}/advance`)
      .send({ deviceId: "tv-1" })
      .expect(200);

    // Calibration requires at least one uploaded scan group.
    // This test stops here until the lifecycle is completed.
    const response = await authenticatedGet(context).expect(409);

    expect(response.body.error).toBe("game_not_available");
  });

  it("does not expose game state during the lobby", async () => {
    const context = await setup();

    const game = createInitialGameState(
      context.code,
      "last-witness-v1",
    );

    saveGameState(game);

    const response = await authenticatedGet(context).expect(409);

    expect(response.body.error).toBe("game_not_available");
  });

  it("does not expose puzzle solutions in a game-state response", async () => {
    const context = await setup();

    const initial = createInitialGameState(
      context.code,
      "last-witness-v1",
    );

    const started = advanceGame(initial, {
      type: "start",
    });

    saveGameState(started);

    // The endpoint must still enforce the expedition lifecycle.
    const response = await authenticatedGet(context).expect(409);

    expect(response.body.error).toBe("game_not_available");
  });

  it("initializes The Last Witness when the Fire TV starts gameplay", async () => {
    const context = await setup();

    // Lobby → calibrating
    await request(app)
      .post(`/sessions/${context.code}/advance`)
      .send({ deviceId: "tv-1" })
      .expect(200);

    // Create the required calibration scan group.
    const sessionResponse = await request(app)
      .get(`/sessions/${context.code}`)
      .expect(200);

    const thresholdId =
      sessionResponse.body.thresholds[0].id as string;

    const groupResponse = await request(app)
      .post(`/sessions/${context.code}/scan-groups`)
      .send({
        playerId: context.playerId,
        playerToken: context.playerToken,
        thresholdId,
        label: "THE NEXUS",
      })
      .expect(201);

    // The existing lifecycle accepts an uploaded scan group.
    await request(app)
      .post(
        `/sessions/${context.code}/scan-groups/${groupResponse.body.group.id}/images`,
      )
      .set("X-Player-Id", context.playerId)
      .set("Authorization", `Bearer ${context.playerToken}`)
      .attach(
        "image",
        Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
        {
          filename: "room.jpg",
          contentType: "image/jpeg",
        },
      )
      .expect(201);

    await request(app)
      .post(
        `/sessions/${context.code}/scan-groups/${groupResponse.body.group.id}/finalize`,
      )
      .send({
        playerId: context.playerId,
        playerToken: context.playerToken,
      })
      .expect(200);

    // Calibrating → ready → playing
    for (const expectedPhase of ["ready", "playing"]) {
      const advanced = await request(app)
        .post(`/sessions/${context.code}/advance`)
        .send({ deviceId: "tv-1" })
        .expect(200);

      expect(advanced.body.session.phase).toBe(expectedPhase);
    }

    const response = await authenticatedGet(context).expect(200);

    expect(response.body.game).toMatchObject({
      phase: "investigation",
      completedObjectives: [],
      completedInteractions: [],
      discoveredEvidence: [],
      ending: null,
    });

    expect(response.body.adventure.id).toBe("last-witness-v1");

    // Internal answer keys must never appear in the response.
    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toContain("fragment-b");
    expect(serialized).not.toContain("silent-transmission");
    expect(serialized).not.toContain("witness-mara");
  });

  it("plays the first anchor puzzle and persists the correct answer", async () => {
    const context = await setup();

    // Lobby → calibrating
    await request(app)
      .post(`/sessions/${context.code}/advance`)
      .send({ deviceId: "tv-1" })
      .expect(200);

    const sessionResponse = await request(app)
      .get(`/sessions/${context.code}`)
      .expect(200);

    const thresholdId = sessionResponse.body.thresholds[0].id as string;

    const groupResponse = await request(app)
      .post(`/sessions/${context.code}/scan-groups`)
      .send({
        playerId: context.playerId,
        playerToken: context.playerToken,
        thresholdId,
        label: "THE NEXUS",
      })
      .expect(201);

    const scanGroupId = groupResponse.body.group.id as string;

    await request(app)
      .post(`/sessions/${context.code}/scan-groups/${scanGroupId}/images`)
      .set("X-Player-Id", context.playerId)
      .set("Authorization", `Bearer ${context.playerToken}`)
      .attach(
        "image",
        Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
        { filename: "room.jpg", contentType: "image/jpeg" },
      )
      .expect(201);

    await request(app)
      .post(`/sessions/${context.code}/scan-groups/${scanGroupId}/finalize`)
      .send({
        playerId: context.playerId,
        playerToken: context.playerToken,
      })
      .expect(200);

    // Register two real, player-confirmed environmental objects.
    for (const name of ["Lamp", "Table"]) {
      await request(app)
        .post(`/sessions/${context.code}/environment/objects`)
        .send({
          playerId: context.playerId,
          playerToken: context.playerToken,
          scanGroupId,
          name,
        })
        .expect(201);
    }

    // Calibrating → ready → playing
    for (const expectedPhase of ["ready", "playing"]) {
      const response = await request(app)
        .post(`/sessions/${context.code}/advance`)
        .send({ deviceId: "tv-1" })
        .expect(200);

      expect(response.body.session.phase).toBe(expectedPhase);
    }

    const puzzleResponse = await request(app)
      .get(`/sessions/${context.code}/game/anchor`)
      .set("X-Player-Id", context.playerId)
      .set("Authorization", `Bearer ${context.playerToken}`)
      .expect(200);

    expect(puzzleResponse.body.puzzle).toMatchObject({
      id: "first-signal-puzzle",
      completed: false,
    });

    expect(puzzleResponse.body.objects).toHaveLength(2);

    const objects = puzzleResponse.body.objects as Array<{
      ref: string;
      name: string;
    }>;

    const lamp = objects.find((object) => object.name === "Lamp");
    const table = objects.find((object) => object.name === "Table");

    expect(lamp).toBeDefined();
    expect(table).toBeDefined();

    // The current deterministic anchor selection chooses Lamp.
    const wrongAnswer = await request(app)
      .post(`/sessions/${context.code}/game/anchor/answer`)
      .send({
        playerId: context.playerId,
        playerToken: context.playerToken,
        objectRef: table!.ref,
      })
      .expect(200);

    expect(wrongAnswer.body.correct).toBe(false);

    const correctAnswer = await request(app)
      .post(`/sessions/${context.code}/game/anchor/answer`)
      .send({
        playerId: context.playerId,
        playerToken: context.playerToken,
        objectRef: lamp!.ref,
      })
      .expect(200);

    expect(correctAnswer.body.correct).toBe(true);
    expect(correctAnswer.body.game.completedInteractions).toContain(
      "inspect-anchor",
    );

    // Verify that the result was actually saved.
    const persisted = loadGameState(context.code);

    expect(persisted?.completedInteractions).toContain("inspect-anchor");

    // Reopening the puzzle must show completed progress.
    const reopened = await request(app)
      .get(`/sessions/${context.code}/game/anchor`)
      .set("X-Player-Id", context.playerId)
      .set("Authorization", `Bearer ${context.playerToken}`)
      .expect(200);

    expect(reopened.body.puzzle.completed).toBe(true);

    // A completed interaction cannot be submitted twice.
    await request(app)
      .post(`/sessions/${context.code}/game/anchor/answer`)
      .send({
        playerId: context.playerId,
        playerToken: context.playerToken,
        objectRef: lamp!.ref,
      })
      .expect(409);
  });

  it("clears gameplay progress when an expedition restarts", async () => {
    const context = await setup();

    // Restart is only permitted after leaving the lobby.
    const advanced = await request(app)
      .post(`/sessions/${context.code}/advance`)
      .send({ deviceId: "tv-1" })
      .expect(200);

    expect(advanced.body.session.phase).toBe("calibrating");

    const initial = createInitialGameState(
      context.code,
      "last-witness-v1",
    );

    const started = advanceGame(initial, {
      type: "start",
    });

    saveGameState(started);

    expect(loadGameState(context.code)).toEqual(started);

    const response = await request(app)
      .post(`/sessions/${context.code}/restart`)
      .send({
        deviceId: "tv-1",
        mode: "rescan",
      })
      .expect(200);

    expect(response.body.session.phase).toBe("lobby");
    expect(loadGameState(context.code)).toBeNull();

    expect(
      response.body.session.players.some(
        (player: { id: string }) =>
          player.id === context.playerId,
      ),
    ).toBe(true);

    expect(
      response.body.session.thresholds.some(
        (threshold: { deviceId: string }) =>
          threshold.deviceId === "tv-1",
      ),
    ).toBe(true);
  });

  it("creates a separate scanned environment for each expedition", async () => {
    const first = await request(app)
      .post("/sessions")
      .send({ deviceId: "tv-1" })
      .expect(201);

    const second = await request(app)
      .post("/sessions")
      .send({ deviceId: "tv-2" })
      .expect(201);

    const firstEnvironmentId = first.body.environmentId as string;
    const secondEnvironmentId = second.body.environmentId as string;

    expect(firstEnvironmentId).toEqual(expect.any(String));
    expect(secondEnvironmentId).toEqual(expect.any(String));
    expect(firstEnvironmentId).not.toBe(secondEnvironmentId);

    expect(getEnvironment(firstEnvironmentId)).toMatchObject({
      id: firstEnvironmentId,
      name: `Expedition ${first.body.code}`,
      source: "scanned",
    });

    expect(getEnvironment(secondEnvironmentId)).toMatchObject({
      id: secondEnvironmentId,
      name: `Expedition ${second.body.code}`,
      source: "scanned",
    });
  });
});
