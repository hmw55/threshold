# Lens — Mobile Player Client

Lens is Threshold's React 19 / TypeScript / Vite web client. Players use a phone to join an expedition, capture environment evidence, receive private information and submit gameplay decisions. The **backend** is authoritative; Lens must not invent evidence or advance shared state independently.

See [applications overview](../README.md), [session API](../../services/session/README.md), and [full development environment](../../dev-notes/development-environment.md).

## First run

Requirements: Node.js 22+, pnpm 10.18.0, a running session backend, and a phone/browser that can reach both services.

```bash
cd /path/to/threshold
corepack enable
pnpm install --frozen-lockfile
pnpm dev:resume                           # terminal 1: backend
```

In terminal 2:

```bash
cd /path/to/threshold
cat > apps/lens/.env.local <<'EOF'
VITE_SESSION_SERVICE_URL=http://192.168.1.100:3001
EOF
pnpm --filter lens dev --host 0.0.0.0
```

Replace `192.168.1.100` with the **computer's reachable LAN address**. Open the URL printed by Vite from your phone, typically `http://LAN_IP:5173`. The browser makes API requests directly to `VITE_SESSION_SERVICE_URL`; both phone and TV need to reach that backend. `.env.local` is local configuration and must not be committed. **Restart Vite after changing environment variables.**

The application throws if `VITE_SESSION_SERVICE_URL` is absent (`src/services/apiClient.ts`). The backend's public `/health` URL is not the Lens website. For internet/mobile-network use, deploy or tunnel **both** frontend and backend with appropriate HTTPS and configure the API URL accordingly.

## Development commands

```bash
pnpm --filter lens dev --host 0.0.0.0
pnpm --filter lens build
pnpm --filter lens lint
pnpm --filter lens preview
```

A Vite production build creates static frontend assets; it does not deploy the session service or provision an HTTPS domain.

## Code map

- `src/App.tsx`: top-level UI and routing/state composition.
- `src/hooks/useExpeditionSession.ts`: expedition session/client coordination.
- `src/services/apiClient.ts`: configured backend base URL and shared HTTP behavior.
- `src/services/sessionClient.ts`: create/join/reconnect and session operations.
- `src/services/environmentClient.ts`: environmental calibration requests.
- `src/services/gameClient.ts`: gameplay endpoints and interaction requests.
- `src/components/JoinScreen.tsx`, `ConnectedScreen.tsx`: entry and lobby flow.
- `src/components/RoomScanner.tsx`: photo calibration and review.
- `src/components/FieldExpedition.tsx`, `FieldEvidenceCamera.tsx`: field gameplay and observations.
- `src/components/ArchitectFeed.tsx`, `InvestigationScreen.tsx`, `ContradictionScreen.tsx`, `RevelationScreen.tsx`, `ResolutionScreen.tsx`: narrative/game stages.
- `src/types/session.ts`: shared client-facing session types.

> The snapshot contains `.bak` files under `src/components/`; these are not part of the documented active application workflow and should be reviewed before a public release.

## Player identity and API

A TV creates an expedition; the player enters its code in Lens. The join endpoint returns a player ID and token. Reconnect uses both values; protected actions use `Authorization: Bearer <token>`. Never log or publish the token. See [backend API reference](../../services/session/README.md) for endpoint inventory, and consult `src/services/*.ts` for exact client request shapes.

## Calibration and mobile-browser testing

Use a real phone to verify image capture, permissions, upload, object review, and gameplay progression. The backend limits calibration image size and number; UI and API must handle explicit errors and unverified AI results. Mobile camera access may require a **secure context (HTTPS)** depending on browser and API; a LAN HTTP URL working for UI loading does not guarantee camera access. Use HTTPS/tunnels for remote tests and confirm cross-origin access to the backend.

### Debugging checklist

1. **Blank screen / configuration error:** set `VITE_SESSION_SERVICE_URL` and restart Vite.
2. **Failed to fetch:** check `/health` from the **phone**, not only your laptop; inspect CORS, LAN/firewall, mixed HTTP/HTTPS content, and stale tunnel URLs.
3. **Can't join:** confirm session code, lobby phase, and that the TV is still registered.
4. **401 or failed reconnect:** verify correct player ID/token and whether the expedition was reset.
5. **Upload fails:** inspect browser network request, size/type, camera permissions, and backend provider/storage logs; don't infer AI success from upload success.
6. **Stuck stage:** inspect backend game phase and response status; stale UI requests must not be treated as authoritative.
7. **Restart behavior:** test lobby return, fresh/reused calibration paths, and completed-game results on the actual phone.

Keep sensitive images, tokens and provider keys out of bug reports. The Lens never needs a Gemini API key: that belongs on the backend.
