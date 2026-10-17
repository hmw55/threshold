import type { ArchitectDecision } from "./architectActions.js";
import { validateArchitectDecision } from "./validateArchitectDecision.js";

export function parseArchitectDecision(
  responseText: string,
  allowedObjectRefs: ReadonlySet<string>,
): ArchitectDecision {
  let parsed: unknown;

  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error("Architect returned invalid JSON");
  }

  return validateArchitectDecision(parsed, allowedObjectRefs);
}