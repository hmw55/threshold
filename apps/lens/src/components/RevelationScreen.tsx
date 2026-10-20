import { useCallback, useEffect, useRef, useState } from "react";
import { gameClient, type RevelationResponse } from "../services/gameClient";
import "./InvestigationScreen.css";
import "./RevelationScreen.css";

interface Props {
  sessionCode: string;
  playerId: string;
  playerToken: string;
  onComplete?: () => void;
}

type ReceiverType = "screen" | "speaker" | "reflection" | "other";

const receiverTypes: { id: ReceiverType; title: string; hint: string }[] = [
  { id: "screen", title: "SCREEN / DISPLAY", hint: "Something that can show a message without speaking." },
  { id: "speaker", title: "SPEAKER / RADIO", hint: "Something that could carry a transmission." },
  { id: "reflection", title: "MIRROR / WINDOW", hint: "Something that could reveal a second point of view." },
  { id: "other", title: "SOMETHING ELSE", hint: "A different object in your actual environment." },
];

export function RevelationScreen({ sessionCode, playerId, playerToken, onComplete }: Props) {
  const [data, setData] = useState<RevelationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [narration, setNarration] = useState<string | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [receiverType, setReceiverType] = useState<ReceiverType | null>(null);
  const [receiverLocation, setReceiverLocation] = useState("");
  const [receiverReason, setReceiverReason] = useState("");
  const [archiveReviewed, setArchiveReviewed] = useState(false);
  const [interpretationConfirmed, setInterpretationConfirmed] = useState(false);

  const refresh = useCallback(async () => {
    const result = await gameClient.getRevelation(sessionCode, playerId, playerToken);
    setData(result);
    return result;
  }, [sessionCode, playerId, playerToken]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    gameClient.getRevelation(sessionCode, playerId, playerToken)
      .then((result) => { if (active) { setData(result); setError(null); } })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to recover the archive.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionCode, playerId, playerToken]);

  const step = (id: string) => data?.steps.find((item) => item.id === id);
  const done = (id: string) => Boolean(step(id)?.completed);
  const available = (id: string) => Boolean(step(id)?.available);
  const canSubmitReceiver = Boolean(
    receiverType && receiverLocation.trim().length >= 3 && receiverReason.trim().length >= 20,
  );

  async function completeStep(interactionId: string) {
    if (busyRef.current || completed) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await gameClient.completeRevelationStep(
        sessionCode,
        playerId,
        playerToken,
        interactionId,
        interactionId === "locate-receiver"
          ? `${receiverType}: ${receiverLocation.trim()}. ${receiverReason.trim()}`
          : undefined,
      );
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to record the evidence.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function submitAnswer() {
    if (!selectedChoice || !interpretationConfirmed || busyRef.current || completed) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await gameClient.submitMissingWitnessAnswer(
        sessionCode, playerId, playerToken, selectedChoice,
      );
      setNarration(result.narration);
      if (result.correct) {
        setCompleted(true);
      } else {
        setSelectedChoice(null);
        setInterpretationConfirmed(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to verify the interpretation.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  if (loading) return <section className="investigation-screen" role="status">CONNECTING TO THE RECOVERED ARCHIVE...</section>;
  if (!data) return (
    <section className="investigation-screen">
      <h2>ARCHIVE CONNECTION FAILED</h2>
      <p role="alert">{error ?? "The archive could not be loaded."}</p>
      <button type="button" onClick={() => window.location.reload()}>RETRY CONNECTION</button>
    </section>
  );

  return (
    <section className="investigation-screen revelation-screen">
      <header className="investigation-header">
        <p className="investigation-kicker">[ THRESHOLD // ACT III ]</p>
        <h2 className="investigation-title">THE MISSING WITNESS</h2>
        <p className="investigation-message">
          The Architect's record contradicts the room itself. Recover the evidence, inspect
          your surroundings, and decide who was really listening.
        </p>
      </header>

      {error && <p role="alert">{error}</p>}

      <article className="revelation-panel">
        <h3>01 // UNSEAL THE ARCHIVE {done("inspect-archive") ? "✓" : ""}</h3>
        {done("inspect-archive") ? (
          <>
            <p>Recovered record:</p>
            <blockquote>{data.archive}</blockquote>
            <label style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "flex-start" }}>
              <input type="checkbox" checked={archiveReviewed} onChange={(event) => setArchiveReviewed(event.target.checked)} />
              I have read the record and identified what the Architect left unexplained.
            </label>
          </>
        ) : (
          <>
            <p>Open the sealed record. The next clue is inside, not on the television.</p>
            <button type="button" className="investigation-action investigation-action-primary"
              disabled={busy || !available("inspect-archive")}
              onClick={() => void completeStep("inspect-archive")}>
              {busy ? "OPENING..." : "OPEN ARCHIVE"}
            </button>
          </>
        )}
      </article>

      {done("inspect-archive") && (
        <article className="revelation-panel">
          <h3>02 // SEARCH YOUR ACTUAL ROOM {done("locate-receiver") ? "✓" : ""}</h3>
          {done("locate-receiver") ? (
            <p>RECEIVER TRACE RECOVERED. The room is part of the testimony.</p>
          ) : (
            <>
              <p>Move away from the Lens. Find a real object that could receive, reflect,
                display, or preserve a signal. The Architect cannot choose it for you.</p>
              <div className="revelation-choices" role="group" aria-label="Receiver type">
                {receiverTypes.map((item) => (
                  <button key={item.id} type="button" className="revelation-choice"
                    aria-pressed={receiverType === item.id} disabled={busy}
                    onClick={() => setReceiverType(item.id)}>
                    <strong>{item.title}</strong>
                    <span style={{ display: "block", marginTop: 5, opacity: 0.8 }}>{item.hint}</span>
                  </button>
                ))}
              </div>
              <label htmlFor="receiver-location">Where is the object?</label>
              <input id="receiver-location" value={receiverLocation} maxLength={120}
                onChange={(event) => setReceiverLocation(event.target.value)}
                placeholder="Example: on the bookshelf beside the door"
                style={{ display: "block", width: "100%", padding: 12, margin: "8px 0 16px", boxSizing: "border-box" }} />
              <label htmlFor="receiver-reason">Why could it be connected to the missing signal?</label>
              <textarea id="receiver-reason" rows={4} maxLength={500} value={receiverReason}
                onChange={(event) => setReceiverReason(event.target.value)}
                placeholder="Describe something you can actually observe, not a guess about the story."
                style={{ display: "block", width: "100%", padding: 12, margin: "8px 0 12px", boxSizing: "border-box" }} />
              <p style={{ opacity: 0.7, fontSize: 12 }}>At least 20 characters of physical evidence required.</p>
              <button type="button" className="investigation-action investigation-action-primary"
                disabled={busy || !available("locate-receiver") || !archiveReviewed || !canSubmitReceiver}
                onClick={() => void completeStep("locate-receiver")}>
                {busy ? "TRACING..." : "REGISTER PHYSICAL EVIDENCE"}
              </button>
              {!archiveReviewed && <p>Read and acknowledge the archive before submitting.</p>}
            </>
          )}
        </article>
      )}

      {done("locate-receiver") && (
        <article className="revelation-panel">
          <h3>03 // DECODE THE TESTIMONY {done("decode-testimony") ? "✓" : ""}</h3>
          {done("decode-testimony") ? (
            <p>THE TESTIMONY IS READY FOR INTERPRETATION.</p>
          ) : (
            <>
              <p>Compare the recovered archive with what you found in the physical room.
                The same signal may have more than one observer.</p>
              <button type="button" className="investigation-action investigation-action-primary"
                disabled={busy || !available("decode-testimony")}
                onClick={() => void completeStep("decode-testimony")}>
                {busy ? "DECODING..." : "DECODE TESTIMONY"}
              </button>
            </>
          )}
        </article>
      )}

      {data.puzzle && !completed && (
        <article className="revelation-panel">
          <h3>04 // NAME THE MISSING WITNESS</h3>
          <p>{data.puzzle.prompt}</p>
          <div className="revelation-choices" role="group" aria-label="Witness interpretations">
            {data.puzzle.choices.map((choice) => (
              <button key={choice.id} type="button" className="revelation-choice"
                aria-pressed={selectedChoice === choice.id} disabled={busy}
                onClick={() => { setSelectedChoice(choice.id); setInterpretationConfirmed(false); }}>
                {selectedChoice === choice.id ? "◉ " : "○ "}{choice.text}
              </button>
            ))}
          </div>
          {selectedChoice && (
            <label style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "flex-start" }}>
              <input type="checkbox" checked={interpretationConfirmed}
                onChange={(event) => setInterpretationConfirmed(event.target.checked)} />
              This interpretation accounts for the recovered record and the receiver evidence.
            </label>
          )}
          <button type="button" className="investigation-action investigation-action-primary revelation-submit"
            disabled={!selectedChoice || !interpretationConfirmed || busy}
            onClick={() => void submitAnswer()}>
            {busy ? "VERIFYING..." : "COMMIT INTERPRETATION"}
          </button>
        </article>
      )}

      {narration && (
        <article className="revelation-panel" aria-live="polite">
          <h3>{completed ? "THE TRUTH RECOVERED" : "INTERPRETATION REJECTED"}</h3>
          <p>{narration}</p>
        </article>
      )}
      {completed && (
        <button type="button" className="investigation-action investigation-action-primary"
          onClick={onComplete}>CONTINUE TO THE FINAL DECISION</button>
      )}
    </section>
  );
}
