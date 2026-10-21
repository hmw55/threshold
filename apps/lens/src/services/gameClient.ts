
import {
  normalizeCode,
  playerHeaders,
  request,
} from "./apiClient";

export interface GameAnswerResult {
  correct: boolean;
  narration: string;
  game: {
    phase: string;
    completedInteractions: string[];
  };
}

export interface ContradictionStatement {
  id: string;
  witness: string;
  testimony: string;
}

export interface ContradictionStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  available: boolean;
}

export interface ContradictionResponse {
  steps: ContradictionStep[];
  statements: ContradictionStatement[];
  puzzle: {
    prompt: string;
    statements: ContradictionStatement[];
  } | null;
}

export interface ContradictionStepResult {
  completedInteractions: string[];
}

export interface RevelationStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  available: boolean;
}

export interface RevelationChoice {
  id: string;
  text: string;
}

export interface RevelationResponse {
  steps: RevelationStep[];
  archive: string | null;
  puzzle: {
    prompt: string;
    choices: RevelationChoice[];
  } | null;
}

export interface RevelationStepResult {
  completedInteractions: string[];
}

export interface MissingWitnessAnswerResult {
  correct: boolean;
  narration: string;
  game: {
    phase: GamePhase;
    completedObjectives: string[];
    completedInteractions: string[];
    discoveredEvidence: string[];
  };
}

export type GameEnding =
  | "preservation"
  | "fracture"
  | "reconciliation";

export interface EndingResponse {
  game: {
    phase: GamePhase;
    ending: GameEnding;
    completedObjectives: string[];
    completedInteractions: string[];
    discoveredEvidence: string[];
  };
}

export interface AnchorPuzzleResponse {
  puzzle: {
    id: string;
    clue: string;
    completed: boolean;
  };
  objects: {
    ref: string;
    name: string;
    location: string | null;
  }[];
}

export interface TransmissionFragment {
  id: string;
  label: string;
  content: string;
}

export interface SignalFragment {
  id: string;
  timestamp: string;
  description: string;
}

export type GamePhase =
  | "opening"
  | "investigation"
  | "contradiction"
  | "revelation"
  | "resolution"
  | "complete";

export interface GameStateResponse {
  game: {
    phase: GamePhase;
    completedObjectives: string[];
    completedInteractions: string[];
    discoveredEvidence: string[];
    ending: "preservation" | "fracture" | "reconciliation" | null;
  };
  adventure: {
    id: string;
  };
}


export interface PlayerMission {
  id: string;
  type: string;
  title: string;
  description: string;
  assignedPlayerIds: string[];
  targetPlayerId: string | null;
  objectRef: string | null;
  points: number;
  status: "available" | "accepted" | "completed" | "failed";
  private: boolean;
}

export interface PlayerMissionsResponse {
  missions: PlayerMission[];
  score: number;
}

