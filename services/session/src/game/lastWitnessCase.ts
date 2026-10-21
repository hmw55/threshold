
export type IncidentFamily = "erasure" | "breach";

export type SuspectKind =
  | "player"
  | "architect"
  | "unknown_witness"
  | "environment";

export interface MysterySuspect {
  id: string;
  kind: SuspectKind;
  displayName: string;
}

export interface MysteryClue {
  id: string;
  publicText: string;
  requiredForSolution: boolean;
}

export interface LastWitnessCase {
  id: string;
  family: IncidentFamily;
  title: string;
  objective: string;
  suspects: MysterySuspect[];
  clues: MysteryClue[];
  solution: {
    culpritId: string;
    decisiveClueIds: string[];
    explanation: string;
  };
}

export type PublicLastWitnessCase = Omit<
  LastWitnessCase,
  "solution"
>;

const cases: readonly LastWitnessCase[] = [
  {
    id: "erasure-unauthorized",
    family: "erasure",
    title: "THE MISSING WITNESS",
    objective:
      "A witness has vanished from the record. Determine who authorized the erasure and identify the evidence that proves it.",
    suspects: [
      { id: "architect", kind: "architect", displayName: "The Architect" },
      { id: "unknown", kind: "unknown_witness", displayName: "Unknown Witness" },
      { id: "system", kind: "environment", displayName: "System Failure" },
    ],
    clues: [
      {
        id: "erasure-command",
        publicText:
          "The erasure command originated from an Architect-controlled process.",
        requiredForSolution: true,
      },
      {
        id: "erasure-integrity",
        publicText:
          "The system integrity check passed immediately before the record disappeared.",
        requiredForSolution: true,
      },
      {
        id: "erasure-witness",
        publicText:
          "The missing witness had no authorization to delete their own record.",
        requiredForSolution: false,
      },
    ],
    solution: {
      culpritId: "architect",
      decisiveClueIds: ["erasure-command", "erasure-integrity"],
      explanation:
        "The Architect authorized the erasure. The command originated from its process, and the system was functioning normally.",
    },
  },
  {
    id: "erasure-self-removal",
    family: "erasure",
    title: "THE VOLUNTARY DISAPPEARANCE",
    objective:
      "A witness has been erased. Determine whether the disappearance was imposed or deliberately requested.",
    suspects: [
      { id: "architect", kind: "architect", displayName: "The Architect" },
      { id: "unknown", kind: "unknown_witness", displayName: "Unknown Witness" },
      { id: "system", kind: "environment", displayName: "System Failure" },
    ],
    clues: [
      {
        id: "erasure-consent",
        publicText:
          "A valid witness authorization was recorded before the deletion.",
        requiredForSolution: true,
      },
      {
        id: "erasure-request",
        publicText:
          "The deletion request came from the witness's authenticated terminal.",
        requiredForSolution: true,
      },
      {
        id: "erasure-execution",
        publicText:
          "The Architect executed the deletion but did not originate the request.",
        requiredForSolution: false,
      },
    ],
    solution: {
      culpritId: "unknown",
      decisiveClueIds: ["erasure-consent", "erasure-request"],
      explanation:
        "The missing witness initiated their own erasure. The Architect carried out the authorized request.",
    },
  },
  {
    id: "breach-deliberate",
    family: "breach",
    title: "THE OPEN BOUNDARY",
    objective:
      "A containment boundary was opened. Determine whether the breach was deliberate and identify who initiated it.",
    suspects: [
      { id: "architect", kind: "architect", displayName: "The Architect" },
      { id: "unknown", kind: "unknown_witness", displayName: "Unknown Witness" },
      { id: "system", kind: "environment", displayName: "System Failure" },
    ],
    clues: [
      {
        id: "breach-override",
        publicText:
          "The containment lock received a valid manual override.",
        requiredForSolution: true,
      },
      {
        id: "breach-terminal",
        publicText:
          "The override originated from the unknown witness's terminal.",
        requiredForSolution: true,
      },
      {
        id: "breach-hardware",
        publicText:
          "No mechanical failure was detected before the boundary opened.",
        requiredForSolution: false,
      },
    ],
    solution: {
      culpritId: "unknown",
      decisiveClueIds: ["breach-override", "breach-terminal"],
      explanation:
        "The unknown witness deliberately opened containment using an authorized override.",
    },
  },
  {
    id: "breach-failure",
    family: "breach",
    title: "THE FALSE SABOTAGE",
    objective:
      "Containment failed, and the Architect alleges sabotage. Determine whether anyone actually opened the boundary.",
    suspects: [
      { id: "architect", kind: "architect", displayName: "The Architect" },
      { id: "unknown", kind: "unknown_witness", displayName: "Unknown Witness" },
      { id: "system", kind: "environment", displayName: "System Failure" },
    ],
    clues: [
      {
        id: "breach-pressure",
        publicText:
          "Containment pressure exceeded the boundary's rated tolerance.",
        requiredForSolution: true,
      },
      {
        id: "breach-access",
        publicText:
          "No manual override was recorded during the incident.",
        requiredForSolution: true,
      },
      {
        id: "breach-alarm",
        publicText:
          "The warning alarm activated after the mechanical failure began.",
        requiredForSolution: false,
      },
    ],
    solution: {
      culpritId: "system",
      decisiveClueIds: ["breach-pressure", "breach-access"],
      explanation:
        "Containment failed mechanically. No witness or Architect override caused the breach.",
    },
  },
];

export function createLastWitnessCase(seed: number): LastWitnessCase {
  const index = (seed >>> 0) % cases.length;
  return structuredClone(cases[index]!);
}

export function publicLastWitnessCase(
  mystery: LastWitnessCase,
): PublicLastWitnessCase {
  const { solution: _solution, ...publicCase } = mystery;
  return publicCase;
}

export function evaluateMysteryAccusation(
  mystery: LastWitnessCase,
  culpritId: string,
  evidenceIds: readonly string[],
): "solved" | "partial" | "incorrect" {
  if (culpritId !== mystery.solution.culpritId) {
    return "incorrect";
  }

  const supplied = new Set(evidenceIds);
  const fullySupported = mystery.solution.decisiveClueIds.every(
    (id) => supplied.has(id),
  );

  return fullySupported ? "solved" : "partial";
}
