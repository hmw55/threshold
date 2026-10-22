/** Deterministic fictional narrative fragments. The room anchors are confirmed objects;
 * the incident, witness and testimony are explicitly fictional game constructs.
 * Never present these fragments as machine-verified camera observations.
 */
export type WitnessKind = "player" | "architect" | "unknown_witness";
export interface IncidentAnchor { name: string; location: string }
export function incidentFragments(kind: WitnessKind, anchor: IncidentAnchor) {
  const place = `${anchor.name} in ${anchor.location}`;
  const common = `CASE PREMISE // A fictional change was reported around ${place}. No camera has verified when it happened.`;
  if (kind === "player") return {
    common,
    fragments: [
      `FRAGMENT A // A participating Lens received a private recollection about ${place} before the investigation began. Ask players to compare what they knew and when.`,
      `FRAGMENT B // The Architect has no independently verified recording of the original change at ${place}. A player's account could be truthful, incomplete or deliberately misleading.`,
      `FRAGMENT C // Revisit ${place}. Distinguish today's staged movements from the fictional incident. The Last Witness is not necessarily responsible.`,
    ],
  };
  if (kind === "architect") return {
    common,
    fragments: [
      `FRAGMENT A // The fictional incident file for ${place} was first assembled by the Architect, before any player submitted an observation.`,
      `FRAGMENT B // No player Lens was assigned the private first-hand recollection of the incident at ${place}.`,
      `FRAGMENT C // The original account is attributed to the system itself. Ask whether the narrator and the Witness could be the same entity.`,
    ],
  };
  return {
    common,
    fragments: [
      `FRAGMENT A // The fictional report about ${place} refers to a perspective not assigned to any participating Lens.`,
      `FRAGMENT B // The Architect's own file explicitly marks its account as reconstructed, not first-hand testimony.`,
      `FRAGMENT C // The original fictional witness is absent from the current session. An unidentified person remains a possible answer.`,
    ],
  };
}
export function fragmentForPlayer(kind: WitnessKind, anchor: IncidentAnchor, playerIndex: number, stageIndex: number) {
  const fragments = incidentFragments(kind, anchor);
  return fragments.fragments[(playerIndex + stageIndex) % fragments.fragments.length]!;
}
