# Threshold — Game Design

> **Reality is playable.**

**Experience:** *The Last Witness*
**Format:** AI-directed, environment-aware mystery for Fire TV and mobile browsers
**Hackathon target:** 1–6 players, 1–4 Fire TV Thresholds, approximately 8–12 minutes
**Document basis:** October 22, 2026 `main` snapshot (`b9980ee`). This is a description of the design and source implementation, **not** a claim that every path has passed a complete physical-device playthrough.

## 1. The experience

Threshold turns a familiar home into the setting of a mystery. Fire TVs become **Thresholds**—shared terminals through which an entity called **the Architect** communicates. Players' phones become **Lenses**—private interfaces for exploring, photographing, receiving instructions, and making consequential choices. The objects and rooms available to the players are part of the game, rather than a backdrop for a conventional screen-only adventure.

*The Last Witness* asks players to determine which observations and accounts can be trusted. The Architect may guide them, withhold information, or make claims that contradict the recorded evidence. Players can challenge those claims, cooperate to restore a signal, and choose what happens to the resulting archive.

### Design pillars

1. **The room matters.** Puzzles and assignments reference objects observed during calibration. Players physically inspect their environment and provide evidence.
2. **Two screens, two purposes.** The TV delivers shared atmosphere and collective instructions; the Lens carries individual actions, evidence, and private information.
3. **Truth has a ledger.** Recorded observations, game events, and player testimony are distinguishable from the Architect's fictional narration.
4. **Social tension is optional, not mandatory.** Multiplayer supports collaboration, suspicion, and voluntary deception; solo has a distinct evidence-versus-Architect challenge.
5. **Choices leave a trace.** Evidence, accusations, cooperation, and the final vote affect scoring, the account of events, or the ending.
6. **Failure is part of the story.** Missing images, unavailable objects, refused physical tasks, and timeouts should be recorded rather than silently converted into success.

## 2. Players and devices

| Element | Player-facing role |
|---|---|
| **Fire TV Threshold** | Create/join an expedition, show shared transmissions and gameplay, and participate in terminal interactions |
| **Mobile Lens** | Join as a player, capture calibration and evidence photos, see private assignments, solve interactions, and make choices |
| **Physical environment** | Supplies the actual rooms, objects, locations, and observations used in tasks |
| **Session service** | Coordinates players, TVs, phases, actions, and the authoritative event record |
| **The Architect** | Delivers the mystery's personality, instructions, claims, and narrative interpretation |

The intended configuration is **1–6 Lens players** and **1–4 Fire TVs**. Not every task uses every television: in the inspected witness implementation, the synchronized terminal pulse uses up to the first **two** registered TVs. Additional TVs may still participate as displays.

**Solo is not multiplayer with missing people.** The witness module substitutes a baseline-and-memory challenge for physical displacement between players, and does not invent a second participant. Two-player sessions can feature physical displacement when a distinct, suitable target exists. Recruitment of a deceptive witness requires at least three players.

## 3. Player journey

![Threshold gameplay flow](diagrams/Threshold-Gameplay-Flow(3).png)

[Editable gameplay flow (Mermaid)](diagrams/threshold-gameplay-flow.mmd)

1. **Launch and join.** A Fire TV creates or joins an expedition. Players join through their Lenses using the session code; other TVs may register with the same session.
2. **Calibrate.** Players photograph relevant areas and objects. The service analyzes the images to establish usable environmental context.
3. **Receive the briefing.** The Architect frames the mystery and begins issuing public and private instructions.
4. **Investigate.** Players observe, photograph, solve object-bound tasks, compare claims, and act in the real environment.
5. **Collaborate or compete.** Player count and available evidence determine whether the expedition can present a physical displacement, a private recruitment offer, and a shared signal-restoration task.
6. **Confront the account.** Players may reveal evidence, challenge the Architect, accuse another witness, or defend their own actions.
7. **Decide and conclude.** Players vote on the archive, receive an outcome and evidence summary, and may begin another expedition.

This is the **player-facing narrative arc**. The code contains multiple gameplay modules and UI flows; the precise transitions and timing of a given build should be verified on devices.

## 4. The Last Witness: implemented witness encounter

The source includes a structured witness encounter in `services/session/src/game/witnessExpedition.ts`. It defines eight sequential stages:

