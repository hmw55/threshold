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
**Status:** Resolved for Act I progression

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

**Development Impact**

Phase synchronization required additional frontend API integration and lifecycle handling beyond rendering individual puzzles.

The resulting architecture reduced the risk of clients displaying stale interactions or attempting gameplay operations that were no longer valid for the current adventure phase.

The implementation also established a reusable approach for subsequent Act II and Act III transitions.

**Lessons Learned**

- Treat backend state as authoritative for shared multiplayer progression.
- Design frontend components to respond explicitly to server-side phase transitions.
- Avoid assuming that completing a local interaction guarantees the entire application remains in the same state.
- Stop or invalidate phase-specific requests when the backend advances gameplay.
- Test transitions between gameplay phases, not only individual puzzle completion.
- Distinguish a successful production build from full end-to-end validation on physical devices.

---

## Documentation Notes

Entries describe development challenges observed during Threshold implementation and the approaches used to resolve them.

Severity reflects the impact on the development process rather than the inherent quality of a framework, operating system, or tool.

The documented resolutions represent decisions made within the project's technical requirements and development timeline; they are not intended as universal recommendations.

Some entries describe integration complexity identified and addressed during implementation rather than failures observed in production. These distinctions are preserved to avoid overstating the impact of development challenges.

Automated test success and successful compilation demonstrate the behavior covered by those checks but do not, by themselves, establish complete end-to-end validation across all physical devices or gameplay scenarios.