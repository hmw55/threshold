import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  app,
  resetSessionsForTesting,
} from "../src/app.js";

describe("Lens operative departure", () => {
  beforeEach(() => {
    resetSessionsForTesting();
  });

  it("removes a departing operative and updates readiness", async () => {
    const created = await request(app)
      .post("/sessions")
      .send({ deviceId: "tv-1" })
      .expect(201);

    const code = created.body.code;

    const joined = await request(app)
      .post(`/sessions/${code}/join`)
      .send({ name: "Mack" })
      .expect(201);

    expect(joined.body.session.status).toBe("ready");

    const playerId = joined.body.player.id;
    const playerToken = joined.body.playerToken;

    const left = await request(app)
      .delete(`/sessions/${code}/players/${playerId}`)
      .set("Authorization", `Bearer ${playerToken}`)
      .expect(200);

    expect(left.body.session.players).toHaveLength(0);
    expect(left.body.session.status).toBe("awaiting_players");
    expect(left.body.session.thresholds).toHaveLength(1);

    const refreshed = await request(app)
      .get(`/sessions/${code}`)
      .expect(200);

    expect(refreshed.body.players).toHaveLength(0);
  });

  it("allows an operative to rejoin after leaving", async () => {
    const created = await request(app)
      .post("/sessions")
      .send({ deviceId: "tv-1" })
      .expect(201);

    const code = created.body.code;

    const firstJoin = await request(app)
      .post(`/sessions/${code}/join`)
      .send({ name: "Mack" })
      .expect(201);

    await request(app)
      .delete(
        `/sessions/${code}/players/${firstJoin.body.player.id}`
      )
      .set(
        "Authorization",
        `Bearer ${firstJoin.body.playerToken}`
      )
      .expect(200);

    const secondJoin = await request(app)
      .post(`/sessions/${code}/join`)
      .send({ name: "Mack" })
      .expect(201);

    expect(secondJoin.body.player.name).toBe("Mack");
    expect(secondJoin.body.player.id).not.toBe(
      firstJoin.body.player.id
    );
    expect(secondJoin.body.session.players).toHaveLength(1);
  });

  it("rejects departure for an unknown operative", async () => {
    const created = await request(app)
      .post("/sessions")
      .send({ deviceId: "tv-1" })
      .expect(201);

    await request(app)
      .delete(
        `/sessions/${created.body.code}/players/unknown-player`
      )
      .expect(404);
  });

  it("rejects departure without operative credentials", async () => {
    const created = await request(app)
      .post("/sessions")
      .send({ deviceId: "tv-1" })
      .expect(201);

    const code = created.body.code;

    const joined = await request(app)
      .post(`/sessions/${code}/join`)
      .send({ name: "Mack" })
      .expect(201);

    const playerId = joined.body.player.id;

    await request(app)
      .delete(`/sessions/${code}/players/${playerId}`)
      .expect(401);

    const session = await request(app)
      .get(`/sessions/${code}`)
      .expect(200);

    expect(session.body.players).toHaveLength(1);
    expect(session.body.players[0].id).toBe(playerId);
  });
});