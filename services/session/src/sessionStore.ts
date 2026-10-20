import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { GameState } from "./game/gameState.js";

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
  CREATE TABLE IF NOT EXISTS game_states (
    session_code TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    FOREIGN KEY (session_code)
      REFERENCES sessions(code)
      ON DELETE CASCADE
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
  CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_groups_unique_threshold
  ON scan_groups(session_code, threshold_id)
  WHERE threshold_id IS NOT NULL;
`);

// Add claim fields to databases created before scan ownership existed.
const scanGroupColumns = database
  .prepare("PRAGMA table_info(scan_groups)")
  .all() as unknown as Array<{ name: string }>;

const existingColumns = new Set(
  scanGroupColumns.map((column) => column.name),
);

if (!existingColumns.has("claimed_by")) {
  database.exec(`
    ALTER TABLE scan_groups
    ADD COLUMN claimed_by TEXT;
  `);

  // Preserve ownership of existing pending scans.
  database.exec(`
    UPDATE scan_groups
    SET claimed_by = created_by
    WHERE claimed_by IS NULL
      AND status = 'pending';
  `);
}

if (!existingColumns.has("claim_expires_at")) {
  database.exec(`
    ALTER TABLE scan_groups
    ADD COLUMN claim_expires_at TEXT;
  `);
}

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

database.exec(`
  CREATE TABLE IF NOT EXISTS environments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source TEXT NOT NULL
      CHECK (source IN ('simulated', 'scanned')),
    created_at TEXT NOT NULL
  );
`);

database.exec(`
  CREATE TABLE IF NOT EXISTS environment_objects (
    id TEXT PRIMARY KEY,
    environment_id TEXT NOT NULL,
    parent_object_id TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    location TEXT NOT NULL,
    recognition_status TEXT NOT NULL
      CHECK (
        recognition_status IN (
          'confirmed',
          'collection_only',
          'uncertain'
        )
      ),
    requires_closer_scan INTEGER NOT NULL DEFAULT 0
      CHECK (requires_closer_scan IN (0, 1)),
    created_at TEXT NOT NULL,

    FOREIGN KEY (environment_id)
      REFERENCES environments(id)
      ON DELETE CASCADE,

    FOREIGN KEY (parent_object_id)
      REFERENCES environment_objects(id)
      ON DELETE SET NULL
  );
`);

database.exec(`
  CREATE INDEX IF NOT EXISTS idx_environment_objects_environment
  ON environment_objects(environment_id);
`);

database.exec(`
  CREATE INDEX IF NOT EXISTS idx_environment_objects_parent
  ON environment_objects(parent_object_id);
`);

database.exec(`
  CREATE TABLE IF NOT EXISTS environment_observations (
    id TEXT PRIMARY KEY,
    environment_id TEXT NOT NULL,
    object_id TEXT NOT NULL,
    session_code TEXT,
    scan_group_id TEXT,
    recognition_status TEXT NOT NULL
      CHECK (
        recognition_status IN (
          'confirmed',
          'collection_only',
          'uncertain'
        )
      ),
    observed_at TEXT NOT NULL,

    FOREIGN KEY (environment_id)
      REFERENCES environments(id)
      ON DELETE CASCADE,

    FOREIGN KEY (object_id)
      REFERENCES environment_objects(id)
      ON DELETE CASCADE,

    FOREIGN KEY (session_code)
      REFERENCES sessions(code)
      ON DELETE CASCADE,

    FOREIGN KEY (scan_group_id)
      REFERENCES scan_groups(id)
      ON DELETE SET NULL
  );
`);

database.exec(`
  CREATE INDEX IF NOT EXISTS idx_environment_observations_environment
  ON environment_observations(environment_id);
`);

database.exec(`
  CREATE INDEX IF NOT EXISTS idx_environment_observations_session
  ON environment_observations(session_code);
`);

database.exec(`
  CREATE INDEX IF NOT EXISTS idx_environment_observations_object
  ON environment_observations(object_id);
`);

database.exec(`
  CREATE TABLE IF NOT EXISTS environment_object_refs (
    session_code TEXT NOT NULL,
    object_id TEXT NOT NULL,
    model_ref TEXT NOT NULL,

    PRIMARY KEY (session_code, object_id),

    UNIQUE (session_code, model_ref),

    FOREIGN KEY (session_code)
      REFERENCES sessions(code)
      ON DELETE CASCADE,

    FOREIGN KEY (object_id)
      REFERENCES environment_objects(id)
      ON DELETE CASCADE
  );
