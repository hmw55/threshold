import { useEffect, useState } from "react";
import { JoinScreen } from "./components/JoinScreen";
import { ConnectedScreen } from "./components/ConnectedScreen";
import { RoomScanner } from "./components/RoomScanner";
import { useExpeditionSession } from "./hooks/useExpeditionSession";
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
      </div>
    </main>
  );
}

export default App;
