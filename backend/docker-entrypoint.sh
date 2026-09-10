#!/bin/sh
# Start a virtual X display in the background, then hand off to the server.
# Backgrounding Xvfb (instead of wrapping with `xvfb-run`) means Node starts and
# binds its port immediately even if the display is slow or unavailable — the
# browser only needs the display later, when a scrape actually runs.

mkdir -p /tmp/.X11-unix 2>/dev/null || true
chmod 1777 /tmp/.X11-unix 2>/dev/null || true

XVFB_DISPLAY="${DISPLAY:-:99}"
export DISPLAY="$XVFB_DISPLAY"

Xvfb "$XVFB_DISPLAY" -screen 0 1366x900x24 -nolisten tcp -ac +extension GLX +render -noreset \
  > /tmp/xvfb.log 2>&1 &

# Brief, non-blocking wait for the display socket to appear.
i=0
while [ "$i" -lt 10 ]; do
  if [ -e "/tmp/.X11-unix/X${XVFB_DISPLAY#:}" ]; then
    break
  fi
  i=$((i + 1))
  sleep 0.3
done

exec node src/server.js
