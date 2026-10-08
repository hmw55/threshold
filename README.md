# Threshold

> **Reality is playable.**

Threshold is an AI-directed adventure game that transforms the player's physical environment into the game world.

Fire TV devices become **Thresholds** — shared physical terminals distributed throughout the environment. Player phones become **Lenses**, allowing the game to perceive real-world spaces and privately communicate with individual players.

An AI game master called **The Architect** dynamically directs each Expedition using the players, their surroundings, recognized objects, available Thresholds, previous decisions, and gameplay history.

Rather than generating a traditional scavenger hunt, Threshold combines environmental interaction, observation, deduction, movement, coordination, deception, private objectives, branching decisions, and open-ended problem solving into replayable 15–20 minute Expeditions.

## Current Status

Threshold is under active development for the **Build, Ship, Shape: Amazon Developer Hackathon**.

The initial application foundation and physical-device development environment are operational.

**Implemented and validated:**

- Native Android/Kotlin Fire TV application.
- Android API 25 minimum SDK support, enabling installation on Fire OS 6 devices.
- Successful APK installation and application launch on physical Fire TV hardware.
- React/TypeScript Lens web application with initial session joining and reconnection workflows.
- TypeScript/Express session service supporting Expedition creation, joining, and reconnection.
- Local communication between the Lens, session service, and Fire TV application.
- Named-device deployment tooling for targeting individual Fire TV devices.
- Multi-device ADB deployment and launch commands.
- pnpm monorepo structure supporting independent application and service development.

**In development:**

- Multiple Thresholds participating in a shared Expedition.
- Synchronized public events and zone-specific broadcasts.
- AI-directed Expedition orchestration through The Architect.
- Environmental perception and object recognition through Lenses.
- Private player objectives, branching decisions, and adaptive gameplay.
- AWS-backed authoritative game state and real-time communication.

The current implementation is an early development build, not a completed playable Expedition.

## Gameplay Architecture

Threshold separates the experience into three primary components.

### Threshold — Fire TV

`apps/fire-tv`

A native Android/Kotlin application that serves as the shared game interface.

Each Threshold represents a physical terminal within the Expedition and can display:

- Public Expedition state and objectives.
- Messages and announcements from The Architect.
- Timers, events, and collective decisions.
- Zone-specific information and instructions.
- Shared narrative developments.

Multiple Fire TV devices are intended to participate in the same Expedition while retaining their own identities and zone-specific experiences.

### Lens — Mobile Web

`apps/lens`

A React/TypeScript web application designed for player-specific interactions.

Lenses provide:

- Expedition joining and reconnection.
- Player identity and session participation.
- Private messages and objectives.
- Environmental scanning and object recognition.
- Individual decisions and interactions.
- Information that should remain hidden from other players.

The initial joining and reconnection workflows are implemented. Environmental perception and advanced gameplay interactions remain under development.

### The Architect — AI Game Master

The Architect is the AI-driven orchestration layer responsible for directing each Expedition.

Its planned responsibilities include:

- Generating and adapting objectives.
- Interpreting environmental observations.
- Responding to player decisions and gameplay history.
- Coordinating events across multiple Thresholds.
- Delivering private instructions to individual Lenses.
- Maintaining narrative continuity and pacing.

The Architect operates within defined gameplay rules rather than directly controlling authoritative session state.

### Session Service — Backend

`services/session`

A TypeScript/Express service providing the initial multiplayer session infrastructure.

Current functionality includes:

- Expedition session creation.
- Session lookup.
- Lens player joining.
- Player reconnection.
- Initial communication between application components.

The backend is being extended to support multiple Fire TV devices, synchronized events, and authoritative Expedition state.

### Game Platform — AWS

The planned production infrastructure uses AWS services for authoritative game state, real-time communication, AI orchestration, environmental interpretation, and persistent Expedition history.

The existing local session service provides a foundation for these capabilities while the AWS architecture is developed.

**Core architectural principle:**

> **Public gameplay belongs on Thresholds. Private gameplay and perception belong on Lenses.**

## Repository Structure

