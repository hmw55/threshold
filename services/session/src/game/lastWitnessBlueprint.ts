import type { GameBlueprint } from "./gameBlueprint.js";

export const lastWitnessBlueprint: GameBlueprint = {
  id: "last-witness-v1",
  version: 1,
  title: "The Last Witness",
  premise:
    "An event has been recorded before it happened. Three witnesses remember it differently, and the Architect's account may be incomplete.",

  objectives: [
    {
      id: "first-signal",
      phase: "investigation",
      title: "The First Signal",
      description:
        "Interpret the opening clue and identify the environmental anchor connected to the first testimony.",
      required: true,
    },
    {
      id: "contradiction",
      phase: "contradiction",
      title: "The Contradiction",
      description:
        "Compare conflicting witness accounts and identify the inconsistency.",
      required: true,
    },
    {
      id: "missing-witness",
      phase: "revelation",
      title: "The Missing Witness",
      description:
        "Investigate the final clue and uncover the evidence missing from the Architect's account.",
      required: true,
    },
  ],

  endings: ["preservation", "fracture", "reconciliation"],
};