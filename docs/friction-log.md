# Threshold — Friction Log

This log records both friction points and positive developer experiences encountered while building Threshold. Positive entries identify workflows that were particularly clear or effective, while friction entries document obstacles, workarounds, and opportunities for improvement.

## Amazon-Related Friction

Issues specifically involving Amazon products, services, documentation, SDKs, APIs, Fire TV behavior, AWS services, or Amazon development workflows.

### Negative Experiences

_No negative Amazon-related experiences documented yet._

### Mixed Experiences

_No mixed Amazon-related experiences documented yet._

### Positive Experiences

#### AF-001 — Physical Fire TV Development Setup

**Task**  
Configure a physical Fire TV Stick for local development and deploy the first Threshold build.

**Experience**  
Positive.

**Steps**
1. Enabled Developer Options from the Fire TV settings.
2. Enabled ADB debugging.
3. Located the Fire TV on the local network.
4. Connected to the device using ADB.
5. Installed the Threshold debug APK.
6. Launched Threshold directly on the physical Fire TV.

**Expected**  
Physical-device setup and sideloading might require additional Amazon-specific tooling or a more involved registration process.

**Actual**  
The process was straightforward. Developer Mode was easy to enable, ADB connected directly over the local network, and the locally compiled APK could be installed and launched without requiring publication or additional deployment infrastructure.

**Impact**  
Positive — no meaningful friction encountered. The straightforward setup enabled physical-device testing very early in development.

**What Worked Well**  
The ability to move quickly from a local Android build to a functioning application on real Fire TV hardware made early device validation practical.

**Suggested Improvement**  
No significant workflow improvement identified during initial device setup.

---

## Developer Friction

General development and tooling issues encountered while building Threshold that are not directly attributable to Amazon products or services.

### DF-001 — React Native Monorepo and Android Build Tooling

**Task**  
Establish the initial Fire TV client using React Native and TypeScript within the Threshold pnpm monorepo.

**Steps**
1. Scaffolded a React Native 0.82.1 application.
2. Integrated the generated application into the existing pnpm workspace.
3. Attempted to build the generated Android application with Gradle.
4. Diagnosed React Native Gradle plugin resolution failures caused by the workspace dependency layout.
5. Explicitly added `@react-native/gradle-plugin` to the Fire TV workspace and restored plugin resolution.
6. Retried the Android build.

**Expected**  
The generated React Native Android project would compile after being incorporated into the monorepo with minimal configuration.

**Actual**  
The generated Gradle configuration initially expected `@react-native/gradle-plugin` at a location that was not exposed by the pnpm workspace. After correcting plugin resolution, the build encountered an additional JVM/Gradle toolchain compatibility failure involving `JvmVendorSpec.IBM_SEMERU`.

**Severity**  
Medium — no application code was lost, but the tooling issues consumed development time before any Fire TV functionality could be tested.

**Workaround**  
Replaced the React Native Fire TV client with a minimal native Android/Kotlin application. The Kotlin client compiled successfully and was installed and launched on a physical Fire TV Stick through ADB.

**Suggested Improvement**  
For time-constrained Fire TV development, validate the complete framework-to-device build pipeline before implementing application functionality. When using React Native inside a pnpm monorepo, explicitly verify Gradle plugin resolution and JVM/Gradle compatibility before committing to the framework.