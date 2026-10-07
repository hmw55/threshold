# Technical Decision Log

This document records significant technical and architectural decisions made during Threshold development, including the reasoning behind them.

---

## TD-001 — Linux-First Local Development

**Status:** Accepted

Threshold uses Linux environments as its primary development environment, primarily WSL and Arch Linux.

Local development, builds, linting, type checking, and testing should be performed locally whenever practical. GitHub Actions is used as a CI verification layer rather than the primary development loop.

### Rationale

- Conserves GitHub-hosted Actions minutes for the private repository.
- Keeps development feedback fast.
- Provides a consistent Unix-like development environment across WSL and Arch.
- Allows the same validation commands to be executed locally and in CI.

---

## TD-002 — TypeScript Monorepo

**Status:** Accepted

Threshold uses a pnpm workspace organized as a monorepo.

Primary workspace areas are:

- `apps/` — user-facing applications
- `packages/` — shared libraries and game systems
- `services/` — backend services
- `infra/` — infrastructure as code

### Rationale

Threshold consists of multiple applications and services that need to share types, game contracts, validation schemas, and other code.

A monorepo allows these components to evolve together while maintaining clear boundaries between them.

---

## TD-003 — Fire TV Client Technology: React Native + TypeScript

**Status:** Superseded by TD-005

React Native + TypeScript was initially selected for the Fire TV client. During project-foundation validation, the generated React Native 0.82.1 Android project encountered repeated build-tooling issues within the pnpm monorepo, including Gradle plugin resolution and JVM toolchain compatibility failures.

The framework was rejected before application development began.

### Original Rationale

- Maintained TypeScript across most of the Threshold codebase.
- Fire TV supports Android-compatible application development.
- Enabled testing directly on physical Fire TV hardware.
- Avoided introducing a separate application language unless platform limitations required it.

---

## TD-004 — Stable Toolchain Versions

**Status:** Accepted

Threshold pins pnpm 10.18.0 and TypeScript 5.9.3 for hackathon development.

### Rationale

The project prioritizes predictable tooling and ecosystem compatibility over adopting newly released major versions during the hackathon. Toolchain upgrades can be evaluated after the submission period.

---

## TD-005 — Fire TV Client Technology: Native Android/Kotlin

**Status:** Accepted

The Threshold Fire TV client uses native Android with Kotlin.

The client targets Fire OS 7 compatibility with `minSdk 28` and is intentionally designed as a thin client. Authoritative game state, AI orchestration, and core game logic remain outside the Fire TV application.

Native Android was selected after validating the complete development pipeline on physical target hardware:

1. Compiled the application locally using Gradle.
2. Produced a debug APK.
3. Connected to a Fire TV Stick over the local network using ADB.
4. Installed the APK directly on the device.
5. Successfully launched Threshold on physical Fire TV hardware.

### Rationale

- Provides direct access to the Android platform underlying the target Fire TV hardware.
- Reduces framework and dependency complexity in the Fire TV client.
- Supports direct handling of Fire TV remote input, application lifecycle, networking, and display behavior.
- Keeps the Fire TV application intentionally thin while TypeScript remains the primary language for the rest of the Threshold platform.
- Uses a development and deployment pipeline already validated on physical Fire TV hardware.