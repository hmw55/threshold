
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetSessionsForTesting } from "../src/app.js";

describe("Expedition calibration validation", () => {
  beforeEach(() => {
    resetSessionsForTesting();
  });

  const deviceId = "calibration-tv-1";

  const testImage = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==",
    "base64",
  );

  async function setup(secondTv = false) {
    const created = await request(app)
      .post("/sessions")
      .send({ deviceId })
      .expect(201);

    const session = created.body;

    if (secondTv) {
      const response = await request(app)
        .post(`/sessions/${session.code}/thresholds`)
        .send({ deviceId: "calibration-tv-2" })
        .expect(201);

      session.thresholds = response.body.session.thresholds;
    }

    const joined = await request(app)
      .post(`/sessions/${session.code}/join`)
      .send({ name: "Calibration Tester" })
      .expect(201);

    const player = {
      playerId: joined.body.player.id as string,
      playerToken: joined.body.playerToken as string,
    };

    await request(app)
      .post(`/sessions/${session.code}/advance`)
      .send({ deviceId })
      .expect(200);

    return { session, player };
  }

  async function createGroup(
    code: string,
    thresholdId: string,
    player: { playerId: string; playerToken: string },
  ) {
    const response = await request(app)
      .post(`/sessions/${code}/scan-groups`)
      .send({
        ...player,
        thresholdId,
        label: "THE NEXUS",
      })
      .expect(201);

    return response.body.group.id as string;
  }

  function advance(code: string, tvDeviceId = deviceId) {
    return request(app)
      .post(`/sessions/${code}/advance`)
      .send({ deviceId: tvDeviceId });
  }

  async function finalizeThresholdScan(
    code: string,
    thresholdId: string,
    player: { playerId: string; playerToken: string },
  ) {
    const groupId = await createGroup(code, thresholdId, player);

    await request(app)
      .post(`/sessions/${code}/scan-groups/${groupId}/images`)
      .set("X-Player-Id", player.playerId)
      .set("Authorization", `Bearer ${player.playerToken}`)
      .attach("image", testImage, {
        filename: "calibration.png",
        contentType: "image/png",
      })
      .expect(201);

    const finalized = await request(app)
      .post(
        `/sessions/${code}/scan-groups/${groupId}/finalize`,
      )
      .send(player)
      .expect(200);

    expect(finalized.body.group.status).toBe("uploaded");
  }

  it("rejects calibration completion when no scans exist", async () => {
    const { session } = await setup();

    const response = await advance(session.code).expect(409);

    expect(response.body.error).toBe("calibration_incomplete");
  });

  it("rejects calibration completion with a pending scan", async () => {
    const { session, player } = await setup();

    await createGroup(
      session.code,
      session.thresholds[0].id,
      player,
    );

    const response = await advance(session.code).expect(409);

    expect(response.body.error).toBe("calibration_incomplete");
  });

  it("advances to ready after its Threshold has a finalized scan", async () => {
    const { session, player } = await setup();

    await finalizeThresholdScan(
      session.code,
      session.thresholds[0].id,
      player,
    );

    const response = await advance(session.code).expect(200);

    expect(response.body.session.phase).toBe("ready");
  });

  it("requires finalized scans from every connected Threshold", async () => {
    const { session, player } = await setup(true);

    await finalizeThresholdScan(
      session.code,
      session.thresholds[0].id,
      player,
    );

    const blocked = await advance(session.code).expect(409);

    expect(blocked.body.error).toBe("calibration_incomplete");

    await finalizeThresholdScan(
      session.code,
      session.thresholds[1].id,
      player,
    );

    const ready = await advance(session.code).expect(200);

    expect(ready.body.session.phase).toBe("ready");
  });
});
