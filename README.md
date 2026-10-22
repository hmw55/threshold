# Threshold

> **Reality is playable.**

**An AI-directed mystery that turns your home into the game world.** Fire TVs become shared terminals called **Thresholds**. Phones become private **Lenses**. An unpredictable entity known as **the Architect** uses the rooms, objects, evidence, and decisions around you to direct an expedition that unfolds across screens *and* the physical environment.

**Featured expedition:** *The Last Witness* · **1–6 players** · **1–4 Fire TVs** · **approximately 8–12 minutes of gameplay** (excluding setup and calibration)

> **Project status — October 22, 2026:** Hackathon prototype with implemented cross-device gameplay, environmental calibration, and a cloud-deployed backend. The experience has been played through in a tested physical-device configuration; **not every player count, Fire OS version, recovery path, or gameplay variation has been validated end to end**.

Hackathon submission: Threshold is being submitted to the Fire TV primary track, with entries in the AWS Builder Mini Challenge and Open Source Mini Challenge.

<!-- ===================================================================== -->
<!-- MEDIA TODO 1 — HERO IMAGE (HIGHEST PRIORITY)                         -->
<!-- Capture: a real Fire TV showing the Architect's transmission, with   -->
<!-- a phone running Lens visibly in the foreground. Prefer a landscape  -->
<!-- 16:9 composition, no private addresses, session tokens, or faces     -->
<!-- unless you have permission. Save as docs/media/threshold-hero.png.   -->
<!-- Remove this comment when the image is ready.                          -->
<!-- ===================================================================== -->

**📸 HERO SCREENSHOT NEEDED:** `docs/media/threshold-hero.png` — Fire TV + phone in the same shot, immediately showing the two-screen concept.

<!-- When ready, replace the line above with:
![Threshold: a Fire TV terminal and a mobile Lens sharing an expedition](docs/media/threshold-hero.png)
-->

## Watch the demo

<!-- ===================================================================== -->
<!-- MEDIA TODO 2 — DEMO VIDEO                                            -->
<!-- Upload your finished 2-minute demo/trailer to YouTube or another     -->
<!-- public host. Add the real URL below and link to the Devpost project. -->
<!-- A YouTube thumbnail can be clickable using:                          -->
<!-- [![Watch Threshold demo](docs/media/demo-thumbnail.png)](VIDEO_URL) -->
<!-- Do not invent a video link before it exists.                          -->
<!-- ===================================================================== -->

**🎬 VIDEO GOES HERE:** Add the **2-minute gameplay trailer** immediately under this heading. Show: session join → photographing a real object → public TV transmission + private Lens instruction → players moving/cooperating → the final choice. Store a representative still at `docs/media/demo-thumbnail.png` and replace this placeholder with a linked thumbnail or video link.

**Devpost submission:** _Add the published project link here after submission._

## What makes Threshold different?

- **Your environment is the level.** The Lens captures calibration photos and players confirm objects that can become puzzle anchors. The game must distinguish confirmed evidence from unverified AI guesses.
- **The screens know different things.** Thresholds deliver shared transmissions and terminal interactions; Lenses hold private clues, tasks, evidence, and decisions.
- **The Architect can mislead you.** AI shapes the narration and interprets observations, while a structured backend maintains the authoritative record of game events and permitted actions.
- **People have to leave their seats.** Object inspection, movement, deduction, corroboration, and coordination connect the mystery to the actual room.
- **Solo and multiplayer are intentionally different.** Solo challenges your memory and the Architect's claims; multiplayer introduces cooperation, suspicion, and optional deception when the player count allows.
- **Your decisions matter.** Evidence, accusations, coordination, and a final archive vote shape the recorded outcome.

## See the game

<!-- ===================================================================== -->
<!-- MEDIA TODO 3 — GAMEPLAY SCREENSHOT GALLERY                            -->
<!-- Capture 4–6 genuine screenshots, ideally from the final demo build:  -->
<!-- 1. docs/media/lens-calibration.png — object confirmation/photo flow  -->
<!-- 2. docs/media/tv-architect.png — Architect transmission on Fire TV   -->
<!-- 3. docs/media/lens-private-task.png — private instruction (no token) -->
<!-- 4. docs/media/tv-signal.png — TV interaction / cooperative signal    -->
<!-- 5. docs/media/lens-evidence.png — evidence or confrontation          -->
<!-- 6. docs/media/lens-finale.png — final decision or polished results   -->
<!-- Prefer real captures over mockups. Avoid exposing player identities, -->
<!-- private house details, IPs, session codes, or credentials.            -->
<!-- ===================================================================== -->

