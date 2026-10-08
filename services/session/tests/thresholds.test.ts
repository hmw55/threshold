
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  app,
  resetSessionsForTesting,
} from "../src/app.js";

describe("Multi-Threshold registration", () => {
  let code: string;

  beforeEach(async () => {
    resetSessionsForTesting();

    const response = await request(app)
      .post("/sessions")
      .send({ deviceId: "monitor" })
      .expect(201);

    code = response.body.code;
  });

  it("assigns the first TV to The Nexus", async () => {
    const response = await request(app)
      .get(`/sessions/${code}`)
      .expect(200);

    expect(response.body.thresholds).toHaveLength(1);
    expect(response.body.thresholds[0].zoneName).toBe(
      "THE NEXUS"
    );
  });

  it("joins a second TV to the same Expedition", async () => {
    const response = await request(app)
      .post(`/sessions/${code}/thresholds`)
      .send({ deviceId: "bedroom" })
      .expect(201);

    expect(response.body.threshold.zoneName).toBe(
      "THE VEIL"
    );

    expect(response.body.session.thresholds).toHaveLength(2);
    expect(response.body.session.code).toBe(code);
  });

  it("does not duplicate a registered TV", async () => {
    await request(app)
      .post(`/sessions/${code}/thresholds`)
      .send({ deviceId: "bedroom" })
      .expect(201);

    const response = await request(app)
      .post(`/sessions/${code}/thresholds`)
      .send({ deviceId: "bedroom" })
      .expect(200);

    expect(response.body.reconnected).toBe(true);
    expect(response.body.session.thresholds).toHaveLength(2);
  });

  it("reconnects a TV with its original zone", async () => {
    const joined = await request(app)
      .post(`/sessions/${code}/thresholds`)
      .send({ deviceId: "bedroom" })
      .expect(201);

    const response = await request(app)
      .post(`/sessions/${code}/thresholds/reconnect`)
      .send({ deviceId: "bedroom" })
      .expect(200);

    expect(response.body.threshold.id).toBe(
      joined.body.threshold.id
    );

    expect(response.body.threshold.zoneName).toBe(
      "THE VEIL"
    );
  });

  it("limits Expeditions to four TVs", async () => {
    for (const deviceId of [
      "bedroom",
      "guest",
      "office",
    ]) {
      await request(app)
        .post(`/sessions/${code}/thresholds`)
        .send({ deviceId })
        .expect(201);
    }

    const response = await request(app)
      .post(`/sessions/${code}/thresholds`)
      .send({ deviceId: "fifth-tv" })
      .expect(409);

    expect(response.body.error).toBe(
      "threshold_limit_reached"
    );
  });

  it("shares the player roster across TVs", async () => {
    await request(app)
      .post(`/sessions/${code}/thresholds`)
      .send({ deviceId: "bedroom" })
      .expect(201);

    await request(app)
      .post(`/sessions/${code}/join`)
      .send({ name: "Player One" })
      .expect(201);

    const response = await request(app)
      .get(`/sessions/${code}`)
      .expect(200);

    expect(response.body.thresholds).toHaveLength(2);
    expect(response.body.players).toHaveLength(1);
    expect(response.body.players[0].name).toBe(
      "Player One"
    );
  });

  it("rejects joining an unknown Expedition", async () => {
    const response = await request(app)
      .post("/sessions/ZZZZ/thresholds")
      .send({ deviceId: "bedroom" })
      .expect(404);

    expect(response.body.error).toBe(
      "session_not_found"
    );
  });

  it("allows a TV to leave without closing the Expedition", async () => {
    await request(app)
      .post(`/sessions/${code}/thresholds`)
      .send({ deviceId: "bedroom" })
      .expect(201);

    const response = await request(app)
      .delete(`/sessions/${code}/thresholds/monitor`)
      .expect(200);

    expect(response.body.closed).toBe(false);
    expect(response.body.session.code).toBe(code);
    expect(response.body.session.thresholds).toHaveLength(1);
    expect(response.body.session.thresholds[0].deviceId).toBe(
      "bedroom"
    );
    expect(response.body.session.thresholds[0].zoneName).toBe(
      "THE VEIL"
    );
  });

  it("preserves remaining zone assignments when another TV leaves", async () => {
    for (const deviceId of ["bedroom", "guest", "office"]) {
      await request(app)
        .post(`/sessions/${code}/thresholds`)
        .send({ deviceId })
        .expect(201);
    }

    await request(app)
      .delete(`/sessions/${code}/thresholds/bedroom`)
      .expect(200);

    const response = await request(app)
      .get(`/sessions/${code}`)
      .expect(200);

    expect(
      response.body.thresholds.map(
        (threshold: { deviceId: string; zoneName: string }) => [
          threshold.deviceId,
          threshold.zoneName,
        ]
      )
    ).toEqual([
      ["monitor", "THE NEXUS"],
      ["guest", "THE RELIQUARY"],
      ["office", "THE OBSERVATORY"],
    ]);
  });

  it("reuses an available zone without duplicating assignments", async () => {
    await request(app)
      .post(`/sessions/${code}/thresholds`)
      .send({ deviceId: "bedroom" })
      .expect(201);

    await request(app)
      .post(`/sessions/${code}/thresholds`)
      .send({ deviceId: "guest" })
      .expect(201);

    await request(app)
      .delete(`/sessions/${code}/thresholds/bedroom`)
      .expect(200);

    const joined = await request(app)
      .post(`/sessions/${code}/thresholds`)
      .send({ deviceId: "office" })
      .expect(201);

    expect(joined.body.threshold.zoneName).toBe("THE VEIL");

    const zones = joined.body.session.thresholds.map(
      (threshold: { zoneName: string }) => threshold.zoneName
    );

    expect(new Set(zones).size).toBe(zones.length);
  });

  it("closes the Expedition when the final TV leaves", async () => {
    const response = await request(app)
      .delete(`/sessions/${code}/thresholds/monitor`)
      .expect(200);

    expect(response.body).toEqual({
      closed: true,
      code,
    });

    const lookup = await request(app)
      .get(`/sessions/${code}`)
      .expect(404);

    expect(lookup.body.error).toBe("session_not_found");
  });

  it("prevents a departed TV from reconnecting without joining again", async () => {
    await request(app)
      .post(`/sessions/${code}/thresholds`)
      .send({ deviceId: "bedroom" })
      .expect(201);

    await request(app)
      .delete(`/sessions/${code}/thresholds/bedroom`)
      .expect(200);

    const reconnect = await request(app)
      .post(`/sessions/${code}/thresholds/reconnect`)
      .send({ deviceId: "bedroom" })
      .expect(404);

    expect(reconnect.body.error).toBe("threshold_not_found");

    const rejoined = await request(app)
      .post(`/sessions/${code}/thresholds`)
      .send({ deviceId: "bedroom" })
      .expect(201);

    expect(rejoined.body.threshold.zoneName).toBe("THE VEIL");
  });
});
