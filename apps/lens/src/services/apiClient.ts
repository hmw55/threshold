
const SESSION_SERVICE_URL = import.meta.env.VITE_SESSION_SERVICE_URL;

if (!SESSION_SERVICE_URL) {
  throw new Error("VITE_SESSION_SERVICE_URL is not configured.");
}

const BASE_URL = SESSION_SERVICE_URL.replace(/\/+$/, "");

export class SessionClientError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly details: string | null;

  constructor(
    statusCode: number,
    errorCode: string,
    details: string | null = null,
  ) {
    super(details ?? `Session request failed: ${errorCode} (${statusCode})`);

    this.name = "SessionClientError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

export async function request<T>(
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
      typeof body.feedback === "string"
        ? body.feedback
        : null,
    );
  }

  return (await response.json()) as T;
}

export function normalizeCode(code: string): string {
  const normalized = code.trim().toUpperCase();

  if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/.test(normalized)) {
    throw new Error("Invalid Expedition access code.");
  }

  return normalized;
}

export function playerHeaders(
  playerId: string,
  playerToken: string,
): Record<string, string> {
  return {
    "X-Player-Id": playerId,
    Authorization: `Bearer ${playerToken}`,
  };
}
