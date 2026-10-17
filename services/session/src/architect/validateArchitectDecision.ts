import type { ArchitectDecision } from "./architectActions.js";

export function validateArchitectDecision(
  value: unknown,
  allowedObjectRefs: ReadonlySet<string>,
): ArchitectDecision {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error("Architect decision must be an object");
  }

  const decision = value as Record<string, unknown>;

  if (
    typeof decision.narration !== "string" ||
    !["accepted", "needs_evidence", "rejected", "narrative_only"].includes(
      String(decision.outcome),
    ) ||
    !Array.isArray(decision.referencedObjects) ||
    !Array.isArray(decision.proposedEffects)
  ) {
    throw new Error("Architect decision has invalid fields");
  }

  if (
    !decision.referencedObjects.every(
      (ref) => typeof ref === "string" && allowedObjectRefs.has(ref),
    )
  ) {
    throw new Error("Architect referenced an unknown object");
  }

  if (decision.evidenceRequest !== undefined) {
    const evidence = decision.evidenceRequest;

    if (
      typeof evidence !== "object" ||
      evidence === null ||
      !("type" in evidence) ||
      !("instruction" in evidence) ||
      !["photo", "text", "either"].includes(String(evidence.type)) ||
      typeof evidence.instruction !== "string"
    ) {
      throw new Error("Architect provided an invalid evidence request");
    }
  }

  for (const effect of decision.proposedEffects) {
    if (
      typeof effect !== "object" ||
      effect === null ||
      !["complete_objective", "reveal_clue", "change_world_state"].includes(
        String(effect.type),
      ) ||
      typeof effect.targetId !== "string"
    ) {
      throw new Error("Architect proposed an invalid effect");
    }
  }

  return value as ArchitectDecision;
}