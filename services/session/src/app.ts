import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  clearSessions,
  deleteSession,
  loadSessions,
  saveSession,
  savePlayerCredential,
  getPlayerCredentialHash,
  deletePlayerCredential,
} from "./sessionStore.js";
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

const sessions = loadSessions<Session>();

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

function findAvailableZoneIndex(session: Session): number {
  return ZONE_NAMES.findIndex(
    (zoneName) =>
      !session.thresholds.some(
        (threshold) => threshold.zoneName === zoneName
      )
  );
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

function createPlayerToken(): string {
  return randomBytes(32).toString("hex");
}

function hashPlayerToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function verifyPlayerToken(
  playerId: string,
  token: unknown
): boolean {
  if (
    typeof token !== "string" ||
    !/^[a-f0-9]{64}$/.test(token)
  ) {
    return false;
  }

  const storedHash = getPlayerCredentialHash(playerId);

  if (!storedHash) {
    return false;
  }

  const suppliedHash = hashPlayerToken(token);

  return timingSafeEqual(
    Buffer.from(storedHash, "hex"),
    Buffer.from(suppliedHash, "hex")
  );
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
  saveSession(code, session);

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

    const zoneIndex = findAvailableZoneIndex(session);

    if (zoneIndex === -1) {
      response.status(409).json({
        error: "threshold_limit_reached",
        limit: MAX_THRESHOLDS,
      });
      return;
    }

    const threshold = createThreshold(deviceId, zoneIndex);

    session.thresholds.push(threshold);
    saveSession(session.code, session);

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

// Remove a Fire TV from an Expedition.
// Remaining TVs retain their zones and Expedition code.
// The final TV leaving closes the Expedition.
app.delete(
  "/sessions/:code/thresholds/:deviceId",
  (request, response) => {
    const session = getSession(request.params.code);

    if (!session) {
      response.status(404).json({
        error: "session_not_found",
      });
      return;
    }

    const deviceId = readDeviceId(request.params.deviceId);

    if (!deviceId) {
      response.status(400).json({
        error: "invalid_device_id",
      });
      return;
    }

    const thresholdIndex = session.thresholds.findIndex(
      (threshold) => threshold.deviceId === deviceId
    );

    if (thresholdIndex === -1) {
      response.status(404).json({
        error: "threshold_not_found",
      });
      return;
    }

    session.thresholds.splice(thresholdIndex, 1);

    if (session.thresholds.length === 0) {
      for (const player of session.players) {
        deletePlayerCredential(player.id);
      }

      sessions.delete(session.code);
      deleteSession(session.code);

      response.json({
        closed: true,
        code: session.code,
      });
      return;
    }

    saveSession(session.code, session);

    response.json({
      closed: false,
      session,
    });
  }
);


const PHASE_TRANSITIONS: Partial<
  Record<ExpeditionPhase, ExpeditionPhase>
> = {
  lobby: "calibrating",
  calibrating: "ready",
  ready: "playing",
  playing: "results",
};

// Advance the shared Expedition phase.
// Only a registered Fire TV may request a transition.
app.post("/sessions/:code/advance", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({
      error: "session_not_found",
    });
    return;
  }

  const deviceId = readDeviceId(request.body?.deviceId);

  if (!deviceId) {
    response.status(400).json({
      error: "device_id_required",
    });
    return;
  }

  const registered = session.thresholds.some(
    (threshold) => threshold.deviceId === deviceId,
  );

  if (!registered) {
    response.status(403).json({
      error: "threshold_not_registered",
    });
    return;
  }

  if (session.phase === "lobby" && session.status !== "ready") {
    response.status(409).json({
      error: "expedition_not_ready",
    });
    return;
  }

  const nextPhase = PHASE_TRANSITIONS[session.phase];

  if (!nextPhase) {
    response.status(409).json({
      error: "expedition_already_complete",
    });
    return;
  }

  session.phase = nextPhase;
  saveSession(session.code, session);

  response.json({ session });
});


/**
 * Return an Expedition from calibration to the lobby.
 *
 * Only a registered Fire TV can request this transition.
 * Players, Thresholds, and the Expedition code are preserved.
 */
app.post("/sessions/:code/back", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({
      error: "session_not_found",
    });
    return;
  }

  const deviceId = readDeviceId(request.body?.deviceId);

  if (!deviceId) {
    response.status(400).json({
      error: "device_id_required",
    });
    return;
  }

  const registered = session.thresholds.some(
    (threshold) => threshold.deviceId === deviceId,
  );

  if (!registered) {
    response.status(403).json({
      error: "threshold_not_registered",
    });
    return;
  }

  if (session.phase !== "calibrating") {
    response.status(409).json({
      error: "invalid_phase_transition",
    });
    return;
  }

  session.phase = "lobby";
  saveSession(session.code, session);

  response.json({ session });
});



/**
 * Restart an Expedition without disconnecting anyone.
 *
 * Preserves the Expedition code, registered Fire TVs,
 * connected operatives, and assigned Threshold zones.
 *
 * Only a registered Fire TV can restart an Expedition.
 */
app.post("/sessions/:code/restart", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({
      error: "session_not_found",
    });
    return;
  }

  const deviceId = readDeviceId(request.body?.deviceId);

  if (!deviceId) {
    response.status(400).json({
      error: "device_id_required",
    });
    return;
  }

  const registered = session.thresholds.some(
    (threshold) => threshold.deviceId === deviceId,
  );

  if (!registered) {
    response.status(403).json({
      error: "threshold_not_registered",
    });
    return;
  }

  // Restarting is allowed from any phase except the lobby.
  if (session.phase === "lobby") {
    response.status(409).json({
      error: "expedition_already_in_lobby",
    });
    return;
  }

  // Preserve players, devices, and the expedition code.
  session.phase = "lobby";
  updateSessionStatus(session);

  saveSession(session.code, session);

  response.json({
    session,
    restarted: true,
  });
});


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

  const playerToken = createPlayerToken();

  savePlayerCredential(
    player.id,
    hashPlayerToken(playerToken)
  );

  session.players.push(player);
  updateSessionStatus(session);
  saveSession(session.code, session);

  response.status(201).json({
    session,
    player,
    playerToken,
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

    if (!verifyPlayerToken(player.id, request.body?.playerToken)) {
      response.status(401).json({
        error: "invalid_player_credentials",
      });
      return;
    }

    response.json({
      session,
      player,
    });
  }
);

// Remove an operative from an Expedition.
// The Expedition remains active for connected Fire TVs.
// The operative can join again using the same code.
app.delete(
  "/sessions/:code/players/:playerId",
  (request, response) => {
    const session = getSession(request.params.code);

    if (!session) {
      response.status(404).json({
        error: "session_not_found",
      });
      return;
    }

    const playerId = request.params.playerId;

    const playerIndex = session.players.findIndex(
      (player) => player.id === playerId
    );

    if (playerIndex === -1) {
      response.status(404).json({
        error: "player_not_found",
      });
      return;
    }

    const token = request.get("Authorization")?.replace(
      /^Bearer\s+/i,
      ""
    );

    if (!verifyPlayerToken(playerId, token)) {
      response.status(401).json({
        error: "invalid_player_credentials",
      });
      return;
    }

    session.players.splice(playerIndex, 1);
    deletePlayerCredential(playerId);
    updateSessionStatus(session);
    saveSession(session.code, session);

    response.json({
      session,
    });
  }
);

export function resetSessionsForTesting(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Session reset is only available in test mode");
  }

  sessions.clear();
  clearSessions();
}