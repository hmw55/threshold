
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  backfillBaselineObservationIdentity,
  clearSessions,
  createEnvironment,
  createEnvironmentObject,
  createEnvironmentObservation,
  getEnvironment,
  getEnvironmentObject,
  getEnvironmentObservation,
  listEnvironmentObjects,
  listEnvironmentObservations,
  type EnvironmentObject,
  type EnvironmentObservation,
} from "../src/sessionStore.js";

import {
  seedSimulatedLivingRoom,
  SIMULATED_LIVING_ROOM_ID,
} from "../src/seeds/simulatedLivingRoom.js";

describe("Environment persistence", () => {
  it("creates and retrieves a simulated environment", () => {
    const environment = {
      id: randomUUID(),
      name: "Simulated Living Room",
      source: "simulated" as const,
      createdAt: new Date().toISOString(),
    };

    createEnvironment(environment);

    expect(getEnvironment(environment.id)).toEqual(environment);
  });

  it("preserves environments when sessions are cleared", () => {
    const environment = {
      id: randomUUID(),
      name: "Persistent Living Room",
      source: "simulated" as const,
      createdAt: new Date().toISOString(),
    };

    createEnvironment(environment);
    clearSessions();

    expect(getEnvironment(environment.id)).toEqual(environment);
  });

  it("returns null for an unknown environment", () => {
    expect(getEnvironment(randomUUID())).toBeNull();
  });

  it("stores and retrieves objects in a simulated room", () => {
    const environmentId = randomUUID();
    const createdAt = new Date().toISOString();

    createEnvironment({
      id: environmentId,
      name: "Simulated Living Room",
      source: "simulated",
      createdAt,
    });

    const bookshelf: EnvironmentObject = {
      id: randomUUID(),
      environmentId,
      parentObjectId: null,
      name: "Wooden bookshelf",
      category: "furniture",
      description: "A tall bookshelf beside the television",
      location: "North wall",
      recognitionStatus: "confirmed",
      requiresCloserScan: false,
      createdAt,
    };

    createEnvironmentObject(bookshelf);

    expect(getEnvironmentObject(bookshelf.id)).toEqual(bookshelf);
    expect(listEnvironmentObjects(environmentId)).toEqual([bookshelf]);
  });

  it("rejects parent objects from another environment", () => {
    const firstId = randomUUID();
    const secondId = randomUUID();
    const createdAt = new Date().toISOString();

    for (const id of [firstId, secondId]) {
      createEnvironment({
        id,
        name: "Test Room",
        source: "simulated",
        createdAt,
      });
    }

    const bookshelf: EnvironmentObject = {
      id: randomUUID(),
      environmentId: firstId,
      parentObjectId: null,
      name: "Bookshelf",
      category: "furniture",
      description: null,
      location: "North wall",
      recognitionStatus: "confirmed",
      requiresCloserScan: false,
      createdAt,
    };

    createEnvironmentObject(bookshelf);

    expect(() =>
      createEnvironmentObject({
        ...bookshelf,
        id: randomUUID(),
        environmentId: secondId,
        parentObjectId: bookshelf.id,
        name: "Misplaced Book",
        category: "book",
      }),
    ).toThrow("environment_parent_mismatch");
  });

  it("rejects nonexistent parent objects", () => {
    const environmentId = randomUUID();
    const createdAt = new Date().toISOString();

    createEnvironment({
      id: environmentId,
      name: "Test Room",
      source: "simulated",
      createdAt,
    });

    expect(() =>
      createEnvironmentObject({
        id: randomUUID(),
        environmentId,
        parentObjectId: randomUUID(),
        name: "Book",
        category: "book",
        description: null,
        location: "Bookshelf",
        recognitionStatus: "confirmed",
        requiresCloserScan: false,
        createdAt,
      }),
    ).toThrow("environment_parent_not_found");
  });

  it("seeds a reusable living room with nested objects", () => {
    seedSimulatedLivingRoom();

    const environment = getEnvironment(
      SIMULATED_LIVING_ROOM_ID,
    );

    expect(environment).toMatchObject({
      name: "Simulated Living Room",
      source: "simulated",
    });

    const objects = listEnvironmentObjects(
      SIMULATED_LIVING_ROOM_ID,
    );

    expect(objects).toHaveLength(18);

    const bookshelf = objects.find(
      (object) => object.id === "living-room-bookshelf",
    );

    const boardGames = objects.find(
      (object) => object.id === "living-room-board-games",
    );

    const chessSet = objects.find(
      (object) => object.id === "living-room-chess-set",
    );

    expect(boardGames?.parentObjectId).toBe(bookshelf?.id);
    expect(boardGames?.recognitionStatus).toBe("collection_only");
    expect(boardGames?.requiresCloserScan).toBe(true);

    expect(chessSet?.parentObjectId).toBe(bookshelf?.id);
    expect(chessSet?.recognitionStatus).toBe("confirmed");
    expect(chessSet?.requiresCloserScan).toBe(false);

    // Re-running the seed must not duplicate objects.
    seedSimulatedLivingRoom();

    expect(
      listEnvironmentObjects(SIMULATED_LIVING_ROOM_ID),
    ).toHaveLength(18);
  });

  it("populates objects when the simulated environment already exists", () => {
    const existing = getEnvironment(SIMULATED_LIVING_ROOM_ID);

    if (!existing) {
      createEnvironment({
        id: SIMULATED_LIVING_ROOM_ID,
        name: "Simulated Living Room",
        source: "simulated",
        createdAt: new Date().toISOString(),
      });
    }

    seedSimulatedLivingRoom();

    expect(
      listEnvironmentObjects(SIMULATED_LIVING_ROOM_ID),
    ).toHaveLength(18);

    seedSimulatedLivingRoom();

    expect(
      listEnvironmentObjects(SIMULATED_LIVING_ROOM_ID),
    ).toHaveLength(18);
  });

  it("records and retrieves an environment observation", () => {
    seedSimulatedLivingRoom();

    const observation: EnvironmentObservation = {
      id: randomUUID(),
      environmentId: SIMULATED_LIVING_ROOM_ID,
      objectId: "living-room-bookshelf",
      observedName: "Observed test object",
      observedCategory: "test",
      sessionCode: null,
      scanGroupId: null,
      recognitionStatus: "confirmed",
      observedAt: new Date().toISOString(),
      observedDescription: "A tall wooden bookshelf",
      observedLocation: "North wall",
    };

    createEnvironmentObservation(observation);

    expect(getEnvironmentObservation(observation.id)).toEqual(
      observation,
    );

    expect(
      listEnvironmentObservations(SIMULATED_LIVING_ROOM_ID),
    ).toContainEqual(observation);
  });

  it("rejects observations belonging to another environment", () => {
    seedSimulatedLivingRoom();

    const otherEnvironmentId = randomUUID();

    createEnvironment({
      id: otherEnvironmentId,
      name: "Other Room",
      source: "simulated",
      createdAt: new Date().toISOString(),
    });

    expect(() =>
      createEnvironmentObservation({
        id: randomUUID(),
        environmentId: otherEnvironmentId,
        objectId: "living-room-bookshelf",
        observedName: "Observed test object",
        observedCategory: "test",
        sessionCode: null,
        scanGroupId: null,
        recognitionStatus: "confirmed",
        observedAt: new Date().toISOString(),
        observedDescription: null,
        observedLocation: null,
      }),
    ).toThrow("environment_observation_mismatch");
  });

  it("keeps baseline observations separate from expedition observations", () => {
    seedSimulatedLivingRoom();

    const baselineObservation: EnvironmentObservation = {
      id: randomUUID(),
      environmentId: SIMULATED_LIVING_ROOM_ID,
      objectId: "living-room-couch",
      observedName: "Observed test object",
      observedCategory: "test",
      sessionCode: null,
      scanGroupId: null,
      recognitionStatus: "confirmed",
      observedAt: new Date().toISOString(),
      observedDescription: "A green couch",
      observedLocation: "West wall",
    };

    createEnvironmentObservation(baselineObservation);

    const baseline = listEnvironmentObservations(
      SIMULATED_LIVING_ROOM_ID,
    );

    expect(baseline).toContainEqual(baselineObservation);

    expect(
      baseline.every(
        (observation) => observation.sessionCode === null,
      ),
    ).toBe(true);
  });

  it("seeds only the Architect's initial discoveries", () => {
    seedSimulatedLivingRoom();

    const observations = listEnvironmentObservations(
      SIMULATED_LIVING_ROOM_ID,
    );

    const seeded = observations.filter(
      (observation) => observation.id.startsWith("baseline-"),
    );

    expect(seeded).toHaveLength(7);

    expect(
      seeded.find(
        (observation) =>
          observation.objectId === "living-room-board-games",
      )?.recognitionStatus,
    ).toBe("collection_only");

    expect(
      seeded.some(
        (observation) =>
          observation.objectId === "living-room-chess-set",
      ),
    ).toBe(false);

    seedSimulatedLivingRoom();

    expect(
      listEnvironmentObservations(SIMULATED_LIVING_ROOM_ID)
        .filter((observation) =>
          observation.id.startsWith("baseline-"),
        ),
    ).toHaveLength(7);
  });

  it("backfills missing baseline identity without overwriting observations", () => {
    seedSimulatedLivingRoom();

    const objectId = "living-room-bookshelf";
    const environmentId = SIMULATED_LIVING_ROOM_ID;

    // Simulate a baseline observation created before identity fields existed.
    const legacyObservationId = `baseline-${objectId}`;

    // Create an isolated environment to avoid modifying shared seed data.
    const isolatedEnvironmentId = randomUUID();
    const isolatedObjectId = randomUUID();

    createEnvironment({
      id: isolatedEnvironmentId,
      name: "Legacy Observation Test",
      source: "simulated",
      createdAt: new Date().toISOString(),
    });

    createEnvironmentObject({
      id: isolatedObjectId,
      environmentId: isolatedEnvironmentId,
      parentObjectId: null,
      name: "Hidden ground-truth object",
      category: "furniture",
      description: "Ground-truth description",
      location: "Ground-truth location",
      recognitionStatus: "confirmed",
      requiresCloserScan: false,
      createdAt: new Date().toISOString(),
    });

    createEnvironmentObservation({
      id: `baseline-${isolatedObjectId}`,
      environmentId: isolatedEnvironmentId,
      objectId: isolatedObjectId,
      sessionCode: null,
      scanGroupId: null,
      observedName: null,
      observedCategory: null,
      recognitionStatus: "uncertain",
      observedAt: "2026-10-01T00:00:00.000Z",
      observedDescription: "A blurry object",
      observedLocation: null,
    });

    backfillBaselineObservationIdentity(
      isolatedEnvironmentId,
      isolatedObjectId,
      "Observed furniture",
      "furniture",
    );

    const observations = listEnvironmentObservations(
      isolatedEnvironmentId,
    );

    expect(observations).toHaveLength(1);
    expect(observations[0]?.observedName).toBe("Observed furniture");
    expect(observations[0]?.observedCategory).toBe("furniture");

    // Previously recorded information must remain untouched.
    expect(observations[0]?.recognitionStatus).toBe("uncertain");
    expect(observations[0]?.observedDescription).toBe("A blurry object");
    expect(observations[0]?.observedLocation).toBeNull();

    // Running the migration again must not overwrite existing identity.
    backfillBaselineObservationIdentity(
      isolatedEnvironmentId,
      isolatedObjectId,
      "Incorrect replacement",
      "incorrect",
    );

    const afterSecondRun = listEnvironmentObservations(
      isolatedEnvironmentId,
    );

    expect(afterSecondRun).toHaveLength(1);
    expect(afterSecondRun[0]?.observedName).toBe("Observed furniture");
    expect(afterSecondRun[0]?.observedCategory).toBe("furniture");
  });
});
