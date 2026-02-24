#!/bin/bash
# Launch Chromium in kiosk mode for the Homelab Monitor dashboard.
# Intended to run on a Raspberry Pi after boot.
#
# Usage: ./kiosk.sh [URL]
#   Default URL: http://localhost:3000

URL="${1:-http://localhost:8879}"

# Set display if not already set (for running via SSH)
export DISPLAY="${DISPLAY:-:0}"

# Disable screen blanking (ignore errors if no display yet)
xset s off 2>/dev/null
xset -dpms 2>/dev/null
xset s noblank 2>/dev/null

# Hide the mouse cursor after 3 seconds of inactivity
if command -v unclutter &> /dev/null; then
  unclutter -idle 3 -root &
fi

# Wait briefly for the server to start
sleep 2

# Launch Chromium in kiosk mode (try different command names)
CHROMIUM_CMD=""
for cmd in chromium chromium-browser google-chrome; do
  if command -v "$cmd" &> /dev/null; then
    CHROMIUM_CMD="$cmd"
    break
  fi
done

if [ -z "$CHROMIUM_CMD" ]; then
  echo "Error: No Chromium/Chrome browser found. Install with: sudo apt install chromium"
  exit 1
fi

"$CHROMIUM_CMD" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-restore-session-state \
  --disable-session-crashed-bubble \
  --disable-features=TranslateUI \
  --check-for-update-interval=604800 \
  --no-first-run \
  --start-fullscreen \
  --autoplay-policy=no-user-gesture-required \
  "$URL"
