import { describe, expect, it } from "vitest";
import { buildArchitectDecisionPrompt } from "../src/architect/architectDecisionPrompt.js";
import type { ModelEnvironment } from "../src/architect/modelEnvironment.js";

describe("buildArchitectDecisionPrompt", () => {
  const environment = {
    name: "Simulated Living Room",
    objects: [
      {
        ref: "observed-1",
        parentRef: null,
        name: "Bookshelf",
        category: "furniture",
        description: "A wooden bookshelf.",
        location: "Living room",
        recognitionStatus: "recognized",
        requiresCloserScan: false,
      },
    ],
  } as ModelEnvironment;

  it("requests JSON-only structured decisions", () => {
    const prompt = buildArchitectDecisionPrompt(environment, {
      type: "text",
      text: "I want to investigate the bookshelf.",
    });

    expect(prompt.systemPrompt).toContain(
      "exactly one valid JSON object",
    );
    expect(prompt.systemPrompt).toContain(
      "Always return proposedEffects as an empty array",
    );
    expect(prompt.temperature).toBe(0.2);
    expect(prompt.maxOutputTokens).toBe(1024);
    expect(prompt.format).toBe("json");
  });

  it("includes observed objects and player actions", () => {
    const prompt = buildArchitectDecisionPrompt(environment, {
      type: "text",
      text: "I want to investigate the bookshelf.",
    });

    expect(prompt.userPrompt).toContain("observed-1");
    expect(prompt.userPrompt).toContain("Bookshelf");
    expect(prompt.userPrompt).toContain(
      "I want to investigate the bookshelf.",
    );
  });

  it("supports creative player actions", () => {
    const prompt = buildArchitectDecisionPrompt(environment, {
      type: "creative",
      explanation:
        "I want to arrange objects into a symbolic bridge.",
    });

    expect(prompt.userPrompt).toContain('"type": "creative"');
    expect(prompt.userPrompt).toContain("symbolic bridge");
  });
});