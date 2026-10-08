import { useEffect, useState, type FormEvent } from "react";
import "./App.css";

type LensState = "join" | "connected";

type Player = {
  id: string;
  name: string;
};

const SESSION_SERVICE_URL = import.meta.env.VITE_SESSION_SERVICE_URL;

if (!SESSION_SERVICE_URL) {
  throw new Error("VITE_SESSION_SERVICE_URL is not configured.");
}

const PLAYER_COLORS = [
  "#00ebff",
  "#ff367f",
  "#c8a4ff",
  "#ffc46b",
  "#66e6b0",
  "#73acff",
];

function App() {
  const [sessionCode, setSessionCode] = useState(
    new URLSearchParams(window.location.search).get("code")?.toUpperCase() ?? "",
  );
  const [playerName, setPlayerName] = useState("");
  const [player, setPlayer] = useState<Player | null>(null);
  const [state, setState] = useState<LensState>("join");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedPlayerId = localStorage.getItem("thresholdPlayerId");
    const storedSessionCode = localStorage.getItem("thresholdSessionCode");
    const storedPlayerName = localStorage.getItem("thresholdPlayerName");

    if (!storedPlayerId || !storedSessionCode) return;

    const reconnect = async () => {
      try {
        const response = await fetch(
          `${SESSION_SERVICE_URL}/sessions/${storedSessionCode}/reconnect`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId: storedPlayerId }),
          },
        );

        if (!response.ok) {
          localStorage.removeItem("thresholdPlayerId");
          localStorage.removeItem("thresholdSessionCode");
          localStorage.removeItem("thresholdPlayerName");
          return;
        }

        const data = await response.json();

        setPlayer({
          id: storedPlayerId,
          name: data.player?.name ?? storedPlayerName ?? "OPERATIVE",
        });
        setSessionCode(storedSessionCode);
        setState("connected");
      } catch {
        // Retain identity for a future reconnection attempt.
      }
    };

    void reconnect();
  }, []);

  const disconnectLens = () => {
    localStorage.removeItem("thresholdPlayerId");
    localStorage.removeItem("thresholdSessionCode");
    localStorage.removeItem("thresholdPlayerName");

    setPlayer(null);
    setSessionCode("");
    setPlayerName("");
    setError(null);
    setState("join");
  };

  const joinThreshold = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const code = sessionCode.trim().toUpperCase();
    const name = playerName.trim();

    if (!code || !name || isConnecting) return;

    setIsConnecting(true);
    setError(null);

    try {
      const response = await fetch(
        `${SESSION_SERVICE_URL}/sessions/${code}/join`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Session not found. Verify your access code.");
        }

        throw new Error("Connection rejected. Please try again.");
      }

      const data = await response.json();

      localStorage.setItem("thresholdPlayerId", data.player.id);
      localStorage.setItem("thresholdSessionCode", code);
      localStorage.setItem("thresholdPlayerName", name);

      setPlayer({ id: data.player.id, name });
      setSessionCode(code);
      setState("connected");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to connect to Threshold.",
      );
    } finally {
      setIsConnecting(false);
    }
  };

  // A stable placeholder color until the backend supplies
  // the authoritative player slot.
  const playerColor = PLAYER_COLORS[0];

  return (
    <main className="lens">
      <div className="signal-noise" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />

      <div className="lens-shell">
        <header className="system-header">
          <span>THRESHOLD // LENS</span>
          <span className="system-indicator">
            <span className="indicator-dot" />
            {state === "connected" ? "LINK ACTIVE" : "STANDBY"}
          </span>
        </header>

        <div className="header-rule" />

        {state === "join" ? (
          <section className="terminal-panel">
            <div className="lens-brand">
              <p className="terminal-prefix">[ PORTABLE INTERFACE v0.1 ]</p>
              <h1 className="glitch-title" data-text="LENS">
                LENS<span className="cursor">_</span>
              </h1>
              <p className="brand-subtitle">Reality is playable.</p>
            </div>

            <div className="terminal-output">
              <p><span className="prompt">&gt;</span> INITIALIZING LENS INTERFACE</p>
              <p><span className="prompt">&gt;</span> DEVICE STATUS: READY</p>
              <p className="cyan">
                <span className="prompt">&gt;</span> AWAITING EXPEDITION LINK
                <span className="cursor">_</span>
              </p>
            </div>

            <form className="connection-form" onSubmit={joinThreshold}>
              <p className="section-label">// ESTABLISH CONNECTION</p>

              <label htmlFor="session-code">EXPEDITION ACCESS CODE</label>
              <input
                id="session-code"
                value={sessionCode}
                onChange={(event) =>
                  setSessionCode(event.target.value.toUpperCase())
                }
                placeholder="ENTER CODE"
                maxLength={6}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                required
              />

              <label htmlFor="operative-name">OPERATIVE IDENTIFIER</label>
              <input
                id="operative-name"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="YOUR NAME"
                maxLength={16}
                autoComplete="off"
                spellCheck={false}
                required
              />

              {error && (
                <p className="connection-error" role="alert">
                  [ ERROR ] {error}
                </p>
              )}

              <button
                className="connect-button"
                type="submit"
                disabled={
                  !sessionCode.trim() ||
                  !playerName.trim() ||
                  isConnecting
                }
              >
                {isConnecting ? "ESTABLISHING LINK..." : "CONNECT TO THRESHOLD →"}
              </button>
            </form>

            <footer className="terminal-footer">
              <span>SECURE EXPEDITION INTERFACE</span>
              <span>AWAITING AUTHORIZATION</span>
            </footer>
          </section>
        ) : (
          <section
            className="terminal-panel connected-panel"
            style={{ "--operative-color": playerColor } as React.CSSProperties}
          >
            <p className="terminal-prefix">[ OPERATIVE AUTHORIZED ]</p>

            <div className="connected-symbol" aria-hidden="true">
              ◈
            </div>

            <h1 className="connected-title">
              CONNECTION<br />ESTABLISHED<span className="cursor">_</span>
            </h1>

            <div className="operative-card">
              <p className="section-label">// OPERATIVE IDENTIFIER</p>
              <p className="operative-name">
                {player?.name ?? "OPERATIVE"}
              </p>
              <p className="operative-status">
                <span className="indicator-dot" />
                LENS ONLINE
              </p>
            </div>

            <div className="terminal-output">
              <p><span className="prompt">&gt;</span> SESSION: {sessionCode}</p>
              <p><span className="prompt">&gt;</span> IDENTITY VERIFIED</p>
              <p className="cyan">
                <span className="prompt">&gt;</span> AWAITING THE ARCHITECT
                <span className="cursor">_</span>
              </p>
            </div>

            <p className="connected-description">
              Keep this device with you. The Architect may communicate
              with you privately during the Expedition.
            </p>

            <button
              type="button"
              className="disconnect-button"
              onClick={disconnectLens}
            >
              DISCONNECT LENS
            </button>

            <footer className="terminal-footer">
              <span>THRESHOLD // LENS</span>
              <span>LINK ACTIVE</span>
            </footer>
          </section>
        )}
      </div>
    </main>
  );
}

export default App;