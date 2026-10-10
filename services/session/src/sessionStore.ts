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
database.exec("PRAGMA foreign_keys = ON;");

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

database.exec(`
  CREATE TABLE IF NOT EXISTS scan_images (
    id TEXT PRIMARY KEY,
    scan_group_id TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL
      CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
    size_bytes INTEGER NOT NULL
      CHECK (size_bytes > 0 AND size_bytes <= 10485760),
    created_at TEXT NOT NULL,
    FOREIGN KEY (scan_group_id)
      REFERENCES scan_groups(id)
      ON DELETE CASCADE
  );
`);

database.exec(`
  CREATE INDEX IF NOT EXISTS idx_scan_images_group
  ON scan_images(scan_group_id);
`);

export type ScanGroupStatus =
  | "pending"
  | "uploaded"
  | "analyzing"
  | "completed"
  | "failed";

export interface ScanGroup {
  id: string;
  sessionCode: string;
  thresholdId: string | null;
  label: string;
  createdBy: string;
  status: ScanGroupStatus;
  createdAt: string;
}

export interface ScanImage {
  id: string;
  scanGroupId: string;
  storageKey: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
  createdAt: string;
}

interface ScanImageRow {
  id: string;
  scan_group_id: string;
  storage_key: string;
  mime_type: ScanImage["mimeType"];
  size_bytes: number;
  created_at: string;
}

function toScanImage(row: ScanImageRow): ScanImage {
  return {
    id: row.id,
    scanGroupId: row.scan_group_id,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

const MAX_IMAGES_PER_SCAN_GROUP = 6;


export function createScanImage(image: ScanImage): ScanImage {
  const result = database
    .prepare(`
      INSERT INTO scan_images (
        id,
        scan_group_id,
        storage_key,
        mime_type,
        size_bytes,
        created_at
      )
      SELECT ?, ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1
        FROM scan_groups
        WHERE id = ?
          AND status = 'pending'
      )
      AND (
        SELECT COUNT(*)
        FROM scan_images
        WHERE scan_group_id = ?
      ) < ?
    `)
    .run(
      image.id,
      image.scanGroupId,
      image.storageKey,
      image.mimeType,
      image.sizeBytes,
      image.createdAt,
      image.scanGroupId,
      image.scanGroupId,
      MAX_IMAGES_PER_SCAN_GROUP,
    );

  if (result.changes !== 1) {
    const group = getScanGroup(image.scanGroupId);

    if (!group) {
      throw new Error("scan_group_not_found");
    }

    if (group.status !== "pending") {
      throw new Error("scan_group_not_pending");
    }

    throw new Error("scan_image_limit_reached");
  }

  return image;
}

export function listScanImages(scanGroupId: string): ScanImage[] {
  const rows = database
    .prepare(`
      SELECT *
      FROM scan_images
      WHERE scan_group_id = ?
      ORDER BY created_at ASC, id ASC
    `)
    .all(scanGroupId) as unknown as ScanImageRow[];

  return rows.map(toScanImage);
}

export function countScanImages(scanGroupId: string): number {
  const row = database
    .prepare(`
      SELECT COUNT(*) AS count
      FROM scan_images
      WHERE scan_group_id = ?
    `)
    .get(scanGroupId) as { count: number };

  return row.count;
}

export function deleteScanImage(id: string): void {
  database
    .prepare("DELETE FROM scan_images WHERE id = ?")
    .run(id);
}

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


interface ScanGroupRow {
  id: string;
  session_code: string;
  threshold_id: string | null;
  label: string;
  created_by: string;
  status: ScanGroupStatus;
  created_at: string;
}

function toScanGroup(row: ScanGroupRow): ScanGroup {
  return {
    id: row.id,
    sessionCode: row.session_code,
    thresholdId: row.threshold_id,
    label: row.label,
    createdBy: row.created_by,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function createScanGroup(group: ScanGroup): ScanGroup {
  database
    .prepare(`
      INSERT INTO scan_groups (
        id,
        session_code,
        threshold_id,
        label,
        created_by,
        status,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      group.id,
      group.sessionCode,
      group.thresholdId,
      group.label,
      group.createdBy,
      group.status,
      group.createdAt
    );

  return group;
}

export function getScanGroup(
  id: string
): ScanGroup | null {
  const row = database
    .prepare(`
      SELECT *
      FROM scan_groups
      WHERE id = ?
    `)
    .get(id) as ScanGroupRow | undefined;

  return row ? toScanGroup(row) : null;
}

export function listScanGroups(
  sessionCode: string
): ScanGroup[] {
  const rows = database
    .prepare(`
      SELECT *
      FROM scan_groups
      WHERE session_code = ?
      ORDER BY created_at ASC, id ASC
    `)
    .all(sessionCode) as unknown as ScanGroupRow[];

  return rows.map(toScanGroup);
}

export function finalizeScanGroup(
  id: string
): ScanGroup | null {
  database
    .prepare(`
      UPDATE scan_groups
      SET status = 'uploaded'
      WHERE id = ?
        AND status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM scan_images
          WHERE scan_group_id = ?
        )
    `)
    .run(id, id);

  return getScanGroup(id);
}