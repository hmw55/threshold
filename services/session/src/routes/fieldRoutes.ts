import type { Express } from "express";
import type { RouteContext, Session, ExpeditionPhase } from "../app.ts";
import type { GameMission } from "../game/gameState.js";
import type { FieldChoice, FieldAction } from "../game/fieldExpedition.js";
import {
  advanceFieldAfterDisplacement,
  initializeFieldDisplacement,
  submitDisplacementAction,
  resolveDisplacementInvestigation,
  type FieldRecord,
} from "../game/fieldExpedition.js";

export function registerFieldRoutes(app: Express, ctx: RouteContext): void {
  const { startFieldExpedition, confirmedObjects, fieldView, submitFieldObservation, voteFieldEnding, setFieldTvChoice, answerFieldPuzzle, answerFieldAllegiance, exposeFieldAllegiance, completeInteraction, lastWitnessInteractions, contradictionPuzzle, submitContradictionAnswer, submitMissingWitnessAnswer, missingWitnessPuzzle, createHash, randomBytes, randomInt, randomUUID, timingSafeEqual, clearSessions, deleteSession, loadSessions, saveSession, savePlayerCredential, getPlayerCredentialHash, deletePlayerCredential, createScanGroup, getScanGroup, listScanGroups, createScanImage, createEnvironment, listEnvironmentObjects, createEnvironmentObject, confirmEnvironmentObject, reviewEnvironmentObject, listEnvironmentObjectsForSession, createEnvironmentObservation, countScanImages, loadGameState, listScanImages, finalizeScanGroup, saveGameState, claimScanGroup, deleteSessionScanGroups, deleteGameState, resetSessionScanGroupsForReuse, cors, express, multer, detectImageType, saveImage, removeImage, lastWitnessBlueprint, createInitialGameState, advanceGame, completeMission, resolveAnchorPuzzle, investigateAnchor, ArchitectDecisionService, createAiProvider, analyzeCalibration, recoverTransmission, transmissionFragments, reconstructSignal, signalFragments, MAX_THRESHOLDS, ZONE_NAMES, sessions, MAX_SCAN_IMAGE_SIZE, MAX_SCAN_IMAGES, scanImageUpload, evidenceImageUpload, generateSessionCode, createThreshold, findAvailableZoneIndex, readDeviceId, createPlayerToken, hashPlayerToken, verifyPlayerToken, getSession, authenticateExpeditionPlayer, updateSessionStatus, timelinePhaseForFieldStage, PHASE_TRANSITIONS, actTwoInteractions, actThreeInteractions, terminalChallenges, terminalChallenge, fieldContext, ensureField, evaluateFieldAction } = ctx;

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
    observation !== undefined && (
      typeof observation !== "string" ||
      observation.trim().length < 15 ||
      observation.length > 2000
    )
  ) {
    response.status(400).json({ error: "invalid_observation" });
    return;
  }

  const physicalObservation = typeof observation === "string" ? observation.trim() : "";
  const verifiedAnchor = objectRef === resolved.puzzle.objectRef;

  // Evaluate the player's observation before attempting anchor resolution.
  // The Architect proposes an interpretation; it cannot mutate game state.
  let architectDecision;

  try {
    if (!physicalObservation || process.env.THRESHOLD_ARCHITECT_MODE === "offline") {
      throw new Error("Using offline anchor validation");
    }
    const architect = new ArchitectDecisionService(
      createAiProvider({
        provider: "ollama",
        ollamaModel: process.env.OLLAMA_MODEL ?? "gemma3:4b",
        ollamaTimeoutMs: 5_000,
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
          "My field observation: " + physicalObservation +
          ". Evaluate whether this is meaningful physical evidence. " +
          "Do not assume I discovered anything I did not describe.",
      },
    });
  } catch (error) {
    architectDecision = {
      outcome: verifiedAnchor ? "accepted" : "rejected",
      narration: "Local signal analysis is offline. The verified puzzle remains active.",
      evidenceRequest: null,
    } as const;
  }

  if (
    architectDecision.outcome !== "accepted" || !verifiedAnchor
  ) {
    const investigation = {
      playerId,
      objectRef,
      observation: physicalObservation,
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
    verifiedAnchor && architectDecision.outcome === "accepted",
  );

  const investigation = {
    playerId,
    objectRef,
    observation: physicalObservation,
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

  // Older Lens clients submit the receiver step without an observation.
  // Accept that existing contract while validating physical descriptions
  // when a newer client supplies one. Do not block the entire final act.
  if (interactionId === "locate-receiver") {
    const observation = request.body?.observation;
    if (
      observation !== undefined &&
      (typeof observation !== "string" ||
        observation.trim().length < 20 ||
        observation.length > 500)
    ) {
      response.status(400).json({ error: "invalid_receiver_observation" });
      return;
    }
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

app.get("/sessions/:code/field", (request, response) => {
  const session = getSession(request.params.code);
  if (!session) { response.status(404).json({ error: "session_not_found" }); return; }
  const token = request.header("authorization")?.replace(/^Bearer\s+/i, "");
  const playerId = request.header("x-player-id");
  if (!authenticateExpeditionPlayer(session, playerId, token)) {
    response.status(401).json({ error: "invalid_player_credentials" }); return;
  }
  if (session.phase !== "playing" && session.phase !== "results") {
    response.status(409).json({ error: "game_not_available" }); return;
  }
  const ctx = fieldContext(session.code);
  
  if (!ctx) { 
    response.status(409).json({ 
      error: "environment_not_ready" 
    }); 
    return; 
  }
  
  const needsInitialization = !ctx.game.field;
  const field = ensureField(ctx.game);

  const updated = initializeFieldDisplacement(
    field,
    ctx.objects,
    session.players,
  );

  if (needsInitialization || updated !== field) {
    ctx.game.field = updated;
    saveGameState(ctx.game);
  }

  response.json(
    fieldView(updated, ctx.objects, session.players, playerId ?? null),
  );
});

/** Players can confirm additional real objects after calibration, including rooms without TVs. */
app.post("/sessions/:code/field/objects", (request, response) => {
  const session = getSession(request.params.code);
  if (!session) { response.status(404).json({ error: "session_not_found" }); return; }
  const playerId = request.header("x-player-id");
  const token = request.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!authenticateExpeditionPlayer(session, playerId, token)) {
    response.status(401).json({ error: "invalid_player_credentials" }); return;
  }
  if (session.phase !== "playing" || !session.environmentId) {
    response.status(409).json({ error: "environment_not_ready" }); return;
  }
  const name = request.body?.name;
  const location = request.body?.location;
  if (typeof name !== "string" || name.trim().length < 2 || name.length > 80 ||
      typeof location !== "string" || location.trim().length < 2 || location.length > 80) {
    response.status(400).json({ error: "invalid_object_details" }); return;
  }
  const existing = confirmedObjects(listEnvironmentObjectsForSession(session.environmentId, session.code));
  if (existing.some(o => o.name.toLowerCase() === name.trim().toLowerCase() && o.location.toLowerCase() === location.trim().toLowerCase())) {
    response.status(409).json({ error: "object_already_known" }); return;
  }
  const now = new Date().toISOString();
  const object = createEnvironmentObject({ id: randomUUID(), environmentId: session.environmentId,
    parentObjectId: null, name: name.trim(), category: "player_confirmed_object",
    description: null, location: location.trim(), recognitionStatus: "confirmed",
    requiresCloserScan: false, createdAt: now });
  createEnvironmentObservation({ id: randomUUID(), environmentId: session.environmentId,
    objectId: object.id, sessionCode: session.code, scanGroupId: null,
    observedName: object.name, observedCategory: object.category,
    observedDescription: null, observedLocation: object.location,
    recognitionStatus: "confirmed", observedAt: now });
  response.status(201).json({ object: { id: object.id, name: object.name, location: object.location } });
});

app.post(
  "/sessions/:code/field/displacement/action",
  evidenceImageUpload,
  async (request, response) => {
    const code = request.params.code;

    if (typeof code !== "string") {
      response.status(400).json({ error: "invalid_session_code" });
      return;
    }

    const session = getSession(code);

    if (!session) {
      response.status(404).json({ error: "session_not_found" });
      return;
    }

    const playerId = request.header("x-player-id");
    const token = request.header("authorization")?.replace(/^Bearer\s+/i, "");

    if (!authenticateExpeditionPlayer(session, playerId, token)) {
      response.status(401).json({ error: "invalid_player_credentials" });
      return;
    }

    if (session.phase !== "playing") {
      response.status(409).json({ error: "game_not_active" });
      return;
    }

    const ctx = fieldContext(session.code);

    if (!ctx || !session.environmentId) {
      response.status(409).json({ error: "environment_not_ready" });
      return;
    }

    const field = ensureField(ctx.game);
    const encounter = field.displacement;

    if (!encounter || encounter.phase !== "awaiting_action") {
      response.status(409).json({ error: "displacement_action_unavailable" });
      return;
    }

    if (playerId !== encounter.actorId) {
      response.status(403).json({ error: "displacement_actor_unauthorized" });
      return;
    }

    // Do not allow the encounter to begin before the exchange stage.
    if (field.stage !== "exchange") {
      response.status(409).json({ error: "displacement_stage_unavailable" });
      return;
    }

    const object = ctx.objects.find(
      (item) => item.id === request.body?.objectId,
    );

    if (!object || object.id !== encounter.objectId) {
      response.status(400).json({ error: "displacement_wrong_object" });
      return;
    }

    const action = request.body?.action;

    if (
      action !== "move" &&
      action !== "rotate" &&
      action !== "reposition"
    ) {
      response.status(400).json({ error: "displacement_requires_physical_action" });
      return;
    }

    const observation = request.body?.observation;

    if (
      typeof observation !== "string" ||
      observation.trim().length < 12 ||
      observation.length > 1200
    ) {
      response.status(400).json({ error: "invalid_observation" });
      return;
    }

    if (!request.file) {
      response.status(400).json({ error: "displacement_photo_required" });
      return;
    }

    const mime = detectImageType(request.file.buffer);

    if (!mime) {
      response.status(415).json({ error: "unsupported_image" });
      return;
    }

    let imageKey: string | null = null;

    try {
      imageKey = await saveImage(
        request.file.buffer,
        session.code,
        `displacement-${field.revision}`,
        mime,
      );

      const record: FieldRecord = {
        id: randomUUID(),
        stage: field.stage,
        playerId: playerId!,
        objectId: object.id,
        objectName: object.name,
        observation: observation.trim(),
        imageKey,
        createdAt: Date.now(),
        action,
        detail: null,
      };

      const updated = submitDisplacementAction(
        field,
        playerId!,
        record,
      );

      // Preserve the submitted evidence for the final case record.
      ctx.game.field = {
        ...updated,
        displacementEvidence: [
          ...(updated.displacementEvidence ?? []),
          record,
        ],
      };

      ctx.game.tvEvents = [
        ...(ctx.game.tvEvents ?? []).slice(-19),
        {
          id: randomUUID(),
          type: "transmission",
          message:
            "ANOMALY DETECTED // A witness reports that the environment has changed. " +
            "The investigation is now active.",
          createdAt: Date.now(),
        },
      ];

      saveGameState(ctx.game);

      response.json({
        accepted: true,
        view: fieldView(
          ctx.game.field,
          ctx.objects,
          session.players,
          playerId!,
        ),
      });
    } catch (error) {
      if (imageKey) {
        await removeImage(imageKey).catch(() => {});
      }

      response.status(409).json({
        error: error instanceof Error
          ? error.message
          : "displacement_action_failed",
      });
    }
  },
);

app.post(
  "/sessions/:code/field/displacement/investigate",
  evidenceImageUpload,
  async (request, response) => {
    const code = request.params.code;

    if (typeof code !== "string") {
      response.status(400).json({ error: "invalid_session_code" });
      return;
    }

    const session = getSession(code);

    if (!session) {
      response.status(404).json({ error: "session_not_found" });
      return;
    }

    const playerId = request.header("x-player-id");
    const token = request.header("authorization")?.replace(/^Bearer\s+/i, "");

    if (!authenticateExpeditionPlayer(session, playerId, token)) {
      response.status(401).json({ error: "invalid_player_credentials" });
      return;
    }

    if (session.phase !== "playing") {
      response.status(409).json({ error: "game_not_active" });
      return;
    }

    const context = fieldContext(session.code);

    if (!context || !session.environmentId) {
      response.status(409).json({ error: "environment_not_ready" });
      return;
    }

    const field = ensureField(context.game);
    const encounter = field.displacement;

    if (!encounter || encounter.phase !== "awaiting_investigation") {
      response.status(409).json({
        error: "displacement_investigation_unavailable",
      });
      return;
    }

    if (playerId !== encounter.investigatorId) {
      response.status(403).json({
        error: "displacement_investigator_unauthorized",
      });
      return;
    }

    if (field.stage !== "exchange") {
      response.status(409).json({
        error: "displacement_stage_unavailable",
      });
      return;
    }

    const selectedObjectId = request.body?.objectId;

    if (typeof selectedObjectId !== "string") {
      response.status(400).json({ error: "invalid_object_id" });
      return;
    }

    // The investigator may select the WRONG object.
    // It must simply be a confirmed object in this session.
    const object = context.objects.find(
      (item) => item.id === selectedObjectId,
    );

    if (!object) {
      response.status(400).json({ error: "object_not_confirmed" });
      return;
    }

    const observation = request.body?.observation;

    if (
      typeof observation !== "string" ||
      observation.trim().length < 12 ||
      observation.length > 1200
    ) {
      response.status(400).json({ error: "invalid_observation" });
      return;
    }

    if (!request.file) {
      response.status(400).json({
        error: "displacement_investigation_photo_required",
      });
      return;
    }

    const mime = detectImageType(request.file.buffer);

    if (!mime) {
      response.status(415).json({ error: "unsupported_image" });
      return;
    }

    let imageKey: string | null = null;

    try {
      imageKey = await saveImage(
        request.file.buffer,
        session.code,
        `displacement-investigation-${field.revision}`,
        mime,
      );

      const record: FieldRecord = {
        id: randomUUID(),
        stage: field.stage,
        playerId: playerId!,
        objectId: object.id,
        objectName: object.name,
        observation: observation.trim(),
        imageKey,
        createdAt: Date.now(),
        action: "examine",
        detail: null,
      };

      const updated = resolveDisplacementInvestigation(
        field,
        playerId!,
        record,
        selectedObjectId,
      );

      const outcome = updated.displacement?.outcome;
      const winnerId =
        outcome === "detected"
          ? encounter.investigatorId
          : encounter.actorId;

      const nextField = advanceFieldAfterDisplacement(
        {
          ...updated,
          displacementEvidence: [
            ...(updated.displacementEvidence ?? []),
            record,
          ],
        },
        session.players,
      );

      context.game.field = nextField;
      context.game.timelinePhase = timelinePhaseForFieldStage(nextField.stage);

      // Award the winning player once.
      const winner = context.game.players?.find(
        (player) => player.playerId === winnerId,
      );

      if (winner) {
        winner.score += 300;
      }

      context.game.tvEvents = [
        ...(context.game.tvEvents ?? []).slice(-19),
        {
          id: randomUUID(),
          type: "reveal",
          message:
            outcome === "detected"
              ? "DISPLACEMENT RESOLVED // The investigator identified the assigned object. The Architect acknowledges the discovery."
              : "DISPLACEMENT RESOLVED // The investigator selected a different object. The hidden actor's deception survived.",
          createdAt: Date.now(),
        },
      ];

      saveGameState(context.game);

      response.json({
        accepted: true,
        outcome,
        pointsAwarded: 300,
        winnerId,
        view: fieldView(
          nextField,
          context.objects,
          session.players,
          playerId!,
        ),
      });
    } catch (error) {
      if (imageKey) {
        await removeImage(imageKey).catch(() => {});
      }

      response.status(409).json({
        error:
          error instanceof Error
            ? error.message
            : "displacement_investigation_failed",
      });
    }
  },
);

app.post("/sessions/:code/field/observation", evidenceImageUpload, async (request, response) => {
  const code = request.params.code;
  const session = getSession(
    typeof code === "string" ? code : Array.isArray(code) ? (code[0] ?? "") : ""
  );
  if (!session) { response.status(404).json({ error: "session_not_found" }); return; }
  const playerId = request.header("x-player-id");
  const token = request.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!authenticateExpeditionPlayer(session, playerId, token)) {
    response.status(401).json({ error: "invalid_player_credentials" }); return;
  }
  if (session.phase !== "playing") { response.status(409).json({ error: "game_not_active" }); return; }
  const ctx = fieldContext(session.code);
  if (!ctx) { response.status(409).json({ error: "environment_not_ready" }); return; }
  if (!session.environmentId) { response.status(409).json({ error: "environment_not_ready" }); return; }
  const object = ctx.objects.find(item => item.id === request.body?.objectId);
  if (!object) { response.status(400).json({ error: "object_not_confirmed" }); return; }

  const field = ensureField(ctx.game);
  const observation = request.body?.observation;
  const action = (typeof request.body?.action === "string" ? request.body.action : "observe") as FieldAction;
  const detail = typeof request.body?.detail === "string" ? request.body.detail : null;

  if (!["observe", "examine", "move", "rotate", "reposition", "safe_alternative"].includes(action)) {
    response.status(400).json({ error: "invalid_field_action" }); return;
  }
  if (typeof observation !== "string" || observation.trim().length < 12 || observation.length > 1200) {
    response.status(400).json({ error: "invalid_observation" }); return;
  }
  if (!["survey", "signal", "exchange"].includes(field.stage) ||
      field.records.some(r => r.stage === field.stage && r.playerId === playerId)) {
    response.status(409).json({ error: "observation_unavailable" }); return;
  }

  // Survey accepts any confirmed object. Signal and Exchange must
  // enforce the assigned target before invoking the Architect.
  if (field.stage !== "survey") {
    const expectedTarget = fieldView(
      field, confirmedObjects(listEnvironmentObjectsForSession(session.environmentId, session.code)),
      session.players, playerId ?? null,
    ).target;

    if (!expectedTarget || expectedTarget.id !== object.id) {
      response.status(409).json({ error: "wrong_directive_object" }); return;
    }
  }



  const mime = request.file ? detectImageType(request.file.buffer) : null;
  if (request.file && !mime) { response.status(415).json({ error: "unsupported_image" }); return; }
  let imageKey: string | null = null;
  try {
    if (request.file && mime) imageKey = await saveImage(request.file.buffer, session.code, `field-${field.revision}`, mime);
    const architectDecision = await evaluateFieldAction(session, playerId!, object, action, observation.trim(), imageKey);
    const updated = submitFieldObservation(field, { playerId: playerId!, object, observation, imageKey, action, detail }, session.players, Date.now(), confirmedObjects(listEnvironmentObjectsForSession(session.environmentId, session.code)));
    const directed = architectDecision?.narration
      ? { ...updated, architectLog: [...updated.architectLog, architectDecision.narration] }
      : updated;
    ctx.game.field = directed;
    ctx.game.timelinePhase = timelinePhaseForFieldStage(directed.stage);
    ctx.game.tvEvents = [...(ctx.game.tvEvents ?? []).slice(-19), {
      id: randomUUID(), type: "transmission", message: `${architectDecision?.narration ?? "The Architect records the evidence."} ${directed.stage !== field.stage ? "THE SIGNAL HAS SHIFTED." : "AWAITING ANOTHER PERSPECTIVE."}`,
      createdAt: Date.now(),
    }];
    const player = ctx.game.players?.find(p => p.playerId === playerId);
    const points = directed.scoreEvents.at(-1)?.playerId === playerId ? directed.scoreEvents.at(-1)?.points ?? 0 : 0;
    if (player) player.score += points;
    saveGameState(ctx.game);
    response.json({ accepted: true, view: fieldView(directed, ctx.objects, session.players, playerId ?? null) });
  } catch (error) {
    if (imageKey) await removeImage(imageKey).catch(() => {});
    response.status(409).json({ error: error instanceof Error ? error.message : "submission_failed" });
  }
});

app.post("/sessions/:code/field/verdict", (request, response) => {
  const session = getSession(request.params.code);
  if (!session) { response.status(404).json({ error: "session_not_found" }); return; }
  const playerId = request.header("x-player-id");
  const token = request.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!authenticateExpeditionPlayer(session, playerId, token)) {
    response.status(401).json({ error: "invalid_player_credentials" }); return;
  }
  if (session.phase !== "playing") { response.status(409).json({ error: "game_not_active" }); return; }
  const ctx = fieldContext(session.code);
  if (!ctx) { response.status(409).json({ error: "environment_not_ready" }); return; }
  try {
    const updated = voteFieldEnding(ensureField(ctx.game), playerId!, request.body?.choice as FieldChoice, session.players);
    ctx.game.field = updated;
    ctx.game.timelinePhase = timelinePhaseForFieldStage(updated.stage);
    if (updated.ending) ctx.game.tvEvents = [...(ctx.game.tvEvents ?? []).slice(-19), {
      id: randomUUID(), type: "reveal", message: `FINAL SIGNAL: ${updated.ending.toUpperCase()}. The room belongs to its witnesses.`, createdAt: Date.now(),
    }];
    saveGameState(ctx.game);
    if (updated.stage === "complete") {
      session.phase = "results";
      saveSession(session.code, session);
    }
    response.json({ accepted: true, view: fieldView(updated, ctx.objects, session.players, playerId ?? null) });
  } catch (error) {
    response.status(409).json({ error: error instanceof Error ? error.message : "verdict_failed" });
  }
});

