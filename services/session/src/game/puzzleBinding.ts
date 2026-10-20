
import type { ModelEnvironment } from "../architect/modelEnvironment.js";
import type { EnvironmentalPuzzle } from "./lastWitnessPuzzles.js";

export interface BoundPuzzle {
  puzzleId: string;
  objectiveId: string;
  objectRef: string;
  clue: string;
  successNarration: string;
  failureNarration: string;
}

export function bindPuzzleToObject(
  puzzle: EnvironmentalPuzzle,
  environment: ModelEnvironment,
  objectName: string,
): BoundPuzzle {
  const matches = environment.objects.filter(
    (object) =>
      object.name !== null &&
      object.name.trim().toLowerCase() ===
        objectName.trim().toLowerCase(),
  );

  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one observed object named "${objectName}", found ${matches.length}`,
    );
  }

  const object = matches[0]!;

  return {
    puzzleId: puzzle.id,
    objectiveId: puzzle.objectiveId,
    objectRef: object.ref,
    clue: puzzle.clue,
    successNarration: puzzle.successNarration,
    failureNarration: puzzle.failureNarration,
  };
}

export interface PuzzleAnswer {
  type: "select_object";
  objectRef: string;
}

export function verifyPuzzleAnswer(
  puzzle: BoundPuzzle,
  answer: PuzzleAnswer,
): boolean {
  return answer.objectRef === puzzle.objectRef;
}
