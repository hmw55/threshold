import { useState } from "react";
import "./App.css";

type LensState = "join" | "connected";

function App() {
  const [sessionCode, setSessionCode] = useState("");
  const [state, setState] = useState<LensState>("join");

  const joinThreshold = () => {
    const normalizedCode = sessionCode.trim().toUpperCase();

    if (!normalizedCode) {
      return;
    }

    setSessionCode(normalizedCode);
    setState("connected");
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

        <button
          type="button"
          onClick={joinThreshold}
          disabled={!sessionCode.trim()}
        >
          Connect Lens
        </button>
      </section>
    </main>
  );
}

export default App;