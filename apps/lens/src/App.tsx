import { useEffect, useState } from "react";
import { JoinScreen } from "./components/JoinScreen";
import { ConnectedScreen } from "./components/ConnectedScreen";
import { RoomScanner } from "./components/RoomScanner";
import { useExpeditionSession } from "./hooks/useExpeditionSession";
import { InvestigationScreen } from "./components/InvestigationScreen";
import { ContradictionScreen } from "./components/ContradictionScreen";
import { RevelationScreen } from "./components/RevelationScreen";
import { ResolutionScreen } from "./components/ResolutionScreen";
import { gameClient, type GamePhase } from "./services/gameClient";
import "./App.css";

function App() {
  const session = useExpeditionSession();

  const [scannerDismissed, setScannerDismissed] = useState(false);
  const [gamePhase, setGamePhase] = useState<GamePhase | null>(null);

  const isConnected = session.state === "connected";
  const isCalibrating =
    isConnected && session.phase === "calibrating";

  useEffect(() => {
    if (!isCalibrating) {
      setScannerDismissed(false);
    }
  }, [isCalibrating]);


  useEffect(() => {
    if (
      !isConnected ||
      session.phase !== "playing" ||
      !session.player ||
      !session.playerToken
    ) {
      setGamePhase(null);
      return;
    }

    let cancelled = false;
    let inFlight = false;

    const code = session.sessionCode;
    const playerId = session.player.id;
    const token = session.playerToken;

    async function synchronizeGamePhase() {
      if (inFlight) return;
      inFlight = true;

      try {
        const result = await gameClient.getGameState(
          code,
          playerId,
          token,
        );

        if (!cancelled) {
          setGamePhase(result.game.phase);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Unable to synchronize game phase:", error);
        }
      } finally {
        inFlight = false;
      }
    }

    setGamePhase(null);
    void synchronizeGamePhase();

    const interval = window.setInterval(() => {
      void synchronizeGamePhase();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    isConnected,
    session.phase,
    session.sessionCode,
    session.player?.id,
    session.playerToken,
  ]);

  const showScanner = isCalibrating && !scannerDismissed;

  const showInvestigation =
    isConnected && session.phase === "playing";

  return (
    <main className="lens">
      <div className="signal-noise" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />

      <div className="lens-shell">
        {!showScanner && (
          <>
            <header className="system-header">
              <span>THRESHOLD // LENS</span>

              <span className="system-indicator">
                <span className="indicator-dot" />
                {isConnected ? "LINK ACTIVE" : "STANDBY"}
              </span>
            </header>

            <div className="header-rule" />
          </>
        )}

        {!isConnected ? (
          <JoinScreen
            sessionCode={session.sessionCode}
            setSessionCode={session.setSessionCode}
            playerName={session.playerName}
            setPlayerName={session.setPlayerName}
            isConnecting={session.isConnecting}
            error={session.error}
            onJoin={session.connect}
          />
        ) : showScanner ? (
          <RoomScanner
            sessionCode={session.sessionCode}
            playerId={session.player!.id}
            playerToken={session.playerToken!}
            thresholds={session.thresholds}
            onClose={() => setScannerDismissed(true)}
          />
        ) : showInvestigation && gamePhase === "contradiction" ? (
          <ContradictionScreen
            sessionCode={session.sessionCode}
            playerId={session.player!.id}
            playerToken={session.playerToken!}
            onComplete={() => setGamePhase("revelation")}
          />
        ) : showInvestigation && gamePhase === "revelation" ? (
          <RevelationScreen
            sessionCode={session.sessionCode}
            playerId={session.player!.id}
            playerToken={session.playerToken!}
            onComplete={() => setGamePhase("resolution")}
          />
        ) : showInvestigation &&
          (gamePhase === "resolution" || gamePhase === "complete") ? (
          <ResolutionScreen
            sessionCode={session.sessionCode}
            playerId={session.player!.id}
            playerToken={session.playerToken!}
            onComplete={() => setGamePhase("complete")}
          />
        ) : showInvestigation && gamePhase === null ? (
          <section className="investigation-screen">
            <p className="investigation-kicker">
              SYNCHRONIZING EXPEDITION...
            </p>
          </section>
        ) : showInvestigation ? (
          <InvestigationScreen
            sessionCode={session.sessionCode}
            playerId={session.player!.id}
            playerToken={session.playerToken!}
          />
        ) : (
          <>
            <ConnectedScreen
              sessionCode={session.sessionCode}
              player={session.player}
              isDisconnecting={session.isDisconnecting}
              error={session.error}
              onDisconnect={session.disconnect}
            />

            {isCalibrating && (
              <button
                type="button"
                className="scanner-reopen-button"
                onClick={() => setScannerDismissed(false)}
              >
                REOPEN SCANNER
              </button>
            )}
          </>
        )}
        {isConnected && session.phase === "playing" && (
          <button
            type="button"
            onClick={() => void session.disconnect()}
            disabled={session.isDisconnecting}
            style={{
              display: "block",
              width: "100%",
              marginTop: "16px",
              marginBottom: "16px",
              flexShrink: 0,
              padding: "16px",
              border: "1px solid #6b3944",
              background: "#1b1118",
              color: "#ff9ba9",
              fontFamily: "inherit",
              fontSize: "14px",
              letterSpacing: "2px",
              cursor: "pointer",
            }}
          >
            {session.isDisconnecting
              ? "DISCONNECTING..."
              : "LEAVE EXPEDITION"}
          </button>
        )}
      </div>
    </main>
  );
}

export default App;
