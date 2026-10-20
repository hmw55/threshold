
import { completeInteraction } from "./game/interactionService.js";
import { lastWitnessInteractions } from "./game/lastWitnessInteractions.js";
import { contradictionPuzzle } from "./game/contradictionPuzzle.js";
import {
  submitContradictionAnswer,
  submitMissingWitnessAnswer,
} from "./game/gameplayService.js";
import { missingWitnessPuzzle } from "./game/missingWitnessPuzzle.js";
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
  createEnvironment,
  listEnvironmentObjects,
  createEnvironmentObject,
  confirmEnvironmentObject,
  reviewEnvironmentObject,
  listEnvironmentObjectsForSession,
  createEnvironmentObservation,
  countScanImages,
  loadGameState,
  listScanImages,
  finalizeScanGroup,
  saveGameState,
  claimScanGroup,
  deleteSessionScanGroups,
  deleteGameState,
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
import { lastWitnessBlueprint } from "./game/lastWitnessBlueprint.js";
import { createInitialGameState, type GameMission } from "./game/gameState.js";
import { advanceGame } from "./game/gameEngine.js";
import { completeMission } from "./game/missionEngine.js";
import { resolveAnchorPuzzle } from "./game/resolveAnchorPuzzle.js";
import { investigateAnchor } from "./game/anchorInvestigation.js";
import { ArchitectDecisionService } from "./architect/architectDecisionService.js";
import { createAiProvider } from "./architect/createAiProvider.js";
import { analyzeCalibration } from "./architect/analyzeCalibration.js";
import {
  recoverTransmission,
  transmissionFragments,
} from "./game/transmissionRecovery.js";
import {
  reconstructSignal,
  signalFragments,
} from "./game/signalReconstruction.js";

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
  environmentId: string | null;
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

const evidenceImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
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

  const environmentId = randomUUID();

  createEnvironment({
    id: environmentId,
    name: `Expedition ${code}`,
    source: "scanned",
    createdAt: new Date().toISOString(),
  });

  const session: Session = {
    code,
    players: [],
    thresholds: [],
    status: "awaiting_players",
    phase: "lobby",
    environmentId,
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
            group.status === "completed",
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

  if (nextPhase === "playing") {
    const initialGame = createInitialGameState(
      session.code,
      "last-witness-v1",
    );

    const startedGame = advanceGame(initialGame, {
      type: "start",
    });

    const playerStates = session.players.map((player) => ({
      playerId: player.id,
      score: 0,
      completedMissionIds: [],
    }));

    const openingMissions: GameMission[] = session.players.map((player) => ({
      id: "investigate-signal-" + player.id,
      type: "investigate" as const,
      title: "Find the Signal",
      description:
        "Investigate your physical surroundings. The Architect has detected " +
        "an unexplained transmission connected to this environment.",
      assignedPlayerIds: [player.id],
      targetPlayerId: null,
      objectRef: null,
      points: 100,
      status: "available" as const,
      private: false,
    }));

    for (const player of session.players) {
      openingMissions.push({
        id: "physical-arrangement-" + player.id,
        type: "investigate",
        title: "Reconstruct the Signal",
        description:
          "Arrange three distinct, safe, movable household objects " +
          "in a clearly visible line from smallest to largest. " +
          "Use your Lens to photograph the completed arrangement. " +
          "The Architect must verify the physical evidence.",
        assignedPlayerIds: [player.id],
        targetPlayerId: null,
        objectRef: null,
        points: 150,
        status: "available",
        private: false,
      });
    }

    if (session.players.length > 1) {
      const firstPlayer = session.players[0]!;

      openingMissions.push({
        id: "conceal-discovery-" + firstPlayer.id,
        type: "conceal",
        title: "Keep a Secret",
        description:
          "The Architect has contacted you privately. Keep your next " +
          "discovery hidden from the others until the Architect reveals it.",
        assignedPlayerIds: [firstPlayer.id],
        targetPlayerId: null,
        objectRef: null,
        points: 75,
        status: "available",
        private: true,
      });
    }

    saveGameState({
      ...startedGame,
      players: playerStates,
      missions: openingMissions,
      tvEvents: [
        {
          id: "expedition-opening",
          type: "transmission",
          message:
            "The Architect has established contact. " +
            "Your environment is now part of the investigation. " +
            "Individual assignments have been transmitted to the Lenses.",
          createdAt: Date.now(),
        },
      ],
    });
  }

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
  // A restarted expedition must begin with a fresh mystery.
  deleteGameState(session.code);
  saveSession(session.code, session);

  response.status(200).json({
    session,
    restarted: true,
    mode,
  });
});

