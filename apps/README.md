# Threshold Applications

Threshold has two user-facing clients that participate in the same server-authoritative expedition.

| Application | Technology | Responsibility | Guide |
|---|---|---|---|
| **Lens** | React, TypeScript, Vite | Player identity, calibration photographs, private clues, choices and mobile gameplay | [Lens README](./lens/README.md) |
| **Fire TV** | Native Android/Kotlin | Shared Threshold display, expedition creation/joining, remote interaction and public transmissions | [Fire TV README](./fire-tv/README.md) |

The [session service](../services/session/README.md) owns the shared state, persistence, game rules, AI orchestration and image storage. **Do not make either client independently authoritative for shared progress or evidence.**

## Which component should I edit?

- Phone UI, camera, join flow, token handling or player-specific prompts → `apps/lens/src/`.
- Television UI, D-pad/Back behavior, APK, ADB, device ID or session restoration → `apps/fire-tv/app/src/`.
- HTTP contract, gameplay progression, calibration validation, AI, persistence or multiplayer coordination → `services/session/src/`.
- Cross-component setup and scripts → [contributor runbook](../dev-notes/development-environment.md) and [scripts reference](../scripts/README.md).

## Typical local run

In separate terminals from repository root:

```bash
pnpm install --frozen-lockfile
pnpm dev:resume
# second terminal
VITE_SESSION_SERVICE_URL=http://YOUR_LAN_IP:3001 pnpm --filter lens dev --host 0.0.0.0
# third terminal (after configuring Android SDK and a TV)
pnpm fire-tv:dev YOUR_ALIAS
```

Use a backend address reachable from **each physical device**. `localhost` on a phone or TV refers to that device, not your laptop. For production-like HTTPS access, follow the [development environment](../dev-notes/development-environment.md); do not assume the backend hostname serves the Lens web app.

## Shared testing expectations

Check the server health endpoint; verify TV creates/joins an expedition; join with Lens; upload calibration images; test gameplay across devices; then verify return/restart and reconnection. A passing build alone is not a complete multiplayer test. See [session lifecycle](../docs/session-lifecycle.md) and [game design](../docs/game-design.md).
