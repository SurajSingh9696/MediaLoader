#!/bin/bash
# Find Node.js and expose it in PATH before Python starts.
# yt-dlp detects JS runtimes by searching PATH for executables named
# 'node', 'deno', 'bun', or 'quickjs'. PATH must be set here (shell level)
# before Python imports yt-dlp - setting os.environ inside Python is too late.

# Render provides Node.js at a non-standard path - find it
NODE_BIN=$(find /opt/render/project/nodes -maxdepth 4 -name "node" -type f 2>/dev/null | head -1)

# Fallback: apt-installed or system node
if [ -z "$NODE_BIN" ]; then
    NODE_BIN=$(which node 2>/dev/null || which nodejs 2>/dev/null)
fi

if [ -n "$NODE_BIN" ]; then
    NODE_DIR=$(dirname "$NODE_BIN")

    # Prepend the node directory to PATH
    export PATH="$NODE_DIR:$PATH"

    # Export the absolute path for Python to read directly
    export YTDLP_NODE_PATH="$NODE_BIN"

    # Try to create a symlink in /usr/local/bin so 'which node' always succeeds
    # (Render may already have this, ignore errors if not permitted)
    if [ ! -f "/usr/local/bin/node" ]; then
        ln -sf "$NODE_BIN" /usr/local/bin/node 2>/dev/null || true
    fi

    echo "[start.sh] Node.js: $NODE_BIN ($(\"$NODE_BIN\" --version 2>&1))"
    echo "[start.sh] PATH now includes: $NODE_DIR"
    echo "[start.sh] which node: $(which node 2>&1)"
else
    echo "[start.sh] WARNING: Node.js not found anywhere - YouTube PO tokens will be unavailable"
fi

exec python -m uvicorn backend.main:app --host 0.0.0.0 --port "$PORT"
