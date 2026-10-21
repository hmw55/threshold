import { describe, expect, it } from "vitest";
import {
  answerFieldAllegiance,
  answerFieldPuzzle,
  confirmedObjects,
  exposeFieldAllegiance,
  fieldView,
  startFieldExpedition,
  submitFieldObservation,
  voteFieldEnding,
  setFieldTvChoice,
} from "../src/game/fieldExpedition.js";

const players = [{ id: "p1", name: "One" }, { id: "p2", name: "Two" }];
const objects = [
  { id: "dresser", name: "Dresser", location: "Bedroom", recognitionStatus: "confirmed" },
  { id: "lamp", name: "Lamp", location: "Bedroom", recognitionStatus: "confirmed" },
  { id: "unknown", name: "Bookshelf", location: "Bedroom", recognitionStatus: "proposed" },
];
const confirmed = confirmedObjects(objects);


function completeInvestigations(
  initial: ReturnType<typeof startFieldExpedition>,
  participants = players,
) {
  let state = initial;

  for (const stage of ["signal", "exchange"] as const) {
    expect(state.stage).toBe(stage);

    for (const player of participants) {
      const target = fieldView(state, confirmed, participants, player.id).target;
      if (!target) throw new Error("Missing assigned target");

      state = submitFieldObservation(state, {
        playerId: player.id,
        object: target,
        observation: `I examined the ${target.name} in the ${target.location} and verified a physical detail.`,
      }, participants, Date.now(), confirmed);
    }
  }

  expect(state.stage).toBe("fracture");
  return state;
}

