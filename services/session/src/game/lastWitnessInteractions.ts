
import type { GamePhase } from "./gameBlueprint.js";

export interface GameInteraction {
  id: string;
  phase: GamePhase;
  title: string;
  description: string;
  requires: string[];
}

export const lastWitnessInteractions: GameInteraction[] = [
  {
    id: "inspect-anchor",
    phase: "investigation",
    title: "Find the Anchor",
    description:
      "Locate the environmental object connected to the first signal.",
    requires: [],
  },
  {
    id: "recover-transmission",
    phase: "investigation",
    title: "Recover the Transmission",
    description:
      "Investigate the anchor and recover the fragmented recording.",
    requires: ["inspect-anchor"],
  },
  {
    id: "reconstruct-signal",
    phase: "investigation",
    title: "Reconstruct the Signal",
    description:
      "Arrange the recovered fragments to reveal the first testimony.",
    requires: ["recover-transmission"],
  },
  {
    id: "collect-testimonies",
    phase: "contradiction",
    title: "Collect the Testimonies",
    description:
      "Recover the three witness accounts.",
    requires: ["reconstruct-signal"],
  },
  {
    id: "compare-accounts",
    phase: "contradiction",
    title: "Compare the Accounts",
    description:
      "Compare the witness statements against the recording.",
    requires: ["collect-testimonies"],
  },
  {
    id: "reconstruct-timeline",
    phase: "contradiction",
    title: "Reconstruct the Timeline",
    description:
      "Establish the sequence of events surrounding the signal.",
    requires: ["compare-accounts"],
  },
  {
    id: "inspect-archive",
    phase: "revelation",
    title: "Inspect the Archive",
    description:
      "Examine the recovered archive for missing information.",
    requires: ["reconstruct-timeline"],
  },
  {
    id: "locate-receiver",
    phase: "revelation",
    title: "Locate the Receiver",
    description:
      "Find the environmental anchor associated with the unidentified receiver.",
    requires: ["inspect-archive"],
  },
  {
    id: "decode-testimony",
    phase: "revelation",
    title: "Decode the Testimony",
    description:
      "Combine the recovered evidence to understand the missing witness.",
    requires: ["locate-receiver"],
  },
];
