import { registerWitnessRoutes } from "./routes/witnessRoutes.js";
import { registerSessionRoutes } from "./routes/sessionRoutes.js";
import { registerCalibrationRoutes } from "./routes/calibrationRoutes.js";
import { registerFieldRoutes } from "./routes/fieldRoutes.js";
import { registerThresholdRoutes } from "./routes/thresholdRoutes.js";

import { startFieldExpedition, confirmedObjects, fieldView, submitFieldObservation, voteFieldEnding, setFieldTvChoice, answerFieldPuzzle, answerFieldAllegiance, exposeFieldAllegiance, type FieldChoice, type FieldAction } from "./game/fieldExpedition.js";

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


export type ExpeditionPhase =
  | "lobby"
  | "calibrating"
  | "ready"
  | "playing"
  | "results";


export interface Player {
  id: string;
  name: string;
}


interface Threshold {
  id: string;
  deviceId: string;
  zoneName: string;
  joinedAt: string;
}


export interface Session {
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
    fields: 4,
    parts: 5,
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


function timelinePhaseForFieldStage(stage: string): NonNullable<ReturnType<typeof createInitialGameState>["timelinePhase"]> {
  switch (stage) {
    case "survey":
    case "signal": return "investigation";
    case "exchange": return "contradiction";
    case "fracture": return "revelation";
    case "verdict": return "resolution";
    case "complete": return "ending";
    default: return "opening";
  }
}



const PHASE_TRANSITIONS: Partial<
  Record<ExpeditionPhase, ExpeditionPhase>
> = {
  lobby: "calibrating",
  calibrating: "ready",
  ready: "playing",
  playing: "results",
};


/**
 * Return the current Last Witness game state.
 *
 * Read-only. Does not initialize or advance gameplay.
 * Requires an authenticated Lens player.
 */

const actTwoInteractions = lastWitnessInteractions.filter(
  (interaction) => interaction.phase === "contradiction",
);



const actThreeInteractions = lastWitnessInteractions.filter(
  (interaction) => interaction.phase === "revelation",
);


/**
 * Interactive public-terminal challenges. Every TV must solve its own signal.
 * The Lens retains the private investigation; the TV contributes independently.
 * Challenges vary by expedition and never expose their solution to clients.
 */
const terminalChallenges = {
  investigation: [
    { prompt: "The receiver displays 09:17, but the speaker is silent. Which trace should the team preserve?", choices: ["The timestamped receiver log", "The speaker volume", "A witness's guess"], correct: 0, clue: "A timestamp survives even when sound does not." },
    { prompt: "Two logs disagree. One is timestamped, one is an unsigned recollection. What can be verified?", choices: ["The unsigned recollection", "The timestamped log", "Neither record"], correct: 1, clue: "Look for evidence that can be checked independently." },
  ],
  contradiction: [
    { prompt: "The recording confirms a signal at 09:17. Which account demands investigation?", choices: ["I heard it at 09:17", "I checked the clock at 09:17", "No signal existed that night"], correct: 2, clue: "A witness denies the event recorded by the archive." },
    { prompt: "A witness reports silence; a machine records a transmission. What must the team distinguish?", choices: ["Transmission from audible sound", "Two different clocks", "The number of witnesses"], correct: 0, clue: "A transmission need not produce an audible event." },
  ],
  revelation: [
    { prompt: "A signal was transmitted but nobody in the room heard it. Where should the investigation turn?", choices: ["The room's speaker", "An external receiver", "The broken clock"], correct: 1, clue: "The missing witness may never have entered the room." },
    { prompt: "The archive lists a recipient without a location. What could prove someone received the signal?", choices: ["A louder speaker", "An invented confession", "A receiver acknowledgment"], correct: 2, clue: "Find the receiver, not another person to accuse." },
  ],
} as const;


function terminalChallenge(code: string, phase: keyof typeof terminalChallenges) {
  const variants = terminalChallenges[phase];
  const seed = [...code].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return variants[seed % variants.length]!;
}



/** Environment-grounded director. All facts come from confirmed objects and
 * player-submitted observations. These routes do not use scripted witnesses. */
function fieldContext(code: string) {
  const session = getSession(code);
  if (!session) return null;
  const game = loadGameState(code);
  if (!game || !session.environmentId) return null;
  const objects = confirmedObjects(listEnvironmentObjectsForSession(session.environmentId, code));
  return { session, game, objects };
}

function ensureField(game: ReturnType<typeof loadGameState>) {
  if (!game) throw new Error("game_not_initialized");
  if (!game.field) game.field = startFieldExpedition(game.sessionCode);
  game.field.scoreEvents ??= [];
  game.field.allegiances ??= {};
  game.field.architectLog ??= [];
  game.field.puzzle ??= null;
  return game.field;
}


async function evaluateFieldAction(session: Session, playerId: string, object: { id: string; name: string }, action: FieldAction, observation: string, imageKey: string | null) {
  if (process.env.THRESHOLD_ARCHITECT_MODE === "offline" || process.env.NODE_ENV === "test") return null;
  try {
    const architect = new ArchitectDecisionService(createAiProvider({
      provider: "ollama",
      ollamaModel: process.env.OLLAMA_MODEL ?? "gemma3:4b",
      ollamaTimeoutMs: 1_500,
    }));
    return await architect.evaluate({
      sessionCode: session.code,
      environmentId: session.environmentId!,
      action: imageKey
        ? { type: "photo", imageId: imageKey, description: `${action} report for confirmed object ${object.name}: ${observation}` }
        : { type: "text", text: `${action} report for confirmed object ${object.name}: ${observation}` },
    });
  } catch {
    return null;
  }
}

// Shared dependencies preserve the existing handlers during incremental extraction.
const routeContext = {
  startFieldExpedition,
  confirmedObjects,
  fieldView,
  submitFieldObservation,
  voteFieldEnding,
  setFieldTvChoice,
  answerFieldPuzzle,
  answerFieldAllegiance,
  exposeFieldAllegiance,
  completeInteraction,
  lastWitnessInteractions,
  contradictionPuzzle,
  submitContradictionAnswer,
  submitMissingWitnessAnswer,
  missingWitnessPuzzle,
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
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
  cors,
  express,
  multer,
  detectImageType,
  saveImage,
  removeImage,
  lastWitnessBlueprint,
  createInitialGameState,
  advanceGame,
  completeMission,
  resolveAnchorPuzzle,
  investigateAnchor,
  ArchitectDecisionService,
  createAiProvider,
  analyzeCalibration,
  recoverTransmission,
  transmissionFragments,
  reconstructSignal,
  signalFragments,
  MAX_THRESHOLDS,
  ZONE_NAMES,
  sessions,
  MAX_SCAN_IMAGE_SIZE,
  MAX_SCAN_IMAGES,
  scanImageUpload,
  evidenceImageUpload,
  generateSessionCode,
  createThreshold,
  findAvailableZoneIndex,
  readDeviceId,
  createPlayerToken,
  hashPlayerToken,
  verifyPlayerToken,
  getSession,
  authenticateExpeditionPlayer,
  updateSessionStatus,
  timelinePhaseForFieldStage,
  PHASE_TRANSITIONS,
  actTwoInteractions,
  actThreeInteractions,
  terminalChallenges,
  terminalChallenge,
  fieldContext,
  ensureField,
  evaluateFieldAction,
};
export type RouteContext = typeof routeContext;

registerSessionRoutes(app, routeContext);
registerCalibrationRoutes(app, routeContext);
registerWitnessRoutes(app, routeContext);
registerFieldRoutes(app, routeContext);
registerThresholdRoutes(app, routeContext);