app.post(
  "/sessions/:code/environment/objects/:objectId/confirm",
  (request, response) => {
    const session = getSession(request.params.code);

    if (!session) {
      response.status(404).json({ error: "session_not_found" });
      return;
    }

    const { playerId, playerToken } = request.body ?? {};

    if (!authenticateExpeditionPlayer(session, playerId, playerToken)) {
      response.status(401).json({ error: "invalid_player_credentials" });
      return;
    }

    if (session.phase !== "calibrating") {
      response.status(409).json({ error: "calibration_not_active" });
      return;
    }

    if (!session.environmentId) {
      response.status(409).json({ error: "environment_not_initialized" });
      return;
    }

    const object = confirmEnvironmentObject(
      request.params.objectId,
      session.environmentId,
      session.code,
      null,
    );

    if (!object) {
      response.status(404).json({ error: "environment_object_not_found" });
      return;
    }

    response.json({ object });
  },
);

app.post("/sessions/:code/environment/objects/:objectId/review", (request, response) => {
  const session = getSession(request.params.code);
  if (!session) { response.status(404).json({ error: "session_not_found" }); return; }
  const { playerId, playerToken, action, name } = request.body ?? {};
  if (!authenticateExpeditionPlayer(session, playerId, playerToken)) {
    response.status(401).json({ error: "invalid_player_credentials" }); return;
  }
  if (session.phase !== "calibrating") {
    response.status(409).json({ error: "calibration_not_active" }); return;
  }
  if (!session.environmentId) {
    response.status(409).json({ error: "environment_not_initialized" }); return;
  }
  if (action !== "correct" && action !== "reject") {
    response.status(400).json({ error: "invalid_review_action" }); return;
  }
  const correctedName = typeof name === "string" ? name.trim() : "";
  if (action === "correct" && (correctedName.length < 2 || correctedName.length > 100)) {
    response.status(400).json({ error: "invalid_object_name" }); return;
  }
  try {
    const object = reviewEnvironmentObject(request.params.objectId,
      session.environmentId, session.code, playerId, action,
      action === "correct" ? correctedName : null);
    if (!object) { response.status(404).json({ error: "environment_object_not_found" }); return; }
    response.json({ object });
  } catch (error) {
    if (error instanceof Error && error.message === "object_already_rejected") {
      response.status(409).json({ error: "object_already_rejected" }); return;
    }
    console.error("Object review failed:", error);
    response.status(500).json({ error: "object_review_failed" });
  }
});

app.get("/sessions/:code/environment/objects", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }

  const playerId = request.header("x-player-id");
  const playerToken =
    request.header("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.header("x-player-token");

  if (!authenticateExpeditionPlayer(session, playerId, playerToken)) {
    response.status(401).json({ error: "invalid_player_credentials" });
    return;
  }

  if (!session.environmentId) {
    response.status(409).json({ error: "environment_not_initialized" });
    return;
  }

  response.json({
    objects: listEnvironmentObjectsForSession(session.environmentId, session.code),
  });
});

app.post("/sessions/:code/environment/objects", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }

  const { playerId, playerToken, name, scanGroupId } = request.body ?? {};

  if (!authenticateExpeditionPlayer(session, playerId, playerToken)) {
    response.status(401).json({ error: "invalid_player_credentials" });
    return;
  }

  if (session.phase !== "calibrating") {
    response.status(409).json({ error: "calibration_not_active" });
    return;
  }

  if (
    typeof name !== "string" ||
    name.trim().length < 2 ||
    name.trim().length > 100
  ) {
    response.status(400).json({ error: "invalid_object_name" });
    return;
  }

  if (!session.environmentId) {
    response.status(409).json({ error: "environment_not_initialized" });
    return;
  }

  const group = typeof scanGroupId === "string"
    ? getScanGroup(scanGroupId)
    : null;

  if (!group || group.sessionCode !== session.code) {
    response.status(404).json({ error: "scan_group_not_found" });
    return;
  }

  const now = new Date().toISOString();
  const objectId = randomUUID();

  const object = createEnvironmentObject({
    id: objectId,
    environmentId: session.environmentId,
    parentObjectId: null,
    name: name.trim(),
    category: "physical_object",
    description: null,
    location: group.label,
    recognitionStatus: "confirmed",
    requiresCloserScan: false,
    createdAt: now,
  });

  createEnvironmentObservation({
    id: randomUUID(),
    environmentId: session.environmentId,
    objectId,
    sessionCode: session.code,
    scanGroupId: group.id,
    observedName: object.name,
    observedCategory: object.category,
    observedDescription: null,
    observedLocation: object.location,
    recognitionStatus: "confirmed",
    observedAt: now,
  });

  response.status(201).json({
    object: {
      id: object.id,
      name: object.name,
      category: object.category,
      location: object.location,
    },
  });
});

