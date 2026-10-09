
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  joinExpedition,
  leaveExpedition,
  reconnectExpedition,
  sessionClient,
  SessionClientError,
} from "../services/sessionClient";
import type {
  ExpeditionSession,
  LensState,
  Player,
} from "../types/session";

const STORAGE = {
  id: "thresholdPlayerId",
  code: "thresholdSessionCode",
  name: "thresholdPlayerName",
  token: "thresholdPlayerToken",
};

const POLL_INTERVAL_MS = 1500;

function clearIdentity() {
  localStorage.removeItem(STORAGE.id);
  localStorage.removeItem(STORAGE.code);
  localStorage.removeItem(STORAGE.name);
  localStorage.removeItem(STORAGE.token);
}

export function useExpeditionSession() {
  const [sessionCode, setSessionCode] = useState(
    new URLSearchParams(window.location.search)
      .get("code")
      ?.toUpperCase() ?? "",
  );

  const [playerName, setPlayerName] = useState("");
  const [player, setPlayer] = useState<Player | null>(null);
  const [state, setState] = useState<LensState>("join");
  const [phase, setPhase] =
    useState<ExpeditionSession["phase"]>("lobby");

  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const operation = useRef(0);

  useEffect(() => {
    const storedId = localStorage.getItem(STORAGE.id);
    const storedCode = localStorage.getItem(STORAGE.code);
    const storedName = localStorage.getItem(STORAGE.name);
    const storedToken = localStorage.getItem(STORAGE.token);

    if (!storedId || !storedCode) return;

    if (!storedToken) {
      clearIdentity();
      return;
    }

    const token = ++operation.current;

    setSessionCode(storedCode);
    setPlayerName(storedName ?? "");
    setIsConnecting(true);

    void reconnectExpedition(storedCode, storedId, storedToken)
      .then(({ player: restored, session }) => {
        if (operation.current !== token) return;

        setPlayer(restored);
        setPlayerName(restored.name);
        setPhase(session.phase);
        setState("connected");
        setError(null);
      })
      .catch((reason: unknown) => {
        if (operation.current !== token) return;

        if (
          reason instanceof SessionClientError &&
          (reason.statusCode === 401 || reason.statusCode === 404)
        ) {
          clearIdentity();
          setError("Previous connection expired. Join the expedition again.");
        } else {
          setError(
            "Could not restore your connection. Try connecting again.",
          );
        }
      })
      .finally(() => {
        if (operation.current === token) {
          setIsConnecting(false);
        }
      });

    return () => {
      operation.current++;
    };
  }, []);

  useEffect(() => {
    if (state !== "connected" || !player) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const session = await sessionClient.getSession(sessionCode);

        if (!active) return;

        setPhase(session.phase);
      } catch (reason) {
        if (!active) return;

        console.warn(
          "Unable to synchronize expedition phase:",
          reason,
        );
      } finally {
        if (active) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
    }

    void poll();

    return () => {
      active = false;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [state, player, sessionCode]);

  const connect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isConnecting || isDisconnecting) return;

    const code = sessionCode.trim().toUpperCase();
    const name = playerName.trim();

    if (!code || !name) return;

    setIsConnecting(true);
    setError(null);

    const token = ++operation.current;

    try {
      const connection = await joinExpedition(code, name);

      if (operation.current !== token) return;

      localStorage.setItem(STORAGE.id, connection.player.id);
      localStorage.setItem(STORAGE.code, code);
      localStorage.setItem(STORAGE.name, connection.player.name);
      localStorage.setItem(STORAGE.token, connection.playerToken);

      setPlayer(connection.player);
      setSessionCode(code);
      setPlayerName(connection.player.name);
      setPhase(connection.session.phase);
      setState("connected");
    } catch (reason) {
      if (operation.current === token) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to connect to Threshold.",
        );
      }
    } finally {
      if (operation.current === token) {
        setIsConnecting(false);
      }
    }
  };

  const disconnect = async () => {
    if (!player || isDisconnecting || isConnecting) return;

    setIsDisconnecting(true);
    setError(null);

    try {
      const playerToken = localStorage.getItem(STORAGE.token);

      if (!playerToken) {
        setError("Operative credentials missing. Unable to disconnect securely.");
        return;
      }

      await leaveExpedition(sessionCode, player.id, playerToken);

      clearIdentity();
      setPlayer(null);
      setPhase("lobby");
      setState("join");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to disconnect.",
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  return {
    sessionCode,
    setSessionCode,
    playerName,
    setPlayerName,
    player,
    state,
    phase,
    isConnecting,
    isDisconnecting,
    error,
    connect,
    disconnect,
  };
}
