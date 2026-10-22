import type { FieldObject, FieldPlayer } from './fieldExpedition.js';

export const WITNESS_STAGES = ['acquisition','locks','displacement','recruitment','cooperation','confrontation','decision','complete'] as const;
export type WitnessStage = typeof WITNESS_STAGES[number];
export interface VisibleFeatures { color?: string; shape?: string; marking?: string }
export interface VisualLock { prompt: string; options: string[]; size: number; kind: string }
export interface WitnessPhoto { id: string; key: string; playerId: string; kind: string; objectId: string; assessment: 'verified'|'unverified'|'rejected'; detail: string; at: number; features?: VisibleFeatures }
export interface Assignment { object: FieldObject; channel: number; support: boolean; signal: string[]; rule: string; visualLock?: VisualLock; photos: number; acquired: boolean; portable: boolean; unavailable: boolean; lock: string[]; solved: boolean; attempts: number }
export interface WitnessEvent { id: string; at: number; playerId: string|null; kind: string; text: string; privateTo: string|null }
export interface WitnessState {
  version: 2; stage: WitnessStage; revision: number; startedAt: number; deadline: number;
  players: FieldPlayer[]; devices: string[]; assignments: Record<string, Assignment>;
  evidence: WitnessPhoto[]; events: WitnessEvent[]; scores: Record<string,number>; trust: Record<string,number>;
  displacement: { actor: string; owner: string; object: FieldObject; phase: 'hide'|'find'|'done'; moved: boolean; recovered: boolean; corroborated: boolean; outcome: string; originalPhoto: string; movedPhoto: string|null; recoveredPhoto: string|null; claim: string|null }|null;
  architectLie: string|null;
  recruit: { playerId: string; accepted: boolean|null; claim: string|null; exposed: boolean }|null;
  cooperation: { fragments: Record<string,string>; submitted: Record<string,boolean>; terminals: Record<string,number>; solved: boolean; failed: boolean; window: number|null };
  accusations: Record<string,{ target: string; correct: boolean; evidenceId: string }>;
  responses: Record<string,string>; revealed: string[]; votes: Record<string,string>; ending: string|null; summary: string|null;
}
const durations: Record<WitnessStage,number> = {acquisition:120000,locks:75000,displacement:120000,recruitment:60000,cooperation:90000,confrontation:90000,decision:45000,complete:0};
const symbols = ['EYE','KEY','WAVE','ASH'];
function log(s: WitnessState, kind: string, text: string, playerId: string|null=null, privateTo: string|null=null, now=Date.now()) {
  s.events.push({id:`event-${s.revision}-${s.events.length}`,at:now,kind,text,playerId,privateTo});
  s.revision++;
}
function trust(s:WitnessState,id:string,delta:number){s.trust[id]=Math.max(0,Math.min(100,(s.trust[id]??100)+delta));}
function score(s: WitnessState, id: string, points: number) { s.scores[id]=(s.scores[id]??0)+points; }
export function createWitness(code: string, objects: FieldObject[], players: FieldPlayer[], devices: string[], now=Date.now()): WitnessState {
  const seed = [...code].reduce((a,c)=>a+c.charCodeAt(0),0);
  const assignments: Record<string,Assignment>={};
  const ordered = [...objects].sort((a,b)=>a.id.localeCompare(b.id));
  players.forEach((p,i)=>{
    const object = ordered[i%Math.max(ordered.length,1)];
    if (object) {
      const offset=[...object.name+object.location].reduce((sum,c)=>sum+c.charCodeAt(0),seed+i)%4;
      const signal=[0,1,2].map(n=>symbols[(offset+n)%4]!);
      const rule=i%3===0?'forward':i%3===1?'reverse':'rotate';
      const lock=rule==='forward'?signal:rule==='reverse'?signal.slice().reverse():[signal[1]!,signal[2]!,signal[0]!];
      assignments[p.id]={object,channel:i+1,support:i>=ordered.length,signal,rule,photos:0,acquired:false,portable:false,unavailable:false,lock,solved:false,attempts:0};
    }
  });
  const s:WitnessState={version:2,stage:'acquisition',revision:0,startedAt:now,deadline:now+durations.acquisition,
    players:[...players],devices:devices.slice(0,2),assignments,evidence:[],events:[],scores:Object.fromEntries(players.map(p=>[p.id,0])),trust:Object.fromEntries(players.map(p=>[p.id,100])),
    displacement:null,architectLie:null,recruit:null,cooperation:{fragments:{},submitted:{},terminals:{},solved:false,failed:false,window:null},
    accusations:{},responses:{},revealed:[],votes:{},ending:null,summary:null};
  log(s,'architect','I have your room, but not your trust. Each Lens has a different signal. Approach your assigned object and photograph it.',null,null,now);
  if(ordered.length<players.length) log(s,'fallback','Calibration found fewer objects than players. Shared anchors use separate signal channels; no extra objects have been invented.',null,null,now);
  return s;
}
function enter(s: WitnessState, stage: WitnessStage, now:number) {
  s.stage=stage;s.deadline=now+durations[stage];s.revision++;
  if(stage==='locks') log(s,'architect','The close-ups are logged. Unlock your private channel using the sequence on your Lens. A photo without visual confirmation remains unverified.',null,null,now);
  if(stage==='displacement') {
    if(s.players.length===1) {
      s.architectLie=s.evidence.some(e=>e.kind==='acquisition')?'No acquisition photograph was supplied.':'Every channel supplied an acquisition photograph.';
      log(s,'claim',s.architectLie,null,null,now);
      log(s,'warning','DECEIT DETECTED — compare the spoken account with the actual archive.',null,null,now);
    }
    const owners=s.players.filter(p=>s.assignments[p.id]?.acquired && s.assignments[p.id]?.portable && !s.assignments[p.id]?.support);
    const owner=owners[0];
    const actor=owner && s.players.find(p=>p.id!==owner.id && (s.assignments[p.id]?.support || s.assignments[p.id]?.object.id!==s.assignments[owner.id]?.object.id));
    if(owner && actor) {
      const object=s.assignments[owner.id]!.object;
      s.displacement={actor:actor.id,owner:owner.id,object,phase:'hide',moved:false,recovered:false,corroborated:false,outcome:'pending',
        originalPhoto:s.evidence.find(e=>e.playerId===owner.id&&e.kind==='acquisition'&&e.assessment!=='rejected')!.id,movedPhoto:null,recoveredPhoto:null,claim:null};
      log(s,'architect','One signal is about to disappear. Follow only your private directive. Witnesses: remember where the calibrated objects were.',null,null,now);
    } else {
      // Reliable, honest fallback: never tell a player to move their own anchor or invent a portable prop.
      log(s,'fallback','No distinct, photographed, player-approved portable target was available. Competitive displacement is recorded as unavailable; it earns no success points.',null,null,now);
    }
  }
  if(stage==='recruitment') {
    log(s,'architect','A private offer is now open. Keep your own account of what happened. A refusal remains a valid choice.',null,null,now);
    if(s.players.length>=3) {
      const p=s.players.find(p=>p.id!==s.displacement?.owner&&p.id!==s.displacement?.actor) ?? s.players[0]!;
      s.recruit={playerId:p.id,accepted:null,claim:null,exposed:false};
      log(s,'offer','PRIVATE: Help me rewrite the record. Publish a false account of the displacement; gain 200 points if no witness identifies you. Refuse and retain your independence.',null,p.id,now);
    } else log(s,'architect',s.players.length===1?'I can reorder a signal, but not the photograph you made. Keep your original evidence.':'I cannot recruit a third witness. Your physical testimony will face scrutiny instead.',null,null,now);
  }
  if(stage==='cooperation') {
    if(s.players.length>=3&&!s.recruit?.claim) {
      s.architectLie=s.displacement?.moved?'No witness submitted a relocated-object photograph.':s.evidence.length?'No acquisition photograph was supplied.':'Every channel supplied an acquisition photograph.';
      log(s,'claim',s.architectLie,null,null,now);
      log(s,'warning','DECEIT DETECTED — a published account contradicts the ledger. An accusation may target the Architect as well as a witness.',null,null,now);
    }
    s.players.forEach((p,i)=>s.cooperation.fragments[p.id]=symbols[(i+1)%4]!);
    log(s,'architect',s.players.length===1?'MEMORY ECHO: remember the reversed signal from your private lock. Restore it without my help.':'SPLIT SIGNAL: each Lens holds the instruction for a different channel. Exchange instructions and tune your own channel. Then coordinate the Thresholds within 12 seconds.',null,null,now);
  }
  if(stage==='confrontation') log(s,'architect','The archive is open. Claims are not photographs. Reveal withheld evidence, accuse with a cited record, defend yourself, or challenge my interpretation.',null,null,now);
  if(stage==='decision') log(s,'architect','Choose who controls the record. Your vote will be weighed against recovered evidence, deception, and the shared signal.',null,null,now);
  if(stage==='complete') finish(s,now);
}
export function tickWitness(s:WitnessState, activeIds:string[], now=Date.now()) {
  if(s.stage==='complete')return s;
  // Explicit departure removes blocking requirements, but keeps the historical roster and evidence intact.
  const active=s.players.filter(p=>activeIds.includes(p.id));
  const every=(fn:(id:string)=>boolean)=>active.length>0&&active.every(p=>fn(p.id));
  let ready=false;
  switch(s.stage) {
    case 'acquisition':ready=every(id=>!!s.assignments[id]?.acquired||!!s.assignments[id]?.unavailable);break;
    case 'locks':ready=every(id=>!!s.assignments[id]?.solved||!s.assignments[id]?.acquired);break;
    case 'displacement':ready=s.players.length===1?!!s.responses['solo-baseline']:s.displacement?.phase==='done';break;
    case 'recruitment':ready=s.players.length<3||s.recruit?.accepted===false||!!s.recruit?.claim;break;
    case 'cooperation':ready=s.cooperation.solved||s.cooperation.failed;break;
    case 'confrontation':ready=every(id=>!!s.responses[id]);break;
    case 'decision':ready=every(id=>!!s.votes[id]);break;
  }
  if(now>=s.deadline||ready) {
    if(!ready) {
      log(s,'timeout',`${s.stage.toUpperCase()}: time expired. Incomplete actions remain incomplete; no evidence or success was inferred.`,null,null,now);
      if(s.stage==='displacement'&&s.displacement){s.displacement.phase='done';s.displacement.outcome=s.displacement.moved?'not recovered before timeout':'not moved before timeout';}
      if(s.stage==='cooperation')s.cooperation.failed=true;
    }
    enter(s,WITNESS_STAGES[WITNESS_STAGES.indexOf(s.stage)+1]!,now);
  }
  return s;
}
function requireStage(s:WitnessState, stage:WitnessStage){if(s.stage!==stage)throw Error(`This action belongs to ${stage}; current encounter is ${s.stage}.`);}
export function recordWitnessPhoto(s:WitnessState, playerId:string, photo:WitnessPhoto, portable:boolean, now=Date.now()) {
  const a=s.assignments[playerId];if(!a)throw Error('No calibrated object assigned. Use the unavailable-object control.');
  if(photo.playerId!==playerId)throw Error('Evidence owner mismatch.');
  if(photo.kind==='acquisition') {
    requireStage(s,'acquisition');if(a.photos>=2||a.acquired||a.unavailable)throw Error('Verification closed: maximum two images per player.');
    if(photo.objectId!==a.object.id)throw Error('Photograph your assigned object.');
    a.photos++;s.evidence.push(photo);
    if(photo.assessment==='verified'&&photo.features) {
      const f=photo.features;
      const kinds=['color','shape','marking'];
      const preferred=kinds[(a.channel-1)%3]!;
      const kind=f[preferred as keyof VisibleFeatures]?preferred:kinds.find(k=>f[k as keyof VisibleFeatures]);
      if(kind==='color'&&f.color) {
        a.lock=[f.color];a.visualLock={kind,prompt:`Inspect your actual ${a.object.name}. Which dominant visible color did the verified close-up establish? Tap that color to unlock its channel.`,options:['RED','BLUE','GREEN','YELLOW','BLACK','WHITE','BROWN','GRAY'],size:1};
      } else if(kind==='shape'&&f.shape) {
        a.lock=[f.shape];a.visualLock={kind,prompt:`Approach your ${a.object.name} and check its silhouette. Select the shape established in the verified close-up.`,options:['ROUND','RECTANGULAR','CYLINDRICAL','IRREGULAR'],size:1};
      } else if(kind==='marking'&&f.marking) {
        a.lock=f.marking.toUpperCase().split(/\s+/).slice(0,6);
        const otherWords=a.object.name.toUpperCase().split(/\s+/);
        a.visualLock={kind,prompt:`Read the verified marking on your ${a.object.name}. Tap its words in their actual printed order (${a.lock.length} words). Extra choices come from the calibrated object name.`,options:[...new Set([...a.lock,...otherWords])].sort(),size:a.lock.length};
      }
    }
    if(photo.assessment!=='rejected'){a.acquired=true;a.portable=portable;score(s,playerId,photo.assessment==='verified'?100:50);}
    if(a.photos===2&&!a.acquired)a.unavailable=true;
    log(s,'photo',`${s.players.find(p=>p.id===playerId)?.name}: ${a.object.name} — ${photo.assessment}. ${photo.detail}`,playerId,playerId,now);
  } else {
    requireStage(s,'displacement');const d=s.displacement;if(!d)throw Error('No displacement target.');
    if(photo.kind==='hide') {
      if(playerId!==d.actor||d.phase!=='hide')throw Error('Only the assigned mover can submit this evidence.');
      if(photo.objectId!==d.object.id)throw Error('Wrong displacement target.');
      if(photo.assessment==='rejected')throw Error('The image does not support the assigned object. Retake or report unable.');
      d.moved=true;d.phase='find';d.movedPhoto=photo.id;
      log(s,'movement','A private mover submitted a relocated-object photograph. Physical recovery still requires independent corroboration.',null,null,now);
    } else if(photo.kind==='recover') {
      if(playerId!==d.owner||d.phase!=='find')throw Error('Only the original owner can investigate now.');
      d.recovered=photo.objectId===d.object.id&&photo.assessment!=='rejected';d.recoveredPhoto=photo.id;d.phase='done';
      d.outcome=d.recovered?'owner reported recovery; awaiting independent corroboration':'wrong object or rejected recovery';
      score(s,d.recovered?d.owner:d.actor,150);
      log(s,'recovery',`${s.players.find(p=>p.id===playerId)?.name} ${d.recovered?'reported recovering':'did not recover'} ${d.object.name}. Photo assessment: ${photo.assessment}.`,playerId,null,now);
    } else throw Error('Invalid photo task.');
    s.evidence.push(photo);
  }
  s.revision++;return s;
}
export function witnessAction(s:WitnessState, playerId:string, type:string, value:unknown, evidenceId:unknown, now=Date.now()):string {
  if(!s.players.some(p=>p.id===playerId))throw Error('Unknown operative.');
  const a=s.assignments[playerId];
  let feedback='Action recorded.';
  if(type==='unavailable') {
    requireStage(s,'acquisition');if(a&&!a.acquired)a.unavailable=true;
    log(s,'unavailable','Assigned object or camera unavailable; this channel will carry missing evidence.',playerId,null,now);
  } else if(type==='lock') {
    requireStage(s,'locks');if(!a?.acquired||a.solved)throw Error('Acquire a photo before tuning; solved locks cannot score twice.');
    if(!Array.isArray(value)||value.length!==a.lock.length||value.some(v=>typeof v!=='string'||!(a.visualLock?.options??symbols).includes(v)))throw Error(`Select ${a.lock.length} choices for your object channel.`);
    a.attempts++;
    if(value.join('|')===a.lock.join('|')){a.solved=true;score(s,playerId,100);feedback='CHANNEL UNLOCKED. Your object is now part of the evidence trail.';}
    else {score(s,playerId,-10);feedback='Signal rejected (−10). Follow your private channel rule and retry.';}
    log(s,'lock',feedback,playerId,playerId,now);
  } else if(type==='offer-target') {
    requireStage(s,'displacement');if(s.displacement||!a?.acquired||a.support)throw Error('Only a primary object owner with a photograph can offer a fallback target.');
    a.portable=true;enter(s,'displacement',now);feedback='Safe target offered. The mover’s private assignment is now active.';
  } else if(type==='solo-baseline') {
    requireStage(s,'displacement');if(s.players.length!==1||!a)throw Error('Solo baseline unavailable.');
    const e=s.evidence.find(e=>e.id===evidenceId&&e.playerId===playerId&&e.kind==='acquisition');
    if(!e||value!==a.object.location)throw Error('Cite your actual baseline photo and select the original calibrated location.');
    if(s.responses['solo-baseline'])throw Error('Baseline already restored.');
    s.responses['solo-baseline']='restored';score(s,playerId,150);
    log(s,'baseline',`The solo witness restored the original location of ${a.object.name}: ${a.object.location}, citing ${e.id}. The Architect’s invented relocation was rejected.`,playerId,null,now);
    feedback='BASELINE RESTORED. You challenged the Architect using your own actual photograph.';
  } else if(type==='unable-move') {
    requireStage(s,'displacement');const d=s.displacement;
    if(!d||![d.actor,d.owner].includes(playerId)||d.phase==='done')throw Error('No active physical assignment.');
    d.phase='done';d.outcome='physical objective declined or unavailable';log(s,'refusal',d.outcome,playerId,null,now);
  } else if(type==='movement-claim') {
    requireStage(s,'displacement');const d=s.displacement;
    if(!d||playerId!==d.actor||d.phase!=='find'||d.claim)throw Error('No active mover claim.');
    if(value!=='admit'&&value!=='deny')throw Error('Choose admit or deny.');
    d.claim=value;log(s,'claim',value==='deny'?'I did not relocate the signal object.':'I relocated the signal object.',playerId,null,now);
  } else if(type==='recruit') {
    requireStage(s,'recruitment');const r=s.recruit;
    if(!r||r.playerId!==playerId||r.accepted!==null||typeof value!=='boolean')throw Error('No unanswered recruitment offer.');
    r.accepted=value;log(s,'recruitment',value?'Accepted the Architect’s offer.':'Refused the Architect’s offer.',playerId,playerId,now);
  } else if(type==='deceive') {
    requireStage(s,'recruitment');const r=s.recruit;
    if(!r||r.playerId!==playerId||!r.accepted||r.claim)throw Error('No accepted deception assignment.');
    const d=s.displacement;
    // The lie is about a recorded engine event, never a claim of photographic perception.
    r.claim=d?.moved?'No witness submitted a relocated-object photograph.':s.evidence.some(e=>e.kind==='acquisition')?'No witness supplied an acquisition photograph.':'Every witness successfully supplied an acquisition photograph.';
    log(s,'claim',r.claim,playerId,null,now);
    log(s,'warning','DECEIT DETECTED — a published claim contradicts the event ledger. The suspect’s identity is withheld.',null,null,now);
  } else if(type==='tune') {
    requireStage(s,'cooperation');const c=s.cooperation;
    if(c.submitted[playerId])throw Error('Channel already tuned.');
    const expected=s.players.length===1?a?.lock.slice().reverse().join('-'):c.fragments[playerId];
    if(value!==expected){score(s,playerId,-10);return 'Wrong frequency (−10). Ask the Lens holding your channel instruction.';}
    c.submitted[playerId]=true;score(s,playerId,100);feedback='Your channel is tuned. Coordinate the terminal pulse when all channels are ready.';
    log(s,'tune',`${s.players.find(p=>p.id===playerId)?.name} tuned their channel.`,playerId,null,now);
  } else if(type==='pulse') {
    requireStage(s,'cooperation');if(s.devices.length>0)throw Error('Use SELECT on the Fire TV; emergency Lens fallback unlocks in the final 20 seconds.');
    pulseWitness(s,'lens',now);feedback='Lens relay pulse recorded.';
  } else if(type==='relay-fallback') {
    requireStage(s,'cooperation');if(now<s.deadline-20000)throw Error('TV recovery relay unlocks in the final 20 seconds.');
    if(!s.players.every(p=>s.cooperation.submitted[p.id]))throw Error('Tune every channel first.');
    s.cooperation.solved=true;log(s,'fallback','Lens emergency relay restored the signal; TV synchronization was unavailable.',playerId,null,now);
  } else if(type==='reveal') {
    requireStage(s,'confrontation');const e=s.evidence.find(e=>e.id===evidenceId&&e.playerId===playerId);
    if(!e)throw Error('Choose your own recorded photograph.');
    if(!s.revealed.includes(e.id)){s.revealed.push(e.id);score(s,playerId,25);trust(s,playerId,10);log(s,'reveal',`${e.id}: ${e.kind} photo of ${s.assignments[playerId]?.object.name??'displacement target'} (${e.assessment}).`,playerId,null,now);}
    feedback='Your photograph is now public in the evidence confrontation.';
  } else if(type==='accuse') {
    requireStage(s,'confrontation');if(s.accusations[playerId])throw Error('One formal accusation per witness.');
    if(typeof value!=='string'||value===playerId||(!s.players.some(p=>p.id===value)&&value!=='architect'))throw Error('Choose another witness or the Architect.');
    if(typeof evidenceId!=='string'||!s.events.some(e=>e.id===evidenceId&&e.privateTo===null))throw Error('Cite a public event from the ledger.');
    const correct=(value==='architect'&&!!s.architectLie)||(s.recruit?.playerId===value&&!!s.recruit.claim)||(s.displacement?.actor===value&&s.displacement.claim==='deny');
    s.accusations[playerId]={target:value,correct,evidenceId};score(s,playerId,correct?150:-100);
    if(correct){trust(s,value,-40);if(s.recruit?.playerId===value)s.recruit.exposed=true;}else trust(s,playerId,-25);
    log(s,'accusation',`${s.players.find(p=>p.id===playerId)?.name} accused ${value==='architect'?'the Architect':s.players.find(p=>p.id===value)?.name}, citing ${evidenceId}. Verdict sealed until the ending.`,playerId,null,now);
    feedback='Accusation sealed. A false accusation costs 100 points; the ending will show the ledger verdict.';
  } else if(type==='respond') {
    requireStage(s,'confrontation');if(!['defend','challenge','corroborate','withhold'].includes(String(value)))throw Error('Choose a confrontation response.');
    if(s.responses[playerId])throw Error('Response already recorded.');
    s.responses[playerId]=String(value);trust(s,playerId,value==='withhold'?-10:value==='challenge'?5:0);
    if(value==='corroborate'&&s.displacement?.recovered&&playerId!==s.displacement.owner){s.displacement.corroborated=true;s.displacement.outcome='recovered and independently attested';}
    log(s,'response',`${s.players.find(p=>p.id===playerId)?.name}: ${value==='challenge'?'challenged the Architect: a submitted image alone cannot prove movement':value==='defend'?'denied deceiving the other witnesses':value==='corroborate'?'attested to seeing the recovered object':'withheld further testimony'}.`,playerId,null,now);
  } else if(type==='vote') {
    requireStage(s,'decision');if(!['preserve','release','erase'].includes(String(value)))throw Error('Choose a final decision.');
    if(s.votes[playerId])throw Error('Vote already recorded.');s.votes[playerId]=String(value);log(s,'vote','Final decision sealed.',playerId,playerId,now);
  } else throw Error('Unknown action.');
  s.revision++;return feedback;
}
export function pulseWitness(s:WitnessState, deviceId:string, now=Date.now()) {
  requireStage(s,'cooperation');const c=s.cooperation;
  if(!s.players.every(p=>c.submitted[p.id]))throw Error('Every Lens must tune its own channel first.');
  if(s.devices.length&&!s.devices.includes(deviceId))throw Error('This display is an observer; use the first two Thresholds.');
  if(c.window!==null&&now-c.window>12000){c.terminals={};c.window=null;}
  c.window??=now;c.terminals[deviceId]=now;
  const required=s.devices.length?s.devices:['lens'];
  c.solved=required.every(id=>c.terminals[id]!==undefined);
  log(s,'pulse',c.solved?'COOPERATIVE SIGNAL RESTORED — all channels and terminal pulses aligned.':'Terminal pulse received. Other Threshold: press SELECT within 12 seconds.',null,null,now);
}
function finish(s:WitnessState, now:number) {
  if(s.recruit?.claim&&!s.recruit.exposed){score(s,s.recruit.playerId,200);trust(s,s.recruit.playerId,-20);}
  const tally:Record<string,number>={preserve:0,release:0,erase:0};Object.values(s.votes).forEach(v=>tally[v]=(tally[v]??0)+1);
  const max=Math.max(...Object.values(tally));const tied=Object.keys(tally).filter(k=>tally[k]===max);
  const challenged=Object.values(s.responses).includes('challenge');
  s.ending=tied.length===1?tied[0]!:challenged?'release':s.cooperation.solved?'preserve':'erase';
  const name=(id:string)=>id==='architect'?'the Architect':s.players.find(p=>p.id===id)?.name??id;
  const d=s.displacement;
  const lines=[`FINAL DECISION: ${s.ending.toUpperCase()}. ${tied.length>1?'Split/missing vote resolved by '+(challenged?'a recorded challenge to the Architect':s.cooperation.solved?'successful cooperation':'failure to restore the shared signal'):'The witness majority decided.'}`,
    `YOUR ROOM: ${Object.entries(s.assignments).map(([id,a])=>`${name(id)} → ${a.object.name} at ${a.object.location}: ${a.acquired?'photo supplied':'missing evidence'}, lock ${a.solved?'unlocked':'incomplete'}`).join('; ')}.`,
    d?`DISPLACEMENT: ${name(d.actor)} was assigned to relocate ${name(d.owner)}’s ${d.object.name}, originally at ${d.object.location}. Movement photograph ${d.moved?'submitted':'missing'}. Recovery: ${d.outcome}. ${d.corroborated?'Another witness corroborated recovery.':'Physical movement remains player testimony, not a fact inferred from a photo.'}`:s.players.length===1?`SOLO BASELINE: ${s.responses['solo-baseline']?'original location restored with the actual photograph':'baseline incomplete'}. No other person or physical movement was invented.`:'DISPLACEMENT: no distinct safe photographed target was available; no movement was invented.',
    `CLAIMS: ${s.events.filter(e=>e.kind==='claim'||e.kind==='response').map(e=>e.kind==='response'?e.text:`${e.playerId?name(e.playerId):'Architect'}: ${e.text}`).join(' | ')||'No claims recorded'}.`,
    s.recruit?`RECRUITMENT: ${name(s.recruit.playerId)} ${s.recruit.accepted===true?'accepted':s.recruit.accepted===false?'refused':'did not answer'} the offer. ${s.recruit.claim?'A false claim was published. '+(s.recruit.exposed?'The recruited deceiver was correctly identified.':'The recruited deceiver escaped identification (+200).'):'No recruited lie was published.'}`:'RECRUITMENT: no multiplayer recruitment in this expedition.',
    `ACCUSATIONS: ${Object.entries(s.accusations).map(([id,a])=>`${name(id)} accused ${name(a.target)}: ${a.correct?'supported by the event ledger (+150)':'false accusation (−100)'}`).join('; ')||'none'}.`,
    `ARCHITECT ACCOUNT: ${s.architectLie?`The Architect published a false claim: “${s.architectLie}”`:'No additional Architect lie was recorded'}.`,
    `COOPERATION: ${s.cooperation.solved?'restored':'failed or incomplete'}; ${Object.keys(s.cooperation.submitted).length}/${s.players.length} Lens channels tuned; ${Object.keys(s.cooperation.terminals).length} terminal pulses.`,
    `EVIDENCE: ${s.evidence.length} real uploads; ${s.evidence.filter(e=>e.assessment==='verified').length} AI-confirmed object matches, ${s.evidence.filter(e=>e.assessment==='unverified').length} unverified, ${s.evidence.filter(e=>e.assessment==='rejected').length} rejected; ${s.revealed.length} revealed during confrontation.`,
    `CONSEQUENCE: ${s.ending==='release'?(s.recruit?.exposed||challenged?'You released a contested archive with the Architect’s interpretation challenged.':'You released an archive while disputed claims remained unresolved.'):s.ending==='preserve'?(s.cooperation.solved?'Your coordinated signal preserved the archive; contested claims remain labelled.':'You preserved a fractured archive without a restored shared signal.'):'You cut the Architect’s narrative access. This story choice does not delete stored photos.'}`,
    `ARCHIVE INTEGRITY: ${s.recruit?.claim&&!s.recruit.exposed?'The recruited false account survived the confrontation; the archive remains contested.':s.recruit?.exposed?'The recruited false account was exposed and annotated.':'No recruited false account survived.'} ${Object.values(s.accusations).some(a=>!a.correct)?'False accusations reduced the accusers’ trust by 25.':''}`,
    `SCORES / TRUST: ${s.players.map(p=>`${p.name} ${s.scores[p.id]??0} points / ${s.trust[p.id]??100} trust`).join(' · ')}.`];
  s.summary=lines.join('\n\n');log(s,'ending',s.summary,null,null,now);
}
const titles:Record<WitnessStage,string>={acquisition:'I // ACQUIRE THE SIGNAL',locks:'II // PRIVATE SIGNAL LOCKS',displacement:'III // THE MISSING OBJECT',recruitment:'IV // THE PRIVATE OFFER',cooperation:'V // SPLIT SIGNAL',confrontation:'VI // EVIDENCE CONFRONTATION',decision:'VII // WHO OWNS THE RECORD?',complete:'THE LAST WITNESS // ENDING'};
export function witnessView(s:WitnessState, playerId:string|null, deviceId?:string, now=Date.now()) {
  const a=playerId?s.assignments[playerId]:undefined;const d=s.displacement;const r=s.recruit;
  const index=s.players.findIndex(p=>p.id===playerId);const next=s.players[(index+1)%s.players.length];
  const publicEvents=s.events.filter(e=>e.privateTo===null);
  const final=s.stage==='complete';
  const privateEvents=s.events.filter(e=>e.privateTo===playerId&&playerId!==null);
  const stageInstruction:Record<WitnessStage,string>={
    acquisition:a?`${a.support?'CONTEXT CHANNEL: you do not own this object assignment. Photograph the wider surroundings of':'Approach'} ${a.object.name} at ${a.object.location}. ${a.support?'The primary owner retains this object; your task is a different view of its surroundings.':'Photograph the entire assigned object in place.'} Do not move it yet. ${a.photos?'One final close-up attempt remains.':'At most two verification photos.'}`:'Calibration supplied no object. Report unavailable; missing evidence will affect the ending.',
    locks:a?.visualLock?'Inspect the assigned real object and solve its verified visual lock. Wrong attempts cost 10 points.':'Vision supplied no structured visual detail for this channel. Use the displayed calibration-bound signal and your private transformation rule. Wrong attempts cost 10 points.',
    displacement:s.players.length===1?'SOLO // The Architect claims: “I have replaced the room in your memory.” That is narrative manipulation, not photographic evidence. Find your original object again. Select its calibrated location and cite your actual baseline photo to reject this claim.':!d?'FALLBACK: a primary owner must approve their photographed object as safe to relocate using OFFER SAFE TARGET. A context observer can become the mover; the object remains assigned to its primary owner. If no safe target exists, the timer records a failed encounter without inventing evidence.':playerId===d.actor?(d.phase==='hide'?`PRIVATE: relocate ${d.object.name}, originally at ${d.object.location}, out of its owner’s immediate view. It belongs to another witness. Photograph its new position. Move only a safe, permitted object.`:'Your photograph is logged. You may admit the move or deny it publicly. The owner must independently find the object.'):playerId===d.owner?(d.phase==='find'?`Your ${d.object.name} has a movement report. Find what changed, recover the object, and photograph it. Choose the object you actually found.`:'Remember your object’s original location. A private action is in progress; you will investigate next.'):'Witness: watch the room without exposing another player’s Lens. You can corroborate or challenge the account during confrontation.',
    recruitment:r?.playerId===playerId?'PRIVATE: the Architect offers 200 points for a successful false account of the recorded displacement. Accept and publish the assigned claim, or refuse.':'Compare the room with what people say. A private offer is being made. It may be refused. No suspect identity will appear on the TV.',
    cooperation:s.players.length===1?'Recall the choices in your previous object lock. Tap them in REVERSE order, then press SELECT on the TV.':'Each Lens knows the frequency for ANOTHER player’s channel. Speak to that player. Tune your own channel using the frequency someone else holds. Once all are tuned, coordinate SELECT on the first two TVs within 12 seconds (one TV needs one pulse).',
    confrontation:'Discuss the public claims. Reveal your photos, cite a ledger event in one accusation, then choose a final response. Finish evidence actions before your response: the encounter advances when everyone responds.',
    decision:'Vote to preserve the contested archive, release it to the witnesses, or sever the Architect’s narrative access. The ending names the real objects, actions, claims, missing evidence and consequences.',
    complete:s.summary??'Transmission complete.'};
  const deception=!!s.architectLie||!!r?.claim||d?.claim==='deny';
  const evidence=s.evidence.filter(e=>final||e.playerId===playerId||s.revealed.includes(e.id)).map(e=>({...e,url:`/sessions/EVIDENCE_CODE/witness/evidence/${e.id}`}));
  return {version:2,stage:s.stage,title:titles[s.stage],revision:s.revision,deadline:s.deadline,remainingSeconds:Math.max(0,Math.ceil((s.deadline-now)/1000)),
    instruction:stageInstruction[s.stage],transmission:deception&&!final&&['cooperation','confrontation'].includes(s.stage)?'DECEIT DETECTED — a claim conflicts with the ledger. Investigate; no identity has been revealed.':publicEvents.filter(e=>e.kind==='architect'||e.kind.startsWith('narration-')).at(-1)?.text??'',
    assignment:a?{object:a.object,channel:a.channel,support:a.support,rule:a.rule,photos:a.photos,acquired:a.acquired,unavailable:a.unavailable,solved:a.solved,attempts:a.attempts,sequence:s.stage==='locks'&&!a.visualLock?a.signal:undefined,visualLock:a.visualLock??null}:null,
    displacement:d?{role:playerId===d.actor?'mover':playerId===d.owner?'investigator':'witness',phase:d.phase,
      target:playerId===d.actor||playerId===d.owner||final?d.object:null,claim:playerId===d.actor?d.claim:null,outcome:d.phase==='done'?d.outcome:null}:null,
    recruitment:r?.playerId===playerId?{accepted:r.accepted,published:!!r.claim,objective:d?.moved?'Publish: “No witness submitted a relocated-object photograph.”':s.evidence.some(e=>e.kind==='acquisition')?'Publish: “No witness supplied an acquisition photograph.”':'Publish: “Every witness successfully supplied an acquisition photograph.”'}:null,
    cooperation:{tuned:!!(playerId&&s.cooperation.submitted[playerId]),tunedCount:Object.keys(s.cooperation.submitted).length,total:s.players.length,solved:s.cooperation.solved,
      clue:playerId&&next?{player:next.name,frequency:s.cooperation.fragments[next.id]}:null,
      pulses:Object.keys(s.cooperation.terminals).length,windowUntil:s.cooperation.window===null?null:s.cooperation.window+12000,windowRemainingSeconds:s.cooperation.window===null?null:Math.max(0,Math.ceil((s.cooperation.window+12000-now)/1000)),
      terminalNumber:deviceId?s.devices.indexOf(deviceId)+1:0,terminalRequired:deviceId?s.devices.includes(deviceId):false,
      terminalRole:deviceId?(s.devices.length>1?(s.devices.indexOf(deviceId)===0?'PRIMARY // SEND THE FIRST PULSE':'SECONDARY // COMPLETE THE SIGNAL'):'SOLE TERMINAL // SEND THE PULSE'):'LENS RELAY',
      terminalInstruction:deviceId?(s.devices.length>1?(s.devices.indexOf(deviceId)===0?'Wait until every Lens is tuned, then press SELECT. The second terminal must follow within 12 seconds.':'Wait for the primary terminal pulse, then press SELECT within 12 seconds.'):'When every Lens is tuned, press SELECT once to restore the signal.'):'Use the Lens relay when no terminal is available.',
      pulseAccepted:!!(deviceId&&s.cooperation.terminals[deviceId]),
      requiredTerminal:deviceId&&s.devices.length>1?s.devices[0]:null},
    players:s.players,objects:Object.values(s.assignments).map(a=>a.object).filter((o,i,all)=>all.findIndex(x=>x.id===o.id)===i),
    evidence,events:[...publicEvents,...privateEvents].sort((a,b)=>a.at-b.at).slice(-45),publicLedger:publicEvents.filter(e=>['claim','movement','recovery','photo','reveal','tune','pulse'].includes(e.kind)),
    privateClue:playerId?index%2===0?`Ledger fragment: ${d?.moved?'a relocated-object photograph was submitted':'no relocated-object photograph was submitted'}. A photograph alone cannot establish who physically moved an object.`:`Ledger fragment: ${Object.values(s.assignments).filter(a=>a.acquired).length}/${s.players.length} witnesses supplied acquisition photos. Compare this count to published claims.`:null,
    scores:final?s.scores:{},accused:!!(playerId&&s.accusations[playerId]),responded:!!(playerId&&s.responses[playerId]),hasVoted:!!(playerId&&s.votes[playerId]),
    ending:s.ending,summary:s.summary,
    // Public display compatibility: no private assignments, offer identities or hidden photographs.
    progress:Math.min(6,WITNESS_STAGES.indexOf(s.stage)),total:7,received:s.stage==='cooperation'?Object.keys(s.cooperation.submitted).length:0,required:s.players.length,
    prompt:stageInstruction[s.stage],prior:publicEvents.filter(e=>['claim','recovery','response','reveal'].includes(e.kind)).map(e=>({player:s.players.find(p=>p.id===e.playerId)?.name??'ARCHITECT',object:e.kind,observation:e.text})),endingTransmission:s.summary};
}
