# Threshold — Development Environment & Contributor Runbook

> **Repository reference:** October 22, 2026 `main` snapshot (`b9980ee`). This is the hands-on companion to the root README. Commands below were checked against the repository scripts and configuration; they are **not** a claim that every hardware/network combination has been retested. Use a Linux shell (WSL2 or Arch Linux) unless noted.

## 1. System at a glance

| Component | Location | Technology | Development address |
|---|---|---|---|
| Session API and authoritative game state | `services/session/` | Node 22+, Express 5, TypeScript, SQLite | `http://localhost:3001` |
| Mobile Lens | `apps/lens/` | React 19, Vite 8, TypeScript | Vite's printed LAN URL (normally port 5173) |
| Fire TV Threshold | `apps/fire-tv/` | Kotlin, native Android, Gradle | APK installed via ADB |
| Calibration images | `services/session/src/imageStorage.ts` | Local files or private S3 | Backend-managed |
| Architect AI | `services/session/src/architect/` | Gemini or Ollama | Backend-only credentials |

**Data flow:** phone browser (Lens) ⇄ HTTP(S) session API ⇄ Fire TV client (polls API). The backend is authoritative; the Lens is **not** served by the Express API. Hosting the API alone does not give players a Lens URL. No cloud resources are required for the local workflow.

**Read next:** [`../docs/architecture.md`](../docs/architecture.md), [`../docs/session-lifecycle.md`](../docs/session-lifecycle.md), [`../docs/game-design.md`](../docs/game-design.md), [`decisions.md`](./decisions.md).

## 2. Prerequisites and first-time checkout

- Linux shell on WSL2 or Arch; Git, `curl`, `jq`, `adb`, `unzip` and standard build tools.
- Node.js **22 or newer**, Corepack/pnpm **10.18.0**; TypeScript **5.9.3** pinned by the repository.
- JDK **21** to run the Gradle wrapper; Android SDK Platform **35**, Build Tools **35.0.0**, Platform Tools (`adb`). Gradle wrapper **8.13**, Kotlin **2.0.21**, Android Gradle Plugin **8.9.1**.
- For physical TVs: Fire TV and computer on a reachable network; enable Developer Options and ADB debugging on each TV. Android/Fire OS menu wording varies.
- For Gemini: a working `GEMINI_API_KEY`; for local Ollama: Ollama installed/running with a compatible model. Neither is required just to check `/health` or use deterministic/offline paths.

```bash
# Ubuntu/WSL example; Arch users should use their package manager.
sudo apt update
sudo apt install -y git curl jq unzip android-tools
node --version          # >= 22
corepack enable
corepack pnpm --version # 10.18.0 (repository pins packageManager)
java -version          # JDK 21 expected
adb version

# Clone your fork or the canonical repository:
git clone https://github.com/hmw55/threshold.git
cd threshold
corepack pnpm install --frozen-lockfile

# Confirm toolchain and repository checks:
corepack pnpm check
```

The Gradle wrapper downloads its Gradle distribution automatically. Ensure Android SDK environment variables are available to Gradle, **or** set `sdk.dir=/absolute/path/to/Android/Sdk` in ignored `apps/fire-tv/local.properties`. Example:

```properties
sdk.dir=/home/YOUR_USER/Android/Sdk
SESSION_SERVICE_URL=http://192.168.1.50:3001
```

Do **not** copy someone else's LAN IP. Fire TV's `localhost` refers to the **TV itself**, not your workstation. The `SESSION_SERVICE_URL` value is compiled into `BuildConfig`, so **rebuild and reinstall the APK after changing it**.

## 3. Fastest local run: three terminals

### Terminal A — start the session backend

```bash
cd ~/projects/threshold  # or your actual checkout
corepack pnpm dev:resume
```

- Listens on **0.0.0.0:3001** by default (`PORT` overrides it).
- Uses `.local/threshold/sessions.sqlite` in the repository root.
- `dev:resume` **preserves** sessions, players, TV assignments and persisted state.
- `dev:fresh` **deletes** the designated SQLite database plus WAL/SHM files. Never use during an active playtest; it is destructive and does not necessarily delete stored image files.
- Launcher holds a local lock on TCP `127.0.0.1:43187` to prevent simultaneous dev launches. Do not run two session servers against the same database.

