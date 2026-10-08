# General Developer Friction Log

**Project:** Threshold  
**Scope:** Development tooling, frameworks, build systems, and local infrastructure  
**Purpose:** Document engineering challenges, resolutions, and lessons learned

## Overview

This log documents general software engineering challenges encountered while developing **Threshold**, an AI-directed, multiplayer Fire TV experience.

Entries focus on framework integration, dependency management, build tooling, networking, and development environment configuration.

The objective is to preserve technical context, explain engineering decisions, and identify opportunities to improve development workflows.

Issues directly related to Amazon products, Fire OS, Fire TV hardware, AWS services, or Amazon development tooling are documented separately in the [Amazon Developer Experience Log](./amazon.md).

## Friction Summary

| ID | Experience | Severity |
|---|---|---|
| DF-001 | [React Native Monorepo and Android Build Tooling](#df-001--react-native-monorepo-and-android-build-tooling) | Medium |
| DF-002 | [Cross-Device Development Networking](#df-002--cross-device-development-networking) | Not assessed |

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

## Documentation Notes

Entries describe development challenges observed during Threshold implementation and the approaches used to resolve them.

Severity reflects the impact on the development process rather than the inherent quality of a framework, operating system, or tool.

The documented resolutions represent decisions made within the project's technical requirements and development timeline; they are not intended as universal recommendations.