
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetSessionsForTesting } from "../src/app.js";
import {
  getScanGroup,
  listScanGroups,
  listScanImages,
} from "../src/sessionStore.js";
import { readImage, removeImage } from "../src/imageStorage.js";

const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10,
]);

describe("Expedition restart API", () => {
  const storageKeys = new Set<string>();

  beforeEach(async () => {
    // Remove files left by earlier tests before clearing the database.
    for (const key of storageKeys) {
      await removeImage(key);
    }

    storageKeys.clear();
    resetSessionsForTesting();
  });

  async function setup() {
    const created = await request(app)
      .post("/sessions")
      .send({ deviceId: "tv-1" })
      .expect(201);

    const session = created.body;

    const joined = await request(app)
      .post(`/sessions/${session.code}/join`)
      .send({ name: "Mack" })
      .expect(201);

    const advanced = await request(app)
      .post(`/sessions/${session.code}/advance`)
      .send({ deviceId: "tv-1" })
      .expect(200);

    expect(advanced.body.session.phase).toBe("calibrating");

    return {
      code: session.code as string,
      deviceId: "tv-1",
      thresholdId: session.thresholds[0].id as string,
      playerId: joined.body.player.id as string,
      playerToken: joined.body.playerToken as string,
      originalPlayers: joined.body.session.players,
      originalThresholds: session.thresholds,
    };
  }

  async function createGroup(
    context: Awaited<ReturnType<typeof setup>>,
  ) {
    const response = await request(app)
      .post(`/sessions/${context.code}/scan-groups`)
      .send({
        playerId: context.playerId,
        playerToken: context.playerToken,
        thresholdId: context.thresholdId,
        label: "THE NEXUS",
      })
      .expect(201);

    return response.body.group.id as string;
  }

  async function uploadImage(
    context: Awaited<ReturnType<typeof setup>>,
    groupId: string,
  ) {
    await request(app)
      .post(`/sessions/${context.code}/scan-groups/${groupId}/images`)
      .set("X-Player-Id", context.playerId)
      .set("Authorization", `Bearer ${context.playerToken}`)
      .attach("image", JPEG, {
        filename: "environment.jpg",
        contentType: "image/jpeg",
      })
      .expect(201);

    const images = listScanImages(groupId);
    expect(images).toHaveLength(1);

    const image = images[0];

    if (!image) {
      throw new Error("Expected uploaded photograph");
    }

    storageKeys.add(image.storageKey);

    return image.storageKey;
  }

  async function finalize(
    context: Awaited<ReturnType<typeof setup>>,
    groupId: string,
  ) {
    await request(app)
      .post(`/sessions/${context.code}/scan-groups/${groupId}/finalize`)
      .send({
        playerId: context.playerId,
        playerToken: context.playerToken,
      })
      .expect(200);
  }

  it("reuses photographs and preserves expedition participants", async () => {
    const context = await setup();
    const groupId = await createGroup(context);
    const storageKey = await uploadImage(context, groupId);

    await finalize(context, groupId);

    const response = await request(app)
      .post(`/sessions/${context.code}/restart`)
      .send({
        deviceId: context.deviceId,
        mode: "reuse",
      })
      .expect(200);

    expect(response.body).toMatchObject({
      restarted: true,
      mode: "reuse",
      session: {
        code: context.code,
        phase: "lobby",
        status: "ready",
        players: context.originalPlayers,
        thresholds: context.originalThresholds,
      },
    });

    const group = getScanGroup(groupId);

    expect(group).toMatchObject({
      id: groupId,
      status: "uploaded",
      claimedBy: null,
      claimExpiresAt: null,
    });

    expect(listScanImages(groupId)).toHaveLength(1);
    expect((await readImage(storageKey)).equals(JPEG)).toBe(true);
  });

  it("deletes photographs and scan groups when rescanning", async () => {
    const context = await setup();
    const groupId = await createGroup(context);
    const storageKey = await uploadImage(context, groupId);

    await finalize(context, groupId);

    const response = await request(app)
      .post(`/sessions/${context.code}/restart`)
      .send({
        deviceId: context.deviceId,
        mode: "rescan",
      })
      .expect(200);

    expect(response.body).toMatchObject({
      restarted: true,
      mode: "rescan",
      session: {
        code: context.code,
        phase: "lobby",
        status: "ready",
        players: context.originalPlayers,
        thresholds: context.originalThresholds,
      },
    });

    expect(getScanGroup(groupId)).toBeNull();
    expect(listScanImages(groupId)).toHaveLength(0);
    expect(listScanGroups(context.code)).toHaveLength(0);

    await expect(readImage(storageKey)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("removes empty scan groups when reusing the environment", async () => {
    const context = await setup();
    const groupId = await createGroup(context);

    await request(app)
      .post(`/sessions/${context.code}/restart`)
      .send({
        deviceId: context.deviceId,
        mode: "reuse",
      })
      .expect(200);

    expect(getScanGroup(groupId)).toBeNull();
    expect(listScanGroups(context.code)).toHaveLength(0);

    // The same TV can create a new scan group next round.
    await request(app)
      .post(`/sessions/${context.code}/advance`)
      .send({ deviceId: context.deviceId })
      .expect(200);

    await createGroup(context);
  });

  it("rejects missing or invalid restart modes", async () => {
    const context = await setup();

    for (const mode of [undefined, "reset", "REUSE", null]) {
      const response = await request(app)
        .post(`/sessions/${context.code}/restart`)
        .send({
          deviceId: context.deviceId,
          mode,
        })
        .expect(400);

      expect(response.body.error).toBe("invalid_restart_mode");
    }
  });

  it("rejects restart requests from unregistered TVs", async () => {
    const context = await setup();

    const response = await request(app)
      .post(`/sessions/${context.code}/restart`)
      .send({
        deviceId: "unknown-tv",
        mode: "rescan",
      })
      .expect(403);

    expect(response.body.error).toBe("threshold_not_registered");
  });

  it("rejects restart requests while already in the lobby", async () => {
    const context = await setup();

    await request(app)
      .post(`/sessions/${context.code}/restart`)
      .send({
        deviceId: context.deviceId,
        mode: "reuse",
      })
      .expect(200);

    const response = await request(app)
      .post(`/sessions/${context.code}/restart`)
      .send({
        deviceId: context.deviceId,
        mode: "rescan",
      })
      .expect(409);

    expect(response.body.error).toBe("expedition_already_in_lobby");
  });
});
