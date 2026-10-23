# Fire TV — Native Android Client

Threshold's television client is a **native Android/Kotlin application** (`com.thresholdtv`). It displays public expedition state and accepts Fire TV remote input; shared game rules and persistent state are owned by the [session backend](../../services/session/README.md).

## Requirements and supported platform

- JDK 21, Android SDK Platform 35, Android Build Tools 35.0.0 and platform-tools (`adb`).
- Gradle **8.13** via checked-in wrapper, Android Gradle Plugin **8.9.1**, Kotlin **2.0.21**.
- `compileSdk 35`, `targetSdk 35`, **`minSdk 25`** (the earlier `minSdk 28` documentation is outdated).
- Physical Fire TV with developer options and ADB debugging enabled; Fire OS 6 installation/launch and Fire OS 7 development were tested, but full compatibility across all models is not guaranteed.

## Recommended interactive deployment

From the repository root, use `pnpm dev:demo` for the full backend/Lens/optional Cloudflare HTTPS setup plus selected-TV deployment. Use `pnpm fire-tv:demo` to select and redeploy one or more Fire TVs without starting the Lens or Cloudflare. The wizard stores device aliases in the ignored `scripts/fire-tv-devices.local.json`, builds the APK once, and installs/launches it on the selected TVs.

The wizard asks for a **TV-reachable backend address**, which may differ from the temporary HTTPS Cloudflare URL used to open Lens on phones. Both must lead to the **same session backend**. On WSL2, a Windows LAN IP alone may not make WSL port 3001 reachable; check Windows firewall/forwarding or mirrored networking. Use the manual steps below for troubleshooting.

## Build a debug APK

```bash
cd /path/to/threshold/apps/fire-tv
./gradlew assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

`./gradlew lint` and `./gradlew test` can be used when supported by the configured project; always verify on physical hardware, including remote focus/Back behavior.

## Configure the backend URL **before building**

Create/edit `apps/fire-tv/local.properties` (not committed):

```properties
sdk.dir=/home/YOUR_USER/Android/Sdk
SESSION_SERVICE_URL=http://192.168.1.100:3001
```

Use your Android SDK path and a backend URL the **TV can reach**. `app/build.gradle.kts` injects this value into `BuildConfig.SESSION_SERVICE_URL`; its fallback is `http://localhost:3001`, which normally **does not work on a physical TV**. Changing the URL requires rebuilding/reinstalling. If using an HTTPS cloud backend, set its actual reachable HTTPS URL instead.

## Add a new Fire TV from scratch

1. Connect TV and development computer to the appropriate network. In Fire TV Settings, reveal/enable Developer Options (menu placement varies by model) and enable ADB debugging.
2. Find the TV's current IP address in network settings. From Linux/WSL run `adb connect TV_IP:5555` and accept the authorization prompt on the TV.
3. Verify `adb devices` shows `TV_IP:5555` with status **`device`**. `unauthorized` requires approval; `offline` may require reconnecting/waking the TV.
4. Configure `apps/fire-tv/local.properties` as above, then build and install:

```bash
cd /path/to/threshold/apps/fire-tv
./gradlew assembleDebug
adb -s TV_IP:5555 install -r app/build/outputs/apk/debug/app-debug.apk
adb -s TV_IP:5555 shell am start -n com.thresholdtv/.MainActivity
```

5. Start the backend (`pnpm dev:resume` from root) and verify `/health` from the network. Use the TV to create a new expedition or join an existing one. For multi-TV play, register additional TVs using the **same expedition code**, not independent sessions.
6. Verify each TV has its own stable app device identity and that the backend shows the intended Threshold registrations; do not reuse an Android app data image/device ID across physical TVs.
7. Test D-pad navigation, Select, Back, reconnection after app restart, and return-to-lobby/results on actual remotes.

## Named device aliases (optional)

From repository root, create **ignored** `scripts/fire-tv-devices.local.json`:

```json
{
  "living-room": {"serial":"192.168.1.50:5555","description":"Living room TV"},
  "office": {"serial":"192.168.1.51:5555","description":"Office TV"}
}
```

```bash
adb connect 192.168.1.50:5555
pnpm fire-tv:dev living-room   # build, install, force-stop, relaunch
pnpm fire-tv:dev               # interactive selection (requires jq)
pnpm fire-tv:deploy:all        # installs to ALL authorized ADB devices
pnpm fire-tv:launch:all        # launches on ALL authorized ADB devices
```

Named aliases are only for deployment convenience, **not** in-game Threshold zone selection. See [scripts reference](../../scripts/README.md). The `:all` commands enumerate every authorized connected Android device, so disconnect unrelated devices.

## Source map

- `app/src/main/java/com/thresholdtv/MainActivity.kt`: Android activity and input integration.
- `.../session/SessionClient.kt`: backend HTTP communication.
- `.../session/SessionController.kt`: client-side session coordination.
- `.../session/ThresholdState.kt`: television state representation.
- `.../ui/screens/`: Home, Join, Lobby, Calibration, Ready, Opening Briefing, Expedition and Results screens.
- `.../ui/components/`: terminal, glitch, surveillance monitor, remote-focused UI components.
- `app/build.gradle.kts`: Android SDK targets and backend BuildConfig URL.

## Remote control and multi-TV debugging

Use `adb -s SERIAL` whenever more than one TV is connected:

```bash
adb devices
adb -s TV_IP:5555 logcat -c
adb -s TV_IP:5555 logcat -v time -s AndroidRuntime:E ActivityManager:I WindowManager:W
adb -s TV_IP:5555 shell am force-stop com.thresholdtv
adb -s TV_IP:5555 shell am start -n com.thresholdtv/.MainActivity
```

The app uses physical remote navigation; a successful APK build does not prove that D-pad focus, monitor selection, Back handling or completed-game exit work. Test with a remote, including the 2×2 monitor grid and multiple TVs in the same expedition.

## Troubleshooting

| Symptom | Check |
|---|---|
| `adb` cannot connect | TV IP, ADB debugging, same network, firewall, wake state |
| `unauthorized` | Accept device authorization on TV; reconnect |
| APK won't install on older Fire OS | Confirm `minSdk 25` and inspect `adb install` error |
| App launches but backend unavailable | `SESSION_SERVICE_URL`, rebuild, server `/health`, firewall, HTTPS certificate |
| Multiple TVs behave like one | Confirm distinct device IDs, separate ADB serials and same session code |
| Stale session on launch | Inspect restoration/leave flow and backend session state before clearing app data |
| Remote selection fails | Physical focus and activity key dispatch; collect logcat and reproduction steps |
| Changes not visible | Rebuild/install (`pnpm fire-tv:dev alias`); `launch:all` only launches |

For full environment setup, consult [development environment](../../dev-notes/development-environment.md). For phase transitions, see [session lifecycle](../../docs/session-lifecycle.md).
