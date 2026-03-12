#!/bin/bash
# start.sh — Starts uvicorn IMMEDIATELY (so Render's port scan succeeds),
# then sets up Node.js and builds/starts the bgutil PO token server in the
# background concurrently.

# ── 1. Find Node.js ────────────────────────────────────────────────────────
NODE_BIN=$(find /opt/render/project/nodes -maxdepth 4 -name "node" -type f 2>/dev/null | head -1)
[ -z "$NODE_BIN" ] && NODE_BIN=$(which node 2>/dev/null || which nodejs 2>/dev/null)

if [ -n "$NODE_BIN" ]; then
    NODE_DIR=$(dirname "$NODE_BIN")
    NPM_BIN="$NODE_DIR/npm"
    export PATH="$NODE_DIR:$PATH"
    export YTDLP_NODE_PATH="$NODE_BIN"
    ln -sf "$NODE_BIN" /usr/local/bin/node 2>/dev/null || true
    echo "[start.sh] Node.js: $NODE_BIN ($($NODE_BIN --version))"
    echo "[start.sh] npm: $($NPM_BIN --version 2>/dev/null || echo not found)"
else
    echo "[start.sh] WARNING: Node.js not found — bgutil PO token server unavailable"
fi

# ── 2. Start Python/uvicorn FIRST ─────────────────────────────────────────
# Render kills services that don't bind a port within ~60s of starting.
# We start uvicorn immediately so the port opens before bgutil finishes building.
# bgutil is then set up in the background and will be ready within ~60-90s.
echo "[start.sh] Starting uvicorn on port ${PORT}..."
# Guard against missing uvicorn (e.g. venv not activated) by installing inline
python -m uvicorn --version >/dev/null 2>&1 || pip install --quiet "uvicorn[standard]"
python -m uvicorn backend.main:app --host 0.0.0.0 --port "${PORT}" &
UVICORN_PID=$!

# ── 3. Build and start bgutil in the background ───────────────────────────
if [ -n "$NODE_BIN" ]; then
(
    GH_DIR="/opt/render/project/src/bgutil-gh"

    if [ ! -d "$GH_DIR/.git" ]; then
        echo "[start.sh] Cloning bgutil from GitHub..."
        git clone https://github.com/Brainicism/bgutil-ytdlp-pot-provider "$GH_DIR" --depth=1 2>&1
    fi

    REPO_SERVER_DIR="$GH_DIR/server"
    MAIN_JS="$REPO_SERVER_DIR/build/main.js"

    if [ ! -f "$MAIN_JS" ]; then
        echo "[start.sh] Installing bgutil dependencies and compiling TypeScript..."
        (
            cd "$REPO_SERVER_DIR"
            NODE_ENV=development "$NPM_BIN" install 2>&1
            LOCAL_TSC="$REPO_SERVER_DIR/node_modules/.bin/tsc"
            if [ -f "$LOCAL_TSC" ]; then
                echo "[start.sh] Compiling TypeScript with local tsc..."
                "$NODE_BIN" "$LOCAL_TSC" 2>&1
            else
                echo "[start.sh] ERROR: tsc not found in node_modules/.bin"
            fi
        )
    fi

    if [ -f "$MAIN_JS" ]; then
        echo "[start.sh] Starting bgutil server: $MAIN_JS"
        (cd "$REPO_SERVER_DIR" && "$NODE_BIN" "$MAIN_JS") &
        BGUTIL_PID=$!

        READY=0
        for i in $(seq 1 60); do
            sleep 1
            if ! kill -0 $BGUTIL_PID 2>/dev/null; then
                echo "[start.sh] ERROR: bgutil server process died after ${i}s"
                break
            fi
            if curl -sf -o /dev/null -w "%{http_code}" --max-time 2 \
                   -X POST http://localhost:4416/get_pot \
                   -H "Content-Type: application/json" \
                   -d '{}' 2>/dev/null | grep -qE '^[0-9]'; then
                echo "[start.sh] ✅ bgutil server ready on port 4416 (${i}s)"
                READY=1
                break
            fi
        done
        [ $READY -eq 0 ] && echo "[start.sh] WARNING: bgutil not responding on port 4416 after 60s"
    else
        echo "[start.sh] ERROR: Could not build bgutil main.js"
    fi
) &
fi

# ── 4. Wait for uvicorn (the main process) ────────────────────────────────
wait $UVICORN_PID
