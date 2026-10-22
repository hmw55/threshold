# Session Service — API and Backend Guide

Threshold's **Node.js 22+ / Express 5 / TypeScript** backend is the authoritative coordinator for expeditions. It maintains session membership, game rules and progress, calibration evidence, and player credentials. The Fire TV and Lens are clients, not sources of game truth.

> Start with [the full contributor runbook](../../dev-notes/development-environment.md), then use this document for backend work. See [session lifecycle](../../docs/session-lifecycle.md), [architecture](../../docs/architecture.md), and [game design](../../docs/game-design.md).

## Install and run

From repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev:resume           # preserves .local/threshold/sessions.sqlite
# alternatively: pnpm dev:fresh  # DELETES the local expedition SQLite database
```

The launcher starts the backend on port **3001** by default and prevents two launcher instances from accessing the same development DB. Stop the running launcher before starting another. `pnpm --filter @threshold/session dev` runs the backend watcher directly; prefer the root launcher for normal local playtests. The server binds `0.0.0.0` (ensure firewall rules and network exposure are intentional).

```bash
curl -i http://localhost:3001/health
pnpm --filter @threshold/session typecheck
pnpm --filter @threshold/session typecheck:tests
pnpm --filter @threshold/session test
pnpm --filter @threshold/session build
```

## Configuration

| Setting | Purpose |
|---|---|
| `PORT` | HTTP port, defaults to `3001` |
| `THRESHOLD_DB_PATH` | SQLite database path; launcher sets `.local/threshold/sessions.sqlite` |
| `THRESHOLD_LOCK_HELD_BY_LAUNCHER` | Internal marker set by launcher; do not normally set manually |
| `NODE_ENV` | `development`, `test`, or `production` behavior |
| `THRESHOLD_AI_PROVIDER` | `gemini` or `ollama`; `bedrock` explicitly throws (not implemented) |
| `GEMINI_API_KEY` | Secret key for Gemini, only in backend environment |
| `GEMINI_MODEL` | Gemini model override; inspect `src/architect/createAiProvider.ts` for default |
| `OLLAMA_MODEL` | Local model override; default referenced in server is `gemma3:4b` |
| `THRESHOLD_ARCHITECT_MODE` | `offline` disables some AI-assisted actions; deterministic gameplay remains |
| `THRESHOLD_S3_BUCKET` | Enables private S3 image storage; without it uses local file storage |

See `src/imageStorage.ts` and `src/sessionStore.ts` for storage implementation and other supported environment settings. Never commit keys or local credentials. The AWS deployment uses EC2, an instance IAM role, S3 and Systems Manager Parameter Store; see [architecture](../../docs/architecture.md). **A running backend URL is not a hosted Lens UI.**

### Gemini example (local only)

```bash
mkdir -p ~/.config/threshold
chmod 700 ~/.config/threshold
printf 'GEMINI_API_KEY=replace-with-your-key\n' > ~/.config/threshold/gemini.env
chmod 600 ~/.config/threshold/gemini.env
set -a; source ~/.config/threshold/gemini.env; set +a
export THRESHOLD_AI_PROVIDER=gemini
pnpm dev:resume
```

Do not copy a real key into docs, commits or logs. Ollama can be selected with `THRESHOLD_AI_PROVIDER=ollama`; install/start Ollama and obtain the intended local model first. Provider requests can fail or return unverified analysis: clients must not treat AI guesses as confirmed physical evidence.

## First API requests

Create a session (normally performed by Fire TV):

```bash
BASE=http://localhost:3001
curl -sS -X POST "$BASE/sessions" -H 'Content-Type: application/json' \
  -d '{"deviceId":"contributor-tv-01"}'
```

Copy the returned session `code` for subsequent requests:

```bash
curl -sS "$BASE/sessions/YOUR_CODE"
curl -sS -X POST "$BASE/sessions/YOUR_CODE/join" \
  -H 'Content-Type: application/json' -d '{"name":"Tester"}'
