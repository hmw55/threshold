import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { getEnvironmentKnowledgeSnapshot } from "../src/architect/environmentKnowledge.js";
import { toModelEnvironment } from "../src/architect/modelEnvironment.js";

import {
  createEnvironment,
  createEnvironmentObject,
  saveSession,
} from "../src/sessionStore.js";

import {
  SIMULATED_LIVING_ROOM_ID,
  seedSimulatedLivingRoom,
} from "../src/seeds/simulatedLivingRoom.js";

function createTestSession(): string {
  const code = `T${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;

  saveSession(code, {
    code,
    status: "test",
  });

  return code;
}

describe("Architect model environment", () => {
  it("replaces internal object IDs with opaque references", () => {
    seedSimulatedLivingRoom();

    const sessionCode = createTestSession();

    const snapshot = getEnvironmentKnowledgeSnapshot(
      SIMULATED_LIVING_ROOM_ID,
    );

    if (!snapshot) {
      throw new Error("Expected simulated environment");
    }

    const modelEnvironment = toModelEnvironment(snapshot, sessionCode);
    const serialized = JSON.stringify(modelEnvironment);

    expect(modelEnvironment.objects).toHaveLength(7);

    expect(modelEnvironment.objects.map((object) => object.ref)).toEqual([
      "observed-1",
      "observed-2",
      "observed-3",
      "observed-4",
      "observed-5",
      "observed-6",
      "observed-7",
    ]);

    for (const object of snapshot.objects) {
      expect(serialized).not.toContain(object.id);
    }

    expect(serialized).not.toContain("simulated-living-room-v1");
    expect(serialized).not.toContain("parentObjectId");
    expect(serialized).not.toContain("environmentId");
  });

  it("preserves observed parent relationships using opaque references", () => {
    seedSimulatedLivingRoom();

    const sessionCode = createTestSession();

    const snapshot = getEnvironmentKnowledgeSnapshot(
      SIMULATED_LIVING_ROOM_ID,
    );

    if (!snapshot) {
      throw new Error("Expected simulated environment");
    }

    const modelEnvironment = toModelEnvironment(snapshot, sessionCode);

    const bookshelfIndex = snapshot.objects.findIndex(
      (object) => object.id === "living-room-bookshelf",
    );

    const boardGamesIndex = snapshot.objects.findIndex(
      (object) => object.id === "living-room-board-games",
    );

    expect(bookshelfIndex).toBeGreaterThanOrEqual(0);
    expect(boardGamesIndex).toBeGreaterThanOrEqual(0);

    const modelBookshelf = modelEnvironment.objects[bookshelfIndex];
    const modelBoardGames = modelEnvironment.objects[boardGamesIndex];

    expect(modelBookshelf?.parentRef).toBeNull();
    expect(modelBoardGames?.parentRef).toBe(modelBookshelf?.ref);
  });

  it("does not expose undiscovered objects", () => {
    seedSimulatedLivingRoom();

    const sessionCode = createTestSession();

    const snapshot = getEnvironmentKnowledgeSnapshot(
      SIMULATED_LIVING_ROOM_ID,
    );

    if (!snapshot) {
      throw new Error("Expected simulated environment");
    }

    const modelEnvironment = toModelEnvironment(snapshot, sessionCode);
    const serialized = JSON.stringify(modelEnvironment);

    expect(modelEnvironment.objects).toHaveLength(7);

    expect(serialized).not.toContain("Chess set");
    expect(serialized).not.toContain("Television remote");
    expect(serialized).not.toContain("Notebook");
  });

  it("does not expose ground-truth names when observations are unidentified", () => {
    const sessionCode = createTestSession();
    const uniqueId = randomUUID();

    const environmentId = `secret-environment-${uniqueId}`;
    const objectId = `secret-chess-set-${uniqueId}`;

    createEnvironment({
      id: environmentId,
      name: "Test Room",
      source: "simulated",
      createdAt: new Date().toISOString(),
    });

    createEnvironmentObject({
      id: objectId,
      environmentId,
      parentObjectId: null,
      name: "Secret chess set",
      category: "board_game",
      description: "A valuable chess set",
      location: "Inside a locked cabinet",
      recognitionStatus: "uncertain",
      requiresCloserScan: true,
      createdAt: new Date().toISOString(),
    });

    const modelEnvironment = toModelEnvironment(
      {
        environmentId,
        environmentName: "Test Room",
        objects: [
          {
            id: objectId,
            parentObjectId: null,
            name: null,
            category: null,
            description: "An unidentified box",
            location: null,
            recognitionStatus: "uncertain",
            requiresCloserScan: true,
          },
        ],
      },
      sessionCode,
    );

    const serialized = JSON.stringify(modelEnvironment);

    expect(modelEnvironment.objects[0]?.name).toBeNull();
    expect(modelEnvironment.objects[0]?.category).toBeNull();
    expect(serialized).not.toContain("chess");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("locked cabinet");
    expect(serialized).toContain("An unidentified box");
  });

  it("keeps references stable when the snapshot changes", () => {
    seedSimulatedLivingRoom();

    const sessionCode = createTestSession();

    const snapshot = getEnvironmentKnowledgeSnapshot(
      SIMULATED_LIVING_ROOM_ID,
    );

    if (!snapshot) {
      throw new Error("Expected simulated environment");
    }

    const first = toModelEnvironment(snapshot, sessionCode);

    // Simulate a later observation changing the visible object order.
    const reorderedSnapshot = {
      ...snapshot,
      objects: [...snapshot.objects].reverse(),
    };

    const second = toModelEnvironment(reorderedSnapshot, sessionCode);

    for (const object of snapshot.objects) {
      const originalIndex = snapshot.objects.findIndex(
        (candidate) => candidate.id === object.id,
      );

      const reorderedIndex = reorderedSnapshot.objects.findIndex(
        (candidate) => candidate.id === object.id,
      );

      expect(second.objects[reorderedIndex]?.ref).toBe(
        first.objects[originalIndex]?.ref,
      );
    }
  });

  it("does not change existing references when new objects are discovered", () => {
    seedSimulatedLivingRoom();

    const sessionCode = createTestSession();

    const snapshot = getEnvironmentKnowledgeSnapshot(
      SIMULATED_LIVING_ROOM_ID,
    );

    if (!snapshot) {
      throw new Error("Expected simulated environment");
    }

    const first = toModelEnvironment(snapshot, sessionCode);

    const existingObject = snapshot.objects[0];

    if (!existingObject) {
      throw new Error("Expected at least one observed object");
    }

    const newSnapshot = {
      ...snapshot,
      objects: [
        ...snapshot.objects,
        {
          id: "living-room-chess-set",
          parentObjectId: "living-room-bookshelf",
          name: "Chess set",
          category: "game",
          description: "A chess set discovered during closer inspection",
          location: "Bookshelf, bottom shelf",
          recognitionStatus: "confirmed" as const,
          requiresCloserScan: false,
        },
      ],
    };

    const second = toModelEnvironment(newSnapshot, sessionCode);

    expect(second.objects).toHaveLength(8);

    expect(second.objects[0]?.ref).toBe(first.objects[0]?.ref);

    expect(second.objects[7]?.ref).toBe("observed-8");

    const bookshelfIndex = snapshot.objects.findIndex(
      (object) => object.id === "living-room-bookshelf",
    );

    expect(second.objects[7]?.parentRef).toBe(
      first.objects[bookshelfIndex]?.ref,
    );
  });
});