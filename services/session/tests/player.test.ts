
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  app,
  resetSessionsForTesting,
} from "../src/app.js";

describe("Lens player registration", () => {
  let code: string;

  beforeEach(async () => {
    resetSessionsForTesting();

    const response = await request(app)
      .post("/sessions")
      .send({ deviceId: "monitor" })
      .expect(201);

    code = response.body.code;
  });

  it("joins a player to an Expedition", async () => {
    const response = await request(app)
      .post(`/sessions/${code}/join`)
      .send({ name: "Mack" })
      .expect(201);

    expect(response.body.player.name).toBe("Mack");
    expect(response.body.player.id).toBeDefined();
    expect(response.body.session.players).toHaveLength(1);
    expect(response.body.session.status).toBe("ready");
  });

  it("allows multiple players in one Expedition", async () => {
    await request(app)
      .post(`/sessions/${code}/join`)
      .send({ name: "Player One" })
      .expect(201);

    await request(app)
      .post(`/sessions/${code}/join`)
      .send({ name: "Player Two" })
      .expect(201);

    const response = await request(app)
      .get(`/sessions/${code}`)
      .expect(200);

    expect(response.body.players).toHaveLength(2);
  });

  it("rejects a missing player name", async () => {
    const response = await request(app)
      .post(`/sessions/${code}/join`)
      .send({ name: " " })
      .expect(400);

    expect(response.body.error).toBe(
      "player_name_required"
    );
  });

  it("reconnects without duplicating a player", async () => {
    const joined = await request(app)
      .post(`/sessions/${code}/join`)
      .send({ name: "Mack" })
      .expect(201);

    const response = await request(app)
      .post(`/sessions/${code}/reconnect`)
      .send({ playerId: joined.body.player.id })
      .expect(200);

    expect(response.body.player.id).toBe(
      joined.body.player.id
    );

    expect(response.body.session.players).toHaveLength(1);
  });

  it("rejects an unknown player reconnect", async () => {
    const response = await request(app)
      .post(`/sessions/${code}/reconnect`)
      .send({ playerId: "not-a-player" })
      .expect(404);

    expect(response.body.error).toBe(
      "player_not_found"
    );
  });
});
