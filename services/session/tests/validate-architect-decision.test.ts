import { describe, expect, it } from "vitest";
import { validateArchitectDecision } from "../src/architect/validateArchitectDecision.js";

describe("validateArchitectDecision", () => {
  const allowedObjectRefs = new Set([
    "observed-1",
    "observed-2",
  ]);

  const validDecision = {
    narration: "The bookshelf may hold a clue.",
    outcome: "needs_evidence",
    referencedObjects: ["observed-1"],
    evidenceRequest: {
      type: "photo",
      instruction: "Take a closer photograph of the bookshelf.",
    },
    proposedEffects: [],
  };

  it("accepts a valid decision", () => {
    expect(
      validateArchitectDecision(validDecision, allowedObjectRefs),
    ).toEqual(validDecision);
  });

  it("rejects an unknown object reference", () => {
    expect(() =>
      validateArchitectDecision(
        {
          ...validDecision,
          referencedObjects: ["observed-999"],
        },
        allowedObjectRefs,
      ),
    ).toThrow("Architect referenced an unknown object");
  });

  it("rejects an invalid outcome", () => {
    expect(() =>
      validateArchitectDecision(
        {
          ...validDecision,
          outcome: "automatically_won",
        },
        allowedObjectRefs,
      ),
    ).toThrow("Architect decision has invalid fields");
  });

  it("rejects malformed evidence requests", () => {
    expect(() =>
      validateArchitectDecision(
        {
          ...validDecision,
          evidenceRequest: {
            type: "telepathy",
            instruction: "Read the player's mind.",
          },
        },
        allowedObjectRefs,
      ),
    ).toThrow("Architect provided an invalid evidence request");
  });

  it("rejects invalid proposed effects", () => {
    expect(() =>
      validateArchitectDecision(
        {
          ...validDecision,
          proposedEffects: [
            {
              type: "delete_session",
              targetId: "session-1",
            },
          ],
        },
        allowedObjectRefs,
      ),
    ).toThrow("Architect proposed unauthorized game-state effects");
  });

  it("rejects even structurally valid effects until the server authorizes them", () => {
    const decision = {
      ...validDecision,
      outcome: "accepted",
      evidenceRequest: undefined,
      proposedEffects: [{ type: "reveal_clue", targetId: "clue-1" }],
    };

    expect(() =>
      validateArchitectDecision(decision, allowedObjectRefs),
    ).toThrow("Architect proposed unauthorized game-state effects");
  });

  it("rejects missing required fields", () => {
    expect(() =>
      validateArchitectDecision(
        {
          narration: "Something happens.",
          outcome: "accepted",
        },
        allowedObjectRefs,
      ),
    ).toThrow("Architect decision has invalid fields");
  });
});