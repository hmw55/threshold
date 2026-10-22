# General Developer Friction Log

**Project:** Threshold
**Scope:** Development tooling, frameworks, build systems, local infrastructure, and application integration
**Purpose:** Document engineering challenges, resolutions, and lessons learned

## Overview

This log documents general software engineering challenges encountered while developing **Threshold**, an AI-directed, multiplayer Fire TV experience.

Entries focus on framework integration, dependency management, build tooling, networking, application state management, authentication contracts, and communication between frontend and backend systems.

The objective is to preserve technical context, explain engineering decisions, and identify opportunities to improve development workflows.

Issues directly related to Amazon products, Fire OS, Fire TV hardware, AWS services, or Amazon development tooling are documented separately in the [Amazon Developer Experience Log](./amazon.md).

## Friction Summary

| ID | Experience | Severity |
|---|---|---|
| DF-001 | [React Native Monorepo and Android Build Tooling](#df-001--react-native-monorepo-and-android-build-tooling) | Medium |
| DF-002 | [Cross-Device Development Networking](#df-002--cross-device-development-networking) | Not assessed |
| DF-003 | [Game State Persistence and Session Lifecycle](#df-003--game-state-persistence-and-session-lifecycle) | Medium |
| DF-004 | [Authentication Contract Consistency](#df-004--authentication-contract-consistency) | Low |
| DF-005 | [Frontend and Backend Game Phase Synchronization](#df-005--frontend-and-backend-game-phase-synchronization) | Medium |
| DF-006 | [Fire TV Remote Navigation and Completed Expedition Lifecycle](#df-006--fire-tv-remote-navigation-and-completed-expedition-lifecycle) | Medium |
| DF-007 | [Cloudflare Tunnel Configuration and Environment Upload Reliability](#df-007--cloudflare-tunnel-configuration-and-environment-upload-reliability) | Medium |
| DF-008 | [Solo Expedition Progression and Lens Interaction](#df-008--solo-expedition-progression-and-lens-interaction) | High |
| DF-009 | [Cross-Device Expedition Coordination and Navigation](#df-009--cross-device-expedition-coordination-and-navigation) | Medium |
| DF-010 | [AI Provider Migration and Environmental Grounding](#df-010--ai-provider-migration-and-environmental-grounding) | Medium |

---

## Documented Challenges

### DF-001 — React Native Monorepo and Android Build Tooling

**Area:** Framework integration / Android build tooling
**Severity:** Medium
**Status:** Resolved through architectural change

**Task**

Establish the initial Fire TV client using React Native and TypeScript within Threshold's pnpm monorepo.

**Expected Behavior**

The generated React Native Android project would compile after being incorporated into the existing workspace with minimal additional configuration.

**Observed Behavior**

The initial Gradle build failed because the generated React Native configuration expected `@react-native/gradle-plugin` at a dependency location not exposed by the pnpm workspace layout.

After explicitly adding the Gradle plugin dependency and restoring plugin resolution, a subsequent build encountered a JVM/Gradle toolchain compatibility error involving `JvmVendorSpec.IBM_SEMERU`.

These issues prevented the React Native application from reaching a successful physical-device build during initial setup.

**Investigation and Troubleshooting**

1. Scaffolded a React Native 0.82.1 application.
2. Integrated the generated application into the existing pnpm workspace.
3. Attempted to compile the Android application using Gradle.
4. Investigated plugin resolution failures associated with the workspace dependency layout.
5. Explicitly added `@react-native/gradle-plugin` to the Fire TV workspace.
6. Retried the build and encountered the JVM/Gradle toolchain compatibility error.
7. Reassessed the framework choice in relation to the project's development timeline and Fire TV requirements.

**Resolution**

Replaced the React Native Fire TV client with a minimal native Android application written in Kotlin.

The native implementation compiled successfully and was subsequently installed and launched on physical Fire TV hardware using ADB.

**Development Impact**

The initial framework integration consumed development time before Fire TV functionality could be validated.

Although no application functionality was lost, the issues introduced unnecessary setup complexity and delayed physical-device testing.

**Lessons Learned**

- Validate framework compatibility with the repository's package management and build tooling before implementing application features.
- Test the complete build-to-device pipeline early in development.
- Consider the integration cost of framework abstractions when targeting a specialized hardware platform.
- Prefer an implementation approach with a reliable build and deployment workflow when operating under a fixed development deadline.

---

### DF-002 — Cross-Device Development Networking

**Area:** Local infrastructure / networking
**Severity:** Not assessed
**Status:** Resolved for the tested development environment

**Task**

Enable communication between Threshold's Lens web application, session service, and physical Fire TV devices while development services were running inside Windows Subsystem for Linux (WSL).

**Expected Behavior**

Devices connected to the same local network would be able to reach the development services using the host machine's network address and configured application ports.

**Observed Behavior**

Development services running inside WSL were not directly accessible from physical devices on the local network under the existing network configuration.

Additional Windows host-network configuration was required to expose the Lens and session-service ports to external devices.

Machine-specific network addresses also introduced a risk of accidentally committing local environment configuration to source control.

**Investigation and Troubleshooting**

1. Started the Lens application and session service inside the WSL development environment.
2. Attempted to access the services from physical devices on the local network.
3. Identified the need for additional Windows-to-WSL network forwarding.
4. Configured Windows port forwarding for the required development service ports.
5. Updated Windows firewall rules to permit the necessary connections.
6. Moved machine-specific network configuration into ignored local configuration files.
7. Validated communication between the physical Lens client, session service, and Fire TV application.

**Resolution**

Configured the Windows host to forward the required network traffic to the services running inside WSL.

Separated machine-specific network settings from version-controlled application configuration.

**Development Impact**

The additional network configuration increased initial environment setup complexity and required troubleshooting across the Windows host, WSL environment, and physical devices.

Once configured, the environment supported successful communication between the Lens application, session backend, and Fire TV client.

**Lessons Learned**

- Validate physical-device connectivity early when development services run inside a virtualized or isolated networking environment.
- Distinguish service availability within the development machine from accessibility across the local network.
- Document required host forwarding and firewall configuration for reproducible development.
- Keep machine-specific addresses and configuration outside version control.

---

### DF-003 — Game State Persistence and Session Lifecycle

**Area:** Backend architecture / state management
**Severity:** Medium
**Status:** Implemented and validated through automated testing

**Task**

Introduce persistent, server-authoritative gameplay state for Threshold's Last Witness adventure while preserving the existing multiplayer session lifecycle.

**Expected Behavior**

Gameplay progression would remain consistent across participating Lens clients and survive backend restarts without losing completed objectives, discovered evidence, or completed interactions.

Session lifecycle operations and gameplay state would remain coordinated without requiring individual clients to reconstruct shared progress.

**Observed Behavior**

The existing session infrastructure supported multiplayer participation and session persistence, but the new adventure required additional state beyond player membership and session phase.

Gameplay introduced distinct progression phases, ordered objectives, interaction prerequisites, and evidence discovery.

These requirements created an integration challenge: session persistence alone did not represent the complete adventure state, and frontend-local progress would not provide a reliable source of truth for multiple participants.

No confirmed production data-loss incident was identified. The challenge was addressed during implementation and integration testing.

**Investigation and Troubleshooting**

1. Reviewed the existing session lifecycle and persistence implementation.
2. Defined a dedicated game-state model containing adventure phase, completed objectives, discovered evidence, completed interactions, and ending selection.
3. Implemented a game engine to validate progression and enforce objective ordering.
4. Integrated game-state persistence with the existing session storage infrastructure.
5. Added interaction dependency validation to prevent out-of-order gameplay.
6. Developed automated tests covering state persistence, game progression, and full adventure scenarios.
7. Verified backend behavior through the existing Vitest test suite.

**Resolution**

Implemented persistent game state managed by the session backend.

Gameplay changes are validated by backend services and persisted after successful interactions. Lens clients retrieve shared progression from the backend rather than independently determining authoritative game state.

Automated tests cover game-state persistence, interaction prerequisites, and progression through the defined adventure phases.

**Development Impact**

The feature required additional backend architecture and integration work beyond the existing multiplayer session implementation.

Separating gameplay progression from individual client state increased implementation complexity but established a foundation for consistent multiplayer behavior and recovery after backend restarts.

**Lessons Learned**

- Define ownership of shared application state before implementing multiplayer gameplay.
- Separate session lifecycle concerns from adventure-specific progression while maintaining coordinated persistence.
- Enforce progression rules centrally rather than duplicating them across clients.
- Test state restoration and interaction dependencies independently of the user interface.
- Treat persistence and lifecycle integration as core gameplay requirements rather than optional reliability improvements.

---

### DF-004 — Authentication Contract Consistency

**Area:** API integration / authentication / automated testing
**Severity:** Low
**Status:** Resolved

**Task**

Implement authenticated Last Witness gameplay endpoints and verify that requests from Lens players were authorized consistently across the API and automated tests.

**Expected Behavior**

Authenticated gameplay requests would use a consistent credential format across the Lens client, session backend, and integration tests.

Valid player credentials would allow authorized gameplay operations, while invalid credentials would be rejected.

**Observed Behavior**

During game API test development, the test requests used an authentication header convention that differed from the intended Bearer-token contract.

The mismatch between `X-Player-Token` and the `Authorization: Bearer <token>` convention required adjustment before the tests accurately represented the client authentication flow.

**Investigation and Troubleshooting**

1. Reviewed the authentication checks used by existing session and gameplay endpoints.
2. Compared credential handling between the Lens client and game API tests.
3. Identified inconsistent use of the custom token header and Bearer authorization format.
4. Updated test requests to use the intended authentication convention.
5. Reran the game API tests to validate authorized and unauthorized request handling.

**Resolution**

Aligned game API integration tests with the Bearer-token authentication convention used by the Lens client.

Gameplay endpoints continue to validate player identity and credentials through the existing session authentication logic.

The game API test suite passed after the authentication contract was aligned.

**Development Impact**

The inconsistency introduced additional debugging and test maintenance during gameplay API development.

The issue was limited to development and testing; no confirmed production authentication failure was identified.

**Lessons Learned**

- Establish a documented authentication contract shared by frontend, backend, and tests.
- Avoid introducing multiple credential conventions without a clear compatibility requirement.
- Use shared request helpers where practical to reduce authentication inconsistencies.
- Verify both successful authentication and rejection of invalid credentials.
- Ensure integration tests exercise the same request format used by actual clients.

---

### DF-005 — Frontend and Backend Game Phase Synchronization

**Area:** Frontend integration / API state synchronization
**Severity:** Medium
**Status:** Resolved for initial progression; subsequent full playthrough validated

**Task**

Synchronize the Lens gameplay interface with server-authoritative Last Witness progression, including transitions between adventure phases.

**Expected Behavior**

When a player completed the final interaction of an adventure phase, the backend would persist the new game state and the Lens interface would recognize the transition.

The client would stop presenting interactions from the completed phase and display the appropriate next-stage interface.

**Observed Behavior**

The initial Act I interface required additional coordination with the backend game engine to recognize objective completion and phase transitions.

Completing signal reconstruction advanced the authoritative game phase from `investigation` to `contradiction`, but the frontend also needed to recognize that change and stop requesting Act I-specific resources.

Without phase-aware behavior, the interface could continue operating under outdated assumptions about which gameplay endpoints were active.

**Investigation and Troubleshooting**

1. Reviewed the game engine's objective completion and phase transition behavior.
2. Confirmed that successful signal reconstruction completed the `first-signal` objective.
3. Integrated a read-only game-state endpoint exposing the current phase and completed progression.
4. Added a Lens API client method for retrieving authenticated game state.
5. Updated the investigation interface to retrieve the authoritative game phase.
6. Added phase-aware behavior to stop Act I requests after progression into the contradiction phase.
7. Implemented a transition placeholder for the upcoming Act II interface.
8. Verified the Lens production build and existing backend game API tests.

**Resolution**

Implemented server-authoritative game-phase synchronization between the session backend and Lens.

The Lens interface retrieves current game state and adjusts its behavior when the adventure advances beyond Act I.

After successful signal reconstruction, the backend persists the objective completion and advances the phase to `contradiction`. The frontend recognizes that transition and stops using investigation-specific endpoints.

**Subsequent Validation**

Following additional development of the Last Witness experience, a complete expedition was played from beginning to final verdict using the physical Fire TV application and Lens interface.

This demonstrated end-to-end progression in the tested configuration, beyond the original Act I-only implementation.

The successful playthrough does not establish that every multiplayer configuration, reconnection scenario, or gameplay variation has been fully validated.

**Development Impact**

Phase synchronization required additional frontend API integration and lifecycle handling beyond rendering individual puzzles.

The resulting architecture reduced the risk of clients displaying stale interactions or attempting gameplay operations that were no longer valid for the current adventure phase.

The implementation also established a reusable approach for subsequent phase transitions.

**Lessons Learned**

- Treat backend state as authoritative for shared multiplayer progression.
- Design frontend components to respond explicitly to server-side phase transitions.
- Avoid assuming that completing a local interaction guarantees the entire application remains in the same state.
- Stop or invalidate phase-specific requests when the backend advances gameplay.
- Test transitions between gameplay phases, not only individual puzzle completion.
- Distinguish a successful production build from full end-to-end validation on physical devices.

---

### DF-006 — Fire TV Remote Navigation and Completed Expedition Lifecycle

**Area:** Native Android / Fire TV input handling / session lifecycle
**Severity:** Medium
**Status:** Resolved and validated through physical-device testing

**Task**

Provide reliable remote-control navigation across the four surveillance monitors and allow players to exit a completed Last Witness expedition and begin another.

**Expected Behavior**

Players would use the Fire TV remote to select and expand surveillance monitors, return to the monitor grid, and leave a completed expedition without requiring an application restart or manual backend reset.

The application would preserve unfinished expedition restoration while providing a clear exit path after the final transmission.

**Observed Behavior**

During physical-device testing, the Fire TV restored a previously completed expedition into the surveillance interface.

The four-monitor grid did not respond reliably to remote navigation, and the completed game lacked an accessible exit or restart action.

The session lifecycle remained in a playing state even when the field encounter had reached its completed stage. Existing exit handling therefore did not recognize the finished expedition.

**Investigation and Troubleshooting**

1. Inspected the Fire TV activity's session restoration and phase-handling logic.
2. Reviewed the surveillance grid's monitor selection, expansion, and collapse methods.
3. Identified the reliance on `onKeyDown()` for remote navigation and confirmed that the surveillance monitor views were not focusable.
4. Reviewed the existing session-leave implementation and its handling of persisted expedition codes.
5. Added explicit detection of the completed field encounter.
6. Extended the existing exit guards to permit leaving a completed expedition.
7. Added an on-screen instruction directing players to use Back after the final transmission.
8. Added activity-level key dispatch handling for remote navigation while retaining the existing decision-input behavior.
9. Rebuilt the native Android application and tested the updated behavior on physical Fire TV hardware.

**Resolution**

Implemented activity-level handling for directional remote input, monitor selection, and Back navigation.

A completed field encounter can now use the existing session-leave flow, which disconnects the Fire TV and clears the locally saved expedition code.

The Android debug build completed successfully, and physical-device testing confirmed that the player could leave a completed expedition and begin another.

**Development Impact**

The navigation and exit issues blocked normal use of the completed-game interface and interrupted repeated playtesting.

Resolving them allowed further end-to-end gameplay testing without requiring manual application or database resets after every completed expedition.

**Lessons Learned**

- Test television interfaces using the physical remote, not only compilation or emulator assumptions.
- Account for Android view focus and event dispatch when implementing custom remote-driven interfaces.
- Distinguish session lifecycle state from the completion state of an individual game encounter.
- Reuse existing session cleanup mechanisms rather than introducing competing lifecycle paths.
- Include completed-game navigation and replayability in early end-to-end testing.

---

### DF-007 — Cloudflare Tunnel Configuration and Environment Upload Reliability

**Area:** Local development infrastructure / HTTP connectivity / environment configuration
**Severity:** Medium
**Status:** Working configuration restored; original upload failure cause unconfirmed

**Task**

Enable the Lens frontend to upload environment calibration images and communicate with the session backend through public development endpoints.

**Expected Behavior**

The Lens would successfully communicate with the session backend during calibration, upload the required environment images, and advance into the playable expedition.

Development endpoints would remain correctly configured across service restarts.

**Observed Behavior**

During physical-device testing, the Lens displayed the error:

`[ ERROR ] UPLOAD FAILED: Failed to fetch. RETRY TO CONTINUE.`

The error interrupted the Analyze Environment step.

The development setup used separate Cloudflare Quick Tunnels for the frontend and backend. These tunnels generate temporary public URLs, creating a risk that the Lens could retain an outdated backend address after restarting the development environment.

The precise cause of the original upload failure was not conclusively identified.

**Investigation and Troubleshooting**

1. Reviewed the active local development services and Cloudflare tunnel processes.
2. Restarted the session backend in database-preserving mode using `pnpm dev:resume`.
3. Started the Lens Vite development server on port `5173`.
4. Established a new Cloudflare tunnel for the backend on port `3001`.
5. Updated the ignored Lens `.env.local` configuration with the new backend tunnel URL.
6. Restarted Vite so the updated environment variable would be loaded.
7. Established a separate Cloudflare tunnel for the Lens frontend.
8. Verified public HTTP responses from both tunnels.
9. Confirmed that the Lens configuration referenced the current backend endpoint.
10. Subsequently completed an end-to-end gameplay session using the restored development environment.

**Resolution**

Re-established a working development configuration with separate Cloudflare tunnels for the Lens frontend and session backend.

Verified that the frontend returned HTTP 200 and that the backend root returned its expected HTTP 404 response.

Confirmed that the Lens environment configuration referenced the current backend tunnel URL.

A subsequent complete gameplay session succeeded, although the original upload failure was not isolated to a single confirmed cause.

**Development Impact**

The upload failure temporarily blocked calibration and delayed full gameplay validation.

Maintaining two public development endpoints also introduced manual configuration work whenever Cloudflare Quick Tunnel URLs changed.

**Lessons Learned**

- Treat Cloudflare Quick Tunnel URLs as temporary development infrastructure.
- Verify that frontend environment variables reference currently active backend endpoints.
- Restart development servers when environment variables are changed.
- Distinguish successful tunnel connectivity from successful application-level API requests.
- Preserve backend logs and failed request details when investigating intermittent upload failures.
- Avoid assigning a definitive root cause without reproducing and isolating the failure.

---

### DF-008 — Solo Expedition Progression and Lens Interaction

**Area:** Lens UI / gameplay integration / solo expedition progression
**Severity:** High
**Status:** Open for targeted device verification (reported October 21–22, 2026)

**Task**

Ensure that the solo Last Witness expedition progresses reliably through all interactive stages and that selecting a Threshold or evidence option produces the expected next action.

**Expected Behavior**

When the solo player selects an available Threshold during the third interaction, the Lens should visibly acknowledge the choice, submit or apply the intended action, and advance or explain why progression is blocked. The subsequent stage should also present its instructions clearly on the relevant device.

**Observed Behavior**

During a solo playtest, the player could select a Threshold in stage three but no visible action followed. The fourth stage's behavior was uncertain because the player was away from the television during part of the interaction. The final Lens results screen was also judged visually inadequate. These are distinct issues: a reported progression problem, an unverified display path, and a presentation problem.

**Investigation and Troubleshooting**

1. Identified the stage-three selection as a reproducible test target, rather than assuming the underlying state failed to advance.
2. Flagged stage four for simultaneous Lens and Fire TV observation.
3. Identified a need for consistent feedback on selectable 2×2 grids and navigation actions.
4. Prioritized a coherent finishing screen and return-to-lobby flow for the submission build.

**Resolution / Current Status**

The available playtest report does not establish a confirmed root cause or successful retest. This entry remains open until a fresh solo playthrough verifies stage-three selection, stage-four presentation, and the results screen. Do not treat UI changes or passing backend tests alone as resolution.

**Development Impact**

The issue affected confidence in the solo experience and required attention during the final submission window.

**Lessons Learned**

- Test transitions from the player's perspective on both Lens and television.
- Distinguish an API/state transition from visible user feedback.
- Treat results and recovery navigation as part of the core game loop.
- Record exactly which stage was observed and which was not.

---

### DF-009 — Cross-Device Expedition Coordination and Navigation

**Area:** Multiplayer UI / session lifecycle / Fire TV remote interactions
**Severity:** Medium
**Status:** Partially implemented; final multi-device verification pending

**Task**

Coordinate the same expedition across multiple Fire TVs and mobile Lenses, including calibration, player-specific interactions, navigation, and return-to-lobby or restart actions.

**Expected Behavior**

Each device should present the appropriate shared or private information for the current expedition state. Available 2×2 selection grids should respond to input. After calibration, users should have a clear route back to the lobby, and completed expeditions should offer understandable next steps.

**Observed Behavior**

The final gameplay review identified inconsistent navigation and presentation needs, including a return-to-lobby option on post-calibration screens, consistent selection behavior for 2×2 grids, and clearer choices at the finale. A proposed restart flow would allow reuse of recent calibration photos or fresh calibration; that option was considered deferrable under the submission deadline. These observations do not establish a single backend synchronization defect.

**Investigation and Troubleshooting**

1. Reviewed the user journey from calibration through the results screen.
2. Distinguished Fire TV remote navigation from Lens touch interactions.
3. Identified shared session state and per-device presentation as separate validation concerns.
4. Proposed a consistent return-to-lobby affordance and a clear finale choice between lobby and new expedition.
5. Deferred optional calibration-photo reuse if necessary to preserve a working submission build.

**Resolution / Current Status**

The October 22 source snapshot contains updated navigation and expedition code, but the available evidence does not confirm a complete post-change multi-device retest. Earlier remote-control navigation fixes remain documented in DF-006; this entry covers later workflow requirements and should not retroactively reopen the original defect.

**Development Impact**

Cross-device differences increased manual playtesting needs and made consistent user feedback especially important.

**Lessons Learned**

- Validate the same game moment on every participating device.
- Keep shared state authoritative while allowing device-specific interfaces.
- Test lobby return, reconnection, and replay separately.
- Separate required navigation from optional quality-of-life features.

---

### DF-010 — AI Provider Migration and Environmental Grounding

**Area:** AI integration / provider configuration / game design
**Severity:** Medium
**Status:** Provider migration implemented; full gameplay grounding still being refined

**Task**

Provide responsive AI-assisted environmental calibration and narrative gameplay without making the experience dependent on a single unavailable provider or allowing generated content to contradict game state.

**Expected Behavior**

Calibration analysis should use observations from players' actual rooms and objects. The Architect should adapt narration and prompts to supported environmental context, while deterministic game systems retain authority over evidence, progression, and outcomes.

**Observed Behavior**

The original AWS Bedrock inference path was blocked by access/quota constraints during development. The project moved to Gemini for cloud-backed analysis while retaining Ollama/Gemma as a local-development option. A successful Gemini room scan demonstrated useful environmental recognition, but subsequent gameplay review found that portions of the middle and ending did not feel sufficiently tied to the scanned environment or earlier choices. Provider availability and narrative cohesion were separate concerns.

**Investigation and Troubleshooting**

1. Separated AI-provider selection from core game rules.
2. Adopted Gemini for cloud-backed workflows after the Bedrock blocker.
3. Retained a local Ollama-based development option.
4. Evaluated calibration output against actual room content.
5. Identified environmental references and consequential choices as priorities for gameplay refinement.
6. Kept structured game facts distinct from the Architect's potentially deceptive narration.

**Resolution / Current Status**

Gemini integration and environmental analysis are represented in the current implementation, and the user reported a successful room scan. The degree to which every later gameplay branch uses environmental evidence appropriately has not been established by a comprehensive final playthrough. Bedrock-specific quota and developer-experience details belong in [the Amazon friction log](./amazon.md), rather than being duplicated here.

**Development Impact**

The provider switch required integration work during a fixed development window. Environmental grounding also became a core gameplay-quality requirement rather than merely a calibration feature.

**Lessons Learned**

- Keep provider dependencies behind an explicit abstraction.
- Evaluate model output in the context of the complete user journey, not only isolated requests.
- Preserve canonical evidence and state outside generative responses.
- Distinguish successful AI integration from successful game design.
- Avoid claiming a model observed objects or evidence that the source images did not establish.

---

## Documentation Notes

Entries describe development challenges observed during Threshold implementation and the approaches used to resolve them.

Severity reflects the impact on the development process rather than the inherent quality of a framework, operating system, or tool.

The documented resolutions represent decisions made within the project's technical requirements and development timeline; they are not intended as universal recommendations.

Some entries describe integration complexity identified and addressed during implementation rather than failures observed in production. These distinctions are preserved to avoid overstating the impact of development challenges.

Automated test success and successful compilation demonstrate the behavior covered by those checks but do not, by themselves, establish complete end-to-end validation across all physical devices or gameplay scenarios.

The completed Last Witness playthrough validates the tested device and gameplay configuration. It does not establish exhaustive coverage of all player counts, network conditions, or session recovery scenarios.

## Final-build verification note (October 22, 2026)

The final gameplay overhaul introduced changes after some of the earlier friction entries were marked resolved. Those historical resolutions describe the behavior tested at the time, not blanket verification of the latest build. In particular, DF-005 and DF-006 should not be interpreted as proof that every new solo stage, 2×2 selection grid, multiplayer device configuration, or post-calibration navigation path is working. DF-008 and DF-009 track those later concerns separately.

**Before updating an open status to resolved:** record the build or commit tested, device count, reproduction steps, expected and actual behavior, and whether validation was automated or performed on physical devices.
