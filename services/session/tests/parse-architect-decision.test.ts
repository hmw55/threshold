import { describe, expect, it } from "vitest";
import { parseArchitectDecision } from "../src/architect/parseArchitectDecision.js";

describe("parseArchitectDecision", () => {
  const allowedObjectRefs = new Set([
    "observed-1",
    "observed-2",
  ]);

  const validDecision = {
    narration: "The bookshelf may contain a clue.",
    outcome: "needs_evidence",
    referencedObjects: ["observed-1"],
    evidenceRequest: {
      type: "photo",
      instruction: "Take a closer photograph of the bookshelf.",
    },
    proposedEffects: [],
  };

  it("parses and validates a valid JSON decision", () => {
    expect(
      parseArchitectDecision(
        JSON.stringify(validDecision),
        allowedObjectRefs,
      ),
    ).toEqual(validDecision);
  });

  it("rejects malformed JSON", () => {
    expect(() =>
      parseArchitectDecision(
        '{"narration": "Incomplete"',
        allowedObjectRefs,
      ),
    ).toThrow("Architect returned invalid JSON");
  });

  it("rejects Markdown code fences", () => {
    expect(() =>
      parseArchitectDecision(
        `\`\`\`json\n${JSON.stringify(validDecision)}\n\`\`\``,
        allowedObjectRefs,
      ),
    ).toThrow("Architect returned invalid JSON");
  });

  it("rejects unknown object references", () => {
    expect(() =>
      parseArchitectDecision(
        JSON.stringify({
          ...validDecision,
          referencedObjects: ["observed-999"],
        }),
        allowedObjectRefs,
      ),
    ).toThrow("Architect referenced an unknown object");
  });

  it("rejects invalid decision outcomes", () => {
    expect(() =>
      parseArchitectDecision(
        JSON.stringify({
          ...validDecision,
          outcome: "instant_victory",
        }),
        allowedObjectRefs,
      ),
    ).toThrow("Architect decision has invalid fields");
  });

  it("rejects missing required fields", () => {
    expect(() =>
      parseArchitectDecision(
        JSON.stringify({
          narration: "Something changes.",
          outcome: "accepted",
        }),
        allowedObjectRefs,
      ),
    ).toThrow("Architect decision has invalid fields");
  });

  it("accepts decisions without optional evidence requests", () => {
    const decision = {
      narration: "The Architect acknowledges your answer.",
      outcome: "narrative_only",
      referencedObjects: [],
      proposedEffects: [],
    };

    expect(
      parseArchitectDecision(
        JSON.stringify(decision),
        allowedObjectRefs,
      ),
    ).toEqual(decision);
  });
});