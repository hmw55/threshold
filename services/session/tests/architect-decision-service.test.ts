import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArchitectDecisionService } from "../src/architect/architectDecisionService.js";
import type { AiProvider } from "../src/architect/aiProvider.js";

const mocks = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  toModelEnvironment: vi.fn(),
}));

vi.mock("../src/architect/environmentKnowledge.js", () => ({
  getEnvironmentKnowledgeSnapshot: mocks.getSnapshot,
}));

vi.mock("../src/architect/modelEnvironment.js", () => ({
  toModelEnvironment: mocks.toModelEnvironment,
}));

describe("ArchitectDecisionService", () => {
  const input = {
    sessionCode: "TEST123",
    environmentId: "simulated-living-room-v1",
    action: {
      type: "text" as const,
      text: "I want to investigate the bookshelf.",
    },
  };

  const validDecision = {
    narration: "Take a closer look at the bookshelf.",
    outcome: "needs_evidence",
    referencedObjects: ["observed-1"],
    evidenceRequest: {
      type: "photo",
      instruction: "Photograph the bookshelf more closely.",
    },
    proposedEffects: [],
  };

  let generate: ReturnType<typeof vi.fn>;
  let service: ArchitectDecisionService;

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getSnapshot.mockReturnValue({});

    mocks.toModelEnvironment.mockReturnValue({
      name: "Living Room",
      objects: [
        {
          ref: "observed-1",
          name: "Bookshelf",
          category: "furniture",
          description: "A wooden bookshelf.",
          location: "Living room",
          recognitionStatus: "recognized",
          requiresCloserScan: false,
        },
      ],
    });

    generate = vi.fn().mockResolvedValue({
      text: JSON.stringify(validDecision),
      provider: "ollama",
      model: "gemma3:4b",
    });

    const provider = {
      name: "ollama" as const,
      generate,
    } satisfies AiProvider;

    service = new ArchitectDecisionService(provider);
  });

  it("returns a validated decision", async () => {
    await expect(service.evaluate(input)).resolves.toEqual(
      validDecision,
    );

    expect(generate).toHaveBeenCalledOnce();
  });

  it("rejects missing environments without calling AI", async () => {
    mocks.getSnapshot.mockReturnValue(null);

    await expect(service.evaluate(input)).rejects.toThrow(
      "Environment not found",
    );

    expect(generate).not.toHaveBeenCalled();
  });

  it("rejects hallucinated object references", async () => {
    generate.mockResolvedValue({
      text: JSON.stringify({
        ...validDecision,
        referencedObjects: ["observed-999"],
      }),
      provider: "ollama",
      model: "gemma3:4b",
    });

    await expect(service.evaluate(input)).rejects.toThrow(
      "Architect referenced an unknown object",
    );
  });

  it("rejects unauthorized game-state effects", async () => {
    generate.mockResolvedValue({
      text: JSON.stringify({
        ...validDecision,
        proposedEffects: [
          {
            type: "complete_objective",
            targetId: "objective-1",
          },
        ],
      }),
      provider: "ollama",
      model: "gemma3:4b",
    });

    await expect(service.evaluate(input)).rejects.toThrow(
      "Architect proposed unauthorized game-state effects",
    );
  });

  it("rejects malformed AI JSON", async () => {
    generate.mockResolvedValue({
      text: "I think the bookshelf is important.",
      provider: "ollama",
      model: "gemma3:4b",
    });

    await expect(service.evaluate(input)).rejects.toThrow(
      "Architect returned invalid JSON",
    );
  });
});