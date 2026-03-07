import os
import re
import uuid
import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

import imageio_ffmpeg
import yt_dlp
from yt_dlp.utils import DownloadError, ExtractorError, GeoRestrictedError, UnavailableVideoError

from backend.core.config import settings
from backend.models.schemas import VideoMetadata, VideoFormat

logger = logging.getLogger(__name__)

# Import fallback extractors
try:
    from backend.services import fallback_extractors
    FALLBACK_AVAILABLE = True
except ImportError:
    FALLBACK_AVAILABLE = False
    logger.warning("Fallback extractors not available. Install pytubefix and instaloader for fallback support.")

_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="ytdlp")

# Resolve the bundled FFmpeg binary (works without a system-level install).
# Pass the full exe path — yt-dlp accepts either a directory or a direct path,
# but imageio_ffmpeg uses a versioned filename (e.g. ffmpeg-win-x86_64-v7.1.exe)
# that yt-dlp won't find via directory scan.
try:
    _ffmpeg_exe: Optional[str] = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    _ffmpeg_exe = None

_SKIP_EXTS = {"mhtml", "vtt", "srt", "ttml", "srv1", "srv2", "srv3", "json3"}
_VIDEO_ONLY_CODECS = {"none", ""}


def _extract_platform(url: str) -> str:
    lower = url.lower()
    if "youtube.com" in lower or "youtu.be" in lower:
        return "YouTube"
    if "instagram.com" in lower:
        return "Instagram"
    if "tiktok.com" in lower:
        return "TikTok"
    if "twitter.com" in lower or "x.com" in lower:
        return "Twitter / X"
    if "facebook.com" in lower or "fb.watch" in lower:
        return "Facebook"
    if "reddit.com" in lower:
        return "Reddit"
    if "vimeo.com" in lower:
        return "Vimeo"
    if "dailymotion.com" in lower:
        return "Dailymotion"
    if "twitch.tv" in lower:
        return "Twitch"
    return "Unknown"


def _sanitize_filename(name: str) -> str:
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)
    return name[:120].strip() or "media"


def _classify_error(exc: Exception) -> tuple[int, str]:
    msg = str(exc)
    msg_lower = msg.lower()

    if isinstance(exc, GeoRestrictedError):
        return 451, "This video is not available in your region."
    if isinstance(exc, UnavailableVideoError):
        return 404, "Video is unavailable or has been removed."

    if "unsupported url" in msg_lower:
        return 422, f"Platform not supported. Ensure the URL is from a supported site."
    if "po token" in msg_lower or "detected as a bot" in msg_lower:
        return 403, "YouTube requires additional verification for this video. Please try a different video or wait a few minutes."
    if "failed to extract any player response" in msg_lower:
        return 503, "YouTube is temporarily blocking automated requests. Please try again in a few moments, or try a different video."
    if "sign in to confirm" in msg_lower or "confirm you're not a bot" in msg_lower:
        return 403, "Bot detection triggered. Please try again in a moment or use a different video."
    if "private video" in msg_lower or "this video is private" in msg_lower:
        return 403, "This video is private or requires authentication."
    if "login required" in msg_lower or "requires authentication" in msg_lower:
        return 403, "This content requires login or authentication."
    if "age" in msg_lower and ("restrict" in msg_lower or "confirm" in msg_lower):
        return 403, "This video is age-restricted and cannot be downloaded."
    if "copyright" in msg_lower or "dmca" in msg_lower:
        return 451, "This video has been removed due to copyright or DMCA reasons."
    if "removed" in msg_lower or "deleted" in msg_lower:
        return 404, "This video has been removed or deleted."
    if "not available" in msg_lower or "unavailable" in msg_lower:
        return 404, "Video not found or unavailable."
    if "http error 429" in msg_lower or "rate limit" in msg_lower or "too many requests" in msg_lower:
        return 429, "Rate limit reached. Please wait a moment and try again."
    if "http error 403" in msg_lower or "forbidden" in msg_lower:
        return 403, "Access denied by the platform. The content may be restricted."
    if "http error 404" in msg_lower:
        return 404, "Video not found at the given URL."
    if "http error 410" in msg_lower or "gone" in msg_lower:
        return 410, "This video is no longer available."
    if "http error 451" in msg_lower:
        return 451, "This content is unavailable for legal reasons."
    if "http error 5" in msg_lower:
        return 502, "The platform's server is experiencing issues. Please try again later."
    if "no video formats found" in msg_lower or "no formats found" in msg_lower:
        return 422, "No downloadable formats found for this video."
    if "ffmpeg" in msg_lower or "ffprobe" in msg_lower:
        return 500, "FFmpeg processing error. Audio extraction requires FFmpeg."
    if "connection" in msg_lower or "network" in msg_lower or "timeout" in msg_lower:
        return 502, "Network error while reaching the video source. Please try again."
    if "geo" in msg_lower and "block" in msg_lower:
        return 451, "This video is geo-blocked in your region."
    if "premium" in msg_lower or "subscription" in msg_lower:
        return 403, "This content requires a premium subscription."

    return 500, f"Extraction failed: {msg[:300]}"


