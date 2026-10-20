import type { CSSProperties } from "react";
import type { Player } from "../types/session";
import "./ConnectedScreen.css";

const PLAYER_COLORS = ["#00ebff", "#ff367f", "#c8a4ff", "#ffc46b", "#66e6b0", "#73acff"];

type Props = {
  sessionCode: string;
  player: Player | null;
  isDisconnecting: boolean;
  error: string | null;
  onDisconnect: () => void;
};

export function ConnectedScreen({ sessionCode, player, isDisconnecting, error, onDisconnect }: Props) {
  const playerColor = PLAYER_COLORS[0]; // Placeholder until backend assigns slots.
  return (
    <section className="terminal-panel connected-panel" style={{ "--operative-color": playerColor } as CSSProperties}>
      <p className="terminal-prefix">[ OPERATIVE AUTHORIZED ]</p>
      <div className="connected-symbol" aria-hidden="true">◈</div>
      <h1 className="connected-title">CONNECTION<br />ESTABLISHED<span className="cursor">_</span></h1>
      <div className="operative-card">
        <p className="section-label">// OPERATIVE IDENTIFIER</p>
        <p className="operative-name">{player?.name ?? "OPERATIVE"}</p>
        <p className="operative-status"><span className="indicator-dot" />LENS ONLINE</p>
      </div>
      <div className="terminal-output">
        <p><span className="prompt">&gt;</span> SESSION: {sessionCode}</p>
        <p><span className="prompt">&gt;</span> IDENTITY VERIFIED</p>
        <p className="cyan"><span className="prompt">&gt;</span> AWAITING THE ARCHITECT<span className="cursor">_</span></p>
      </div>
      <p className="connected-description">Keep this device with you. The Architect may communicate with you privately during the Expedition.</p>
      <button type="button" className="disconnect-button" onClick={onDisconnect} disabled={isDisconnecting}>
        {isDisconnecting ? "DISCONNECTING..." : "DISCONNECT LENS"}
      </button>
      {error && <p className="connection-error" role="alert">[ ERROR ] {error}</p>}
      <footer className="terminal-footer"><span>THRESHOLD // LENS</span><span>LINK ACTIVE</span></footer>
    </section>
  );
}
