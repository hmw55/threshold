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

  // Keep the selected anchor hidden from the player.
  // The environment determines the target, not its spelling.
  const clue =
    "A signal has attached itself to something in your environment. " +
    "The Architect cannot identify its source from the initial scan alone. " +
    "Investigate your surroundings and examine objects that may be carrying the transmission.";

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