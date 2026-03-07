#!/bin/bash
# start.sh — Sets up Node.js, installs and starts the bgutil PO token server,
# then launches uvicorn.

# ── 1. Find Node.js ────────────────────────────────────────────────────────
NODE_BIN=$(find /opt/render/project/nodes -maxdepth 4 -name "node" -type f 2>/dev/null | head -1)
[ -z "$NODE_BIN" ] && NODE_BIN=$(which node 2>/dev/null || which nodejs 2>/dev/null)

if [ -z "$NODE_BIN" ]; then
    echo "[start.sh] ERROR: Node.js not found"
    exec python -m uvicorn backend.main:app --host 0.0.0.0 --port "$PORT"
fi

NODE_DIR=$(dirname "$NODE_BIN")
NPM_BIN="$NODE_DIR/npm"
export PATH="$NODE_DIR:$PATH"
export YTDLP_NODE_PATH="$NODE_BIN"
ln -sf "$NODE_BIN" /usr/local/bin/node 2>/dev/null || true
echo "[start.sh] Node.js: $NODE_BIN ($($NODE_BIN --version))"
echo "[start.sh] npm: $($NPM_BIN --version 2>/dev/null || echo not found)"

# ── 2. Clone and Build from GitHub ─────────────────────────────────────────
echo "[start.sh] Setting up bgutil from GitHub..."
GH_DIR="/opt/render/project/src/bgutil-gh"

if [ ! -d "$GH_DIR/.git" ]; then
    git clone https://github.com/Brainicism/bgutil-ytdlp-pot-provider "$GH_DIR" --depth=1 2>&1
fi

REPO_SERVER_DIR="$GH_DIR/server"
MAIN_JS="$REPO_SERVER_DIR/build/main.js"

if [ ! -f "$MAIN_JS" ]; then
    echo "[start.sh] Installing dependencies and compiling TypeScript..."
    (
        cd "$REPO_SERVER_DIR"
        # NODE_ENV=development ensures devDependencies (typescript) are installed
        NODE_ENV=development "$NPM_BIN" install 2>&1
        # Use the locally-installed tsc — NOT npx (which ignores node_modules/.bin)
        LOCAL_TSC="$REPO_SERVER_DIR/node_modules/.bin/tsc"
        if [ -f "$LOCAL_TSC" ]; then
            echo "[start.sh] Compiling TypeScript with local tsc..."
            "$NODE_BIN" "$LOCAL_TSC" 2>&1
        else
            echo "[start.sh] ERROR: tsc not found in node_modules/.bin"
            ls node_modules/.bin/ 2>/dev/null | grep -i tsc || true
        fi
    )
fi

# ── 3. Start bgutil server ─────────────────────────────────────────────────
if [ -f "$MAIN_JS" ]; then
    echo "[start.sh] Starting bgutil server: $MAIN_JS"
    (cd "$REPO_SERVER_DIR" && "$NODE_BIN" "$MAIN_JS") &
    BGUTIL_PID=$!

    # Wait up to 45s for bgutil to respond to an actual HTTP probe.
    # Prefer curl; fall back to nc/TCP if unavailable.
    READY=0
    for i in $(seq 1 45); do
        sleep 1
        if ! kill -0 $BGUTIL_PID 2>/dev/null; then
            echo "[start.sh] ERROR: bgutil server process died after ${i}s"
            break
        fi
        # Probe with curl (ignores bad JSON reply, just needs HTTP response)
        if curl -sf -o /dev/null -w "%{http_code}" --max-time 2 \
               -X POST http://localhost:4416/get_pot \
               -H "Content-Type: application/json" \
               -d '{}' 2>/dev/null | grep -qE '^[0-9]'; then
            echo "[start.sh] ✅ bgutil server ready on port 4416 (${i}s)"
            READY=1
            break
        fi
    done
    [ $READY -eq 0 ] && echo "[start.sh] WARNING: bgutil not responding on port 4416 after 45s"
else
    echo "[start.sh] ERROR: Could not build or locate bgutil main.js"
    echo "[start.sh] Contents of $REPO_SERVER_DIR:"
    ls "$REPO_SERVER_DIR/" 2>/dev/null
fi

# ── 4. Start Python application ────────────────────────────────────────────
exec python -m uvicorn backend.main:app --host 0.0.0.0 --port "$PORT"
