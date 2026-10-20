import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import type {
  AiGenerationRequest,
  AiGenerationResponse,
  AiProvider,
} from "../src/architect/aiProvider.js";

import { ArchitectService } from "../src/architect/architectService.js";

import {
  seedSimulatedLivingRoom,
  SIMULATED_LIVING_ROOM_ID,
} from "../src/seeds/simulatedLivingRoom.js";

import { saveSession } from "../src/sessionStore.js";

function createTestSession(): string {
  const code = `T${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;

  saveSession(code, {
    code,
    status: "test",
  });

  return code;
}

function createFakeProvider() {
  const generate = vi.fn(
    async (
      _request: AiGenerationRequest,
    ): Promise<AiGenerationResponse> => ({
      text: "The bookshelf may conceal a mystery.",
      provider: "ollama",
      model: "fake-test-model",
    }),
  );

  const provider: AiProvider = {
    name: "ollama",
    generate,
  };

  return { provider, generate };
}

describe("ArchitectService", () => {
  it("sends observed environment knowledge to the AI provider", async () => {
    seedSimulatedLivingRoom();

    const sessionCode = createTestSession();
    const { provider, generate } = createFakeProvider();

    const architect = new ArchitectService({ provider });

    const result = await architect.generate({
      sessionCode,
      environmentId: SIMULATED_LIVING_ROOM_ID,
      playerRequest: "Create a mystery in this room.",
    });

    expect(generate).toHaveBeenCalledOnce();

    const prompt = generate.mock.calls[0]?.[0];

    expect(prompt).toBeDefined();

    if (!prompt) {
      throw new Error("Expected an Architect prompt");
    }

    expect(prompt.systemPrompt).toContain(
      "You are the Architect",
    );

    expect(prompt.userPrompt).toContain("Bookshelf");
    expect(prompt.userPrompt).toContain("observed-");

    expect(result).toEqual({
      text: "The bookshelf may conceal a mystery.",
      provider: "ollama",
      model: "fake-test-model",
    });
  });

  it("does not expose ground-truth IDs or undiscovered objects", async () => {
    seedSimulatedLivingRoom();

    const sessionCode = createTestSession();
    const { provider, generate } = createFakeProvider();

    const architect = new ArchitectService({ provider });

    await architect.generate({
      sessionCode,
      environmentId: SIMULATED_LIVING_ROOM_ID,
      playerRequest: "What objects can I use?",
    });

    const prompt = generate.mock.calls[0]?.[0];

    if (!prompt) {
      throw new Error("Expected an Architect prompt");
    }

    expect(prompt.userPrompt).not.toContain(
      "living-room-bookshelf",
    );

    expect(prompt.userPrompt).not.toContain(
      "living-room-chess-set",
    );

    expect(prompt.userPrompt).not.toContain("Chess set");

    expect(prompt.userPrompt).toContain(
      '"recognitionStatus": "collection_only"',
    );
  });

  it("rejects an unknown environment before calling the provider", async () => {
    const sessionCode = createTestSession();
    const { provider, generate } = createFakeProvider();

    const architect = new ArchitectService({ provider });

    await expect(
      architect.generate({
        sessionCode,
        environmentId: "nonexistent-environment",
        playerRequest: "Begin.",
      }),
    ).rejects.toThrow(
      "Environment not found: nonexistent-environment",
    );

    expect(generate).not.toHaveBeenCalled();
  });

  it("preserves object references across multiple generations", async () => {
    seedSimulatedLivingRoom();

    const sessionCode = createTestSession();
    const { provider, generate } = createFakeProvider();

    const architect = new ArchitectService({ provider });

    const request = {
      sessionCode,
      environmentId: SIMULATED_LIVING_ROOM_ID,
      playerRequest: "Describe the room.",
    };

    await architect.generate(request);
    await architect.generate(request);

    expect(generate).toHaveBeenCalledTimes(2);

    const firstPrompt = generate.mock.calls[0]?.[0];
    const secondPrompt = generate.mock.calls[1]?.[0];

    if (!firstPrompt || !secondPrompt) {
      throw new Error("Expected two Architect prompts");
    }

    expect(secondPrompt.userPrompt).toBe(firstPrompt.userPrompt);
  });
});