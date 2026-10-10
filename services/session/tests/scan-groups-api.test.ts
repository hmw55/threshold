
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetSessionsForTesting } from "../src/app.js";

describe("Scan group API", () => {
  beforeEach(() => {
    resetSessionsForTesting();
  });

  async function createExpedition(deviceId = "tv-1") {
    const response = await request(app)
      .post("/sessions")
      .send({ deviceId })
      .expect(201);

    return response.body;
  }

  async function joinExpedition(code: string) {
    const response = await request(app)
      .post(`/sessions/${code}/join`)
      .send({ name: "Mack" })
      .expect(201);

    return {
      playerId: response.body.player.id as string,
      playerToken: response.body.playerToken as string,
    };
  }

  it("creates a scan group for a Fire TV zone", async () => {
    const session = await createExpedition();
    const player = await joinExpedition(session.code);

    const response = await request(app)
      .post(`/sessions/${session.code}/scan-groups`)
      .send({
        ...player,
        thresholdId: session.thresholds[0].id,
        label: "THE NEXUS",
      })
      .expect(201);

    expect(response.body.group).toMatchObject({
      sessionCode: session.code,
      thresholdId: session.thresholds[0].id,
      label: "THE NEXUS",
      createdBy: player.playerId,
      status: "pending",
    });

    expect(response.body.group.id).toEqual(expect.any(String));
  });

  it("supports additional areas without Fire TVs", async () => {
    const session = await createExpedition();
    const player = await joinExpedition(session.code);

    const response = await request(app)
      .post(`/sessions/${session.code}/scan-groups`)
      .send({
        ...player,
        thresholdId: null,
        label: "KITCHEN",
      })
      .expect(201);

    expect(response.body.group.thresholdId).toBeNull();
    expect(response.body.group.label).toBe("KITCHEN");
  });

  it("lists scan groups for an expedition", async () => {
    const session = await createExpedition();
    const player = await joinExpedition(session.code);

    await request(app)
      .post(`/sessions/${session.code}/scan-groups`)
      .send({
        ...player,
        thresholdId: session.thresholds[0].id,
        label: "THE NEXUS",
      })
      .expect(201);

    await request(app)
      .post(`/sessions/${session.code}/scan-groups`)
      .send({
        ...player,
        thresholdId: null,
        label: "HALLWAY",
      })
      .expect(201);

    const response = await request(app)
      .get(`/sessions/${session.code}/scan-groups`)
      .set("X-Player-Id", player.playerId)
      .set("Authorization", `Bearer ${player.playerToken}`)
      .expect(200);

    expect(response.body.groups).toHaveLength(2);
    expect(
      response.body.groups.map(
        (group: { label: string }) => group.label
      )
    ).toEqual(["THE NEXUS", "HALLWAY"]);
  });

  it("retrieves a scan group by ID", async () => {
    const session = await createExpedition();
    const player = await joinExpedition(session.code);

    const created = await request(app)
      .post(`/sessions/${session.code}/scan-groups`)
      .send({
        ...player,
        label: "THE NEXUS",
        thresholdId: session.thresholds[0].id,
      })
      .expect(201);

    const response = await request(app)
      .get(
        `/sessions/${session.code}/scan-groups/${created.body.group.id}`
      )
      .set("X-Player-Id", player.playerId)
      .set("Authorization", `Bearer ${player.playerToken}`)
      .expect(200);

    expect(response.body.group).toEqual(created.body.group);
  });

  it("rejects creation without valid credentials", async () => {
    const session = await createExpedition();
    const player = await joinExpedition(session.code);

    await request(app)
      .post(`/sessions/${session.code}/scan-groups`)
      .send({
        playerId: player.playerId,
        label: "THE NEXUS",
      })
      .expect(401);

    await request(app)
      .post(`/sessions/${session.code}/scan-groups`)
      .send({
        playerId: player.playerId,
        playerToken: "0".repeat(64),
        label: "THE NEXUS",
      })
      .expect(401);
  });

  it("rejects scan groups referencing another expedition's TV", async () => {
    const first = await createExpedition("tv-1");
    const second = await createExpedition("tv-2");
    const player = await joinExpedition(first.code);

    await request(app)
      .post(`/sessions/${first.code}/scan-groups`)
      .send({
        ...player,
        thresholdId: second.thresholds[0].id,
        label: "THE VEIL",
      })
      .expect(400);
  });

  it("prevents players from accessing another expedition", async () => {
    const first = await createExpedition("tv-1");
    const second = await createExpedition("tv-2");
    const player = await joinExpedition(first.code);

    await request(app)
      .post(`/sessions/${second.code}/scan-groups`)
      .send({
        ...player,
        label: "HALLWAY",
      })
      .expect(401);

    await request(app)
      .get(`/sessions/${second.code}/scan-groups`)
      .set("X-Player-Id", player.playerId)
      .set("Authorization", `Bearer ${player.playerToken}`)
      .expect(401);
  });

  it("rejects invalid scan group labels", async () => {
    const session = await createExpedition();
    const player = await joinExpedition(session.code);

    for (const label of ["", "   ", "A".repeat(101)]) {
      await request(app)
        .post(`/sessions/${session.code}/scan-groups`)
        .send({
          ...player,
          label,
        })
        .expect(400);
    }
  });

  it("does not retrieve scan groups from another expedition", async () => {
    const first = await createExpedition("tv-1");
    const second = await createExpedition("tv-2");

    const firstPlayer = await joinExpedition(first.code);
    const secondPlayer = await joinExpedition(second.code);

    const created = await request(app)
      .post(`/sessions/${first.code}/scan-groups`)
      .send({
        ...firstPlayer,
        label: "THE NEXUS",
      })
      .expect(201);

    await request(app)
      .get(
        `/sessions/${second.code}/scan-groups/${created.body.group.id}`
      )
      .set("X-Player-Id", secondPlayer.playerId)
      .set("Authorization", `Bearer ${secondPlayer.playerToken}`)
      .expect(404);
  });


  it("rejects finalizing an empty scan group", async () => {
    const session = await createExpedition();
    const player = await joinExpedition(session.code);

    const created = await request(app)
      .post(`/sessions/${session.code}/scan-groups`)
      .send({
        ...player,
        thresholdId: session.thresholds[0].id,
        label: "THE NEXUS",
      })
      .expect(201);

    const response = await request(app)
      .post(
        `/sessions/${session.code}/scan-groups/${created.body.group.id}/finalize`
      )
      .send(player)
      .expect(409);

    expect(response.body.error).toBe(
      "scan_group_empty_or_not_finalizable"
    );
  });

  it("rejects finalization without valid credentials", async () => {
    const session = await createExpedition();
    const player = await joinExpedition(session.code);

    const created = await request(app)
      .post(`/sessions/${session.code}/scan-groups`)
      .send({
        ...player,
        label: "THE NEXUS",
      })
      .expect(201);

    await request(app)
      .post(
        `/sessions/${session.code}/scan-groups/${created.body.group.id}/finalize`
      )
      .send({
        playerId: player.playerId,
      })
      .expect(401);

    await request(app)
      .post(
        `/sessions/${session.code}/scan-groups/${created.body.group.id}/finalize`
      )
      .send({
        playerId: player.playerId,
        playerToken: "0".repeat(64),
      })
      .expect(401);
  });

  it("prevents finalizing a scan group from another expedition", async () => {
    const first = await createExpedition("tv-1");
    const second = await createExpedition("tv-2");

    const firstPlayer = await joinExpedition(first.code);
    const secondPlayer = await joinExpedition(second.code);

    const created = await request(app)
      .post(`/sessions/${first.code}/scan-groups`)
      .send({
        ...firstPlayer,
        label: "THE NEXUS",
      })
      .expect(201);

    await request(app)
      .post(
        `/sessions/${second.code}/scan-groups/${created.body.group.id}/finalize`
      )
      .send(secondPlayer)
      .expect(404);
  });
});