```

The join response includes `player.id` and **`playerToken`**. Treat the token as a secret. Reconnection uses `POST /sessions/:code/reconnect` with `playerId` and `playerToken` in JSON. Protected player operations use the `Authorization: Bearer <playerToken>` header. Route-specific schemas and state prerequisites matter: don't assume every endpoint accepts the same authentication or is callable in every phase.

## API route inventory (derived from source)

These routes are declared in `src/routes/` in the October 22 snapshot. Some paths are legacy or phase-specific. The code and tests are authoritative for bodies, response fields, authentication and transition requirements.

### `calibrationRoutes.ts`

| Method | Path |
|---|---|
| `POST` | `/sessions/:code/environment/objects/:objectId/confirm` |
| `POST` | `/sessions/:code/environment/objects/:objectId/review` |
| `GET` | `/sessions/:code/environment/objects` |
| `POST` | `/sessions/:code/environment/objects` |
| `POST` | `/sessions/:code/scan-groups/:groupId/finalize` |
| `POST` | `/sessions/:code/scan-groups/:groupId/claim` |
| `POST` | `/sessions/:code/scan-groups` |
| `GET` | `/sessions/:code/scan-groups` |
| `GET` | `/sessions/:code/scan-groups/:groupId` |
| `POST` | `/sessions/:code/scan-groups/:groupId/images` |

### `fieldRoutes.ts`

| Method | Path |
|---|---|
| `GET` | `/sessions/:code/game/anchor` |
| `POST` | `/sessions/:code/game/anchor/answer` |
| `GET` | `/sessions/:code/game/transmission` |
| `POST` | `/sessions/:code/game/transmission/answer` |
| `GET` | `/sessions/:code/game/reconstruction` |
| `POST` | `/sessions/:code/game/reconstruction/answer` |
| `GET` | `/sessions/:code/game/contradiction` |
| `POST` | `/sessions/:code/game/contradiction/step` |
| `POST` | `/sessions/:code/game/contradiction/answer` |
| `GET` | `/sessions/:code/game/revelation` |
| `POST` | `/sessions/:code/game/revelation/step` |
| `POST` | `/sessions/:code/game/revelation/answer` |
| `POST` | `/sessions/:code/game/resolution/answer` |
| `GET` | `/sessions/:code/field` |
| `POST` | `/sessions/:code/field/objects` |
| `POST` | `/sessions/:code/field/displacement/action` |
| `POST` | `/sessions/:code/field/displacement/investigate` |
| `POST` | `/sessions/:code/field/cooperation` |
| `POST` | `/sessions/:code/field/observation` |
| `POST` | `/sessions/:code/field/verdict` |
| `POST` | `/sessions/:code/field/puzzle` |
| `POST` | `/sessions/:code/field/allegiance` |
| `POST` | `/sessions/:code/field/expose` |
| `GET` | `/sessions/:code/game` |
| `POST` | `/sessions/:code/game/missions/:missionId/evidence` |
| `GET` | `/sessions/:code/game/missions` |
| `GET` | `/sessions/:code/game/transmissions` |

### `sessionRoutes.ts`

| Method | Path |
|---|---|
| `GET` | `/health` |
| `POST` | `/sessions` |
| `GET` | `/sessions/:code` |
| `GET` | `/sessions/:code/opening` |
| `POST` | `/sessions/:code/thresholds` |
| `POST` | `/sessions/:code/thresholds/reconnect` |
| `DELETE` | `/sessions/:code/thresholds/:deviceId` |
| `POST` | `/sessions/:code/advance` |
| `POST` | `/sessions/:code/back` |
| `POST` | `/sessions/:code/restart` |
| `POST` | `/sessions/:code/join` |
| `POST` | `/sessions/:code/reconnect` |
| `DELETE` | `/sessions/:code/players/:playerId` |

### `thresholdRoutes.ts`

| Method | Path |
|---|---|
| `POST` | `/sessions/:code/threshold/resolution/answer` |
| `POST` | `/sessions/:code/threshold/game/decision` |
| `POST` | `/sessions/:code/threshold/field/verdict` |
| `GET` | `/sessions/:code/threshold/game` |
| `GET` | `/sessions/:code/threshold/missions` |

### `witnessRoutes.ts`

| Method | Path |
|---|---|
| `GET` | `/sessions/:code/witness` |
| `POST` | `/sessions/:code/witness/action` |
| `POST` | `/sessions/:code/witness/photo` |
| `GET` | `/sessions/:code/witness/evidence/:evidenceId` |
| `GET` | `/sessions/:code/threshold/game` |
| `POST` | `/sessions/:code/threshold/witness/pulse` |
| `POST` | `/sessions/:code/threshold/field/verdict` |


Additional routes may be declared in `src/app.ts` or through composed route registrations. For endpoint contracts, inspect the relevant handler and its corresponding `tests/*api.test.ts` rather than inferring request shapes from this inventory.

## Lifecycle and game authority

Session phases: `lobby → calibrating → ready → playing → results`. Fire TVs create/register by stable `deviceId`; Lenses join as players and reconnect with a player credential. The server stores shared state and enforces game progression. An expedition may be restarted with existing or fresh calibration according to the restart endpoint's supported `mode` contract; review `src/routes/sessionRoutes.ts` before scripting restarts. The final TV leaving can close the session. Read [session lifecycle](../../docs/session-lifecycle.md) for full details.

Relevant implementation:

- `src/app.ts`: Express app, route context, state model, initialization.
- `src/routes/`: HTTP handlers and request validation.
- `src/sessionStore.ts`: SQLite persistence and player credential hashes.
- `src/game/witnessExpedition.ts` and `src/game/fieldExpedition.ts`: gameplay stage models.
- `src/architect/`: AI provider abstraction, calibration and Architect decisions.
- `src/imageStorage.ts`: local/S3 image storage.
- `src/operationalLogger.ts`: allowlisted operational events.

## Debugging and validation

1. `curl /health` fails: check terminal errors, port 3001, and whether another launcher holds the lock.
2. Session exists but clients fail: check exact session code, phase, network reachability, and client backend URLs.
3. `401`: inspect player identity and Bearer token; don't print secrets into shared logs.
4. `409`: check phase/interaction prerequisites; do not bypass backend validation in the UI.
5. Calibration fails: inspect upload size/type, provider configuration, S3 permissions if enabled, and backend errors. An unverified AI result is not proof of a bad photo.
6. Persistence problems: confirm `THRESHOLD_DB_PATH`, use `dev:resume`, and avoid `dev:fresh` during ongoing testing.
7. Run `pnpm --filter @threshold/session test` and add a route-level test for each changed contract.

**Security note:** the development server enables CORS and listens on all interfaces. Don't expose it to the public internet without appropriate access controls, TLS, and deployment hardening. Never commit uploaded images, credentials, or SQLite data.
