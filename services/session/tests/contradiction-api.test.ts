import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetSessionsForTesting } from "../src/app.js";
import { createInitialGameState } from "../src/game/gameState.js";
import { advanceGame } from "../src/game/gameEngine.js";
import { completeInteraction } from "../src/game/interactionService.js";
import { loadGameState, saveGameState } from "../src/sessionStore.js";

describe("Last Witness Act II API", () => {
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

    saveGameState(game);

    return { code, playerId, playerToken };
  }

  type Context = Awaited<ReturnType<typeof setup>>;

  function getContradiction(context: Context) {
    return request(app)
      .get(`/sessions/${context.code}/game/contradiction`)
      .set("X-Player-Id", context.playerId)
      .set("Authorization", `Bearer ${context.playerToken}`);
  }

  function submitStep(context: Context, interactionId: string) {
    return request(app)
      .post(`/sessions/${context.code}/game/contradiction/step`)
      .send({
        playerId: context.playerId,
        playerToken: context.playerToken,
        interactionId,
      });
  }

  function submitAnswer(context: Context, statementId: string) {
    return request(app)
      .post(`/sessions/${context.code}/game/contradiction/answer`)
      .send({
        playerId: context.playerId,
        playerToken: context.playerToken,
        statementId,
      });
  }

  it("rejects unknown sessions", async () => {
    await request(app)
      .get("/sessions/ZZZZ/game/contradiction")
      .expect(404);
  });

  it("rejects unauthenticated requests", async () => {
    const context = await setup();

    const response = await request(app)
      .get(`/sessions/${context.code}/game/contradiction`)
      .expect(401);

    expect(response.body.error).toBe("invalid_player_credentials");
  });

  it("exposes Act II interactions without exposing the answer key", async () => {
    const context = await setup();

    const response = await getContradiction(context).expect(200);

    expect(response.body.steps).toHaveLength(3);
    expect(response.body.steps[0]).toMatchObject({
      id: "collect-testimonies",
      completed: false,
      available: true,
    });

    expect(response.body.statements).toEqual([]);
    expect(response.body.puzzle).toBeNull();
    expect(JSON.stringify(response.body)).not.toContain("correctStatementId");
  });

  it("enforces interaction prerequisites", async () => {
    const context = await setup();

    const response = await submitStep(
      context,
      "reconstruct-timeline",
    ).expect(409);

    expect(response.body.error).toBe(
      "interaction_prerequisite_missing",
    );
  });

  it("rejects invalid and duplicate interactions", async () => {
    const context = await setup();

    await submitStep(context, "invalid-step").expect(400);

    await submitStep(context, "collect-testimonies").expect(200);

    const duplicate = await submitStep(
      context,
      "collect-testimonies",
    ).expect(409);

    expect(duplicate.body.error).toBe(
      "interaction_already_completed",
    );
  });

  it("reveals testimonies after collection", async () => {
    const context = await setup();

    await submitStep(context, "collect-testimonies").expect(200);

    const response = await getContradiction(context).expect(200);

    expect(response.body.statements).toHaveLength(3);
    expect(response.body.puzzle).toBeNull();
  });

  it("requires timeline reconstruction before answering", async () => {
    const context = await setup();

    const response = await submitAnswer(
      context,
      "witness-mara",
    ).expect(409);

    expect(response.body.error).toBe("contradiction_not_ready");
  });

  it("preserves progress across subsequent requests", async () => {
    const context = await setup();

    for (const id of ["collect-testimonies", "compare-accounts"]) {
      await submitStep(context, id).expect(200);
    }

    const persisted = loadGameState(context.code);

    expect(persisted?.completedInteractions).toContain(
      "compare-accounts",
    );

    const response = await getContradiction(context).expect(200);

    expect(response.body.steps[1].completed).toBe(true);
    expect(response.body.steps[2].available).toBe(true);
  });

  it("rejects incorrect testimony without advancing the game", async () => {
    const context = await setup();

    for (const id of [
      "collect-testimonies",
      "compare-accounts",
      "reconstruct-timeline",
    ]) {
      await submitStep(context, id).expect(200);
    }

    const response = await submitAnswer(
      context,
      "witness-ada",
    ).expect(200);

    expect(response.body.correct).toBe(false);
    expect(loadGameState(context.code)?.phase).toBe("contradiction");
  });

  it("advances to Act III after identifying the contradiction", async () => {
    const context = await setup();

    for (const id of [
      "collect-testimonies",
      "compare-accounts",
      "reconstruct-timeline",
    ]) {
      await submitStep(context, id).expect(200);
    }

    const response = await submitAnswer(
      context,
      "witness-mara",
    ).expect(200);

    expect(response.body.correct).toBe(true);
    expect(response.body.game.phase).toBe("revelation");

    const persisted = loadGameState(context.code);

    expect(persisted?.phase).toBe("revelation");
    expect(persisted?.completedObjectives).toContain("contradiction");
  });
});
