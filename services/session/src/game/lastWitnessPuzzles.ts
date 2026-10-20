
export interface EnvironmentalPuzzle {
  id: string;
  objectiveId: string;
  clue: string;
  expectedCategory: string;
  successNarration: string;
  failureNarration: string;
}

export const firstSignalPuzzle: EnvironmentalPuzzle = {
  id: "first-signal-puzzle",
  objectiveId: "first-signal",

  clue:
    "Seek the place where a thousand voices speak, but none can answer.",

  expectedCategory: "furniture",

  successNarration:
    "The first witness awakens. Its testimony has been preserved.",

  failureNarration:
    "The signal remains silent. Look more closely at the clue.",
};
