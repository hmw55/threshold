# Threshold

> **Reality is playable.**

Threshold is an AI-directed adventure game that transforms the player's physical environment into the game world.

Fire TV devices become **Thresholds** — shared physical terminals distributed throughout the environment. Player phones become **Lenses**, allowing the game to perceive real-world spaces and privately communicate with individual players. An AI game master called **The Architect** dynamically directs each Expedition using the players, their surroundings, recognized objects, available Thresholds, previous decisions, and gameplay history.

Rather than generating a traditional scavenger hunt, Threshold combines environmental interaction, observation, deduction, movement, coordination, deception, private objectives, branching decisions, and open-ended problem solving into replayable 15–20 minute Expeditions.

## Current Status

Threshold is under active development for the **Build, Ship, Shape: Amazon Developer Hackathon**.

The initial project foundation is operational:

- Native Android/Kotlin Fire TV client
- Fire OS 7 / Android 9 compatibility target
- Local Android build pipeline
- Physical Fire TV deployment over ADB
- First Threshold build successfully running on physical Fire TV hardware
- TypeScript monorepo foundation for the Lens, backend services, shared packages, and infrastructure

## Architecture

Threshold uses a distributed client architecture:

**Threshold — Fire TV**

`apps/fire-tv`

A native Android/Kotlin application that acts as the shared game interface. Thresholds display public game state, objectives, events, timers, decisions, and information from The Architect.

**Lens — Mobile Web**

`apps/lens`

A planned React/TypeScript progressive web application used for environmental perception, player-specific information, private objectives, and interactions that should not appear on the shared display.

**Game Platform — AWS**

The planned backend uses AWS services for authoritative game state, real-time communication, AI orchestration, environmental interpretation, and persistent Expedition history.

The core architectural principle is:

> **Public gameplay belongs on Thresholds. Private gameplay and perception belong on Lenses.**

## Repository Structure

```text
threshold/
├── apps/
│   └── fire-tv/          # Native Android/Kotlin Fire TV client
├── dev-notes/            # Technical decisions and development environment
├── docs/
│   ├── architecture.md   # System architecture
│   ├── friction-log.md   # Developer experience and friction
│   └── game-design.md    # Core game design
├── packages/             # Shared packages (planned)
├── services/             # Backend services (planned)
├── infra/                # Infrastructure as code (planned)
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Fire TV Development

The Fire TV client targets Fire OS 7 compatibility with a minimum Android API level of 28.

Build the debug APK:

```bash
cd apps/fire-tv
./gradlew assembleDebug
```

The resulting APK is generated at:

```text
apps/fire-tv/app/build/outputs/apk/debug/app-debug.apk
```

During development, builds can be installed directly onto a Fire TV device connected through ADB.

## Documentation

- [`docs/game-design.md`](docs/game-design.md) — gameplay systems, terminology, and Expedition design
- [`docs/architecture.md`](docs/architecture.md) — technical architecture and system boundaries
- [`docs/friction-log.md`](docs/friction-log.md) — positive and negative developer experiences encountered during development
- [`dev-notes/decisions.md`](dev-notes/decisions.md) — architectural and technical decision records
- [`dev-notes/development-environment.md`](dev-notes/development-environment.md) — local development environment and tooling

## Development Philosophy

Threshold separates deterministic game mechanics from AI-directed orchestration. Core state and game rules remain authoritative and testable, while AI is used to generate, adapt, narrate, and validate experiences within defined system boundaries.

The goal is not to place a chatbot on a television.

The goal is to make the room itself part of the game.