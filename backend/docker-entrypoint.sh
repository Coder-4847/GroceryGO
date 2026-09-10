#!/bin/sh
# Start a virtual X display, verify it, then hand off to the server.
# Node still starts (and binds its port) even if the display fails — the browser
# only needs it later, when a scrape runs — but we log loudly either way.

XVFB_DISPLAY="${DISPLAY:-:99}"
export DISPLAY="$XVFB_DISPLAY"
SOCKET="/tmp/.X11-unix/X${XVFB_DISPLAY#:}"

mkdir -p /tmp/.X11-unix 2>/dev/null || true
chmod 1777 /tmp/.X11-unix 2>/dev/null || true
rm -f "$SOCKET" "/tmp/.X${XVFB_DISPLAY#:}-lock" 2>/dev/null || true

echo "[entrypoint] starting Xvfb on $XVFB_DISPLAY"
Xvfb "$XVFB_DISPLAY" -screen 0 1280x800x24 -nolisten tcp -ac > /tmp/xvfb.log 2>&1 &
XVFB_PID=$!

i=0
while [ "$i" -lt 30 ]; do
  if [ -S "$SOCKET" ]; then
    echo "[entrypoint] Xvfb ready on $XVFB_DISPLAY (pid $XVFB_PID)"
    break
  fi
  if ! kill -0 "$XVFB_PID" 2>/dev/null; then
    echo "[entrypoint] !! Xvfb exited early. Log:"
    cat /tmp/xvfb.log 2>/dev/null || true
    break
  fi
  i=$((i + 1))
  sleep 0.2
done
[ -S "$SOCKET" ] || echo "[entrypoint] !! Xvfb socket never appeared — scrapers will fail until this is fixed"

exec node src/server.js