app.get("/sessions/:code/game/anchor", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }

  const playerId = request.header("x-player-id");
  const playerToken =
    request.header("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.header("x-player-token");

  if (!authenticateExpeditionPlayer(session, playerId, playerToken)) {
    response.status(401).json({ error: "invalid_player_credentials" });
    return;
  }

  if (session.phase !== "playing") {
    response.status(409).json({ error: "game_not_active" });
    return;
  }

  const state = loadGameState(session.code);

  if (!state || state.phase !== "investigation") {
    response.status(409).json({ error: "investigation_not_active" });
    return;
  }

  if (!session.environmentId) {
    response.status(409).json({ error: "environment_not_initialized" });
    return;
  }

  const resolved = resolveAnchorPuzzle(
    session.environmentId,
    session.code,
  );

  if (!resolved) {
    response.status(409).json({ error: "no_confirmed_objects" });
    return;
  }

  response.json({
    puzzle: {
      id: resolved.puzzle.puzzleId,
      clue: resolved.puzzle.clue,
      completed: state.completedInteractions.includes("inspect-anchor"),
    },
    objects: resolved.objects,
  });
});

app.post("/sessions/:code/game/anchor/answer", async (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }

  const { playerId, playerToken, objectRef, observation } = request.body ?? {};

  if (!authenticateExpeditionPlayer(session, playerId, playerToken)) {
    response.status(401).json({ error: "invalid_player_credentials" });
    return;
  }

  if (session.phase !== "playing") {
    response.status(409).json({ error: "game_not_active" });
    return;
  }

  const state = loadGameState(session.code);

  if (!state || state.phase !== "investigation") {
    response.status(409).json({ error: "investigation_not_active" });
    return;
  }

  if (state.completedInteractions.includes("inspect-anchor")) {
    response.status(409).json({ error: "anchor_already_completed" });
    return;
  }

  if (typeof objectRef !== "string" || !objectRef) {
    response.status(400).json({ error: "invalid_object_ref" });
    return;
  }

  if (!session.environmentId) {
    response.status(409).json({ error: "environment_not_initialized" });
    return;
  }

  const resolved = resolveAnchorPuzzle(
    session.environmentId,
    session.code,
  );

  if (!resolved) {
    response.status(409).json({ error: "no_confirmed_objects" });
    return;
  }

  if (!resolved.objects.some((object) => object.ref === objectRef)) {
    response.status(400).json({ error: "unknown_object_ref" });
    return;
  }

  if (
    typeof observation !== "string" ||
    observation.trim().length < 15 ||
    observation.length > 2000
  ) {
    response.status(400).json({ error: "invalid_observation" });
    return;
  }

  // Evaluate the player's observation before attempting anchor resolution.
  // The Architect proposes an interpretation; it cannot mutate game state.
  let architectDecision;

  try {
    const architect = new ArchitectDecisionService(
      createAiProvider({
        provider: "ollama",
        ollamaModel: process.env.OLLAMA_MODEL ?? "gemma3:4b",
        ollamaTimeoutMs: 45_000,
      }),
    );

    const selectedObject = resolved.objects.find(
      (object) => object.ref === objectRef,
    );

    architectDecision = await architect.evaluate({
      sessionCode: session.code,
      environmentId: session.environmentId,
      action: {
        type: "text",
        text:
          "I am examining the confirmed object " +
          (selectedObject?.name ?? objectRef) +
          " (reference: " + objectRef + "). " +
          "My field observation: " + observation.trim() +
          ". Evaluate whether this is meaningful physical evidence. " +
          "Do not assume I discovered anything I did not describe.",
      },
    });
  } catch (error) {
    console.error("Architect investigation failed:", error);
    response.status(503).json({ error: "architect_unavailable" });
    return;
  }

  if (
    architectDecision.outcome !== "accepted"
  ) {
    const investigation = {
      playerId,
      objectRef,
      observation: observation.trim(),
      createdAt: Date.now(),
      correct: false,
    };

    state.investigations = [
      ...(state.investigations ?? []),
      investigation,
    ];

    saveGameState(state);

    response.json({
      correct: false,
      narration:
        architectDecision.narration +
        (architectDecision.evidenceRequest
          ? " " + architectDecision.evidenceRequest.instruction
          : ""),
      investigation,
      game: {
        phase: state.phase,
        completedInteractions: state.completedInteractions,
      },
    });
    return;
  }

  const result = investigateAnchor(
    state,
    resolved.puzzle,
    objectRef,
    architectDecision.outcome === "accepted",
  );

  const investigation = {
    playerId,
    objectRef,
    observation: observation.trim(),
    createdAt: Date.now(),
    correct: result.correct,
  };

  result.state.investigations = [
    ...(result.state.investigations ?? []),
    investigation,
  ];

  if (result.correct) {
    const missionId = "investigate-signal-" + playerId;
    const mission = result.state.missions?.find(
      (entry) => entry.id === missionId,
    );

    const nextState = mission
      ? completeMission(result.state, missionId, playerId)
      : result.state;

    saveGameState(nextState);

    response.json({
      correct: true,
      narration: architectDecision.narration + " " + result.narration,
      investigation,
      pointsAwarded: mission ? mission.points : 0,
      score: nextState.players?.find(
        (player) => player.playerId === playerId,
      )?.score ?? 0,
      game: {
        phase: nextState.phase,
        completedInteractions: nextState.completedInteractions,
      },
    });
    return;
  }

  saveGameState(result.state);

  response.json({
    correct: result.correct,
    narration: architectDecision.narration + " " + result.narration,
    investigation,
    game: {
      phase: result.state.phase,
      completedInteractions: result.state.completedInteractions,
    },
  });
});

