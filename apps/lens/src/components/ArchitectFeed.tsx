import { useEffect, useRef, useState } from "react";
import { normalizeCode, playerHeaders, request } from "../services/apiClient";
import "./ArchitectFeed.css";

type Transmission = { id: string; type: string; message: string; createdAt: number };
type FeedResponse = { events: Transmission[]; phase: string };
type Props = { sessionCode: string; playerId: string; playerToken: string };

export function ArchitectFeed({ sessionCode, playerId, playerToken }: Props) {
  const [events, setEvents] = useState<Transmission[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState(false);
  const known = useRef<Set<string> | null>(null);
  const expandedRef = useRef(false);
  expandedRef.current = expanded;

  useEffect(() => {
    let disposed = false;
    let pending = false;
    known.current = null;
    setEvents([]);
    setUnread(0);
    const poll = async () => {
      if (disposed || pending || document.hidden) return;
      pending = true;
      try {
        const result = await request<FeedResponse>(
          `/sessions/${normalizeCode(sessionCode)}/game/transmissions`,
          { headers: playerHeaders(playerId, playerToken) },
        );
        if (disposed) return;
        const received = result.events.slice(-40);
        const previous = known.current;
        if (previous !== null) {
          const added = received.filter((event) => !previous.has(event.id)).length;
          if (added && !expandedRef.current) setUnread((value) => value + added);
        }
        known.current = new Set(received.map((event) => event.id));
        setEvents(received);
        setError(false);
      } catch {
        if (!disposed) setError(true);
      } finally {
        pending = false;
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 2500);
    return () => { disposed = true; window.clearInterval(interval); };
  }, [sessionCode, playerId, playerToken]);

  return (
    <section className="architect-feed" aria-label="Architect transmissions">
      <button type="button" className="architect-feed-toggle" aria-expanded={expanded}
        onClick={() => { setExpanded((value) => !value); setUnread(0); }}>
        <span>◈ ARCHITECT // TRANSMISSIONS</span>
        <span>{unread > 0 ? `${unread} NEW` : error ? "LINK INTERRUPTED" : "LIVE"} {expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && <div className="architect-feed-log" role="log" aria-live="polite" aria-relevant="additions">
        {events.length === 0 && <p>Awaiting Architect transmission.</p>}
        {[...events].reverse().map((event) => <article key={event.id} className="architect-feed-entry">
          <div className="architect-feed-meta"><span>{event.type.toUpperCase()}</span>
            <time dateTime={new Date(event.createdAt).toISOString()}>{new Date(event.createdAt).toLocaleTimeString()}</time>
          </div>
          <p>{event.message}</p>
        </article>)}
      </div>}
    </section>
  );
}