```bash
curl -i http://localhost:3001/health
# Expect HTTP 200 and JSON including status: ok, service: threshold-session
```

### Terminal B — start the Lens

```bash
cd ~/projects/threshold
# IMPORTANT: use the address reachable from the PHONE, not localhost.
cat > apps/lens/.env.local <<'ENV'
VITE_SESSION_SERVICE_URL=http://192.168.1.50:3001
ENV
corepack pnpm --filter lens dev --host 0.0.0.0
```

Replace `192.168.1.50` with the workstation's **reachable LAN IP** or a valid HTTPS backend URL. Open the Vite **Network** URL on the phone; it is separate from the API address. `.env.local` is ignored by Git. **Restart Vite after editing it.** Do not assume a phone can access a WSL2 service without Windows forwarding/firewall configuration.

For phone camera uploads, browser secure-context restrictions can apply. If a mobile browser refuses camera access on plain HTTP, use a properly configured HTTPS Lens origin or the browser's permitted local development workflow. Do not confuse a successful `/health` request with a working camera/upload path.

### Terminal C — configure, build and install the Fire TV app

```bash
cd ~/projects/threshold
# Edit/create apps/fire-tv/local.properties with your SDK path and API LAN/HTTPS URL.
cd apps/fire-tv
./gradlew assembleDebug
adb devices
adb connect 192.168.1.80:5555    # replace with YOUR TV's address
adb -s 192.168.1.80:5555 install -r app/build/outputs/apk/debug/app-debug.apk
adb -s 192.168.1.80:5555 shell am start -n com.thresholdtv/.MainActivity
```

The debug APK lives at `apps/fire-tv/app/build/outputs/apk/debug/app-debug.apk`. **Start the backend first**, then the TV. Create an expedition on a TV, open the Lens on a phone, join using the code shown by the TV, and proceed through calibration. For two or more TVs, join the **same expedition code** rather than creating independent sessions.

## 4. All repository-level scripts — exact behavior

| Command | Actual behavior | Important caution |
|---|---|---|
| `pnpm dev:resume` | Runs `node scripts/dev-session.mjs resume`; starts local backend and preserves SQLite | Recommended for ongoing development |
| `pnpm dev:fresh` | Runs `node scripts/dev-session.mjs fresh`; removes `.local/threshold/sessions.sqlite` and SQLite WAL/SHM | **Destructive**; stop active playtests first |
| `pnpm fire-tv:dev` | Interactive selector of named TVs; builds, installs, force-stops, launches | Requires `jq`, `adb`, ignored device JSON |
| `pnpm fire-tv:dev monitor` | Same, using `monitor` JSON entry | Alias exists only if configured locally |
| `pnpm fire-tv:dev bedroom` | Same, using `bedroom` JSON entry | Alias exists only if configured locally |
| `pnpm fire-tv:dev guest` | Same, using `guest` JSON entry | Alias exists only if configured locally |
| `pnpm fire-tv:deploy:all` | Builds once, installs APK on **every** authorized device in `adb devices` | Includes non-TV Android devices if connected |
| `pnpm fire-tv:launch:all` | Launches package on every authorized ADB device; no rebuild | Does **not** force-stop first |
| `pnpm build` | Recursive workspace build where defined | Does not replace Gradle APK build |
| `pnpm lint` | Recursive lint where defined | Backend has no separate lint script in snapshot |
| `pnpm typecheck` | Workspace typecheck + backend test TS check | Includes `@threshold/session typecheck:tests` |
| `pnpm test` | Recursive tests where defined | Backend uses Vitest |
| `pnpm check` | Lint → typecheck → tests | Run before push |

`pnpm` above means the repository-pinned pnpm (or use `corepack pnpm`). For targeted commands:

```bash
pnpm --filter @threshold/session test
pnpm --filter @threshold/session test:watch
pnpm --filter @threshold/session build
pnpm --filter lens build
pnpm --filter lens lint
cd apps/fire-tv && ./gradlew assembleDebug
```