/**
 * Retrieve intercepted transmission fragments.
 *
 * Available only after the anchor has been identified.
 * Never exposes the correct fragment ID.
 */
app.get("/sessions/:code/game/transmission", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }

  const playerId = request.header("x-player-id");
  const playerToken =
    request.header("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.header("x-player-token");

  if (!authenticateExpeditionPlayer(session, playerId, playerToken)) {
    response.status(401).json({ error: "invalid_player_credentials" });
    return;
  }

  if (session.phase !== "playing") {
    response.status(409).json({ error: "game_not_active" });
    return;
  }

  const state = loadGameState(session.code);

  if (!state || state.phase !== "investigation") {
    response.status(409).json({ error: "investigation_not_active" });
    return;
  }

  if (!state.completedInteractions.includes("inspect-anchor")) {
    response.status(409).json({ error: "anchor_not_completed" });
    return;
  }

  response.json({
    fragments: transmissionFragments,
    completed: state.completedInteractions.includes(
      "recover-transmission",
    ),
  });
});

/**
 * Submit a transmission fragment for recovery.
 */
app.post("/sessions/:code/game/transmission/answer", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }

  const { playerId, playerToken, fragmentId } = request.body ?? {};

  if (!authenticateExpeditionPlayer(session, playerId, playerToken)) {
    response.status(401).json({ error: "invalid_player_credentials" });
    return;
  }

  if (session.phase !== "playing") {
    response.status(409).json({ error: "game_not_active" });
    return;
  }

  const state = loadGameState(session.code);

  if (!state || state.phase !== "investigation") {
    response.status(409).json({ error: "investigation_not_active" });
    return;
  }

  if (!state.completedInteractions.includes("inspect-anchor")) {
    response.status(409).json({ error: "anchor_not_completed" });
    return;
  }

  if (state.completedInteractions.includes("recover-transmission")) {
    response.status(409).json({ error: "transmission_already_completed" });
    return;
  }

  if (
    typeof fragmentId !== "string" ||
    !transmissionFragments.some((fragment) => fragment.id === fragmentId)
  ) {
    response.status(400).json({ error: "invalid_fragment_id" });
    return;
  }

  const result = recoverTransmission(state, fragmentId);

  if (result.correct) {
    saveGameState(result.state);
  }

  response.json({
    correct: result.correct,
    narration: result.narration,
    game: {
      phase: result.state.phase,
      completedInteractions: result.state.completedInteractions,
    },
  });
});

/**
 * Retrieve signal fragments after transmission recovery.
 */
app.get("/sessions/:code/game/reconstruction", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }

  const playerId = request.header("x-player-id");
  const playerToken =
    request.header("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.header("x-player-token");

  if (!authenticateExpeditionPlayer(session, playerId, playerToken)) {
    response.status(401).json({ error: "invalid_player_credentials" });
    return;
  }

  if (session.phase !== "playing") {
    response.status(409).json({ error: "game_not_active" });
    return;
  }

  const state = loadGameState(session.code);

  if (!state || state.phase !== "investigation") {
    response.status(409).json({ error: "investigation_not_active" });
    return;
  }

  if (!state.completedInteractions.includes("recover-transmission")) {
    response.status(409).json({ error: "transmission_not_recovered" });
    return;
  }

  response.json({
    fragments: signalFragments,
    completed: state.completedInteractions.includes(
      "reconstruct-signal",
    ),
  });
});

/**
 * Submit an ordered sequence of signal fragments.
 */
