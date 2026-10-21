import { describe, expect, it } from "vitest";
import { answerFieldAllegiance, answerFieldPuzzle, confirmedObjects, exposeFieldAllegiance, fieldView, startFieldExpedition, submitFieldObservation, voteFieldEnding, setFieldTvChoice } from "../src/game/fieldExpedition.js";
const players = [{id:"p1",name:"One"},{id:"p2",name:"Two"}];
const objects = [{id:"dresser",name:"Dresser",location:"Bedroom",recognitionStatus:"confirmed"},
  {id:"unknown",name:"Bookshelf",location:"Bedroom",recognitionStatus:"proposed"}];
const confirmed = confirmedObjects(objects);
describe("physical reality first director", () => {
  it("never includes unconfirmed objects in its world", () => {
    expect(confirmed).toEqual([{id:"dresser",name:"Dresser",location:"Bedroom"}]);
    expect(JSON.stringify(fieldView(startFieldExpedition("ABCD"),confirmed,players,"p1"))).not.toContain("Bookshelf");
  });
  it("requires independent multiplayer contributions to advance", () => {
    const state = startFieldExpedition("ABCD");
    const one = submitFieldObservation(state,{playerId:"p1",object:confirmed[0]!,observation:"The dresser has three drawers."},players);
    expect(one.stage).toBe("survey");
    expect(() => submitFieldObservation(one,{playerId:"p1",object:confirmed[0]!,observation:"A second description of dresser."},players)).toThrow("already_submitted");
    const two = submitFieldObservation(one,{playerId:"p2",object:confirmed[0]!,observation:"The bottom drawer is darker."},players);
    expect(two.stage).toBe("signal");
    expect(two.records).toHaveLength(2);
  });
  it("allows solo progress without fabricated teammates", () => {
    let state = startFieldExpedition("ABCD");
    for (let i=0;i<4;i++) state = submitFieldObservation(state,{playerId:"p1",object:confirmed[0]!,observation:"I observed a genuine physical detail."},players.slice(0,1));
    expect(state.stage).toBe("verdict");
    state = voteFieldEnding(state,"p1","erase",players.slice(0,1));
    expect(state.stage).toBe("complete");
    expect(state.ending).toBe("erase");
  });
  it("does not allow duplicate votes and resolves shared decisions", () => {
    let state = startFieldExpedition("ABCD");
    for (let i=0;i<4;i++) for (const p of players) state = submitFieldObservation(state,{playerId:p.id,object:confirmed[0]!,observation:"This was actually observed in the room."},players);
    state = voteFieldEnding(state,"p1","preserve",players);
    expect(state.stage).toBe("verdict");
    expect(() => voteFieldEnding(state,"p1","erase",players)).toThrow("already_voted");
    state = voteFieldEnding(state,"p2","preserve",players);
    expect(state.ending).toBe("preserve");
  });
  it("lets the public display break a tied cooperative verdict", () => {
    let state = startFieldExpedition("ABCD");
    for (let i=0;i<4;i++) for (const p of players) state = submitFieldObservation(state,{playerId:p.id,object:confirmed[0]!,observation:"This was actually observed in the room."},players);
    state = setFieldTvChoice(state, "erase");
    state = voteFieldEnding(state,"p1","preserve",players);
    state = voteFieldEnding(state,"p2","release",players);
    expect(state.stage).toBe("complete");
    expect(state.ending).toBe("erase");
  });
  it("scores physical actions and creates a deduction from shared records", () => {
    let state = startFieldExpedition("ABCD");
    for (let stage = 0; stage < 3; stage++) {
      for (const p of players) {
        state = submitFieldObservation(state, {
          playerId: p.id,
          object: confirmed[0]!,
          observation: `A grounded report for stage ${stage} from the room.`,
          action: stage === 1 ? "examine" : "observe",
          imageKey: stage === 1 ? "field-photo.jpg" : null,
          detail: stage === 1 ? "Model 1974" : null,
        }, players);
      }
    }
    expect(state.stage).toBe("fracture");
    expect(state.puzzle?.choices[0]?.id).toBe("dresser");
    const solved = answerFieldPuzzle(state, "p1", "dresser");
    expect(solved.correct).toBe(true);
    expect(solved.state.scoreEvents.some(event => event.points === 250)).toBe(true);
  });
  it("rewards exposing an accepted private deception", () => {
    let state = startFieldExpedition("ABCD");
    state = answerFieldAllegiance(state, "p2", true, "deceive");
    const result = exposeFieldAllegiance(state, "p1", "p2");
    expect(result.exposed).toBe(true);
    expect(result.state.allegiances.p2?.exposed).toBe(true);
    expect(result.state.scoreEvents.at(-1)?.points).toBe(300);
  });
  it("rejects insufficient observation and unknown player", () => {
    const state = startFieldExpedition("ABCD");
    expect(() => submitFieldObservation(state,{playerId:"p1",object:confirmed[0]!,observation:"tiny"},players)).toThrow("invalid_observation");
    expect(() => submitFieldObservation(state,{playerId:"stranger",object:confirmed[0]!,observation:"A real observation was made."},players)).toThrow("invalid_player");
  });
});
