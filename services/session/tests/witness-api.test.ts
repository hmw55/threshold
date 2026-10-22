import { beforeEach,describe,it,expect } from 'vitest';
import request from 'supertest';
import { app,resetSessionsForTesting } from '../src/app.js';
import { loadGameState,saveGameState } from '../src/sessionStore.js';
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==','base64');
async function setup(count=3,tvs=1) {
  const created=await request(app).post('/sessions').send({deviceId:'tv1'}).expect(201);
  const code=created.body.code as string;const thresholdId=created.body.thresholds[0].id;
  if(tvs===2)await request(app).post(`/sessions/${code}/thresholds`).send({deviceId:'tv2'}).expect(201);
  const players:Array<{id:string;token:string}>=[];
  for(const name of ['Ada','Ben','Cy'].slice(0,count)){
    const join=await request(app).post(`/sessions/${code}/join`).send({name}).expect(201);
    players.push({id:join.body.player.id as string,token:join.body.playerToken as string});
  }
  const p=players[0]!;const credentials={playerId:p.id,playerToken:p.token};
  const advanceAll=async()=>{await request(app).post(`/sessions/${code}/advance`).send({deviceId:'tv1'}).expect(200);};
  await advanceAll();
  const group=await request(app).post(`/sessions/${code}/scan-groups`).send({...credentials,thresholdId,label:'Test room'}).expect(201);
  await request(app).post(`/sessions/${code}/scan-groups/${group.body.group.id}/images`).set('x-player-id',p.id).set('authorization',`Bearer ${p.token}`).attach('image',image,{filename:'room.png',contentType:'image/png'}).expect(201);
  // Explicit human confirmations via the existing calibration UI/API: no model-generated test objects.
  for(const name of ['Book','Box','Cup'])await request(app).post(`/sessions/${code}/environment/objects`).send({...credentials,scanGroupId:group.body.group.id,name}).expect(201);
  await request(app).post(`/sessions/${code}/scan-groups/${group.body.group.id}/finalize`).send(credentials).expect(200);
  await advanceAll();
  await advanceAll();
  const path=`/sessions/${code}/witness`;
  const headers=(p:{id:string;token:string})=>({'x-player-id':p.id,authorization:`Bearer ${p.token}`});
  const get=(p=players[0]!)=>request(app).get(path).set(headers(p));
  const action=(p:typeof players[number],type:string,value?:unknown,evidenceId?:string)=>request(app).post(`${path}/action`).set(headers(p)).send({type,value,evidenceId});
  const upload=(p:typeof players[number],kind:string,objectId:string,variant=0)=>request(app).post(`${path}/photo`).set(headers(p)).field('kind',kind).field('objectId',objectId).field('portable','true').attach('image',Buffer.concat([image,Buffer.from([variant])]),{filename:'actual-test.png',contentType:'image/png'});
  return {code,players,path,get,action,upload,headers};
}
describe('authenticated connected expedition API',()=>{
  beforeEach(()=>resetSessionsForTesting());
  it('keeps the entire three-player path reachable with working photo/action routes and a TV pulse',async()=>{
    const h=await setup();const ids=[];
    await request(app).get(h.path).expect(401);
    for(const p of h.players){const v=(await h.get(p).expect(200)).body;ids.push(v.assignment.object.id);
      await request(app).post(`${h.path}/photo`).set(h.headers(p)).field('kind','acquisition').field('objectId',v.assignment.object.id).expect(400);
      const result=await h.upload(p,'acquisition',v.assignment.object.id).expect(200);expect(result.body.feedback).toContain('unverified');}
    expect(new Set(ids).size).toBe(3);
    const state=loadGameState(h.code)!.witness!;expect(state.stage).toBe('locks');
    for(const p of h.players)await h.action(p,'lock',state.assignments[p.id]!.lock).expect(200);
    const d=loadGameState(h.code)!.witness!.displacement!;expect(d).toBeTruthy();
    const actor=h.players.find(p=>p.id===d.actor)!;const owner=h.players.find(p=>p.id===d.owner)!;
    const other=h.players.find(p=>p.id!==d.actor&&p.id!==d.owner)!;
    await h.upload(owner,'hide',d.object.id).expect(409);
    await h.upload(actor,'hide',d.object.id).expect(409); // Exact original image cannot be reused as proof of relocation.
    await h.upload(actor,'hide',d.object.id,1).expect(200);
    await h.action(actor,'movement-claim','deny').expect(200);
    const hidden=loadGameState(h.code)!.witness!.evidence.find(e=>e.kind==='hide')!;
    await request(app).get(`${h.path}/evidence/${hidden.id}`).set(h.headers(other)).expect(403);
    await h.upload(owner,'recover',d.object.id,2).expect(200);
    await h.action(other,'recruit',true).expect(200);
    await h.action(other,'deceive').expect(200);
    const tv=await request(app).get(`/sessions/${h.code}/threshold/game`).set('x-device-id','tv1').expect(200);
    expect(tv.body.fieldEncounter.transmission).toContain('DECEIT DETECTED');expect(tv.body.fieldEncounter.recruitment).toBeNull();
    const coop=loadGameState(h.code)!.witness!.cooperation;
    for(const p of h.players)await h.action(p,'tune',coop.fragments[p.id]).expect(200);
    const pulse=await request(app).post(`/sessions/${h.code}/threshold/witness/pulse`).set('x-device-id','tv1').expect(200);
    expect(pulse.body.accepted).toBe(true);
    expect(pulse.body.pulseAccepted).toBe(true);
    expect(pulse.body.fieldEncounter).toBeTruthy();
    expect(pulse.body.game.timelinePhase).toBe('investigation');
    const publicClaim=(await h.get().expect(200)).body.publicLedger.find((e:{kind:string})=>e.kind==='claim');
    await h.action(owner,'accuse',other.id,publicClaim.id).expect(200);
    await h.action(actor,'reveal',undefined,hidden.id).expect(200);
    await request(app).get(`${h.path}/evidence/${hidden.id}`).set(h.headers(owner)).expect(200);
    for(const p of h.players)await h.action(p,'respond',p.id===actor.id?'corroborate':'challenge').expect(200);
    for(const p of h.players)await h.action(p,'vote','release').expect(200);
    const ending=(await h.get().expect(200)).body;
    expect(ending.stage).toBe('complete');expect(ending.summary).toContain(d.object.name);expect(ending.summary).toContain('correctly identified');
    expect(ending.summary).toContain('unverified');expect(ending.puzzle).toBeUndefined();
    await request(app).get(`/sessions/${h.code}/game/reconstruction`).set(h.headers(owner)).expect(410);
    expect((await request(app).get(`/sessions/${h.code}/threshold/game`).set('x-device-id','tv1')).body.fieldEncounter.stage).toBe('complete');
    await h.action(owner,'vote','erase').expect(409);
  });
  it('enforces the photo cap before vision/storage and persists incomplete expeditions',async()=>{
    const h=await setup(1);const p=h.players[0]!;const view=(await h.get()).body;
    const game=loadGameState(h.code)!;game.witness!.assignments[p.id]!.photos=2;saveGameState(game);
    await h.upload(p,'acquisition',view.assignment.object.id).expect(409);
    for(let i=0;i<8;i++){const g=loadGameState(h.code)!;g.witness!.deadline=Date.now()-1;saveGameState(g);await h.get().expect(200);}
    const end=(await h.get()).body;expect(end.stage).toBe('complete');expect(end.summary).toContain('missing evidence');
    expect(loadGameState(h.code)!.witness!.evidence).toHaveLength(0);
  });
});
