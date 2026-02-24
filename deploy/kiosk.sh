#!/bin/bash
# Launch Chromium in kiosk mode for the Homelab Monitor dashboard.
# Intended to run on a Raspberry Pi after boot.
#
# Usage: ./kiosk.sh [URL]
#   Default URL: http://localhost:3000

URL="${1:-http://localhost:3000}"

# Disable screen blanking
xset s off
xset -dpms
xset s noblank

# Hide the mouse cursor after 3 seconds of inactivity
unclutter -idle 3 -root &

# Wait briefly for the server to start
sleep 2

# Launch Chromium in kiosk mode
chromium-browser \
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
