
import { describe, expect, it } from "vitest";
import type { ModelEnvironment } from "../src/architect/modelEnvironment.js";
import { firstSignalPuzzle } from "../src/game/lastWitnessPuzzles.js";
import {
  bindPuzzleToObject,
  verifyPuzzleAnswer,
} from "../src/game/puzzleBinding.js";

const environment: ModelEnvironment = {
  name: "Simulated Living Room",
  objects: [
    {
      ref: "observed-3",
      parentRef: null,
      name: "Wooden bookshelf",
      category: "furniture",
      description: "A wooden bookshelf containing books.",
      location: "Living room",
      recognitionStatus: "recognized",
      requiresCloserScan: false,
    },
    {
      ref: "observed-4",
      parentRef: null,
      name: "Wooden coffee table",
      category: "furniture",
      description: "A wooden table in front of the couch.",
      location: "Living room",
      recognitionStatus: "recognized",
      requiresCloserScan: false,
    },
  ],
};

describe("Last Witness puzzle binding", () => {
  it("binds the first puzzle to the observed bookshelf", () => {
    const bound = bindPuzzleToObject(
      firstSignalPuzzle,
      environment,
      "Wooden bookshelf",
    );

    expect(bound.objectRef).toBe("observed-3");
    expect(bound.objectiveId).toBe("first-signal");
  });

  it("accepts the correct observed object", () => {
    const bound = bindPuzzleToObject(
      firstSignalPuzzle,
      environment,
      "Wooden bookshelf",
    );

    expect(
      verifyPuzzleAnswer(bound, {
        type: "select_object",
        objectRef: "observed-3",
      }),
    ).toBe(true);
  });

  it("rejects an incorrect observed object", () => {
    const bound = bindPuzzleToObject(
      firstSignalPuzzle,
      environment,
      "Wooden bookshelf",
    );

    expect(
      verifyPuzzleAnswer(bound, {
        type: "select_object",
        objectRef: "observed-4",
      }),
    ).toBe(false);
  });

  it("rejects missing objects during binding", () => {
    expect(() =>
      bindPuzzleToObject(
        firstSignalPuzzle,
        environment,
        "Golden key",
      ),
    ).toThrow('Expected exactly one observed object named "Golden key"');
  });

  it("does not bind ambiguous object names", () => {
    const duplicateEnvironment: ModelEnvironment = {
      ...environment,
      objects: [
        ...environment.objects,
        { ...environment.objects[0]!, ref: "observed-8" },
      ],
    };

    expect(() =>
      bindPuzzleToObject(
        firstSignalPuzzle,
        duplicateEnvironment,
        "Wooden bookshelf",
      ),
    ).toThrow('Expected exactly one observed object named "Wooden bookshelf"');
  });

  it("matches object names case-insensitively", () => {
    const bound = bindPuzzleToObject(
      firstSignalPuzzle,
      environment,
      "WOODEN BOOKSHELF",
    );

    expect(bound.objectRef).toBe("observed-3");
  });
});
