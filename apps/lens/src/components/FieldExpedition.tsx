import { useEffect, useRef, useState } from "react";
import { normalizeCode, playerHeaders, request } from "../services/apiClient";
import "./FieldExpedition.css";
import "./RoomScanner.css";

type FieldStage = "survey" | "signal" | "exchange" | "fracture" | "verdict" | "complete";
type FieldAction = "observe" | "examine" | "move" | "rotate" | "reposition" | "safe_alternative";
interface FieldObject { id: string; name: string; location: string }
interface FieldView {
  stage: FieldStage; title: string; transmission: string; revision: number;
  progress: number; total: number; target: FieldObject | null; prompt: string; privateInstruction: string | null;
  allegiance: {offer: string; accepted: boolean | null; completed: boolean; exposed: boolean} | null;
  puzzle: {id: string; prompt: string; choices: {id: string; label: string}[]; solvedBy: string[]} | null;
  architectLog: string[];
  scoreEvents: {reason: string; points: number}[];
  role: string; submitted: boolean; received: number; required: number;
  objects: FieldObject[]; prior: {playerId: string; stage: string; player: string; object: string; observation: string}[];
  ending: string | null; votes: number; hasVoted: boolean; playerCount: number; elapsedSeconds: number;
}
interface Props { sessionCode: string; playerId: string; playerToken: string }
export function FieldExpedition({sessionCode, playerId, playerToken}: Props) {
  const [view, setView] = useState<FieldView | null>(null);
  const [objectId, setObjectId] = useState("");
  const [observation, setObservation] = useState("");
  const [choice, setChoice] = useState("preserve");
  const [action, setAction] = useState<FieldAction>("observe");
  const [detail, setDetail] = useState("");
  const [exposeTarget, setExposeTarget] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [captured, setCaptured] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [newObject, setNewObject] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const busyRef = useRef(false);
  const stageRef = useRef<FieldStage | null>(null);
  const base = `/sessions/${normalizeCode(sessionCode)}/field`;
  const headers = playerHeaders(playerId, playerToken);
  useEffect(() => {
    let active = true;
    let inFlight = false;
    async function poll() {
      if (inFlight || busyRef.current) return;
      inFlight = true;
      try {
        const next = await request<FieldView>(base, {headers});
        if (!active) return;
        if (stageRef.current !== null && stageRef.current !== next.stage) {
          setObservation(""); setObjectId("");
          setFeedback(""); setError("");
        }
        stageRef.current = next.stage;
        setView(next);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Connection interrupted"); }
      finally { inFlight = false; }
    }
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 1800);
    return () => { active = false; window.clearInterval(timer); };
  // Authentication and session identifiers are stable throughout this mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCode, playerId, playerToken]);
  useEffect(() => {
    if (!cameraActive) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("CAMERA UNAVAILABLE. USE THE SAFE DESCRIBE OPTION OR ENABLE CAMERA ACCESS.");
      return;
    }
    let cancelled = false;
    void navigator.mediaDevices.getUserMedia({audio: false, video: {facingMode: {ideal: "environment"}, width: {ideal: 1920}, height: {ideal: 1080}}})
      .then(async stream => {
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      })
      .catch(() => setError("CAMERA UNAVAILABLE. USE THE SAFE DESCRIBE OPTION OR ENABLE CAMERA ACCESS."));
    return () => { cancelled = true; streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null; };
  }, [cameraActive]);
  useEffect(() => () => { if (capturedUrl) URL.revokeObjectURL(capturedUrl); }, [capturedUrl]);
  async function submit() {
    if (busyRef.current || !view) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const body = new FormData();
      body.append("objectId", objectId || view.target?.id || "");
      body.append("observation", observation);
      body.append("action", action);
      if (detail.trim()) body.append("detail", detail.trim());
      if (captured) body.append("image", captured, "field-evidence.jpg");
      const result = await request<{accepted: boolean; view: FieldView}>(`${base}/observation`, {
        method: "POST", headers, body,
      });
      setView(result.view); setFeedback("Evidence received. The Architect has updated the shared signal.");
      setObservation(""); setDetail(""); setCaptured(null); setCapturedUrl(null); setObjectId(""); setCameraActive(false);
      stageRef.current = result.view.stage;
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed. Your evidence is still here; retry."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(blob => { if (!blob) return; setCaptured(blob); setCapturedUrl(URL.createObjectURL(blob)); setCameraActive(false); }, "image/jpeg", 0.9);
  }
  function retake() { setCaptured(null); setCapturedUrl(null); setCameraActive(true); }
  async function answerPuzzle(choiceId: string) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try { const result = await request<{correct: boolean; narration: string; view: FieldView}>(`${base}/puzzle`, {method: "POST", headers: {...headers, "Content-Type": "application/json"}, body: JSON.stringify({choiceId})}); setView(result.view); setFeedback(result.narration); }
    catch (e) { setError(e instanceof Error ? e.message : "DEDUCTION NOT RECEIVED"); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function answerAllegiance(accepted: boolean) {
    try { const result = await request<{view: FieldView}>(`${base}/allegiance`, {method: "POST", headers: {...headers, "Content-Type": "application/json"}, body: JSON.stringify({accepted})}); setView(result.view); }
    catch (e) { setError(e instanceof Error ? e.message : "PRIVATE DIRECTIVE UNAVAILABLE"); }
  }
  async function expose(targetId = exposeTarget) {
    if (!targetId) return;
    try { const result = await request<{exposed: boolean; narration: string; view: FieldView}>(`${base}/expose`, {method: "POST", headers: {...headers, "Content-Type": "application/json"}, body: JSON.stringify({targetPlayerId: targetId})}); setView(result.view); setFeedback(result.narration); setExposeTarget(null); }
    catch (e) { setError(e instanceof Error ? e.message : "EXPOSURE NOT RECEIVED"); }
  }
  async function registerObject() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const result = await request<{object: FieldObject}>(`${base}/objects`, {
        method: "POST", headers, body: JSON.stringify({name: newObject, location: newLocation}),
      });
      setObjectId(result.object.id);
      setNewObject(""); setNewLocation("");
      setFeedback(`Confirmed ${result.object.name}. You can now investigate it.`);
      const next = await request<FieldView>(base, {headers});
      setView(next);
    } catch (e) { setError(e instanceof Error ? e.message : "Object could not be confirmed."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function vote() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const result = await request<{view: FieldView}>(`${base}/verdict`, {
        method: "POST", headers, body: JSON.stringify({choice}),
      });
      setView(result.view); setFeedback("Your decision has been transmitted.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Decision not received. Try again.";
      if (message.toLowerCase().includes("failed to fetch")) {
        try {
          await new Promise(resolve => window.setTimeout(resolve, 500));
          const recovered = await request<FieldView>(base, {headers});
          if (recovered.hasVoted || recovered.stage === "complete") {
            setView(recovered); setFeedback("The Architect received your decision after the connection recovered.");
          } else {
            const retry = await request<{view: FieldView}>(`${base}/verdict`, {method: "POST", headers, body: JSON.stringify({choice})});
            setView(retry.view); setFeedback("Your decision has been transmitted.");
          }
        } catch { setError("The Architect could not confirm this decision. Check the connection and transmit again."); }
      } else setError(message);
    }
    finally { busyRef.current = false; setBusy(false); }
  }
  if (!view) return <section className="field-panel"><p>CONNECTING TO THE ARCHITECT...</p>{error && <p role="alert">{error}</p>}</section>;
  const voted = view.stage === "verdict" && view.hasVoted;
  return <section className="field-panel">
    <div className="field-eyebrow">THE LAST WITNESS // {view.role}</div>
    <div className="field-meter"><div style={{width: `${100 * view.progress / view.total}%`}} /></div>
    <h1>{view.title}</h1>
    <blockquote className="field-transmission">{view.transmission}</blockquote>
    {view.privateInstruction && (
      <details className="field-private field-directive">
        <summary>
          <span>PRIVATE DIRECTIVE // YOU ARE THE OBSERVER</span>
          <span className="field-directive-toggle" aria-hidden="true">+</span>
        </summary>
        <div className="field-directive-body">
          <p>{view.privateInstruction}</p>
        </div>
      </details>
    )}
    {view.allegiance && view.allegiance.accepted === null && <aside className="field-allegiance"><strong>ARCHITECT OFFER // PRIVATE</strong><p>{view.allegiance.offer === "deceive" ? "Mislead the shared record once. If another operative exposes the inconsistency, they gain the reward instead." : "Cooperate with the Architect's evidence trail for extra points."}</p><div><button type="button" onClick={() => void answerAllegiance(true)}>ACCEPT</button><button type="button" onClick={() => void answerAllegiance(false)}>REJECT</button></div></aside>}
    {view.allegiance && view.allegiance.accepted === null
      ? <section className="field-offer-gate" aria-live="polite">
          <span className="field-offer-gate-signal">AWAITING OPERATIVE DECISION</span>
          <p>The Architect is waiting for your answer.</p>
          <p className="field-offer-gate-hint">Your investigation will resume after you decide.</p>
        </section>
      : view.stage === "complete" ? <div className="field-ending">
      <h2>THE ROOM IS STILL HERE.</h2>
      <p>FINAL DECISION // {view.ending?.toUpperCase()}</p>
      <p>You chose what the Architect may carry away. Every observation came from a real witness in a real place.</p>
      <p>END OF TRANSMISSION</p>
    </div> : <>
      <p className="field-prompt">{view.prompt}</p>
      {view.target && <p className="field-target">SUGGESTED ANCHOR // {view.target.name} · {view.target.location}</p>}
      {view.puzzle && view.puzzle.solvedBy.length === 0 && <div className="field-puzzle"><strong>DEDUCTION FROM VERIFIED RECORDS</strong><p>{view.puzzle.prompt}</p>{view.puzzle.choices.map(item => <button key={item.id} type="button" disabled={busy} onClick={() => void answerPuzzle(item.id)}>{item.label}</button>)}</div>}
      {view.stage !== "verdict" && <details className="field-log"><summary>CONFIRM ANOTHER REAL OBJECT OR ROOM</summary>
        <div className="field-controls">
          <label htmlFor="field-new-object">OBJECT YOU CAN ACTUALLY SEE</label>
          <input id="field-new-object" value={newObject} maxLength={80} onChange={e => setNewObject(e.target.value)} placeholder="e.g. lamp, dog bed, table" />
          <label htmlFor="field-new-location">WHERE IT REALLY IS</label>
          <input id="field-new-location" value={newLocation} maxLength={80} onChange={e => setNewLocation(e.target.value)} placeholder="e.g. living room" />
          <button disabled={busy || newObject.trim().length < 2 || newLocation.trim().length < 2} onClick={() => void registerObject()}>CONFIRM REAL OBJECT</button>
        </div>
      </details>}
      {view.stage === "verdict" ? <div className="field-controls">
        <p>Choose what happens to the evidence collected here.</p>
        <label><input type="radio" name="verdict" value="preserve" checked={choice === "preserve"} onChange={() => setChoice("preserve")}/> Preserve the record</label>
        <label><input type="radio" name="verdict" value="release" checked={choice === "release"} onChange={() => setChoice("release")}/> Release the truth to the witnesses</label>
        <label><input type="radio" name="verdict" value="erase" checked={choice === "erase"} onChange={() => setChoice("erase")}/> Erase the Architect's copy</label>
        <button disabled={busy || voted} onClick={() => void vote()}>{busy ? "TRANSMITTING..." : voted ? "VOTE RECEIVED" : "TRANSMIT DECISION"}</button>
        <p>{view.votes} / {view.required} decisions received</p>
      </div> : view.puzzle && view.puzzle.solvedBy.length === 0 ? null : <div className="field-controls">
        {view.objects.length === 0 ? <p role="alert">No confirmed objects yet. Use “Discover another real object or room” above to confirm one before continuing.</p> : <>
          <label htmlFor="field-object">REAL OBJECT TO INVESTIGATE</label>
          <select id="field-object" value={objectId || view.target?.id || ""} onChange={e => setObjectId(e.target.value)}>
            {view.objects.map(o => <option key={o.id} value={o.id}>{o.name} — {o.location}</option>)}
          </select>
        <label htmlFor="field-action">PHYSICAL INTERACTION</label>
        <select id="field-action" value={action} onChange={e => setAction(e.target.value as FieldAction)}>
          <option value="observe">Observe in place</option><option value="examine">Examine a close-up detail</option><option value="move">Move safely</option><option value="rotate">Rotate safely</option><option value="reposition">Reposition safely</option><option value="safe_alternative">Safe alternative: describe without handling</option>
        </select>
        <small>Never move fragile, hot, sharp, heavy, private, or unsafe objects. Use the safe alternative when unsure.</small>
        <label htmlFor="field-observation">WHAT DID YOU ACTUALLY SEE OR CHANGE?</label>
        <textarea id="field-observation" rows={5} maxLength={1200} value={observation} onChange={e => setObservation(e.target.value)} placeholder="What did you actually observe or do? What changed, or what did you discover?" />
          <label htmlFor="field-detail">CLOSE-UP DETAIL (YEAR, MODEL, MARKING, OR OTHER LEGIBLE FACT)</label>
          <input id="field-detail" value={detail} maxLength={240} onChange={e => setDetail(e.target.value)} placeholder="Only enter a detail you can read or verify." />
          {cameraActive || capturedUrl ? <div className="scanner-viewport field-camera-viewport">
            {!capturedUrl && <video ref={videoRef} className="scanner-live-video" autoPlay playsInline muted aria-label="Live close-up camera view" />}
            {capturedUrl && <img className="scanner-captured-image" src={capturedUrl} alt="Captured close-up evidence" />}
            <div className="scanner-camera-tint" aria-hidden="true" /><div className="scanner-camera-scanlines" aria-hidden="true" />
            <header className="scanner-hud-header"><div><span className="scanner-hud-brand">THRESHOLD // LENS</span><span className="scanner-hud-subtitle">CLOSE-UP // EVIDENCE CAPTURE</span></div><span className="scanner-camera-status"><span className="indicator-dot" />{capturedUrl ? "IMAGE CAPTURED" : "OPTICS ACTIVE"}</span></header>
            {!capturedUrl && <div className="scanner-hud-reticle" aria-hidden="true"><span className="scanner-crosshair">+</span></div>}
            <div className="scanner-hud-bottom"><div className="scanner-hud-message"><span className="scanner-hud-label">[ ARCHITECT TRANSMISSION ]</span><p>{capturedUrl ? "Review the close-up. Retake if the detail is unreadable." : "Frame the confirmed object detail. Do not handle unsafe objects."}</p></div><div className="scanner-hud-actions">{capturedUrl ? <button type="button" className="scanner-hud-secondary" onClick={retake}>RETAKE</button> : <button type="button" className="scanner-hud-primary" onClick={capture}>CAPTURE EVIDENCE</button>}<button type="button" className="scanner-hud-secondary" onClick={() => { setCameraActive(false); setCaptured(null); setCapturedUrl(null); }}>CANCEL</button></div></div>
          </div> : <button type="button" onClick={() => setCameraActive(true)}>OPEN ARCHITECT CAMERA</button>}
          <button disabled={busy || observation.trim().length < 12 || !view.objects.length || (["examine", "move", "rotate", "reposition"].includes(action) && !captured)} onClick={() => void submit()}>{busy ? "TRANSMITTING..." : "SUBMIT VERIFIED REPORT"}</button>
          <small>Photos support the report. The Architect accepts only legible, grounded evidence and may ask you to retry.</small>
        </>}
      </div>}
    </>}
    {error && <p className="field-error" role="alert">{error}</p>}
    {feedback && <p className="field-feedback" role="status">{feedback}</p>}
    {view.prior.length > 0 && <details className="field-log"><summary>RECENT WITNESS RECORDS ({view.prior.length})</summary>
      {view.prior.map((r,i) => <div key={`${r.stage}-${i}`}><strong>{r.player} // {r.object}</strong><p>{r.observation}</p>{r.playerId !== playerId && <button type="button" onClick={() => { setExposeTarget(r.playerId); void expose(r.playerId); }}>EXPOSE INCONSISTENCY</button>}</div>)}
    </details>}
  </section>;
}