### Environment-switch helper: use with care

`scripts/use-environment.sh {local|aws}` updates `apps/fire-tv/local.properties` and `apps/lens/.env.local`. **Its addresses are hard-coded in the current snapshot**, including a specific developer LAN address and an ephemeral Cloudflare Quick Tunnel. Do **not** use it unchanged on a new workstation. Inspect and replace its addresses first, or edit the two ignored configuration files manually. The `aws` mode sets the Lens **API** URL to `https://threshold-game.duckdns.org`; it does **not** deploy or serve the Lens frontend. After changing environments, **restart Vite, rebuild the APK, reinstall, and relaunch**.

## 5. Register a new Fire TV / add a named device

1. Connect the Fire TV to the network, enable developer/ADB debugging, and note its IP address from Fire TV network settings. If the device sleeps or its IP changes, reconnect or reserve its DHCP address.
2. From WSL/Linux run `adb connect TV_IP:5555`, approve the debugging authorization on the TV, and verify `adb devices` shows `TV_IP:5555 device` (not `unauthorized` or `offline`).
3. Create/edit **ignored** `scripts/fire-tv-devices.local.json`:

```json
{
  "living-room": {
    "serial": "192.168.1.80:5555",
    "description": "Living room Fire TV"
  },
  "guest": {
    "serial": "192.168.1.81:5555",
    "description": "Guest room Fire TV"
  }
}
```

4. Verify `jq . scripts/fire-tv-devices.local.json`, then run `pnpm fire-tv:dev living-room` or `pnpm fire-tv:dev` for the selector. The script reconnects to network serials, builds, installs and launches automatically.
5. To install on **all currently connected authorized ADB devices** use `pnpm fire-tv:deploy:all`; to launch already installed apps use `pnpm fire-tv:launch:all`.
6. To add the second TV **inside the game**, use its join-existing-expedition flow and the **same session code**; a separate session code is a different game. Server caps participating Thresholds at four.

**Troubleshooting ADB:** `adb kill-server && adb start-server`, then reconnect; check TV's ADB permission prompt, same network, firewall/VLAN isolation, correct port, and `adb -s SERIAL ...` when multiple devices are attached. On WSL, USB/ADB installations on Windows and WSL are distinct; use the `adb` binary whose device list you actually configured.

**Logs:**

```bash
adb devices
adb -s 192.168.1.80:5555 logcat -c
adb -s 192.168.1.80:5555 logcat -v time -s AndroidRuntime:E ActivityManager:I WindowManager:W
# More general diagnostics:
adb -s 192.168.1.80:5555 logcat | grep -Ei 'threshold|fatal exception|androidruntime'
```

## 6. API and session lifecycle

**API base:** `http://localhost:3001` on the backend machine, or the same service at a phone/TV-reachable URL. Responses are JSON except image uploads/downloads. Session codes are normalized by the clients. The API is not a public Lens website.

| Method and path | Purpose | Client |
|---|---|---|
| `GET /health` | Liveness | Any |
| `POST /sessions` | Create expedition, optionally register creator `deviceId` | Fire TV |
| `GET /sessions/:code` | Read shared session | TV / Lens |
| `GET /sessions/:code/opening` | Spoiler-safe briefing once ready/playing/results | TV |
| `POST /sessions/:code/thresholds` | Add another TV | TV |
| `POST /sessions/:code/thresholds/reconnect` | Reconnect known TV | TV |
| `DELETE /sessions/:code/thresholds/:deviceId` | Remove TV; final TV removal closes session | TV |
| `POST /sessions/:code/join` | Join Lens player; receive player identity/credential | Lens |
| `POST /sessions/:code/reconnect` | Restore Lens identity with credentials | Lens |
| `DELETE /sessions/:code/players/:playerId` | Leave expedition | Lens |
| `POST /sessions/:code/advance` | Progress session phase, subject to backend guards | TV |
| `POST /sessions/:code/back` | Return toward lobby | TV |
| `POST /sessions/:code/restart` | Restart expedition with configured calibration choice | TV |
| `GET /sessions/:code/scan-groups` | Read calibration groups | Lens |
| `POST /sessions/:code/scan-groups` | Create calibration group | Lens |
| `POST /sessions/:code/scan-groups/:groupId/images` | Upload calibration images (multipart) | Lens |
| `POST /sessions/:code/scan-groups/:groupId/finalize` | Finalize scan group | Lens |
| `GET /sessions/:code/environment/objects` | List observed objects | Lens |
| `GET /sessions/:code/witness` | Get player-specific Last Witness view | Lens |
| `POST /sessions/:code/witness/action` | Submit witness action | Lens |
| `POST /sessions/:code/witness/photo` | Upload evidence photograph | Lens |
| `GET /sessions/:code/threshold/game` | Get TV game state | TV |
| `POST /sessions/:code/threshold/witness/pulse` | TV cooperation signal | TV |

