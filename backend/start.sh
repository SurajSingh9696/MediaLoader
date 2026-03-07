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

# ── 2. Install bgutil npm package (correct unscoped name) ─────────────────
# The server is the npm package 'bgutil-ytdlp-pot-provider' (NOT @yt-dlp/...).
# We install it into a dedicated dir using a minimal package.json.
BGUTIL_DIR="/opt/render/project/src/bgutil-npm"
SERVER_JS=""

# Re-use existing install if dist/server.js is present
if [ -f "$BGUTIL_DIR/node_modules/bgutil-ytdlp-pot-provider/dist/server.js" ]; then
    SERVER_JS="$BGUTIL_DIR/node_modules/bgutil-ytdlp-pot-provider/dist/server.js"
    echo "[start.sh] bgutil already installed: $SERVER_JS"
else
    echo "[start.sh] Installing bgutil-ytdlp-pot-provider npm package..."
    mkdir -p "$BGUTIL_DIR"
    echo '{"private":true}' > "$BGUTIL_DIR/package.json"
    (cd "$BGUTIL_DIR" && "$NPM_BIN" install bgutil-ytdlp-pot-provider --save 2>&1)
    # Find server.js under the installed package
    SERVER_JS=$(find "$BGUTIL_DIR/node_modules/bgutil-ytdlp-pot-provider" -name "server.js" 2>/dev/null | grep -v '__tests__' | head -1)
    if [ -n "$SERVER_JS" ]; then
        echo "[start.sh] bgutil installed: $SERVER_JS"
    else
        echo "[start.sh] npm install may have failed; listing node_modules..."
        ls "$BGUTIL_DIR/node_modules/" 2>/dev/null | head -20
    fi
fi

# ── 3. Fallback: clone from GitHub ────────────────────────────────────────
if [ -z "$SERVER_JS" ]; then
    echo "[start.sh] Trying GitHub clone fallback..."
    GH_DIR="/opt/render/project/src/bgutil-gh"
    if [ ! -d "$GH_DIR/.git" ]; then
        git clone https://github.com/Brainicism/bgutil-ytdlp-pot-provider "$GH_DIR" --depth=1 2>&1
    fi
    if [ -d "$GH_DIR" ]; then
        echo "[start.sh] Cloned repo top-level files:"
        ls "$GH_DIR/" 2>/dev/null

        # Find any package.json (excluding node_modules)
        REPO_PKG=$(find "$GH_DIR" -name "package.json" -not -path "*/node_modules/*" 2>/dev/null | head -1)
        echo "[start.sh] package.json location: ${REPO_PKG:-none found}"

        if [ -n "$REPO_PKG" ]; then
            REPO_ROOT=$(dirname "$REPO_PKG")
            echo "[start.sh] npm install in: $REPO_ROOT"
            (cd "$REPO_ROOT" && "$NPM_BIN" install --production 2>&1)
            # Build TypeScript if dist doesn't exist
            if [ -f "$REPO_ROOT/tsconfig.json" ] && [ ! -d "$REPO_ROOT/dist" ]; then
                echo "[start.sh] Building TypeScript..."
                (cd "$REPO_ROOT" && "$NPM_BIN" run build 2>&1) || true
            fi
            SERVER_JS=$(find "$REPO_ROOT" -name "server.js" -not -path "*/node_modules/*" 2>/dev/null | head -1)
            [ -n "$SERVER_JS" ] && echo "[start.sh] GitHub server.js: $SERVER_JS"
        else
            echo "[start.sh] No package.json in repo - listing all files:"
            find "$GH_DIR" -not -path "*/.git/*" -type f 2>/dev/null | head -30
        fi
    fi
fi

# ── 4. Start bgutil server if found ───────────────────────────────────────
if [ -n "$SERVER_JS" ]; then
    echo "[start.sh] Starting bgutil server: $SERVER_JS"
    "$NODE_BIN" "$SERVER_JS" &
    BGUTIL_PID=$!

    READY=0
    for i in $(seq 1 15); do
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
    [ $READY -eq 0 ] && echo "[start.sh] WARNING: bgutil not responding on port 4416 after 15s"
else
    echo "[start.sh] ERROR: Could not locate bgutil server.js"
fi

# ── 5. Start Python application ────────────────────────────────────────────
exec python -m uvicorn backend.main:app --host 0.0.0.0 --port "$PORT"