def _base_ydl_opts() -> dict:
    opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": settings.yt_dlp_socket_timeout,
        "retries": settings.yt_dlp_retries,
        "fragment_retries": settings.yt_dlp_retries,
        "concurrent_fragment_downloads": 4,
        "http_chunk_size": 10 * 1024 * 1024,
        "updatetime": False,
        "noprogress": True,
        # Enhanced headers to bypass bot detection across platforms
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "http_headers": {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Cache-Control": "max-age=0",
        },
        # Platform-specific extractor arguments for robustness
        "extractor_args": {
            "instagram": {
                "api": ["graphql", "web"],  # Use multiple API endpoints
            },
            "tiktok": {
                "api": ["mobile_api", "web_api"],
                "webpage_download": True,
            },
            "twitter": {
                "api": ["syndication", "graphql"],
            },
        },
        # Additional robustness settings
        "nocheckcertificate": False,  # Keep certificate checks for security
        "prefer_insecure": False,
        "no_check_certificates": False,
        "geo_bypass": True,
        "geo_bypass_country": "US",
        # Avoid methods that trigger additional bot checks
        "no_check_formats": True,
    }
    if _ffmpeg_exe:
        opts["ffmpeg_location"] = _ffmpeg_exe
    return opts


async def get_metadata(url: str) -> VideoMetadata:
    """
    Extract video metadata with aggressive fallback retry mechanism for YouTube.
    Tries different player clients and extraction methods if attempts fail.
    """
    loop = asyncio.get_running_loop()
    
    # Define multiple configuration strategies with increasing aggressiveness
    strategies = [
        # Strategy 1: iOS with music (most stable)
        {
            "extractor_args": {"youtube": {"player_client": ["ios_music", "ios"]}},
            "age_limit": None,
            "extractor_retries": 3,
        },
        # Strategy 2: Android creator (content creator app)
        {
            "extractor_args": {"youtube": {"player_client": ["android_creator", "android"]}},
            "age_limit": None,
            "extractor_retries": 3,
        },
        # Strategy 3: Android VR (virtual reality client)
        {
            "extractor_args": {"youtube": {"player_client": ["android_vr", "android"]}},
            "age_limit": None,
        },
        # Strategy 4: iOS with embedded
        {
            "extractor_args": {"youtube": {"player_client": ["ios_embedded", "ios"]}},
            "age_limit": None,
        },
        # Strategy 5: Android TV client (often bypasses bot detection)
        {
            "extractor_args": {"youtube": {"player_client": ["android_testsuite", "android"]}},
            "age_limit": None,
        },
        # Strategy 6: Media Connect (smart TV client)
        {
            "extractor_args": {"youtube": {"player_client": ["mediaconnect"]}},
            "age_limit": None,
        },
        # Strategy 7: TV embedded
        {
            "extractor_args": {"youtube": {"player_client": ["tv_embedded"]}},
            "age_limit": None,
        },
        # Strategy 8: Mobile web with compat options
        {
            "extractor_args": {"youtube": {"player_client": ["mweb"]}},
            "age_limit": None,
            "compat_opts": {"no-youtube-prefer-utc-upload-date"},
        },
        # Strategy 9: Web with legacy options
        {
            "extractor_args": {"youtube": {"player_client": ["web"]}},
            "age_limit": None,
            "legacy_server_connect": True,
            "nocheckcertificate": True,
        },
        # Strategy 10: Android music
        {
            "extractor_args": {"youtube": {"player_client": ["android_music", "android"]}},
            "age_limit": None,
        },
        # Strategy 11: Minimal config (let yt-dlp decide)
        {
            "age_limit": None,
            "extractor_retries": 5,
        },
        # Strategy 12: Last resort - completely minimal
        {
            "quiet": False,
            "verbose": True,
        },
    ]
    
    last_exception = None
    is_youtube = "youtube.com" in url.lower() or "youtu.be" in url.lower()
    is_instagram = "instagram.com" in url.lower()
    
    # For non-YouTube URLs, use simplified strategies
    if not is_youtube:
        strategies = [{}]
    
    for strategy_idx, strategy_config in enumerate(strategies):
        opts = {
            **_base_ydl_opts(),
            "skip_download": True,
            **strategy_config,
        }
        
        def _extract() -> dict:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if info is None:
                    raise ValueError("No information returned for this URL")
                return info
        
        try:
            info = await loop.run_in_executor(_executor, _extract)
            if strategy_idx > 0:
                logger.info(f"Successfully extracted metadata using strategy {strategy_idx + 1}")
            break  # Success, exit the retry loop
        except (DownloadError, ExtractorError) as exc:
            last_exception = exc
            # If this is not the last strategy, try the next one
            if strategy_idx < len(strategies) - 1:
                logger.warning(f"Extraction attempt {strategy_idx + 1} failed for {url}, trying alternative method...")
                # Variable backoff: 0.5s for first 5, then 1s, then 2s
                delay = 0.5 if strategy_idx < 5 else (1.0 if strategy_idx < 8 else 2.0)
                await asyncio.sleep(delay)
                continue
            # Last strategy failed - try fallback extractors
            if FALLBACK_AVAILABLE:
                if is_youtube:
                    logger.warning(f"All yt-dlp strategies failed for YouTube URL, trying pytubefix fallback...")
                    try:
                        return await fallback_extractors.get_youtube_metadata_fallback(url)
                    except Exception as fallback_exc:
                        error_msg = str(fallback_exc).lower()
                        if "po token" in error_msg or "detected as a bot" in error_msg:
                            logger.error(f"Both yt-dlp and pytubefix blocked by YouTube bot detection. This video requires PO tokens. Try a different YouTube video or use another platform.")
                        else:
                            logger.error(f"YouTube fallback also failed: {fallback_exc}")
                elif is_instagram:
                    logger.warning(f"yt-dlp failed for Instagram URL, trying instaloader fallback...")
                    try:
                        return await fallback_extractors.get_instagram_metadata_fallback(url)
                    except Exception as fallback_exc:
                        logger.error(f"Instagram fallback also failed: {fallback_exc}")
            raise exc
        except Exception as exc:
            last_exception = exc
            if strategy_idx < len(strategies) - 1:
                logger.warning(f"Extraction attempt {strategy_idx + 1} failed for {url}, trying alternative method...")
                delay = 0.5 if strategy_idx < 5 else (1.0 if strategy_idx < 8 else 2.0)
                await asyncio.sleep(delay)
                continue
            # Last strategy failed - try fallback extractors
            if FALLBACK_AVAILABLE:
                if is_youtube:
                    logger.warning(f"All yt-dlp strategies failed for YouTube URL, trying pytubefix fallback...")
                    try:
                        return await fallback_extractors.get_youtube_metadata_fallback(url)
                    except Exception as fallback_exc:
                        error_msg = str(fallback_exc).lower()
                        if "po token" in error_msg or "detected as a bot" in error_msg:
                            logger.error(f"Both yt-dlp and pytubefix blocked by YouTube bot detection. This video requires PO tokens. Try a different YouTube video or use another platform.")
                        else:
                            logger.error(f"YouTube fallback also failed: {fallback_exc}")
                elif is_instagram:
                    logger.warning(f"yt-dlp failed for Instagram URL, trying instaloader fallback...")
                    try:
                        return await fallback_extractors.get_instagram_metadata_fallback(url)
                    except Exception as fallback_exc:
                        logger.error(f"Instagram fallback also failed: {fallback_exc}")
            raise exc
    
    # If we somehow exit the loop without info, raise the last exception
    if last_exception:
        raise last_exception

    raw_formats = info.get("formats") or []
    formats: list[VideoFormat] = []

    for f in raw_formats:
        ext = (f.get("ext") or "").lower()
        if ext in _SKIP_EXTS:
            continue
        vcodec = f.get("vcodec") or ""
        acodec = f.get("acodec") or ""
        if vcodec == "none" and acodec == "none":
            continue

        formats.append(
            VideoFormat(
                format_id=str(f.get("format_id", "")),
                resolution=f.get("resolution"),
                ext=ext,
                filesize=f.get("filesize") or f.get("filesize_approx"),
                acodec=acodec or None,
                vcodec=vcodec or None,
                tbr=f.get("tbr"),
                abr=f.get("abr"),
                vbr=f.get("vbr"),
                format_note=f.get("format_note"),
                height=f.get("height"),
                width=f.get("width"),
            )
        )

    description = (info.get("description") or "")[:400] or None

    return VideoMetadata(
        title=info.get("title") or "Untitled",
        thumbnail=info.get("thumbnail"),
        duration=info.get("duration"),
        uploader=info.get("uploader") or info.get("channel"),
        platform=_extract_platform(url),
        url=url,
        formats=formats,
        description=description,
        view_count=info.get("view_count"),
        like_count=info.get("like_count"),
    )