| Stage | Time budget in source | Main interaction |
|---|---:|---|
| **Acquisition** | 120 seconds | Photograph a calibrated, assigned object; record whether the image supports the assignment |
| **Locks** | 75 seconds | Unlock a private signal, potentially using a verified object's color, shape, or marking |
| **Displacement** | 120 seconds | Multiplayer: move and investigate a safe, suitable object; solo: restore an original location using recorded evidence |
| **Recruitment** | 60 seconds | With 3+ players, one player may accept or refuse an Architect offer to publish a false account |
| **Cooperation** | 90 seconds | Exchange private signal information, tune channels, and coordinate a Fire TV pulse |
| **Confrontation** | 90 seconds | Reveal evidence, cite the public event ledger, accuse, corroborate, defend, or challenge |
| **Decision** | 45 seconds | Vote to preserve, release, or erase the Architect's narrative access to the archive |
| **Complete** | — | Produce the ending, scores, and evidence-based account |

**Timing note:** These are per-stage maximums in the inspected source, not a guaranteed total duration. Stages can advance early when their completion conditions are met. The nominal maximum of the timed stages is about ten minutes, excluding setup and calibration.

### 4.1 Acquisition and object-grounded puzzles

The witness module assigns objects from the calibrated environment to players. An acquisition photo can be assessed as **verified**, **unverified**, or **rejected**. The game distinguishes these states rather than treating every upload as proof.

When an image yields supported visual features, a lock can ask the player to inspect a real object's **color**, **shape**, or **marking**. Otherwise, the signal uses the defined symbol sequence. Players may report an object or camera unavailable. Shared objects can serve multiple channels when calibration produces fewer distinct objects than players; the system records that fallback rather than inventing additional props.

### 4.2 Displacement: a physical social challenge

When the necessary conditions are met, one player receives a private instruction to relocate another player's suitable object. The original owner must investigate and report recovery. Photographs and claims become part of the record, but **a photograph alone cannot establish who physically moved an object**. Independent corroboration is a separate action.

Players should only move **safe, permitted, portable objects**. If no appropriate object or distinct player assignment exists, the encounter records the objective as unavailable. Solo play instead asks the player to challenge a false Architect account using the object's original documented location.

### 4.3 Private offers and deception

With at least three players, the Architect may privately recruit one witness to publish a false statement about an event already in the ledger. The player may **accept or refuse**. This is an optional act of betrayal, not a compulsory hidden-traitor assignment.

The Architect can also issue a misleading public claim. These deceptions are constructed against recorded game events; they should not be described as AI having independently seen an unverified physical action.

### 4.4 Shared signal restoration

Each Lens has information needed by another participant. Players must communicate to tune their own channels. Once the required channels are tuned, players coordinate **SELECT** on the relevant Fire TVs within a **12-second window**. A one-TV session requires one pulse; the source also includes a late Lens recovery option when terminal synchronization is unavailable.

This sequence gives the TV an indispensable active role beyond displaying narrative text.

### 4.5 Evidence confrontation

The confrontation phase separates **evidence**, **public claims**, and **private knowledge**. Players can reveal their own photographs, accuse another witness or the Architect using a cited public event, and select a response such as defend, challenge, corroborate, or withhold.

The game engine determines whether accusations are supported by its recorded events. False accusations can cost points. The verdict is disclosed at the end, rather than relying on the Architect's word.

### 4.6 Final decision and endings

Players vote to:

- **Preserve** the archive.
- **Release** the archive to the witnesses.
- **Erase** the Architect's narrative access.

The outcome reflects the votes and, for ties or missing votes, recorded factors such as whether the Architect was challenged and whether cooperation succeeded. The final summary names real assigned objects, submitted evidence, claims, accusations, cooperation, and unresolved gaps.

**Important:** The story choice to *erase* is **not** a claim that stored photographs are deleted. Actual data retention is an independent privacy and infrastructure concern.

## 5. Scoring and consequences

The witness implementation tracks per-player **scores** and **trust**, plus evidence, events, accusations, responses, and votes. Examples of scoring in the inspected source include:

| Action | Example points |
|---|---:|
| Verified acquisition photo | +100 |
| Unverified but accepted acquisition photo | +50 |
| Correct channel lock | +100 |
| Incorrect lock attempt | −10 |
| Successful solo baseline restoration | +150 |
| Correct accusation | +150 |
| False accusation | −100 |
| Reveal an evidence photo | +25 |
| Unexposed recruited deception | +200 |

