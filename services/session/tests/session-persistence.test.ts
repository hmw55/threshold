
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetSessionsForTesting } from "../src/app.js";
import { loadSessions } from "../src/sessionStore.js";

interface PersistedSession {
  code: string;
  players: Array<{
    id: string;
    name: string;
  }>;
  thresholds: Array<{
    id: string;
    deviceId: string;
    zoneName: string;
    joinedAt: string;
  }>;
  status: string;
  phase: string;
}

describe("Session persistence", () => {
  beforeEach(() => {
    resetSessionsForTesting();
  });

  it("saves a newly created expedition to SQLite", async () => {
    const response = await request(app)
      .post("/sessions")
      .send({ deviceId: "fire-tv-001" });

    expect(response.status).toBe(201);

    const session = response.body as PersistedSession;
    const persistedSessions = loadSessions<PersistedSession>();
    const savedSession = persistedSessions.get(session.code);

    expect(savedSession).toBeDefined();
    expect(savedSession?.code).toBe(session.code);
    expect(savedSession?.phase).toBe("lobby");
    expect(savedSession?.thresholds).toHaveLength(1);
    expect(savedSession?.thresholds[0]?.deviceId).toBe("fire-tv-001");
  });

  it("persists additional Fire TV registrations", async () => {
    const createResponse = await request(app)
      .post("/sessions")
      .send({ deviceId: "fire-tv-001" });

    expect(createResponse.status).toBe(201);

    const session = createResponse.body as PersistedSession;

    const joinResponse = await request(app)
      .post(`/sessions/${session.code}/thresholds`)
      .send({ deviceId: "fire-tv-002" });

    expect(joinResponse.status).toBe(201);

    const persistedSessions = loadSessions<PersistedSession>();
    const savedSession = persistedSessions.get(session.code);

    expect(savedSession).toBeDefined();
    expect(savedSession?.thresholds).toHaveLength(2);

    expect(
      savedSession?.thresholds.map((threshold) => threshold.deviceId)
    ).toEqual(["fire-tv-001", "fire-tv-002"]);

    expect(savedSession?.thresholds[0]?.zoneName).toBe("THE NEXUS");
    expect(savedSession?.thresholds[1]?.zoneName).toBe("THE VEIL");
  });

  it("persists players joining an expedition", async () => {
    const createResponse = await request(app)
      .post("/sessions")
      .send({ deviceId: "fire-tv-001" });

    expect(createResponse.status).toBe(201);

    const session = createResponse.body as PersistedSession;

    const joinResponse = await request(app)
      .post(`/sessions/${session.code}/join`)
      .send({ name: "Mack" });

    expect(joinResponse.status).toBe(201);

    const savedSession = loadSessions<PersistedSession>().get(session.code);

    expect(savedSession?.players).toHaveLength(1);
    expect(savedSession?.players[0]?.name).toBe("Mack");
    expect(savedSession?.players[0]?.id).toEqual(expect.any(String));
    expect(savedSession?.status).toBe("ready");
  });

  it("persists multiple players joining an expedition", async () => {
    const createResponse = await request(app)
      .post("/sessions")
      .send({ deviceId: "fire-tv-001" });

    expect(createResponse.status).toBe(201);

    const session = createResponse.body as PersistedSession;

    for (const name of ["Mack", "Stevie", "Harley"]) {
      const response = await request(app)
        .post(`/sessions/${session.code}/join`)
        .send({ name });

      expect(response.status).toBe(201);
    }

    const savedSession = loadSessions<PersistedSession>().get(session.code);

    expect(savedSession?.players).toHaveLength(3);
    expect(savedSession?.players.map((player) => player.name)).toEqual([
      "Mack",
      "Stevie",
      "Harley",
    ]);
  });

  it("persists player departures", async () => {
    const createResponse = await request(app)
      .post("/sessions")
      .send({ deviceId: "fire-tv-001" });

    expect(createResponse.status).toBe(201);

    const session = createResponse.body as PersistedSession;

    const firstJoin = await request(app)
      .post(`/sessions/${session.code}/join`)
      .send({ name: "Mack" });

    const secondJoin = await request(app)
      .post(`/sessions/${session.code}/join`)
      .send({ name: "Stevie" });

    expect(firstJoin.status).toBe(201);
    expect(secondJoin.status).toBe(201);

    const playerId = firstJoin.body.player.id as string;
    const playerToken = firstJoin.body.playerToken as string;

    const leaveResponse = await request(app)
      .delete(`/sessions/${session.code}/players/${playerId}`)
      .set("Authorization", `Bearer ${playerToken}`);

    expect(leaveResponse.status).toBe(200);

    const savedSession = loadSessions<PersistedSession>().get(session.code);

    expect(savedSession?.players).toHaveLength(1);
    expect(savedSession?.players[0]?.name).toBe("Stevie");
    expect(
      savedSession?.players.some((player) => player.id === playerId)
    ).toBe(false);
    expect(savedSession?.status).toBe("ready");
  });

  it("persists awaiting_players status when the final player leaves", async () => {
    const createResponse = await request(app)
      .post("/sessions")
      .send({ deviceId: "fire-tv-001" });

    expect(createResponse.status).toBe(201);

    const session = createResponse.body as PersistedSession;

    const joinResponse = await request(app)
      .post(`/sessions/${session.code}/join`)
      .send({ name: "Mack" });

    expect(joinResponse.status).toBe(201);

    const playerId = joinResponse.body.player.id as string;
    const playerToken = joinResponse.body.playerToken as string;

    const leaveResponse = await request(app)
      .delete(`/sessions/${session.code}/players/${playerId}`)
      .set("Authorization", `Bearer ${playerToken}`);

    expect(leaveResponse.status).toBe(200);

    const savedSession = loadSessions<PersistedSession>().get(session.code);

    expect(savedSession?.players).toHaveLength(0);
    expect(savedSession?.status).toBe("awaiting_players");
    expect(savedSession?.thresholds).toHaveLength(1);
  });

  it("persists Fire TV departures while other TVs remain", async () => {
    const createResponse = await request(app)
      .post("/sessions")
      .send({ deviceId: "fire-tv-001" });

    expect(createResponse.status).toBe(201);

    const session = createResponse.body as PersistedSession;

    const registerResponse = await request(app)
      .post(`/sessions/${session.code}/thresholds`)
      .send({ deviceId: "fire-tv-002" });

    expect(registerResponse.status).toBe(201);

    const leaveResponse = await request(app).delete(
      `/sessions/${session.code}/thresholds/fire-tv-001`
    );

    expect(leaveResponse.status).toBe(200);
    expect(leaveResponse.body.closed).toBe(false);

    const savedSession = loadSessions<PersistedSession>().get(session.code);

    expect(savedSession?.thresholds).toHaveLength(1);
    expect(savedSession?.thresholds[0]?.deviceId).toBe("fire-tv-002");
    expect(savedSession?.thresholds[0]?.zoneName).toBe("THE VEIL");
  });

  it("deletes the persisted expedition when the final Fire TV leaves", async () => {
    const createResponse = await request(app)
      .post("/sessions")
      .send({ deviceId: "fire-tv-001" });

    expect(createResponse.status).toBe(201);

    const session = createResponse.body as PersistedSession;

    expect(
      loadSessions<PersistedSession>().has(session.code)
    ).toBe(true);

    const leaveResponse = await request(app).delete(
      `/sessions/${session.code}/thresholds/fire-tv-001`
    );

    expect(leaveResponse.status).toBe(200);
    expect(leaveResponse.body.closed).toBe(true);

    const persistedSessions = loadSessions<PersistedSession>();

    expect(persistedSessions.has(session.code)).toBe(false);

    const lookupResponse = await request(app).get(
      `/sessions/${session.code}`
    );

    expect(lookupResponse.status).toBe(404);
  });

  it("does not duplicate persisted TVs when a device reconnects", async () => {
    const createResponse = await request(app)
      .post("/sessions")
      .send({ deviceId: "fire-tv-001" });

    expect(createResponse.status).toBe(201);

    const session = createResponse.body as PersistedSession;

    const reconnectResponse = await request(app)
      .post(`/sessions/${session.code}/thresholds/reconnect`)
      .send({ deviceId: "fire-tv-001" });

    expect(reconnectResponse.status).toBe(200);

    const savedSession = loadSessions<PersistedSession>().get(session.code);

    expect(savedSession?.thresholds).toHaveLength(1);
    expect(savedSession?.thresholds[0]?.deviceId).toBe("fire-tv-001");
  });

  it("keeps separate expeditions isolated in SQLite", async () => {
    const firstResponse = await request(app)
      .post("/sessions")
      .send({ deviceId: "fire-tv-001" });

    const secondResponse = await request(app)
      .post("/sessions")
      .send({ deviceId: "fire-tv-002" });

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);

    const firstSession = firstResponse.body as PersistedSession;
    const secondSession = secondResponse.body as PersistedSession;

    const joinResponse = await request(app)
      .post(`/sessions/${firstSession.code}/join`)
      .send({ name: "Mack" });

    expect(joinResponse.status).toBe(201);

    const persistedSessions = loadSessions<PersistedSession>();

    expect(
      persistedSessions.get(firstSession.code)?.players
    ).toHaveLength(1);

    expect(
      persistedSessions.get(secondSession.code)?.players
    ).toHaveLength(0);

    expect(
      persistedSessions.get(firstSession.code)?.thresholds[0]?.deviceId
    ).toBe("fire-tv-001");

    expect(
      persistedSessions.get(secondSession.code)?.thresholds[0]?.deviceId
    ).toBe("fire-tv-002");
  });
});
