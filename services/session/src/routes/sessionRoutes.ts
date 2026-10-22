import type { Express } from "express";
import type { RouteContext, Session, ExpeditionPhase, Player } from "../app.js";
import type { GameMission } from "../game/gameState.js";
import { publicLastWitnessCase } from "../game/lastWitnessCase.js";
import type { FieldChoice, FieldAction } from "../game/fieldExpedition.js";

export function registerSessionRoutes(app: Express, ctx: RouteContext): void {
  const { startFieldExpedition, confirmedObjects, fieldView, submitFieldObservation, voteFieldEnding, setFieldTvChoice, answerFieldPuzzle, answerFieldAllegiance, exposeFieldAllegiance, completeInteraction, lastWitnessInteractions, contradictionPuzzle, submitContradictionAnswer, submitMissingWitnessAnswer, missingWitnessPuzzle, createHash, randomBytes, randomInt, randomUUID, timingSafeEqual, clearSessions, deleteSession, loadSessions, saveSession, savePlayerCredential, getPlayerCredentialHash, deletePlayerCredential, createScanGroup, getScanGroup, listScanGroups, createScanImage, createEnvironment, listEnvironmentObjects, createEnvironmentObject, confirmEnvironmentObject, reviewEnvironmentObject, listEnvironmentObjectsForSession, createEnvironmentObservation, countScanImages, loadGameState, listScanImages, finalizeScanGroup, saveGameState, claimScanGroup, deleteSessionScanGroups, deleteGameState, resetSessionScanGroupsForReuse, cors, express, multer, detectImageType, saveImage, removeImage, lastWitnessBlueprint, createInitialGameState, advanceGame, completeMission, resolveAnchorPuzzle, investigateAnchor, ArchitectDecisionService, createAiProvider, analyzeCalibration, recoverTransmission, transmissionFragments, reconstructSignal, signalFragments, MAX_THRESHOLDS, ZONE_NAMES, sessions, MAX_SCAN_IMAGE_SIZE, MAX_SCAN_IMAGES, scanImageUpload, evidenceImageUpload, generateSessionCode, createThreshold, findAvailableZoneIndex, readDeviceId, createPlayerToken, hashPlayerToken, verifyPlayerToken, getSession, authenticateExpeditionPlayer, updateSessionStatus, timelinePhaseForFieldStage, PHASE_TRANSITIONS, actTwoInteractions, actThreeInteractions, terminalChallenges, terminalChallenge, fieldContext, ensureField, evaluateFieldAction } = ctx;

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

// Public, spoiler-safe briefing available before gameplay starts.
app.get("/sessions/:code/opening", (request, response) => {
  const session = getSession(request.params.code);

  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }

  if (!["ready", "playing", "results"].includes(session.phase)) {
    response.status(409).json({ error: "opening_not_available" });
    return;
  }

  const mystery = startFieldExpedition(session.code).mystery;

  if (!mystery) {
    response.status(500).json({ error: "mystery_not_available" });
    return;
  }

  const publicCase = publicLastWitnessCase(mystery);

  response.json({
    family: publicCase.family,
    title: publicCase.title,
    objective: publicCase.objective,
  });
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

    // Vision is enrichment, not a dependency for starting the expedition.
    // An uploaded photograph is real calibration evidence even if local
    // Ollama is still analyzing it or is unavailable. Never require an AI
    // process to finish before allowing players to enter the game.
    const allThresholdsScanned =
      session.thresholds.length > 0 &&
      session.thresholds.every((threshold) =>
        scanGroups.some(
          (group) =>
            group.thresholdId === threshold.id &&
            ["uploaded", "analyzing", "completed", "failed"].includes(group.status) &&
            listScanImages(group.id).length > 0,
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
      timelinePhase: "opening",
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
 * Return an Expedition from calibration or completed results to the lobby.
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

  const witnessComplete = loadGameState(session.code)?.witness?.stage === "complete";
  const endActiveExpedition = request.body?.endActiveExpedition === true;
  if (
    session.phase !== "calibrating" &&
    session.phase !== "results" &&
    !(session.phase === "playing" && (witnessComplete || endActiveExpedition))
  ) {
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
}
