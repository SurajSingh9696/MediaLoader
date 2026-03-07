import logging
import os
from pathlib import Path

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

