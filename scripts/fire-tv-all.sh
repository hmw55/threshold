
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/apps/fire-tv"
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
PACKAGE_NAME="com.thresholdtv"
ACTIVITY_NAME="$PACKAGE_NAME/.MainActivity"

ACTION="${1:-}"

if [[ "$ACTION" != "deploy" && "$ACTION" != "launch" ]]; then
    echo "Usage: $0 {deploy|launch}"
    exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
    echo "ERROR: adb is not installed or not on PATH."
    exit 1
fi

mapfile -t DEVICES < <(
    adb devices |
    awk 'NR > 1 && $2 == "device" {print $1}'
)

if [[ ${#DEVICES[@]} -eq 0 ]]; then
    echo "ERROR: No authorized ADB devices connected."
    exit 1
fi

echo "Found ${#DEVICES[@]} connected device(s)."

if [[ "$ACTION" == "deploy" ]]; then
    echo ""
    echo "Building Threshold..."
    (
        cd "$ANDROID_DIR"
        ./gradlew assembleDebug
    )

    if [[ ! -f "$APK_PATH" ]]; then
        echo "ERROR: APK not found at $APK_PATH"
        exit 1
    fi
fi

FAILURES=0

for DEVICE in "${DEVICES[@]}"; do
    echo ""
    echo "[$DEVICE] $ACTION"

    if [[ "$ACTION" == "deploy" ]]; then
        if adb -s "$DEVICE" install -r "$APK_PATH"; then
            echo "[$DEVICE] Installation successful."
        else
            echo "[$DEVICE] Installation FAILED."
            FAILURES=$((FAILURES + 1))
        fi
    else
        if adb -s "$DEVICE" shell am start -n "$ACTIVITY_NAME"; then
            echo "[$DEVICE] Launch command successful."
        else
            echo "[$DEVICE] Launch FAILED."
            FAILURES=$((FAILURES + 1))
        fi
    fi
done

echo ""
if [[ "$FAILURES" -gt 0 ]]; then
    echo "Completed with $FAILURES failure(s)."
    exit 1
fi

echo "All $ACTION operations completed successfully."
