
import { useEffect, useRef, useState } from "react";
import { gameClient } from "../services/gameClient";
import type {
  AnchorPuzzleResponse,
  PlayerMissionsResponse,
  GamePhase,
  SignalFragment,
  TransmissionFragment,
} from "../services/gameClient";
import "./InvestigationScreen.css";

interface Props {
  sessionCode: string;
  playerId: string;
  playerToken: string;
}

type InvestigationStage =
  | "anchor"
  | "transmission"
  | "reconstruction"
  | "reconstructed";

export function InvestigationScreen({
  sessionCode,
  playerId,
  playerToken,
}: Props) {
  const [stage, setStage] =
    useState<InvestigationStage>("anchor");

  const [gamePhase, setGamePhase] =
    useState<GamePhase>("investigation");

  const [anchor, setAnchor] =
    useState<AnchorPuzzleResponse | null>(null);

  const [transmissionFragments, setTransmissionFragments] =
    useState<TransmissionFragment[]>([]);

  const [signalFragments, setSignalFragments] =
    useState<SignalFragment[]>([]);

  const [selectedOrder, setSelectedOrder] =
    useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [narration, setNarration] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);

  const [missionData, setMissionData] = useState<PlayerMissionsResponse | null>(null);

  const [examinedObjectRef, setExaminedObjectRef] = useState<string | null>(null);
  const [observation, setObservation] = useState("");
  const [physicalEvidence, setPhysicalEvidence] = useState<File | null>(null);
  const [physicalEvidencePreview, setPhysicalEvidencePreview] =
    useState<string | null>(null);
  const [physicalEvidenceFeedback, setPhysicalEvidenceFeedback] =
    useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (physicalEvidencePreview) {
        URL.revokeObjectURL(physicalEvidencePreview);
      }
    };
  }, [physicalEvidencePreview]);

  const submittingRef = useRef(false);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    async function synchronize() {
      if (inFlight || submittingRef.current) return;

      inFlight = true;
      const requestVersion = requestVersionRef.current;

      try {
        const gameState = await gameClient.getGameState(
          sessionCode,
          playerId,
          playerToken,
        );

        if (
          cancelled ||
          requestVersion !== requestVersionRef.current
        ) return;

        setGamePhase(gameState.game.phase);
        setError(null);

        try {
          const missions = await gameClient.getMissions(
            sessionCode,
            playerId,
            playerToken,
          );

          if (
            !cancelled &&
            requestVersion === requestVersionRef.current
          ) {
            setMissionData(missions);
          }
        } catch {
          // Mission telemetry should not interrupt gameplay.
        }

        if (gameState.game.phase !== "investigation") {
          return;
        }

        const anchorResult = await gameClient.getAnchorPuzzle(
          sessionCode,
          playerId,
          playerToken,
        );

        if (
          cancelled ||
          requestVersion !== requestVersionRef.current
        ) return;

        setAnchor(anchorResult);

        if (!anchorResult.puzzle.completed) {
          setStage("anchor");
          return;
        }

        const transmission =
          await gameClient.getTransmissionFragments(
            sessionCode,
            playerId,
            playerToken,
          );

        if (
          cancelled ||
          requestVersion !== requestVersionRef.current
        ) return;

        setTransmissionFragments(transmission.fragments);

        if (!transmission.completed) {
          setStage("transmission");
          return;
        }

        const reconstruction =
          await gameClient.getSignalFragments(
            sessionCode,
            playerId,
            playerToken,
          );

        if (
          cancelled ||
          requestVersion !== requestVersionRef.current
        ) return;

        setSignalFragments(reconstruction.fragments);

        setStage(
          reconstruction.completed
            ? "reconstructed"
            : "reconstruction",
        );
      } catch (caught) {
        if (
          !cancelled &&
          requestVersion === requestVersionRef.current
        ) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to synchronize investigation.",
          );
        }
      } finally {
        inFlight = false;

        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    setLoading(true);
    setStage("anchor");
    setGamePhase("investigation");
    setAnchor(null);
    setTransmissionFragments([]);
    setSignalFragments([]);
    setSelectedOrder([]);
    setNarration(null);
    setMissionData(null);
    setExaminedObjectRef(null);
    setObservation("");
    setError(null);

    void synchronize();

    const interval = window.setInterval(() => {
      void synchronize();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [sessionCode, playerId, playerToken]);

  function beginSubmission() {
    submittingRef.current = true;
    requestVersionRef.current += 1;
    setSubmitting(true);
    setError(null);
  }

  function endSubmission() {
    submittingRef.current = false;
    setSubmitting(false);
  }

  async function inspectObject(objectRef: string) {
    if (
      submittingRef.current ||
      loading ||
      stage !== "anchor"
    ) return;

    if (examinedObjectRef !== objectRef || observation.trim().length < 15) {
      setError("Record an observation before submitting.");
      return;
    }

    beginSubmission();

    try {
      const result = await gameClient.submitAnchorAnswer(
        sessionCode,
        playerId,
        playerToken,
        objectRef,
        observation.trim(),
      );

      setNarration(result.narration);

      if (result.correct) {
        const transmission =
          await gameClient.getTransmissionFragments(
            sessionCode,
            playerId,
            playerToken,
          );

        setTransmissionFragments(transmission.fragments);

        if (transmission.completed) {
          const reconstruction =
            await gameClient.getSignalFragments(
              sessionCode,
              playerId,
              playerToken,
            );

          setSignalFragments(reconstruction.fragments);
          setStage(
            reconstruction.completed
              ? "reconstructed"
              : "reconstruction",
          );
        } else {
          setStage("transmission");
        }
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Investigation failed.",
      );
    } finally {
      endSubmission();
    }
  }

  async function recoverFragment(fragmentId: string) {
    if (
      submittingRef.current ||
      loading ||
      stage !== "transmission"
    ) return;

    beginSubmission();

    try {
      const result =
        await gameClient.submitTransmissionAnswer(
          sessionCode,
          playerId,
          playerToken,
          fragmentId,
        );

      setNarration(result.narration);

      if (result.correct) {
        const reconstruction =
          await gameClient.getSignalFragments(
            sessionCode,
            playerId,
            playerToken,
          );

        setSignalFragments(reconstruction.fragments);

        setStage(
          reconstruction.completed
            ? "reconstructed"
            : "reconstruction",
        );
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Transmission recovery failed.",
      );
    } finally {
      endSubmission();
    }
  }

  async function submitPhysicalEvidence(missionId: string) {
    if (
      submittingRef.current ||
      !physicalEvidence ||
      !missionId.startsWith("physical-arrangement-")
    ) {
      return;
    }

    beginSubmission();
    setPhysicalEvidenceFeedback(null);

    try {
      const result = await gameClient.submitPhysicalMissionEvidence(
        sessionCode,
        playerId,
        playerToken,
        missionId,
        physicalEvidence,
      );

      setPhysicalEvidenceFeedback(result.feedback);

      if (result.accepted) {
        const missions = await gameClient.getMissions(
          sessionCode,
          playerId,
          playerToken,
        );
        setMissionData(missions);
        setNarration(result.feedback);

        setPhysicalEvidence(null);
        setPhysicalEvidencePreview((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return null;
        });
      }
    } catch (caught) {
      setPhysicalEvidenceFeedback(
        caught instanceof Error
          ? caught.message
          : "Evidence verification failed. Please try again.",
      );
    } finally {
      try {
        const missions = await gameClient.getMissions(
          sessionCode,
          playerId,
          playerToken,
        );
        setMissionData(missions);
      } catch {
        // Keep the verification result visible if refresh fails.
      }
      endSubmission();
    }
  }

  function selectPhysicalEvidence(file: File | null) {
    setPhysicalEvidenceFeedback(null);

    setPhysicalEvidencePreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return file ? URL.createObjectURL(file) : null;
    });

    setPhysicalEvidence(file);
  }

  function selectSignalFragment(fragmentId: string) {
    if (
      submittingRef.current ||
      stage !== "reconstruction"
    ) return;

    setSelectedOrder((current) =>
      current.includes(fragmentId)
        ? current
        : [...current, fragmentId],
    );
  }

  function undoSignalSelection() {
    if (submittingRef.current) return;

    setSelectedOrder((current) => current.slice(0, -1));
  }

  async function submitReconstruction() {
    if (
      submittingRef.current ||
      loading ||
      stage !== "reconstruction" ||
      signalFragments.length === 0 ||
      selectedOrder.length !== signalFragments.length
    ) return;

    beginSubmission();

    try {
      const result =
        await gameClient.submitSignalReconstruction(
          sessionCode,
          playerId,
          playerToken,
          selectedOrder,
        );

      setNarration(result.narration);

      if (result.correct) {
        setStage("reconstructed");
        setGamePhase("contradiction");
      } else {
        setSelectedOrder([]);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Signal reconstruction failed.",
      );
    } finally {
      endSubmission();
    }
  }

  return (
    <section className="terminal-panel connected-panel investigation-screen">
      <header className="investigation-header">
        <p className="investigation-kicker">
          [ THRESHOLD // INVESTIGATION ]
        </p>

        <h1 className="investigation-title">
          THE LAST WITNESS
        </h1>

        <p className="investigation-kicker">
          {gamePhase === "investigation"
            ? "ACT I // THE FIRST SIGNAL"
            : gamePhase === "contradiction"
              ? "ACT II // THE CONTRADICTION"
              : gamePhase === "revelation"
                ? "ACT III // THE REVELATION"
                : gamePhase === "resolution"
                  ? "THE FINAL DECISION"
                  : gamePhase === "complete"
                    ? "EXPEDITION COMPLETE"
                    : "AWAITING GAME START"}
        </p>
      </header>

      {missionData && (
        <aside
          className="investigation-transmission"
          aria-label="Personal missions"
        >
          <p className="investigation-label">
            [ LENS // PRIVATE ASSIGNMENTS ]
          </p>

          <p className="investigation-message">
            YOUR SCORE: {missionData.score} POINTS
          </p>

          {missionData.missions
            .filter((mission) =>
              mission.assignedPlayerIds.includes(playerId)
            )
            .map((mission) => (
              <div key={mission.id} className="investigation-mission">
                <p className="investigation-label">
                  {mission.private ? "[ CLASSIFIED ] " : "[ MISSION ] "}
                  {mission.status === "completed"
                    ? "COMPLETE"
                    : "ACTIVE"}{" "}
                  // {mission.points} PTS
                </p>
                <strong>{mission.title}</strong>
                <p>{mission.description}</p>

                {mission.id === "physical-arrangement-" + playerId &&
                  mission.status !== "completed" &&
                  mission.status !== "failed" && (
                    <div className="physical-evidence">
                      <p className="investigation-label">
                        // PHYSICAL EVIDENCE REQUIRED
                      </p>

                      <p className="investigation-message">
                        Arrange three safe household objects in a visible
                        line from smallest to largest. Photograph the actual
                        arrangement so the Architect can verify it.
                      </p>

                      <label className="investigation-action investigation-action-primary physical-evidence-picker">
                        {physicalEvidence ? "RETAKE PHOTOGRAPH" : "TAKE EVIDENCE PHOTO"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          capture="environment"
                          disabled={submitting}
                          onChange={(event) => {
                            selectPhysicalEvidence(
                              event.currentTarget.files?.[0] ?? null
                            );
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>

                      {physicalEvidencePreview && (
                        <div className="physical-evidence-preview">
                          <img
                            src={physicalEvidencePreview}
                            alt="Preview of physical mission evidence"
                          />
                          <p className="investigation-message">
                            {physicalEvidence?.name}
                          </p>
                          <button
                            type="button"
                            className="investigation-action"
                            disabled={submitting}
                            onClick={() => selectPhysicalEvidence(null)}
                          >
                            REMOVE PHOTO
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        className="investigation-action investigation-action-primary"
                        disabled={submitting || !physicalEvidence}
                        onClick={() => void submitPhysicalEvidence(mission.id)}
                      >
                        {submitting ? "VERIFYING EVIDENCE..." : "SUBMIT FOR VERIFICATION"}
                      </button>

                      {physicalEvidenceFeedback && (
                        <p className="investigation-message" role="status">
                          {physicalEvidenceFeedback}
                        </p>
                      )}
                    </div>
                  )}
              </div>
            ))}
        </aside>
      )}

      {!loading && gamePhase !== "investigation" ? (
        <div className="investigation-transmission" role="status">
          <p className="investigation-label">
            [ ARCHITECT // PHASE TRANSITION ]
          </p>
          <p className="investigation-message">
            {gamePhase === "contradiction"
              ? "ACT II // THE CONTRADICTION. The recovered testimony does not agree with the archive. Prepare to examine the witnesses."
              : gamePhase === "revelation"
                ? "ACT III // THE REVELATION. A missing witness has been identified."
                : gamePhase === "resolution"
                  ? "FINAL DECISION // The truth is yours to decide."
                  : gamePhase === "complete"
                    ? "EXPEDITION COMPLETE."
                    : "The Architect is preparing the investigation."}
          </p>
        </div>
      ) : loading ? (
        <div
          className="investigation-transmission"
          role="status"
        >
          <p className="investigation-label">
            [ ESTABLISHING CONNECTION ]
          </p>
          <p className="investigation-message">
            Synchronizing with the Architect...
          </p>
        </div>
      ) : (
        <>
          {stage === "anchor" && anchor && (
            <>
              <div className="investigation-transmission">
                <p className="investigation-label">
                  [ ARCHITECT TRANSMISSION ]
                </p>
                <p className="investigation-message">
                  {anchor.puzzle.clue}
                </p>
              </div>

              <div>
                <p className="investigation-label">
                  // CHOOSE AN OBJECT TO EXAMINE
                </p>

                {examinedObjectRef && (
                  <div className="investigation-transmission">
                    <p className="investigation-label">
                      [ LENS // FIELD EXAMINATION ]
                    </p>
                    <p>
                      Examine this object in your surroundings.
                      What do you notice?
                    </p>
                    <textarea
                      aria-label="Field observation"
                      value={observation}
                      onChange={(event) => setObservation(event.target.value)}
                      placeholder="Describe what you actually observe..."
                      rows={4}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: 12,
                        background: "#071017",
                        color: "#fff",
                        border: "1px solid #20c6d8",
                      }}
                    />
                    <button
                      type="button"
                      className="investigation-object"
                      disabled={submitting || observation.trim().length < 15}
                      onClick={() => void inspectObject(examinedObjectRef)}
                    >
                      SUBMIT INVESTIGATION
                    </button>
                  </div>
                )}

                <div className="investigation-objects">
                  {anchor.objects.map((object) => (
                    <button
                      key={object.ref}
                      type="button"
                      className="investigation-object"
                      disabled={submitting}
                      onClick={() => {
                        setExaminedObjectRef(object.ref);
                        setObservation("");
                        setNarration(null);
                        setError(null);
                      }}
                    >
                      <span className="investigation-object-name">
                        {object.name}
                      </span>

                      {object.location && (
                        <span className="investigation-object-location">
                          {object.location}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {anchor.objects.length === 0 && (
                  <p className="investigation-message">
                    No confirmed environmental objects available.
                  </p>
                )}
              </div>
            </>
          )}

          {stage === "transmission" && (
            <>
              <div className="investigation-success">
                ✓ ANCHOR IDENTIFIED
              </div>

              <div className="investigation-transmission">
                <p className="investigation-label">
                  [ ARCHITECT // INTERCEPTED SIGNAL ]
                </p>
                <p className="investigation-message">
                  Three fragments survived the transmission.
                  Only one contains the witness's testimony.
                  Identify the fragment carrying the voice.
                </p>
              </div>

              <div>
                <p className="investigation-label">
                  // SELECT A TRANSMISSION FRAGMENT
                </p>

                <div className="investigation-objects">
                  {transmissionFragments.map((fragment) => (
                    <button
                      key={fragment.id}
                      type="button"
                      className="investigation-object"
                      disabled={submitting}
                      onClick={() =>
                        void recoverFragment(fragment.id)
                      }
                    >
                      <span className="investigation-object-name">
                        {fragment.label}
                      </span>
                      <span className="investigation-fragment-content">
                        {fragment.content}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {stage === "reconstruction" && (
            <>
              <div className="investigation-success">
                ✓ TRANSMISSION RECOVERED
              </div>

              <div className="investigation-transmission">
                <p className="investigation-label">
                  [ ARCHITECT // TIMELINE RECONSTRUCTION ]
                </p>
                <p className="investigation-message">
                  Three events remain in the archive.
                  Select them in the order they occurred to
                  reconstruct the witness's timeline.
                </p>
              </div>

              <div>
                <p className="investigation-label">
                  // AVAILABLE SIGNAL FRAGMENTS
                </p>

                <div className="investigation-objects">
                  {signalFragments.map((fragment) => {
                    const selected =
                      selectedOrder.includes(fragment.id);

                    return (
                      <button
                        key={fragment.id}
                        type="button"
                        className="investigation-object"
                        disabled={submitting}
                        onClick={() => {
                          if (selected) {
                            setSelectedOrder((current) =>
                              current.filter((id) => id !== fragment.id)
                            );
                          } else {
                            selectSignalFragment(fragment.id);
                          }
                        }}
                      >
                        <span className="investigation-object-name">
                          {fragment.timestamp}
                        </span>

                        <span className="investigation-fragment-content">
                          {fragment.description}
                        </span>

                        {selected && (
                          <span className="investigation-kicker">
                            [ SELECTED ]
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="investigation-transmission">
                <p className="investigation-label">
                  [ RECONSTRUCTED SEQUENCE ]
                </p>

                {selectedOrder.length === 0 ? (
                  <p className="investigation-message">
                    Select the first event to begin.
                  </p>
                ) : (
                  <ol className="investigation-sequence">
                    {selectedOrder.map((id) => {
                      const fragment =
                        signalFragments.find(
                          (item) => item.id === id,
                        );

                      return (
                        <li key={id}>
                          {fragment?.timestamp} —{" "}
                          {fragment?.description}
                        </li>
                      );
                    })}
                  </ol>
                )}

                <div className="investigation-actions">
                  <button
                    type="button"
                    className="investigation-action"
                    disabled={
                      submitting ||
                      selectedOrder.length === 0
                    }
                    onClick={undoSignalSelection}
                  >
                    UNDO LAST
                  </button>

                  <button
                    type="button"
                    className="investigation-action investigation-action-primary"
                    disabled={
                      submitting ||
                      signalFragments.length === 0 ||
                      selectedOrder.length !==
                        signalFragments.length
                    }
                    onClick={() =>
                      void submitReconstruction()
                    }
                  >
                    RECONSTRUCT SIGNAL
                  </button>
                </div>
              </div>
            </>
          )}

          {stage === "reconstructed" && (
            <>
              <div className="investigation-success">
                ✓ SIGNAL RECONSTRUCTED
              </div>

              <div className="investigation-transmission">
                <p className="investigation-label">
                  [ ARCHITECT // REVELATION ]
                </p>
                <p className="investigation-message">
                  The testimony was recorded before the event
                  occurred. The witness remembers something
                  that hasn't happened yet.
                </p>
              </div>
            </>
          )}

          {submitting && (
            <p
              className="investigation-kicker"
              role="status"
            >
              [ ANALYZING SIGNAL... ]
            </p>
          )}

          {narration && (
            <div
              className="investigation-transmission"
              role="status"
              aria-live="polite"
            >
              <p className="investigation-label">
                [ ARCHITECT RESPONSE ]
              </p>
              <p className="investigation-message">
                {narration}
              </p>
            </div>
          )}
        </>
      )}

      {error && (
        <p
          className="investigation-error"
          role="alert"
        >
          [ ERROR ] {error}
        </p>
      )}

      <footer className="terminal-footer">
        <span>THRESHOLD // LENS</span>
        <span>{gamePhase === "investigation" ? "ACT I" : gamePhase === "contradiction" ? "ACT II" : gamePhase === "revelation" ? "ACT III" : "THRESHOLD"}</span>
      </footer>
    </section>
  );
}
