import type { Express } from "express";
import type { RouteContext, Session, ExpeditionPhase } from "../app.js";
import type { GameMission } from "../game/gameState.js";
import type { FieldChoice, FieldAction } from "../game/fieldExpedition.js";

export function registerThresholdRoutes(app: Express, ctx: RouteContext): void {
  const { startFieldExpedition, confirmedObjects, fieldView, submitFieldObservation, voteFieldEnding, setFieldTvChoice, answerFieldPuzzle, answerFieldAllegiance, exposeFieldAllegiance, completeInteraction, lastWitnessInteractions, contradictionPuzzle, submitContradictionAnswer, submitMissingWitnessAnswer, missingWitnessPuzzle, createHash, randomBytes, randomInt, randomUUID, timingSafeEqual, clearSessions, deleteSession, loadSessions, saveSession, savePlayerCredential, getPlayerCredentialHash, deletePlayerCredential, createScanGroup, getScanGroup, listScanGroups, createScanImage, createEnvironment, listEnvironmentObjects, createEnvironmentObject, confirmEnvironmentObject, reviewEnvironmentObject, listEnvironmentObjectsForSession, createEnvironmentObservation, countScanImages, loadGameState, listScanImages, finalizeScanGroup, saveGameState, claimScanGroup, deleteSessionScanGroups, deleteGameState, resetSessionScanGroupsForReuse, cors, express, multer, detectImageType, saveImage, removeImage, lastWitnessBlueprint, createInitialGameState, advanceGame, completeMission, resolveAnchorPuzzle, investigateAnchor, ArchitectDecisionService, createAiProvider, analyzeCalibration, recoverTransmission, transmissionFragments, reconstructSignal, signalFragments, MAX_THRESHOLDS, ZONE_NAMES, sessions, MAX_SCAN_IMAGE_SIZE, MAX_SCAN_IMAGES, scanImageUpload, evidenceImageUpload, generateSessionCode, createThreshold, findAvailableZoneIndex, readDeviceId, createPlayerToken, hashPlayerToken, verifyPlayerToken, getSession, authenticateExpeditionPlayer, updateSessionStatus, timelinePhaseForFieldStage, PHASE_TRANSITIONS, actTwoInteractions, actThreeInteractions, terminalChallenges, terminalChallenge, fieldContext, ensureField, evaluateFieldAction } = ctx;

/** Public terminal decision. Registered TVs can commit a shared ending. */
app.post("/sessions/:code/threshold/resolution/answer", (request, response) => {
  const session = getSession(request.params.code);
  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }
  const deviceId = request.header("x-device-id");
  if (!deviceId || !session.thresholds.some((tv) => tv.deviceId === deviceId)) {
    response.status(401).json({ error: "invalid_threshold_credentials" });
    return;
  }
  const state = loadGameState(session.code);
  if (session.phase !== "playing" || !state || state.phase !== "resolution") {
    response.status(409).json({ error: "resolution_not_ready" });
    return;
  }
  const ending: unknown = request.body?.ending;
  if (ending !== "preservation" && ending !== "fracture" && ending !== "reconciliation") {
    response.status(400).json({ error: "invalid_ending" });
    return;
  }
  if (ending === "reconciliation" && !state.discoveredEvidence.includes("missing-testimony")) {
    response.status(409).json({ error: "missing_testimony_required" });
    return;
  }
  const nextState = advanceGame(state, { type: "choose_ending", ending });
  saveGameState(nextState);
  response.json({ game: { phase: nextState.phase, ending: nextState.ending } });
});

app.post("/sessions/:code/threshold/game/decision", (request, response) => {
  const session = getSession(request.params.code);
  if (!session) { response.status(404).json({ error: "session_not_found" }); return; }
  const deviceId = request.header("x-device-id");
  const threshold = session.thresholds.find((tv) => tv.deviceId === deviceId);
  if (!threshold) { response.status(401).json({ error: "invalid_threshold_credentials" }); return; }
  const state = loadGameState(session.code);
  if (session.phase !== "playing" || !state || !(state.phase in terminalChallenges)) {
    response.status(409).json({ error: "terminal_challenge_unavailable" }); return;
  }
  const phase = state.phase as keyof typeof terminalChallenges;
  const challenge = terminalChallenge(session.code, phase);
  const index = request.body?.choice;
  if (!Number.isInteger(index) || index < 0 || index >= challenge.choices.length) {
    response.status(400).json({ error: "invalid_terminal_choice" }); return;
  }
  const marker = `terminal-${phase}-${threshold.id}`;
  if (state.discoveredEvidence.includes(marker)) {
    response.status(409).json({ error: "terminal_challenge_completed" }); return;
  }
  if (index !== challenge.correct) {
    response.json({ correct: false, narration: "SIGNAL REJECTED. Reconsider the evidence and try again." });
    return;
  }
  const nextState = {
    ...state,
    discoveredEvidence: [...state.discoveredEvidence, marker],
    tvEvents: [...(state.tvEvents ?? []), {
      id: randomUUID(),
      type: "reveal" as const,
      message: `${threshold.zoneName} // VERIFIED SIGNAL: ${challenge.clue}`,
      createdAt: Date.now(),
    }],
  };
  saveGameState(nextState);
  response.json({ correct: true, narration: challenge.clue });
});

app.post("/sessions/:code/threshold/field/verdict", (request, response) => {
  const session = getSession(request.params.code);
  if (!session) { response.status(404).json({ error: "session_not_found" }); return; }
  const deviceId = readDeviceId(request.header("x-device-id"));
  if (!deviceId || !session.thresholds.some(t => t.deviceId === deviceId)) {
    response.status(401).json({ error: "invalid_threshold_credentials" }); return;
  }
  if (session.phase !== "playing") { response.status(409).json({ error: "game_not_active" }); return; }
  const ctx = fieldContext(session.code);
  if (!ctx) { response.status(409).json({ error: "environment_not_ready" }); return; }
  try {
    ctx.game.field = setFieldTvChoice(ensureField(ctx.game), request.body?.choice as FieldChoice);
    ctx.game.tvEvents = [...(ctx.game.tvEvents ?? []).slice(-19), {
      id: randomUUID(), type: "transmission", message: `THE PUBLIC DISPLAY HAS TAKEN A STANCE: ${ctx.game.field.tvChoice?.toUpperCase()}.`, createdAt: Date.now(),
    }];
    saveGameState(ctx.game);
    response.json({ accepted: true, view: fieldView(ctx.game.field, ctx.objects, session.players, null) });
  } catch (error) {
    response.status(409).json({ error: error instanceof Error ? error.message : "verdict_failed" });
  }
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
    terminalChallenge: null,
    fieldEncounter: session.environmentId ? fieldView(ensureField(gameState), confirmedObjects(listEnvironmentObjectsForSession(session.environmentId, session.code)), session.players, null) : null,
    scores: [...(gameState.players ?? [])].sort(
      (a, b) => b.score - a.score,
    ),
    events: gameState.tvEvents ?? [],
    playerNames: Object.fromEntries(
      session.players.map((player) => [player.id, player.name]),
    ),
    game: {
      phase: gameState.phase,
      timelinePhase: gameState.timelinePhase ?? gameState.phase,
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
}
