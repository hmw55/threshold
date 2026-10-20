import { useCallback, useEffect, useState } from "react";
import {
  gameClient,
  type RevelationResponse,
} from "../services/gameClient";
import "./InvestigationScreen.css";
import "./RevelationScreen.css";

interface Props {
  sessionCode: string;
  playerId: string;
  playerToken: string;
  onComplete?: () => void;
}

export function RevelationScreen({
  sessionCode,
  playerId,
  playerToken,
  onComplete,
}: Props) {
  const [data, setData] = useState<RevelationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [narration, setNarration] = useState<string | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const refresh = useCallback(async () => {
    const result = await gameClient.getRevelation(
      sessionCode,
      playerId,
      playerToken,
    );
    setData(result);
  }, [sessionCode, playerId, playerToken]);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const result = await gameClient.getRevelation(
          sessionCode,
          playerId,
          playerToken,
        );

        if (active) {
          setData(result);
          setError(null);
        }
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to recover the archive.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [sessionCode, playerId, playerToken]);

  const isComplete = (id: string) =>
    data?.steps.some((step) => step.id === id && step.completed) ?? false;

  const isAvailable = (id: string) =>
    data?.steps.some((step) => step.id === id && step.available) ?? false;

  async function completeStep(interactionId: string) {
    if (busy || completed) return;

    setBusy(true);
    setError(null);

    try {
      await gameClient.completeRevelationStep(
        sessionCode,
        playerId,
        playerToken,
        interactionId,
      );

      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to complete investigation.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer() {
    if (!selectedChoice || busy || completed) return;

    setBusy(true);
    setError(null);

    try {
      const result = await gameClient.submitMissingWitnessAnswer(
        sessionCode,
        playerId,
        playerToken,
        selectedChoice,
      );

      setNarration(result.narration);

      if (result.correct) {
        setCompleted(true);
      } else {
        setSelectedChoice(null);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to decode the testimony.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="investigation-screen">
        <p>CONNECTING TO THE RECOVERED ARCHIVE...</p>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className="investigation-screen">
        <h2>ARCHIVE CONNECTION FAILED</h2>
        <p role="alert">{error}</p>
        <button type="button" onClick={() => window.location.reload()}>
          RETRY CONNECTION
        </button>
      </section>
    );
  }

  return (
    <section className="investigation-screen revelation-screen">
      <header className="investigation-header">
        <p className="investigation-kicker">[ THRESHOLD // ACT III ]</p>
        <h2 className="investigation-title">THE MISSING WITNESS</h2>
        <p className="investigation-message">
          The contradiction is real. The Architect's record is incomplete.
          Recover what was hidden.
        </p>
      </header>

      {error && <p role="alert">{error}</p>}

      <article className="revelation-panel">
        <h3>01 // INSPECT THE ARCHIVE</h3>
        {isComplete("inspect-archive") ? (
          <>
            <p>ARCHIVE ACCESS GRANTED</p>
            <blockquote>{data?.archive}</blockquote>
          </>
        ) : (
          <>
            <p>
              A sealed archive entry was recovered from the transmission.
              Its contents may explain the contradictory testimonies.
            </p>
            <button
              type="button"
              className="investigation-action investigation-action-primary"
              disabled={busy || !isAvailable("inspect-archive")}
              onClick={() => void completeStep("inspect-archive")}
            >
              {busy ? "PROCESSING..." : "OPEN ARCHIVE ENTRY"}
            </button>
          </>
        )}
      </article>

      {isComplete("inspect-archive") && (
        <article className="revelation-panel">
          <h3>02 // LOCATE THE RECEIVER</h3>
          <p>
            The transmission was received, but no acoustic event occurred
            inside the room. The unidentified observer may have been
            connected to the scanned environment.
          </p>

          {isComplete("locate-receiver") ? (
            <p>RECEIVER TRACE RECOVERED</p>
          ) : (
            <button
              type="button"
              className="investigation-action investigation-action-primary"
              disabled={busy || !isAvailable("locate-receiver")}
              onClick={() => void completeStep("locate-receiver")}
            >
              {busy ? "TRACING..." : "TRACE RECEIVER"}
            </button>
          )}
        </article>
      )}

      {isComplete("locate-receiver") && (
        <article className="revelation-panel">
          <h3>03 // DECODE THE TESTIMONY</h3>
          <p>
            The recovered signal and witness accounts can now be
            examined together.
          </p>

          {isComplete("decode-testimony") ? (
            <p>TESTIMONY DECODED</p>
          ) : (
            <button
              type="button"
              className="investigation-action investigation-action-primary"
              disabled={busy || !isAvailable("decode-testimony")}
              onClick={() => void completeStep("decode-testimony")}
            >
              {busy ? "DECODING..." : "DECODE RECOVERED EVIDENCE"}
            </button>
          )}
        </article>
      )}

      {data?.puzzle && !completed && (
        <article className="revelation-panel">
          <h3>04 // IDENTIFY THE MISSING WITNESS</h3>
          <p>{data.puzzle.prompt}</p>

          <div className="revelation-choices" role="group" aria-label="Recovered archive interpretations">
            {data.puzzle.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className="revelation-choice"
                aria-pressed={selectedChoice === choice.id}
                disabled={busy}
                onClick={() => setSelectedChoice(choice.id)}
              >
                {selectedChoice === choice.id ? "◉ " : "○ "}
                {choice.text}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="investigation-action investigation-action-primary revelation-submit"
            disabled={!selectedChoice || busy}
            onClick={() => void submitAnswer()}
          >
            {busy ? "VERIFYING..." : "SUBMIT INTERPRETATION"}
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
        <button
          type="button"
          className="investigation-action investigation-action-primary"
          onClick={onComplete}
        >
          CONTINUE TO THE FINAL DECISION
        </button>
      )}
    </section>
  );
}
