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
| AF-005 | [AWS Infrastructure Setup and Cross-Device Backend Deployment](#af-005--aws-infrastructure-setup-and-cross-device-backend-deployment) | Positive |
| AF-006 | [CloudWatch Operational Logging and Failure Monitoring](#af-006--cloudwatch-operational-logging-and-failure-monitoring) | Positive |


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

At approximately 4:00 MDT, an initial Converse API request returned an `AccessDeniedException` indicating that the AWS account was undergoing verification, which the error suggested would normally take less than two hours. More than six hours later, another request returned `ThrottlingException: Too many tokens per day, please wait before trying again.` No successful inference has occurred.

AWS Service Quotas showed applied values of zero for Nova Micro on-demand requests per minute, tokens per minute, daily invocation tokens, and cross-region inference quotas. The AWS Account console showed no apparent activation requirement; its Customer Verification page stated that customer verification was not required at that time. AWS User Notifications verification messages discovered in Gmail's Spam folder concerned delivery channels, not Bedrock inference access.

A support case was submitted on October 9 at 10:26 AM MDT. AWS Support responded on October 14 at 12:32 PM MDT, approximately 5 days and 2 hours later. The support engineer apologized for the delay and reported consulting the Bedrock team. The team recommended increasing usage of existing AWS services to support a future quota increase, contacting AWS Sales for an account-manager evaluation, potentially using Free Tier services to establish activity, or waiting until a subsequent billing cycle. The response did not identify the specific reason for zero Bedrock inference quotas or enable initial inference access.

On October 21, further Service Quota checks in `us-east-1` showed zero applied daily inference-token allowances for numerous models, including Amazon Nova Lite, Nova Pro, Nova 2 Lite, and multiple Anthropic Claude models, despite higher displayed AWS default quotas. A separate cross-model quota was nonzero, but that did not resolve the model-specific zero allowances. A direct Converse API invocation using `amazon.nova-lite-v1:0` again returned `ThrottlingException: Too many tokens per day, please wait before trying again.` Model discovery continued to work, but invocation remained blocked for the tested models.

The existing support case was reopened by the developer (me) on October 21 at 12:17 PM MDT, requesting urgent escalation, an explanation of the zero quota, and consideration of minimal nonzero inference access for the October 23 hackathon deadline. As of this update, no successful Bedrock inference request has been confirmed.

**Troubleshooting Steps**

1. Configured IAM Identity Center with an `AdministratorAccess` permission set, installed AWS CLI v2, and authenticated using an SSO profile.
2. Verified AWS identity using `aws sts get-caller-identity` and listed available Bedrock foundation models.
3. Confirmed Nova Micro's active status and reported on-demand inference support.
4. Attempted a Converse API request and received an account-verification error.
5. Retried more than six hours later and received a daily-token throttling error.
6. Inspected AWS Service Quotas and found zero effective inference allowances for Nova Micro.
7. Checked AWS Account activation and Customer Verification status, and reviewed unrelated AWS User Notifications verification emails.
8. Used the AWS Support automated assistant, which did not identify an actionable resolution.
9. Created AWS Support case `179156319400779` on October 9 under Account Management / Account Verification.
10. Reviewed the October 14 AWS Support reply, including the Bedrock team's usage, Sales, and billing-cycle recommendations.
11. Rechecked model-specific daily quotas for multiple models in `us-east-1` on October 21.
12. Attempted direct inference with Nova Lite and reproduced the daily-token throttling error.
13. Reopened the support case on October 21 with the latest evidence and requested an expedited review before the hackathon deadline.

**Development Impact**

The restriction prevented the first successful Amazon Bedrock inference request and blocked validation of The Architect's planned cloud AI integration, including real-world inference behavior and latency.

Investigation, account checks, and support correspondence consumed development time across October 9–21. The issue remained unresolved twelve days after the original support request, with the October 23, 2026, 1:00 PM Mountain Time hackathon deadline approaching.

To avoid blocking the hackathon demonstration, the application retained its provider abstraction and integrated Google Gemini as an alternative inference provider. AWS continued to host the session backend, store calibration images, and manage cloud credentials.

On October 21, the alternative implementation successfully analyzed a photograph captured through the mobile Lens and returned recognizable objects for player confirmation. This restored the intended cloud AI calibration workflow without resolving the underlying Bedrock access restriction.

The workaround demonstrated the value of provider-independent application architecture, but it did not eliminate the developer experience concern: the Bedrock account could discover supported models while remaining unable to perform an initial inference request.

**What Worked Well**

- IAM Identity Center authentication and AWS CLI integration worked successfully.
- Amazon Bedrock model discovery returned useful metadata, allowing model availability to be distinguished from inference eligibility.
- AWS Service Quotas exposed applied values and made the zero inference allowances independently observable.
- The initial error identified account verification as a possible restriction.
- Basic Support allowed an account-related case to be opened without upgrading to a paid support plan.
- AWS Support responded, consulted its Bedrock team, and preserved the case correspondence.
- The Support Center permitted the original case to be reopened with additional evidence.

**Areas of Friction**

- Successful authentication and model discovery did not mean that the account could invoke models, but that distinction was not clear during onboarding.
- The first error suggested verification would normally take less than two hours; subsequent requests instead reported daily token exhaustion despite no successful inference.
- Model-specific applied quotas were zero, while displayed default quota values were much higher; the console did not explain the account-specific restriction or a direct path to initial access.
- The Customer Verification page said verification was not required, without clarifying the initial verification error.
- The automated support workflow did not identify a resolution.
- The first human support response took approximately five days and did not resolve the restriction.
- Recommendations to demonstrate high service utilization were difficult to apply to Bedrock inference with an existing allowance of zero.
- Suggested Sales engagement or waiting for another billing cycle did not offer a reliable path within the hackathon timeline.
- The exact cause of the zero quotas, including whether it relates to verification or account eligibility, remained unconfirmed.

**Suggested Improvement**

Provide a Bedrock inference-readiness indicator during account onboarding and model discovery that distinguishes model availability from account-level authorization and effective inference capacity.

When invocation is blocked, return consistent, actionable errors distinguishing account verification, account eligibility, zero quota allocation, and actual token exhaustion. Explain why applied quotas are zero, what prerequisites must be met, and how developers can obtain an initial minimal nonzero development allowance.

For new accounts and time-limited developer programs, provide a clear escalation path and realistic response expectations. If increased account activity or a Sales evaluation is required, specify how that requirement applies when the affected service cannot be used at all.

**Resolution Status**

Unresolved — support case reopened October 21, 2026; awaiting further response.

- October 9, 2026, 10:26 AM MDT: Case 179156319400779 opened.
- October 14, 2026, 12:32 PM MDT: AWS Support responded after approximately five days and relayed Bedrock team recommendations.
- October 21, 2026: Additional zero model-specific quotas observed; Nova Lite inference failed with a daily-token throttling error.
- October 21, 2026, 12:17 PM MDT: Case reopened requesting urgent escalation.

No successful Amazon Bedrock inference request has been confirmed. The cause of the zero quotas and their relationship, if any, to account verification remain unconfirmed.


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

### AF-005 — AWS Infrastructure Setup and Cross-Device Backend Deployment

**Task**

Deploy Threshold's multiplayer session backend to AWS, configure persistent calibration-image storage, secure access to cloud resources, and establish HTTPS communication between physical Fire TV devices and mobile Lens clients.

**Experience:** Positive

**Expected Behavior**

Deploying a custom Node.js application to AWS could require coordination across compute, networking, storage, permissions, remote administration, and application configuration. The goal was to establish a functional cloud backend without introducing unnecessary infrastructure complexity.

**Observed Behavior**

The AWS deployment process was generally straightforward. Amazon EC2 provided a suitable environment for the existing Next.js session service, and AWS Systems Manager enabled remote administration without requiring direct SSH access.

Amazon S3 successfully supported private storage and retrieval of calibration photographs. The IAM instance role allows the EC2 instance to access the required AWS resources without embedding AWS credentials in application code.

AWS Systems Manager Parameter Store also provided encrypted storage for the external AI provider's API key.

After configuring HTTPS through Caddy, physical Fire TV device and mobile Lens client successfully communicated with the deployed backend.

The application completed a real-world calibration workflow: a photograph captured on a phone was uploaded, analyzed using the configured AI provider, presented for object confirmation, and followed by progression into the investigation.

**Steps Performed**

1. Configured AWS CLI authentication and verified account access.
2. Provisioned an Amazon Linux EC2 instance.
3. Installed and configured the Node.js session backend as a systemd service.
4. Configured an EC2 IAM role with permissions for required AWS resources.
5. Created an S3 bucket for private calibration-image storage.
6. Verified image upload, retrieval, and deletion operations.
7. Configured AWS Systems Manager for remote command execution.
8. Established HTTPS access through Caddy and a public hostname.
9. Stored an external AI provider's API key in Systems Manager Parameter Store as a SecureString.
10. Granted the EC2 role permission to retrieve the specific parameter.
11. Deployed the updated backend and verified the public health endpoint.
12. Successfully tested the complete phone-to-cloud calibration workflow.

**Development Impact**

AWS enabled Threshold to move from local development to a functioning cloud-hosted multiplayer experience.

The existing session service required relatively limited architectural changes to operate on EC2. AWS services supported persistent storage, credential management, and remote administration while allowing the application to retain its existing technology stack.

This made it possible to focus development effort on gameplay rather than extensive infrastructure troubleshooting.

**What Worked Well**

- EC2 supported the existing Node.js application without requiring a rewrite.
- Systems Manager provided convenient remote administration and deployment.
- S3 integration worked reliably for calibration-image operations.
- IAM instance-role permissions avoided storing AWS credentials in the application.
- Parameter Store provided a straightforward way to manage an encrypted API credential.
- AWS CLI commands made infrastructure configuration and verification repeatable.
- The deployed backend successfully supported communication between multiple physical devices.
- Existing local development workflows could be preserved alongside cloud deployment.

**Minor Challenges and Lessons Learned**

An initial backend deployment health check ran immediately after restarting the systemd service. The application has not yet started listening, causing the deployment script to initiate a rollback.

The rollback succeeded. After adding a startup polling interval, the same application build deployed successfully.

This was an application deployment-script timing issue rather than a demonstrated defect in an AWS service.

**Suggested Improvement**

No significant AWS-specific improvement was identified during the deployment.

The experience demonstrated that value of clear service documentation, scoped IAM permissions, and Systems Manager-based administration for small application deployments.

**Resolution Status**

Successful — the AWS-hosted backend was operational on October 21, 2026, and the end-to-end calibration workflow was validated on physical devices.

---

### AF-006 — CloudWatch Operational Logging and Failure Monitoring

**Task**

Establish lightweight operational observability for the Threshold session backend while minimizing the collection of sensitive gameplay data and controlling monitoring costs.

**Experience:** Positive

**Expected Behavior**

The backend should emit structured operational events that support troubleshooting without recording raw calibration photographs, private player messages, credentials, or unrestricted AI responses. Operational failures should be observable through AWS monitoring tools.

**Observed Behavior**

A structured operational logging module was introduced to emit an allowlisted set of event fields, including timestamps, severity, event names, durations, object counts, status codes, and approved error codes. Unexpected event names are rejected by automated tests.

The application writes operational events to a dedicated JSON Lines file, with the CloudWatch agent configured to forward this file to the `/threshold/session` log group.

The log group was configured with seven-day retention. The CloudWatch agent was installed and activated on the EC2 instance, and a test event was successfully observed in CloudWatch Logs.

A metric filter was configured to identify `calibration.analysis.failed` events and publish a `CalibrationFailures` metric in the `Threshold` namespace. The `ThresholdCalibrationFailureAlarm` alarm was created with a threshold of one failure.

**Troubleshooting and Validation**

1. Created a dedicated operational log directory and file with restricted filesystem permissions.
2. Configured log rotation to limit local disk usage.
3. Implemented an allowlisted operational logger and automated tests.
4. Deployed the updated application build and verified the backend health endpoint.
5. Installed and configured the CloudWatch agent.
6. Confirmed that a test operational event reached the expected CloudWatch log stream.
7. Created and verified the calibration failure metric filter and alarm.

**Development Impact**

This work established a foundation for diagnosing backend and calibration failures without relying exclusively on manual inspection of system logs. Local log rotation and CloudWatch retention settings also help limit unnecessary storage accumulation.

**What Worked Well**

- Structured operational events provide a consistent troubleshooting format.
- Automated tests verify the approved logging contract.
- CloudWatch Logs centralizes operational events from the EC2 instance.
- Seven-day retention and local log rotation establish explicit storage limits.
- Metric filters and alarms provide a path toward automated failure detection.

**Limitations**

The alarm's existence and configuration were verified, but successful alarm triggering and notification delivery have not been demonstrated. No notification destination has been configured.

The test event verified log ingestion, but it did not independently demonstrate that every application event is emitted and delivered successfully.

**Resolution Status**

Initial logging and monitoring configuration completed on October 21, 2026. Further validation of real failure detection remains optional follow-up work.

---

## Documentation Notes

This log records firsthand development observations rather than comprehensive product evaluations.

Entries describe the specific tasks performed and outcomes observed. Suggested improvements represent developer feedback and are not assertions that a particular feature or capability is universally unavailable.

Additional entries will be added when meaningful Amazon-related experiences arise during continued development and testing.