| Screenshot to add | What it demonstrates |
|---|---|
| **📸 `docs/media/lens-calibration.png`** | A real object captured through Lens and presented for confirmation |
| **📸 `docs/media/tv-architect.png`** | The Architect addressing the group through a Fire TV Threshold |
| **📸 `docs/media/lens-private-task.png`** | A player's private instruction or clue |
| **📸 `docs/media/tv-signal.png`** | A shared TV interaction, preferably the cooperative signal task |
| **📸 `docs/media/lens-evidence.png`** | Evidence, an accusation, or an Architect contradiction |
| **📸 `docs/media/lens-finale.png`** | The final decision/results interface |

<!-- Once captured, replace the table above with a gallery, for example:
| Calibration | The Architect | Private mission |
|---|---|---|
| ![Lens calibration](docs/media/lens-calibration.png) | ![TV transmission](docs/media/tv-architect.png) | ![Private Lens task](docs/media/lens-private-task.png) |
| Cooperation | Evidence | Finale |
|---|---|---|
| ![TV cooperation](docs/media/tv-signal.png) | ![Lens evidence](docs/media/lens-evidence.png) | ![Lens finale](docs/media/lens-finale.png) |
-->

## How *The Last Witness* plays

1. **Connect:** Start an expedition on Fire TV, join on phones with the session code, and optionally register additional TVs.
2. **Calibrate:** Photograph parts of the environment. AI-assisted interpretation and player confirmation identify potential game objects.
3. **Investigate:** Receive private assignments and public broadcasts; inspect objects and establish evidence.
4. **Collaborate or deceive:** Depending on the player count and available objects, relocate and recover evidence, compare fragments, synchronize TV inputs, or accept a private offer.
5. **Confront:** Challenge the Architect's account, corroborate evidence, and decide whom to trust.
6. **Choose:** Vote to **preserve**, **release**, or **erase** the fictional archive and receive an ending. *Erase* is a narrative decision, **not** a promise to delete stored photos.

**Design target:** 8–12 minutes of active gameplay. Calibration, connection, and device setup take additional time. Gameplay paths depend on available devices, player count, confirmed objects, and supported interactions.

### Gameplay flow

<!-- This PNG is part of the documentation reorganization; verify it has -->
<!-- been copied to docs/diagrams/ before publishing this README.         -->
![Threshold gameplay flow](docs/diagrams/Threshold-Gameplay-Flow(3).png)

[Gameplay design and stage details](docs/game-design.md) · [Editable gameplay flow diagram](docs/diagrams/threshold-gameplay-flow.mmd)

## How it works

| Component | Role | Technology |
|---|---|---|
| **Threshold** | Shared transmissions, terminal actions, zone-specific display | Native Android / Kotlin on Fire TV |
| **Lens** | Phone-based calibration, private tasks, evidence, choices | React / TypeScript / Vite |
| **Session service** | Authoritative membership, phases, game rules, persistence, APIs | Node.js / Express / TypeScript / SQLite |
| **The Architect** | AI-assisted environmental interpretation and narrative direction | Gemini (cloud) or Ollama (local), behind a provider abstraction |
| **Cloud infrastructure** | Hosted backend, private image storage, configuration, operational logs | AWS EC2, S3, IAM, Systems Manager, CloudWatch; Caddy HTTPS |

**Important:** Amazon Bedrock was evaluated but inference was blocked by account-level quota/access restrictions in the tested account. **Bedrock is not a working runtime provider in this build.** The AWS deployment remains useful for compute, storage, identity, and monitoring.

The Lens and backend are **separate services**: a working backend URL does not automatically provide a publicly hosted Lens website. The project uses HTTP-based client/server coordination and polling; do not assume a WebSocket-based real-time architecture.

### Architecture diagram

<!-- Verify this PNG is present after moving docs/architecture/ to       -->
<!-- docs/diagrams/. Do not leave a broken image in the public README.    -->
![Threshold AWS architecture](docs/diagrams/Threshold-AWS-Architecture(1).png)

[Full system architecture](docs/architecture.md) · [Editable AWS diagram](docs/diagrams/threshold-aws-architecture.mmd) · [Session lifecycle](docs/session-lifecycle.md)

## Quick start for contributors

**Requirements:** Node.js **22+**, pnpm **10.18.0** (via Corepack), a Linux shell (WSL or Arch Linux recommended). Fire TV development additionally requires a supported JDK, Android SDK, ADB, and an Android-compatible Fire TV device. See the [complete development environment guide](dev-notes/development-environment.md) before configuring physical hardware or remote access.

```bash
# Clone the repository and enter its root
git clone https://github.com/hmw55/threshold.git
cd threshold

corepack enable
pnpm install --frozen-lockfile

# Terminal 1: session service, preserving existing local SQLite data
pnpm dev:resume

# Terminal 2: Lens development server
pnpm --filter lens dev --host 0.0.0.0

# Terminal 3: build the native Fire TV APK
cd apps/fire-tv
./gradlew assembleDebug
```