Additional routes exist for calibration claims/object confirmation, field encounters, game missions, transmissions and verdicts in `services/session/src/routes/{calibrationRoutes,fieldRoutes,thresholdRoutes,witnessRoutes}.ts`. This table is an **entry point**, not a full OpenAPI contract. Read those route files for exact request bodies, phase guards, authorization headers and response errors. Do not invent request bodies from path names. Lens API wrappers are in `apps/lens/src/services/`; TV wrappers in `apps/fire-tv/app/src/main/java/com/thresholdtv/session/SessionClient.kt`.

**Minimal smoke test:**

```bash
curl -fsS http://localhost:3001/health
curl -i -X POST http://localhost:3001/sessions \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"local-test-tv"}'
# Save the returned code, then:
curl -i http://localhost:3001/sessions/YOUR_CODE
```

The smoke-test session is separate from your active physical-TV expedition. Authentication is required for player-specific operations; Lens gameplay requests use `Authorization: Bearer <player-token>` where specified. Never commit or print live tokens in shared logs. The server uses player credentials to distinguish private actions from public session reads.

**Lifecycle:** `lobby → calibrating → ready → playing → results`; read `docs/session-lifecycle.md` for transition conditions, restart semantics and restoration behavior. A finished witness encounter and the outer session phase are distinct concepts; test both. Lens supports up to six players; one to four TVs can join.

## 7. AI provider setup (Gemini, Ollama, offline)

Provider selection in `services/session/src/architect/createAiProvider.ts` is:

1. Explicit `THRESHOLD_AI_PROVIDER` if set;
2. Otherwise `gemini` when `GEMINI_API_KEY` exists;
3. Otherwise `ollama`.

**Bedrock is NOT implemented as a working inference provider in this snapshot**; selecting `THRESHOLD_AI_PROVIDER=bedrock` throws an error. AWS is used for infrastructure and image storage, not for a confirmed Bedrock inference path.

### Gemini (cloud)

```bash
mkdir -p ~/.config/threshold
chmod 700 ~/.config/threshold
# Create ~/.config/threshold/gemini.env using your editor; don't paste a real key into Git.
# Contents: GEMINI_API_KEY=YOUR_PRIVATE_KEY
chmod 600 ~/.config/threshold/gemini.env
cd ~/projects/threshold
set -a
source ~/.config/threshold/gemini.env
set +a
export THRESHOLD_AI_PROVIDER=gemini
pnpm dev:resume
```

`GEMINI_MODEL` optionally overrides the repository's configured default (`gemini-3.5-flash-lite` in the inspected snapshot). Model availability depends on the provider/account; set a model you can actually invoke if necessary. A key being set does **not** prove the model can be called. To test, upload a real calibration photo and inspect backend errors/object assessments. Verify only the presence of the key without exposing it:

```bash
[ -n "${GEMINI_API_KEY:-}" ] && echo 'Gemini key configured' || echo 'Gemini key missing'
```

### Ollama (local)

```bash
# Install Ollama using its official installation instructions, then:
ollama serve                   # if not already running as a service
ollama pull gemma3:4b
# In the backend terminal:
export THRESHOLD_AI_PROVIDER=ollama
export OLLAMA_MODEL=gemma3:4b
pnpm dev:resume
```

