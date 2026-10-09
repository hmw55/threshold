import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const isTest = process.env.NODE_ENV === "test";
const configuredDatabasePath = process.env.THRESHOLD_DB_PATH;

const databasePath =
  isTest && !configuredDatabasePath
    ? ":memory:"
    : resolve(
        configuredDatabasePath ??
          "../../.local/threshold/sessions.sqlite"
      );

if (!isTest) {
  mkdirSync(dirname(databasePath), { recursive: true });
}

const database = new DatabaseSync(databasePath);

database.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    code TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
`);

database.exec(`
  CREATE TABLE IF NOT EXISTS player_credentials (
    player_id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL
  );
`);


database.exec(`
  CREATE TABLE IF NOT EXISTS scan_groups (
    id TEXT PRIMARY KEY,
    session_code TEXT NOT NULL,
    threshold_id TEXT,
    label TEXT NOT NULL,
    created_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'uploaded', 'analyzing', 'completed', 'failed')),
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_code)
      REFERENCES sessions(code) ON DELETE CASCADE
  );
`);

database.exec(`
  CREATE INDEX IF NOT EXISTS idx_scan_groups_session
  ON scan_groups(session_code);
`);


export function loadSessions<T>(): Map<string, T> {
  const rows = database
    .prepare("SELECT code, data FROM sessions")
    .all() as Array<{ code: string; data: string }>;

  return new Map(
    rows.map((row) => [
      row.code,
      JSON.parse(row.data) as T,
    ])
  );
}

export function saveSession<T>(
  code: string,
  session: T
): void {
  database
    .prepare(`
      INSERT INTO sessions (code, data)
      VALUES (?, ?)
      ON CONFLICT(code)
      DO UPDATE SET data = excluded.data
    `)
    .run(code, JSON.stringify(session));
}

export function deleteSession(code: string): void {
  database
    .prepare("DELETE FROM sessions WHERE code = ?")
    .run(code);
}

export function clearSessions(): void {
  database.exec(`
    DELETE FROM scan_groups;
    DELETE FROM player_credentials;
    DELETE FROM sessions;
  `);
}


export function savePlayerCredential(
  playerId: string,
  tokenHash: string
): void {
  database
    .prepare(`
      INSERT INTO player_credentials (player_id, token_hash)
      VALUES (?, ?)
      ON CONFLICT(player_id)
      DO UPDATE SET token_hash = excluded.token_hash
    `)
    .run(playerId, tokenHash);
}

export function getPlayerCredentialHash(
  playerId: string
): string | null {
  const row = database
    .prepare(`
      SELECT token_hash
      FROM player_credentials
      WHERE player_id = ?
    `)
    .get(playerId) as { token_hash: string } | undefined;

  return row?.token_hash ?? null;
}

export function deletePlayerCredential(
  playerId: string
): void {
  database
    .prepare(`
      DELETE FROM player_credentials
      WHERE player_id = ?
    `)
    .run(playerId);
}
