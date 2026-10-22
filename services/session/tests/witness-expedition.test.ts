import { describe,it,expect } from 'vitest';
import { createWitness, tickWitness, recordWitnessPhoto, witnessAction, witnessView, pulseWitness, type WitnessState, type WitnessPhoto } from '../src/game/witnessExpedition.js';
const players=[{id:'a',name:'Ada'},{id:'b',name:'Ben'},{id:'c',name:'Cy'}];
const objects=[{id:'book',name:'Book',location:'desk'},{id:'box',name:'Box',location:'shelf'},{id:'cup',name:'Cup',location:'table'}];
const roster=(s:WitnessState)=>s.players.map(p=>p.id);
function photo(s:WitnessState,id:string,kind='acquisition',objectId=s.assignments[id]!.object.id,assessment:WitnessPhoto['assessment']='verified') {
  return {id:`${kind}-${id}-${s.evidence.length}`,key:`actual-${kind}-${id}.jpg`,kind,objectId,playerId:id,assessment,detail:'Visible object match; no historical action inferred.',at:1};
}
function acquired(count=3,devices=['tv1']) {
  const s=createWitness('ABCD',objects,players.slice(0,count),devices,0);
  for(const p of s.players)recordWitnessPhoto(s,p.id,photo(s,p.id),true,1);
  tickWitness(s,roster(s),2);expect(s.stage).toBe('locks');
  for(const p of s.players)witnessAction(s,p.id,'lock',s.assignments[p.id]!.lock,null,3);
  tickWitness(s,roster(s),4);return s;
}
function displaced(s:WitnessState) {
  const d=s.displacement!;expect(d.actor).not.toBe(d.owner);
  expect(s.assignments[d.actor]!.object.id).not.toBe(d.object.id);
  recordWitnessPhoto(s,d.actor,photo(s,d.actor,'hide',d.object.id),false,5);
  witnessAction(s,d.actor,'movement-claim','deny',null,6);
  recordWitnessPhoto(s,d.owner,photo(s,d.owner,'recover',d.object.id),false,7);
  tickWitness(s,roster(s),8);expect(s.stage).toBe('recruitment');return s;
}
function recruit(s:WitnessState,accept=true) {
  if(s.recruit){witnessAction(s,s.recruit.playerId,'recruit',accept,null,9);if(accept)witnessAction(s,s.recruit.playerId,'deceive',null,null,10);}
  tickWitness(s,roster(s),11);expect(s.stage).toBe('cooperation');return s;
}
function cooperate(s:WitnessState) {
  for(const p of s.players)witnessAction(s,p.id,'tune',s.players.length===1?s.assignments[p.id]!.lock.slice().reverse().join('-'):s.cooperation.fragments[p.id],null,12);
  for(const device of s.devices)pulseWitness(s,device,13);
  tickWitness(s,roster(s),14);expect(s.stage).toBe('confrontation');return s;
}
describe('connected Last Witness expedition',()=>{
  it('assigns three distinct calibrated objects and private channel locks',()=>{
    const s=createWitness('ABCD',objects,players,['tv'],0);
    expect(new Set(Object.values(s.assignments).map(a=>a.object.id)).size).toBe(3);
    expect(new Set(Object.values(s.assignments).map(a=>a.lock.join('-'))).size).toBe(3);
    expect(witnessView(s,'a').assignment!.object).toEqual(s.assignments.a!.object);
    expect(witnessView(s,null).assignment).toBeNull();
    expect(JSON.stringify(witnessView(s,'a'))).not.toContain('witnessIdentity');
  });
  it('caps verification at two real images, including rejected photos',()=>{
    const s=createWitness('ABCD',objects,players,['tv'],0);
    recordWitnessPhoto(s,'a',photo(s,'a','acquisition',s.assignments.a!.object.id,'rejected'),true,1);
    recordWitnessPhoto(s,'a',photo(s,'a','acquisition',s.assignments.a!.object.id,'rejected'),true,2);
    expect(()=>recordWitnessPhoto(s,'a',photo(s,'a'),true,3)).toThrow(/maximum two/);
    expect(s.assignments.a!.unavailable).toBe(true);expect(s.evidence).toHaveLength(2);
  });
  it('requires relocation and recovery images, roles, correct objects and independent attestation',()=>{
    const s=acquired();const d=s.displacement!;
    expect(()=>recordWitnessPhoto(s,d.owner,photo(s,d.owner,'hide',d.object.id),false)).toThrow(/assigned mover/);
    expect(()=>recordWitnessPhoto(s,d.actor,photo(s,d.actor,'hide','wrong'),false)).toThrow(/Wrong displacement/);
    displaced(s);expect(d.recovered).toBe(true);expect(d.corroborated).toBe(false);
    expect(s.evidence.filter(e=>e.kind!=='acquisition')).toHaveLength(2);
  });
  it.each([true,false])('accepts recruitment=%s without breaking the next encounter',accept=>{
    const s=recruit(displaced(acquired()),accept);
    expect(s.recruit!.accepted).toBe(accept);expect(!!s.recruit!.claim).toBe(accept);
    expect(witnessView(s,null).recruitment).toBeNull();
    expect(s.events.some(e=>e.kind==='warning')).toBe(true);
  });
  it('completes with actual evidence, true and false accusations, defence and consequential ending',()=>{
    const s=cooperate(recruit(displaced(acquired())));const recruitId=s.recruit!.playerId;
    const accuser=s.players.find(p=>p.id!==recruitId)!.id;
    const citation=s.events.find(e=>e.kind==='movement')!.id;
    witnessAction(s,accuser,'accuse',recruitId,citation,15);
    expect(s.accusations[accuser]!.correct).toBe(true);expect(s.recruit!.exposed).toBe(true);
    witnessAction(s,recruitId,'accuse',accuser,citation,16);
    // accuser is the owner in this roster; they did not publish a false claim.
    expect(s.accusations[recruitId]!.correct).toBe(false);expect(s.trust[recruitId]).toBe(35);
    const owned=s.evidence.find(e=>e.playerId===accuser)!;
    witnessAction(s,accuser,'reveal',null,owned.id,17);
    for(const p of s.players)witnessAction(s,p.id,'respond',p.id===accuser?'challenge':'defend',null,18);
    tickWitness(s,roster(s),19);expect(s.stage).toBe('decision');
    for(const p of s.players)witnessAction(s,p.id,'vote','release',null,20);
    tickWitness(s,roster(s),21);expect(s.stage).toBe('complete');
    expect(s.summary).toContain(s.displacement!.object.name);expect(s.summary).toContain('correctly identified');
    expect(s.summary).toContain('false accusation');expect(s.summary).toContain('restored');expect(s.summary).not.toContain('fictional witness');
  });
  it.each([1,2])('requires pulses from %s TV configuration, after every private Lens interaction',count=>{
    const s=recruit(displaced(acquired(3,['tv1','tv2'].slice(0,count))));
    expect(()=>pulseWitness(s,'tv1',10)).toThrow(/Every Lens/);
    for(const p of s.players)witnessAction(s,p.id,'tune',s.cooperation.fragments[p.id],null,11);
    pulseWitness(s,'tv1',12);expect(s.cooperation.solved).toBe(count===1);
    if(count===2){pulseWitness(s,'tv2',13013);expect(s.cooperation.solved).toBe(false);pulseWitness(s,'tv1',13014);expect(s.cooperation.solved).toBe(true);}
  });
  it('reaches a solo ending without hiding, recruitment or another Lens',()=>{
    const s=acquired(1);expect(s.displacement).toBeNull();
    witnessAction(s,'a','solo-baseline',s.assignments.a!.object.location,s.evidence[0]!.id,5);tickWitness(s,roster(s),5);tickWitness(s,roster(s),6);expect(s.stage).toBe('cooperation');expect(s.recruit).toBeNull();
    cooperate(s);witnessAction(s,'a','reveal',null,s.evidence[0]!.id,15);witnessAction(s,'a','respond','challenge',null,16);
    tickWitness(s,roster(s),17);witnessAction(s,'a','vote','release',null,18);tickWitness(s,roster(s),19);
    expect(s.stage).toBe('complete');expect(s.summary).toContain('Book');
  });
  it('records unavailable AI honestly and never infers physical success from missing evidence',()=>{
    const s=createWitness('ABCD',objects,players,['tv'],0);
    recordWitnessPhoto(s,'a',photo(s,'a','acquisition',s.assignments.a!.object.id,'unverified'),true,1);
    expect(s.assignments.a!.acquired).toBe(true);expect(s.evidence[0]!.assessment).toBe('unverified');
    for(let n=0;n<10&&s.stage!=='complete';n++)tickWitness(s,[],s.deadline+1);
    expect(s.stage).toBe('complete');expect(s.summary).toContain('unverified');expect(s.summary).toContain('not moved');
    expect(s.cooperation.solved).toBe(false);
  });
  it('handles missing calibrated objects, departures and incomplete actions with bounded progression',()=>{
    const s=createWitness('ABCD',[],players,['tv'],0);
    for(let n=0;n<10&&s.stage!=='complete';n++)tickWitness(s,['a'],s.deadline+1);
    expect(s.stage).toBe('complete');expect(s.evidence).toHaveLength(0);expect(s.summary).toContain('no movement was invented');
  });
  it('does not disclose private photos, recruitment or other channel solutions to public displays',()=>{
    const s=recruit(displaced(acquired()));
    const tv=witnessView(s,null,'tv1');expect(tv.assignment).toBeNull();expect(tv.recruitment).toBeNull();expect(tv.evidence).toEqual([]);
    const nonRecruit=s.players.find(p=>p.id!==s.recruit!.playerId)!;
    expect(witnessView(s,nonRecruit.id).events.some(e=>e.kind==='recruitment')).toBe(false);
  });
  it('uses a calibrated context observer as the fallback mover without fabricating another object',()=>{
    const s=createWitness('ABCD',[objects[0]!],players,['tv'],0);
    for(const p of s.players)recordWitnessPhoto(s,p.id,photo(s,p.id),true,1);
    tickWitness(s,roster(s),2);
    for(const p of s.players)witnessAction(s,p.id,'lock',s.assignments[p.id]!.lock,null,3);
    tickWitness(s,roster(s),4);
    expect(s.displacement).not.toBeNull();
    expect(s.assignments[s.displacement!.owner]!.support).toBe(false);
    expect(s.assignments[s.displacement!.actor]!.support).toBe(true);
    expect(s.displacement!.object.id).toBe(objects[0]!.id);
    expect(new Set(Object.values(s.assignments).map(a=>a.object.id)).size).toBe(1);
  });
  it('allows challenging the Architect when recruitment was refused',()=>{
    const s=cooperate(recruit(displaced(acquired()),false));
    expect(s.architectLie).toBeTruthy();
    const claim=s.events.find(e=>e.kind==='claim'&&e.playerId===null)!;
    witnessAction(s,'a','accuse','architect',claim.id,15);
    expect(s.accusations.a!.correct).toBe(true);
  });

  it('builds different actionable locks from verified color, shape and exact printed markings',()=>{
    const s=createWitness('ABCD',objects,players,['tv'],0);
    const features=[{color:'RED'},{shape:'CYLINDRICAL'},{marking:'THE ACTUAL LABEL'}];
    s.players.forEach((p,i)=>recordWitnessPhoto(s,p.id,{...photo(s,p.id),features:features[i]!},true,1));
    tickWitness(s,roster(s),2);
    expect(s.assignments.a!.visualLock!.kind).toBe('color');expect(s.assignments.b!.visualLock!.kind).toBe('shape');expect(s.assignments.c!.visualLock!.kind).toBe('marking');
    expect(witnessView(s,'a').assignment!.visualLock!.prompt).toContain('dominant visible color');
    expect(witnessAction(s,'a','lock',['BLUE'],null,3)).toContain('rejected');
    expect(witnessAction(s,'a','lock',['RED'],null,4)).toContain('UNLOCKED');
    witnessAction(s,'b','lock',['CYLINDRICAL'],null,5);witnessAction(s,'c','lock',['THE','ACTUAL','LABEL'],null,6);
    tickWitness(s,roster(s),7);expect(s.stage).toBe('displacement');
  });
  it('never creates a visual lock from unverified photo features',()=>{
    const s=createWitness('ABCD',objects,players,['tv'],0);
    recordWitnessPhoto(s,'a',{...photo(s,'a','acquisition',s.assignments.a!.object.id,'unverified'),features:{color:'RED'}},true,1);
    expect(s.assignments.a!.visualLock).toBeUndefined();
  });

});
