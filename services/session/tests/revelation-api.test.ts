import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetSessionsForTesting } from "../src/app.js";
import { createInitialGameState } from "../src/game/gameState.js";
import { advanceGame } from "../src/game/gameEngine.js";
import { completeInteraction } from "../src/game/interactionService.js";
import { loadGameState, saveGameState } from "../src/sessionStore.js";

describe("Last Witness Act III API", () => {
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

    expect(game.phase).toBe("revelation");

    saveGameState(game);

    return { code, playerId, playerToken };
  }

  type Context = Awaited<ReturnType<typeof setup>>;

  function getRevelation(context: Context) {
    return request(app)
      .get(`/sessions/${context.code}/game/revelation`)
      .set("X-Player-Id", context.playerId)
      .set("Authorization", `Bearer ${context.playerToken}`);
  }

  function submitStep(context: Context, interactionId: string) {
    return request(app)
      .post(`/sessions/${context.code}/game/revelation/step`)
      .send({
        playerId: context.playerId,
        playerToken: context.playerToken,
        interactionId,
      });
  }

  function submitAnswer(context: Context, choiceId: string) {
    return request(app)
      .post(`/sessions/${context.code}/game/revelation/answer`)
      .send({
        playerId: context.playerId,
        playerToken: context.playerToken,
        choiceId,
      });
  }

  async function completeSteps(context: Context) {
    for (const id of [
      "inspect-archive",
      "locate-receiver",
      "decode-testimony",
    ]) {
      await submitStep(context, id).expect(200);
    }
  }

  it("rejects unknown sessions", async () => {
    await request(app)
      .get("/sessions/ZZZZ/game/revelation")
      .expect(404);
  });

  it("rejects unauthenticated requests", async () => {
    const context = await setup();

    const response = await request(app)
      .get(`/sessions/${context.code}/game/revelation`)
      .expect(401);

    expect(response.body.error).toBe("invalid_player_credentials");
  });

  it("exposes Act III steps without leaking the answer key", async () => {
    const context = await setup();

    const response = await getRevelation(context).expect(200);

    expect(response.body.steps).toHaveLength(3);
    expect(response.body.steps[0]).toMatchObject({
      id: "inspect-archive",
      completed: false,
      available: true,
    });

    expect(response.body.archive).toBeNull();
    expect(response.body.puzzle).toBeNull();
    expect(JSON.stringify(response.body)).not.toContain("correctChoiceId");
  });

  it("enforces interaction prerequisites", async () => {
    const context = await setup();

    const response = await submitStep(
      context,
      "decode-testimony",
    ).expect(409);

    expect(response.body.error).toBe(
      "interaction_prerequisite_missing",
    );
  });

  it("rejects invalid and duplicate interactions", async () => {
    const context = await setup();

    await submitStep(context, "invalid-step").expect(400);

    await submitStep(context, "inspect-archive").expect(200);

    const duplicate = await submitStep(
      context,
      "inspect-archive",
    ).expect(409);

    expect(duplicate.body.error).toBe(
      "interaction_already_completed",
    );
  });

  it("reveals archive evidence after inspection", async () => {
    const context = await setup();

    await submitStep(context, "inspect-archive").expect(200);

    const response = await getRevelation(context).expect(200);

    expect(response.body.archive).toContain("ARCHIVE ENTRY");
    expect(response.body.puzzle).toBeNull();
    expect(response.body.steps[1].available).toBe(true);
  });

  it("reveals interpretation choices only after decoding", async () => {
    const context = await setup();

    await completeSteps(context);

    const response = await getRevelation(context).expect(200);

    expect(response.body.puzzle.choices).toHaveLength(3);
    expect(response.body.puzzle.prompt).toBeTruthy();
    expect(response.body.steps.every(
      (step: { completed: boolean }) => step.completed,
    )).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain("correctChoiceId");
  });

  it("requires decoding before accepting an answer", async () => {
    const context = await setup();

    const response = await submitAnswer(
      context,
      "silent-transmission",
    ).expect(409);

    expect(response.body.error).toBe("revelation_not_ready");
  });

  it("preserves completed steps across requests", async () => {
    const context = await setup();

    await submitStep(context, "inspect-archive").expect(200);
    await submitStep(context, "locate-receiver").expect(200);

    const persisted = loadGameState(context.code);

    expect(persisted?.completedInteractions).toContain("locate-receiver");

    const response = await getRevelation(context).expect(200);

    expect(response.body.steps[1].completed).toBe(true);
    expect(response.body.steps[2].available).toBe(true);
  });

  it("rejects invalid interpretation choices", async () => {
    const context = await setup();
    await completeSteps(context);

    const response = await submitAnswer(
      context,
      "not-a-choice",
    ).expect(400);

    expect(response.body.error).toBe("invalid_choice");
  });

  it("rejects incorrect interpretations without advancing", async () => {
    const context = await setup();
    await completeSteps(context);

    const response = await submitAnswer(
      context,
      "recording-fabricated",
    ).expect(200);

    expect(response.body.correct).toBe(false);
    expect(response.body.game.phase).toBe("revelation");
    expect(loadGameState(context.code)?.phase).toBe("revelation");
    expect(
      loadGameState(context.code)?.discoveredEvidence,
    ).not.toContain("missing-testimony");
  });

  it("advances to resolution and persists the missing testimony", async () => {
    const context = await setup();
    await completeSteps(context);

    const response = await submitAnswer(
      context,
      "silent-transmission",
    ).expect(200);

    expect(response.body.correct).toBe(true);
    expect(response.body.game.phase).toBe("resolution");
    expect(response.body.game.discoveredEvidence).toContain(
      "missing-testimony",
    );

    const persisted = loadGameState(context.code);

    expect(persisted?.phase).toBe("resolution");
    expect(persisted?.completedObjectives).toContain("missing-witness");
    expect(persisted?.discoveredEvidence).toContain("missing-testimony");
  });
});
