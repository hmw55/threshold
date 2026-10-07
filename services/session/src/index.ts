import cors from "cors";
import express from "express";

type SessionStatus = "awaiting_players" | "connected";

interface Session {
  code: string;
  playerCount: number;
  status: SessionStatus;
}

const PORT = 3001;

const app = express();

app.use(cors());
app.use(express.json());

const sessions = new Map<string, Session>();

sessions.set("A7K4", {
  code: "A7K4",
  playerCount: 0,
  status: "awaiting_players",
});

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "threshold-session",
  });
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

  session.playerCount += 1;
  session.status = "connected";

  response.json(session);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Threshold session service listening on port ${PORT}`);
});