Ollama provider defaults to `http://127.0.0.1:11434` and `gemma3:4b` in `ollamaProvider.ts`. Verify `curl http://127.0.0.1:11434/api/tags`. If Ollama runs on Windows while the backend runs in WSL, `127.0.0.1` may not route as expected; verify host reachability before blaming the game.

### Offline and failures

Set `THRESHOLD_ARCHITECT_MODE=offline` to disable selected Architect/vision calls and use deterministic fallbacks. This is useful for testing game mechanics, **not** a substitute for validating actual AI-generated calibration. If an AI request fails, inspect server logs and the Lens' explicit verified/unverified state. Never claim an object was visually confirmed when the provider did not actually confirm it.

## 8. Persistence, images and AWS

- **Local SQLite:** `.local/threshold/sessions.sqlite` via `THRESHOLD_DB_PATH`; this and `.local/` are Git-ignored. `dev:resume` preserves the DB; `dev:fresh` deletes it. Back up the DB **with the server stopped** before risky experiments.
- **Local images:** `THRESHOLD_IMAGE_STORAGE_PATH` controls the local image root; otherwise `imageStorage.ts` uses its relative default. Paths may depend on process working directory. For reproducible setups, set an **absolute** directory under your checkout, e.g. `export THRESHOLD_IMAGE_STORAGE_PATH="$PWD/.local/threshold/images"` before starting the backend.
- **S3:** setting `THRESHOLD_S3_BUCKET` switches image storage to AWS S3 via the AWS SDK credential chain. Use least-privilege IAM credentials/instance roles; don't put static access keys in code. For local onboarding, **leave `THRESHOLD_S3_BUCKET` unset**.
- **Cloud:** AWS deployment uses EC2, private S3, IAM instance role, Systems Manager/Parameter Store, Caddy HTTPS and CloudWatch. Public backend hostname: `https://threshold-game.duckdns.org` (historical deployment; availability not guaranteed). **Do not use production AWS resources or restart cloud services for a routine local playtest.**
- **Operational logs:** `THRESHOLD_OPERATIONAL_LOG_PATH` configures structured JSONL logging. CloudWatch configuration/alarms are deployment concerns, not prerequisites for local development.

## 9. Networking: WSL, phones, TV and HTTPS

**Three different addresses must be understood:**

1. `http://localhost:3001` — works only from the machine/network namespace hosting the backend.
2. `http://YOUR_REACHABLE_LAN_IP:3001` — for TVs and phones on the same reachable LAN.
3. Lens Vite URL, e.g. `http://YOUR_REACHABLE_LAN_IP:5173` — the **web app**, not the API.

In WSL2, services can be reachable from Windows itself yet unreachable from other LAN devices. Configure Windows-to-WSL forwarding/firewall rules or use WSL mirrored networking as appropriate to your OS; verify the actual port mapping rather than copying another developer's `netsh` configuration. Test from a **phone** using its browser:

```bash
# On development machine:
curl -i http://localhost:3001/health
# On phone browser (replace address):
# http://192.168.1.50:3001/health
# http://192.168.1.50:5173/
```

If HTTPS tunnels are used, frontend and backend may have **different** URLs. Cloudflare Quick Tunnel URLs are temporary; update `apps/lens/.env.local`, restart Vite, and rebuild TV only when its API URL changes. A tunnel returning HTTP 200 for Lens or HTTP 404 at the API root proves connectivity only, **not** successful uploads or gameplay. For the backend use `/health`.

## 10. Verification and full playtest checklist

```bash
cd ~/projects/threshold
pnpm check
pnpm --filter lens build
pnpm --filter @threshold/session build
(cd apps/fire-tv && ./gradlew assembleDebug)
curl -fsS http://localhost:3001/health
```

Then verify **on physical hardware**:

