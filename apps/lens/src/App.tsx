import { JoinScreen } from "./components/JoinScreen";
import { ConnectedScreen } from "./components/ConnectedScreen";
import { useExpeditionSession } from "./hooks/useExpeditionSession";
import "./App.css";

function App() {
  const session = useExpeditionSession();
  return (
    <main className="lens">
      <div className="signal-noise" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      <div className="lens-shell">
        <header className="system-header">
          <span>THRESHOLD // LENS</span>
          <span className="system-indicator">
            <span className="indicator-dot" />
            {session.state === "connected" ? "LINK ACTIVE" : "STANDBY"}
          </span>
        </header>
        <div className="header-rule" />
        {session.state === "join" ? (
          <JoinScreen
            sessionCode={session.sessionCode}
            setSessionCode={session.setSessionCode}
            playerName={session.playerName}
            setPlayerName={session.setPlayerName}
            isConnecting={session.isConnecting}
            error={session.error}
            onJoin={session.connect}
          />
        ) : (
          <ConnectedScreen
            sessionCode={session.sessionCode}
            player={session.player}
            isDisconnecting={session.isDisconnecting}
            error={session.error}
            onDisconnect={session.disconnect}
          />
        )}
      </div>
    </main>
  );
}

export default App;
