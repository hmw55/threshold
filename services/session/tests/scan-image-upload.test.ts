import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app, resetSessionsForTesting } from "../src/app.js";
import {
  getScanGroup,
  listScanImages,
} from "../src/sessionStore.js";
import { readImage, removeImage } from "../src/imageStorage.js";

const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10,
]);

describe("Calibration photograph uploads", () => {
  const storageKeys: string[] = [];

  beforeEach(() => {
    resetSessionsForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
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

    const playerId = joined.body.player.id as string;
    const playerToken = joined.body.playerToken as string;

    const groupResponse = await request(app)
      .post(`/sessions/${session.code}/scan-groups`)
      .send({
        playerId,
        playerToken,
        thresholdId: session.thresholds[0].id,
        label: "THE NEXUS",
      })
      .expect(201);

    return {
      code: session.code as string,
      groupId: groupResponse.body.group.id as string,
      playerId,
      playerToken,
    };
  }

  function upload(
    context: Awaited<ReturnType<typeof setup>>,
    buffer = JPEG,
    mimeType = "image/jpeg",
  ) {
    return request(app)
      .post(
        `/sessions/${context.code}/scan-groups/${context.groupId}/images`,
      )
      .set("X-Player-Id", context.playerId)
      .set("Authorization", `Bearer ${context.playerToken}`)
      .attach("image", buffer, {
        filename: "environment.jpg",
        contentType: mimeType,
      });
  }

  it("uploads a photograph and persists its bytes", async () => {
    const context = await setup();

    const response = await upload(context).expect(201);

    expect(response.body.image).toMatchObject({
      scanGroupId: context.groupId,
      mimeType: "image/jpeg",
      sizeBytes: JPEG.length,
    });

    expect(response.body.count).toBe(1);
    expect(response.body.limit).toBe(6);
    expect(response.body.image.storageKey).toBeUndefined();

    const images = listScanImages(context.groupId);

    expect(images).toHaveLength(1);

    const saved = images[0];

    expect(saved).toBeDefined();

    if (!saved) {
      throw new Error("Expected saved image");
    }

    storageKeys.push(saved.storageKey);

    const restored = await readImage(saved.storageKey);

    expect(restored.equals(JPEG)).toBe(true);
  });

  it("rejects uploads without valid credentials", async () => {
    const context = await setup();

    await request(app)
      .post(
        `/sessions/${context.code}/scan-groups/${context.groupId}/images`,
      )
      .attach("image", JPEG, "environment.jpg")
      .expect(401);

    expect(listScanImages(context.groupId)).toHaveLength(0);
  });

  it("rejects unsupported image contents", async () => {
    const context = await setup();

    await upload(
      context,
      Buffer.from("not a photograph"),
    ).expect(415);

    expect(listScanImages(context.groupId)).toHaveLength(0);
  });

  it("rejects mismatched MIME types", async () => {
    const context = await setup();

    await upload(
      context,
      JPEG,
      "image/png",
    ).expect(415);
  });

  it("requires an image file", async () => {
    const context = await setup();

    await request(app)
      .post(
        `/sessions/${context.code}/scan-groups/${context.groupId}/images`,
      )
      .set("X-Player-Id", context.playerId)
      .set("Authorization", `Bearer ${context.playerToken}`)
      .expect(400);
  });

  it("enforces the six-photograph limit sequentially", async () => {
    const context = await setup();

    try {
      for (let index = 0; index < 6; index += 1) {
        await upload(context).expect(201);
      }

      await upload(context).expect(409);

      expect(listScanImages(context.groupId)).toHaveLength(6);
    } finally {
      for (const image of listScanImages(context.groupId)) {
        await removeImage(image.storageKey);
      }
    }
  });

  it("rejects photographs exceeding 10 MB", async () => {
    const context = await setup();

    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
    JPEG.copy(oversized);

    await upload(context, oversized).expect(413);

    expect(listScanImages(context.groupId)).toHaveLength(0);
  });

  it("rejects uploads to nonexistent scan groups", async () => {
    const context = await setup();

    await request(app)
      .post(
        `/sessions/${context.code}/scan-groups/missing-group/images`,
      )
      .set("X-Player-Id", context.playerId)
      .set("Authorization", `Bearer ${context.playerToken}`)
      .attach("image", JPEG, "environment.jpg")
      .expect(404);
  });

  it("rejects uploads using credentials from another expedition", async () => {
    const first = await setup();
    const second = await setup();

    await request(app)
      .post(
        `/sessions/${second.code}/scan-groups/${second.groupId}/images`,
      )
      .set("X-Player-Id", first.playerId)
      .set("Authorization", `Bearer ${first.playerToken}`)
      .attach("image", JPEG, "environment.jpg")
      .expect(401);

    expect(listScanImages(second.groupId)).toHaveLength(0);
  });

  it("keeps scan groups accessible after image uploads", async () => {
    const context = await setup();

    const group = getScanGroup(context.groupId);

    expect(group).not.toBeNull();
    expect(group?.status).toBe("pending");
  });

  it("never exceeds six photographs during concurrent uploads", async () => {
  const context = await setup();

  try {
      // Start eight uploads without waiting for each to finish.
      const results = await Promise.all(
      Array.from({ length: 8 }, () => upload(context)),
      );

      const successful = results.filter(
      (result) => result.status === 201,
      );

      const rejected = results.filter(
      (result) => result.status === 409,
      );

      expect(successful).toHaveLength(6);
      expect(rejected).toHaveLength(2);

      for (const result of rejected) {
      expect(result.body).toMatchObject({
          error: "scan_image_limit_reached",
          limit: 6,
      });
      }

      const images = listScanImages(context.groupId);

      expect(images).toHaveLength(6);
  } finally {
      for (const image of listScanImages(context.groupId)) {
      await removeImage(image.storageKey);
      }
  }
  });


  it("finalizes a scan group after uploading a photograph", async () => {
    const context = await setup();

    try {
      await upload(context).expect(201);

      expect(getScanGroup(context.groupId)?.status).toBe("pending");

      const response = await request(app)
        .post(
          `/sessions/${context.code}/scan-groups/${context.groupId}/finalize`,
        )
        .send({
          playerId: context.playerId,
          playerToken: context.playerToken,
        })
        .expect(200);

      expect(response.body.group.status).toBe("uploaded");
      expect(["uploaded", "analyzing", "completed", "failed"]).toContain(
        getScanGroup(context.groupId)?.status,
      );
      expect(listScanImages(context.groupId)).toHaveLength(1);
    } finally {
      for (const image of listScanImages(context.groupId)) {
        await removeImage(image.storageKey);
      }
    }
  });

  it("allows finalization to be safely repeated", async () => {
    const context = await setup();

    try {
      await upload(context).expect(201);

      const finalize = () =>
        request(app)
          .post(
            `/sessions/${context.code}/scan-groups/${context.groupId}/finalize`,
          )
          .send({
            playerId: context.playerId,
            playerToken: context.playerToken,
          });

      const first = await finalize().expect(200);
      const second = await finalize().expect(200);

      expect(first.body.group.status).toBe("uploaded");
      expect(second.body.group).toMatchObject({
        id: first.body.group.id,
        sessionCode: first.body.group.sessionCode,
        thresholdId: first.body.group.thresholdId,
        claimedBy: first.body.group.claimedBy,
      });
      expect(["uploaded", "analyzing", "completed", "failed"]).toContain(
        second.body.group.status,
      );
      expect(listScanImages(context.groupId)).toHaveLength(1);
    } finally {
      for (const image of listScanImages(context.groupId)) {
        await removeImage(image.storageKey);
      }
    }
  });

  it("rejects additional photographs after finalization", async () => {
    const context = await setup();

    try {
      await upload(context).expect(201);

      await request(app)
        .post(
          `/sessions/${context.code}/scan-groups/${context.groupId}/finalize`,
        )
        .send({
          playerId: context.playerId,
          playerToken: context.playerToken,
        })
        .expect(200);

      const imagesBefore = listScanImages(context.groupId);
      expect(imagesBefore).toHaveLength(1);

      const rejected = await upload(context).expect(409);

      expect(rejected.body.error).toBe("scan_group_not_pending");

      const imagesAfter = listScanImages(context.groupId);

      expect(imagesAfter).toEqual(imagesBefore);
      expect(["uploaded", "analyzing", "completed", "failed"]).toContain(
        getScanGroup(context.groupId)?.status,
      );

      // The original photograph remains accessible.
      const saved = await readImage(imagesAfter[0]!.storageKey);
      expect(saved.equals(JPEG)).toBe(true);
    } finally {
      for (const image of listScanImages(context.groupId)) {
        await removeImage(image.storageKey);
      }
    }
  });


  it("preserves photographs when another player recovers an expired claim", async () => {
    const context = await setup();

    try {
      // Player A uploads the first photograph.
      await upload(context).expect(201);

      const originalImages = listScanImages(context.groupId);
      expect(originalImages).toHaveLength(1);

      const originalKey = originalImages[0]!.storageKey;

      // Player B joins the same expedition.
      const joined = await request(app)
        .post(`/sessions/${context.code}/join`)
        .send({ name: "Player B" })
        .expect(201);

      const secondPlayer = {
        playerId: joined.body.player.id as string,
        playerToken: joined.body.playerToken as string,
      };

      // Simulate the expiration of Player A's claim.
      const group = getScanGroup(context.groupId);
      expect(group?.claimExpiresAt).not.toBeNull();

      vi.setSystemTime(
        new Date(
          new Date(group!.claimExpiresAt!).getTime() + 1000,
        ),
      );

      // Player B recovers the abandoned scan.
      const recovered = await request(app)
        .post(
          `/sessions/${context.code}/scan-groups/${context.groupId}/claim`,
        )
        .send(secondPlayer)
        .expect(200);

      expect(recovered.body.group.claimedBy).toBe(
        secondPlayer.playerId,
      );

      // The original photograph is still stored.
      const preservedImages = listScanImages(context.groupId);

      expect(preservedImages).toHaveLength(1);
      expect(preservedImages[0]!.storageKey).toBe(originalKey);

      const preservedBytes = await readImage(originalKey);
      expect(preservedBytes.equals(JPEG)).toBe(true);

      // Player A can no longer upload.
      const rejectedUpload = await upload(context).expect(403);

      expect(rejectedUpload.body.error).toBe(
        "scan_claimed_by_another_player",
      );

      // Player A can no longer finalize.
      const rejectedFinalize = await request(app)
        .post(
          `/sessions/${context.code}/scan-groups/${context.groupId}/finalize`,
        )
        .send({
          playerId: context.playerId,
          playerToken: context.playerToken,
        })
        .expect(403);

      expect(rejectedFinalize.body.error).toBe(
        "scan_claimed_by_another_player",
      );

      // Player B uploads another photograph.
      const secondUpload = await request(app)
        .post(
          `/sessions/${context.code}/scan-groups/${context.groupId}/images`,
        )
        .set("X-Player-Id", secondPlayer.playerId)
        .set(
          "Authorization",
          `Bearer ${secondPlayer.playerToken}`,
        )
        .attach("image", JPEG, {
          filename: "second-environment.jpg",
          contentType: "image/jpeg",
        })
        .expect(201);

      expect(secondUpload.body.count).toBe(2);
      expect(listScanImages(context.groupId)).toHaveLength(2);

      // Player B finalizes the recovered scan.
      const finalized = await request(app)
        .post(
          `/sessions/${context.code}/scan-groups/${context.groupId}/finalize`,
        )
        .send(secondPlayer)
        .expect(200);

      expect(finalized.body.group.status).toBe("uploaded");
      expect(finalized.body.group.claimedBy).toBe(
        secondPlayer.playerId,
      );

      expect(listScanImages(context.groupId)).toHaveLength(2);
    } finally {
      vi.useRealTimers();

      // Clean up both photographs, even if an assertion fails.
      for (const image of listScanImages(context.groupId)) {
        await removeImage(image.storageKey);
      }
    }
  });
});
