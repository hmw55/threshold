import { appendFileSync } from "node:fs";

type LogLevel = "info" | "warn" | "error";

type OperationalEventName =
  | "backend.started"
  | "backend.stopped"
  | "calibration.analysis.started"
  | "calibration.analysis.completed"
  | "calibration.analysis.failed"
  | "calibration.upload.failed"
  | "architect.generation.completed"
  | "architect.generation.failed"
  | "session.created"
  | "session.ended";

type OperationalEvent = {
  event: OperationalEventName;
  requestId?: string;
  provider?: "gemini" | "ollama" | "bedrock" | "offline";
  durationMs?: number;
  objectCount?: number;
  statusCode?: number;
  errorCode?: string;
};

const LOG_PATH = process.env.THRESHOLD_OPERATIONAL_LOG_PATH;

const ALLOWED_EVENTS = new Set<string>([
  "backend.started",
  "backend.stopped",
  "calibration.analysis.started",
  "calibration.analysis.completed",
  "calibration.analysis.failed",
  "calibration.upload.failed",
  "architect.generation.completed",
  "architect.generation.failed",
  "session.created",
  "session.ended",
]);

const ALLOWED_PROVIDERS = new Set([
  "gemini",
  "ollama",
  "bedrock",
  "offline",
]);

const SAFE_IDENTIFIER = /^[a-z][a-z0-9_]{0,63}$/;

export function logOperationalEvent(
  level: LogLevel,
  details: OperationalEvent,
): void {
  if (!LOG_PATH) {
    return;
  }

  if (!ALLOWED_EVENTS.has(details.event)) {
    return;
  }

  if (
    details.provider !== undefined &&
    !ALLOWED_PROVIDERS.has(details.provider)
  ) {
    return;
  }

  if (
    details.errorCode !== undefined &&
    !SAFE_IDENTIFIER.test(details.errorCode)
  ) {
    return;
  }

  if (
    details.requestId !== undefined &&
    !/^[a-f0-9-]{36}$/i.test(details.requestId)
  ) {
    return;
  }

  for (const value of [
    details.durationMs,
    details.objectCount,
    details.statusCode,
  ]) {
    if (
      value !== undefined &&
      (!Number.isSafeInteger(value) || value < 0)
    ) {
      return;
    }
  }
  
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event: details.event,
    ...(details.requestId !== undefined && {
      requestId: details.requestId,
    }),
    ...(details.provider !== undefined && {
      provider: details.provider,
    }),
    ...(details.durationMs !== undefined && {
      durationMs: details.durationMs,
    }),
    ...(details.objectCount !== undefined && {
      objectCount: details.objectCount,
    }),
    ...(details.statusCode !== undefined && {
      statusCode: details.statusCode,
    }),
    ...(details.errorCode !== undefined && {
      errorCode: details.errorCode,
    }),
  };

  try {
    appendFileSync(LOG_PATH, `${JSON.stringify(record)}\n`, {
      encoding: "utf8",
      flag: "a",
    });
  } catch {
    // Logging must never interrupt gameplay.
  }
}