app.post("/sessions/:code/game/reconstruction/answer", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }

  const { playerId, playerToken, order } = request.body ?? {};

  if (!authenticateExpeditionPlayer(session, playerId, playerToken)) {
    response.status(401).json({ error: "invalid_player_credentials" });
    return;
  }

  if (session.phase !== "playing") {
    response.status(409).json({ error: "game_not_active" });
    return;
  }

  const state = loadGameState(session.code);

  if (!state || state.phase !== "investigation") {
    response.status(409).json({ error: "investigation_not_active" });
    return;
  }

  if (!state.completedInteractions.includes("recover-transmission")) {
    response.status(409).json({ error: "transmission_not_recovered" });
    return;
  }

  if (state.completedInteractions.includes("reconstruct-signal")) {
    response.status(409).json({ error: "reconstruction_already_completed" });
    return;
  }

  const validIds = new Set(signalFragments.map((fragment) => fragment.id));

  if (
    !Array.isArray(order) ||
    order.length !== signalFragments.length ||
    order.some(
      (id: unknown) => typeof id !== "string" || !validIds.has(id),
    ) ||
    new Set(order).size !== signalFragments.length
  ) {
    response.status(400).json({ error: "invalid_fragment_sequence" });
    return;
  }

  const result = reconstructSignal(state, order);

  const nextState = result.correct
    ? advanceGame(result.state, {
        type: "complete_objective",
        objectiveId: "first-signal",
      })
    : result.state;

  if (result.correct) {
    saveGameState(nextState);
  }

  response.json({
    correct: result.correct,
    narration: result.narration,
    game: {
      phase: nextState.phase,
      completedObjectives: nextState.completedObjectives,
      completedInteractions: nextState.completedInteractions,
    },
  });
});

/**
 * Return the current Last Witness game state.
 *
 * Read-only. Does not initialize or advance gameplay.
 * Requires an authenticated Lens player.
 */

const actTwoInteractions = lastWitnessInteractions.filter(
  (interaction) => interaction.phase === "contradiction",
);

app.get("/sessions/:code/game/contradiction", (request, response) => {
  const session = getSession(request.params.code);
  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }

  const playerId = request.header("x-player-id");
  const token = request.header("authorization")?.replace(/^Bearer /i, "");

  if (!authenticateExpeditionPlayer(session, playerId, token)) {
    response.status(401).json({ error: "invalid_player_credentials" });
    return;
  }

  const state = loadGameState(session.code);
  if (session.phase !== "playing" || !state || state.phase !== "contradiction") {
    response.status(409).json({ error: "contradiction_not_active" });
    return;
  }

  const completed = state.completedInteractions;

  response.json({
    steps: actTwoInteractions.map((interaction) => ({
      ...interaction,
      completed: completed.includes(interaction.id),
      available: interaction.requires.every((id) => completed.includes(id)),
    })),
    statements: completed.includes("collect-testimonies")
      ? contradictionPuzzle.statements
      : [],
    puzzle: completed.includes("reconstruct-timeline")
      ? {
          prompt: contradictionPuzzle.prompt,
          statements: contradictionPuzzle.statements,
        }
      : null,
  });
});

app.post("/sessions/:code/game/contradiction/step", (request, response) => {
  const session = getSession(request.params.code);
  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }

  const { playerId, playerToken, interactionId } = request.body ?? {};

  if (!authenticateExpeditionPlayer(session, playerId, playerToken)) {
    response.status(401).json({ error: "invalid_player_credentials" });
    return;
  }

  const state = loadGameState(session.code);
  if (session.phase !== "playing" || !state || state.phase !== "contradiction") {
    response.status(409).json({ error: "contradiction_not_active" });
    return;
  }

  const interaction = actTwoInteractions.find((item) => item.id === interactionId);
  if (!interaction) {
    response.status(400).json({ error: "invalid_interaction" });
    return;
  }

  if (state.completedInteractions.includes(interactionId)) {
    response.status(409).json({ error: "interaction_already_completed" });
    return;
  }

  if (!interaction.requires.every((id) => state.completedInteractions.includes(id))) {
    response.status(409).json({ error: "interaction_prerequisite_missing" });
    return;
  }

  const nextState = completeInteraction(state, interactionId);
  saveGameState(nextState);

  response.json({
    completedInteractions: nextState.completedInteractions,
  });
});

app.post("/sessions/:code/game/contradiction/answer", (request, response) => {
  const session = getSession(request.params.code);
  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }

  const { playerId, playerToken, statementId } = request.body ?? {};

  if (!authenticateExpeditionPlayer(session, playerId, playerToken)) {
    response.status(401).json({ error: "invalid_player_credentials" });
    return;
  }

  const state = loadGameState(session.code);
  if (
    session.phase !== "playing" ||
    !state ||
    state.phase !== "contradiction" ||
    !state.completedInteractions.includes("reconstruct-timeline")
  ) {
    response.status(409).json({ error: "contradiction_not_ready" });
    return;
  }

  if (
    typeof statementId !== "string" ||
    !contradictionPuzzle.statements.some((item) => item.id === statementId)
  ) {
    response.status(400).json({ error: "invalid_statement" });
    return;
  }

  const result = submitContradictionAnswer(state, statementId);
  if (result.correct) saveGameState(result.state);

  response.json({
    correct: result.correct,
    narration: result.narration,
    game: {
      phase: result.state.phase,
      completedObjectives: result.state.completedObjectives,
      completedInteractions: result.state.completedInteractions,
    },
  });
});


const actThreeInteractions = lastWitnessInteractions.filter(
  (interaction) => interaction.phase === "revelation",
);

