
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  app,
  resetSessionsForTesting,
} from "../src/app.js";

describe("Expedition sessions", () => {
  beforeEach(() => {
    resetSessionsForTesting();
  });

  it("creates a four-character Expedition code", async () => {
    const response = await request(app)
      .post("/sessions")
      .send({ deviceId: "monitor" })
      .expect(201);

    expect(response.body.code).toMatch(
      /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/
    );

    expect(response.body.phase).toBe("lobby");
    expect(response.body.players).toEqual([]);
    expect(response.body.thresholds).toHaveLength(1);
  });

  it("retrieves an existing Expedition", async () => {
    const created = await request(app)
      .post("/sessions")
      .send({ deviceId: "monitor" })
      .expect(201);

    const response = await request(app)
      .get(`/sessions/${created.body.code}`)
      .expect(200);

    expect(response.body.code).toBe(created.body.code);
  });

  it("returns 404 for an unknown Expedition", async () => {
    const response = await request(app)
      .get("/sessions/ZZZZ")
      .expect(404);

    expect(response.body.error).toBe(
      "session_not_found"
    );
  });

  it("rejects invalid device identifiers", async () => {
    const response = await request(app)
      .post("/sessions")
      .send({ deviceId: "" })
      .expect(400);

    expect(response.body.error).toBe(
      "invalid_device_id"
    );
  });
});
