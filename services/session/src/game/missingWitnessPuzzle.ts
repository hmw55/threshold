
export interface MissingWitnessChoice {
  id: string;
  text: string;
}

export interface MissingWitnessPuzzle {
  id: string;
  objectiveId: "missing-witness";
  prompt: string;
  evidence: string;
  choices: MissingWitnessChoice[];
  correctChoiceId: string;
  discoveredEvidenceId: string;
  successNarration: string;
  failureNarration: string;
}

export const missingWitnessPuzzle: MissingWitnessPuzzle = {
  id: "missing-witness-puzzle",
  objectiveId: "missing-witness",

  evidence:
    "ARCHIVE ENTRY 09:17 — The signal was transmitted. " +
    "No acoustic event was detected in the room. " +
    "The transmission was received by an unidentified observer.",

  prompt:
    "The recording and Mara's testimony are both accurate. " +
    "What does the recovered archive reveal?",

  choices: [
    {
      id: "recording-fabricated",
      text: "The recording was fabricated after the event.",
    },
    {
      id: "mara-lied",
      text: "Mara deliberately concealed the signal.",
    },
    {
      id: "silent-transmission",
      text:
        "The signal was transmitted without being heard. " +
        "Someone else received it.",
    },
  ],

  correctChoiceId: "silent-transmission",
  discoveredEvidenceId: "missing-testimony",

  successNarration:
    "The final witness was never in the room. " +
    "The signal was not meant to be heard. " +
    "A hidden receiver preserved the missing testimony. " +
    "The Architect's account was incomplete.",

  failureNarration:
    "That interpretation does not explain both accounts. " +
    "Examine the archive again.",
};

export function verifyMissingWitnessAnswer(
  puzzle: MissingWitnessPuzzle,
  choiceId: string,
): boolean {
  return puzzle.correctChoiceId === choiceId;
}