`);

database.exec(`
  CREATE TABLE IF NOT EXISTS environment_ref_counters (
    session_code TEXT PRIMARY KEY,
    next_number INTEGER NOT NULL DEFAULT 1
      CHECK (next_number >= 1),

    FOREIGN KEY (session_code)
      REFERENCES sessions(code)
      ON DELETE CASCADE
  );
`);

const observationColumns = database
  .prepare("PRAGMA table_info(environment_observations)")
  .all() as Array<{ name: string }>;

if (!observationColumns.some((column) => column.name === "observed_description")) {
  database.exec(`
    ALTER TABLE environment_observations
    ADD COLUMN observed_description TEXT
  `);
}

if (!observationColumns.some((column) => column.name === "observed_location")) {
  database.exec(`
    ALTER TABLE environment_observations
    ADD COLUMN observed_location TEXT
  `);
}

if (
  !observationColumns.some(
    (column) => column.name === "observed_name",
  )
) {
  database.exec(`
    ALTER TABLE environment_observations
    ADD COLUMN observed_name TEXT;
  `);
}

if (
  !observationColumns.some(
    (column) => column.name === "observed_category",
  )
) {
  database.exec(`
    ALTER TABLE environment_observations
    ADD COLUMN observed_category TEXT;
  `);
}

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
  claimedBy: string | null;
  claimExpiresAt: string | null;
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


export function createScanImage(
  image: ScanImage,
  playerId: string,
): ScanImage {
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
          AND claimed_by = ?
          AND (
            claim_expires_at IS NULL
            OR claim_expires_at > ?
          )
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
      playerId,
      new Date().toISOString(),
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

    if (
      playerId !== undefined &&
      (
        group.claimedBy !== playerId ||
        (
          group.claimExpiresAt !== null &&
          group.claimExpiresAt <= new Date().toISOString()
        )
      )
    ) {
      throw new Error("scan_claim_not_owned");
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
  claimed_by: string | null;
  claim_expires_at: string | null;
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
    claimedBy: row.claimed_by,
    claimExpiresAt: row.claim_expires_at,
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
        claimed_by,
        claim_expires_at,
        status,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      group.id,
      group.sessionCode,
      group.thresholdId,
      group.label,
      group.createdBy,
      group.claimedBy ?? group.createdBy,
      group.claimExpiresAt ?? null,
      group.status,
      group.createdAt,
    );

  return getScanGroup(group.id)!;
}


export function claimScanGroup(
  id: string,
  playerId: string,
  durationMinutes = 10,
): ScanGroup | null {
  const expiresAt = new Date(
    Date.now() + durationMinutes * 60_000,
  ).toISOString();

  const now = new Date().toISOString();

  const result = database
    .prepare(`
      UPDATE scan_groups
      SET
        claimed_by = ?,
        claim_expires_at = ?
      WHERE id = ?
        AND status = 'pending'
        AND (
          claimed_by IS NULL
          OR claimed_by = ?
          OR (
            claim_expires_at IS NOT NULL
            AND claim_expires_at <= ?
          )
        )
    `)
    .run(
      playerId,
      expiresAt,
      id,
      playerId,
      now,
    );

  if (result.changes === 0) {
    return null;
  }

  return getScanGroup(id);
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

export function deleteSessionScanGroups(
  sessionCode: string,
): number {
  const result = database
    .prepare(`
      DELETE FROM scan_groups
      WHERE session_code = ?
    `)
    .run(sessionCode);

  return Number(result.changes);
}

export function resetSessionScanGroupsForReuse(
  sessionCode: string,
): number {
  database.exec("BEGIN IMMEDIATE");

  try {
    database
      .prepare(`
        DELETE FROM scan_groups
        WHERE session_code = ?
          AND NOT EXISTS (
            SELECT 1
            FROM scan_images
            WHERE scan_images.scan_group_id = scan_groups.id
          )
      `)
      .run(sessionCode);

    const result = database
      .prepare(`
        UPDATE scan_groups
        SET
          status = 'uploaded',
          claimed_by = NULL,
          claim_expires_at = NULL
        WHERE session_code = ?
      `)
      .run(sessionCode);

    database.exec("COMMIT");

    return Number(result.changes);
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function finalizeScanGroup(
  id: string,
  playerId: string,
): ScanGroup | null {
  database
    .prepare(`
      UPDATE scan_groups
      SET status = 'uploaded'
      WHERE id = ?
        AND status = 'pending'
        AND claimed_by = ?
        AND (
          claim_expires_at IS NULL
          OR claim_expires_at > ?
        )
        AND EXISTS (
          SELECT 1
          FROM scan_images
          WHERE scan_group_id = ?
        )
    `)
    .run(
      id,
      playerId,
      new Date().toISOString(),
      id,
    );

  return getScanGroup(id);
}

export interface Environment {
  id: string;
  name: string;
  source: "simulated" | "scanned";
  createdAt: string;
}

interface EnvironmentRow {
  id: string;
  name: string;
  source: Environment["source"];
  created_at: string;
}

export function createEnvironment(
  environment: Environment,
): Environment {
  database
    .prepare(`
      INSERT INTO environments (
        id, name, source, created_at
      )
      VALUES (?, ?, ?, ?)
    `)
    .run(
      environment.id,
      environment.name,
      environment.source,
      environment.createdAt,
    );

  return environment;
}

export function getEnvironment(
  id: string,
): Environment | null {
  const row = database
    .prepare(`
      SELECT *
      FROM environments
      WHERE id = ?
    `)
    .get(id) as EnvironmentRow | undefined;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    source: row.source,
    createdAt: row.created_at,
  };
}

export type RecognitionStatus =
  | "confirmed"
  | "collection_only"
  | "uncertain";

export interface EnvironmentObject {
  id: string;
  environmentId: string;
  parentObjectId: string | null;
  name: string;
  category: string;
  description: string | null;
  location: string;
  recognitionStatus: RecognitionStatus;
  requiresCloserScan: boolean;
  createdAt: string;
}

interface EnvironmentObjectRow {
  id: string;
  environment_id: string;
  parent_object_id: string | null;
  name: string;
  category: string;
  description: string | null;
  location: string;
  recognition_status: RecognitionStatus;
  requires_closer_scan: number;
  created_at: string;
}

function toEnvironmentObject(
  row: EnvironmentObjectRow,
): EnvironmentObject {
  return {
    id: row.id,
    environmentId: row.environment_id,
    parentObjectId: row.parent_object_id,
    name: row.name,
    category: row.category,
    description: row.description,
    location: row.location,
    recognitionStatus: row.recognition_status,
    requiresCloserScan: row.requires_closer_scan === 1,
    createdAt: row.created_at,
  };
}

export function createEnvironmentObject(
  object: EnvironmentObject,
): EnvironmentObject {
  if (object.parentObjectId !== null) {
    const parent = getEnvironmentObject(object.parentObjectId);

    if (!parent) {
      throw new Error("environment_parent_not_found");
    }

    if (parent.environmentId !== object.environmentId) {
      throw new Error("environment_parent_mismatch");
    }
  }

  database
    .prepare(`
      INSERT INTO environment_objects (
        id,
        environment_id,
        parent_object_id,
        name,
        category,
        description,
        location,
        recognition_status,
        requires_closer_scan,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      object.id,
      object.environmentId,
      object.parentObjectId,
      object.name,
      object.category,
      object.description,
      object.location,
      object.recognitionStatus,
      object.requiresCloserScan ? 1 : 0,
      object.createdAt,
    );

  return object;
}

