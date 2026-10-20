
import type {
  ExpeditionSession,
  PlayerConnection,
} from "../types/session";

import {
  normalizeCode,
  request,
} from "./apiClient";

import { environmentClient } from "./environmentClient";
import { gameClient } from "./gameClient";

export { SessionClientError } from "./apiClient";

export type {
  ScanGroup,
  ScanImageUploadResult,
} from "./environmentClient";

const sessionMethods = {
  createConnection(
    code: string,
    name: string,
  ): Promise<PlayerConnection> {
    return request(
      `/sessions/${normalizeCode(code)}/join`,
      {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
        }),
      },
    );
  },

  reconnect(
    code: string,
    playerId: string,
    playerToken: string,
  ): Promise<PlayerConnection> {
    return request(
      `/sessions/${normalizeCode(code)}/reconnect`,
      {
        method: "POST",
        body: JSON.stringify({
          playerId,
          playerToken,
        }),
      },
    );
  },

  getSession(
    code: string,
  ): Promise<ExpeditionSession> {
    return request(
      `/sessions/${normalizeCode(code)}`,
    );
  },

  async leave(
    code: string,
    playerId: string,
    playerToken: string,
  ): Promise<void> {
    await request<{ session: ExpeditionSession }>(
      `/sessions/${normalizeCode(code)}/players/${encodeURIComponent(playerId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${playerToken}`,
        },
      },
    );
  },
};

export const sessionClient = {
  ...sessionMethods,
  ...environmentClient,
  ...gameClient,
};

export const joinExpedition = sessionClient.createConnection;

export const reconnectExpedition = sessionClient.reconnect;

export const leaveExpedition = sessionClient.leave;
