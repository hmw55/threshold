import { randomInt, randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";

type SessionStatus = "awaiting_players" | "ready";

type ExpeditionPhase =
  | "lobby"
  | "calibrating"
  | "ready"
  | "playing"
  | "results";

interface Player {
  id: string;
  name: string;
}

interface Threshold {
  id: string;
  deviceId: string;
  zoneName: string;
  joinedAt: string;
}

interface Session {
  code: string;
  players: Player[];
  thresholds: Threshold[];
  status: SessionStatus;
  phase: ExpeditionPhase;
}

const MAX_THRESHOLDS = 4;

const ZONE_NAMES = [
  "THE NEXUS",
  "THE VEIL",
  "THE RELIQUARY",
  "THE OBSERVATORY",
] as const;

const sessions = new Map<string, Session>();

export const app = express();

app.use(cors());
app.use(express.json({ limit: "32kb" }));

function generateSessionCode(): string {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let index = 0; index < 4; index += 1) {
    code += characters[randomInt(characters.length)];
  }

  return code;
}


function createThreshold(
  deviceId: string,
  zoneIndex: number
): Threshold {
  const zoneName = ZONE_NAMES[zoneIndex];

  if (!zoneName) {
    throw new Error(
      `Invalid Threshold zone index: ${zoneIndex}`
    );
  }

  return {
    id: randomUUID(),
    deviceId,
    zoneName,
    joinedAt: new Date().toISOString(),
  };
}


function readDeviceId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const deviceId = value.trim();

  if (
    deviceId.length < 1 ||
    deviceId.length > 128
  ) {
    return null;
  }

  return deviceId;
}

function getSession(code: string): Session | undefined {
  return sessions.get(code.toUpperCase());
}

function updateSessionStatus(session: Session): void {
  session.status =
    session.players.length > 0
      ? "ready"
      : "awaiting_players";
}

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "threshold-session",
  });
});

// Create an Expedition.
//
// New Fire TV clients supply a persistent deviceId.
// Older clients may omit it while the migration is underway.
app.post("/sessions", (request, response) => {
  const suppliedDeviceId = request.body?.deviceId;

  if (
    suppliedDeviceId !== undefined &&
    readDeviceId(suppliedDeviceId) === null
  ) {
    response.status(400).json({
      error: "invalid_device_id",
    });
    return;
  }

  let code = generateSessionCode();

  while (sessions.has(code)) {
    code = generateSessionCode();
  }

  const session: Session = {
    code,
    players: [],
    thresholds: [],
    status: "awaiting_players",
    phase: "lobby",
  };

  if (suppliedDeviceId !== undefined) {
    session.thresholds.push(
      createThreshold(
        readDeviceId(suppliedDeviceId)!,
        0
      )
    );
  }

  sessions.set(code, session);

  response.status(201).json(session);
});

// Read the shared Expedition state.
app.get("/sessions/:code", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({
      error: "session_not_found",
    });
    return;
  }

  response.json(session);
});

// Register an additional Fire TV with an existing Expedition.
app.post(
  "/sessions/:code/thresholds",
  (request, response) => {
    const session = getSession(request.params.code);

    if (!session) {
      response.status(404).json({
        error: "session_not_found",
      });
      return;
    }

    const deviceId = readDeviceId(
      request.body?.deviceId
    );

    if (!deviceId) {
      response.status(400).json({
        error: "device_id_required",
      });
      return;
    }

    const existing = session.thresholds.find(
      (threshold) => threshold.deviceId === deviceId
    );

    // Registering the same device again is safe.
    if (existing) {
      response.json({
        session,
        threshold: existing,
        reconnected: true,
      });
      return;
    }

    if (session.phase !== "lobby") {
      response.status(409).json({
        error: "expedition_already_started",
      });
      return;
    }

    if (session.thresholds.length >= MAX_THRESHOLDS) {
      response.status(409).json({
        error: "threshold_limit_reached",
        limit: MAX_THRESHOLDS,
      });
      return;
    }

    const threshold = createThreshold(
      deviceId,
      session.thresholds.length
    );

    session.thresholds.push(threshold);

    response.status(201).json({
      session,
      threshold,
      reconnected: false,
    });
  }
);

// Reconnect a previously registered Fire TV.
app.post(
  "/sessions/:code/thresholds/reconnect",
  (request, response) => {
    const session = getSession(request.params.code);

    if (!session) {
      response.status(404).json({
        error: "session_not_found",
      });
      return;
    }

    const deviceId = readDeviceId(
      request.body?.deviceId
    );

    if (!deviceId) {
      response.status(400).json({
        error: "device_id_required",
      });
      return;
    }

    const threshold = session.thresholds.find(
      (existing) => existing.deviceId === deviceId
    );

    if (!threshold) {
      response.status(404).json({
        error: "threshold_not_found",
      });
      return;
    }

    response.json({
      session,
      threshold,
      reconnected: true,
    });
  }
);

// Existing Lens player joining endpoint.
app.post("/sessions/:code/join", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({
      error: "session_not_found",
    });
    return;
  }

  const name =
    typeof request.body?.name === "string"
      ? request.body.name.trim()
      : "";

  if (!name) {
    response.status(400).json({
      error: "player_name_required",
    });
    return;
  }

  if (session.phase !== "lobby") {
    response.status(409).json({
      error: "expedition_already_started",
    });
    return;
  }

  const player: Player = {
    id: randomUUID(),
    name,
  };

  session.players.push(player);
  updateSessionStatus(session);

  response.status(201).json({
    session,
    player,
  });
});

// Existing Lens player reconnection endpoint.
app.post(
  "/sessions/:code/reconnect",
  (request, response) => {
    const session = getSession(request.params.code);

    if (!session) {
      response.status(404).json({
        error: "session_not_found",
      });
      return;
    }

    const playerId =
      typeof request.body?.playerId === "string"
        ? request.body.playerId
        : "";

    const player = session.players.find(
      (existing) => existing.id === playerId
    );

    if (!player) {
      response.status(404).json({
        error: "player_not_found",
      });
      return;
    }

    response.json({
      session,
      player,
    });
  }
);

export function resetSessionsForTesting(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Session reset is only available in test mode");
  }

  sessions.clear();
}