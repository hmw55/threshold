import { getEnvironmentKnowledgeSnapshot } from "../architect/environmentKnowledge.js";
import { toModelEnvironment } from "../architect/modelEnvironment.js";
import { selectAnchorObject } from "./anchorSelection.js";
import { firstSignalPuzzle } from "./lastWitnessPuzzles.js";
import type { BoundPuzzle } from "./puzzleBinding.js";

export interface ResolvedAnchorPuzzle {
  puzzle: BoundPuzzle;
  objects: {
    ref: string;
    name: string;
    location: string | null;
  }[];
}

export function resolveAnchorPuzzle(
  environmentId: string,
  sessionCode: string,
): ResolvedAnchorPuzzle | null {
  const snapshot = getEnvironmentKnowledgeSnapshot(
    environmentId,
    sessionCode,
  );

  if (!snapshot) return null;

  const environment = toModelEnvironment(snapshot, sessionCode);

  const objects = environment.objects
    .filter(
      (object) =>
        object.recognitionStatus === "confirmed" &&
        object.name !== null,
    )
    .map((object) => ({
      ref: object.ref,
      name: object.name!,
      location: object.location,
    }));

  const selected = selectAnchorObject(environment);

  if (!selected) return null;

  const target = objects.find(
    (object) => object.ref === selected.objectRef,
  );

  if (!target) return null;

  const normalizedName = target.name.trim();
  const characters = Array.from(normalizedName);

  const firstLetter = characters[0]?.toUpperCase() ?? "?";
  const lastLetter =
    characters[characters.length - 1]?.toUpperCase() ?? "?";

  const sameNameCount = objects.filter(
    (object) =>
      object.name.trim().toLowerCase() ===
      normalizedName.toLowerCase(),
  ).length;

  const clue =
    sameNameCount > 1
      ? `The first signal is bound to an object named "${normalizedName}". Multiple matching objects were detected. Investigate the matching objects to locate its source.`
      : `The first signal is bound to an object whose name begins with "${firstLetter}", ends with "${lastLetter}", and contains ${characters.length} characters. Identify the source.`;

  return {
    puzzle: {
      puzzleId: firstSignalPuzzle.id,
      objectiveId: firstSignalPuzzle.objectiveId,
      objectRef: selected.objectRef,
      clue,
      successNarration: firstSignalPuzzle.successNarration,
      failureNarration: firstSignalPuzzle.failureNarration,
    },
    objects,
  };
}