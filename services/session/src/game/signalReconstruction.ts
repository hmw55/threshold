
import type { GameState } from "./gameState.js";
import { completeInteraction } from "./interactionService.js";

export interface SignalFragment {
  id: string;
  timestamp: string;
  description: string;
}

export const signalFragments: SignalFragment[] = [
  {
    id: "voice",
    timestamp: "21:17:04",
    description: "A voice describes an event.",
  },
  {
    id: "event",
    timestamp: "21:17:09",
    description: "The described event occurs.",
  },
  {
    id: "record",
    timestamp: "21:17:12",
    description: "The recording enters the archive.",
  },
];

const CORRECT_ORDER = ["voice", "event", "record"];

export interface SignalReconstructionResult {
  correct: boolean;
  state: GameState;
  narration: string;
}

export function reconstructSignal(
  state: GameState,
  submittedOrder: string[],
): SignalReconstructionResult {
  if (state.phase !== "investigation") {
    throw new Error("Signal reconstruction is not active");
  }

  if (!state.completedInteractions.includes("recover-transmission")) {
    throw new Error("Transmission must be recovered first");
  }

  if (state.completedInteractions.includes("reconstruct-signal")) {
    throw new Error("Signal has already been reconstructed");
  }

  if (
    submittedOrder.length !== CORRECT_ORDER.length ||
    new Set(submittedOrder).size !== CORRECT_ORDER.length ||
    submittedOrder.some(id => !CORRECT_ORDER.includes(id))
  ) {
    throw new Error("Invalid signal fragment sequence");
  }

  const correct = submittedOrder.every(
    (id, index) => id === CORRECT_ORDER[index],
  );

  if (!correct) {
    return {
      correct: false,
      state,
      narration:
        "The fragments do not form a coherent timeline. Try another sequence.",
    };
  }

  return {
    correct: true,
    state: completeInteraction(state, "reconstruct-signal"),
    narration:
      "Timeline reconstructed. The testimony was recorded before the event occurred.",
  };
}
