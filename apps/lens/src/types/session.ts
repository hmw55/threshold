export type LensState = "join" | "connected";

export interface Player {
  id: string;
  name: string;
}

export interface ExpeditionSession {
  code: string;
  players: Player[];
  thresholds: {
    id: string;
    deviceId: string;
    zoneName: string;
    joinedAt: string;
  }[];
  status: "awaiting_players" | "ready";
  phase: "lobby" | "calibrating" | "ready" | "playing" | "results";
}

export interface PlayerConnection {
  session: ExpeditionSession;
  player: Player;
}