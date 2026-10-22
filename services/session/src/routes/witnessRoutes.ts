import { assessWitnessImage } from '../architect/witnessVision.js';
import type { Express, Request, Response } from 'express';
import type { RouteContext } from '../app.js';
import { createWitness, tickWitness, witnessAction, witnessView, recordWitnessPhoto, pulseWitness, type WitnessPhoto } from '../game/witnessExpedition.js';
import { readImage } from '../imageStorage.js';

/** One persisted authority for both clients. Requests reload after async vision/storage to avoid lost updates. */
export function registerWitnessRoutes(app:Express, ctx:RouteContext) {
  const locks=new Set<string>();
  const narrating=new Set<string>();
  const narrated=new Set<string>();
  function narrate(code:string,stage:string) {
    if(process.env.NODE_ENV==='test'||process.env.THRESHOLD_ARCHITECT_MODE==='offline')return;
    const key=`${code}:${stage}`;
    const game=ctx.loadGameState(code);
    if(!game?.witness||narrating.has(key)||narrated.has(key)||game.witness.events.some(e=>e.kind===`narration-${stage}`))return;
    narrating.add(key);narrated.add(key);
    // Narrative cannot change assignments, objective validation, scores or ground truth.
    void (async()=>{
      try {
        const provider=ctx.createAiProvider({provider:process.env.THRESHOLD_AI_PROVIDER??'gemini',geminiTimeoutMs:4000,ollamaTimeoutMs:4000});
        const publicFacts=game.witness!.events.filter(e=>e.privateTo===null&&e.kind!=='ending').slice(-8).map(e=>e.text);
        const result=await provider.generate({systemPrompt:'You are the Architect, a tense fictional game director. Write at most two short sentences reacting to the supplied ledger. Do not claim photographic perception, invent objects, markings, past events, tasks, solutions or deadlines. Do not identify a deceiver. Player claims may be false: describe them as claims. Keep the existing objective unchanged.',userPrompt:JSON.stringify({stage,ledger:publicFacts}),maxOutputTokens:150});
        const fresh=ctx.loadGameState(code);
        if(fresh?.witness?.stage===stage){fresh.witness.events.push({id:ctx.randomUUID(),at:Date.now(),kind:`narration-${stage}`,text:result.text.slice(0,500),playerId:null,privateTo:null});fresh.witness.revision++;ctx.saveGameState(fresh);}
      }catch{ /* Deterministic direction remains available. */ }
      finally{narrating.delete(key);}
    })();
  }
  function context(code:string) {
    const session=ctx.getSession(code);if(!session)return null;
    const game=ctx.loadGameState(code);if(!game)return null;
    const objects=session.environmentId?ctx.confirmedObjects(ctx.listEnvironmentObjectsForSession(session.environmentId,code)):[];
    game.witness??=createWitness(code,objects,session.players,session.thresholds.map(t=>t.deviceId));
    game.witness.trust??=Object.fromEntries(game.witness.players.map(p=>[p.id,100]));
    if(game.witness.stage==='acquisition'&&objects.length) {
      const latest=createWitness(code,objects,game.witness.players,game.witness.devices,game.witness.startedAt);
      for(const p of game.witness.players) {
        const prior=game.witness.assignments[p.id];const available=latest.assignments[p.id];
        if(available&&(!prior||(prior.support&&!prior.photos&&!available.support)))game.witness.assignments[p.id]=available;
      }
    }
    tickWitness(game.witness,session.players.map(p=>p.id));
    game.timelinePhase=game.witness.stage==='complete'?'ending':game.witness.stage==='decision'?'resolution':'investigation';
    game.players=game.witness.players.map(p=>({playerId:p.id,score:game.witness!.scores[p.id]??0,completedMissionIds:[]}));
    ctx.saveGameState(game);
    if(game.witness.stage!=='complete')narrate(code,game.witness.stage);
    return {session,game,state:game.witness};
  }
  function auth(req:Request,res:Response,tv=false) {
    const code=String(req.params.code);const session=ctx.getSession(code);
    if(!session){res.status(404).json({error:'session_not_found'});return null;}
    const id=tv?req.header('x-device-id'):req.header('x-player-id');
    const valid=tv?session.thresholds.some(t=>t.deviceId===id):ctx.authenticateExpeditionPlayer(session,id,req.header('authorization')?.replace(/^Bearer\s+/i,''));
    if(!id||!valid){res.status(401).json({error:'invalid_credentials'});return null;}
    if(!['playing','results'].includes(session.phase)){res.status(409).json({error:'Expedition has not started.'});return null;}
    const c=context(code);if(!c){res.status(409).json({error:'game_not_initialized'});return null;}
    return {...c,id,code};
  }
  function view(c:NonNullable<ReturnType<typeof auth>>,tv=false) {
    const v=witnessView(c.state,tv?null:c.id,tv?c.id:undefined);
    return {...v,evidence:v.evidence.map(e=>({...e,key:undefined,url:e.url.replace('EVIDENCE_CODE',c.code)}))};
  }
  function tvPayload(c:NonNullable<ReturnType<typeof auth>>) {
    const field=view(c,true);
    return {fieldEncounter:field,scores:c.state.stage==='complete'?c.game.players:[],events:c.state.events.filter(e=>e.privateTo===null).slice(-20).map(e=>({...e,message:e.text,type:e.kind==='warning'?'warning':'transmission',createdAt:e.at})),
      playerNames:Object.fromEntries(c.state.players.map(p=>[p.id,p.name])),terminalChallenge:null,
      game:{phase:'investigation',timelinePhase:c.game.timelinePhase,completedObjectives:[],completedInteractions:[],discoveredEvidence:[],ending:null},adventure:{id:'last-witness',title:'THE LAST WITNESS',objectives:[]}};
  }
  // Retired quizzes cannot mutate or distract an expedition using the new director.
  app.use('/sessions/:code', (req,res,next)=>{
    if(ctx.loadGameState(String(req.params.code))?.witness&&/^\/(game\/(reconstruction|revelation|contradiction|resolution)|field(?:\/|$))/.test(req.path)) {
      res.status(410).json({error:'This expedition uses the evidence confrontation. Continue at /witness.'});return;
    }
    next();
  });
  app.get('/sessions/:code/witness',(req,res)=>{const c=auth(req,res);if(c)res.json(view(c));});
  app.post('/sessions/:code/witness/action',(req,res)=>{
    const c=auth(req,res);if(!c)return;
    try {
      const feedback=witnessAction(c.state,c.id,req.body?.type,req.body?.value,req.body?.evidenceId);
      tickWitness(c.state,c.session.players.map(p=>p.id));ctx.saveGameState(c.game);
      res.json({feedback,view:view(c)});
    } catch(e){res.status(409).json({error:e instanceof Error?e.message:'Action failed.'});}
  });
  app.post('/sessions/:code/witness/photo',ctx.evidenceImageUpload,async(req,res)=>{
    const c=auth(req,res);if(!c)return;
    const lock=`${c.code}:${c.id}`;
    if(locks.has(lock)){res.status(409).json({error:'An image is already being processed.'});return;}
    const kind=req.body?.kind;const objectId=req.body?.objectId;
    const a=c.state.assignments[c.id];const d=c.state.displacement;
    const object=kind==='acquisition'?a?.object:c.state.assignments[d?.owner??'']?.object;
    if(!['acquisition','hide','recover'].includes(kind)||!object||typeof objectId!=='string') {res.status(400).json({error:'Invalid photo task.'});return;}
    // Reject before invoking paid vision or saving bytes.
    if(kind==='acquisition'&&(c.state.stage!=='acquisition'||!a||a.photos>=2||a.acquired||a.unavailable||objectId!==a.object.id)) {res.status(409).json({error:'Verification closed or wrong assigned object. Maximum two images.'});return;}
    if(kind!=='acquisition'&&(c.state.stage!=='displacement'||!d||(kind==='hide'?(d.actor!==c.id||d.phase!=='hide'||objectId!==d.object.id):(d.owner!==c.id||d.phase!=='find')))){res.status(409).json({error:'No authorized displacement photo task.'});return;}
    if(!req.file){res.status(400).json({error:'A real photograph is required.'});return;}
    const mime=ctx.detectImageType(req.file.buffer);if(!mime){res.status(415).json({error:'Use a JPEG, PNG, or WebP photograph.'});return;}
    locks.add(lock);let key:string|null=null;
    try {
      const {assessment,detail,features}=await assessWitnessImage(req.file.buffer,object.name);
      if(kind!=='acquisition') {
        const original=c.state.evidence.find(e=>e.id===c.state.displacement?.originalPhoto);
        if(original){const baseline=await readImage(original.key);if(baseline.equals(req.file.buffer))throw Error('This is the original baseline image. Take a new photograph at the new or recovered position.');}
      }
      key=await ctx.saveImage(req.file.buffer,c.code,'witness',mime);
      const fresh=context(c.code);if(!fresh)throw Error('Expedition no longer available.');
      const photo:WitnessPhoto={id:ctx.randomUUID(),key,playerId:c.id,kind,objectId,assessment,detail,at:Date.now(),...(features?{features}:{})};
      recordWitnessPhoto(fresh.state,c.id,photo,req.body?.portable==='true');
      tickWitness(fresh.state,fresh.session.players.map(p=>p.id));ctx.saveGameState(fresh.game);
      const next={...fresh,id:c.id,code:c.code};
      res.json({feedback:assessment==='rejected'?`Image did not match: ${detail}. ${fresh.state.assignments[c.id]?.photos===2?'Two-photo limit reached; channel marked incomplete.':'One closer image is allowed.'}`:`Photo recorded (${assessment}). ${detail}`,view:view(next)});
    }catch(e){if(key)await ctx.removeImage(key).catch(()=>{});res.status(409).json({error:e instanceof Error?e.message:'Photo could not be recorded.'});}
    finally{locks.delete(lock);}
  });
  app.get('/sessions/:code/witness/evidence/:evidenceId',async(req,res)=>{
    const c=auth(req,res);if(!c)return;
    const e=c.state.evidence.find(e=>e.id===req.params.evidenceId);
    if(!e||!(e.playerId===c.id||c.state.revealed.includes(e.id)||c.state.stage==='complete')){res.status(403).json({error:'Evidence is private.'});return;}
    try{const data=await readImage(e.key);res.type(ctx.detectImageType(data)??'application/octet-stream').set('Cache-Control','private, no-store').send(data);}
    catch{res.status(404).json({error:'Evidence image unavailable; ledger record retained.'});}
  });
  // Override the old public game endpoint: every polling Fire TV sees the same authoritative expedition.
  app.get('/sessions/:code/threshold/game',(req,res)=>{
    const c=auth(req,res,true);if(!c)return;
    res.json(tvPayload(c));
  });
  app.post('/sessions/:code/threshold/witness/pulse',(req,res)=>{
    const c=auth(req,res,true);if(!c)return;
    try{pulseWitness(c.state,c.id);tickWitness(c.state,c.session.players.map(p=>p.id));ctx.saveGameState(c.game);const fresh=auth(req,res,true);if(fresh)res.json({accepted:true,pulseAccepted:true,...tvPayload(fresh)});}
    catch(e){res.status(409).json({error:e instanceof Error?e.message:'Pulse failed.'});}
  });
  app.post('/sessions/:code/threshold/field/verdict',(req,res,next)=>{
    const c=auth(req,res,true);if(!c)return;
    if(!c.state||c.state.stage!=='decision'){next();return;}
    // TV stance is public testimony, not an extra player vote.
    if(!['preserve','release','erase'].includes(req.body?.choice)){res.status(400).json({error:'Invalid choice.'});return;}
    c.state.events.push({id:ctx.randomUUID(),at:Date.now(),kind:'stance',text:`Public Threshold stance: ${req.body.choice}`,playerId:null,privateTo:null});ctx.saveGameState(c.game);
    res.json({accepted:true});
  });
}
