#!/bin/bash
# start.sh - Must set PATH and start bgutil server BEFORE Python/yt-dlp loads.
# yt-dlp detects JS runtimes and POT providers at import time.

# ── 1. Find Node.js (Render installs it at a non-standard path) ──
NODE_BIN=$(find /opt/render/project/nodes -maxdepth 4 -name "node" -type f 2>/dev/null | head -1)
if [ -z "$NODE_BIN" ]; then
    NODE_BIN=$(which node 2>/dev/null || which nodejs 2>/dev/null)
fi

if [ -n "$NODE_BIN" ]; then
    NODE_DIR=$(dirname "$NODE_BIN")
    export PATH="$NODE_DIR:$PATH"
    export YTDLP_NODE_PATH="$NODE_BIN"
    # Symlink so 'which node' works everywhere
    ln -sf "$NODE_BIN" /usr/local/bin/node 2>/dev/null || true
    echo "[start.sh] Node.js: $NODE_BIN ($("$NODE_BIN" --version 2>&1))"

    # ── 2. Start bgutil PO token server for YouTube ──
    # The Python bgutil-ytdlp-pot-provider plugin talks to this server on port 4416.
    BGUTIL_ROOT="/opt/render/project/src/bgutil/node_modules/@yt-dlp/bgutil-ytdlp-pot-provider"
    if [ -d "$BGUTIL_ROOT" ]; then
        # Find the server entry point (dist/server.js or server.js)
        SERVER_JS=$(find "$BGUTIL_ROOT" -name "server.js" -path "*/dist/*" 2>/dev/null | head -1)
        if [ -z "$SERVER_JS" ]; then
            SERVER_JS=$(find "$BGUTIL_ROOT" -name "server.js" 2>/dev/null | head -1)
        fi

        if [ -n "$SERVER_JS" ]; then
            echo "[start.sh] Starting bgutil PO token server: $SERVER_JS"
            "$NODE_BIN" "$SERVER_JS" &
            BGUTIL_PID=$!
            # Wait up to 5 seconds for the server to be ready
            for i in 1 2 3 4 5; do
                sleep 1
                if kill -0 $BGUTIL_PID 2>/dev/null; then
                    echo "[start.sh] bgutil server running (PID: $BGUTIL_PID, port: 4416) after ${i}s"
                    break
                fi
            done
        else
            echo "[start.sh] WARNING: bgutil server.js not found inside $BGUTIL_ROOT"
        fi
    else
        echo "[start.sh] WARNING: bgutil not installed at $BGUTIL_ROOT - YouTube PO tokens unavailable"
    fi
else
    echo "[start.sh] WARNING: Node.js not found - JS runtimes and PO tokens unavailable"
fi

# ── 3. Start the Python application ──
exec python -m uvicorn backend.main:app --host 0.0.0.0 --port "$PORT"
