
export interface WitnessStatement {
  id: string;
  witness: string;
  testimony: string;
}

export interface ContradictionPuzzle {
  id: string;
  objectiveId: "contradiction";
  prompt: string;
  statements: WitnessStatement[];
  correctStatementId: string;
  successNarration: string;
  failureNarration: string;
}

export const contradictionPuzzle: ContradictionPuzzle = {
  id: "contradiction-puzzle",
  objectiveId: "contradiction",

  prompt:
    "The recording confirms the signal occurred at 9:17 PM. " +
    "Two witnesses remember it. One account cannot be true. " +
    "Which testimony contradicts the recording?",

  statements: [
    {
      id: "witness-ada",
      witness: "Ada",
      testimony:
        "I heard the signal at 9:17 PM. The room went silent afterward.",
    },
    {
      id: "witness-eli",
      witness: "Eli",
      testimony:
        "The signal sounded at 9:17 PM. I remember checking the clock.",
    },
    {
      id: "witness-mara",
      witness: "Mara",
      testimony:
        "There was no signal that night. The recording must be wrong.",
    },
  ],

  correctStatementId: "witness-mara",

  successNarration:
    "The accounts fracture. Mara remembers a night that the recording says never existed.",

  failureNarration:
    "That testimony agrees with the recording. The contradiction remains unresolved.",
};

export function verifyContradictionAnswer(
  puzzle: ContradictionPuzzle,
  statementId: string,
): boolean {
  return puzzle.correctStatementId === statementId;
}