export function getEnvironmentObject(
  id: string,
): EnvironmentObject | null {
  const row = database
    .prepare(`
      SELECT *
      FROM environment_objects
      WHERE id = ?
    `)
    .get(id) as EnvironmentObjectRow | undefined;

  return row ? toEnvironmentObject(row) : null;
}

export function listEnvironmentObjects(
  environmentId: string,
): EnvironmentObject[] {
  const rows = database
    .prepare(`
      SELECT *
      FROM environment_objects
      WHERE environment_id = ?
      ORDER BY category, name, id
    `)
    .all(environmentId) as unknown as EnvironmentObjectRow[];

  return rows.map(toEnvironmentObject);
}

export interface EnvironmentObservation {
  id: string;
  environmentId: string;
  objectId: string;
  sessionCode: string | null;
  scanGroupId: string | null;
  observedName: string | null;
  observedCategory: string | null;
  observedDescription: string | null;
  observedLocation: string | null;
  recognitionStatus: RecognitionStatus;
  observedAt: string;
}

interface EnvironmentObservationRow {
  id: string;
  environment_id: string;
  object_id: string;
  session_code: string | null;
  scan_group_id: string | null;
  observed_name: string | null;
  observed_category: string | null;
  observed_description: string | null;
  observed_location: string | null;
  recognition_status: RecognitionStatus;
  observed_at: string;
}

function toEnvironmentObservation(
  row: EnvironmentObservationRow,
): EnvironmentObservation {
  return {
    id: row.id,
    environmentId: row.environment_id,
    objectId: row.object_id,
    sessionCode: row.session_code,
    scanGroupId: row.scan_group_id,
    observedName: row.observed_name,
    observedCategory: row.observed_category,
    observedDescription: row.observed_description,
    observedLocation: row.observed_location,
    recognitionStatus: row.recognition_status,
    observedAt: row.observed_at,
  };
}


