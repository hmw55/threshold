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
  createScanGroup,
  getScanGroup,
  listScanGroups,
  createScanImage,
  countScanImages,
  listScanImages,
  finalizeScanGroup,
  claimScanGroup,
  deleteSessionScanGroups,
  resetSessionScanGroupsForReuse,
} from "./sessionStore.js";
import cors from "cors";
import express from "express";
import multer from "multer";
import {
  detectImageType,
  saveImage,
  removeImage,
} from "./imageStorage.js";

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

export function resetSessionsForTesting(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("resetSessionsForTesting is only available in tests");
  }

  sessions.clear();
  clearSessions();
}

export const app = express();

app.use(cors());
app.use(express.json({ limit: "32kb" }));

const MAX_SCAN_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_SCAN_IMAGES = 6;

const scanImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_SCAN_IMAGE_SIZE,
    files: 1,
    fields: 0,
    parts: 1,
  },
}).single("image");

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

function authenticateExpeditionPlayer(
  session: Session,
  playerId: unknown,
  token: unknown
): boolean {
  if (typeof playerId !== "string") {
    return false;
  }

  const belongsToExpedition = session.players.some(
    (player) => player.id === playerId
  );

  return (
    belongsToExpedition &&
    verifyPlayerToken(playerId, token)
  );
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

  if (session.phase === "calibrating") {
    const scanGroups = listScanGroups(session.code);

    const allThresholdsScanned =
      session.thresholds.length > 0 &&
      session.thresholds.every((threshold) =>
        scanGroups.some(
          (group) =>
            group.thresholdId === threshold.id &&
            ["uploaded", "analyzing", "completed"].includes(group.status),
        ),
      );

    if (!allThresholdsScanned) {
      response.status(409).json({
        error: "calibration_incomplete",
      });
      return;
    }
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


app.post("/sessions/:code/restart", async (request, response) => {
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

  const mode = request.body?.mode;

  if (mode !== "reuse" && mode !== "rescan") {
    response.status(400).json({
      error: "invalid_restart_mode",
    });
    return;
  }

  if (session.phase === "lobby") {
    response.status(409).json({
      error: "expedition_already_in_lobby",
    });
    return;
  }

  if (mode === "rescan") {
    // Collect file keys before deleting the database records.
    const groups = listScanGroups(session.code);

    const storageKeys = groups.flatMap((group) =>
      listScanImages(group.id).map((image) => image.storageKey),
    );

    try {
      // Delete the physical photographs first.
      // removeImage() tolerates files that are already missing.
      for (const storageKey of storageKeys) {
        await removeImage(storageKey);
      }
    } catch (error) {
      console.error("Failed to clean up calibration photographs", error);

      response.status(500).json({
        error: "scan_cleanup_failed",
      });
      return;
    }

    // Cascades deletion to scan_images records.
    deleteSessionScanGroups(session.code);
  } else {
    // Keep existing photographs for the next expedition.
    resetSessionScanGroupsForReuse(session.code);
  }

  // Preserve players, registered TVs, and the expedition code.
  session.phase = "lobby";
  updateSessionStatus(session);
  saveSession(session.code, session);

  response.status(200).json({
    session,
    restarted: true,
    mode,
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


app.post(
  "/sessions/:code/scan-groups/:groupId/finalize",
  (request, response) => {
    const session = getSession(request.params.code);

    if (!session) {
      response.status(404).json({
        error: "session_not_found",
      });
      return;
    }

    const { playerId, playerToken } = request.body ?? {};

    if (
      !authenticateExpeditionPlayer(
        session,
        playerId,
        playerToken
      )
    ) {
      response.status(401).json({
        error: "invalid_player_credentials",
      });
      return;
    }

    const group = getScanGroup(request.params.groupId);

    if (!group || group.sessionCode !== session.code) {
      response.status(404).json({
        error: "scan_group_not_found",
      });
      return;
    }

    if (group.claimedBy !== playerId) {
      response.status(403).json({
        error: "scan_claimed_by_another_player",
      });
      return;
    }

    if (group.status === "uploaded") {
      response.json({ group });
      return;
    }

    if (group.status !== "pending") {
      response.status(409).json({
        error: "scan_group_not_finalizable",
      });
      return;
    }

    const finalized = finalizeScanGroup(group.id, playerId);

    if (!finalized || finalized.status !== "uploaded") {
      response.status(409).json({
        error: "scan_group_empty_or_not_finalizable",
      });
      return;
    }

    response.json({ group: finalized });
  }
);


app.post(
  "/sessions/:code/scan-groups/:groupId/claim",
  (request, response) => {
    const session = getSession(request.params.code);

    if (!session) {
      response.status(404).json({
        error: "session_not_found",
      });
      return;
    }

    const { playerId, playerToken } = request.body ?? {};

    if (
      !authenticateExpeditionPlayer(
        session,
        playerId,
        playerToken,
      )
    ) {
      response.status(401).json({
        error: "invalid_player_credentials",
      });
      return;
    }

    const group = getScanGroup(request.params.groupId);

    if (!group || group.sessionCode !== session.code) {
      response.status(404).json({
        error: "scan_group_not_found",
      });
      return;
    }

    if (group.status !== "pending") {
      response.status(409).json({
        error: "scan_group_not_claimable",
      });
      return;
    }

    const claimed = claimScanGroup(group.id, playerId);

    if (!claimed) {
      response.status(409).json({
        error: "scan_group_already_claimed",
      });
      return;
    }

    response.status(200).json({
      group: claimed,
    });
  },
);


//
// Expedition scan groups
//

// Create a scan group for a Fire TV zone or an additional area.
app.post("/sessions/:code/scan-groups", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({
      error: "session_not_found",
    });
    return;
  }

  const { playerId, playerToken, thresholdId, label } =
    request.body ?? {};

  if (
    !authenticateExpeditionPlayer(
      session,
      playerId,
      playerToken
    )
  ) {
    response.status(401).json({
      error: "invalid_player_credentials",
    });
    return;
  }

  if (
    typeof label !== "string" ||
    label.trim().length === 0 ||
    label.trim().length > 100
  ) {
    response.status(400).json({
      error: "invalid_scan_group_label",
    });
    return;
  }

  if (
    typeof thresholdId !== "string" ||
    !session.thresholds.some(
      (threshold) => threshold.id === thresholdId
    )
  ) {
    response.status(400).json({
      error: "invalid_threshold_id",
    });
    return;
  }

  const group = createScanGroup({
    id: randomUUID(),
    sessionCode: session.code,
    thresholdId: thresholdId ?? null,
    label: label.trim(),
    createdBy: playerId,
    claimedBy: playerId,
    claimExpiresAt: new Date(
      Date.now() + 10 * 60 * 1000,
    ).toISOString(),
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  response.status(201).json({ group });
});

// List scan groups belonging to this expedition.
app.get("/sessions/:code/scan-groups", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({
      error: "session_not_found",
    });
    return;
  }

  const playerId = request.get("X-Player-Id");
  const token = request.get("Authorization")?.replace(
    /^Bearer\s+/i,
    ""
  );

  if (!authenticateExpeditionPlayer(session, playerId, token)) {
    response.status(401).json({
      error: "invalid_player_credentials",
    });
    return;
  }

  response.json({
    groups: listScanGroups(session.code),
  });
});

// Retrieve a specific scan group within this expedition.
app.get(
  "/sessions/:code/scan-groups/:groupId",
  (request, response) => {
    const session = getSession(request.params.code);

    if (!session) {
      response.status(404).json({
        error: "session_not_found",
      });
      return;
    }

    const playerId = request.get("X-Player-Id");
    const token = request.get("Authorization")?.replace(
      /^Bearer\s+/i,
      ""
    );

    if (
      !authenticateExpeditionPlayer(
        session,
        playerId,
        token
      )
    ) {
      response.status(401).json({
        error: "invalid_player_credentials",
      });
      return;
    }

    const group = getScanGroup(request.params.groupId);

    if (!group || group.sessionCode !== session.code) {
      response.status(404).json({
        error: "scan_group_not_found",
      });
      return;
    }

    response.json({ group });
  }
);


//
// Upload a calibration photograph.
//

app.post(
  "/sessions/:code/scan-groups/:groupId/images",
  (request, response, next) => {
    const session = getSession(request.params.code);

    if (!session) {
      response.status(404).json({
        error: "session_not_found",
      });
      return;
    }

    const playerId = request.get("X-Player-Id");
    const token = request.get("Authorization")?.replace(
      /^Bearer\s+/i,
      "",
    );

    if (!authenticateExpeditionPlayer(session, playerId, token)) {
      response.status(401).json({
        error: "invalid_player_credentials",
      });
      return;
    }

    const group = getScanGroup(request.params.groupId);

    if (!group || group.sessionCode !== session.code) {
      response.status(404).json({
        error: "scan_group_not_found",
      });
      return;
    }

    if (
      group.claimedBy !== playerId ||
      (group.claimExpiresAt !== null &&
        group.claimExpiresAt <= new Date().toISOString())
    ) {
      response.status(403).json({
        error: "scan_claimed_by_another_player",
      });
      return;
    }

    if (group.status !== "pending") {
      response.status(409).json({
        error: "scan_group_not_pending",
      });
      return;
    }

    if (countScanImages(group.id) >= MAX_SCAN_IMAGES) {
      response.status(409).json({
        error: "scan_image_limit_reached",
        limit: MAX_SCAN_IMAGES,
      });
      return;
    }

    scanImageUpload(request, response, (error: unknown) => {
      if (error) {
        if (
          error instanceof multer.MulterError &&
          error.code === "LIMIT_FILE_SIZE"
        ) {
          response.status(413).json({
            error: "image_too_large",
          });
          return;
        }

        response.status(400).json({
          error: "invalid_image_upload",
        });
        return;
      }

      next();
    });
  },
  async (request, response) => {
    const session = getSession(request.params.code);
    const group = getScanGroup(request.params.groupId);

    if (
      !session ||
      !group ||
      group.sessionCode !== session.code
    ) {
      response.status(404).json({
        error: "scan_group_not_found",
      });
      return;
    }

    const file = request.file;

    if (!file || file.buffer.length === 0) {
      response.status(400).json({
        error: "image_required",
      });
      return;
    }

    const mimeType = detectImageType(file.buffer);

    if (!mimeType || file.mimetype !== mimeType) {
      response.status(415).json({
        error: "unsupported_image_format",
      });
      return;
    }

    if (countScanImages(group.id) >= MAX_SCAN_IMAGES) {
      response.status(409).json({
        error: "scan_image_limit_reached",
        limit: MAX_SCAN_IMAGES,
      });
      return;
    }

    const playerId = request.get("X-Player-Id");

    if (!playerId) {
      response.status(401).json({
        error: "missing_player_id",
      });
      return;
    }

    let storageKey: string | null = null;

    try {
      storageKey = await saveImage(
        file.buffer,
        session.code,
        group.id,
        mimeType,
      );

      const image = createScanImage(
        {
          id: randomUUID(),
          scanGroupId: group.id,
          storageKey,
          mimeType,
          sizeBytes: file.buffer.length,
          createdAt: new Date().toISOString(),
        },
        playerId,
      );

      response.status(201).json({
        image: {
          id: image.id,
          scanGroupId: image.scanGroupId,
          mimeType: image.mimeType,
          sizeBytes: image.sizeBytes,
          createdAt: image.createdAt,
        },
        count: countScanImages(group.id),
        limit: MAX_SCAN_IMAGES,
      });
    } catch (error) {
      if (storageKey) {
        await removeImage(storageKey).catch(() => {});
      }

      if (
        error instanceof Error &&
        error.message === "scan_claim_not_owned"
      ) {
        response.status(403).json({
          error: "scan_claim_not_owned",
        });
        return;
      }

      if (
        error instanceof Error &&
        error.message === "scan_image_limit_reached"
      ) {
        response.status(409).json({
          error: "scan_image_limit_reached",
          limit: MAX_SCAN_IMAGES,
        });
        return;
      }

      if (
        error instanceof Error &&
        error.message === "scan_group_not_pending"
      ) {
        response.status(409).json({
          error: "scan_group_not_pending",
        });
        return;
      }

      if (
        error instanceof Error &&
        error.message === "scan_group_not_found"
      ) {
        response.status(404).json({
          error: "scan_group_not_found",
        });
        return;
      }

      console.error("Scan image upload failed:", error);

      response.status(500).json({
        error: "image_upload_failed",
      });
    }
  },
);