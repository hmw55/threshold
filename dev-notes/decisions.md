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

## TD-003 — Fire TV Client Technology

**Status:** Accepted

The initial Threshold Fire TV client will target Fire OS using React Native and TypeScript.

The hackathon development target is Fire OS 7 hardware.

### Rationale

- Maintains TypeScript across most of the Threshold codebase.
- Fire TV supports Android-compatible application development. 
- Enables testing directly on physical Fire TV hardware.
- Avoids introducing a separate application language unless platform limitations require it.

This decision may be revisited if Fire TV-specific limitations make React Native unsuitable for required functionality.

TypeScript is pinned to a stable version compatible with the current React Native ecosystems rather than tracking the newest compiler release during the hackathon.