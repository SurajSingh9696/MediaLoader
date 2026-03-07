#!/bin/bash
# start.sh — runs before Python. Sets up Node.js, installs and starts the
# bgutil PO token server, then hands off to uvicorn.

# ── 1. Find Node.js ────────────────────────────────────────────────────────
NODE_BIN=$(find /opt/render/project/nodes -maxdepth 4 -name "node" -type f 2>/dev/null | head -1)
[ -z "$NODE_BIN" ] && NODE_BIN=$(which node 2>/dev/null || which nodejs 2>/dev/null)

if [ -z "$NODE_BIN" ]; then
    echo "[start.sh] ERROR: Node.js not found - YouTube PO tokens unavailable"
    exec python -m uvicorn backend.main:app --host 0.0.0.0 --port "$PORT"
fi

NODE_DIR=$(dirname "$NODE_BIN")
NPM_BIN="$NODE_DIR/npm"
export PATH="$NODE_DIR:$PATH"
export YTDLP_NODE_PATH="$NODE_BIN"
ln -sf "$NODE_BIN" /usr/local/bin/node 2>/dev/null || true
echo "[start.sh] Node.js: $NODE_BIN ($($NODE_BIN --version))"
echo "[start.sh] npm: $($NPM_BIN --version 2>/dev/null || echo 'not found')"

# ── 2. Install bgutil if not already present ───────────────────────────────
BGUTIL_DIR="/opt/render/project/src/bgutil"
BGUTIL_PKG="$BGUTIL_DIR/node_modules/@yt-dlp/bgutil-ytdlp-pot-provider"

if [ ! -d "$BGUTIL_PKG" ]; then
    echo "[start.sh] Installing bgutil PO token provider (first run after deploy)..."
    mkdir -p "$BGUTIL_DIR"
    "$NPM_BIN" install --prefix "$BGUTIL_DIR" @yt-dlp/bgutil-ytdlp-pot-provider 2>&1
    if [ $? -eq 0 ]; then
        echo "[start.sh] bgutil installed successfully"
    else
        echo "[start.sh] ERROR: bgutil install failed"
    fi
else
    echo "[start.sh] bgutil already installed"
fi

# ── 3. Start bgutil server ─────────────────────────────────────────────────
SERVER_JS=$(find "$BGUTIL_PKG" -name "server.js" -path "*/dist/*" 2>/dev/null | head -1)
[ -z "$SERVER_JS" ] && SERVER_JS=$(find "$BGUTIL_PKG" -name "server.js" 2>/dev/null | head -1)

if [ -n "$SERVER_JS" ]; then
    echo "[start.sh] Starting bgutil server: $SERVER_JS"
    "$NODE_BIN" "$SERVER_JS" &
    BGUTIL_PID=$!

    # Wait up to 10s for the server to start listening on port 4416
    READY=0
    for i in $(seq 1 10); do
        sleep 1
        if ! kill -0 $BGUTIL_PID 2>/dev/null; then
            echo "[start.sh] ERROR: bgutil server process died"
            break
        fi
        if (echo > /dev/tcp/localhost/4416) 2>/dev/null; then
            echo "[start.sh] ✅ bgutil server ready on port 4416 (after ${i}s)"
            READY=1
            break
        fi
    done
    [ $READY -eq 0 ] && echo "[start.sh] WARNING: bgutil server not responding on port 4416 after 10s"
else
    echo "[start.sh] ERROR: bgutil server.js not found - YouTube PO tokens unavailable"
fi

# ── 4. Start Python application ────────────────────────────────────────────
exec python -m uvicorn backend.main:app --host 0.0.0.0 --port "$PORT"