- **Backend:** local port `3001` by default. Check `http://localhost:3001/health`.
- **Lens:** use the URL printed by Vite; for a phone, configure `VITE_SESSION_SERVICE_URL` to an address the phone can actually reach. **`localhost` on a phone is the phone, not your computer.** WSL, firewall, and HTTPS configuration may be required.
- **Fire TV:** install the APK with `adb install -r apps/fire-tv/app/build/outputs/apk/debug/app-debug.apk` **from the repository root**, or use the named-device deployment scripts described below. Configure the device's reachable backend address first.
- **AI:** configure `GEMINI_API_KEY` in the backend environment and choose Gemini, or run the supported Ollama setup locally. Keep credentials out of source control. See the [AI and environment guide](dev-notes/development-environment.md).
- **Database safety:** `pnpm dev:resume` preserves the designated local SQLite data. **`pnpm dev:fresh` deletes the designated local expedition database**; don't use it during an active playtest.

### Useful commands

```bash
pnpm check                       # lint + typecheck + tests
pnpm build                       # build workspace packages with build scripts
pnpm fire-tv:dev                 # interactive named-device selector
pnpm fire-tv:dev monitor         # deploy to configured 'monitor' Fire TV
pnpm fire-tv:deploy:all          # install on connected authorized TVs
pnpm fire-tv:launch:all          # launch on connected authorized TVs
```

The Fire TV aliases live in the ignored local file `scripts/fire-tv-devices.local.json`. **Do not copy the original developer's device IPs or credentials into your configuration.** For exact script behavior, supported arguments, adding a TV, API request examples, and troubleshooting, use the component documentation below.

## Documentation and repository map

```text
threshold/
├── apps/
│   ├── README.md                 # How the two client applications fit together
│   ├── lens/README.md            # Mobile Lens setup and development
│   └── fire-tv/README.md         # Android/Fire TV build, ADB and device setup
├── services/session/README.md   # Session service, API, auth, AI and storage
├── scripts/README.md            # Custom CLI scripts and device aliases
├── docs/
│   ├── architecture.md           # System design and trust boundaries
│   ├── game-design.md            # The Last Witness gameplay and mechanics
│   ├── session-lifecycle.md      # Session and expedition state transitions
│   ├── diagrams/                 # Architecture and gameplay diagrams
│   └── friction-logs/            # Amazon and general engineering feedback
├── dev-notes/
│   ├── development-environment.md # Contributor runbook
│   └── decisions.md              # Technical decision records
└── package.json
```

**Start here:** [Complete contributor setup](dev-notes/development-environment.md) · [Backend API](services/session/README.md) · [Scripts reference](scripts/README.md) · [Fire TV guide](apps/fire-tv/README.md) · [Lens guide](apps/lens/README.md)

**Understand the project:** [Game design](docs/game-design.md) · [Architecture](docs/architecture.md) · [Session lifecycle](docs/session-lifecycle.md) · [Technical decisions](dev-notes/decisions.md)

**Development feedback:** [Friction log overview](docs/friction-logs/README.md) · [Amazon developer experience](docs/friction-logs/amazon.md) · [General developer friction](docs/friction-logs/developer.md)

## Testing and limitations

The project has been compiled, tested, and exercised on physical Fire TV hardware, with a complete expedition reported in a tested configuration. Automated tests cover portions of session and game behavior, but the prototype is **not** a guarantee of full coverage for all 1–6-player combinations, 1–4-TV arrangements, network conditions, AI outcomes, or device-reconnection paths.

The experience uses photos of real environments. Only photograph spaces and objects you are authorized to capture; avoid personal documents, sensitive information, and unsafe object-moving tasks. AI descriptions are treated as fallible observations, not verified facts.

For known engineering issues and their resolutions or open status, see the [developer friction logs](docs/friction-logs/README.md).

## Open Source & Contributions

Threshold is an open-source project developed for the **Build, Ship, Shape: Amazon Developer Hackathon**.

The project is released under the **MIT License**, allowing developers to use, study, modify, distribute, and build upon the source code, including for commercial purposes, provided the original copyright and license notices are preserved.

Contributions are welcome, including bug fixes, performance improvements, accessibility enhancements, documentation, gameplay systems, and cross-device compatibility testing.

To get started:

1. Read the [Development Environment & Contributor Guide](dev-notes/development-environment.md).
2. Review the README for the application or service you want to contribute to.
3. Create a branch for your changes.
4. Run the relevant local checks and tests.
5. Open a pull request describing your changes and how they were validated.

Bug reports, feature suggestions, and testing feedback can be submitted through [GitHub Issues](https://github.com/hmw55/threshold/issues).

**License:** [MIT License](LICENSE) — Copyright © 2026 Holland M. Wesley.

---

**Threshold isn't a game you play in a room. The room is part of the game.**