These are implementation details, **not a promise that every scoring path is surfaced identically in every UI**. Points reward investigation and risk, while the ending explains narrative consequences and preserves uncertainty where the evidence is incomplete.

## 6. The Architect and AI boundaries

The Architect is an in-world director, **not the source of canonical truth**. The backend maintains structured state and applies gameplay rules. AI can support environmental interpretation and narrative presentation, but its prose should not override the event ledger or fabricate verified evidence.

The current project has a provider abstraction supporting **Gemini** and local **Ollama** development. Amazon Bedrock was explored but should not be represented as a working inference provider in this snapshot.

**Three categories must remain separate:**

| Category | Meaning |
|---|---|
| **Recorded facts** | Server-accepted actions, event records, verified state transitions, and evidence assessments |
| **Player testimony** | Claims about what a person did or saw; potentially incomplete or deceptive |
| **Architect narrative** | In-character guidance, hypotheses, warnings, or deliberate false claims |

AI-generated atmosphere can be uncertain or deceptive. The system must not label a claimed object movement, witness identity, or photo detail as verified without appropriate evidence and application checks.

## 7. Environmental calibration and player safety

Calibration is intentionally limited; the game is not expected to reconstruct an entire home or discover every room. It uses the objects and context available from submitted images. Uncalibrated spaces may still be physically accessible, but the game should not pretend it has visually inspected them.

Players should be able to decline tasks involving unsafe, fragile, heavy, inaccessible, or private objects. A missing object, unavailable camera, rejected image, or declined movement is a valid recorded result—not a reason to pressure players to comply.

Because images may show private homes, players should understand when images are uploaded, how they are processed, and how long they are retained. See [system architecture](architecture.md) for the reported storage configuration and outstanding privacy verification.

## 8. Replayability and variation

The core premise remains *The Last Witness*, but the physical setting, calibrated objects, assignments, player count, evidence, optional deception, cooperation, votes, and ending can differ. The inspected witness encounter derives assignments and signal data from session and environmental inputs; it is not evidence that every conceivable mystery, Architect personality, or narrative branch is procedurally generated.

The intended replay value comes from **different rooms, people, objects, choices, and accounts of what happened**, rather than from promising an unlimited number of authored campaigns.

## 9. Design intent versus verified delivery

| Area | Source-supported design / implementation | Verification still needed |
|---|---|---|
| Solo encounter | Dedicated baseline and evidence challenge | Full solo device playthrough, including final screen |
| Multiplayer social challenge | Displacement, optional recruitment, accusations | Physical-device run with appropriate player counts and objects |
| Cooperative TV interaction | Timed pulse and Lens channel exchange | Cross-TV timing and reconnect behavior |
| Object-grounded puzzles | Calibration assignments and visual lock paths | End-to-end photo assessment and UI interaction |
| Endings | Structured vote, score, and summary calculation | Final Lens and TV presentation, return-to-lobby/replay controls |
| AI | Provider abstraction and environmental/narrative integrations | Latency, error handling, and cloud playthrough reliability |

The design goal is a polished, demonstrable **8–12-minute** slice, not a claim that all intended mechanics or all configurations are production-ready.

## 10. Scope and future directions

**Hackathon priority:** a reliable start-to-finish expedition with an intelligible story, environmental relevance, meaningful TV/Lens participation, clear results, and straightforward setup for a judge or player.

**Future possibilities, not current feature claims:** additional expeditions, richer Architect personalities, more extensive procedural narrative variation, optional integrations with household devices or cameras, accessibility improvements, stronger privacy and account controls, and expanded device support.

## 11. Related documentation

- [System architecture](architecture.md)
- [Gameplay flow image](diagrams/Threshold-Gameplay-Flow(3).png)
- [Gameplay flow Mermaid source](diagrams/threshold-gameplay-flow.mmd)
- [Game systems Mermaid source](diagrams/threshold-game-architecture.mmd)
- [Session lifecycle](session-lifecycle.md)
- [Developer friction logs](friction-logs/README.md)

---

*Implementation references: `services/session/src/game/witnessExpedition.ts`, `fieldExpedition.ts`, `environmentalCase.ts`, and related API routes in `services/session/src/routes/`. This document should be updated if the shipped gameplay flow diverges from the inspected snapshot.*