app.post("/sessions/:code/field/puzzle", (request, response) => {
  const session = getSession(request.params.code);
  if (!session) { response.status(404).json({ error: "session_not_found" }); return; }
  const playerId = request.header("x-player-id");
  const token = request.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!authenticateExpeditionPlayer(session, playerId, token)) { response.status(401).json({ error: "invalid_player_credentials" }); return; }
  const ctx = fieldContext(session.code);
  if (!ctx) { response.status(409).json({ error: "environment_not_ready" }); return; }
  try {
    const result = answerFieldPuzzle(ensureField(ctx.game), playerId!, request.body?.choiceId, request.body?.evidenceIds);
    ctx.game.field = result.state;
    if (result.correct) {
      const player = ctx.game.players?.find(entry => entry.playerId === playerId);
      if (player) player.score += 250;
    }
    saveGameState(ctx.game);
    response.json({ correct: result.correct, outcome: result.outcome, narration: result.narration, view: fieldView(result.state, ctx.objects, session.players, playerId ?? null) });
  } catch (error) { response.status(409).json({ error: error instanceof Error ? error.message : "puzzle_unavailable" }); }
});

app.post("/sessions/:code/field/allegiance", (request, response) => {
  const session = getSession(request.params.code);
  if (!session) { response.status(404).json({ error: "session_not_found" }); return; }
  const playerId = request.header("x-player-id");
  const token = request.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!authenticateExpeditionPlayer(session, playerId, token)) { response.status(401).json({ error: "invalid_player_credentials" }); return; }
  const ctx = fieldContext(session.code);
  if (!ctx) { response.status(409).json({ error: "environment_not_ready" }); return; }
  if (typeof request.body?.accepted !== "boolean") { response.status(400).json({ error: "accepted_required" }); return; }
  const playerIndex = session.players.findIndex(player => player.id === playerId);
  const offer = playerIndex % 2 === 0 ? "cooperate" : "deceive";
  ctx.game.field = answerFieldAllegiance(ensureField(ctx.game), playerId!, request.body.accepted, offer);
    saveGameState(ctx.game);
    response.json({ accepted: request.body.accepted, view: fieldView(ctx.game.field, ctx.objects, session.players, playerId ?? null) });
  });

