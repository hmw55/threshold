# Threshold — Technical Decision Log

**Project:** Threshold: The Last Witness
**Last reviewed:** October 22, 2026
**Purpose:** Record consequential engineering decisions, their rationale, tradeoffs, implementation status, and superseded alternatives.

## How to read this log

- **Accepted:** The approach used in the project at the review date.
- **Superseded:** A historical choice retained to explain the evolution of the architecture.
- **Deferred:** Considered but intentionally outside the hackathon scope.

These are architecture decisions, not claims that every supported device, player count, or failure scenario has been tested. Source references point to the repository where practical. See [system architecture](../docs/architecture.md), [game design](../docs/game-design.md), [session lifecycle](../docs/session-lifecycle.md), and [developer friction logs](../docs/friction-logs/README.md) for implementation detail and evidence.

## Decision index

| ID | Decision | Status |
|---|---|---|
| TD-001 | Linux-first development and local verification | Accepted |
| TD-002 | pnpm TypeScript monorepo | Accepted |
| TD-003 | React Native Fire TV client | Superseded by TD-005 |
| TD-004 | Stable hackathon toolchain | Accepted |
| TD-005 | Native Kotlin Fire TV client | Accepted |
| TD-006 | Lightweight local session coordination | Superseded in scope by TD-008 and TD-016 |
| TD-007 | Mobile browser as the Lens | Accepted |
| TD-008 | Server-authoritative session and game state | Accepted |
| TD-009 | SQLite persistence and explicit restart modes | Accepted |
| TD-010 | Fire OS 6-compatible Android baseline | Accepted |
| TD-011 | Environment calibration grounded in photographs | Accepted |
| TD-012 | Provider-independent Architect integration | Accepted |
| TD-013 | Deterministic rules and bounded AI authority | Accepted |
| TD-014 | Physical, asymmetric multiplayer gameplay | Accepted |
| TD-015 | Short, replayable Last Witness expedition | Accepted |
| TD-016 | AWS-hosted existing Express backend | Accepted |
| TD-017 | Private calibration images and scoped cloud access | Accepted |
| TD-018 | Polling-based device synchronization | Accepted |
| TD-019 | Privacy-conscious operational observability | Accepted |
| TD-020 | Explicit validation limits and hardware testing | Accepted |
| TD-021 | Post-hackathon infrastructure expansion | Deferred |

---

## TD-001 — Linux-first development and local verification

**Status:** Accepted

**Decision:** Use WSL and Arch Linux as primary development environments. Run builds, lint, type checking, and tests locally whenever practical; use GitHub Actions as a secondary CI verification layer.

**Rationale:** Fast iteration, consistent Unix-like tooling, and conservation of hosted CI minutes during the hackathon.

**Tradeoffs:** WSL adds Windows-to-Linux networking and device connectivity complications. Those are recorded in [DF-002](../docs/friction-logs/developer.md).

**Implementation:** Root `package.json` exposes `build`, `lint`, `typecheck`, `test`, and `check` scripts.

## TD-002 — pnpm TypeScript monorepo

**Status:** Accepted

**Decision:** Keep the web client and backend in a pnpm workspace, with native Android as a separate Gradle project in the same repository.

**Rationale:** Coordinated changes to interfaces, backend APIs, and applications; one source-controlled project and shared developer commands.

**Tradeoffs:** Workspace layouts can complicate third-party native tooling. The originally proposed `packages/` and `infra/` directories are architectural conventions, **not a claim that those directories currently contain deployed components**.

**Implementation:** `pnpm-workspace.yaml`, `apps/lens/`, `apps/fire-tv/`, `services/session/`, and root scripts.

## TD-003 — React Native Fire TV client

**Status:** Superseded by TD-005

**Original decision:** Use React Native 0.82.1 and TypeScript for the television application.

**Original rationale:** Maximize TypeScript reuse and avoid another application language.

**Why superseded:** Android Gradle plugin resolution under pnpm and JVM/Gradle toolchain compatibility impeded the first physical-device build. The team changed course before substantial television gameplay implementation.

**Evidence:** [DF-001](../docs/friction-logs/developer.md).

