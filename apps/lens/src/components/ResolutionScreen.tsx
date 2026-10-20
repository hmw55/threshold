import { useEffect, useState } from "react";
import {
  gameClient,
  type GameEnding,
} from "../services/gameClient";
import "./InvestigationScreen.css";

interface Props {
  sessionCode: string;
  playerId: string;
  playerToken: string;
  onComplete?: () => void;
}

const endings: {
  id: GameEnding;
  title: string;
  description: string;
  consequence: string;
  epilogue: string;
}[] = [
  {
    id: "preservation",
    title: "PRESERVATION",
    description:
      "Preserve the Architect's original account, despite its omissions.",
    consequence:
      "The established record survives. The missing witness remains outside the official story.",
    epilogue:
      "The Architect seals the archive. Its account remains intact, coherent, and incomplete. The signal fades from the official record, but you know what was left behind. Some truths survive only in the memories of those who refuse to forget.",
  },
  {
    id: "fracture",
    title: "FRACTURE",
    description:
      "Reject the Architect's authority and dismantle its version of events.",
    consequence:
      "The old narrative collapses. What replaces it is uncertain.",
    epilogue:
      "You sever the Architect's claim to the truth. The archive fractures into conflicting accounts, none permitted to rule over the others. The certainty is gone. In its place remains a question no single voice can answer.",
  },
  {
    id: "reconciliation",
    title: "RECONCILIATION",
    description:
      "Restore the missing testimony and build a more complete account.",
    consequence:
      "The Architect must acknowledge the witness it failed to recognize.",
    epilogue:
      "The recovered testimony enters the archive. The Architect revises its account, not by erasing the contradiction, but by admitting what it could not hear. The missing witness finally has a place in the story. The truth was never a single voice.",
  },
];

export function ResolutionScreen({
  sessionCode,
  playerId,
  playerToken,
  onComplete,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GameEnding | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [ending, setEnding] = useState<GameEnding | null>(null);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const result = await gameClient.getGameState(
          sessionCode,
          playerId,
          playerToken,
        );

        if (!active) return;

        if (result.game.phase === "complete") {
          const savedEnding = result.game.ending;

          if (
            savedEnding === "preservation" ||
            savedEnding === "fracture" ||
            savedEnding === "reconciliation"
          ) {
            setEnding(savedEnding);
          } else {
            setError("The final decision could not be recovered.");
          }
        } else if (result.game.phase !== "resolution") {
          setError("The final decision is not available yet.");
        }
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to recover the final decision.",
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

  async function submitDecision() {
    if (!selected || busy || ending) return;

    setBusy(true);
    setError(null);

    try {
      const result = await gameClient.submitEnding(
        sessionCode,
        playerId,
        playerToken,
        selected,
      );

      if (result.game.phase !== "complete") {
        throw new Error("The final decision was not completed.");
      }

      setEnding(result.game.ending);
      setConfirming(false);
      onComplete?.();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to record the final decision.",
      );

      // If the server committed the choice but the response was lost,
      // recover the authoritative state before allowing another attempt.
      try {
        const state = await gameClient.getGameState(
          sessionCode,
          playerId,
          playerToken,
        );

        if (
          state.game.phase === "complete" &&
          (
            state.game.ending === "preservation" ||
            state.game.ending === "fracture" ||
            state.game.ending === "reconciliation"
          )
        ) {
          setEnding(state.game.ending);
          setConfirming(false);
          setError(null);
          onComplete?.();
        }
      } catch {
        // Preserve the original error and allow an explicit retry.
      }
    } finally {
      setBusy(false);
    }
  }

  const selectedEnding = endings.find((item) => item.id === selected);
  const finalEnding = endings.find((item) => item.id === ending);

  if (loading) {
    return (
      <section className="investigation-screen">
        <p className="investigation-kicker">
          RECOVERING THE FINAL RECORD...
        </p>
      </section>
    );
  }

  if (ending && finalEnding) {
    return (
      <section className="investigation-screen">
        <header className="investigation-header">
          <p className="investigation-kicker">
            THE LAST WITNESS // TRANSMISSION COMPLETE
          </p>
          <h2 className="investigation-title">
            {finalEnding.title}
          </h2>
        </header>

        <article className="investigation-transmission">
          <p className="investigation-label">FINAL RECORD</p>
          <p className="investigation-message">
            {finalEnding.epilogue}
          </p>
        </article>

        <p className="investigation-success">
          FINAL DECISION RECORDED // EXPEDITION COMPLETE
        </p>

        <p>
          THE LAST WITNESS
        </p>
      </section>
    );
  }

  return (
    <section className="investigation-screen">
      <header className="investigation-header">
        <p className="investigation-kicker">
          THE LAST WITNESS // FINAL ACT
        </p>
        <h2 className="investigation-title">
          WHO OWNS THE TRUTH?
        </h2>
        <p className="investigation-message">
          The signal was real. The witness was missing, not mistaken.
          The Architect's record is incomplete. What happens to that
          record is now your decision.
        </p>
      </header>

      {error && (
        <p className="investigation-error" role="alert">
          {error}
        </p>
      )}

      {!confirming ? (
        <>
          <article className="investigation-transmission">
            <p className="investigation-label">
              THREE POSSIBLE FUTURES
            </p>
            <p className="investigation-message">
              Choose what the Architect will do with the truth.
              This decision cannot be reversed.
            </p>
          </article>

          <div
            className="investigation-objects"
            role="group"
            aria-label="Final ending choices"
          >
            {endings.map((option) => (
              <button
                key={option.id}
                type="button"
                className="investigation-object"
                aria-pressed={selected === option.id}
                disabled={busy}
                onClick={() => setSelected(option.id)}
                style={{
                  borderColor:
                    selected === option.id
                      ? "var(--investigation-cyan)"
                      : undefined,
                }}
              >
                <span className="investigation-object-name">
                  {selected === option.id ? "◉ " : "○ "}
                  {option.title}
                </span>
                <span className="investigation-fragment-content">
                  {option.description}
                </span>
                <span className="investigation-object-location">
                  {option.consequence}
                </span>
              </button>
            ))}
          </div>

          <div className="investigation-actions">
            <button
              type="button"
              className="investigation-action investigation-action-primary"
              disabled={!selected || busy}
              onClick={() => setConfirming(true)}
            >
              REVIEW FINAL DECISION
            </button>
          </div>
        </>
      ) : (
        <article className="investigation-transmission">
          <p className="investigation-label">
            FINAL CONFIRMATION
          </p>
          <h3>{selectedEnding?.title}</h3>
          <p className="investigation-message">
            {selectedEnding?.consequence}
          </p>
          <p>
            This choice will permanently complete the current expedition.
          </p>

          <div className="investigation-actions">
            <button
              type="button"
              className="investigation-action"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              GO BACK
            </button>
            <button
              type="button"
              className="investigation-action investigation-action-primary"
              disabled={busy}
              onClick={() => void submitDecision()}
            >
              {busy ? "RECORDING..." : "CONFIRM FINAL DECISION"}
            </button>
          </div>
        </article>
      )}
    </section>
  );
}