export const gameClient = {
  getMissions(
    code: string,
    playerId: string,
    playerToken: string,
  ): Promise<PlayerMissionsResponse> {
    return request(
      `/sessions/${normalizeCode(code)}/game/missions`,
      {
        headers: playerHeaders(playerId, playerToken),
      },
    );
  },


  submitPhysicalMissionEvidence(
    code: string,
    playerId: string,
    playerToken: string,
    missionId: string,
    image: Blob,
  ): Promise<{
    accepted: boolean;
    feedback: string;
    pointsAwarded?: number;
    score?: number;
    missionId?: string;
  }> {
    const formData = new FormData();
    formData.append("image", image, "physical-evidence.jpg");

    return request(
      `/sessions/${normalizeCode(code)}/game/missions/${encodeURIComponent(missionId)}/evidence`,
      {
        method: "POST",
        headers: playerHeaders(playerId, playerToken),
        body: formData,
      },
    );
  },

  getContradiction(
    code: string,
    playerId: string,
    playerToken: string,
  ): Promise<ContradictionResponse> {
    return request(
      `/sessions/${normalizeCode(code)}/game/contradiction`,
      {
        headers: playerHeaders(playerId, playerToken),
      },
    );
  },

  completeContradictionStep(
    code: string,
    playerId: string,
    playerToken: string,
    interactionId: string,
  ): Promise<ContradictionStepResult> {
    return request(
      `/sessions/${normalizeCode(code)}/game/contradiction/step`,
      {
        method: "POST",
        body: JSON.stringify({
          playerId,
          playerToken,
          interactionId,
        }),
      },
    );
  },

  submitContradictionAnswer(
    code: string,
    playerId: string,
    playerToken: string,
    statementId: string,
  ): Promise<GameAnswerResult> {
    return request(
      `/sessions/${normalizeCode(code)}/game/contradiction/answer`,
      {
        method: "POST",
        body: JSON.stringify({
          playerId,
          playerToken,
          statementId,
        }),
      },
    );
  },

  getRevelation(
    code: string,
    playerId: string,
    playerToken: string,
  ): Promise<RevelationResponse> {
    return request(
      `/sessions/${normalizeCode(code)}/game/revelation`,
      {
        headers: playerHeaders(playerId, playerToken),
      },
    );
  },

  completeRevelationStep(
    code: string,
    playerId: string,
    playerToken: string,
    interactionId: string,
    observation?: string,
  ): Promise<RevelationStepResult> {
    return request(
      `/sessions/${normalizeCode(code)}/game/revelation/step`,
      {
        method: "POST",
        body: JSON.stringify({
          playerId,
          playerToken,
          interactionId,
          observation,
        }),
      },
    );
  },

  submitMissingWitnessAnswer(
    code: string,
    playerId: string,
    playerToken: string,
    choiceId: string,
  ): Promise<MissingWitnessAnswerResult> {
    return request(
      `/sessions/${normalizeCode(code)}/game/revelation/answer`,
      {
        method: "POST",
        body: JSON.stringify({
          playerId,
          playerToken,
          choiceId,
        }),
      },
    );
  },

  submitEnding(
    code: string,
    playerId: string,
    playerToken: string,
    ending: GameEnding,
  ): Promise<EndingResponse> {
    return request(
      `/sessions/${normalizeCode(code)}/game/resolution/answer`,
      {
        method: "POST",
        body: JSON.stringify({
          playerId,
          playerToken,
          ending,
        }),
      },
    );
  },

  getGameState(
    code: string,
    playerId: string,
    playerToken: string,
  ): Promise<GameStateResponse> {
    return request(
      `/sessions/${normalizeCode(code)}/game`,
      {
        headers: playerHeaders(playerId, playerToken),
      },
    );
  },

  getAnchorPuzzle(
    code: string,
    playerId: string,
    playerToken: string,
  ): Promise<AnchorPuzzleResponse> {
    return request(
      `/sessions/${normalizeCode(code)}/game/anchor`,
      {
        headers: playerHeaders(playerId, playerToken),
      },
    );
  },

  submitAnchorAnswer(
    code: string,
    playerId: string,
    playerToken: string,
    objectRef: string,
    observation: string,
  ): Promise<GameAnswerResult> {
    return request(
      `/sessions/${normalizeCode(code)}/game/anchor/answer`,
      {
        method: "POST",
        body: JSON.stringify({
          playerId,
          playerToken,
          objectRef,
          observation,
        }),
      },
    );
  },

  getTransmissionFragments(
    code: string,
    playerId: string,
    playerToken: string,
  ): Promise<{
    fragments: TransmissionFragment[];
    completed: boolean;
  }> {
    return request(
      `/sessions/${normalizeCode(code)}/game/transmission`,
      {
        headers: playerHeaders(playerId, playerToken),
      },
    );
  },

  submitTransmissionAnswer(
    code: string,
    playerId: string,
    playerToken: string,
    fragmentId: string,
  ): Promise<GameAnswerResult> {
    return request(
      `/sessions/${normalizeCode(code)}/game/transmission/answer`,
      {
        method: "POST",
        body: JSON.stringify({
          playerId,
          playerToken,
          fragmentId,
        }),
      },
    );
  },

  getSignalFragments(
    code: string,
    playerId: string,
    playerToken: string,
  ): Promise<{
    fragments: SignalFragment[];
    completed: boolean;
  }> {
    return request(
      `/sessions/${normalizeCode(code)}/game/reconstruction`,
      {
        headers: playerHeaders(playerId, playerToken),
      },
    );
  },

  submitSignalReconstruction(
    code: string,
    playerId: string,
    playerToken: string,
    order: string[],
  ): Promise<GameAnswerResult> {
    return request(
      `/sessions/${normalizeCode(code)}/game/reconstruction/answer`,
      {
        method: "POST",
        body: JSON.stringify({
          playerId,
          playerToken,
          order,
        }),
      },
    );
  },
};
