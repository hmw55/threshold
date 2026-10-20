import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  deleteSession,
} from "../src/sessionStore.js";

import {
  getOrCreateEnvironmentObjectRef,
  saveSession,
} from "../src/sessionStore.js";

import {
  seedSimulatedLivingRoom,
} from "../src/seeds/simulatedLivingRoom.js";

function createTestSession(): string {
  const code = `T${randomUUID().replaceAll("-", "").slice(0, 5).toUpperCase()}`;

  // Reference allocation only needs an existing session row.
  saveSession(code, {
    code,
    status: "test",
  });

  return code;
}

describe("Persistent Architect object references", () => {
  it("returns the same reference for repeated requests", () => {
    seedSimulatedLivingRoom();

    const sessionCode = createTestSession();

    const first = getOrCreateEnvironmentObjectRef(
      sessionCode,
      "living-room-bookshelf",
    );

    const second = getOrCreateEnvironmentObjectRef(
      sessionCode,
      "living-room-bookshelf",
    );

    expect(first).toBe("observed-1");
    expect(second).toBe(first);
  });

  it("assigns distinct references to different objects", () => {
    seedSimulatedLivingRoom();

    const sessionCode = createTestSession();

    const bookshelf = getOrCreateEnvironmentObjectRef(
      sessionCode,
      "living-room-bookshelf",
    );

    const couch = getOrCreateEnvironmentObjectRef(
      sessionCode,
      "living-room-couch",
    );

    expect(bookshelf).toBe("observed-1");
    expect(couch).toBe("observed-2");
  });

  it("isolates references between expeditions", () => {
    seedSimulatedLivingRoom();

    const firstSession = createTestSession();
    const secondSession = createTestSession();

    expect(
      getOrCreateEnvironmentObjectRef(
        firstSession,
        "living-room-bookshelf",
      ),
    ).toBe("observed-1");

    expect(
      getOrCreateEnvironmentObjectRef(
        secondSession,
        "living-room-couch",
      ),
    ).toBe("observed-1");
  });

  it("removes object references when an expedition is deleted", () => {
    seedSimulatedLivingRoom();

    const sessionCode = createTestSession();

    const reference = getOrCreateEnvironmentObjectRef(
      sessionCode,
      "living-room-bookshelf",
    );

    expect(reference).toBe("observed-1");

    deleteSession(sessionCode);

    // A deleted expedition cannot allocate references.
    expect(() =>
      getOrCreateEnvironmentObjectRef(
        sessionCode,
        "living-room-couch",
      ),
    ).toThrow();

    // Recreating the same session code starts with fresh references.
    saveSession(sessionCode, {
      code: sessionCode,
      status: "test",
    });

    const newReference = getOrCreateEnvironmentObjectRef(
      sessionCode,
      "living-room-couch",
    );

    expect(newReference).toBe("observed-1");
  });

  it("continues allocating references monotonically", () => {
    seedSimulatedLivingRoom();

    const sessionCode = createTestSession();

    const first = getOrCreateEnvironmentObjectRef(
      sessionCode,
      "living-room-bookshelf",
    );

    const second = getOrCreateEnvironmentObjectRef(
      sessionCode,
      "living-room-couch",
    );

    const third = getOrCreateEnvironmentObjectRef(
      sessionCode,
      "living-room-coffee-table",
    );

    expect(first).toBe("observed-1");
    expect(second).toBe("observed-2");
    expect(third).toBe("observed-3");

    // Repeated lookups must not consume reference numbers.
    expect(
      getOrCreateEnvironmentObjectRef(
        sessionCode,
        "living-room-bookshelf",
      ),
    ).toBe("observed-1");

    expect(
      getOrCreateEnvironmentObjectRef(
        sessionCode,
        "living-room-television",
      ),
    ).toBe("observed-4");
  });
});