```text
threshold/
├── apps/
│   ├── fire-tv/              # Native Android/Kotlin Fire TV application
│   └── lens/                 # React/TypeScript mobile web application
├── services/
│   └── session/              # TypeScript/Express session backend
├── packages/                 # Shared packages
├── infra/                    # Infrastructure configuration
├── scripts/                  # Fire TV development and deployment tooling
├── docs/
│   ├── architecture.md       # System architecture
│   ├── game-design.md        # Gameplay systems and Expedition design
│   └── friction-logs/
│       ├── README.md         # Developer experience log overview
│       ├── amazon.md         # Amazon-related developer experiences
│       └── developer.md      # General engineering challenges
├── dev-notes/
│   ├── decisions.md          # Technical and architectural decisions
│   └── development-environment.md
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

Some shared packages and infrastructure components are planned or under development.

## Fire TV Development

The Fire TV application is implemented in Kotlin and targets a minimum Android SDK version of API 25.

Physical-device development uses Gradle and Android Debug Bridge (ADB).

### Build the Application

From the repository root:

```bash
cd apps/fire-tv
./gradlew assembleDebug
```

The generated APK is located at:

```text
apps/fire-tv/app/build/outputs/apk/debug/app-debug.apk
```

To run the Android build and lint checks:

```bash
cd apps/fire-tv
./gradlew clean assembleDebug lintDebug
```

### Deploy to a Named Fire TV

Threshold includes a development script for deploying to a specific Fire TV device using a friendly local name.

From the repository root:

```bash
pnpm fire-tv:dev monitor
```

The command builds the application, installs the APK on the selected device, and launches Threshold.

Device aliases are configured locally in:

```text
scripts/fire-tv-devices.local.json
```

This file maps friendly names to ADB device identifiers and is excluded from version control.

The named-device script requires ADB and `jq` to be installed.

### Deploy to Multiple Fire TVs

Build the application and install it on all connected, authorized ADB devices:

```bash
pnpm fire-tv:deploy:all
```

Launch Threshold on all connected devices:

```bash
pnpm fire-tv:launch:all
```

These commands support development and testing across multiple physical Fire TV devices without repeatedly specifying individual ADB identifiers.

Multi-device deployment does not, by itself, establish synchronized Expedition gameplay.

## Documentation

### Game Design & Architecture

- [Game Design](docs/game-design.md) — Core gameplay systems, terminology, Expedition structure, and player interactions.
- [System Architecture](docs/architecture.md) — Technical architecture, application boundaries, and communication between Thresholds, Lenses, and backend services.

### Developer Experience & Feedback

- [Developer Experience & Friction Logs](docs/friction-logs/README.md) — Overview of documented development experiences, technical challenges, and lessons learned.
  - [Amazon Developer Experience Log](docs/friction-logs/amazon.md) — Fire TV hardware, Fire OS compatibility, Amazon tooling, and actionable platform feedback.
  - [General Developer Friction Log](docs/friction-logs/developer.md) — Framework integration, build tooling, networking, and development environment challenges.

### Development Notes

- [Technical Decisions](dev-notes/decisions.md) — Architectural decisions and implementation tradeoffs.
- [Development Environment](dev-notes/development-environment.md) — Local development setup, tooling, and configuration.

## Development Philosophy

Threshold separates deterministic game mechanics from AI-directed orchestration.

Core state, player permissions, session membership, and gameplay rules remain authoritative and testable. AI is used to generate, adapt, interpret, and narrate experiences within defined system boundaries.

The project prioritizes:

- **Environmental gameplay:** Physical spaces and real-world objects become part of the experience.
- **Shared and private information:** Thresholds coordinate collective gameplay while Lenses support individual perspectives.
- **Adaptive storytelling:** Expeditions respond to player actions rather than following a fixed sequence.
- **Multi-device coordination:** Multiple Fire TV devices contribute to a single shared experience.
- **Reliable game state:** AI-generated actions are validated against deterministic rules and backend state.
- **Replayability:** Changing environments, players, and decisions produce different Expeditions.

The goal is not to place a chatbot on a television.

**The goal is to make the room itself part of the game.**