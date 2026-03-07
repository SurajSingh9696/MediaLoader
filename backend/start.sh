#!/bin/bash
# start.sh — runs before Python. Sets up Node.js, finds and starts the
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

# ── 2. Find bgutil server.js from the pip-installed package ───────────────
# bgutil-ytdlp-pot-provider pip package bundles the Node.js server.
# Ask Python for the exact package directory - guaranteed accurate.
PKG_DIR=$(python -c "import bgutil_ytdlp_pot_provider; import os; print(os.path.dirname(bgutil_ytdlp_pot_provider.__file__))" 2>/dev/null)

if [ -n "$PKG_DIR" ]; then
    echo "[start.sh] bgutil package dir: $PKG_DIR"
    # Try known locations within the package
    for candidate in \
        "$PKG_DIR/server.js" \
        "$PKG_DIR/pot_server.js" \
        "$PKG_DIR/server/server.js" \
        "$PKG_DIR/dist/server.js"; do
        if [ -f "$candidate" ]; then
            SERVER_JS="$candidate"
            echo "[start.sh] Found server.js: $SERVER_JS"
            break
        fi
    done
    # Broader search inside the package dir
    if [ -z "$SERVER_JS" ]; then
        SERVER_JS=$(find "$PKG_DIR" -name "*.js" 2>/dev/null | head -1)
        [ -n "$SERVER_JS" ] && echo "[start.sh] Found JS file: $SERVER_JS"
    fi
fi

# ── 3. Fallback: clone from GitHub and build ──────────────────────────────
if [ -z "$SERVER_JS" ]; then
    echo "[start.sh] bgutil server not found in pip package, cloning from GitHub..."
    BGUTIL_DIR="/opt/render/project/src/bgutil"
    if [ ! -d "$BGUTIL_DIR/.git" ]; then
        git clone https://github.com/Brainicism/bgutil-ytdlp-pot-provider "$BGUTIL_DIR" --depth=1 2>&1
    fi
    if [ -d "$BGUTIL_DIR" ]; then
        echo "[start.sh] Installing bgutil npm deps..."
        "$NPM_BIN" install --prefix "$BGUTIL_DIR" 2>&1
        SERVER_JS=$(find "$BGUTIL_DIR" -name "server.js" -path "*/dist/*" 2>/dev/null | head -1)
        [ -z "$SERVER_JS" ] && SERVER_JS=$(find "$BGUTIL_DIR" -name "server.js" 2>/dev/null | head -1)
        [ -n "$SERVER_JS" ] && echo "[start.sh] GitHub server.js: $SERVER_JS"
    fi
fi

# ── 4. Start bgutil server if found ───────────────────────────────────────
if [ -n "$SERVER_JS" ]; then
    echo "[start.sh] Starting bgutil server: $SERVER_JS"
    "$NODE_BIN" "$SERVER_JS" &
    BGUTIL_PID=$!

    # Wait up to 10s for port 4416 to open
    READY=0
    for i in $(seq 1 10); do
        sleep 1
        if ! kill -0 $BGUTIL_PID 2>/dev/null; then
            echo "[start.sh] ERROR: bgutil server process died after ${i}s"
            break
        fi
        if (echo > /dev/tcp/localhost/4416) 2>/dev/null; then
            echo "[start.sh] ✅ bgutil server ready on port 4416 (${i}s)"
            READY=1
            break
        fi
    done
    [ $READY -eq 0 ] && echo "[start.sh] WARNING: bgutil not responding on port 4416 after 10s"
else
    echo "[start.sh] ERROR: Could not find bgutil server.js anywhere - YouTube PO tokens unavailable"
fi

# ── 5. Start Python application ────────────────────────────────────────────
exec python -m uvicorn backend.main:app --host 0.0.0.0 --port "$PORT"
