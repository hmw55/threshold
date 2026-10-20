import { describe, expect, it } from "vitest";

import { buildArchitectPrompt } from "../src/architect/architectPrompt.js";
import { getEnvironmentKnowledgeSnapshot } from "../src/architect/environmentKnowledge.js";
import { toModelEnvironment } from "../src/architect/modelEnvironment.js";
import {
  seedSimulatedLivingRoom,
  SIMULATED_LIVING_ROOM_ID,
} from "../src/seeds/simulatedLivingRoom.js";
import { saveSession } from "../src/sessionStore.js";

describe("Architect prompt", () => {
  it("includes observed objects without exposing internal IDs", () => {
    seedSimulatedLivingRoom();

    const sessionCode = "PROMPTTEST1";

    saveSession(sessionCode, {
      code: sessionCode,
      status: "test",
    });

    const snapshot = getEnvironmentKnowledgeSnapshot(
      SIMULATED_LIVING_ROOM_ID,
    );

    if (!snapshot) {
      throw new Error("Expected simulated living room");
    }

    const environment = toModelEnvironment(
      snapshot,
      sessionCode,
    );

    const prompt = buildArchitectPrompt(
      environment,
      "Create a mystery using the room.",
    );

    expect(prompt.systemPrompt).toContain(
      "You are the Architect",
    );

    expect(prompt.userPrompt).toContain("observed-1");
    expect(prompt.userPrompt).toContain("Bookshelf");

    // Internal database identifiers must remain private.
    expect(prompt.userPrompt).not.toContain(
      "living-room-bookshelf",
    );

    // The chess set exists in ground truth but has not been observed.
    expect(prompt.userPrompt).not.toContain(
      "living-room-chess-set",
    );

    expect(prompt.userPrompt).not.toContain("Chess set");
  });

  it("treats uncertain observations as uncertain", () => {
    const prompt = buildArchitectPrompt(
      {
        name: "Test room",
        objects: [
          {
            ref: "observed-1",
            parentRef: null,
            name: null,
            category: null,
            description: null,
            location: null,
            recognitionStatus: "uncertain",
            requiresCloserScan: true,
          },
        ],
      },
      "What is this object?",
    );

    expect(prompt.systemPrompt).toContain(
      "Treat uncertain observations as uncertain",
    );

    expect(prompt.userPrompt).toContain(
      '"recognitionStatus": "uncertain"',
    );

    expect(prompt.userPrompt).toContain(
      '"requiresCloserScan": true',
    );
  });

  it("includes the player request", () => {
    const prompt = buildArchitectPrompt(
      {
        name: "Test room",
        objects: [],
      },
      "Begin the adventure.",
    );

    expect(prompt.userPrompt).toContain(
      "Begin the adventure.",
    );

    expect(prompt.temperature).toBe(0.4);
    expect(prompt.maxOutputTokens).toBe(2048);
  });
});