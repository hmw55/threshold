import {
  createLastWitnessCase,
  evaluateMysteryAccusation,
  publicLastWitnessCase,
  type LastWitnessCase,
} from "./lastWitnessCase.js";

/** The Last Witness: evidence-grounded shared encounter director.
 * Fiction is allowed; unobserved physical objects and historical events are not.
 * No language-model output is trusted to verify a physical action.
 */
export type FieldStage = "survey" | "signal" | "exchange" | "fracture" | "verdict" | "complete";
export type FieldChoice = "preserve" | "release" | "erase";
export type FieldAction = "observe" | "examine" | "move" | "rotate" | "reposition" | "safe_alternative";
export interface FieldRecord {
  id: string;
  stage: FieldStage;
  playerId: string;
  objectId: string;
  objectName: string;
  observation: string;
  imageKey: string | null;
  createdAt: number;
  action: FieldAction;
  detail: string | null;
}
export interface FieldScoreEvent { playerId: string; reason: string; points: number; createdAt: number; }
export interface FieldAllegiance { offer: "cooperate" | "deceive" | "conceal" | "expose"; accepted: boolean | null; completed: boolean; exposed: boolean; }
export interface FieldPuzzle { id: string; prompt: string; choices: { id: string; label: string }[]; answerId: string; solvedBy: string[]; }
export interface FieldState {
  stage: FieldStage;
  revision: number;
  seed: number;
  records: FieldRecord[];
  votes: Record<string, FieldChoice>;
  ending: FieldChoice | null;
  startedAt: number;
  finishedAt: number | null;
  mystery?: LastWitnessCase;
  tvChoice?: FieldChoice | null;
  scoreEvents: FieldScoreEvent[];
  allegiances: Record<string, FieldAllegiance>;
  puzzle: FieldPuzzle | null;
  architectLog: string[];
}
export interface FieldObject { id: string; name: string; location: string; }
export interface FieldPlayer { id: string; name: string; }
const stages: FieldStage[] = ["survey", "signal", "exchange", "fracture", "verdict", "complete"];
const stageTitles: Record<FieldStage, string> = {
  survey: "I // THE ROOM REMEMBERS", signal: "II // A SIGNAL IN PLAIN SIGHT",
  exchange: "III // TWO SIDES OF THE SAME ROOM", fracture: "IV // THE ARCHITECT DIVIDES",
  verdict: "V // THE LAST WITNESS", complete: "TRANSMISSION ENDED",
};
const transmissions: Record<FieldStage, string> = {
  survey: "I can see only what you show me. Establish one truth about this place. No invented evidence. No second chances to unsee it.",
  signal: "Something ordinary has become important. Choose a real object. Give it a meaning only you could know.",
  exchange: "I have given different instructions to different Lenses. Neither sees the entire signal. Compare what you know.",
  fracture: "I cannot tell whether you are cooperating. The evidence is real; my interpretation may not be. Challenge one assumption.",
  verdict: "You have shown me a place I cannot enter. Decide what I am permitted to remember.",
  complete: "The room remains yours. I will carry only the truth you chose to leave behind.",
};
export function startFieldExpedition(code: string, now = Date.now()): FieldState {
  const seed = [...code].reduce((value, letter) => ((value * 31 + letter.charCodeAt(0)) >>> 0), 17);
  return {
    stage: "survey",
    revision: 0,
    seed,
    mystery: createLastWitnessCase(seed),
    records: [],
    votes: {},
    ending: null,
    startedAt: now,
    finishedAt: null,
    tvChoice: null,
    scoreEvents: [],
    allegiances: {},
    puzzle: null,
    architectLog: [],
  };
}
export function confirmedObjects(objects: Array<{ id: string; name: string; location: string; recognitionStatus: string }>): FieldObject[] {
  return objects.filter(o => o.recognitionStatus === "confirmed" && o.name.trim().length > 0)
    .map(({id, name, location}) => ({ id, name, location }));
}
function assignedFieldObject(
  state: FieldState,
  objects: FieldObject[],
  players: FieldPlayer[],
  playerId: string | null,
): FieldObject | null {
  if (!objects.length) return null;

  const index = stages.indexOf(state.stage);
  const playerIndex = Math.max(0, players.findIndex(p => p.id === playerId));
  const selected = objects[(state.seed + index * 7 + playerIndex * 3) % objects.length] ?? null;
  if (!selected) return null;

  if (!playerId || !["signal", "exchange"].includes(state.stage)) {
    return selected;
  }

  const previousStages: FieldStage[] = state.stage === "signal"
    ? ["survey"]
    : ["survey", "signal"];

  const visited = new Set(
    state.records
      .filter(record =>
        record.playerId === playerId &&
        previousStages.includes(record.stage),
      )
      .map(record => record.objectId),
  );

  // Prefer confirmed objects this player has not investigated in earlier stages.
  // If every object has been visited, retain the deterministic fallback.
  const preferredIndex = objects.findIndex(object => object.id === selected.id);
  for (let offset = 0; offset < objects.length; offset++) {
    const candidate = objects[(Math.max(0, preferredIndex) + offset) % objects.length];
    if (candidate && !visited.has(candidate.id)) return candidate;
  }

  return selected;
}
function buildFieldEndingTransmission(state: FieldState): string {
  const records = state.records.slice(-3);
  const evidence = records.length
    ? records.map(record =>
        `${record.objectName}: "${record.observation}"`,
      ).join("\n")
    : "No witness statements were recovered.";

  switch (state.ending) {
    case "preserve":
      return [
        "THE ARCHITECT // RECORD RETAINED",
        "Your decision preserves the Architect's copy of the witness record.",
        "The objects and details below remain part of its account:",
        evidence,
        "The record survives. Its interpretation is not guaranteed to be true.",
      ].join("\n\n");

    case "release":
      return [
        "THE ARCHITECT // RECORD RELEASED",
        "The witness statements pass beyond the Architect's exclusive control.",
        "These are the observations the witnesses chose to contribute:",
        evidence,
        "The statements are shared. Their meaning remains open to challenge.",
      ].join("\n\n");

    case "erase":
      return [
        "THE ARCHITECT // COPY ERASED",
        "The Architect relinquishes its own copy of the witness record.",
        "The statements that shaped this decision were:",
        evidence,
        "The system's copy is gone. This does not delete photographs or other stored user data.",
      ].join("\n\n");

    default:
      return "THE ARCHITECT // NO FINAL DECISION WAS RECORDED";
  }
}

