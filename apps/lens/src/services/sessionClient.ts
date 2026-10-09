import type {
  ExpeditionSession,
  PlayerConnection,
} from "../types/session";

const SESSION_SERVICE_URL = import.meta.env.VITE_SESSION_SERVICE_URL;

if (!SESSION_SERVICE_URL) {
  throw new Error("VITE_SESSION_SERVICE_URL is not configured.");
}

const BASE_URL = SESSION_SERVICE_URL.replace(/\/+$/, "");

export class SessionClientError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;

  constructor(statusCode: number, errorCode: string) {
    super(`Session request failed: ${errorCode} (${statusCode})`);

    this.name = "SessionClientError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));

    throw new SessionClientError(
      response.status,
      typeof body.error === "string" ? body.error : "http_error",
    );
  }

  return (await response.json()) as T;
}

function normalizeCode(code: string): string {
  const normalized = code.trim().toUpperCase();

  if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/.test(normalized)) {
    throw new Error("Invalid Expedition access code.");
  }

  return normalized;
}

export const sessionClient = {
  createConnection(
    code: string,
    name: string,
  ): Promise<PlayerConnection> {
    return request<PlayerConnection>(
      `/sessions/${normalizeCode(code)}/join`,
      {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      },
    );
  },

  reconnect(
    code: string,
    playerId: string,
    playerToken: string,
  ): Promise<PlayerConnection> {
    return request<PlayerConnection>(
      `/sessions/${normalizeCode(code)}/reconnect`,
      {
        method: "POST",
        body: JSON.stringify({ playerId, playerToken }),
      },
    );
  },

  getSession(code: string): Promise<ExpeditionSession> {
    return request<ExpeditionSession>(
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

export const joinExpedition = sessionClient.createConnection;

export const reconnectExpedition = sessionClient.reconnect;

export const leaveExpedition = sessionClient.leave;