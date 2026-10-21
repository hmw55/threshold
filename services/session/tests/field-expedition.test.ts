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

describe("physical reality first director", () => {

  it("rejects an unsupported accusation without advancing or awarding points", () => {
    let state = startFieldExpedition("test-unsupported", players.slice(0, 1), confirmed);

    state = submitFieldObservation(state, {
      playerId: "p1",
      object: confirmed[0]!,
      observation: "The lamp has a scratch along its base.",
    }, players.slice(0, 1), Date.now(), confirmed);

    expect(state.stage).toBe("fracture");

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

    expect(two.stage).toBe("fracture");
    expect(two.records).toHaveLength(2);
    expect(two.puzzle?.choices.length).toBeGreaterThanOrEqual(2);
  });

  it("allows solo play without inventing teammates", () => {
    const state = submitFieldObservation(startFieldExpedition("SOLO"), {
      playerId: "p1", object: confirmed[0]!,
      observation: "The dresser has a visible mark along the bottom drawer.",
    }, players.slice(0, 1), Date.now(), confirmed);

    expect(state.stage).toBe("fracture");
    expect(state.records).toHaveLength(1);
    expect(state.puzzle?.choices.length).toBeGreaterThanOrEqual(2);

    const solved = answerFieldPuzzle(state, "p1", state.puzzle!.answerId, state.mystery!.solution.decisiveClueIds);
    expect(solved.correct).toBe(true);
    expect(solved.state.stage).toBe("verdict");

    const finished = voteFieldEnding(solved.state, "p1", "erase", players.slice(0, 1));
    expect(finished.stage).toBe("complete");
    expect(finished.ending).toBe("erase");
  });

  it("rejects a second observation after the opening stage", () => {
    const state = submitFieldObservation(startFieldExpedition("SOLO"), {
      playerId: "p1", object: confirmed[0]!,
      observation: "A genuine physical detail on the dresser.",
    }, players.slice(0, 1), Date.now(), confirmed);

    expect(() => submitFieldObservation(state, {
      playerId: "p1", object: confirmed[1]!,
      observation: "Another genuine physical detail on the lamp.",
    }, players.slice(0, 1), Date.now(), confirmed)).toThrow("observation_unavailable");
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

    expect(state.stage).toBe("fracture");
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