export function fieldView(state: FieldState, objects: FieldObject[], players: FieldPlayer[], playerId: string | null) {
  const index = stages.indexOf(state.stage);
  const playerIndex = Math.max(0, players.findIndex(p => p.id === playerId));
  const target = assignedFieldObject(state, objects, players, playerId);
  const stageRecords = state.records.filter(r => r.stage === state.stage);
  const hasSubmitted = stageRecords.some(r => r.playerId === playerId);
  const prompts: Record<FieldStage, string[]> = {
    survey: ["Inspect a real object. Describe one detail a photograph might miss.", "Look at the same place from a different perspective. What detail could someone overlook?"],
    signal: ["Assign a temporary purpose to a real object. What could it signal, and how would another player recognize that signal?", "Investigate a real object. What makes it a convincing hiding place for a message?"],
    exchange: ["Privately choose a real detail. Tell another player only half of what you noticed; let them find the rest.", "Ask another player for a clue, then independently verify something in the room."],
    fracture: ["Challenge the Architect: identify one assumption about this room that you cannot verify.", "Test a claim made by another player using something physically observable."],
    verdict: ["What should the Architect be allowed to remember about this real place?", "What detail would you protect from the Architect, and why?"],
    complete: ["The expedition is complete."],
  };
  const revealShared = state.stage === "fracture" || state.stage === "verdict" || state.stage === "complete";
  const prior = state.records.filter(r => revealShared || r.playerId === playerId).slice(-4)
    .map(r => ({ playerId: r.playerId, stage: r.stage, player: players.find(p => p.id === r.playerId)?.name ?? "Operative", object: r.objectName, observation: r.observation }));
  const latest = state.records[state.records.length - 1];
  const dynamicTransmission = latest && state.stage !== "survey" && state.stage !== "complete"
    ? `${transmissions[state.stage]} The last verified witness record concerns ${latest.objectName}. That object is real; what it means is still undecided.`
    : transmissions[state.stage];
  const previousStage: FieldStage | null =
    state.stage === "signal" ? "survey"
      : state.stage === "exchange" ? "signal"
      : null;

  const previousObservation = previousStage && playerId
    ? [...state.records].reverse().find(
        record => record.stage === previousStage && record.playerId === playerId,
      )
    : undefined;

  const dynamicPrompt =
    (state.stage === "signal" || state.stage === "exchange") &&
      previousObservation && target
      ? [
          "FOLLOW THE EVIDENCE",
          `PREVIOUS WITNESS RECORD // ${previousObservation.objectName}: "${previousObservation.observation}"`,
          `NEXT PHYSICAL TARGET // ${target.name} in ${target.location}.`,
          state.stage === "signal"
            ? `Inspect ${target.name}. Find a real detail that could support or contradict the earlier observation. Describe what you can actually see; do not assume the objects are connected.`
            : `Compare ${target.name} with the earlier ${previousObservation.objectName} observation. Look for a specific physical detail that supports, contradicts, or leaves the earlier account unresolved.`,
          "A witness statement is not independent proof. Report only what you can verify."
        ].join("\n\n")
      : state.stage === "fracture"
        ? [
            "FRACTURE // THE EVIDENCE DOES NOT SPEAK FOR ITSELF",
            ...(["survey", "signal", "exchange"] as const).map(stage => {
              const records = state.records.filter(record => record.stage === stage);
              return records.length
                ? `${stage.toUpperCase()} RECORDS\n${records.map(record =>
                    `WITNESS // ${players.find(player => player.id === record.playerId)?.name ?? "Operative"}\nOBJECT // ${record.objectName} (${record.objectId})\nOBSERVATION // "${record.observation}"\nLIMIT // I cannot independently establish when this detail appeared, what caused it, or what it means from this statement alone.`
                  ).join("\n\n")}`
                : `${stage.toUpperCase()} RECORDS\nNo observation was recorded for this stage.`;
            }),
            "CONFRONTATION // Compare the three stages. Which details are independently observable? What remains an assumption? Which interpretations remain unverified?",
            "CLASSIFY THE RELATIONSHIP // Do the records SUPPORT the current hypothesis, CONTRADICT it, or FAIL TO ESTABLISH it? Different objects or different details are not automatically contradictions.",
            "DECISION // Use the verified case evidence to justify your accusation. Do not invent a connection that the witness records cannot establish."
          ].join("\n\n")
        : prompts[state.stage][(playerIndex + state.seed) % prompts[state.stage].length];
  const privateInstruction = playerId === null ? null : state.stage === "exchange"
    ? (playerIndex % 2 === 0
      ? "PRIVATE DIRECTIVE // Share the object name, but keep your most important detail to yourself until the other witness reports."
      : "PRIVATE DIRECTIVE // Ask another witness for the missing detail, then verify it against the real object before you report.")
    : state.stage === "fracture"
      ? (playerIndex % 2 === 0
        ? "PRIVATE DIRECTIVE // Defend the strongest claim in your record, but name the part you cannot prove."
        : "PRIVATE DIRECTIVE // Find a physical detail that could disprove another witness's interpretation.")
      : `PRIVATE DIRECTIVE // You are the ${playerIndex % 2 === 0 ? "observer" : "challenger"}. Ground every claim in the confirmed room evidence.`;
  const allegiance = playerId === null ? null : state.allegiances[playerId] ?? {
    offer: playerIndex % 2 === 0 ? "cooperate" : "deceive",
    accepted: null,
    completed: false,
    exposed: false,
  };
  const publicLog = state.architectLog.slice(-3);
  return {
    stage: state.stage, title: stageTitles[state.stage], transmission: dynamicTransmission,
    endingTransmission: state.stage === "complete"
      ? buildFieldEndingTransmission(state)
      : null,
    revision: state.revision, progress: index, total: 5, target,
    prompt: dynamicPrompt,
    privateInstruction,
    allegiance,
    puzzle: state.puzzle
      ? { ...state.puzzle, answerId: undefined }
      : null,
    architectLog: playerId === null
      ? publicLog
      : state.architectLog.slice(-5),
    mystery: state.mystery
      ? publicLastWitnessCase(state.mystery)
      : null,
    scoreEvents: state.scoreEvents.filter(event => playerId === null || event.playerId === playerId),
    role: playerIndex % 2 === 0
      ? "OBSERVER"
      : "CHALLENGER",
    submitted: hasSubmitted, received: stageRecords.length,
    required: Math.max(1, players.length),
    objects, prior, ending: state.ending, tvChoice: state.tvChoice ?? null, votes: Object.keys(state.votes).length,
    hasVoted: Boolean(playerId && state.votes[playerId]), playerCount: players.length, elapsedSeconds: Math.floor((Date.now() - state.startedAt) / 1000),
  };
}
export function submitFieldObservation(state: FieldState, input: {
  playerId: string; object: FieldObject; observation: string;
  imageKey?: string | null; action?: FieldAction; detail?: string | null;
}, players: FieldPlayer[], now = Date.now(), worldObjects: FieldObject[] = []): FieldState {
  if (state.stage === "complete") throw new Error("expedition_complete");
  if (!["survey", "signal", "exchange"].includes(state.stage)) {
    throw new Error("observation_unavailable");
  }
  if (!players.some(p => p.id === input.playerId)) throw new Error("invalid_player");
  if (state.records.some(r => r.stage === state.stage && r.playerId === input.playerId)) {
    throw new Error("already_submitted");
  }
  if (state.stage !== "survey") {
    const target = assignedFieldObject(state, worldObjects, players, input.playerId);
    if (!target || input.object.id !== target.id) {
      throw new Error("wrong_directive_object");
    }
  }

  const observation = input.observation.trim();
  if (observation.length < 12 || observation.length > 1200) throw new Error("invalid_observation");
  const action = input.action ?? "observe";
  if (["examine", "move", "rotate", "reposition"].includes(action) && !input.imageKey) {
    throw new Error("photo_required_for_physical_action");
  }

  const record: FieldRecord = {
    id: `${state.revision}-${input.playerId}`,
    stage: state.stage,
    playerId: input.playerId,
    objectId: input.object.id,
    objectName: input.object.name,
    observation,
    imageKey: input.imageKey ?? null,
    createdAt: now,
    action,
    detail: input.detail?.trim() || null,
  };
  const records = [...state.records, record];
  const contributors = new Set(records.filter(r => r.stage === state.stage).map(r => r.playerId));
  const advances = players.length > 0 && players.every(player => contributors.has(player.id));
  const next: FieldStage = advances
    ? state.stage === "survey" ? "signal"
      : state.stage === "signal" ? "exchange"
      : "fracture"
    : state.stage;
  const points = action === "examine" ? 150
    : ["move", "rotate", "reposition"].includes(action) ? 125 : 75;
  const scoreEvents = [...state.scoreEvents, {
    playerId: input.playerId,
    reason: `${action} ${input.object.name}`,
    points,
    createdAt: now,
  }];
  const puzzle = next === "fracture" && !state.puzzle ? buildFieldPuzzle(records, state.mystery) : state.puzzle;
  const playerName = players.find(player => player.id === input.playerId)?.name ?? "operative";
  const architectLog = [...state.architectLog,
    `WITNESS RECORD // ${playerName} reported ${input.object.name}: "${observation}". This is a witness statement, not independent proof of the Architect's interpretation.`];

  return { ...state, records, stage: next, revision: state.revision + 1, scoreEvents, puzzle, architectLog };
}

function buildFieldPuzzle(
  records: FieldRecord[],
  mystery: LastWitnessCase | undefined,
): FieldPuzzle | null {
  const evidence = records.filter(record => ["survey", "signal", "exchange"].includes(record.stage));
  if (evidence.length === 0 || !mystery) return null;

  // The solution comes from the authored case and its decisive clues,
  // never from counting which physical object received the most reports.
  const caseEvidence = mystery.clues
    .map(clue => `• ${clue.publicText}`)
    .join("\n");

  const witnessRecords = evidence
    .map(record => `${record.objectName}: ${record.observation}`)
    .join("\n");

  return {
    id: `case-deduction-${mystery.id}`,
    prompt: [
      `CASE FILE // ${mystery.title}`,
      mystery.objective,
      "VERIFIED CASE EVIDENCE:",
      caseEvidence,
      "ROOM WITNESS RECORDS:",
      witnessRecords,
      "DEDUCTION // Which suspect is supported by the case evidence?",
    ].join("\n\n"),
    choices: mystery.suspects.map(suspect => ({
      id: suspect.id,
      label: suspect.displayName,
    })),
    answerId: mystery.solution.culpritId,
    solvedBy: [],
  };
}
export function answerFieldPuzzle(
  state: FieldState,
  playerId: string,
  choiceId: string,
  evidenceIds: readonly string[] = [],
  now = Date.now(),
): {
  state: FieldState;
  correct: boolean;
  outcome: "solved" | "partial" | "incorrect";
  narration: string;
} {
  if (!state.puzzle || !state.mystery || state.stage !== "fracture") {
    throw new Error("puzzle_unavailable");
  }
  if (state.puzzle.solvedBy.includes(playerId)) {
    throw new Error("puzzle_already_solved");
  }

  const validSuspect = state.mystery.suspects.some(suspect => suspect.id === choiceId);
  const knownEvidence = new Set(state.mystery.clues.map(clue => clue.id));

  if (!validSuspect || !Array.isArray(evidenceIds) ||
      evidenceIds.length !== new Set(evidenceIds).size ||
      evidenceIds.some(id => typeof id !== "string" || !knownEvidence.has(id))) {
    throw new Error("invalid_accusation");
  }

  const outcome = evaluateMysteryAccusation(state.mystery, choiceId, evidenceIds);
  const correct = outcome === "solved";
  const puzzle = correct
    ? { ...state.puzzle, solvedBy: [...state.puzzle.solvedBy, playerId] }
    : state.puzzle;
  const scoreEvents = correct
    ? [...state.scoreEvents, {
        playerId, reason: "solved evidence deduction", points: 250, createdAt: now,
      }]
    : state.scoreEvents;

  const narration = outcome === "solved"
    ? "Your accusation survives examination. The records converge. The Architect must revise its interpretation."
    : outcome === "partial"
      ? "Your suspect is plausible, but the submitted records do not yet establish the full chain of evidence."
      : "The submitted evidence does not establish responsibility for this incident.";

  return {
    state: {
      ...state,
      puzzle,
      scoreEvents,
      architectLog: [...state.architectLog,
        correct
          ? "THE ARCHITECT ACCEPTS THE SUPPORTED ACCUSATION."
          : "THE ARCHITECT CHALLENGES THE ACCUSATION."],
      stage: correct ? "verdict" : state.stage,
      revision: state.revision + 1,
    },
    correct,
    outcome,
    narration,
  };
}

export function answerFieldAllegiance(state: FieldState, playerId: string, accepted: boolean, offer: "cooperate" | "deceive" = "cooperate"): FieldState {
  const current = state.allegiances[playerId] ?? { offer, accepted: null, completed: false, exposed: false };
  const architectLog = accepted ? state.architectLog : [...state.architectLog, "AN OPERATIVE REFUSED THE ARCHITECT'S PRIVATE OFFER."];
  return { ...state, allegiances: { ...state.allegiances, [playerId]: { ...current, accepted } }, architectLog, revision: state.revision + 1 };
}

export function exposeFieldAllegiance(state: FieldState, exposerId: string, targetId: string, now = Date.now()): { state: FieldState; exposed: boolean; narration: string } {
  const target = state.allegiances[targetId];
  if (!target || target.offer !== "deceive" || target.accepted !== true || target.exposed || targetId === exposerId) {
    return { state, exposed: false, narration: "The Architect finds no exposed betrayal in that record." };
  }
  const allegiances = { ...state.allegiances, [targetId]: { ...target, exposed: true } };
  return {
    state: {
      ...state,
      allegiances,
      scoreEvents: [...state.scoreEvents, { playerId: exposerId, reason: "exposed an Architect deception", points: 300, createdAt: now }],
      architectLog: [...state.architectLog, "A PRIVATE DECEPTION HAS BEEN EXPOSED. THE ARCHITECT REVISES THE RECORD."],
      revision: state.revision + 1,
    },
    exposed: true,
    narration: "The inconsistency was real. The deceiver loses the Architect's protection; the exposer is rewarded.",
  };
}
export function voteFieldEnding(state: FieldState, playerId: string, choice: FieldChoice, players: FieldPlayer[], now = Date.now()): FieldState {
  if (state.stage !== "verdict") throw new Error("verdict_unavailable");
  if (!players.some(p => p.id === playerId)) throw new Error("invalid_player");
  if (state.votes[playerId]) throw new Error("already_voted");
  if (!["preserve", "release", "erase"].includes(choice)) throw new Error("invalid_choice");
  const votes = { ...state.votes, [playerId]: choice };
  const required = Math.max(1, players.length);
  if (Object.keys(votes).length < required) return { ...state, votes, revision: state.revision + 1 };
  const counts = { preserve: 0, release: 0, erase: 0 };
  for (const vote of Object.values(votes)) counts[vote]++;
  const ranked = (["preserve", "release", "erase"] as FieldChoice[]).sort((a,b) => counts[b] - counts[a]);
  const winner = ranked[0] ?? "preserve";
  const runnerUp = ranked[1] ?? winner;
  const ending = counts[winner] === counts[runnerUp] ? (state.tvChoice ?? winner) : winner;
  return { ...state, votes, ending: ending ?? null, stage: "complete", finishedAt: now, revision: state.revision + 1 };
}

export function setFieldTvChoice(state: FieldState, choice: FieldChoice): FieldState {
  if (state.stage !== "verdict") throw new Error("verdict_unavailable");
  if (!["preserve", "release", "erase"].includes(choice)) throw new Error("invalid_choice");
  return { ...state, tvChoice: choice, revision: state.revision + 1 };
}