## TD-004 — Stable hackathon toolchain

**Status:** Accepted

**Decision:** Pin pnpm `10.18.0` and TypeScript `5.9.3`, with Node.js `>=22`.

**Rationale:** Avoid major-version migration risks while iterating against a fixed submission deadline.

**Tradeoffs:** New tooling features may be deferred until after submission.

**Implementation:** Root `package.json` and lockfile.

## TD-005 — Native Kotlin Fire TV client

**Status:** Accepted

**Decision:** Implement the television application in Kotlin/native Android and keep it a presentation-and-input client, rather than the authority for shared gameplay.

**Rationale:** Direct access to Android TV input, lifecycle, rendering, and networking; a Gradle-to-ADB pipeline verified on physical hardware; less framework integration overhead.

**Tradeoffs:** Kotlin and TypeScript coexist, requiring explicit API contracts and separate build tooling. Native remote focus and key dispatch still require physical-device testing.

**Implementation:** `apps/fire-tv/`. See [DF-001](../docs/friction-logs/developer.md) and [DF-006](../docs/friction-logs/developer.md).

## TD-006 — Lightweight local session coordination

**Status:** Superseded in scope by TD-008 and TD-016

**Original decision:** Use a small TypeScript/Express HTTP service so Lenses can join and Fire TVs can observe a shared session during local development. Keep machine-specific URLs out of source control.

**What changed:** The Express service was **not discarded**. It evolved into the persistent, server-authoritative backend and was subsequently deployed on AWS EC2. The former statement that a future production architecture would replace Express is obsolete.

**Retained rationale:** A small, inspectable HTTP service let the project validate real cross-device behavior before committing to a more elaborate architecture.

## TD-007 — Mobile browser as the Lens

**Status:** Accepted

**Decision:** Make the phone experience a browser-based React/TypeScript/Vite application rather than a second native mobile application.

**Rationale:** Players can join using their phones without installing a platform-specific app. The phone can capture calibration photographs, receive private information, submit decisions, and act as a required gameplay surface.

**Tradeoffs:** Browser camera permissions, mobile networking, lifecycle interruptions, and frontend/backend URL configuration must be handled explicitly.

**Implementation:** `apps/lens/`. The cloud backend hostname is **not** itself a publicly hosted Lens frontend.

## TD-008 — Server-authoritative session and game state

**Status:** Accepted

**Decision:** The session backend owns player and television registration, phase transitions, authoritative evidence, game progress, and resolution. Clients send actions and render returned state; they do not independently decide canonical outcomes.

**Rationale:** Multiple televisions and phones can otherwise diverge, especially when actions are concurrent or clients reconnect.

**Tradeoffs:** More backend validation and lifecycle complexity; client UI must explicitly refresh and respond to phase changes.

**Implementation:** `services/session/src/sessionStore.ts`, `game/gameEngine.ts`, `game/gameplayService.ts`, and API routes. See [DF-003](../docs/friction-logs/developer.md), [DF-005](../docs/friction-logs/developer.md), and [session lifecycle](../docs/session-lifecycle.md).

## TD-009 — SQLite persistence and explicit restart modes

**Status:** Accepted

**Decision:** Persist sessions, player credentials, calibration records, environmental observations, and gameplay state in SQLite, using Node's `node:sqlite` API. Provide distinct local startup paths for resuming versus clearing the development database.

**Rationale:** Restore an interrupted session without forcing players to recreate the expedition; retain a simple deployable backend and predictable local testing.

**Tradeoffs:** Single-instance database constraints and operational backup considerations; persistence does not guarantee that every reconnection edge case is flawless.

**Implementation:** `services/session/src/sessionStore.ts`; root `pnpm dev:resume` and `pnpm dev:fresh`. Expedition restart and calibration reuse are separate application-level flows, described in [session lifecycle](../docs/session-lifecycle.md).

## TD-010 — Fire OS 6-compatible Android baseline

**Status:** Accepted

**Decision:** Lower the native application's minimum SDK from API 28 to **API 25** to include a tested Fire OS 6 device while retaining newer Fire TV compatibility.

**Rationale:** Support a broader set of available physical televisions without maintaining separate client implementations.

