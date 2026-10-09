# Threshold — Session Lifecycle

## Overview

Threshold uses a shared Expedition session to coordinate Fire TV devices (Thresholds) and companion-device players (Operatives).

The session service is implemented using Express and TypeScript. It maintains expedition membership, device assignments, player registrations, and shared session metadata.

**Current implementation:** Session state is stored in an in-memory `Map`. This is suitable for the current development prototype but does not survive service restarts or support synchronization across multiple service instances.

## Session Model

Each Expedition contains:

| Field | Description |
|---|---|
| `code` | Unique four-character Expedition identifier |
| `players` | Registered Lens players |
| `thresholds` | Registered Fire TV devices |
| `status` | `awaiting_players` or `ready` |
| `phase` | Expedition lifecycle phase |

Each registered Threshold contains a unique ID, persistent device ID, zone name, and join timestamp.

Each registered player contains a unique player ID and display name.

## Expedition Creation

**Endpoint:** `POST /sessions`

1. The Fire TV sends its persistent `deviceId`.
2. The session service generates a unique four-character Expedition code.
3. A new session is created in the `lobby` phase.
4. The creating Fire TV is assigned `THE NEXUS`.
5. The session is returned to the client.

The endpoint temporarily supports creation without a `deviceId` for compatibility with older clients.

## Joining an Expedition

### Fire TV

**Endpoint:** `POST /sessions/:code/thresholds`

A joining Fire TV submits its persistent `deviceId`.

The service:

1. Verifies that the Expedition exists.
2. Returns the existing Threshold if the device is already registered.
3. Rejects new registrations outside the lobby phase.
4. Enforces a maximum of four registered Thresholds.
5. Assigns the first available zone.

Available zones, in assignment order:

1. THE NEXUS
2. THE VEIL
3. THE RELIQUARY
4. THE OBSERVATORY

### Lens Player

**Endpoint:** `POST /sessions/:code/join`

A player submits a display name.

The service creates a player ID and registers the player with the Expedition.

New player registrations are permitted only during the lobby phase.

The session's status becomes `ready` when at least one player is registered.

## Reconnection

### Fire TV Reconnection

**Endpoint:** `POST /sessions/:code/thresholds/reconnect`

The Fire TV submits its persistent `deviceId`.

The service locates the existing Threshold registration and returns it without creating a duplicate.

Successful reconnection preserves:

- Threshold ID
- Device ID
- Assigned zone
- Original join timestamp

The Fire TV stores its active Expedition code locally and attempts restoration on application startup.

If the Expedition no longer exists, or the device is no longer registered, the service responds with HTTP 404.

Temporary network failures do not automatically invalidate the locally saved Expedition code.

### Lens Player Reconnection

**Endpoint:** `POST /sessions/:code/reconnect`

The Lens submits its previously assigned `playerId`.

The service returns the existing player registration and shared Expedition state.

The backend supports player reconnection; client-side persistence and restoration should be verified independently.

## Leaving an Expedition

### Fire TV Departure

**Endpoint:** `DELETE /sessions/:code/thresholds/:deviceId`

The service removes the matching Threshold registration.

If other Thresholds remain connected, the Expedition stays active and their assigned zones remain unchanged.

If the departing Threshold is the final registered TV, the Expedition is deleted.

On successful explicit departure, the Fire TV clears its locally saved Expedition code.

### Lens Player Departure

**Endpoint:** `DELETE /sessions/:code/players/:playerId`

The player is removed from the Expedition.

The service recalculates the session status based on the remaining player count.

Player departure does not independently close an Expedition.

## Expedition Phases

The backend currently defines these phases:

| Phase | Intended meaning |
|---|---|
| `lobby` | Devices and players assemble |
| `calibrating` | Environment calibration |
| `ready` | Expedition prepared to begin |
| `playing` | Active gameplay |
| `results` | Expedition results |

**Implementation distinction:** The Fire TV currently handles gameplay phase progression locally. The inspected backend endpoints do not establish synchronized, server-authoritative phase transitions.

Future gameplay orchestration must define how phase changes are validated, persisted, and distributed across Fire TV and Lens clients.

## Failure and Recovery

| Condition | Current behavior |
|---|---|
| Unknown Expedition | HTTP 404, `session_not_found` |
| Unknown Threshold during reconnect | HTTP 404, `threshold_not_found` |
| Unknown player during reconnect | HTTP 404, `player_not_found` |
| Missing device ID | HTTP 400 |
| Joining after the lobby phase | HTTP 409 |
| Maximum Thresholds reached | HTTP 409 |
| Temporary Fire TV connection failure | Local session code retained during restoration |
| Session service restart | In-memory Expeditions lost |
| Final Fire TV departure | Expedition deleted |

## Current Limitations

- Session state is not persisted to a database.
- No automatic session expiration or inactivity cleanup is implemented in the inspected code.
- There is no server-authoritative gameplay phase transition mechanism in the inspected endpoints.
- Fire TV lobby synchronization uses polling rather than server-pushed updates.
- Device identity relies on a locally stored identifier rather than authenticated device credentials.
- The Express service currently enables unrestricted CORS.
- Expedition completion and Expedition departure are not yet represented as distinct backend lifecycle operations.

## Validation

Current automated backend coverage includes session creation, player registration and departure, Threshold registration and departure, and reconnection behavior.

As of this documentation pass, the session service test suite passes 25 tests across five files.

The Fire TV Android debug build also succeeds with the session restoration implementation.

**Remaining validation:** Restart the Fire TV application during an active Expedition and confirm that it restores the original code, Threshold ID, and assigned zone.

## Planned Evolution

Before introducing synchronized multiplayer gameplay and AI-driven orchestration:

1. Define the authoritative session phase-transition contract.
2. Establish explicit Expedition completion and cleanup behavior.
3. Add durable session storage when deployment requirements justify it.
4. Define event contracts for Fire TV, Lens, and orchestration services.
5. Add end-to-end reconnection tests across client and backend boundaries.
6. Introduce appropriate authentication, authorization, and production CORS restrictions.
