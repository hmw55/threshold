
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

export const gameClient = {
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
  ): Promise<GameAnswerResult> {
    return request(
      `/sessions/${normalizeCode(code)}/game/anchor/answer`,
      {
        method: "POST",
        body: JSON.stringify({
          playerId,
          playerToken,
          objectRef,
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