**Tradeoffs:** UI resources and Android APIs must respect the older baseline. Installation and launch do not prove full feature parity on every device.

**Implementation:** `apps/fire-tv/app/build.gradle.kts` (`minSdk = 25`). See [AF-003](../docs/friction-logs/amazon.md).

## TD-011 — Photograph-grounded environmental calibration

**Status:** Accepted

**Decision:** Let players photograph real rooms and confirm observed objects. Use those observations to ground puzzles, clues, and physical actions; avoid presenting AI guesses as verified facts.

**Rationale:** The defining interaction is with the player's actual surroundings, not a generic sequence of screen-only puzzles.

**Tradeoffs:** Calibration can be incomplete or inaccurate; object availability and photo analysis vary by environment. Gameplay needs safe fallbacks when a proposed object or puzzle cannot be verified.

**Implementation:** `services/session/src/architect/analyzeCalibration.ts`, `architect/environmentKnowledge.ts`, `game/environmentalCase.ts`, calibration routes, and the Lens calibration UI. See [game design](../docs/game-design.md).

## TD-012 — Provider-independent Architect integration

**Status:** Accepted

**Decision:** Keep model-specific integration behind an AI provider abstraction. Use Gemini for the cloud AI workflow and Ollama for local development/testing, rather than tying gameplay to one model vendor.

**Rationale:** Provider access, latency, and availability can change. In particular, Bedrock model discovery succeeded while actual inference was blocked by account-level zero quotas; switching providers preserved the demo.

**Tradeoffs:** Provider responses vary, so output parsing, validation, fallbacks, and regression tests are necessary. **Bedrock is not a verified working inference provider for this build.**

**Implementation:** `services/session/src/architect/aiProvider.ts`, `createAiProvider.ts`, `geminiProvider.ts`, and `ollamaProvider.ts`. See [AF-004](../docs/friction-logs/amazon.md).

## TD-013 — Deterministic rules and bounded AI authority

**Status:** Accepted

**Decision:** Let the Architect shape narrative, clues, prompts, and its in-character reliability, while the structured game engine remains authoritative for permitted actions, evidence, scoring, phase progression, and endings.

**Rationale:** An intentionally manipulative narrator can lie *within the story* without corrupting the underlying game record or falsely claiming an unverified photograph proves something.

**Tradeoffs:** Requires explicit separation of canonical state, model-generated language, and validation of model decisions.

**Implementation:** `services/session/src/game/`, `architect/architectDecisionService.ts`, `architect/parseArchitectDecision.ts`, and `architect/validateArchitectDecision.ts`.

## TD-014 — Physical and asymmetric multiplayer gameplay

**Status:** Accepted

**Decision:** Design for **1–6 Lens players** and **1–4 Fire TVs**. Phones carry private information and decisions; televisions provide shared transmissions and interactions; the physical environment is part of the play space. Solo play receives distinct objectives rather than simulated extra players.

**Rationale:** Each device and person should contribute to the experience. Cooperation, optional deception, and differing information create replayable tension.

**Tradeoffs:** Higher synchronization and accessibility complexity; some cooperative interactions need fallbacks when only one TV or one player is present.

**Implementation:** `services/session/src/game/witnessExpedition.ts`, `fieldExpedition.ts`, and device-specific UI. See [game design](../docs/game-design.md).

## TD-015 — Focused, replayable Last Witness expedition

**Status:** Accepted

**Decision:** Prioritize a polished **8–12-minute** Last Witness gameplay slice over a broader set of campaigns. Keep environmental evidence, consequential choices, player cooperation/conflict, and an ending within the same expedition.

**Rationale:** A coherent, demonstrable experience is more valuable for the deadline than unfinished content breadth.

**Tradeoffs:** Some ambitions remain future work; variability and branching are bounded by implemented content and the environment available to players.

**Implementation:** `services/session/src/game/witnessExpedition.ts`, `lastWitnessBlueprint.ts`, and associated tests. See [game design](../docs/game-design.md).

## TD-016 — AWS-hosted existing Express backend

**Status:** Accepted

