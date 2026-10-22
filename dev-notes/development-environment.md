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

## Local Gemini setup

The session service uses Gemini for calibration-photo interpretation when `GEMINI_API_KEY` is present in the backend process environment. Keep the key outside the repository; never place it in source, committed `.env` files, logs, or examples. A convenient local-only file is:

```bash
mkdir -p ~/.config/threshold
chmod 700 ~/.config/threshold
editor ~/.config/threshold/gemini.env
```

Put only a shell assignment in that file, with the real credential substituted locally:

```bash
GEMINI_API_KEY=your-local-key-goes-here
```

Protect it and launch the backend with the variable exported:

```bash
chmod 600 ~/.config/threshold/gemini.env
cd ~/projects/threshold
set -a
source ~/.config/threshold/gemini.env
set +a
node scripts/dev-session.mjs resume
```

The repository requires Node.js 22 or newer and pnpm 10.18.0 (`corepack pnpm` is acceptable). `resume` preserves existing local expeditions and the SQLite database. Do not use `fresh` during a playtest: `dev:fresh` deletes the designated local expedition SQLite database and starts a clean backend.

Run the Lens in another terminal, using the host computer's LAN or HTTPS address for phones:

```bash
cd ~/projects/threshold
VITE_SESSION_SERVICE_URL=http://localhost:3001 pnpm --filter lens dev --host 0.0.0.0
```

Build and install the Fire TV APK with:

```bash
cd ~/projects/threshold/apps/fire-tv
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

When multiple TVs are connected, select a serial explicitly:

```bash
adb devices
adb -s 10.0.0.239:5555 logcat -c
adb -s 10.0.0.239:5555 logcat -v time -s AndroidRuntime:E ActivityManager:I WindowManager:W
adb -s 10.0.0.29:5555 install -r app/build/outputs/apk/debug/app-debug.apk
```

The named deployment aliases remain available through `pnpm fire-tv:dev monitor` and `pnpm fire-tv:dev bedroom`. To verify Gemini, source the environment, start the backend, and upload a real calibration image through Lens. A successful vision response produces a structured object assessment; an `unverified` result means the key or provider request needs checking. Confirm the key is configured without displaying it (`[ -n "${GEMINI_API_KEY:-}" ] && echo "Gemini key configured" || echo "Gemini key missing"`) in the shell that launches the backend, then inspect timeout/provider errors. Missing credentials or failed AI requests should leave the upload explicitly unverified and keep deterministic gameplay available; never commit the key or change providers to work around it.
