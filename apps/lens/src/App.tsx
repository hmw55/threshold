import { useState } from "react";
import "./App.css";

type LensState = "join" | "connected";

const SESSION_SERVICE_URL = import.meta.env.VITE_SESSION_SERVICE_URL;

if (!SESSION_SERVICE_URL) {
  throw new Error("VITE_SESSION_SERVICE_URL is not configured.");
}

function App() {
  const [sessionCode, setSessionCode] = useState("");
  const [state, setState] = useState<LensState>("join");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");

  const joinThreshold = async () => {
    const normalizedCode = sessionCode.trim().toUpperCase();
    const normalizedName = playerName.trim();

    if (!normalizedCode || !normalizedName || isConnecting) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const response = await fetch(
        `${SESSION_SERVICE_URL}/sessions/${normalizedCode}/join`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: normalizedName,
          }),
        },
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Threshold not found.");
        }

        throw new Error("Unable to connect to Threshold.");
      }

      setSessionCode(normalizedCode);
      setState("connected");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to connect to Threshold.",
      );
    } finally {
      setIsConnecting(false);
    }
  };

  if (state === "connected") {
    return (
      <main className="lens">
        <section className="panel">
          <p className="eyebrow">LENS CONNECTED</p>

          <h1>Threshold found.</h1>

          <p className="description">
            Keep this device with you. The Architect may communicate with you
            privately during the Expedition.
          </p>

          <p className="session-code">{sessionCode}</p>

          <div className="status">
            <span className="status-dot" />
            Connected
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="lens">
      <section className="panel">
        <p className="eyebrow">THRESHOLD</p>

        <h1>Turn reality into the game.</h1>

        <p className="description">
          Enter the session code displayed on your Threshold.
        </p>

        <label htmlFor="session-code">Session code</label>

        <input
          id="session-code"
          value={sessionCode}
          onChange={(event) => setSessionCode(event.target.value)}
          placeholder="A7K4"
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
        />

        <input
          type="text"
          value={playerName}
          onChange={(event) => setPlayerName(event.target.value)}
          placeholder="YOUR NAME"
          maxLength={16}
          autoComplete="off"
        />

        {error && <p className="error">{error}</p>}

        <button
          type="button"
          onClick={joinThreshold}
          disabled={!sessionCode.trim() || !playerName.trim() || isConnecting}
        >
          {isConnecting ? "Connecting..." : "Connect Lens"}
        </button>
        
      </section>
    </main>
  );
}

export default App;