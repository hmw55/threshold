import type { ModelEnvironment } from "../architect/modelEnvironment.js";

export interface AnchorSelection {
  objectRef: string;
  objectName: string;
}

export function selectAnchorObject(
  environment: ModelEnvironment,
): AnchorSelection | null {
  const candidates = environment.objects
    .filter(
      (object) =>
        object.recognitionStatus === "confirmed" &&
        object.name !== null &&
        object.name.trim().length > 0,
    )
    .sort((a, b) =>
      a.name!.localeCompare(b.name!) ||
      a.ref.localeCompare(b.ref),
    );

  const selected = candidates[0];

  if (!selected || !selected.name) {
    return null;
  }

  return {
    objectRef: selected.ref,
    objectName: selected.name,
  };
}