def _build_video_format_selector(format_id: Optional[str], info_formats: list[dict]) -> str:
    """
    Build a robust format selector that works across platforms.
    Provides multiple fallbacks to ensure download success.
    """
    if not format_id:
        # Multi-platform fallback chain
        return (
            "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/"
            "bestvideo[ext=mp4][height<=1080]+bestaudio/"
            "bestvideo[ext=mp4]+bestaudio[ext=m4a]/"
            "bestvideo[ext=mp4]+bestaudio/"
            "bestvideo[height<=1080]+bestaudio/"
            "bestvideo+bestaudio/"
            "best[ext=mp4][height<=1080]/"
            "best[ext=mp4]/best"
        )

    fmt = next((f for f in info_formats if str(f.get("format_id")) == format_id), None)
    if fmt is None:
        return format_id

    vcodec = fmt.get("vcodec") or ""
    acodec = fmt.get("acodec") or ""
    has_audio = acodec and acodec != "none"

    if has_audio:
        return format_id

    # Video-only format needs audio merging with fallbacks
    return f"{format_id}+bestaudio[ext=m4a]/{format_id}+bestaudio/{format_id}"


async def download_video(url: str, format_id: Optional[str] = None) -> tuple[Path, str]:
    """
    Download video using yt-dlp with platform-specific fallbacks if extraction fails.
    """
    is_youtube = "youtube.com" in url.lower() or "youtu.be" in url.lower()
    is_instagram = "instagram.com" in url.lower()
    
    temp_dir = Path(settings.temp_download_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)

    session_id = uuid.uuid4().hex
    output_template = str(temp_dir / f"{session_id}.%(ext)s")

    probe_opts = {**_base_ydl_opts(), "skip_download": True}

    loop = asyncio.get_running_loop()

    def _probe() -> list[dict]:
        with yt_dlp.YoutubeDL(probe_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return info.get("formats") or [] if info else []

    try:
        info_formats = await loop.run_in_executor(_executor, _probe)

        format_selector = _build_video_format_selector(format_id, info_formats)

        ydl_opts = {
            **_base_ydl_opts(),
            "outtmpl": output_template,
            "format": format_selector,
            "merge_output_format": "mp4",
            "postprocessors": [
                {
                    "key": "FFmpegVideoConvertor",
                    "preferedformat": "mp4",
                },
                {
                    "key": "FFmpegMetadata",
                    "add_metadata": True,
                },
            ],
            # Additional download robustness
            "ignoreerrors": False,
            "no_color": True,
            "extract_flat": False,
        }

        def _download() -> dict:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                if info is None:
                    raise RuntimeError("Download returned no information")
                return info

        info = await loop.run_in_executor(_executor, _download)

        title = _sanitize_filename(info.get("title") or "video")

        mp4_files = list(temp_dir.glob(f"{session_id}*.mp4"))
        if mp4_files:
            file_path = mp4_files[0]
            return file_path, f"{title}.mp4"

        all_files = sorted(
            [f for f in temp_dir.glob(f"{session_id}.*") if not f.suffix in (".part", ".ytdl")],
            key=lambda f: f.stat().st_size,
            reverse=True,
        )
        if not all_files:
            raise RuntimeError("Downloaded file not found in temp directory")

        file_path = all_files[0]
        ext = file_path.suffix.lstrip(".") or "mp4"
        return file_path, f"{title}.{ext}"
    
    except Exception as exc:
        # Try fallback extractors if available
        if FALLBACK_AVAILABLE:
            if is_youtube:
                logger.warning(f"yt-dlp download failed for YouTube, trying pytubefix fallback...")
                try:
                    return await fallback_extractors.download_youtube_video_fallback(url, format_id)
                except Exception as fallback_exc:
                    error_msg = str(fallback_exc).lower()
                    if "po token" in error_msg or "detected as a bot" in error_msg:
                        logger.error(f"Both yt-dlp and pytubefix blocked by YouTube bot detection for download. This video requires PO tokens. Try a different YouTube video or use another platform.")
                    else:
                        logger.error(f"YouTube download fallback also failed: {fallback_exc}")
            elif is_instagram:
                logger.warning(f"yt-dlp download failed for Instagram, trying instaloader fallback...")
                try:
                    return await fallback_extractors.download_instagram_video_fallback(url)
                except Exception as fallback_exc:
                    logger.error(f"Instagram download fallback also failed: {fallback_exc}")
        # Re-raise the original exception if no fallback succeeded
        raise exc


async def download_audio(url: str, quality: str = "192") -> tuple[Path, str]:
    temp_dir = Path(settings.temp_download_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)

    if quality not in ("128", "192", "320"):
        quality = "192"

    session_id = uuid.uuid4().hex
    output_template = str(temp_dir / f"{session_id}.%(ext)s")

    ydl_opts = {
        **_base_ydl_opts(),
        "outtmpl": output_template,
        "format": "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio[ext=mp3]/bestaudio/best",
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": quality,
            },
            {
                "key": "FFmpegMetadata",
                "add_metadata": True,
            },
            {
                "key": "EmbedThumbnail",  # Embed thumbnail as album art
            },
        ],
        "writethumbnail": True,  # Download thumbnail for embedding
        "postprocessor_args": [
            "-ar", "44100",  # Standard audio sample rate
        ],
    }

    loop = asyncio.get_running_loop()

    def _download() -> dict:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if info is None:
                raise RuntimeError("Audio download returned no information")
            return info

    info = await loop.run_in_executor(_executor, _download)

    title = _sanitize_filename(info.get("title") or "audio")

    mp3_files = sorted(
        temp_dir.glob(f"{session_id}*.mp3"),
        key=lambda f: f.stat().st_size,
        reverse=True,
    )
    if not mp3_files:
        raise RuntimeError("MP3 file not found after extraction. Ensure FFmpeg is installed and in PATH.")

    return mp3_files[0], f"{title}.mp3"


def cleanup_file(path: Path) -> None:
    try:
        if path and path.exists():
            os.remove(path)
            logger.debug("Cleaned up temp file: %s", path)
    except OSError as exc:
        logger.warning("Failed to clean up %s: %s", path, exc)