- [ ] Fire TV creates a session and shows a code; Lens joins and appears on TV.
- [ ] Second Fire TV joins the **same** session, displays a distinct zone and survives refresh/reconnect.
- [ ] Lens camera upload reaches backend; photo/object status is visible and honestly verified/unverified.
- [ ] Calibration can advance to gameplay; TV and Lens agree on session phase.
- [ ] Solo expedition completes without requiring a nonexistent second player.
- [ ] Multiplayer private/cooperative actions and TV synchronization work with the actual devices present.
- [ ] Four-way/2×2 UI controls respond to remote or touch as intended.
- [ ] Return-to-lobby and restart behavior work from all applicable screens.
- [ ] Finale/results appear on Lens and TV; next expedition starts without manual database deletion.
- [ ] Lens and TV reconnect after process/app restart, without duplicating participants.

A passing build is not proof that every path above works. Record failures in [`../docs/friction-logs/developer.md`](../docs/friction-logs/developer.md) or [`../docs/friction-logs/amazon.md`](../docs/friction-logs/amazon.md).

## 11. Troubleshooting quick reference

| Symptom | Check first | Typical fix |
|---|---|---|
| Lens says `VITE_SESSION_SERVICE_URL is not configured` | `apps/lens/.env.local` and Vite process | Set URL; **restart Vite** |
| Phone opens Lens but API calls fail | Phone can open API `/health`? | Use LAN/HTTPS URL, not `localhost`; fix WSL forwarding/firewall/CORS/network |
| Fire TV connects to wrong backend | `apps/fire-tv/local.properties` | Change `SESSION_SERVICE_URL`; **rebuild + reinstall** APK |
| TV is `unauthorized` in `adb devices` | Debug prompt on TV | Reauthorize and `adb connect`; check network |
| `pnpm fire-tv:dev` says config missing | `scripts/fire-tv-devices.local.json` | Create JSON with named `serial` and `description`; install `jq` |
| Two backends or SQLite conflict | Launcher port 43187, port 3001, active processes | Stop prior launcher; don't delete DB during active service |
| Session disappeared | Was `dev:fresh` used? Is `THRESHOLD_DB_PATH` same? | Use `dev:resume`; check exact DB path; restore backup if available |
| Upload says `Failed to fetch` | Network, API URL, HTTPS/CORS, backend request logs | Check actual failed request and server response before guessing root cause |
| Calibration marked `unverified` | Gemini key/model, provider timeout, Ollama status | Test provider independently; inspect backend error; don't fabricate verification |
| Gradle can't find SDK | `sdk.dir`, Android SDK installation | Fix ignored `local.properties`/SDK environment |
| Older Fire TV refuses install | `minSdk`, device API, APK error | Current project `minSdk=25`; check `adb install` output |
| App launches but remote doesn't navigate | Actual remote focus and key dispatch | Test on TV; inspect `logcat`; don't rely solely on emulator/build |
| Cloud URL responds but no Lens page | API is not Lens frontend | Start/host Vite frontend separately |

## 12. Contributor hygiene and safe defaults

- Work on a branch; use `pnpm check` and targeted device testing before pushing. GitHub Actions is a verification layer, not the primary development loop.
- Do not commit `.env.local`, `local.properties`, `scripts/fire-tv-devices.local.json`, `.local/`, calibration photos, private player tokens, API keys or account identifiers.
- Prefer `dev:resume`. Treat `dev:fresh` as destructive and clearly announce its use during collaborative testing.
- Keep code, scripts and this runbook synchronized. If an example diverges from implementation, **the inspected source files and actual CLI `--help`/errors take precedence**.
- Do not represent Bedrock as operational, or assume the deployed API is a public Lens website.
- Keep troubleshooting logs sanitized before posting issues or PRs.

**Primary source files:** `package.json`; `scripts/dev-session.mjs`, `scripts/fire-tv-dev.sh`, `scripts/fire-tv-all.sh`, `scripts/use-environment.sh`; `apps/fire-tv/app/build.gradle.kts`; `apps/lens/src/services/apiClient.ts`; `services/session/src/index.ts`, `services/session/src/routes/*.ts`, `services/session/src/architect/createAiProvider.ts`, `services/session/src/imageStorage.ts`.
