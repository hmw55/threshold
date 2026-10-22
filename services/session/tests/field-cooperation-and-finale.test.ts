import {describe,expect,it} from "vitest";
import {initializeCooperation,startFieldExpedition,submitCooperation,voteFieldEnding,answerFieldAllegiance,fieldView,type FieldState} from "../src/game/fieldExpedition.js";
const players=[{id:"a",name:"A"},{id:"b",name:"B"},{id:"c",name:"C"}];
const objects=[{id:"fan",name:"Fan",location:"Bedroom"},{id:"desk",name:"Desk",location:"Bedroom"}];
describe("shared signal and consequential finale",()=>{
  it("keeps each witness fragment private and requires the combined code",()=>{
    const state=initializeCooperation({...startFieldExpedition("ROOM42"),stage:"signal"},objects,players);
    const a=fieldView(state,objects,players,"a");
    expect(a.cooperation?.fragment).toBe(state.cooperation?.fragments.a);
    expect(JSON.stringify(a.cooperation)).not.toContain(state.cooperation?.fragments.b === state.cooperation?.fragments.a ? "__unmatchable__" : '"fragments"');
    const wrong=submitCooperation(state,"a","ZZZ",players);
    expect(wrong.correct).toBe(false);
    const code=players.map(p=>state.cooperation!.fragments[p.id]).join("");
    const correct=submitCooperation(wrong.state,"b",code,players);
    expect(correct.correct).toBe(true);
    expect(correct.state.cooperation?.solvedBy).toBe("b");
  });
  it("explains a three-way split based on earlier refusal",()=>{
    let state:FieldState={...startFieldExpedition("VOTE42"),stage:"verdict"};
    state=answerFieldAllegiance(state,"a",false);
    state=voteFieldEnding(state,"a","preserve",players);
    state=voteFieldEnding(state,"b","release",players);
    state=voteFieldEnding(state,"c","erase",players);
    expect(state.stage).toBe("complete");
    expect(state.ending).toBe("erase");
    expect(state.voteResolution).toContain("SPLIT VOTE");
  });
});
