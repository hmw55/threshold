#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"

case "$MODE" in
  local)
    FIRE_TV_URL="http://10.0.0.37:3001"
    LENS_URL="https://pulse-engage-born-photos.trycloudflare.com"
    ;;
  aws)
    FIRE_TV_URL="https://threshold-game.duckdns.org"
    LENS_URL="https://threshold-game.duckdns.org"
    ;;
  *)
    echo "Usage: ./scripts/use-environment.sh {local|aws}"
    exit 1
    ;;
esac

FIRE_TV_CONFIG="apps/fire-tv/local.properties"
LENS_CONFIG="apps/lens/.env.local"

if [[ ! -f "$FIRE_TV_CONFIG" ]]; then
  echo "Missing $FIRE_TV_CONFIG"
  exit 1
fi

# Preserve all other Android local.properties settings.
if grep -q '^SESSION_SERVICE_URL=' "$FIRE_TV_CONFIG"; then
  sed -i "s|^SESSION_SERVICE_URL=.*|SESSION_SERVICE_URL=$FIRE_TV_URL|" "$FIRE_TV_CONFIG"
else
  printf '\nSESSION_SERVICE_URL=%s\n' "$FIRE_TV_URL" >> "$FIRE_TV_CONFIG"
fi

# Preserve unrelated Vite environment settings.
touch "$LENS_CONFIG"

if grep -q '^VITE_SESSION_SERVICE_URL=' "$LENS_CONFIG"; then
  sed -i "s|^VITE_SESSION_SERVICE_URL=.*|VITE_SESSION_SERVICE_URL=$LENS_URL|" "$LENS_CONFIG"
else
  printf '\nVITE_SESSION_SERVICE_URL=%s\n' "$LENS_URL" >> "$LENS_CONFIG"
fi

echo "Threshold environment: $MODE"
echo "Fire TV: $FIRE_TV_URL"
echo "Lens:    $LENS_URL"
