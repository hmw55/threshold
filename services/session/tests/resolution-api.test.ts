import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetSessionsForTesting } from "../src/app.js";
import { createInitialGameState } from "../src/game/gameState.js";
import { advanceGame } from "../src/game/gameEngine.js";
import { completeInteraction } from "../src/game/interactionService.js";
import { loadGameState, saveGameState } from "../src/sessionStore.js";

describe("Last Witness resolution API", () => {
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
      .send({ name: "Test Witness" })
      .expect(201);

    const playerId = joined.body.player.id as string;
    const playerToken = joined.body.playerToken as string;

    await request(app)
      .post(`/sessions/${code}/advance`)
      .send({ deviceId: "tv-1" })
      .expect(200);

    const sessionResponse = await request(app)
      .get(`/sessions/${code}`)
      .expect(200);

    const thresholdId = sessionResponse.body.thresholds[0].id as string;

    const groupResponse = await request(app)
      .post(`/sessions/${code}/scan-groups`)
      .send({
        playerId,
        playerToken,
        thresholdId,
        label: "THE NEXUS",
      })
      .expect(201);

    const groupId = groupResponse.body.group.id as string;

    await request(app)
      .post(`/sessions/${code}/scan-groups/${groupId}/images`)
      .set("X-Player-Id", playerId)
      .set("Authorization", `Bearer ${playerToken}`)
      .attach(
        "image",
        Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
        { filename: "room.jpg", contentType: "image/jpeg" },
      )
      .expect(201);

    await request(app)
      .post(`/sessions/${code}/scan-groups/${groupId}/finalize`)
      .send({ playerId, playerToken })
      .expect(200);

    for (const phase of ["ready", "playing"]) {
      const response = await request(app)
        .post(`/sessions/${code}/advance`)
        .send({ deviceId: "tv-1" })
        .expect(200);

      expect(response.body.session.phase).toBe(phase);
    }

    let game = advanceGame(
      createInitialGameState(code, "last-witness-v1"),
      { type: "start" },
    );

    for (const id of [
      "inspect-anchor",
      "recover-transmission",
      "reconstruct-signal",
    ]) {
      game = completeInteraction(game, id);
    }

    game = advanceGame(game, {
      type: "complete_objective",
      objectiveId: "first-signal",
    });

    for (const id of [
      "collect-testimonies",
      "compare-accounts",
      "reconstruct-timeline",
    ]) {
      game = completeInteraction(game, id);
    }

    game = advanceGame(game, {
      type: "complete_objective",
      objectiveId: "contradiction",
    });

    for (const id of [
      "inspect-archive",
      "locate-receiver",
      "decode-testimony",
    ]) {
      game = completeInteraction(game, id);
    }

    game = advanceGame(game, {
      type: "discover_evidence",
      evidenceId: "missing-testimony",
    });

    game = advanceGame(game, {
      type: "complete_objective",
      objectiveId: "missing-witness",
    });

    expect(game.phase).toBe("resolution");
    saveGameState(game);

    return { code, playerId, playerToken };
  }

  type Context = Awaited<ReturnType<typeof setup>>;

  function submitEnding(context: Context, ending: unknown) {
    return request(app)
      .post(`/sessions/${context.code}/game/resolution/answer`)
      .send({
        playerId: context.playerId,
        playerToken: context.playerToken,
        ending,
      });
  }

  function getGame(context: Context) {
    return request(app)
      .get(`/sessions/${context.code}/game`)
      .set("X-Player-Id", context.playerId)
      .set("Authorization", `Bearer ${context.playerToken}`);
  }

  it("rejects unknown sessions", async () => {
    await request(app)
      .post("/sessions/ZZZZ/game/resolution/answer")
      .send({
        playerId: "unknown",
        playerToken: "invalid",
        ending: "preservation",
      })
      .expect(404);
  });

  it("rejects invalid player credentials", async () => {
    const context = await setup();

    await request(app)
      .post(`/sessions/${context.code}/game/resolution/answer`)
      .send({
        playerId: context.playerId,
        playerToken: "invalid",
        ending: "preservation",
      })
      .expect(401);

    expect(loadGameState(context.code)?.phase).toBe("resolution");
  });

  it("rejects decisions before the resolution phase", async () => {
    const context = await setup();
    const state = loadGameState(context.code);

    expect(state).toBeDefined();

    const earlier = {
      ...state!,
      phase: "revelation" as const,
      ending: null,
    };

    saveGameState(earlier);

    const response = await submitEnding(context, "preservation")
      .expect(409);

    expect(response.body.error).toBe("resolution_not_ready");
  });

  it("rejects invalid ending identifiers", async () => {
    const context = await setup();

    for (const invalid of ["unknown", "", 123, null]) {
      const response = await submitEnding(context, invalid)
        .expect(400);

      expect(response.body.error).toBe("invalid_ending");
    }

    expect(loadGameState(context.code)?.phase).toBe("resolution");
  });

  it.each([
    "preservation",
    "fracture",
    "reconciliation",
  ] as const)("accepts the %s ending", async (ending) => {
    const context = await setup();

    const response = await submitEnding(context, ending)
      .expect(200);

    expect(response.body.game.phase).toBe("complete");
    expect(response.body.game.ending).toBe(ending);

    const persisted = loadGameState(context.code);
    expect(persisted?.phase).toBe("complete");
    expect(persisted?.ending).toBe(ending);
  });

  it("rejects reconciliation without missing testimony", async () => {
    const context = await setup();
    const state = loadGameState(context.code);

    expect(state).toBeDefined();

    saveGameState({
      ...state!,
      discoveredEvidence: state!.discoveredEvidence.filter(
        (id) => id !== "missing-testimony",
      ),
    });

    const response = await submitEnding(context, "reconciliation")
      .expect(409);

    expect(response.body.error).toBe("missing_testimony_required");
    expect(loadGameState(context.code)?.phase).toBe("resolution");
    expect(loadGameState(context.code)?.ending).toBeNull();

    // The other endings remain available without that evidence.
    const alternative = await submitEnding(context, "preservation")
      .expect(200);

    expect(alternative.body.game.ending).toBe("preservation");
  });

  it("does not allow a completed ending to be overwritten", async () => {
    const context = await setup();

    await submitEnding(context, "preservation").expect(200);

    const response = await submitEnding(context, "fracture")
      .expect(409);

    expect(response.body.error).toBe("resolution_not_ready");
    expect(loadGameState(context.code)?.ending).toBe("preservation");
  });

  it("returns the saved ending through the game-state API", async () => {
    const context = await setup();

    await submitEnding(context, "reconciliation").expect(200);

    const response = await getGame(context).expect(200);

    expect(response.body.game.phase).toBe("complete");
    expect(response.body.game.ending).toBe("reconciliation");
    expect(response.body.game.discoveredEvidence)
      .toContain("missing-testimony");
  });
});
