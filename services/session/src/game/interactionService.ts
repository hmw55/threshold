
import type { GameState } from "./gameState.js";
import {
  lastWitnessInteractions,
} from "./lastWitnessInteractions.js";

export function completeInteraction(
  state: GameState,
  interactionId: string,
): GameState {
  if (state.phase === "complete") {
    throw new Error("Game is already complete");
  }

  const interaction = lastWitnessInteractions.find(
    (item) => item.id === interactionId,
  );

  if (!interaction) {
    throw new Error("Unknown interaction");
  }

  if (interaction.phase !== state.phase) {
    throw new Error("Interaction is not currently active");
  }

  if (state.completedInteractions.includes(interactionId)) {
    throw new Error("Interaction has already been completed");
  }

  const missingPrerequisites = interaction.requires.filter(
    (requiredId) =>
      !state.completedInteractions.includes(requiredId),
  );

  if (missingPrerequisites.length > 0) {
    throw new Error(
      `Missing prerequisites: ${missingPrerequisites.join(", ")}`,
    );
  }

  return {
    ...state,
    completedInteractions: [
      ...state.completedInteractions,
      interactionId,
    ],
  };
}
