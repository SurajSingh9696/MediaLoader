import logging
import os
import shutil
import socket
from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import yt_dlp

from backend.core.config import settings
from backend.routers import metadata, download

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)

logger = logging.getLogger(__name__)

Path(settings.temp_download_dir).mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="MediaLoader Media Engine",
    version="1.0.0",
    description="yt-dlp powered media extraction and download microservice",
)


@app.on_event("startup")
async def startup_event():
    """Log system information on startup."""
    ytdlp_version = yt_dlp.version.__version__
    logger.info(f"🚀 MediaLoader Media Engine started")
    logger.info(f"📦 yt-dlp version: {ytdlp_version}")
    logger.info(f"📁 Temp directory: {settings.temp_download_dir}")
    logger.info(f"🌐 Allowed origins: {settings.allowed_origins}")
    
    # Check for JavaScript runtimes (required for YouTube PO Token generation)
    js_runtimes = []
    for runtime in ["node", "deno", "bun", "quickjs"]:
        if shutil.which(runtime):
            js_runtimes.append(runtime)
    
    if js_runtimes:
        logger.info(f"✅ JavaScript runtimes available: {', '.join(js_runtimes)} (enables YouTube PO Token support)")
    else:
        logger.warning(f"⚠️  No JavaScript runtime detected. YouTube PO Token generation unavailable.")
        logger.warning(f"   Install Node.js to enable: curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs")

    # Check if bgutil PO token server is running on port 4416
    bgutil_running = False
    try:
        with socket.create_connection(("localhost", 4416), timeout=1):
            bgutil_running = True
            logger.info("✅ bgutil PO token server is running on port 4416 (YouTube PO tokens enabled)")
    except (ConnectionRefusedError, OSError):
        logger.warning("⚠️  bgutil PO token server not running on port 4416 - YouTube PO tokens unavailable")
        logger.warning("   Ensure start.sh started the bgutil server before Python")

    # Test bgutil server can actually generate a PO token (not just that the port is open)
    if bgutil_running:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                # bgutil has no root route; probe /get_pot to verify it's the right server
                resp = await client.post("http://localhost:4416/get_pot", json={})
                logger.info(f"bgutil /get_pot probe: HTTP {resp.status_code}")
        except Exception as e:
            logger.warning(f"bgutil probe failed: {e}")

    # YouTube authentication status
    if os.environ.get("YOUTUBE_OAUTH2_TOKEN"):
        logger.info("✅ YOUTUBE_OAUTH2_TOKEN set — OAuth2 auth enabled (works from any IP)")
    elif os.environ.get("YOUTUBE_COOKIES"):
        logger.warning("⚠️  Using YOUTUBE_COOKIES (session cookies). May still fail on cloud IPs.")
        logger.warning("   For reliable YouTube support, use YOUTUBE_OAUTH2_TOKEN instead.")
    else:
        logger.warning("⚠️  No YouTube auth configured — YouTube WILL fail on Render/AWS IPs")
        logger.warning("   Fix (one-time setup):")
        logger.warning("   1. pip install yt-dlp yt-dlp-youtube-oauth2")
        logger.warning("   2. yt-dlp --username oauth2 --password '' https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        logger.warning("   3. Visit the device-auth URL shown, sign in with Google")
        logger.warning("   4. Find token: %AppData%\\yt-dlp\\youtube-oauth2\\token.json (Windows)")
        logger.warning("   5. Base64-encode: [Convert]::ToBase64String([IO.File]::ReadAllBytes('token.json'))")
        logger.warning("   6. Set YOUTUBE_OAUTH2_TOKEN env var in Render dashboard")
    if os.environ.get("YOUTUBE_PROXY"):
        logger.info("✅ YOUTUBE_PROXY configured")
    
    # Check if fallback extractors are available
    try:
        from backend.services import fallback_extractors
        logger.info(f"✅ Fallback extractors available (pytubefix, instaloader)")
    except ImportError:
        logger.warning(f"⚠️  Fallback extractors not available. Install with: pip install pytubefix instaloader")
    
    # Check if yt-dlp version is recent
    try:
        version_date = ytdlp_version.split(".")[:3]
        year, month, day = int(version_date[0]), int(version_date[1]), int(version_date[2])
        if year < 2024 or (year == 2024 and month < 12):
            logger.warning(f"⚠️  yt-dlp version {ytdlp_version} may be outdated. Consider updating: pip install --upgrade yt-dlp")
    except Exception:
        pass


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "X-Requested-With"],
    expose_headers=["Content-Disposition", "Content-Length", "X-Filename"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception at %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred. Please try again."},
    )


app.include_router(metadata.router)
app.include_router(download.router)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "MediaLoader Media Engine",
        "version": "1.0.0",
        "temp_dir": settings.temp_download_dir,
        "yt_dlp_version": yt_dlp.version.__version__,
    }

