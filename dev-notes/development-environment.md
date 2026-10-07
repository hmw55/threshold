# Development Environment

## Primary Development Environments

Threshold is primarily developed from Linux environments:

- WSL on Windows 11
- Arch Linux

Commands and development instructions should assume a Linux shell unless otherwise documented.

## GitHub Actions Usage

Threshold is maintained in a private GitHub repository.

GitHub-hosted Actions minutes for private repositories are limited. Local development should therefore be the default for:

- linting
- typechecking
- unit tests
- builds
- integration tests where practical

Do not use GitHub Actions as the primary development/test loop.

Before pushing changes, run the relevant checks locally from WSL or Arch Linux.

GitHub Actions should be reserved primarily for validating meaningful pushes and pull requests rather than repeatedly running workflows during active development.

## Development Principle

Local Linux environment -> test locally -> commit -> push -> CI verification

Not:

edit -> push -> wait for CI -> fix -> push -> repeat

## Platform Considerations

The Fire TV application ultimately targets Fire OS, so platform-specific testing must still be performed against the Fire TV development environment, emulator, or physical Fire TV hardware as appropriate.

Linux compatibility does not replace testing on the actual target device.

## Fire TV Development

Threshold's Fire TV client is a native Android application written in Kotlin.

### Local Toolchain

- OpenJDK 21
- Gradle 8.13 via project Gradle Wrapper
- Android SDK Platform 35
- Android Build Tools 35.0.0
- Android Platform Tools / ADB
- Kotlin 2.0.21
- Android Gradle Plugin 8.9.1

### Target

- Fire OS 7
- Android 9 / API 28 compatibility
- `minSdk 28`
- `compileSdk 35`
- `targetSdk 35`

### Physical Device Workflow

Build:

`cd apps/fire-tv && ./gradlew assembleDebug`

APK:

`apps/fire-tv/app/build/outputs/apk/debug/app-debug.apk`

Physical Fire TV devices are connected over the local network using ADB. Debug APKs can be installed directly for development and testing without publishing the application.

The initial native Android build was successfully compiled, installed, and launched on physical Fire TV hardware.