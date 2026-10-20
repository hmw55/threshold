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
| AF-004 | [Bedrock Account Verification and Zero Inference Quotas](#af-004--bedrock-account-verification-and-zero-inference-quotas) | Negative |

---

## Negative Experiences

### AF-004 — Bedrock Account Verification and Zero Inference Quotas

**Task**

Configure Amazon Bedrock for Threshold and successfully invoke Amazon Nova Micro through the Converse API as the first step toward integrating The Architect, the application's AI game master.

**Experience:** Negative

**Expected Behavior**

After creating an AWS account, configuring IAM Identity Center, authenticating through AWS CLI, and confirming that a foundation model was active and supported on-demand inference, the developer would be able to perform an initial inference request.

If account activation, verification, or service quotas prevented inference, those restrictions would be clearly communicated before attempting the request, along with actionable steps to resolve them.

**Observed Behavior**

On October 9, 2026, AWS CLI authentication succeeded using an IAM Identity Center administrator permission set. Amazon Bedrock successfully returned model information confirming that `amazon.nova-micro-v1:0` was active and supported on-demand inference in `us-east-1`.

However, an initial Converse API request at approximately 4:00 AM MDT returned an `AccessDeniedException`, stating that the AWS account was undergoing verification. The error indicated that verification normally takes less than two hours.

More than six hours later, the same request returned a `ThrottlingException` stating: "Too many tokens per day, please wait before trying again."

Further investigation through AWS Service Quotas revealed that Amazon Nova Micro had zero allocated on-demand requests per minute, tokens per minute, and model invocation tokens per day. Cross-region inference quotas were also zero.

The AWS Account console displayed no apparent activation requirements, and its Customer Verification page stated: "You are not required to complete customer verification of your account at this time."

The developer also discovered AWS User Notifications verification emails in Gmail's Spam folder. These concerned notification delivery channels rather than Bedrock inference access and did not provide a resolution.

AWS Support's automated assistant investigated account verification, incomplete account activation, and payment verification but could not provide a recommendation. A support case was subsequently created on October 9, 2026, at 10:26 AM MDT.

**Troubleshooting Steps**

1. Configured IAM Identity Center and assigned the `AdministratorAccess` permission set.
2. Installed AWS CLI v2 and authenticated using an SSO profile.
3. Verified authentication using `aws sts get-caller-identity`.
4. Listed available Amazon Bedrock foundation models.
5. Confirmed that Amazon Nova Micro was active and supported on-demand inference.
6. Attempted a Converse API request and received an account-verification error.
7. Retried more than six hours later and received a daily-token throttling error.
8. Queried AWS Service Quotas and identified zero allocated inference capacity for Nova Micro.
9. Reviewed AWS Account information and Customer Verification status.
10. Reviewed AWS User Notifications verification emails.
11. Opened AWS Support Center and submitted the issue to its automated troubleshooting assistant.
12. Received no actionable recommendation from the assistant.
13. Created an AWS Support case under Account Management / Account Verification.

**Development Impact**

The issue prevented Threshold from performing its first successful Amazon Bedrock inference request, blocking validation of The Architect's planned cloud AI integration.

The developer spent additional time investigating account activation, model availability, service quotas, email verification, and AWS Support instead of implementing application functionality.

Because Threshold is being developed for the Amazon Devices Global Hackathon, the unresolved restriction also introduces uncertainty into a time-constrained development schedule.

Local development can continue through mock AI responses, but actual Bedrock behavior, latency, and integration cannot yet be validated.

**What Worked Well**

- IAM Identity Center authentication and AWS CLI integration worked successfully.
- Amazon Bedrock model discovery returned useful model metadata.
- The initial API error identified account verification as a possible restriction and provided an escalation contact.
- AWS Service Quotas exposed the account's zero inference allowances.
- AWS Support Center allowed a Basic Support customer to create an account-related support case without upgrading to a paid plan.
- The support case preserved the developer's error messages and troubleshooting findings.

**Areas of Friction**

- Successful authentication and model discovery created the impression that the account was ready for inference, despite zero usable inference quotas.
- The verification restriction was not clearly surfaced during account setup or model discovery.
- The initial error suggested a verification delay of less than two hours, but inference remained unavailable more than six hours later.
- Subsequent requests produced a different error describing daily token exhaustion, even though no successful inference had occurred.
- Zero inference quotas were visible in Service Quotas, but the console did not provide a clear explanation of why they were zero or how to enable them.
- The Customer Verification page indicated that no verification was required, which did not clarify the earlier account-verification error.
- The automated support workflow investigated several possible causes but could not identify a resolution.
- The developer had to escalate through a support case before completing a basic first-model invocation.

**Suggested Improvement**

Provide a clear Amazon Bedrock inference-readiness indicator during onboarding that identifies account activation status, verification restrictions, and effective model inference quotas.

When inference is unavailable because of account-level restrictions, return consistent, actionable errors that distinguish verification delays from token consumption or throttling.

If quotas are temporarily zero, explain the reason, expected availability, and whether developer action is required.

Additionally, surface these restrictions in the Bedrock console before developers attempt their first API request, and provide a direct support escalation path for newly created accounts that remain blocked beyond the advertised verification period.

**Resolution Status**

Pending.

AWS Support case created October 9, 2026, at 10:26 AM MDT.

No successful Amazon Bedrock inference request has been completed. The cause of the zero quotas and the relationship to account verification remain unconfirmed pending AWS Support's response.


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