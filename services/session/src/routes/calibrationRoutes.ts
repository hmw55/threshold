import type { Express } from "express";
import type { RouteContext, Session, ExpeditionPhase } from "../app.ts";
import type { GameMission } from "../game/gameState.ts";
import type { FieldChoice, FieldAction } from "../game/fieldExpedition.ts";

export function registerCalibrationRoutes(app: Express, ctx: RouteContext): void {
  const { startFieldExpedition, confirmedObjects, fieldView, submitFieldObservation, voteFieldEnding, setFieldTvChoice, answerFieldPuzzle, answerFieldAllegiance, exposeFieldAllegiance, completeInteraction, lastWitnessInteractions, contradictionPuzzle, submitContradictionAnswer, submitMissingWitnessAnswer, missingWitnessPuzzle, createHash, randomBytes, randomInt, randomUUID, timingSafeEqual, clearSessions, deleteSession, loadSessions, saveSession, savePlayerCredential, getPlayerCredentialHash, deletePlayerCredential, createScanGroup, getScanGroup, listScanGroups, createScanImage, createEnvironment, listEnvironmentObjects, createEnvironmentObject, confirmEnvironmentObject, reviewEnvironmentObject, listEnvironmentObjectsForSession, createEnvironmentObservation, countScanImages, loadGameState, listScanImages, finalizeScanGroup, saveGameState, claimScanGroup, deleteSessionScanGroups, deleteGameState, resetSessionScanGroupsForReuse, cors, express, multer, detectImageType, saveImage, removeImage, lastWitnessBlueprint, createInitialGameState, advanceGame, completeMission, resolveAnchorPuzzle, investigateAnchor, ArchitectDecisionService, createAiProvider, analyzeCalibration, recoverTransmission, transmissionFragments, reconstructSignal, signalFragments, MAX_THRESHOLDS, ZONE_NAMES, sessions, MAX_SCAN_IMAGE_SIZE, MAX_SCAN_IMAGES, scanImageUpload, evidenceImageUpload, generateSessionCode, createThreshold, findAvailableZoneIndex, readDeviceId, createPlayerToken, hashPlayerToken, verifyPlayerToken, getSession, authenticateExpeditionPlayer, updateSessionStatus, timelinePhaseForFieldStage, PHASE_TRANSITIONS, actTwoInteractions, actThreeInteractions, terminalChallenges, terminalChallenge, fieldContext, ensureField, evaluateFieldAction } = ctx;

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
}
