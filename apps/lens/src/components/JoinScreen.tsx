import type { FormEvent } from "react";

type Props = {
  sessionCode: string;
  setSessionCode: (value: string) => void;
  playerName: string;
  setPlayerName: (value: string) => void;
  isConnecting: boolean;
  error: string | null;
  onJoin: (event: FormEvent<HTMLFormElement>) => void;
};

export function JoinScreen({ sessionCode, setSessionCode, playerName, setPlayerName, isConnecting, error, onJoin }: Props) {
  return (
    <section className="terminal-panel">
      <div className="lens-brand">
        <p className="terminal-prefix">[ PORTABLE INTERFACE v0.1 ]</p>
        <h1 className="glitch-title" data-text="LENS">LENS<span className="cursor">_</span></h1>
        <p className="brand-subtitle">Reality is playable.</p>
      </div>
      <div className="terminal-output">
        <p><span className="prompt">&gt;</span> INITIALIZING LENS INTERFACE</p>
        <p><span className="prompt">&gt;</span> DEVICE STATUS: READY</p>
        <p className="cyan"><span className="prompt">&gt;</span> AWAITING EXPEDITION LINK<span className="cursor">_</span></p>
      </div>
      <form className="connection-form" onSubmit={onJoin}>
        <p className="section-label">// ESTABLISH CONNECTION</p>
        <label htmlFor="session-code">EXPEDITION ACCESS CODE</label>
        <input id="session-code" value={sessionCode} onChange={(event) => setSessionCode(event.target.value.toUpperCase())}
          placeholder="ENTER CODE" maxLength={6} autoCapitalize="characters" autoComplete="off" spellCheck={false} required />
        <label htmlFor="operative-name">OPERATIVE IDENTIFIER</label>
        <input id="operative-name" value={playerName} onChange={(event) => setPlayerName(event.target.value)}
          placeholder="YOUR NAME" maxLength={16} autoComplete="off" spellCheck={false} required />
        {error && <p className="connection-error" role="alert">[ ERROR ] {error}</p>}
        <button className="connect-button" type="submit" disabled={!sessionCode.trim() || !playerName.trim() || isConnecting}>
          {isConnecting ? "ESTABLISHING LINK..." : "CONNECT TO THRESHOLD →"}
        </button>
      </form>
      <footer className="terminal-footer"><span>SECURE EXPEDITION INTERFACE</span><span>AWAITING AUTHORIZATION</span></footer>
    </section>
  );
}