app.get("/sessions/:code/game/revelation", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }

  const playerId = request.header("x-player-id");
  const token = request.header("authorization")?.replace(/^Bearer /i, "");

  if (!authenticateExpeditionPlayer(session, playerId, token)) {
    response.status(401).json({ error: "invalid_player_credentials" });
    return;
  }

  const state = loadGameState(session.code);

  if (session.phase !== "playing" || !state || state.phase !== "revelation") {
    response.status(409).json({ error: "revelation_not_active" });
    return;
  }

  const completed = state.completedInteractions;

  response.json({
    steps: actThreeInteractions.map((interaction) => ({
      ...interaction,
      completed: completed.includes(interaction.id),
      available: interaction.requires.every((id) => completed.includes(id)),
    })),
    archive: completed.includes("inspect-archive")
      ? missingWitnessPuzzle.evidence
      : null,
    puzzle: completed.includes("decode-testimony")
      ? {
          prompt: missingWitnessPuzzle.prompt,
          choices: missingWitnessPuzzle.choices,
        }
      : null,
  });
});

app.post("/sessions/:code/game/revelation/step", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }

  const { playerId, playerToken, interactionId } = request.body ?? {};

  if (!authenticateExpeditionPlayer(session, playerId, playerToken)) {
    response.status(401).json({ error: "invalid_player_credentials" });
    return;
  }

  const state = loadGameState(session.code);

  if (session.phase !== "playing" || !state || state.phase !== "revelation") {
    response.status(409).json({ error: "revelation_not_active" });
    return;
  }

  const interaction = actThreeInteractions.find(
    (item) => item.id === interactionId,
  );

  if (!interaction) {
    response.status(400).json({ error: "invalid_interaction" });
    return;
  }

  if (state.completedInteractions.includes(interactionId)) {
    response.status(409).json({ error: "interaction_already_completed" });
    return;
  }

  if (!interaction.requires.every(
    (id) => state.completedInteractions.includes(id),
  )) {
    response.status(409).json({ error: "interaction_prerequisite_missing" });
    return;
  }

  const nextState = completeInteraction(state, interactionId);
  saveGameState(nextState);

  response.json({
    completedInteractions: nextState.completedInteractions,
  });
});

app.post("/sessions/:code/game/revelation/answer", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }

  const { playerId, playerToken, choiceId } = request.body ?? {};

  if (!authenticateExpeditionPlayer(session, playerId, playerToken)) {
    response.status(401).json({ error: "invalid_player_credentials" });
    return;
  }

  const state = loadGameState(session.code);

  if (
    session.phase !== "playing" ||
    !state ||
    state.phase !== "revelation" ||
    !state.completedInteractions.includes("decode-testimony")
  ) {
    response.status(409).json({ error: "revelation_not_ready" });
    return;
  }

  if (
    typeof choiceId !== "string" ||
    !missingWitnessPuzzle.choices.some((choice) => choice.id === choiceId)
  ) {
    response.status(400).json({ error: "invalid_choice" });
    return;
  }

  const result = submitMissingWitnessAnswer(state, choiceId);

  if (result.correct) {
    saveGameState(result.state);
  }

  response.json({
    correct: result.correct,
    narration: result.narration,
    game: {
      phase: result.state.phase,
      completedObjectives: result.state.completedObjectives,
      completedInteractions: result.state.completedInteractions,
      discoveredEvidence: result.state.discoveredEvidence,
    },
  });
});

app.post("/sessions/:code/game/resolution/answer", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }

  const { playerId, playerToken, ending } = request.body ?? {};

  if (!authenticateExpeditionPlayer(session, playerId, playerToken)) {
    response.status(401).json({ error: "invalid_player_credentials" });
    return;
  }

  const state = loadGameState(session.code);

  if (
    session.phase !== "playing" ||
    !state ||
    state.phase !== "resolution"
  ) {
    response.status(409).json({ error: "resolution_not_ready" });
    return;
  }

  if (
    ending !== "preservation" &&
    ending !== "fracture" &&
    ending !== "reconciliation"
  ) {
    response.status(400).json({ error: "invalid_ending" });
    return;
  }

  if (
    ending === "reconciliation" &&
    !state.discoveredEvidence.includes("missing-testimony")
  ) {
    response.status(409).json({ error: "missing_testimony_required" });
    return;
  }

  const nextState = advanceGame(state, {
    type: "choose_ending",
    ending,
  });

  saveGameState(nextState);

  response.json({
    game: {
      phase: nextState.phase,
      ending: nextState.ending,
      completedObjectives: nextState.completedObjectives,
      completedInteractions: nextState.completedInteractions,
      discoveredEvidence: nextState.discoveredEvidence,
    },
  });
});

/**
 * Read-only adventure state for a registered Fire TV.
 * Does not expose player credentials or mutate gameplay.
 */