**Decision:** Deploy the existing Node.js/Express session backend on an Amazon Linux EC2 instance, managed with systemd, exposed over HTTPS through Caddy, and administered with AWS Systems Manager.

**Rationale:** Reuse the already functional service and preserve its authoritative state model rather than undertaking a rushed rewrite into another cloud compute architecture.

**Tradeoffs:** A single-instance deployment has availability and scaling limitations. Cloud hosting of the API does not automatically publish the Lens web frontend.

**Implementation:** `services/session/` and deployment configuration/scripts; see [architecture](../docs/architecture.md) and [AF-005](../docs/friction-logs/amazon.md).

## TD-017 — Private calibration storage and scoped AWS credentials

**Status:** Accepted

**Decision:** Store calibration photographs privately in S3; grant the EC2 backend AWS permissions through an IAM instance role; store the external AI credential in Systems Manager Parameter Store rather than application source.

**Rationale:** Separate sensitive images and credentials from public clients and avoid long-lived AWS keys in code.

**Tradeoffs:** Requires permissions design, storage lifecycle management, and careful distinction between game choices and actual data deletion. A narrative `erase` ending does **not** itself imply removal of stored photos.

**Implementation:** `services/session/src/imageStorage.ts`, calibration routes, and AWS configuration. See [AF-005](../docs/friction-logs/amazon.md).

## TD-018 — HTTP polling rather than mandatory real-time sockets

**Status:** Accepted

**Decision:** Use ordinary HTTP APIs and client polling for cross-device state synchronization, rather than making WebSockets a prerequisite for the hackathon build.

**Rationale:** A simpler communication model is easier to deploy, inspect, reconnect, and test across Fire TV and mobile browsers.

**Tradeoffs:** Updates can be delayed by polling intervals; rapid simultaneous actions still require server-side ordering and idempotency safeguards.

**Implementation:** Fire TV session client/controller, Lens API integration, and Express session routes. See [session lifecycle](../docs/session-lifecycle.md).

## TD-019 — Privacy-conscious operational observability

**Status:** Accepted

**Decision:** Emit allowlisted operational events instead of unrestricted gameplay payloads, forward dedicated JSON Lines logs to CloudWatch, and use bounded retention and failure metrics.

**Rationale:** Support diagnosis of calibration and backend failures without collecting raw photos, private player messages, credentials, or full AI responses in operational logs.

**Tradeoffs:** Restricting logged fields reduces debugging detail; metric and alarm configuration alone does not demonstrate end-to-end notification delivery.

**Implementation:** `services/session/src/operationalLogger.ts` and deployed CloudWatch agent/filter configuration. See [AF-006](../docs/friction-logs/amazon.md).

## TD-020 — Validate on physical hardware and report coverage precisely

**Status:** Accepted

**Decision:** Treat local builds, automated tests, Android lint, physical APK deployment, and end-to-end playthroughs as complementary forms of evidence. Report exactly which behavior was validated.

**Rationale:** A green build cannot establish remote navigation, mobile camera behavior, multi-device coordination, or restart recovery.

**Tradeoffs:** Physical testing consumes time and available devices; incomplete coverage must remain visible rather than being generalized into blanket claims.

**Implementation:** Vitest suites under `services/session/tests/`, Android Gradle checks, ADB deployment scripts, and [friction logs](../docs/friction-logs/README.md).

## TD-021 — Defer broader infrastructure and content expansion

**Status:** Deferred

**Decision:** Do not require a new microservice architecture, distributed database, mandatory socket layer, additional campaigns, or independently hosted public Lens frontend to finish the hackathon slice.

**Rationale:** Focus on working cross-device gameplay, environmental grounding, and a credible demonstration of the implemented AWS infrastructure.

**Revisit when:** Usage, availability requirements, post-hackathon distribution, or real-world playtesting establishes a concrete need.

**Important:** Deferred items are not promised features or evidence of current deployment.

---

## Decision maintenance

When a significant choice changes, retain the original entry, mark it **Superseded**, and link to the replacement. Record what was actually observed, avoid rewriting earlier rationale with hindsight, and distinguish code implementation from physical-device validation. Add new decisions when they meaningfully alter architecture, trust boundaries, gameplay authority, deployment, or the developer workflow.
