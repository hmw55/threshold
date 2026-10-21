import {
  createLastWitnessCase,
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
export function fieldView(state: FieldState, objects: FieldObject[], players: FieldPlayer[], playerId: string | null) {
  const index = stages.indexOf(state.stage);
  const playerIndex = Math.max(0, players.findIndex(p => p.id === playerId));
  const target = objects.length ? objects[(state.seed + index * 7 + playerIndex * 3) % objects.length] : null;
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
  const dynamicPrompt = state.stage === "signal" && latest
    ? `A witness recorded a real detail about ${latest.objectName}. Give this object a temporary fictional role in the story. What physical detail would let another player identify it?`
    : state.stage === "fracture" && latest
    ? `Challenge the Architect's interpretation of ${latest.objectName}. Inspect a real object and explain what you can prove versus what is only a story.`
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
  if (state.stage !== "survey") throw new Error("observation_unavailable");
  if (!players.some(p => p.id === input.playerId)) throw new Error("invalid_player");
  if (state.records.some(r => r.stage === "survey" && r.playerId === input.playerId)) {
    throw new Error("already_submitted");
  }

  const observation = input.observation.trim();
  if (observation.length < 12 || observation.length > 1200) throw new Error("invalid_observation");
  const action = input.action ?? "observe";
  if (["examine", "move", "rotate", "reposition"].includes(action) && !input.imageKey) {
    throw new Error("photo_required_for_physical_action");
  }

  const record: FieldRecord = {
    id: `${state.revision}-${input.playerId}`,
    stage: "survey",
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
  const contributors = new Set(records.filter(r => r.stage === "survey").map(r => r.playerId));
  const advances = contributors.size >= Math.max(1, players.length);
  const next: FieldStage = advances ? "fracture" : "survey";
  const points = action === "examine" ? 150
    : ["move", "rotate", "reposition"].includes(action) ? 125 : 75;
  const scoreEvents = [...state.scoreEvents, {
    playerId: input.playerId,
    reason: `${action} ${input.object.name}`,
    points,
    createdAt: now,
  }];
  const puzzle = advances && !state.puzzle ? buildFieldPuzzle(records, players, worldObjects) : state.puzzle;
  const playerName = players.find(player => player.id === input.playerId)?.name ?? "operative";
  const architectLog = [...state.architectLog,
    `${input.object.name} // ${action.toUpperCase()} reported by ${playerName}.`];

  return { ...state, records, stage: next, revision: state.revision + 1, scoreEvents, puzzle, architectLog };
}

function buildFieldPuzzle(records: FieldRecord[], _players: FieldPlayer[], worldObjects: FieldObject[] = []): FieldPuzzle | null {
  const evidence = records.filter(record => record.stage === "survey");
  if (evidence.length === 0) return null;

  const counts = new Map<string, number>();
  for (const record of evidence) {
    counts.set(record.objectId, (counts.get(record.objectId) ?? 0) + 1);
  }

  const answerId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!answerId) return null;

  // Choices come from confirmed room objects and verified observations.
  const labels = new Map(worldObjects.map(object => [object.id, object.name]));
  const ids = new Set([
    ...worldObjects.map(object => object.id),
    ...evidence.map(record => record.objectId),
  ]);
  const choices = [...ids].map(id => ({
    id,
    label: labels.get(id) ?? evidence.find(record => record.objectId === id)?.objectName ?? id,
  })).sort((a, b) => a.label.localeCompare(b.label));

  return {
    id: `shared-anchor-${records.length}`,
    prompt: "DEDUCTION // Which confirmed object is best supported by the witnesses' observations?",
    choices,
    answerId,
    solvedBy: [],
  };
}

export function answerFieldPuzzle(state: FieldState, playerId: string, choiceId: string, now = Date.now()): { state: FieldState; correct: boolean; narration: string } {
  if (!state.puzzle) throw new Error("puzzle_unavailable");
  if (state.stage !== "fracture") throw new Error("puzzle_unavailable");
  if (state.puzzle.solvedBy.includes(playerId)) throw new Error("puzzle_already_solved");

  const correct = choiceId === state.puzzle.answerId;
  const puzzle = correct
    ? { ...state.puzzle, solvedBy: [...state.puzzle.solvedBy, playerId] }
    : state.puzzle;
  const scoreEvents = correct
    ? [...state.scoreEvents, { playerId, reason: "solved evidence deduction", points: 250, createdAt: now }]
    : state.scoreEvents;
  const architectLog = [...state.architectLog, correct
    ? "THE ARCHITECT ACCEPTS THE SHARED DEDUCTION."
    : "THE ARCHITECT MARKS THE DEDUCTION AS UNRESOLVED."];

  return {
    state: {
      ...state,
      puzzle,
      scoreEvents,
      architectLog,
      stage: correct ? "verdict" : state.stage,
      revision: state.revision + 1,
    },
    correct,
    narration: correct
      ? "The records converge. The Architect must revise its interpretation."
      : "The records do not support that conclusion yet.",
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