app.get("/sessions/:code/threshold/game", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }

  const deviceId = request.header("x-device-id");

  if (
    !deviceId ||
    !session.thresholds.some(
      (threshold) => threshold.deviceId === deviceId,
    )
  ) {
    response.status(401).json({
      error: "invalid_threshold_credentials",
    });
    return;
  }

  if (session.phase !== "playing" && session.phase !== "results") {
    response.status(409).json({ error: "game_not_available" });
    return;
  }

  const gameState = loadGameState(session.code);

  if (!gameState) {
    response.status(404).json({ error: "game_not_initialized" });
    return;
  }

  response.json({
    scores: [...(gameState.players ?? [])].sort(
      (a, b) => b.score - a.score,
    ),
    events: gameState.tvEvents ?? [],
    playerNames: Object.fromEntries(
      session.players.map((player) => [player.id, player.name]),
    ),
    game: {
      phase: gameState.phase,
      completedObjectives: gameState.completedObjectives,
      completedInteractions: gameState.completedInteractions,
      discoveredEvidence: gameState.discoveredEvidence,
      ending: gameState.ending,
    },
    adventure: {
      id: lastWitnessBlueprint.id,
      title: lastWitnessBlueprint.title,
      objectives: lastWitnessBlueprint.objectives,
    },
  });
});

app.get("/sessions/:code/game", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({
      error: "session_not_found",
    });
    return;
  }

  const playerId = request.header("x-player-id");
  const authorization = request.header("authorization");

  const playerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : undefined;

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

  if (
    session.phase !== "playing" &&
    session.phase !== "results"
  ) {
    response.status(409).json({
      error: "game_not_available",
    });
    return;
  }

  const gameState = loadGameState(session.code);

  if (!gameState) {
    response.status(404).json({
      error: "game_not_initialized",
    });
    return;
  }

  response.json({
    game: {
      phase: gameState.phase,
      completedObjectives: gameState.completedObjectives,
      completedInteractions: gameState.completedInteractions,
      discoveredEvidence: gameState.discoveredEvidence,
      ending: gameState.ending,
    },
    adventure: {
      id: lastWitnessBlueprint.id,
      title: lastWitnessBlueprint.title,
      objectives: lastWitnessBlueprint.objectives,
    },
  });
});


/**
 * Submit fresh photographic evidence for a physical mission.
 * The local vision model proposes acceptance; server-side mission
 * state controls scoring and prevents duplicate awards.
 */