export function createEnvironmentObservation(
  observation: EnvironmentObservation,
): EnvironmentObservation {
  const object = getEnvironmentObject(observation.objectId);

  if (!object) {
    throw new Error("environment_object_not_found");
  }

  if (object.environmentId !== observation.environmentId) {
    throw new Error("environment_observation_mismatch");
  }

  database
    .prepare(`
      INSERT INTO environment_observations (
        id,
        environment_id,
        object_id,
        session_code,
        scan_group_id,
        observed_name,
        observed_category,
        recognition_status,
        observed_at,
        observed_description,
        observed_location
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      observation.id,
      observation.environmentId,
      observation.objectId,
      observation.sessionCode,
      observation.scanGroupId,
      observation.observedName,
      observation.observedCategory,
      observation.recognitionStatus,
      observation.observedAt,
      observation.observedDescription,
      observation.observedLocation,
    );

  return observation;
}


export function getEnvironmentObservation(
  id: string,
): EnvironmentObservation | null {
  const row = database
    .prepare(`
      SELECT *
      FROM environment_observations
      WHERE id = ?
    `)
    .get(id) as EnvironmentObservationRow | undefined;

  return row ? toEnvironmentObservation(row) : null;
}

export function listEnvironmentObservations(
  environmentId: string,
  sessionCode: string | null = null,
): EnvironmentObservation[] {
  const rows = database
    .prepare(`
      SELECT *
      FROM environment_observations
      WHERE environment_id = ?
        AND session_code IS ?
      ORDER BY observed_at ASC, id ASC
    `)
    .all(
      environmentId,
      sessionCode,
    ) as unknown as EnvironmentObservationRow[];

  return rows.map(toEnvironmentObservation);
}

export function backfillBaselineObservationIdentity(
  environmentId: string,
  objectId: string,
  observedName: string,
  observedCategory: string,
): void {
  database
    .prepare(`
      UPDATE environment_observations
      SET
        observed_name = COALESCE(observed_name, ?),
        observed_category = COALESCE(observed_category, ?)
      WHERE environment_id = ?
        AND object_id = ?
        AND session_code IS NULL
        AND id = ?
    `)
    .run(
      observedName,
      observedCategory,
      environmentId,
      objectId,
      `baseline-${objectId}`,
    );
}

export function getOrCreateEnvironmentObjectRef(
  sessionCode: string,
  objectId: string,
): string {
  // SQLite serializes writes, and this transaction ensures that
  // reference allocation is atomic.
  database.exec("BEGIN IMMEDIATE");

  try {
    const existing = database
      .prepare(`
        SELECT model_ref
        FROM environment_object_refs
        WHERE session_code = ?
          AND object_id = ?
      `)
      .get(sessionCode, objectId) as
      | { model_ref: string }
      | undefined;

    if (existing) {
      database.exec("COMMIT");
      return existing.model_ref;
    }

database
  .prepare(`
    INSERT INTO environment_ref_counters (
      session_code,
      next_number
    )
    SELECT
      ?,
      COALESCE(
        (
          SELECT MAX(
            CAST(SUBSTR(model_ref, 10) AS INTEGER)
          ) + 1
          FROM environment_object_refs
          WHERE session_code = ?
        ),
        1
      )
    WHERE true
    ON CONFLICT(session_code) DO NOTHING
  `)
  .run(sessionCode, sessionCode);

  const next = database
    .prepare(`
      UPDATE environment_ref_counters
      SET next_number = next_number + 1
      WHERE session_code = ?
      RETURNING next_number - 1 AS allocated_number
    `)
    .get(sessionCode) as { allocated_number: number };

  const modelRef = `observed-${next.allocated_number}`;

    database
      .prepare(`
        INSERT INTO environment_object_refs (
          session_code,
          object_id,
          model_ref
        )
        VALUES (?, ?, ?)
      `)
      .run(sessionCode, objectId, modelRef);

    database.exec("COMMIT");
    return modelRef;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}


export function saveGameState(state: GameState): void {
  database.prepare(`
    INSERT INTO game_states (session_code, data)
    VALUES (?, ?)
    ON CONFLICT(session_code)
    DO UPDATE SET data = excluded.data
  `).run(
    state.sessionCode,
    JSON.stringify(state),
  );
}

export function loadGameState(
  sessionCode: string,
): GameState | null {
  const row = database.prepare(`
    SELECT data
    FROM game_states
    WHERE session_code = ?
  `).get(sessionCode) as
    | { data: string }
    | undefined;

  return row
    ? JSON.parse(row.data) as GameState
    : null;
}

export function deleteGameState(
  sessionCode: string,
): void {
  database.prepare(`
    DELETE FROM game_states
    WHERE session_code = ?
  `).run(sessionCode);
}