app.post("/sessions/:code/field/expose", (request, response) => {
  const session = getSession(request.params.code);
  if (!session) { response.status(404).json({ error: "session_not_found" }); return; }
  const playerId = request.header("x-player-id");
  const token = request.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!authenticateExpeditionPlayer(session, playerId, token)) { response.status(401).json({ error: "invalid_player_credentials" }); return; }
  const targetPlayerId = request.body?.targetPlayerId;
  if (typeof targetPlayerId !== "string" || !session.players.some(player => player.id === targetPlayerId)) { response.status(400).json({ error: "invalid_target_player" }); return; }
  const ctx = fieldContext(session.code);
  if (!ctx) { response.status(409).json({ error: "environment_not_ready" }); return; }
  const result = exposeFieldAllegiance(ensureField(ctx.game), playerId!, targetPlayerId);
  ctx.game.field = result.state;
  const exposer = ctx.game.players?.find(player => player.playerId === playerId);
  if (exposer && result.exposed) exposer.score += 300;
  saveGameState(ctx.game);
  response.json({ exposed: result.exposed, narration: result.narration, view: fieldView(result.state, ctx.objects, session.players, playerId ?? null) });
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
  const token = request.header("authorization")?.replace(/^Bearer\s+/i, "");

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

/** Shared Architect transmissions visible to authenticated Lens players. */
app.get("/sessions/:code/game/transmissions", (request, response) => {
  const session = getSession(request.params.code);
  if (!session) {
    response.status(404).json({ error: "session_not_found" });
    return;
  }
  const playerId = request.header("x-player-id");
  const token = request.header("authorization")?.replace(/^Bearer\s+/i, "");
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
  response.json({ phase: state.phase, events: (state.tvEvents ?? []).slice(-40) });
});
}
