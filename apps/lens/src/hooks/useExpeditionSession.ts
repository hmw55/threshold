import { useEffect, useRef, useState, type FormEvent } from "react";
import { joinExpedition, leaveExpedition, reconnectExpedition } from "../services/sessionClient";
import type { LensState, Player } from "../types/session";

const STORAGE = {
  id: "thresholdPlayerId",
  code: "thresholdSessionCode",
  name: "thresholdPlayerName",
};

function clearIdentity() {
  localStorage.removeItem(STORAGE.id);
  localStorage.removeItem(STORAGE.code);
  localStorage.removeItem(STORAGE.name);
}

export function useExpeditionSession() {
  const [sessionCode, setSessionCode] = useState(
    new URLSearchParams(window.location.search).get("code")?.toUpperCase() ?? "",
  );
  const [playerName, setPlayerName] = useState("");
  const [player, setPlayer] = useState<Player | null>(null);
  const [state, setState] = useState<LensState>("join");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operation = useRef(0);

  useEffect(() => {
    const storedId = localStorage.getItem(STORAGE.id);
    const storedCode = localStorage.getItem(STORAGE.code);
    const storedName = localStorage.getItem(STORAGE.name);
    if (!storedId || !storedCode) return;

    const token = ++operation.current;
    setSessionCode(storedCode);
    setPlayerName(storedName ?? "");
    setIsConnecting(true);

    void reconnectExpedition(storedCode, storedId)
      .then(({ player: restored }) => {
        if (operation.current !== token) return;
        setPlayer(restored);
        setPlayerName(restored.name);
        setState("connected");
      })
      .catch((reason: unknown) => {
        if (operation.current !== token) return;
        // A network failure is not proof that the identity is invalid.
        // Only clear a known missing player/session.
        if (reason instanceof Error && reason.message.includes("not found")) {
          clearIdentity();
        } else {
          setError("Could not restore your connection. Try connecting again.");
        }
      })
      .finally(() => {
        if (operation.current === token) setIsConnecting(false);
      });

    return () => { operation.current++; };
  }, []);

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
      setPlayer(connection.player);
      setSessionCode(code);
      setPlayerName(connection.player.name);
      setState("connected");
    } catch (reason) {
      if (operation.current === token) {
        setError(reason instanceof Error ? reason.message : "Unable to connect to Threshold.");
      }
    } finally {
      if (operation.current === token) setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!player || isDisconnecting || isConnecting) return;
    setIsDisconnecting(true);
    setError(null);
    try {
      await leaveExpedition(sessionCode, player.id);
      clearIdentity();
      setPlayer(null);
      // Keep the code and name for quick rejoining.
      setState("join");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to disconnect.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  return {
    sessionCode, setSessionCode, playerName, setPlayerName,
    player, state, isConnecting, isDisconnecting, error,
    connect, disconnect,
  };
}
