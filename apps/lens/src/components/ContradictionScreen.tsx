import { useCallback, useEffect, useRef, useState } from "react";
import {
  gameClient,
  type ContradictionResponse,
  type ContradictionStatement,
} from "../services/gameClient";
import "./InvestigationScreen.css";

interface Props {
  sessionCode: string;
  playerId: string;
  playerToken: string;
  onComplete?: () => void;
}

export function ContradictionScreen({
  sessionCode,
  playerId,
  playerToken,
  onComplete,
}: Props) {
  const [data, setData] = useState<ContradictionResponse | null>(null);
  const [selectedWitness, setSelectedWitness] = useState<string | null>(null);
  const [reviewedWitnesses, setReviewedWitnesses] = useState<string[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [narration, setNarration] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submittingRef = useRef(false);

  const refresh = useCallback(async () => {
    const result = await gameClient.getContradiction(
      sessionCode,
      playerId,
      playerToken,
    );
    setData(result);
    return result;
  }, [sessionCode, playerId, playerToken]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);

    gameClient
      .getContradiction(sessionCode, playerId, playerToken)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load witness records.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionCode, playerId, playerToken]);

  const completed = (id: string) =>
    data?.steps.some((step) => step.id === id && step.completed) ?? false;

  const collectCompleted = completed("collect-testimonies");
  const compareCompleted = completed("compare-accounts");
  const timelineCompleted = completed("reconstruct-timeline");

  async function completeStep(interactionId: string) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      await gameClient.completeContradictionStep(
        sessionCode,
        playerId,
        playerToken,
        interactionId,
      );
      await refresh();
      setNarration(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to record investigation progress.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function submitAnswer(statementId: string) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const result = await gameClient.submitContradictionAnswer(
        sessionCode,
        playerId,
        playerToken,
        statementId,
      );

      setNarration(result.narration);
      if (result.correct) {
        onComplete?.();
      } else {
        setSelectedWitness(null);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to verify the testimony.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const statements: ContradictionStatement[] =
    data?.statements ?? [];

  const timelineEvents = [
    { id: "recording", label: "The archive records the signal at 9:17 PM." },
    { id: "signal", label: "Two witnesses independently confirm hearing it." },
    { id: "silence", label: "One witness remembers the silence afterward." },
  ];

  return (
    <section className="terminal-panel connected-panel investigation-screen">
      <header className="investigation-header">
        <p className="investigation-kicker">
          [ THRESHOLD // INVESTIGATION ]
        </p>
        <h1 className="investigation-title">THE LAST WITNESS</h1>
        <p className="investigation-kicker">
          ACT II // THE CONTRADICTION
        </p>
      </header>

      {loading ? (
        <div className="investigation-transmission" role="status">
          <p className="investigation-message">
            Retrieving witness records...
          </p>
        </div>
      ) : !data ? (
        <div className="investigation-transmission">
          <p className="investigation-message">
            Witness records unavailable.
          </p>
          <button
            type="button"
            className="investigation-action"
            onClick={() => {
              setLoading(true);
              void refresh()
                .catch((caught: unknown) =>
                  setError(caught instanceof Error ? caught.message : "Retry failed.")
                )
                .finally(() => setLoading(false));
            }}
          >
            RETRY CONNECTION
          </button>
        </div>
      ) : !collectCompleted ? (
        <>
          <div className="investigation-transmission">
            <p className="investigation-label">
              [ ARCHITECT // WITNESS RECOVERY ]
            </p>
            <p className="investigation-message">
              Three witnesses were present when the signal was recorded.
              Recover their accounts before drawing a conclusion.
            </p>
          </div>
          <button
            type="button"
            className="investigation-action investigation-action-primary"
            disabled={submitting}
            onClick={() => void completeStep("collect-testimonies")}
          >
            RECOVER WITNESS RECORDS
          </button>
        </>
      ) : !compareCompleted ? (
        <>
          <div className="investigation-success">
            ✓ THREE TESTIMONIES RECOVERED
          </div>
          <div className="investigation-transmission">
            <p className="investigation-label">
              [ ARCHITECT // COMPARE ACCOUNTS ]
            </p>
            <p className="investigation-message">
              The archive confirms a signal at 9:17 PM.
              Read each account before comparing them.
            </p>
          </div>
          <div className="investigation-objects">
            {statements.map((statement) => (
              <button
                key={statement.id}
                type="button"
                className="investigation-object"
                onClick={() =>
                  setReviewedWitnesses((current) =>
                    current.includes(statement.id)
                      ? current
                      : [...current, statement.id],
                  )
                }
              >
                <span className="investigation-object-name">
                  WITNESS // {statement.witness}
                </span>
                <span className="investigation-fragment-content">
                  {statement.testimony}
                </span>
                {reviewedWitnesses.includes(statement.id) && (
                  <span className="investigation-kicker">[ REVIEWED ]</span>
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="investigation-action investigation-action-primary"
            disabled={
              submitting ||
              statements.length === 0 ||
              reviewedWitnesses.length !== statements.length
            }
            onClick={() => void completeStep("compare-accounts")}
          >
            COMPLETE ACCOUNT COMPARISON
          </button>
        </>
      ) : !timelineCompleted ? (
        <>
          <div className="investigation-transmission">
            <p className="investigation-label">
              [ ARCHITECT // TIMELINE RECONSTRUCTION ]
            </p>
            <p className="investigation-message">
              Review the sequence of verified events.
              Select each piece of evidence to assemble the timeline.
            </p>
          </div>
          <div className="investigation-objects">
            {timelineEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                className="investigation-object"
                disabled={selectedEvents.includes(event.id)}
                onClick={() =>
                  setSelectedEvents((current) => [...current, event.id])
                }
              >
                <span className="investigation-fragment-content">
                  {event.label}
                </span>
                {selectedEvents.includes(event.id) && (
                  <span className="investigation-kicker">[ ADDED ]</span>
                )}
              </button>
            ))}
          </div>
          <div className="investigation-transmission">
            <p className="investigation-label">
              [ RECONSTRUCTED EVIDENCE ]
            </p>
            <ol className="investigation-sequence">
              {selectedEvents.map((id) => (
                <li key={id}>
                  {timelineEvents.find((event) => event.id === id)?.label}
                </li>
              ))}
            </ol>
          </div>
          <div className="investigation-actions">
            <button
              type="button"
              className="investigation-action"
              disabled={submitting || selectedEvents.length === 0}
              onClick={() =>
                setSelectedEvents((current) => current.slice(0, -1))
              }
            >
              UNDO LAST
            </button>
            <button
              type="button"
              className="investigation-action investigation-action-primary"
              disabled={submitting || selectedEvents.length !== timelineEvents.length}
              onClick={() => void completeStep("reconstruct-timeline")}
            >
              CONFIRM TIMELINE
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="investigation-success">
            ✓ TIMELINE RECONSTRUCTED
          </div>
          <div className="investigation-transmission">
            <p className="investigation-label">
              [ ARCHITECT // CONTRADICTION DETECTED ]
            </p>
            <p className="investigation-message">
              {data.puzzle?.prompt ??
                "Which testimony contradicts the recording?"}
            </p>
          </div>
          <div className="investigation-objects">
            {(data.puzzle?.statements ?? statements).map((statement) => (
              <button
                key={statement.id}
                type="button"
                className="investigation-object"
                disabled={submitting}
                onClick={() => setSelectedWitness(statement.id)}
              >
                <span className="investigation-object-name">
                  {statement.witness}
                </span>
                <span className="investigation-fragment-content">
                  {statement.testimony}
                </span>
                {selectedWitness === statement.id && (
                  <span className="investigation-kicker">[ SELECTED ]</span>
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="investigation-action investigation-action-primary"
            disabled={submitting || !selectedWitness}
            onClick={() => {
              if (selectedWitness) void submitAnswer(selectedWitness);
            }}
          >
            IDENTIFY CONTRADICTION
          </button>
        </>
      )}

      {submitting && (
        <p className="investigation-kicker" role="status">
          [ ANALYZING EVIDENCE... ]
        </p>
      )}

      {narration && (
        <div className="investigation-transmission" role="status">
          <p className="investigation-label">
            [ ARCHITECT RESPONSE ]
          </p>
          <p className="investigation-message">{narration}</p>
        </div>
      )}

      {error && (
        <p className="investigation-error" role="alert">
          [ ERROR ] {error}
        </p>
      )}

      <footer className="terminal-footer">
        <span>THRESHOLD // LENS</span>
        <span>ACT II</span>
      </footer>
    </section>
  );
}