describe("physical reality first director", () => {
  it("uses distinct targets when possible and keeps private observations player-specific", () => {
    const solo = players.slice(0, 1);
    const threeObjects = [
      ...confirmed,
      { id: "book", name: "Book", location: "Bedroom" },
    ];

    let state = submitFieldObservation(
      startFieldExpedition("UNVISITED-TARGETS"),
      {
        playerId: "p1",
        object: threeObjects[0]!,
        observation: "The dresser has a scratch beneath its bottom drawer.",
      },
      solo,
      Date.now(),
      threeObjects,
    );

    const surveyObject = state.records[0]!.objectId;
    let view = fieldView(state, threeObjects, solo, "p1");

    expect(view.stage).toBe("signal");
    expect(view.target).not.toBeNull();
    expect(view.target!.id).not.toBe(surveyObject);
    expect(view.prompt).toContain(state.records[0]!.observation);

    state = submitFieldObservation(
      state,
      {
        playerId: "p1",
        object: view.target!,
        observation: `The ${view.target!.name} has a visible mark on its surface.`,
      },
      solo,
      Date.now(),
      threeObjects,
    );

    const signalObject = state.records[state.records.length - 1]!.objectId;
    view = fieldView(state, threeObjects, solo, "p1");

    expect(view.stage).toBe("exchange");
    expect(view.target).not.toBeNull();
    expect(view.target!.id).not.toBe(surveyObject);
    expect(view.target!.id).not.toBe(signalObject);
    expect(view.prompt).toContain(state.records[state.records.length - 1]!.observation);

    const multiplayer = players;
    let shared = submitFieldObservation(
      startFieldExpedition("PRIVATE-CONTEXT"),
      {
        playerId: "p1",
        object: confirmed[0]!,
        observation: "The dresser has a scratch beneath its bottom drawer.",
      },
      multiplayer,
      Date.now(),
      confirmed,
    );

    shared = submitFieldObservation(
      shared,
      {
        playerId: "p2",
        object: confirmed[1]!,
        observation: "The lamp has a chipped base.",
      },
      multiplayer,
      Date.now(),
      confirmed,
    );

    const p2View = fieldView(shared, confirmed, multiplayer, "p2");
    expect(p2View.stage).toBe("signal");
    expect(p2View.prompt).toContain("The lamp has a chipped base.");
    expect(p2View.prompt).not.toContain(
      "The dresser has a scratch beneath its bottom drawer.",
    );
  });


  it("connects Signal and Exchange instructions to prior observations and assigned targets", () => {
    const solo = players.slice(0, 1);
    const firstObservation = "The dresser has a deep scratch beneath its bottom drawer.";

    let state = submitFieldObservation(
      startFieldExpedition("CONNECTED-CLUES"),
      {
        playerId: "p1",
        object: confirmed[0]!,
        observation: firstObservation,
      },
      solo,
      Date.now(),
      confirmed,
    );

    expect(state.stage).toBe("signal");

    let view = fieldView(state, confirmed, solo, "p1");
    expect(view.target).not.toBeNull();
    expect(view.prompt).toContain(firstObservation);
    expect(view.prompt).toContain(view.target!.name);
    expect(view.prompt).toContain("FOLLOW THE EVIDENCE");

    const signalObservation =
      `The ${view.target!.name} has a visible mark near its base.`;

    state = submitFieldObservation(
      state,
      {
        playerId: "p1",
        object: view.target!,
        observation: signalObservation,
      },
      solo,
      Date.now(),
      confirmed,
    );

    expect(state.stage).toBe("exchange");

    view = fieldView(state, confirmed, solo, "p1");
    expect(view.prompt).toContain(signalObservation);
    expect(view.prompt).toContain(view.target!.name);
    expect(view.prompt).toContain("supports, contradicts");
  });



  it("rejects an unsupported accusation without advancing or awarding points", () => {
    let state = startFieldExpedition("test-unsupported", players.slice(0, 1), confirmed);

    state = submitFieldObservation(state, {
      playerId: "p1",
      object: confirmed[0]!,
      observation: "The lamp has a scratch along its base.",
    }, players.slice(0, 1), Date.now(), confirmed);

    state = completeInvestigations(state, players.slice(0, 1));

    const partial = answerFieldPuzzle(
      state, "p1", state.mystery!.solution.culpritId, [],
    );

    expect(partial.outcome).toBe("partial");
    expect(partial.correct).toBe(false);
    expect(partial.state.stage).toBe("fracture");
    expect(partial.state.scoreEvents.some(event => event.points === 250)).toBe(false);

    const wrongSuspect = state.mystery!.suspects.find(
      suspect => suspect.id !== state.mystery!.solution.culpritId,
    )!;

    const incorrect = answerFieldPuzzle(
      state,
      "p1",
      wrongSuspect.id,
      state.mystery!.solution.decisiveClueIds,
    );

    expect(incorrect.outcome).toBe("incorrect");
    expect(incorrect.state.stage).toBe("fracture");
    expect(incorrect.state.scoreEvents.some(event => event.points === 250)).toBe(false);

    expect(() => answerFieldPuzzle(
      state, "p1", state.mystery!.solution.culpritId, ["fabricated-record"],
    )).toThrow("invalid_accusation");
  });

  it("records the player's actual physical observation in the Architect log", () => {
    const observation = "The dresser has a distinctive scratch beneath its bottom drawer.";
    const state = submitFieldObservation(
      startFieldExpedition("WITNESS-RECORD"),
      {
        playerId: "p1",
        object: confirmed[0]!,
        observation,
      },
      players.slice(0, 1),
      Date.now(),
      confirmed,
    );

    expect(state.architectLog).toHaveLength(1);
    expect(state.architectLog[0]).toContain("Dresser");
    expect(state.architectLog[0]).toContain(observation);
    expect(state.architectLog[0]).toContain("witness statement");
    expect(state.architectLog[0]).toContain("not independent proof");
  });



  it("confronts a solo witness with their actual observation during Fracture", () => {
    const solo = players.slice(0, 1);
    const observation = "The dresser has a distinctive scratch beneath its bottom drawer.";

    let state = submitFieldObservation(
      startFieldExpedition("FRACTURE-WITNESS"),
      { playerId: "p1", object: confirmed[0]!, observation },
      solo,
      Date.now(),
      confirmed,
    );

    state = completeInvestigations(state, solo);

    const view = fieldView(state, confirmed, solo, "p1");

    expect(view.stage).toBe("fracture");
    expect(view.prompt).toContain(state.records[state.records.length - 1]!.observation);
    expect(view.prompt).toContain("cannot independently establish");
    expect(view.prompt).toContain("What remains an assumption?");
    expect(view.puzzle).not.toBeNull();
  });

  it("compares all investigation stages in Fracture without inventing contradictions", () => {
    const solo = players.slice(0, 1);
    let state = submitFieldObservation(
      startFieldExpedition("FRACTURE-COMPARE"),
      {
        playerId: "p1",
        object: confirmed[0]!,
        observation: "The dresser has a deep scratch beneath its bottom drawer.",
      },
      solo,
      Date.now(),
      confirmed,
    );

    state = completeInvestigations(state, solo);
    const view = fieldView(state, confirmed, solo, "p1");

    expect(view.stage).toBe("fracture");
    expect(view.prompt).toContain("SURVEY RECORDS");
    expect(view.prompt).toContain("SIGNAL RECORDS");
    expect(view.prompt).toContain("EXCHANGE RECORDS");
    expect(view.prompt).toContain("The dresser has a deep scratch beneath its bottom drawer.");
    expect(view.prompt).toContain("SUPPORT");
    expect(view.prompt).toContain("CONTRADICT");
    expect(view.prompt).toContain("FAIL TO ESTABLISH");
    expect(view.prompt).toContain("not automatically contradictions");
  });

  it("never includes unconfirmed objects in its world", () => {
    expect(confirmed.map(o => o.id)).toEqual(["dresser", "lamp"]);
    expect(JSON.stringify(fieldView(startFieldExpedition("ABCD"), confirmed, players, "p1")))
      .not.toContain("Bookshelf");
  });

  it("requires one opening observation from each multiplayer participant", () => {
    const initial = startFieldExpedition("ABCD");
    const one = submitFieldObservation(initial, {
      playerId: "p1", object: confirmed[0]!, observation: "The dresser has three drawers.",
    }, players, Date.now(), confirmed);

    expect(one.stage).toBe("survey");
    expect(() => submitFieldObservation(one, {
      playerId: "p1", object: confirmed[0]!, observation: "A second description of the dresser.",
    }, players, Date.now(), confirmed)).toThrow("already_submitted");

    const two = submitFieldObservation(one, {
      playerId: "p2", object: confirmed[1]!, observation: "The lamp base has a visible scratch.",
    }, players, Date.now(), confirmed);

    expect(two.stage).toBe("signal");
    expect(two.records).toHaveLength(2);
    expect(two.puzzle).toBeNull();

    const finished = completeInvestigations(two);
    expect(finished.records).toHaveLength(6);
    expect(finished.puzzle?.choices.length).toBeGreaterThanOrEqual(2);
  });

  it("allows solo play without inventing teammates", () => {
    let state = submitFieldObservation(startFieldExpedition("SOLO"), {
      playerId: "p1", object: confirmed[0]!,
      observation: "The dresser has a visible mark along the bottom drawer.",
    }, players.slice(0, 1), Date.now(), confirmed);

    state = completeInvestigations(state, players.slice(0, 1));
    expect(state.records).toHaveLength(3);
    expect(state.puzzle?.choices.length).toBeGreaterThanOrEqual(2);

    const solved = answerFieldPuzzle(state, "p1", state.puzzle!.answerId, state.mystery!.solution.decisiveClueIds);
    expect(solved.correct).toBe(true);
    expect(solved.state.stage).toBe("verdict");

    const finished = voteFieldEnding(solved.state, "p1", "erase", players.slice(0, 1));
    expect(finished.stage).toBe("complete");
    expect(finished.ending).toBe("erase");
  });

  it("rejects an observation of the wrong assigned object", () => {
    const state = submitFieldObservation(startFieldExpedition("SOLO"), {
      playerId: "p1", object: confirmed[0]!,
      observation: "A genuine physical detail on the dresser.",
    }, players.slice(0, 1), Date.now(), confirmed);

    expect(state.stage).toBe("signal");
    const target = fieldView(state, confirmed, players.slice(0, 1), "p1").target!;
    const wrong = confirmed.find(object => object.id !== target.id)!;

    expect(() => submitFieldObservation(state, {
      playerId: "p1",
      object: wrong,
      observation: "I inspected this real object, but it was not the assigned target.",
    }, players.slice(0, 1), Date.now(), confirmed)).toThrow("wrong_directive_object");
  });

  it("does not allow duplicate votes and resolves shared decisions", () => {
    let state = startFieldExpedition("VOTE");
    state = submitFieldObservation(state, {
      playerId: "p1", object: confirmed[0]!,
      observation: "The dresser has a visible mark along the bottom drawer.",
    }, players, Date.now(), confirmed);
    state = submitFieldObservation(state, {
      playerId: "p2", object: confirmed[1]!,
      observation: "The lamp base has a visible scratch on one side.",
    }, players, Date.now(), confirmed);
    state = completeInvestigations(state);
    state = answerFieldPuzzle(state, "p1", state.puzzle!.answerId, state.mystery!.solution.decisiveClueIds).state;
    state = voteFieldEnding(state, "p1", "preserve", players);

    expect(state.stage).toBe("verdict");
    expect(() => voteFieldEnding(state, "p1", "erase", players)).toThrow("already_voted");

    state = voteFieldEnding(state, "p2", "preserve", players);
    expect(state.stage).toBe("complete");
    expect(state.ending).toBe("preserve");
  });

  it("lets the public display break a tied cooperative verdict", () => {
    let state = startFieldExpedition("TIE");
    state = submitFieldObservation(state, {
      playerId: "p1", object: confirmed[0]!,
      observation: "The dresser has a visible mark along the bottom drawer.",
    }, players, Date.now(), confirmed);
    state = submitFieldObservation(state, {
      playerId: "p2", object: confirmed[1]!,
      observation: "The lamp base has a visible scratch on one side.",
    }, players, Date.now(), confirmed);
    state = completeInvestigations(state);
    state = answerFieldPuzzle(state, "p1", state.puzzle!.answerId, state.mystery!.solution.decisiveClueIds).state;
    state = setFieldTvChoice(state, "erase");
    state = voteFieldEnding(state, "p1", "preserve", players);
    state = voteFieldEnding(state, "p2", "release", players);

    expect(state.stage).toBe("complete");
    expect(state.ending).toBe("erase");
  });

  it("scores the opening observation and creates a deduction from shared records", () => {
    let state = startFieldExpedition("SCORE");
    state = submitFieldObservation(state, {
      playerId: "p1", object: confirmed[0]!,
      observation: "The dresser has a visible mark along the bottom drawer.",
      action: "examine", imageKey: "field-photo.jpg", detail: "Model 1974",
    }, players, Date.now(), confirmed);
    state = submitFieldObservation(state, {
      playerId: "p2", object: confirmed[1]!,
      observation: "The lamp base has a visible scratch on one side.",
    }, players, Date.now(), confirmed);

    state = completeInvestigations(state);
    expect(state.puzzle?.choices.map(c => c.id)).toEqual(
      state.mystery?.suspects.map(suspect => suspect.id),
    );
    expect(state.puzzle?.prompt).toContain("VERIFIED CASE EVIDENCE:");
    expect(state.puzzle?.prompt).toContain("ROOM WITNESS RECORDS:");

    const solved = answerFieldPuzzle(state, "p1", state.puzzle!.answerId, state.mystery!.solution.decisiveClueIds);
    expect(solved.correct).toBe(true);
    expect(solved.state.stage).toBe("verdict");
    expect(solved.state.scoreEvents.some(event => event.points === 250)).toBe(true);
  });

  it("rewards exposing an accepted private deception", () => {
    let state = startFieldExpedition("ALLEG");
    state = answerFieldAllegiance(state, "p2", true, "deceive");
    const result = exposeFieldAllegiance(state, "p1", "p2");

    expect(result.exposed).toBe(true);
    expect(result.state.allegiances.p2?.exposed).toBe(true);
    expect(result.state.scoreEvents.at(-1)?.points).toBe(300);
  });

  it("rejects insufficient observations and unknown players", () => {
    const state = startFieldExpedition("ABCD");
    expect(() => submitFieldObservation(state, {
      playerId: "p1", object: confirmed[0]!, observation: "tiny",
    }, players)).toThrow("invalid_observation");

    expect(() => submitFieldObservation(state, {
      playerId: "stranger", object: confirmed[0]!,
      observation: "A real physical observation was made.",
    }, players)).toThrow("invalid_player");
  });
});
