import process from "node:process";

import {
  getOrCreateEnvironmentObjectRef,
  saveSession,
} from "../../src/sessionStore.js";

import {
  seedSimulatedLivingRoom,
} from "../../src/seeds/simulatedLivingRoom.js";

const [operation, sessionCode, objectId] = process.argv.slice(2);

if (!operation || !sessionCode || !objectId) {
  throw new Error("Expected operation, session code, and object ID");
}

if (operation === "initialize") {
  seedSimulatedLivingRoom();

  saveSession(sessionCode, {
    code: sessionCode,
    status: "test",
  });
} else if (operation !== "allocate") {
  throw new Error(`Unknown operation: ${operation}`);
}

const reference = getOrCreateEnvironmentObjectRef(
  sessionCode,
  objectId,
);

process.stdout.write(reference);