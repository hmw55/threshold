import { describe, expect, it } from "vitest";
import { incidentFragments, fragmentForPlayer } from "../src/game/environmentalCase.js";
import { startFieldExpedition, initializeWitnessIdentity, fieldView, answerFieldPuzzle, type FieldRecord } from "../src/game/fieldExpedition.js";

const objects = [{id:"basket",name:"Basket",location:"Hallway"},{id:"lamp",name:"Lamp",location:"Den"}];
const players = [{id:"a",name:"Alex"},{id:"b",name:"Blake"}];
const record = (id:string, stage:FieldRecord["stage"], action:FieldRecord["action"]):FieldRecord => ({
  id, stage, playerId:"a",objectId:"basket",objectName:"Basket",observation:"I moved the basket near the doorway",imageKey:"evidence.jpg",createdAt:1,action,detail:null,
});

describe("environmental mystery",()=>{
  it("anchors the incident to confirmed room objects and preserves the truth",()=>{
    const initial=startFieldExpedition("ABC123");
    const created=initializeWitnessIdentity(initial,objects,players);
    expect(created.witnessIdentity?.anchorObjectId).toMatch(/basket|lamp/);
    expect(initializeWitnessIdentity(created,[{id:"different",name:"Other",location:"Elsewhere"}],players).witnessIdentity).toEqual(created.witnessIdentity);
  });
  it("does not assign a human witness in solo mode",()=>{
    for(const code of ["ABC123","QWERTY","TEST44","SOLO42"]){
      const state=initializeWitnessIdentity(startFieldExpedition(code),objects,[players[0]!]);
      expect(state.witnessIdentity?.kind).not.toBe("player");
    }
  });
  it("creates distinct, environment-specific fictional clue fragments",()=>{
    const anchor={name:"Basket",location:"Hallway"};
    const a=incidentFragments("player",anchor);
    const b=incidentFragments("architect",anchor);
    expect(a.fragments).not.toEqual(b.fragments);
    expect(fragmentForPlayer("unknown_witness", anchor, 0, 1)).toContain(
      "reconstructed",
    );
  });
  it("does not leak the witness answer to a non-witness in the initial view",()=>{
    const state=initializeWitnessIdentity(startFieldExpedition("ABC123"),objects,players);
    const viewer=state.witnessIdentity?.playerId === "a" ? "b" : "a";
    const view=fieldView(state,objects,players,viewer);
    expect(view.witnessCase?.resolvedIdentity).toBeNull();
    expect(view.puzzle).toBeNull();
  });
  it("uses real recorded actions for reconstruction rather than the hidden identity",()=>{
    const base=initializeWitnessIdentity(startFieldExpedition("ABC123"),objects,players);
    const records=[record("r1","survey","observe"),record("r2","signal","move"),record("r3","exchange","examine")];
    // A synthetic solved encounter can be tested independently of network/session persistence.
    const state={...base,stage:"fracture" as const,records,puzzle:{id:"reconstruction",prompt:"Find the action",choices:[{id:"r1",label:"OBSERVE"},{id:"r2",label:"MOVE"}],answerId:"r2",solvedBy:[]}};
    expect(answerFieldPuzzle(state,"a","r1",["r1"]).correct).toBe(false);
    const result=answerFieldPuzzle(state,"a","r2",["r2"]);
    expect(result.correct).toBe(true);
    expect(result.state.stage).toBe("verdict");
  });
});
