
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/scripts/fire-tv-devices.local.json"
ANDROID_DIR="$ROOT_DIR/apps/fire-tv"
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
PACKAGE_NAME="com.thresholdtv"
ACTIVITY_NAME="$PACKAGE_NAME/.MainActivity"

if ! command -v jq >/dev/null 2>&1; then
    echo "ERROR: jq is required. Install it with: sudo apt install jq"
    exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
    echo "ERROR: adb is not installed or not on PATH."
    exit 1
fi

if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "ERROR: Device configuration not found:"
    echo "$CONFIG_FILE"
    exit 1
fi

mapfile -t DEVICE_NAMES < <(
    jq -r 'keys[]' "$CONFIG_FILE"
)

if [[ ${#DEVICE_NAMES[@]} -eq 0 ]]; then
    echo "ERROR: No devices configured."
    exit 1
fi

DEVICE_NAME="${1:-}"

if [[ -z "$DEVICE_NAME" ]]; then
    echo ""
    echo "Select a Fire TV:"
    echo ""

    for INDEX in "${!DEVICE_NAMES[@]}"; do
        NAME="${DEVICE_NAMES[$INDEX]}"
        DESCRIPTION="$(jq -r --arg name "$NAME" '.[$name].description // ""' "$CONFIG_FILE")"
        printf "  %d) %s — %s\n" "$((INDEX + 1))" "$NAME" "$DESCRIPTION"
    done

    echo ""
    read -r -p "Device number: " SELECTION

    if [[ ! "$SELECTION" =~ ^[0-9]+$ ]] ||
       (( SELECTION < 1 || SELECTION > ${#DEVICE_NAMES[@]} )); then
        echo "ERROR: Invalid selection."
        exit 1
    fi

    DEVICE_NAME="${DEVICE_NAMES[$((SELECTION - 1))]}"
fi

if ! jq -e --arg name "$DEVICE_NAME" 'has($name)' "$CONFIG_FILE" >/dev/null; then
    echo "ERROR: Unknown device '$DEVICE_NAME'."
    exit 1
fi

DEVICE_SERIAL="$(jq -r --arg name "$DEVICE_NAME" '.[$name].serial // ""' "$CONFIG_FILE")"

if [[ -z "$DEVICE_SERIAL" ]]; then
    echo "ERROR: Device '$DEVICE_NAME' has no ADB serial configured."
    exit 1
fi

echo ""
echo "Target: $DEVICE_NAME"

# Network ADB devices may need to reconnect after sleeping.
if [[ "$DEVICE_SERIAL" == *:* ]]; then
    adb connect "$DEVICE_SERIAL" >/dev/null 2>&1 || true
fi

if ! adb devices |
    awk -v serial="$DEVICE_SERIAL" '$1 == serial && $2 == "device" { found=1 } END { exit !found }'; then
    echo "ERROR: '$DEVICE_NAME' is not connected or authorized."
    exit 1
fi

echo "Building Threshold..."

(
    cd "$ANDROID_DIR"
    ./gradlew assembleDebug
)

echo ""
echo "Installing on $DEVICE_NAME..."
adb -s "$DEVICE_SERIAL" install -r "$APK_PATH"

echo ""
echo "Restarting Threshold..."
adb -s "$DEVICE_SERIAL" shell am force-stop "$PACKAGE_NAME"
adb -s "$DEVICE_SERIAL" shell am start -n "$ACTIVITY_NAME"

echo ""
echo "Threshold deployed successfully to $DEVICE_NAME."
