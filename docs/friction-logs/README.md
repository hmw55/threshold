# Threshold — Developer Experience & Friction Logs

This directory documents developer experiences encountered while designing, building, and testing **Threshold**, an AI-directed, multiplayer Fire TV experience.

The purpose of these logs is to capture real-world development feedback, including technical obstacles, successful workflows, workarounds, and opportunities for improvement.

Feedback is recorded throughout development rather than reconstructed at the end of the project.

## Logs

| Log | Description |
|---|---|
| [Amazon-Related Experiences](./amazon.md) | Experiences involving Fire TV hardware, Fire OS, Amazon development tools, SDKs, APIs, AWS services, and related documentation. |
| [General Developer Friction](./developer.md) | Development challenges involving frameworks, build tooling, networking, local environments, and other technologies not directly attributable to Amazon. |

## Experience Categories

Amazon-related experiences are organized into three categories:

- **Positive:** Workflows or tools that were particularly straightforward, reliable, or effective.
- **Mixed:** Experiences that ultimately succeeded but involved unexpected friction, unclear behavior, or additional troubleshooting.
- **Negative:** Issues that significantly disrupted development, prevented expected functionality, or required substantial workarounds.

General development challenges are documented separately to distinguish Amazon-specific feedback from broader engineering issues.

## Documentation Approach

Each entry captures relevant details such as:

- **Task:** What the developer was attempting to accomplish.
- **Expected behavior:** What was anticipated before beginning the task.
- **Actual behavior:** What occurred during implementation or testing.
- **Steps:** Actions taken to reproduce, investigate, or resolve the experience.
- **Impact:** How the experience affected development.
- **Workaround:** How an obstacle was addressed, when applicable.
- **Suggested improvement:** Actionable feedback based on the experience.

Not every entry requires every field. The emphasis is on accurate, useful observations rather than exhaustive documentation of routine development activity.

## Entry Identifiers

Entries use stable identifiers to make them easy to reference in discussions, commits, and project documentation.

- `AF-001`, `AF-002`, etc. — Amazon-related experiences.
- `DF-001`, `DF-002`, etc. — General developer friction.

Identifiers remain unchanged if an entry is updated or moved between categories.

## Scope

These logs reflect experiences encountered during Threshold development. They are not intended as comprehensive reviews of Amazon products or third-party development tools.

Observations are based on the specific hardware, software versions, configurations, and workflows used during development.