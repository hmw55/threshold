import { useCallback, useEffect, useRef, useState } from "react";
import { gameClient, type PlayerMission, type PlayerMissionsResponse } from "../services/gameClient";
import "./MissionOverlay.css";

interface Props {
  sessionCode: string;
  playerId: string;
  playerToken: string;
}

export function MissionOverlay({ sessionCode, playerId, playerToken }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PlayerMissionsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, setPending] = useState<{ mission: PlayerMission; file: File; url: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const targetMission = useRef<PlayerMission | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    const result = await gameClient.getMissions(sessionCode, playerId, playerToken);
    if (alive.current) setData(result);
  }, [sessionCode, playerId, playerToken]);

  useEffect(() => {
    alive.current = true;
    let inFlight = false;
    async function poll() {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        await refresh();
        if (alive.current) setError(null);
      } catch (cause) {
        if (alive.current) setError(cause instanceof Error ? cause.message : "Mission uplink unavailable");
      } finally {
        inFlight = false;
      }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    return () => { alive.current = false; window.clearInterval(timer); };
  }, [refresh]);

  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.url); }, [pending]);

  function capture(mission: PlayerMission) {
    if (busy) return;
    targetMission.current = mission;
    if (fileRef.current) {
      fileRef.current.value = "";
      fileRef.current.click();
    }
  }

  function chooseFile(file?: File) {
    const mission = targetMission.current;
    if (!file || !mission) return;
    if (!file.type.startsWith("image/")) { setError("Select a photograph or image."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("Image must be 8 MB or smaller."); return; }
    setError(null);
    setFeedback(null);
    setPending({ mission, file, url: URL.createObjectURL(file) });
  }

  async function transmit() {
    if (!pending || busy) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const result = await gameClient.submitPhysicalMissionEvidence(
        sessionCode, playerId, playerToken, pending.mission.id, pending.file,
      );
      if (!alive.current) return;
      setFeedback(result.feedback || (result.accepted ? "Evidence accepted." : "Evidence rejected. Try a clearer photo."));
      await refresh();
      setPending(null);
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : "Evidence transmission failed. Retry when ready.");
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  const missions = data?.missions ?? [];
  const active = missions.filter((mission) => mission.status !== "completed" && mission.status !== "failed");
  const completed = missions.filter((mission) => mission.status === "completed");

  return (
    <aside className="mission-uplink" aria-label="Mission uplink">
      <button className="mission-uplink-toggle" type="button" onClick={() => setOpen((value) => !value)}
        aria-expanded={open} aria-controls="mission-uplink-content">
        <span>◈ DIRECTIVES {active.length > 0 ? `(${active.length})` : ""}</span>
        <span>{data ? `${data.score} PTS` : "SYNCING"} {open ? "▲" : "▼"}</span>
      </button>
      <input ref={fileRef} className="mission-uplink-file" type="file" accept="image/*" capture="environment"
        aria-label="Photograph mission evidence" onChange={(event) => chooseFile(event.target.files?.[0])} />
      {open && (
        <div id="mission-uplink-content" className="mission-uplink-content">
          <p className="mission-uplink-caption">ARCHITECT // PRIVATE AND SHARED OBJECTIVES</p>
          {error && <p className="mission-uplink-error" role="alert">{error}</p>}
          {feedback && <p className="mission-uplink-feedback" role="status">{feedback}</p>}
          {pending && (
            <section className="mission-uplink-item" aria-label="Review evidence before transmission">
              <p className="mission-uplink-caption">EVIDENCE PREVIEW // {pending.mission.title}</p>
              <img src={pending.url} alt="Photograph selected as mission evidence" style={{ width: "100%", maxHeight: 280, objectFit: "contain" }} />
              <p>Only transmit a photograph you intend to share with the Architect.</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" disabled={busy} onClick={() => void transmit()}>
                  {busy ? "TRANSMITTING..." : "TRANSMIT EVIDENCE"}
                </button>
                <button type="button" disabled={busy} onClick={() => setPending(null)}>CANCEL</button>
              </div>
            </section>
          )}
          {!pending && active.length === 0 && <p className="mission-uplink-empty">No active directives. Await further instructions.</p>}
          {!pending && active.map((mission) => (
            <article className="mission-uplink-item" key={mission.id}>
              <div className="mission-uplink-meta">
                <span>{mission.private ? "PRIVATE // EYES ONLY" : "SHARED DIRECTIVE"}</span>
                <span>+{mission.points} PTS</span>
              </div>
              <h3>{mission.title}</h3>
              <p>{mission.description}</p>
              <button type="button" onClick={() => capture(mission)} disabled={busy}>
                CAPTURE / UPLOAD EVIDENCE
              </button>
            </article>
          ))}
          {completed.length > 0 && <p className="mission-uplink-caption">COMPLETED // {completed.length}</p>}
          {completed.map((mission) => <p className="mission-uplink-completed" key={mission.id}>✓ {mission.title}</p>)}
        </div>
      )}
    </aside>
  );
}
