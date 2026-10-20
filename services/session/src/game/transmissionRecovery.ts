
import type { GameState } from "./gameState.js";
import { completeInteraction } from "./interactionService.js";

export interface TransmissionFragment {
  id: string;
  label: string;
  content: string;
}

export const transmissionFragments: TransmissionFragment[] = [
  {
    id: "fragment-a",
    label: "Fragment A",
    content: "Low mechanical hum. No discernible message.",
  },
  {
    id: "fragment-b",
    label: "Fragment B",
    content: 'A voice says: "You heard me before I spoke."',
  },
  {
    id: "fragment-c",
    label: "Fragment C",
    content: "Timestamp repeats. No accompanying voice.",
  },
];

const CORRECT_FRAGMENT_ID = "fragment-b";

export interface TransmissionRecoveryResult {
  correct: boolean;
  state: GameState;
  narration: string;
}

export function recoverTransmission(
  state: GameState,
  selectedFragmentId: string,
): TransmissionRecoveryResult {
  if (state.phase !== "investigation") {
    throw new Error("Transmission recovery is not active");
  }

  if (!state.completedInteractions.includes("inspect-anchor")) {
    throw new Error("Anchor must be discovered first");
  }

  if (state.completedInteractions.includes("recover-transmission")) {
    throw new Error("Transmission has already been recovered");
  }

  const fragment = transmissionFragments.find(
    item => item.id === selectedFragmentId,
  );

  if (!fragment) {
    throw new Error("Unknown transmission fragment");
  }

  if (selectedFragmentId !== CORRECT_FRAGMENT_ID) {
    return {
      correct: false,
      state,
      narration:
        "The fragment contains no recoverable testimony. Examine the others.",
    };
  }

  return {
    correct: true,
    state: completeInteraction(state, "recover-transmission"),
    narration:
      "Transmission recovered. The voice describes an event that has not happened yet.",
  };
}
