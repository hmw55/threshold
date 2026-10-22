import { useEffect, useRef, useState } from 'react';
import { normalizeCode, playerHeaders, request } from '../services/apiClient';
import { FieldEvidenceCamera } from './FieldEvidenceCamera';
import './FieldExpedition.css';
import './RoomScanner.css';

type Stage='acquisition'|'locks'|'displacement'|'recruitment'|'cooperation'|'confrontation'|'decision'|'complete';
interface ObjectRef { id:string; name:string; location:string }
interface Evidence { id:string; kind:string; objectId:string; playerId:string; assessment:string; detail:string; url:string }
interface Event { id:string; playerId:string|null; kind:string; text:string; privateTo:string|null }
interface View {
  stage:Stage; title:string; instruction:string; transmission:string; remainingSeconds:number; deadline:number; revision:number;
  assignment:{object:ObjectRef;channel:number;support:boolean;rule:string;photos:number;acquired:boolean;unavailable:boolean;solved:boolean;attempts:number;sequence?:string[];visualLock:{kind:string;prompt:string;options:string[];size:number}|null}|null;
  displacement:{role:string;phase:string;target:ObjectRef|null;claim:string|null;outcome:string|null}|null;
  recruitment:{accepted:boolean|null;published:boolean;objective:string}|null;
  cooperation:{tuned:boolean;tunedCount:number;total:number;solved:boolean;clue:{player:string;frequency:string}|null;pulses:number;windowUntil:number|null;windowRemainingSeconds:number|null};
  players:{id:string;name:string}[];objects:ObjectRef[];evidence:Evidence[];events:Event[];publicLedger:Event[];
  privateClue:string|null;scores:Record<string,number>;accused:boolean;responded:boolean;hasVoted:boolean;ending:string|null;summary:string|null;
}
interface Props {sessionCode:string;playerId:string;playerToken:string}
const symbols=['EYE','KEY','WAVE','ASH'];
export function FieldExpedition({sessionCode,playerId,playerToken}:Props) {
  const [view,setView]=useState<View|null>(null);
  const [busy,setBusy]=useState(false);const busyRef=useRef(false);
  const [feedback,setFeedback]=useState('');const [error,setError]=useState('');
  const [photo,setPhoto]=useState<Blob|null>(null);const [portable,setPortable]=useState(false);
  const [sequence,setSequence]=useState<string[]>([]);const [frequency,setFrequency]=useState('');
  const [found,setFound]=useState('');const [suspect,setSuspect]=useState('');const [citation,setCitation]=useState('');
  const [openPhoto,setOpenPhoto]=useState<{id:string;url:string}|null>(null);
  const base=`/sessions/${normalizeCode(sessionCode)}/witness`;
  const headers=playerHeaders(playerId,playerToken);
  const stageRef=useRef('');
  function update(v:View){
    const key=`${v.stage}:${v.displacement?.phase??''}:${v.assignment?.photos??0}`;
    if(stageRef.current!==key){setPhoto(null);setSequence([]);setFrequency('');setFound('');stageRef.current=key;}
    setView(v);
  }
  useEffect(()=>{
    let alive=true;let polling=false;
    async function poll(){if(polling||busyRef.current)return;polling=true;
      try{const v=await request<View>(base,{headers:playerHeaders(playerId,playerToken)});if(alive){update(v);setError('');}}
      catch(e){if(alive)setError(e instanceof Error?e.message:'Connection interrupted. Reconnecting; your progress is saved.');}
      finally{polling=false;}}
    void poll();const timer=window.setInterval(()=>void poll(),1500);
    return()=>{alive=false;window.clearInterval(timer);};
  },[base,playerId,playerToken]);
  useEffect(()=>()=>{if(openPhoto)URL.revokeObjectURL(openPhoto.url);},[openPhoto]);
  async function act(type:string,value?:unknown,evidenceId?:string){
    if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');
    try{const result=await request<{view:View;feedback:string}>(`${base}/action`,{method:'POST',headers,body:JSON.stringify({type,value,evidenceId})});update(result.view);setFeedback(result.feedback);}
    catch(e){setError(e instanceof Error?e.message:'Action failed. Try again.');}
    finally{busyRef.current=false;setBusy(false);}
  }
  async function upload(kind:string,objectId:string){
    if(!photo||busyRef.current)return;busyRef.current=true;setBusy(true);setError('');
    const body=new FormData();body.append('image',photo,'evidence.jpg');body.append('kind',kind);body.append('objectId',objectId);body.append('portable',String(portable));
    try{const result=await request<{view:View;feedback:string}>(`${base}/photo`,{method:'POST',headers,body});update(result.view);setFeedback(result.feedback);setPhoto(null);}
    catch(e){setError(e instanceof Error?e.message:'Photo failed. Retry while this task is active.');}
    finally{busyRef.current=false;setBusy(false);}
  }
  async function inspect(e:Evidence){
    try{
      const root=(import.meta.env.VITE_SESSION_SERVICE_URL as string).replace(/\/+$/,'');
      const r=await fetch(`${root}${e.url}`,{headers});if(!r.ok)throw Error('Image unavailable or still private.');
      const blob=await r.blob();setOpenPhoto({id:e.id,url:URL.createObjectURL(blob)});
    }catch(e){setError(e instanceof Error?e.message:'Image unavailable.');}
  }
  if(!view)return <section className="field-panel"><h1>CONNECTING TO THE ARCHITECT</h1><p>Your expedition progress is stored on the server.</p>{error&&<p role="alert">{error}</p>}</section>;
  const a=view.assignment;const d=view.displacement;const r=view.recruitment;
  const lockSize=a?.visualLock?.size??3;const lockOptions=a?.visualLock?.options??symbols;
  const photoKind=view.stage==='acquisition'?'acquisition':d?.role==='mover'?'hide':'recover';
  const canPhoto=view.stage==='acquisition'?!!a&&!a.acquired&&!a.unavailable:a&&view.stage==='displacement'&&((d?.role==='mover'&&d.phase==='hide')||(d?.role==='investigator'&&d.phase==='find'));
  const photoId=photoKind==='acquisition'?a?.object.id:photoKind==='hide'?d?.target?.id:found;
  const button=(label:string,type:string,value?:unknown,disabled=false)=><button type="button" disabled={busy||disabled} onClick={()=>void act(type,value)}>{label}</button>;
  return <section className="field-panel" aria-busy={busy}>
    <div className="field-eyebrow">THE LAST WITNESS // PRIVATE LENS</div>
    <h1>{view.title}</h1>
    {view.stage!=='complete'&&<p role="timer">ENCOUNTER TIMER // {Math.floor(view.remainingSeconds/60)}:{String(view.remainingSeconds%60).padStart(2,'0')} · Missing actions are recorded as incomplete when time expires.</p>}
    <blockquote className="field-transmission">{view.transmission}</blockquote>
    <div className="field-active-task"><strong>{view.stage==='complete'?'TRANSMISSION COMPLETE':'YOUR NEXT ACTION'}</strong><p>{view.stage==='complete'?'Inspect the final record below. Every outcome comes from this expedition’s ledger.':view.instruction}</p></div>
    {busy&&<p role="status">TRANSMITTING… Vision analysis can take up to eight seconds. Your progress will be saved.</p>}
    {feedback&&<p className="field-feedback" role="status">{feedback}</p>}
    {error&&<p className="field-error" role="alert">{error}</p>}
    {view.stage==='acquisition'&&a&&<div className="field-controls">
      <h2>CHANNEL {a.channel} // {a.object.name}{a.support?' // CONTEXT OBSERVER':''}</h2><p>BASELINE LOCATION // {a.object.location}</p>
      <p>Photos submitted: {a.photos}/2. A rejected first image allows exactly one closer photograph. Unavailable AI yields an explicitly unverified record.</p>
      {!a.acquired&&!a.unavailable&&<label><input type="checkbox" checked={portable} disabled={busy} onChange={e=>setPortable(e.target.checked)}/> I permit another player to relocate this object (primary owner only). It is safe, portable, and belongs to someone who permits handling.</label>}
      {a.acquired?<p role="status">OBJECT RECORDED. Keep its original position in mind. Waiting for other channels, then private locks unlock.</p>:a.unavailable?<p>CHANNEL INCOMPLETE. The next encounter starts when other players finish or the timer expires.</p>:button('OBJECT OR CAMERA UNAVAILABLE','unavailable')}
    </div>}
    {view.stage==='acquisition'&&!a&&button('NO CALIBRATED OBJECT AVAILABLE','unavailable')}
    {view.stage==='locks'&&<div className="field-controls">
      {a?.acquired&&!a.solved?<><h2>OBJECT SIGNAL // {a.object.name}</h2>{a.visualLock?<p>{a.visualLock.prompt}</p>:<><p>RECOVERED SIGNAL // {a.sequence?.join(' → ')}</p><p>YOUR CHANNEL RULE // {a.rule==='forward'?'Transmit in the original order':a.rule==='reverse'?'Reverse the signal order':'Start at the SECOND symbol, then THIRD, then FIRST'}</p></>}
        <p>Inspect your photographed anchor and tap the correct choices to lock its signal. Remember the sequence if you are playing solo.</p>
        <div>{lockOptions.map(s=><button key={s} type="button" disabled={busy||sequence.length>=lockSize} onClick={()=>setSequence([...sequence,s])}>{s}</button>)}</div>
        <p>YOUR SIGNAL // {sequence.join(' → ')||'Choose three symbols'}</p>
        <button type="button" disabled={busy} onClick={()=>setSequence([])}>RESET SYMBOLS</button>
        {button('UNLOCK OBJECT CHANNEL','lock',sequence,sequence.length!==lockSize)}
      </>:<p role="status">{a?.solved?'CHANNEL UNLOCKED.':'No acquisition evidence: this channel cannot earn lock points.'} Awaiting other channels or the timer.</p>}
    </div>}
    {view.stage==='displacement'&&<div className="field-controls">
      <h2>{d?.role==='mover'?'PRIVATE // RELOCATE ANOTHER WITNESS’S OBJECT':d?.role==='investigator'?'PRIVATE // FIND YOUR MISSING SIGNAL':'WITNESS CHANNEL'}</h2>
      {d?.target&&<p>TARGET // {d.target.name} · ORIGINAL POSITION // {d.target.location}</p>}
      {d?.role==='investigator'&&d.phase==='find'&&<label>WHICH OBJECT DID YOU FIND?<select value={found} onChange={e=>setFound(e.target.value)}><option value="">Choose a real calibrated object</option>{view.objects.map(o=><option key={o.id} value={o.id}>{o.name} — {o.location}</option>)}</select></label>}
      {d?.role==='mover'&&d.phase==='find'&&!d.claim&&<><p>Publish one account. Other players can challenge this claim later.</p>{button('ADMIT: I RELOCATED THE OBJECT','movement-claim','admit')}{button('MISLEAD: I DID NOT RELOCATE IT','movement-claim','deny')}</>}
      {d&&d.phase!=='done'&&d.role!=='witness'&&button('CANNOT COMPLETE PHYSICAL TASK','unable-move')}
      {!d&&view.players.length>1&&a?.acquired&&!a.support&&button('OFFER MY PHOTOGRAPHED OBJECT AS A SAFE TARGET','offer-target')}{d?.outcome&&<p role="status">RESULT // {d.outcome}</p>}
      {view.players.length===1&&a&&<><label>WHERE WAS YOUR OBJECT IN THE CALIBRATION?<select value={found} onChange={e=>setFound(e.target.value)}><option value="">Choose the original location</option>{[...new Set(view.objects.map(o=>o.location))].map(location=><option key={location}>{location}</option>)}</select></label><p>Inspect your original photograph in the journal. Cite it to restore the baseline.</p>{view.evidence.filter(e=>e.kind==='acquisition').map(e=><button key={e.id} disabled={busy||!found} onClick={()=>void act('solo-baseline',found,e.id)}>RESTORE BASELINE WITH THIS PHOTO</button>)}</>}

      {!canPhoto&&<p>The encounter advances when recovery is submitted or time expires. Its outcome will remain in the final record.</p>}
    </div>}
    {canPhoto&&<div className="field-controls">
      <FieldEvidenceCamera key={`${view.stage}-${d?.phase}-${a?.photos}`} label={photoKind==='hide'?'OBJECT IN NEW POSITION':photoKind==='recover'?'RECOVERED OBJECT':'ASSIGNED OBJECT CLOSE-UP'} disabled={busy} onCapture={setPhoto}/>
      <button type="button" disabled={busy||!photo||!photoId} onClick={()=>void upload(photoKind,photoId!)}>TRANSMIT {photoKind==='hide'?'RELOCATION':photoKind==='recover'?'RECOVERY':'ACQUISITION'} PHOTO</button>
      <p>Only actual uploaded images enter the archive. Submitting a photo does not prove movement; independent witnesses must attest to the physical action.</p>
    </div>}
    {view.stage==='recruitment'&&<div className="field-controls">
      {r?<><h2>ARCHITECT OFFER // FOR YOUR EYES ONLY</h2><p>Publish my false account and escape identification: +200 points. Other witnesses can expose you for +150. You may refuse.</p>
        {r.accepted===null?<>{button('ACCEPT THE OFFER','recruit',true)}{button('REFUSE THE OFFER','recruit',false)}</>:r.accepted&&!r.published?<><p>{r.objective}</p>{button('PUBLISH THE ASSIGNED FALSE CLAIM','deceive')}</>:<p>{r.published?'False claim published. Defend it or reveal the truth at confrontation.':'Offer refused. Your refusal remains in the final ledger.'}</p>}
      </>:<p role="status">Watch what people claim about the event. A refusal ends the private offer without blocking the game. The next encounter is the shared signal.</p>}
    </div>}
    {view.stage==='cooperation'&&<div className="field-controls">
      {view.players.length>1?<><h2>PRIVATE RELAY INSTRUCTION</h2><p>Tell <strong>{view.cooperation.clue?.player}</strong>: “Your frequency is <strong>{view.cooperation.clue?.frequency}</strong>.” Someone else holds YOUR frequency. Ask them.</p>
        <label>YOUR FREQUENCY<select disabled={busy||view.cooperation.tuned} value={frequency} onChange={e=>setFrequency(e.target.value)}><option value="">Ask the other Lens</option>{symbols.map(s=><option key={s}>{s}</option>)}</select></label>
        {button(view.cooperation.tuned?'YOUR CHANNEL IS TUNED':'TUNE MY CHANNEL','tune',frequency,view.cooperation.tuned||!frequency)}
      </>:<><p>Reverse your earlier object-lock choices. Your original photo remains available in the evidence journal.</p><div>{lockOptions.map(s=><button key={s} disabled={busy||sequence.length>=lockSize||view.cooperation.tuned} onClick={()=>setSequence([...sequence,s])}>{s}</button>)}</div><p>{sequence.join(' → ')}</p><button disabled={busy} onClick={()=>setSequence([])}>RESET</button>{button('RESTORE THE MEMORY ECHO','tune',sequence.join('-'),sequence.length!==lockSize||view.cooperation.tuned)}</>}
      <p role="status">TUNED CHANNELS // {view.cooperation.tunedCount}/{view.cooperation.total} · TERMINAL PULSES // {view.cooperation.pulses}</p>
      {view.cooperation.windowRemainingSeconds!==null&&<p role="status">{view.cooperation.windowRemainingSeconds>0?`PULSE WINDOW // ${view.cooperation.windowRemainingSeconds}s remaining`:'PULSE WINDOW EXPIRED. Both TVs must pulse again; this is retryable.'}</p>}
      <p>When all channels are tuned: press SELECT on the first two Fire TVs within 12 seconds, or on the sole TV. A missed window can be retried.</p>
      {view.remainingSeconds<=20&&button('TV UNAVAILABLE: USE LENS RECOVERY RELAY','relay-fallback',undefined,view.cooperation.tunedCount!==view.cooperation.total)}
    </div>}
    {view.stage==='confrontation'&&<div className="field-controls">
      <h2>YOUR ASYMMETRIC LEDGER FRAGMENT</h2><p>{view.privateClue}</p>
      {!view.accused&&!view.responded&&<><label>SUSPECT<select value={suspect} onChange={e=>setSuspect(e.target.value)}><option value="">Choose a witness or the Architect</option><option value="architect">The Architect</option>{view.players.filter(p=>p.id!==playerId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>CITE AN ACTUAL EVENT<select value={citation} onChange={e=>setCitation(e.target.value)}><option value="">Choose from the ledger</option>{view.publicLedger.map(e=><option key={e.id} value={e.id}>{view.players.find(p=>p.id===e.playerId)?.name??'ARCHIVE'} // {e.kind}: {e.text.slice(0,130)}</option>)}</select></label>
        <button disabled={busy||!suspect||!citation} onClick={()=>void act('accuse',suspect,citation)}>SEAL ACCUSATION (+150 CORRECT / −100 FALSE)</button></>}
      <p>Reveal your photos in the journal below before completing your response.</p>
      {view.responded?<p role="status">RESPONSE RECORDED. Waiting for the other witnesses or the encounter timer.</p>:<>{button('DEFEND: I DID NOT DECEIVE YOU','respond','defend')}{button('CHALLENGE THE ARCHITECT’S INTERPRETATION','respond','challenge')}{d?.outcome&&button('I SAW THE RECOVERED OBJECT IN PERSON','respond','corroborate')}{button('WITHHOLD FURTHER TESTIMONY','respond','withhold')}</>}
    </div>}
    {view.stage==='decision'&&<div className="field-controls"><p>Your majority decides. A split or missing vote resolves by a recorded challenge to the Architect, then cooperation success. The ending will explain the rule.</p>{view.hasVoted?<p role="status">VOTE SEALED. Waiting for remaining votes or the timer.</p>:<>{button('PRESERVE THE CONTESTED ARCHIVE','vote','preserve')}{button('RELEASE THE RECORD TO THE WITNESSES','vote','release')}{button('CUT THE ARCHITECT’S NARRATIVE ACCESS','vote','erase')}</>}</div>}
    {view.stage==='complete'&&<section className="field-ending" aria-label="Expedition outcome">
      <div className="field-ending-kicker">TRANSMISSION CLOSED <span> // FINAL RECORD</span></div>
      <h2>{view.ending?.replace(/[-_]/g,' ').toUpperCase()||'RECORD SEALED'}</h2>
      <p className="field-ending-subtitle">The record reflects decisions and evidence from this expedition.</p>
      <div className="field-ending-message"><div className="field-ending-label">THE ARCHITECT // FINAL TRANSMISSION</div><p>{view.summary||'No final transmission was recorded.'}</p></div>
      <div className="field-ending-score"><div className="field-ending-label">WITNESS SCORES</div>
        {Object.entries(view.scores).length?Object.entries(view.scores).sort((a,b)=>b[1]-a[1]).map(([id,score])=><div className="field-ending-score-row" key={id}><span>{view.players.find(p=>p.id===id)?.name||'WITNESS'}</span><strong>{score.toLocaleString()} <small>PTS</small></strong></div>):<p>No scores recorded.</p>}
      </div>
      <p className="field-ending-footer">END OF SIGNAL // Review the evidence journal below.</p>
    </section>}
    <details className="field-log" open={view.stage==='confrontation'}><summary>EVIDENCE JOURNAL // {view.evidence.length} ACCESSIBLE PHOTOS</summary>
      {view.evidence.map(e=><div key={e.id}><strong>{e.kind.toUpperCase()} // {e.assessment.toUpperCase()}</strong><p>{e.detail}</p><button disabled={busy} onClick={()=>void inspect(e)}>INSPECT ACTUAL PHOTO</button>{view.stage==='confrontation'&&e.playerId===playerId&&!view.responded&&<button disabled={busy} onClick={()=>void act('reveal',undefined,e.id)}>REVEAL THIS PHOTO TO THE WITNESSES</button>}</div>)}
      {openPhoto&&<div><img style={{maxWidth:'100%'}} src={openPhoto.url} alt={`Actual submitted evidence ${openPhoto.id}`}/><button onClick={()=>setOpenPhoto(null)}>CLOSE IMAGE</button></div>}
      {view.events.map(e=><p key={e.id}><strong>{e.privateTo?'PRIVATE // ':''}{e.kind.toUpperCase()} {e.playerId?`// ${view.players.find(p=>p.id===e.playerId)?.name??'WITNESS'}`:''}</strong> · {e.text}</p>)}
    </details>
  </section>;
}
