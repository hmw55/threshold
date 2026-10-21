import { useEffect, useState } from "react";
import { JoinScreen } from "./components/JoinScreen";
import { ConnectedScreen } from "./components/ConnectedScreen";
import { RoomScanner } from "./components/RoomScanner";
import { useExpeditionSession } from "./hooks/useExpeditionSession";
import { FieldExpedition } from "./components/FieldExpedition";
import "./App.css";

function App() {
  const session = useExpeditionSession();

  const [scannerDismissed, setScannerDismissed] = useState(false);

  const isConnected = session.state === "connected";
  const isCalibrating =
    isConnected && session.phase === "calibrating";

  useEffect(() => {
    if (!isCalibrating) {
      setScannerDismissed(false);
    }
  }, [isCalibrating]);


  const showScanner = isCalibrating && !scannerDismissed;

  const showInvestigation =
    isConnected && (session.phase === "playing" || session.phase === "results");

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
        ) : showInvestigation ? (
          <FieldExpedition
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
        {showInvestigation && (
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
