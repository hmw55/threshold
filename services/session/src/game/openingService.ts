/**
 * Shared opening contract. The server owns the transition; polling must not
 * advance the narrative. Do not expose solution or undiscovered clues.
 */
export type OpeningPhase = "opening" | "investigation";

export interface PublicOpening {
  id: string;
  family: "erasure" | "breach";
  title: string;
  objective: string;
  suspects: readonly { id: string; name: string }[];
}

export function publicOpening(mystery: {
  id: string;
  family: "erasure" | "breach";
  title: string;
  objective: string;
  suspects: readonly { id: string; name: string }[];
}): PublicOpening {
  return {
    id: mystery.id,
    family: mystery.family,
    title: mystery.title,
    objective: mystery.objective,
    suspects: mystery.suspects.map(({ id, name }) => ({ id, name })),
  };
}

export function acknowledgeOpening<T extends { timelinePhase?: string }>(
  game: T,
): T {
  if (game.timelinePhase === "investigation") return game; // idempotent
  if (game.timelinePhase !== "opening") {
    throw new Error("opening_not_active");
  }
  return { ...game, timelinePhase: "investigation" };
}
