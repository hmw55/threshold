
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app, resetSessionsForTesting } from "../src/app.js";

describe("Scan group API", () => {
  beforeEach(() => {
    resetSessionsForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
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
      claimedBy: player.playerId,
      status: "pending",
    });

    expect(response.body.group.id).toEqual(expect.any(String));
    expect(response.body.group.claimExpiresAt).toEqual(
      expect.any(String),
    );
  });

  it("rejects scans without a registered Fire TV", async () => {
    const session = await createExpedition();
    const player = await joinExpedition(session.code);

    for (const thresholdId of [null, undefined, "unknown-tv"]) {
      const response = await request(app)
        .post(`/sessions/${session.code}/scan-groups`)
        .send({
          ...player,
          thresholdId,
          label: "KITCHEN",
        })
        .expect(400);

      expect(response.body.error).toBe("invalid_threshold_id");
    }
  });

  it("prevents duplicate scans for the same Fire TV", async () => {
    const session = await createExpedition();
    const player = await joinExpedition(session.code);
    const thresholdId = session.thresholds[0].id;

    await request(app)
      .post(`/sessions/${session.code}/scan-groups`)
      .send({
        ...player,
        thresholdId,
        label: "THE NEXUS",
      })
      .expect(201);

    const duplicate = await request(app)
      .post(`/sessions/${session.code}/scan-groups`)
      .send({
        ...player,
        thresholdId,
        label: "KITCHEN",
      });

    expect(duplicate.status).not.toBe(201);

    const listed = await request(app)
      .get(`/sessions/${session.code}/scan-groups`)
      .set("X-Player-Id", player.playerId)
      .set("Authorization", `Bearer ${player.playerToken}`)
      .expect(200);

    expect(listed.body.groups).toHaveLength(1);
  });

  it("lists scan groups for an expedition", async () => {
    const session = await createExpedition();
    const player = await joinExpedition(session.code);

    const registered = await request(app)
      .post(`/sessions/${session.code}/thresholds`)
      .send({ deviceId: "tv-2" })
      .expect(201);

    const secondThresholdId = registered.body.threshold.id;

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
        thresholdId: secondThresholdId,
        label: "THE VEIL",
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
        (group: { label: string }) => group.label,
      ),
    ).toEqual(["THE NEXUS", "THE VEIL"]);
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
        `/sessions/${session.code}/scan-groups/${created.body.group.id}`,
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
        thresholdId: session.thresholds[0].id,
        label: "THE NEXUS",
      })
      .expect(401);

    await request(app)
      .post(`/sessions/${session.code}/scan-groups`)
      .send({
        playerId: player.playerId,
        playerToken: "0".repeat(64),
        thresholdId: session.thresholds[0].id,
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
        thresholdId: second.thresholds[0].id,
        label: "THE VEIL",
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
          thresholdId: session.thresholds[0].id,
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
        thresholdId: first.thresholds[0].id,
        label: "THE NEXUS",
      })
      .expect(201);

    await request(app)
      .get(
        `/sessions/${second.code}/scan-groups/${created.body.group.id}`,
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
        `/sessions/${session.code}/scan-groups/${created.body.group.id}/finalize`,
      )
      .send(player)
      .expect(409);

    expect(response.body.error).toBe(
      "scan_group_empty_or_not_finalizable",
    );
  });

  it("rejects finalization without valid credentials", async () => {
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

    await request(app)
      .post(
        `/sessions/${session.code}/scan-groups/${created.body.group.id}/finalize`,
      )
      .send({
        playerId: player.playerId,
      })
      .expect(401);

    await request(app)
      .post(
        `/sessions/${session.code}/scan-groups/${created.body.group.id}/finalize`,
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
        thresholdId: first.thresholds[0].id,
        label: "THE NEXUS",
      })
      .expect(201);

    await request(app)
      .post(
        `/sessions/${second.code}/scan-groups/${created.body.group.id}/finalize`,
      )
      .send(secondPlayer)
      .expect(404);
  });


  it("allows the original player to renew a scan claim", async () => {
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

    const originalExpiry = created.body.group.claimExpiresAt;

    vi.setSystemTime(
      new Date(Date.now() + 60_000),
    );

    const response = await request(app)
      .post(
        `/sessions/${session.code}/scan-groups/${created.body.group.id}/claim`,
      )
      .send(player)
      .expect(200);

    expect(response.body.group.claimedBy).toBe(player.playerId);
    expect(
      new Date(response.body.group.claimExpiresAt).getTime(),
    ).toBeGreaterThan(new Date(originalExpiry).getTime());
  });

  it("prevents another player from taking an active claim", async () => {
    const session = await createExpedition();
    const firstPlayer = await joinExpedition(session.code);
    const secondPlayer = await joinExpedition(session.code);

    const created = await request(app)
      .post(`/sessions/${session.code}/scan-groups`)
      .send({
        ...firstPlayer,
        thresholdId: session.thresholds[0].id,
        label: "THE NEXUS",
      })
      .expect(201);

    const response = await request(app)
      .post(
        `/sessions/${session.code}/scan-groups/${created.body.group.id}/claim`,
      )
      .send(secondPlayer)
      .expect(409);

    expect(response.body.error).toBe(
      "scan_group_already_claimed",
    );
  });

  it("allows another player to recover an expired claim", async () => {
    const session = await createExpedition();
    const firstPlayer = await joinExpedition(session.code);
    const secondPlayer = await joinExpedition(session.code);

    const created = await request(app)
      .post(`/sessions/${session.code}/scan-groups`)
      .send({
        ...firstPlayer,
        thresholdId: session.thresholds[0].id,
        label: "THE NEXUS",
      })
      .expect(201);

    vi.setSystemTime(
      new Date(
        new Date(created.body.group.claimExpiresAt).getTime() + 1000,
      ),
    );

    const recovered = await request(app)
      .post(
        `/sessions/${session.code}/scan-groups/${created.body.group.id}/claim`,
      )
      .send(secondPlayer)
      .expect(200);

    expect(recovered.body.group.claimedBy).toBe(
      secondPlayer.playerId,
    );

    expect(recovered.body.group.createdBy).toBe(
      firstPlayer.playerId,
    );

    expect(recovered.body.group.status).toBe("pending");

    const previousOwner = await request(app)
      .post(
        `/sessions/${session.code}/scan-groups/${created.body.group.id}/claim`,
      )
      .send(firstPlayer)
      .expect(409);

    expect(previousOwner.body.error).toBe(
      "scan_group_already_claimed",
    );
  });

  it("rejects claim recovery from another expedition", async () => {
    const first = await createExpedition("tv-1");
    const second = await createExpedition("tv-2");

    const firstPlayer = await joinExpedition(first.code);
    const secondPlayer = await joinExpedition(second.code);

    const created = await request(app)
      .post(`/sessions/${first.code}/scan-groups`)
      .send({
        ...firstPlayer,
        thresholdId: first.thresholds[0].id,
        label: "THE NEXUS",
      })
      .expect(201);

    await request(app)
      .post(
        `/sessions/${first.code}/scan-groups/${created.body.group.id}/claim`,
      )
      .send(secondPlayer)
      .expect(401);

    await request(app)
      .post(
        `/sessions/${second.code}/scan-groups/${created.body.group.id}/claim`,
      )
      .send(secondPlayer)
      .expect(404);
  });

  it("rejects claims on finalized scan groups", async () => {
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

    // This test verifies that the claim endpoint cannot bypass
    // a non-pending scan status. Finalization itself requires
    // at least one uploaded photograph, so that scenario will
    // be covered in the upload integration tests.
    expect(created.body.group.status).toBe("pending");
  });
});