app.post(
  "/sessions/:code/game/missions/:missionId/evidence",
  evidenceImageUpload,
  async (request, response) => {
    const sessionCode = request.params.code;
    if (typeof sessionCode !== "string") {
      response.status(400).json({ error: "invalid_session_code" });
      return;
    }
    const session = getSession(sessionCode);

    if (!session) {
      response.status(404).json({ error: "session_not_found" });
      return;
    }

    const playerId = request.header("x-player-id");
    const playerToken =
      request.header("authorization")?.replace(/^Bearer\s+/i, "") ??
      request.header("x-player-token");

    if (!authenticateExpeditionPlayer(session, playerId, playerToken)) {
      response.status(401).json({ error: "invalid_player_credentials" });
      return;
    }

    if (session.phase !== "playing") {
      response.status(409).json({ error: "game_not_active" });
      return;
    }

    const state = loadGameState(session.code);

    if (!state) {
      response.status(404).json({ error: "game_not_initialized" });
      return;
    }

    const missionId = request.params.missionId;
    const mission = state.missions?.find(
      (item) => item.id === missionId,
    );

    if (
      !mission ||
      mission.id !== "physical-arrangement-" + playerId ||
      !mission.assignedPlayerIds.includes(playerId!) ||
      mission.status === "completed" ||
      mission.status === "failed"
    ) {
      response.status(409).json({ error: "physical_mission_unavailable" });
      return;
    }

    if (!request.file) {
      response.status(400).json({ error: "image_required" });
      return;
    }

    const mimeType = detectImageType(request.file.buffer);

    if (!mimeType) {
      response.status(400).json({ error: "unsupported_image_format" });
      return;
    }

    const provider = createAiProvider({
      provider: "ollama",
      ollamaModel: "gemma3:4b",
      ollamaTimeoutMs: 120_000,
    });

    if (!provider.analyzeImage) {
      response.status(503).json({ error: "vision_provider_unavailable" });
      return;
    }

    let verdict: { accepted: boolean; feedback: string };

    try {
      const result = await provider.analyzeImage(
        request.file.buffer,
        [
          "Evaluate this photograph as evidence for a physical game objective.",
          "Objective: three distinct, safe household objects are arranged",
          "in a clearly visible line from smallest to largest.",
          "Judge only what is visibly supported by the photograph.",
          "Do not infer hidden objects, unseen actions, or the player's intent.",
          "If the arrangement is unclear, partially obscured, or cannot be",
          "reliably evaluated, reject it and explain what needs improvement.",
          "Return JSON only with this exact schema:",
          '{"accepted": boolean, "feedback": "brief actionable explanation"}',
        ].join(" "),
        {
          model: "gemma3:4b",
          systemPrompt:
            "You are a cautious visual evidence evaluator. " +
            "Never claim to see details that are not visible. " +
            "When uncertain, reject the evidence.",
        },
      );

      const parsed = JSON.parse(result.text);

      if (
        typeof parsed.accepted !== "boolean" ||
        typeof parsed.feedback !== "string"
      ) {
        throw new Error("Invalid vision verdict schema");
      }

      verdict = {
        accepted: parsed.accepted,
        feedback: parsed.feedback.slice(0, 500),
      };
    } catch (error) {
      console.error("Physical evidence verification failed:", error);
      response.status(503).json({
        error: "evidence_verification_unavailable",
      });
      return;
    }

    if (!verdict.accepted) {
      response.status(422).json({
        accepted: false,
        feedback: verdict.feedback,
      });
      return;
    }

    // Reload immediately before awarding points. Never trust a score or
    // completion claim supplied by the Lens client.
    const current = loadGameState(session.code);
    const currentMission = current?.missions?.find(
      (item) => item.id === missionId,
    );

    if (
      !current ||
      !currentMission ||
      currentMission.status === "completed" ||
      currentMission.status === "failed"
    ) {
      response.status(409).json({ error: "mission_already_resolved" });
      return;
    }

    try {
      const updated = completeMission(current, currentMission.id, playerId!);
      saveGameState({
        ...updated,
        discoveredEvidence: [
          ...new Set([
            ...updated.discoveredEvidence,
            "verified-physical-arrangement-" + playerId,
          ]),
        ],
        tvEvents: [
          ...(updated.tvEvents ?? []),
          {
            id: "physical-evidence-" + missionId,
            type: "reveal",
            message:
              "The Architect has verified a physical reconstruction. " +
              "An operative has earned " + mission.points + " points.",
            createdAt: Date.now(),
          },
        ],
      });

      const score = updated.players?.find(
        (player) => player.playerId === playerId,
      )?.score ?? 0;

      response.json({
        accepted: true,
        feedback: verdict.feedback,
        pointsAwarded: mission.points,
        score,
        missionId,
      });
    } catch (error) {
      console.error("Physical mission completion failed:", error);
      response.status(409).json({ error: "mission_completion_conflict" });
    }
  },
);

/**
 * Private missions for an authenticated Lens player.
 */
app.get("/sessions/:code/game/missions", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }

  const playerId = request.header("x-player-id");
  const token = request.header("authorization")?.replace(/^Bearer\\s+/i, "");

  if (!authenticateExpeditionPlayer(session, playerId, token)) {
    response.status(401).json({ error: "invalid_player_credentials" });
    return;
  }

  if (session.phase !== "playing" && session.phase !== "results") {
    response.status(409).json({ error: "game_not_available" });
    return;
  }

  const state = loadGameState(session.code);

  if (!state) {
    response.status(404).json({ error: "game_not_initialized" });
    return;
  }

  const missions = (state.missions ?? []).filter(
    (mission) =>
      !mission.private || mission.assignedPlayerIds.includes(playerId!),
  );

  const score = (state.players ?? []).find(
    (player) => player.playerId === playerId,
  )?.score ?? 0;

  response.json({ missions, score });
});

/**
 * Public scores and shared events for a registered Fire TV.
 */
app.get("/sessions/:code/threshold/missions", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }

  const deviceId = request.header("x-device-id");

  if (
    !deviceId ||
    !session.thresholds.some((threshold) => threshold.deviceId === deviceId)
  ) {
    response.status(401).json({ error: "invalid_threshold_device" });
    return;
  }

  if (session.phase !== "playing" && session.phase !== "results") {
    response.status(409).json({ error: "game_not_available" });
    return;
  }

  const state = loadGameState(session.code);

  if (!state) {
    response.status(404).json({ error: "game_not_initialized" });
    return;
  }

  const scores = [...(state.players ?? [])].sort(
    (a, b) => b.score - a.score,
  );

  response.json({
    scores,
    events: state.tvEvents ?? [],
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

    if (group.status === "completed" || group.status === "analyzing") {
      response.json({ group });
      return;
    }

    if (group.status === "failed") {
      if (session.environmentId) {
        void analyzeCalibration(
          session.code,
          session.environmentId,
          group.id,
        );
      }

      response.json({ group });
      return;
    }

    if (group.status === "uploaded") {
      if (session.environmentId) {
        void analyzeCalibration(
          session.code,
          session.environmentId,
          group.id,
        );
      }

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

  if (session.environmentId) {
    void analyzeCalibration(
      session.code,
      session.environmentId,
      finalized.id,
    );
  }
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