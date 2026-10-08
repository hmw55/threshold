# Amazon Developer Experience Log

**Project:** Threshold  
**Platform:** Amazon Fire TV / Fire OS  
**Purpose:** Developer experience documentation and actionable platform feedback

## Overview

This log documents experiences involving Amazon technologies encountered during the development of **Threshold**, an AI-directed, multiplayer Fire TV experience.

Entries cover Fire TV hardware, Fire OS compatibility, application deployment, Amazon development tooling, and related services.

The objective is to provide constructive, evidence-based feedback by documenting expected behavior, observed outcomes, development impact, and opportunities for improvement.

Experiences are classified as **positive**, **mixed**, or **negative**. General development challenges unrelated to Amazon technologies are documented separately in [Developer Friction](./developer.md).

## Experience Summary

| ID | Experience | Classification |
|---|---|---|
| AF-001 | [Physical Fire TV Development Setup](#af-001--physical-fire-tv-development-setup) | Positive |
| AF-002 | [Reusing a Fire TV Remote Across Multiple Devices](#af-002--reusing-a-fire-tv-remote-across-multiple-devices) | Mixed |
| AF-003 | [Fire OS 6 Compatibility and Physical Device Testing](#af-003--fire-os-6-compatibility-and-physical-device-testing) | Positive |

---

## Negative Experiences

No negative Amazon-related experiences have been documented to date.


---

## Mixed Experiences

### AF-002 — Reusing a Fire TV Remote Across Multiple Devices

**Task**

Pair an existing Fire TV remote with a second Fire TV Stick that did not have its own remote, then restore the remote's connection to the original device.

**Experience:** Mixed

**Expected Behavior**

Transferring a compatible remote between Fire TV devices would involve a relatively predictable pairing process, with clear feedback when pairing was initiated, unsuccessful, or completed.

**Observed Behavior**

The remote was successfully transferred between devices, but the process required multiple pairing attempts.

The button combinations did not consistently produce an immediately successful connection, and limited feedback made it difficult to determine why individual attempts had failed.

Restoring the remote's connection to its original Fire TV Stick was more difficult than connecting it to the second device.

The Amazon Fire TV mobile application provided an important recovery mechanism by allowing navigation and remote management without the physical remote.

**Troubleshooting Steps**

1. Attempted to connect the existing remote to the second Fire TV Stick.
2. With the original television and Fire TV Stick powered off, held Left + Menu + Back for approximately 12 seconds to reset the remote connection.
3. Removed the remote batteries for more than five seconds before reinstalling them.
4. Held Home for approximately 30 seconds to initiate pairing.
5. Repeated the pairing sequence approximately two or three times before successfully connecting the remote to the second Fire TV Stick.
6. Connected the second Fire TV Stick to the Amazon Fire TV mobile application to enable its virtual remote functionality.
7. Disconnected power from the second Fire TV Stick.
8. Attempted to restore the physical remote's connection to the original Fire TV Stick, requiring additional attempts.
9. Used the mobile application, which was already paired with the original device, to access remote-management settings and initiate pairing.

**Development Impact**

The process temporarily interrupted physical-device testing and required additional troubleshooting.

Although the issue was resolved without permanent loss of functionality, restoring control of the original device was more difficult than anticipated.

**What Worked Well**

- The physical remote could ultimately be paired with both Fire TV devices.
- The Fire TV mobile application provided an effective alternative input method.
- Existing mobile-app connectivity allowed access to pairing settings when the physical remote was unavailable.

**Areas of Friction**

- Multiple pairing attempts were required.
- Pairing failures provided limited diagnostic feedback.
- Returning the remote to its original device was unexpectedly difficult.
- Recovery was substantially easier because the mobile application had already been configured.

**Suggested Improvement**

Improve the discoverability and clarity of remote-pairing and recovery workflows, particularly for users transferring a remote between compatible Fire TV devices.

Potential improvements include:

- Clearer visual feedback when a remote enters pairing mode.
- More informative guidance when pairing attempts are unsuccessful.
- Easier access to remote recovery instructions.
- More explicit guidance for situations where no physical remote is currently connected.

These observations reflect the specific devices and remote used during testing and may not apply uniformly to all Fire TV models.

---

## Positive Experiences

### AF-001 — Physical Fire TV Development Setup

**Task**

Configure a physical Fire TV Stick for local development and deploy the initial Threshold application.

**Experience:** Positive

**Expected Behavior**

Physical-device development might require additional Amazon-specific tooling, device registration, or a more involved application deployment process.

**Observed Behavior**

The setup process was straightforward. Developer Options and ADB debugging were accessible through the Fire TV settings, and the device accepted ADB connections over the local network.

The locally compiled Android APK was installed and launched successfully without requiring application publication or additional deployment infrastructure.

**Steps Performed**

1. Enabled Developer Options in the Fire TV settings.
2. Enabled ADB debugging.
3. Identified the Fire TV Stick on the local network.
4. Established an ADB connection to the device.
5. Installed the Threshold debug APK.
6. Launched Threshold directly on the physical Fire TV.

**Development Impact**

The accessible deployment workflow enabled physical-device validation early in development, reducing the time between implementation and hardware testing.

**What Worked Well**

- Straightforward access to developer settings.
- Direct ADB connectivity over the local network.
- Support for sideloading locally compiled APKs.
- No requirement to publish the application before testing on physical hardware.

**Suggested Improvement**

No significant improvement identified during initial device setup.

---

### AF-003 — Fire OS 6 Compatibility and Physical Device Testing

**Task**

Extend Threshold's Android compatibility to an older Fire TV Stick 4K running Fire OS 6 and validate installation and application launch across multiple physical Fire TV devices.

**Experience:** Positive

**Expected Behavior**

Supporting an older Fire OS version could require substantial application changes or expose compatibility issues with the existing native Android/Kotlin implementation.

**Observed Behavior**

The application initially targeted a minimum Android SDK version of API 28, which prevented installation on the Fire OS 6 device.

After reducing the minimum supported SDK version to API 25 and resolving two Android resource and compatibility issues, the application built successfully and passed Android lint checks.

The resulting APK installed and launched successfully on the older Fire TV Stick without requiring a separate application implementation.

**Steps Performed**

1. Identified the application's existing minimum SDK requirement of API 28.
2. Updated the minimum supported SDK version to API 25.
3. Added the missing television launcher banner resource.
4. Removed a navigation-bar style attribute requiring API 27.
5. Successfully completed the Android build and lint checks.
6. Connected the Fire OS 6 device through ADB.
7. Installed the debug APK and launched Threshold on the physical device.

**Development Impact**

The compatibility changes expanded Threshold's physical-device testing coverage and supported continued development of a shared multiplayer experience across Fire TV devices running different Fire OS versions.

**What Worked Well**

- A single native Android/Kotlin codebase could target both tested Fire TV devices.
- Required compatibility adjustments were relatively limited.
- Existing Gradle and ADB workflows remained usable across devices.
- Older hardware could be incorporated into the development environment without maintaining a separate application.

**Validation Scope**

Successful compilation, lint validation, APK installation, and application launch were confirmed. Full multiplayer functionality and extended runtime compatibility on Fire OS 6 remain subject to further testing.

**Suggested Improvement**

No significant Fire OS-specific improvement identified during this compatibility milestone.

Testing on older physical hardware early in development remains a useful practice for identifying SDK and resource compatibility requirements.

---

## Documentation Notes

This log records firsthand development observations rather than comprehensive product evaluations.

Entries describe the specific tasks performed and outcomes observed. Suggested improvements represent developer feedback and are not assertions that a particular feature or capability is universally unavailable.

Additional entries will be added when meaningful Amazon-related experiences arise during continued development and testing.