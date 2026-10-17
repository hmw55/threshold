import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import {
  getEnvironmentKnowledgeSnapshot,
} from "../src/architect/environmentKnowledge.js";
import {
  SIMULATED_LIVING_ROOM_ID,
  seedSimulatedLivingRoom,
} from "../src/seeds/simulatedLivingRoom.js";
import {
  createEnvironmentObservation,
} from "../src/sessionStore.js";
describe("Architect environment knowledge", () => {
  it("exposes observed objects without revealing undiscovered ones", () => {
    seedSimulatedLivingRoom();
    const snapshot = getEnvironmentKnowledgeSnapshot(
      SIMULATED_LIVING_ROOM_ID,
    );
    expect(snapshot).not.toBeNull();
    expect(snapshot?.objects).toHaveLength(7);
    const ids = snapshot?.objects.map((object) => object.id) ?? [];
    expect(ids).toContain("living-room-bookshelf");
    expect(ids).toContain("living-room-board-games");
    expect(ids).not.toContain("living-room-chess-set");
    expect(ids).not.toContain("living-room-tv-remote");
    expect(ids).not.toContain("living-room-notebook");
    const boardGames = snapshot?.objects.find(
      (object) => object.id === "living-room-board-games",
    );
    expect(boardGames?.recognitionStatus).toBe("collection_only");
    expect(boardGames?.requiresCloserScan).toBe(true);
  });
  it("returns null for an unknown environment", () => {
    expect(
      getEnvironmentKnowledgeSnapshot("nonexistent-environment"),
    ).toBeNull();
  });
  it("hides parent relationships when the parent is undiscovered", () => {
    seedSimulatedLivingRoom();
    createEnvironmentObservation({
      id: randomUUID(),
      environmentId: SIMULATED_LIVING_ROOM_ID,
      objectId: "living-room-table-lamp",
      sessionCode: null,
      scanGroupId: null,
      observedName: "Table lamp",
      observedCategory: "lighting",
      recognitionStatus: "confirmed",
      observedAt: new Date().toISOString(),
      observedDescription: "A small lamp",
      observedLocation: null,
    });
    const snapshot = getEnvironmentKnowledgeSnapshot(
      SIMULATED_LIVING_ROOM_ID,
    );
    const tableLamp = snapshot?.objects.find(
      (object) => object.id === "living-room-table-lamp",
    );
    expect(tableLamp).toBeDefined();
    expect(tableLamp?.parentObjectId).toBeNull();
    expect(tableLamp?.description).toBe("A small lamp");
    expect(tableLamp?.location).toBeNull();
    expect(
      snapshot?.objects.some(
        (object) => object.id === "living-room-side-table",
      ),
    ).toBe(false);
  });
  it("does not expose ground-truth names, categories, descriptions, or locations", () => {
    seedSimulatedLivingRoom();
    createEnvironmentObservation({
      id: randomUUID(),
      environmentId: SIMULATED_LIVING_ROOM_ID,
      objectId: "living-room-photo-frame",
      sessionCode: null,
      scanGroupId: null,
      observedName: null,
      observedCategory: null,
      recognitionStatus: "confirmed",
      observedAt: new Date().toISOString(),
      observedDescription: null,
      observedLocation: null,
    });
    const snapshot = getEnvironmentKnowledgeSnapshot(
      SIMULATED_LIVING_ROOM_ID,
    );
    const photoFrame = snapshot?.objects.find(
      (object) => object.id === "living-room-photo-frame",
    );
    expect(photoFrame).toBeDefined();
    expect(photoFrame?.name).toBeNull();
    expect(photoFrame?.category).toBeNull();
    expect(photoFrame?.description).toBeNull();
    expect(photoFrame?.location).toBeNull();
  });
  it("isolates discoveries between expeditions", async () => {
    seedSimulatedLivingRoom();
    // Create two real expeditions.
    const responseA = await request(app)
      .post("/sessions")
      .send({ deviceId: `tv-a-${randomUUID()}` });
    const responseB = await request(app)
      .post("/sessions")
      .send({ deviceId: `tv-b-${randomUUID()}` });
    expect(responseA.status).toBe(201);
    expect(responseB.status).toBe(201);
    const sessionA = responseA.body.code as string;
    const sessionB = responseB.body.code as string;
    expect(sessionA).not.toBe(sessionB);
    // Expedition A discovers the chess set.
    createEnvironmentObservation({
      id: randomUUID(),
      environmentId: SIMULATED_LIVING_ROOM_ID,
      objectId: "living-room-chess-set",
      sessionCode: sessionA,
      scanGroupId: null,
      observedName: "Chess set",
      observedCategory: "games",
      recognitionStatus: "confirmed",
      observedAt: new Date().toISOString(),
      observedDescription: "A wooden chess set",
      observedLocation: "On the bookshelf",
    });
    // Expedition B discovers the TV remote.
    createEnvironmentObservation({
      id: randomUUID(),
      environmentId: SIMULATED_LIVING_ROOM_ID,
      objectId: "living-room-tv-remote",
      sessionCode: sessionB,
      scanGroupId: null,
      observedName: "TV remote",
      observedCategory: "electronics",
      recognitionStatus: "confirmed",
      observedAt: new Date().toISOString(),
      observedDescription: "A black television remote",
      observedLocation: "On the coffee table",
    });
    const snapshotA = getEnvironmentKnowledgeSnapshot(
      SIMULATED_LIVING_ROOM_ID,
      sessionA,
    );
    const snapshotB = getEnvironmentKnowledgeSnapshot(
      SIMULATED_LIVING_ROOM_ID,
      sessionB,
    );
    const idsA = snapshotA?.objects.map((object) => object.id) ?? [];
    const idsB = snapshotB?.objects.map((object) => object.id) ?? [];
    // Each expedition inherits the current baseline,
    // plus exactly one expedition-specific discovery.
    const baselineSnapshot = getEnvironmentKnowledgeSnapshot(
      SIMULATED_LIVING_ROOM_ID,
    );
    const baselineIds = new Set(
      baselineSnapshot?.objects.map((object) => object.id) ?? [],
    );
    expect(baselineIds.has("living-room-chess-set")).toBe(false);
    expect(baselineIds.has("living-room-tv-remote")).toBe(false);
    expect(snapshotA?.objects).toHaveLength(baselineIds.size + 1);
    expect(snapshotB?.objects).toHaveLength(baselineIds.size + 1);
    expect(idsA).toContain("living-room-bookshelf");
    expect(idsB).toContain("living-room-bookshelf");
    // Each expedition sees only its own new discoveries.
    expect(idsA).toContain("living-room-chess-set");
    expect(idsA).not.toContain("living-room-tv-remote");
    expect(idsB).toContain("living-room-tv-remote");
    expect(idsB).not.toContain("living-room-chess-set");
    // Baseline knowledge remains unchanged.
    const baseline = getEnvironmentKnowledgeSnapshot(
      SIMULATED_LIVING_ROOM_ID,
    );
    expect(baseline?.objects).not.toContainEqual(
      expect.objectContaining({
        id: "living-room-chess-set",
      }),
    );
    expect(baseline?.objects).not.toContainEqual(
      expect.objectContaining({
        id: "living-room-tv-remote",
      }),
    );
  });
  it("uses the latest expedition observation without duplicating objects", async () => {
    seedSimulatedLivingRoom();
    const response = await request(app)
      .post("/sessions")
      .send({ deviceId: `tv-${randomUUID()}` });
    expect(response.status).toBe(201);
    const sessionCode = response.body.code as string;
    const objectId = "living-room-board-games";
    const before = getEnvironmentKnowledgeSnapshot(
      SIMULATED_LIVING_ROOM_ID,
      sessionCode,
    );
    const initialBoardGames = before?.objects.find(
      (object) => object.id === objectId,
    );
    expect(initialBoardGames?.recognitionStatus).toBe(
      "collection_only",
    );
    expect(initialBoardGames?.requiresCloserScan).toBe(true);
    // First closer inspection.
    createEnvironmentObservation({
      id: randomUUID(),
      environmentId: SIMULATED_LIVING_ROOM_ID,
      objectId,
      sessionCode,
      scanGroupId: null,
      observedName: "Board-game collection",
      observedCategory: "games",
      recognitionStatus: "uncertain",
      observedAt: "2026-10-13T10:00:00.000Z",
      observedDescription: "Several board-game boxes",
      observedLocation: "On the bookshelf",
    });
    // Second inspection confirms the collection.
    createEnvironmentObservation({
      id: randomUUID(),
      environmentId: SIMULATED_LIVING_ROOM_ID,
      objectId,
      sessionCode,
      scanGroupId: null,
      observedName: "Board-game collection",
      observedCategory: "games",
      recognitionStatus: "confirmed",
      observedAt: "2026-10-13T10:05:00.000Z",
      observedDescription: "A collection of boxed board games",
      observedLocation: "On the bookshelf",
    });
    const after = getEnvironmentKnowledgeSnapshot(
      SIMULATED_LIVING_ROOM_ID,
      sessionCode,
    );
    const matchingObjects = after?.objects.filter(
      (object) => object.id === objectId,
    );
    // Multiple observations must produce one known object.
    expect(matchingObjects).toHaveLength(1);
    const updatedBoardGames = matchingObjects?.[0];
    expect(updatedBoardGames?.recognitionStatus).toBe("confirmed");
    expect(updatedBoardGames?.requiresCloserScan).toBe(false);
    expect(updatedBoardGames?.description).toBe(
      "A collection of boxed board games",
    );
    expect(updatedBoardGames?.location).toBe("On the bookshelf");
    // Expedition observations must not change baseline knowledge.
    const baseline = getEnvironmentKnowledgeSnapshot(
      SIMULATED_LIVING_ROOM_ID,
    );
    const baselineBoardGames = baseline?.objects.find(
      (object) => object.id === objectId,
    );
    expect(baselineBoardGames?.recognitionStatus).toBe(
      "collection_only",
    );
  });
  it("prefers the newest expedition observation regardless of insertion order", async () => {
    seedSimulatedLivingRoom();
    const response = await request(app)
      .post("/sessions")
      .send({ deviceId: `tv-${randomUUID()}` });
    expect(response.status).toBe(201);
    const sessionCode = response.body.code as string;
    const objectId = "living-room-board-games";
    // Newer observation is inserted first.
    createEnvironmentObservation({
      id: randomUUID(),
      environmentId: SIMULATED_LIVING_ROOM_ID,
      objectId,
      sessionCode,
      scanGroupId: null,
      observedName: "Board-game collection",
      observedCategory: "games",
      recognitionStatus: "confirmed",
      observedAt: "2026-10-13T11:00:00.000Z",
      observedDescription: "A confirmed board-game collection",
      observedLocation: "On the bookshelf",
    });
    // An older observation arrives afterward.
    createEnvironmentObservation({
      id: randomUUID(),
      environmentId: SIMULATED_LIVING_ROOM_ID,
      objectId,
      sessionCode,
      scanGroupId: null,
      observedName: "Board-game collection",
      observedCategory: "games",
      recognitionStatus: "uncertain",
      observedAt: "2026-10-13T10:00:00.000Z",
      observedDescription: "Possibly some games",
      observedLocation: null,
    });
    const snapshot = getEnvironmentKnowledgeSnapshot(
      SIMULATED_LIVING_ROOM_ID,
      sessionCode,
    );
    const boardGames = snapshot?.objects.filter(
      (object) => object.id === objectId,
    );
    expect(boardGames).toHaveLength(1);
    expect(boardGames?.[0]?.recognitionStatus).toBe("confirmed");
    expect(boardGames?.[0]?.description).toBe(
      "A confirmed board-game collection",
    );
    expect(boardGames?.[0]?.location).toBe("On the bookshelf");
    expect(boardGames?.[0]?.requiresCloserScan).toBe(false);
  });
});
