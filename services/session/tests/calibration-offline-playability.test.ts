import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetSessionsForTesting } from "../src/app.js";

const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==",
  "base64",
);

describe("Offline calibration does not block gameplay", () => {
  beforeEach(() => resetSessionsForTesting());

  it("starts a real expedition with an uploaded photograph without waiting for Ollama", async () => {
    const created = await request(app).post("/sessions").send({ deviceId: "tv-1" }).expect(201);
    const code = created.body.code as string;
    const thresholdId = created.body.thresholds[0].id as string;
    const joined = await request(app).post(`/sessions/${code}/join`).send({ name: "Solo" }).expect(201);
    const player = { playerId: joined.body.player.id, playerToken: joined.body.playerToken };

    await request(app).post(`/sessions/${code}/advance`).send({ deviceId: "tv-1" }).expect(200);
    await request(app).post(`/sessions/${code}/advance`).send({ deviceId: "tv-1" }).expect(409);

    const group = await request(app).post(`/sessions/${code}/scan-groups`)
      .send({ ...player, thresholdId, label: "Living room" }).expect(201);
    const groupId = group.body.group.id as string;

    await request(app).post(`/sessions/${code}/scan-groups/${groupId}/images`)
      .set("X-Player-Id", player.playerId)
      .set("Authorization", `Bearer ${player.playerToken}`)
      .attach("image", image, { filename: "room.png", contentType: "image/png" })
      .expect(201);
    await request(app).post(`/sessions/${code}/scan-groups/${groupId}/finalize`)
      .send(player).expect(200);

    const ready = await request(app).post(`/sessions/${code}/advance`)
      .send({ deviceId: "tv-1" }).expect(200);
    expect(ready.body.session.phase).toBe("ready");

    const playing = await request(app).post(`/sessions/${code}/advance`)
      .send({ deviceId: "tv-1" }).expect(200);
    expect(playing.body.session.phase).toBe("playing");
  });
});
