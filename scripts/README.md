# Development Scripts — Command Reference

These scripts are run from the **repository root**. Read [development environment](../dev-notes/development-environment.md) before first-time setup.

## Root package commands

| Command | What it does | Side effects |
|---|---|---|
| `pnpm dev:demo` | Interactive complete demo with optional HTTPS Lens tunnel and selected TVs | Starts/reuses services; changes ignored local configuration |
| `pnpm fire-tv:demo` | Interactive deployment to selected TVs | Builds/installs/launches selected devices |
| `pnpm dev:resume` | Start watched session backend using the local SQLite database | **Preserves** expeditions |
| `pnpm dev:fresh` | Delete designated local SQLite database and start backend | **Destructive**: removes local expedition state |
| `pnpm fire-tv:dev` | Interactive named Fire TV selection; build, install, restart app | Changes installed app on one TV |
| `pnpm fire-tv:dev <alias>` | Same operation on configured alias | Changes one TV |
| `pnpm fire-tv:deploy:all` | Build once, install APK on every authorized connected ADB device | Installs on **all** connected devices, not only TVs |
| `pnpm fire-tv:launch:all` | Launch existing app on every authorized connected ADB device | Does not build or install |
| `pnpm lint` | Run workspace lint scripts | No intentional persistent state change |
| `pnpm typecheck` | Workspace type checks plus session tests | No intentional persistent state change |
| `pnpm test` | Workspace tests | Tests may use temporary state |
| `pnpm build` | Workspace builds | Writes build artifacts |
| `pnpm check` | Lint, typecheck and test | Recommended before commits |

## Interactive demo wizard (`demo-launcher.mjs`)

```bash
pnpm dev:demo       # backend + Lens + optional Cloudflare HTTPS + selected TVs
pnpm fire-tv:demo   # selected Fire TV deployment only
```

`dev:demo` registers/updates device aliases in ignored `scripts/fire-tv-devices.local.json`, offers an AI provider choice, asks for the backend URL reachable by TVs, starts/reuses local services, optionally starts a temporary Cloudflare tunnel for phone camera access, and builds/installs/launches selected TVs. The final READY screen prints the **current** HTTPS Lens URL. `fire-tv:demo` only builds and deploys the selected TVs; it does not start Cloudflare or the backend.

Lens demo configuration is `VITE_SESSION_SERVICE_URL=/`, using the Vite `/sessions` proxy to the local backend. The Fire TV uses a separately configured backend address and must reach the **same** session service. On WSL2, Windows port forwarding/firewall settings may be necessary. Avoid reusing expired Quick Tunnel URLs. If a phone gets `Failed to fetch`, check `apps/lens/.env.development.local` for a higher-priority stale override of `.env.local`, then restart Vite.

## `dev-session.mjs`

```bash
pnpm dev:resume
pnpm dev:fresh   # WARNING: deletes .local/threshold/sessions.sqlite (+ WAL/SHM)
```

The launcher rejects `NODE_ENV=production`, acquires a local lock on TCP `127.0.0.1:43187`, sets `THRESHOLD_DB_PATH`, and starts `pnpm --filter @threshold/session dev` with `PORT=3001` unless overridden. Stop the previous launcher first. If a stale session is confusing you, inspect its state before deleting the database.

## `fire-tv-dev.sh`: named TV deployment

Prerequisites: `adb`, `jq`, Android SDK, Java/Gradle dependencies, and a **local ignored** `scripts/fire-tv-devices.local.json` file. Example (replace serial with your own device):

```json
{
  "living-room": {
    "serial": "192.168.1.50:5555",
    "description": "Living room Fire TV"
  },
  "office": {
    "serial": "192.168.1.51:5555",
    "description": "Office Fire TV"
  }
}
```

```bash
adb connect 192.168.1.50:5555
adb devices
pnpm fire-tv:dev living-room
pnpm fire-tv:dev             # interactive selector
```

The script builds `apps/fire-tv` with `./gradlew assembleDebug`, installs `app-debug.apk` with `adb -s <serial> install -r`, force-stops `com.thresholdtv`, then starts `com.thresholdtv/.MainActivity`. An alias only selects an **ADB target**; the actual game device registration is handled by the app/backend. To add a TV, enable ADB debugging on it, discover its address, connect/authorize, then add its serial to the local JSON file. Do not commit LAN IPs.

## `fire-tv-all.sh`: all-device operations

```bash
pnpm fire-tv:deploy:all
pnpm fire-tv:launch:all
```

Both enumerate **every** device whose `adb devices` status is `device`. `deploy` builds once and installs on each; `launch` starts the already installed activity. They do **not** read named aliases. Disconnect unrelated Android devices first. `launch` does not force-stop the application or rebuild it.

## `use-environment.sh`: local/AWS URL switching

```bash
# READ THE SCRIPT AND REPLACE ITS MACHINE-SPECIFIC VALUES FIRST
bash scripts/use-environment.sh local
bash scripts/use-environment.sh aws
```

This script edits `apps/fire-tv/local.properties` (`SESSION_SERVICE_URL`) and `apps/lens/.env.local` (`VITE_SESSION_SERVICE_URL`). The October 22 snapshot contains hard-coded developer LAN and tunnel addresses; **do not assume these URLs work for you**. The AWS setting also points Lens at the backend hostname, which is **not** a hosted Lens frontend. A changed Fire TV BuildConfig URL requires rebuilding/reinstalling the APK; Vite environment changes require restarting Vite.

## Common failures

- `jq: command not found`: install `jq` (e.g., `sudo apt install jq`).
- `device unauthorized`: accept the debugging authorization prompt on the TV; re-run `adb devices`.
- `offline` or missing TV: wake it, confirm its IP, run `adb connect IP:5555` again.
- `more than one device`: use `adb -s SERIAL ...` or a named alias.
- App connects to the wrong backend: inspect `local.properties`, rebuild and reinstall.
- Backend launcher already running: stop it rather than starting a second instance or deleting the database.

See [Fire TV](../apps/fire-tv/README.md), [Lens](../apps/lens/README.md), and [session backend](../services/session/README.md).
