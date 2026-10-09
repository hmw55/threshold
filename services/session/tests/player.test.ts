
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
      .send({
        playerId: joined.body.player.id,
        playerToken: joined.body.playerToken,
      })
      .expect(200);

    expect(response.body.player.id).toBe(
      joined.body.player.id
    );

    expect(response.body.session.players).toHaveLength(1);
  });

  it("rejects reconnection without credentials", async () => {
    const joined = await request(app)
      .post(`/sessions/${code}/join`)
      .send({ name: "Mack" })
      .expect(201);

    const response = await request(app)
      .post(`/sessions/${code}/reconnect`)
      .send({
        playerId: joined.body.player.id,
      })
      .expect(401);

    expect(response.body.error).toBe(
      "invalid_player_credentials"
    );
  });

  it("rejects reconnection with an invalid token", async () => {
    const joined = await request(app)
      .post(`/sessions/${code}/join`)
      .send({ name: "Mack" })
      .expect(201);

    const response = await request(app)
      .post(`/sessions/${code}/reconnect`)
      .send({
        playerId: joined.body.player.id,
        playerToken: "0".repeat(64),
      })
      .expect(401);

    expect(response.body.error).toBe(
      "invalid_player_credentials"
    );
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

  it("does not expose player credentials in public session data", async () => {
    const joined = await request(app)
      .post(`/sessions/${code}/join`)
      .send({ name: "Mack" })
      .expect(201);

    expect(joined.body.playerToken).toMatch(/^[a-f0-9]{64}$/);

    const response = await request(app)
      .get(`/sessions/${code}`)
      .expect(200);

    expect(response.body).not.toHaveProperty("playerToken");
    expect(response.body.players[0]).not.toHaveProperty(
      "playerToken"
    );
    expect(response.body.players[0]).not.toHaveProperty(
      "token_hash"
    );
  });
});
