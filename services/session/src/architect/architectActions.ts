export type PlayerAction =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "photo";
      imageId: string;
      description?: string;
    }
  | {
      type: "choice";
      choiceId: string;
    }
  | {
      type: "confirmation";
      confirmed: boolean;
    }
  | {
      type: "creative";
      explanation: string;
      imageIds?: string[];
    };

export type ArchitectOutcome =
  | "accepted"
  | "needs_evidence"
  | "rejected"
  | "narrative_only";

export type EvidenceRequest = {
  type: "photo" | "text" | "either";
  instruction: string;
};

export type ProposedEffect =
  | {
      type: "complete_objective";
      targetId: string;
    }
  | {
      type: "reveal_clue";
      targetId: string;
    }
  | {
      type: "change_world_state";
      targetId: string;
    };

export interface ArchitectDecision {
  narration: string;
  outcome: ArchitectOutcome;
  referencedObjects: string[];
  evidenceRequest?: EvidenceRequest;
  proposedEffects: ProposedEffect[];
}