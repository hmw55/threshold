import cors from "cors";
import express from "express";

type SessionStatus = "awaiting_players" | "ready";

interface Player {
  id: string;
  name: string;
}

interface Session {
  code: string;
  players: Player[];
  status: SessionStatus;
}

const PORT = 3001;

const app = express();

app.use(cors());
app.use(express.json());

const sessions = new Map<string, Session>();

function generateSessionCode(): string {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let index = 0; index < 4; index += 1) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }

  return code;
}

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "threshold-session",
  });
});

app.post("/sessions", (_request, response) => {
  let code = generateSessionCode();

  while (sessions.has(code)) {
    code = generateSessionCode();
  }

  const session: Session = {
    code,
    players: [],
    status: "awaiting_players",
  };

  sessions.set(code, session);

  response.status(201).json(session);
});

app.get("/sessions/:code", (request, response) => {
  const code = request.params.code.toUpperCase();
  const session = sessions.get(code);

  if (!session) {
    response.status(404).json({
      error: "session_not_found",
    });
    return;
  }

  response.json(session);
});

app.post("/sessions/:code/join", (request, response) => {
  const code = request.params.code.toUpperCase();
  const session = sessions.get(code);

  if (!session) {
    response.status(404).json({
      error: "session_not_found",
    });
    return;
  }

  const name =
    typeof request.body.name === "string"
      ? request.body.name.trim()
      : "";

  if (!name) {
    response.status(400).json({
      error: "player_name_required",
    });
    return;
  }

  const player: Player = {
    id: crypto.randomUUID(),
    name,
  };

  session.players.push(player);

  response.status(201).json({
    session,
    player,
  });
});

app.post("/sessions/:code/reconnect", (request, response) => {
  const code = request.params.code.toUpperCase();
  const session = sessions.get(code);

  if (!session) {
    response.status(404).json({
      error: "session_not_found",
    });
    return;
  }

  const playerId =
    typeof request.body.playerId === "string"
      ? request.body.playerId
      : "";

  const player = session.players.find(
    (existingPlayer) => existingPlayer.id === playerId,
  );

  if (!player) {
    response.status(404).json({
      error: "player_not_found",
    });
    return;
  }

  response.json({
    session,
    player,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Threshold session service listening on port ${PORT}`);
});
