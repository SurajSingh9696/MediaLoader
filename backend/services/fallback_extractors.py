"""
Fallback extraction services for when yt-dlp fails.
Uses platform-specific libraries for YouTube and Instagram.
"""

import asyncio
import logging
import re
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

import httpx

from backend.core.config import settings
from backend.models.schemas import VideoMetadata, VideoFormat

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="fallback")


def _extract_platform(url: str) -> str:
    """Detect platform from URL."""
    lower = url.lower()
    if "youtube.com" in lower or "youtu.be" in lower:
        return "YouTube"
    if "instagram.com" in lower:
        return "Instagram"
    return "Unknown"


def _sanitize_filename(name: str) -> str:
    """Sanitize filename for safe filesystem usage."""
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)
    return name[:120].strip() or "media"


# ============================================================================
# YOUTUBE FALLBACK (pytubefix)
# ============================================================================

async def get_youtube_metadata_fallback(url: str) -> VideoMetadata:
    """
    Extract YouTube metadata using pytubefix as a fallback.
    """
    try:
        from pytubefix import YouTube
    except ImportError:
        raise ImportError("pytubefix is not installed. Install it with: pip install pytubefix")
    
    loop = asyncio.get_running_loop()
    
    def _extract() -> dict:
        yt = YouTube(url)
        
        # Build formats list
        formats = []
        for stream in yt.streams.filter(progressive=True):
            formats.append({
                "format_id": str(stream.itag),
                "resolution": stream.resolution or "unknown",
                "ext": stream.mime_type.split("/")[-1] if stream.mime_type else "mp4",
                "filesize": stream.filesize,
                "acodec": stream.audio_codec,
                "vcodec": stream.video_codec,
                "abr": stream.abr,
                "height": int(stream.resolution.rstrip("p")) if stream.resolution else None,
            })
        
        # Add separate video and audio streams
        for stream in yt.streams.filter(adaptive=True):
            formats.append({
                "format_id": str(stream.itag),
                "resolution": stream.resolution or ("audio" if stream.includes_audio_track else "video"),
                "ext": stream.mime_type.split("/")[-1] if stream.mime_type else "mp4",
                "filesize": stream.filesize,
                "acodec": stream.audio_codec if stream.includes_audio_track else None,
                "vcodec": stream.video_codec if stream.includes_video_track else None,
                "abr": stream.abr,
                "height": int(stream.resolution.rstrip("p")) if stream.resolution and stream.resolution != "audio" else None,
            })
        
        return {
            "title": yt.title,
            "thumbnail": yt.thumbnail_url,
            "duration": yt.length,
            "uploader": yt.author,
            "formats": formats,
            "description": yt.description[:400] if yt.description else None,
            "view_count": yt.views,
        }
    
    try:
        info = await loop.run_in_executor(_executor, _extract)
    except Exception as exc:
        logger.error(f"pytubefix fallback failed: {exc}")
        raise
    
    # Convert to VideoMetadata format
    formats = [
        VideoFormat(
            format_id=f["format_id"],
            resolution=f["resolution"],
            ext=f["ext"],
            filesize=f.get("filesize"),
            acodec=f.get("acodec"),
            vcodec=f.get("vcodec"),
            abr=f.get("abr"),
            height=f.get("height"),
        )
        for f in info["formats"]
    ]
    
    return VideoMetadata(
        title=info["title"],
        thumbnail=info["thumbnail"],
        duration=info["duration"],
        uploader=info["uploader"],
        platform="YouTube",
        url=url,
        formats=formats,
        description=info.get("description"),
        view_count=info.get("view_count"),
    )


async def download_youtube_video_fallback(
    url: str, format_id: Optional[str] = None
) -> tuple[Path, str]:
    """
    Download YouTube video using pytubefix as a fallback.
    """
    try:
        from pytubefix import YouTube
    except ImportError:
        raise ImportError("pytubefix is not installed")
    
    temp_dir = Path(settings.temp_download_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    session_id = uuid.uuid4().hex
    loop = asyncio.get_running_loop()
    
    def _download() -> tuple[Path, str]:
        yt = YouTube(url)
        
        # Select stream
        if format_id:
            stream = yt.streams.get_by_itag(int(format_id))
        else:
            # Get best progressive stream (video + audio)
            stream = yt.streams.filter(progressive=True, file_extension="mp4").order_by("resolution").desc().first()
            if not stream:
                # Fallback to highest resolution video
                stream = yt.streams.filter(adaptive=True, file_extension="mp4").order_by("resolution").desc().first()
        
        if not stream:
            raise ValueError("No suitable stream found")
        
        # Download to temp directory
        output_path = stream.download(output_path=str(temp_dir), filename=f"{session_id}.mp4")
        
        title = _sanitize_filename(yt.title)
        return Path(output_path), f"{title}.mp4"
    
    try:
        return await loop.run_in_executor(_executor, _download)
    except Exception as exc:
        logger.error(f"pytubefix download fallback failed: {exc}")
        raise


# ============================================================================
# INSTAGRAM FALLBACK (instaloader)
# ============================================================================

async def get_instagram_metadata_fallback(url: str) -> VideoMetadata:
    """
    Extract Instagram metadata using instaloader as a fallback.
    """
    try:
        import instaloader
    except ImportError:
        raise ImportError("instaloader is not installed. Install it with: pip install instaloader")
    
    loop = asyncio.get_running_loop()
    
    def _extract() -> dict:
        L = instaloader.Instaloader()
        
        # Extract shortcode from URL
        shortcode_match = re.search(r'(?:p|reel|tv)/([A-Za-z0-9_-]+)', url)
        if not shortcode_match:
            raise ValueError("Could not extract Instagram shortcode from URL")
        
        shortcode = shortcode_match.group(1)
        post = instaloader.Post.from_shortcode(L.context, shortcode)
        
        # Build format info
        formats = []
        if post.is_video:
            formats.append({
                "format_id": "video",
                "resolution": f"{post.video_view_count}",
                "ext": "mp4",
                "filesize": None,
                "url": post.video_url,
            })
        
        return {
            "title": post.caption[:100] if post.caption else "Instagram Video",
            "thumbnail": post.url,
            "duration": post.video_duration if post.is_video else None,
            "uploader": post.owner_username,
            "formats": formats,
            "description": post.caption[:400] if post.caption else None,
            "view_count": post.video_view_count if post.is_video else None,
            "like_count": post.likes,
        }
    
    try:
        info = await loop.run_in_executor(_executor, _extract)
    except Exception as exc:
        logger.error(f"instaloader fallback failed: {exc}")
        raise
    
    # Convert to VideoMetadata format
    formats = [
        VideoFormat(
            format_id=f["format_id"],
            resolution=f.get("resolution", "unknown"),
            ext=f["ext"],
            filesize=f.get("filesize"),
        )
        for f in info["formats"]
    ]
    
    return VideoMetadata(
        title=info["title"],
        thumbnail=info["thumbnail"],
        duration=info.get("duration"),
        uploader=info["uploader"],
        platform="Instagram",
        url=url,
        formats=formats,
        description=info.get("description"),
        view_count=info.get("view_count"),
        like_count=info.get("like_count"),
    )


async def download_instagram_video_fallback(url: str) -> tuple[Path, str]:
    """
    Download Instagram video using instaloader as a fallback.
    """
    try:
        import instaloader
    except ImportError:
        raise ImportError("instaloader is not installed")
    
    temp_dir = Path(settings.temp_download_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    session_id = uuid.uuid4().hex
    loop = asyncio.get_running_loop()
    
    def _download() -> tuple[Path, str]:
        L = instaloader.Instaloader(
            dirname_pattern=str(temp_dir),
            filename_pattern=session_id,
            download_pictures=False,
            download_videos=True,
            download_video_thumbnails=False,
            download_geotags=False,
            download_comments=False,
            save_metadata=False,
        )
        
        # Extract shortcode from URL
        shortcode_match = re.search(r'(?:p|reel|tv)/([A-Za-z0-9_-]+)', url)
        if not shortcode_match:
            raise ValueError("Could not extract Instagram shortcode from URL")
        
        shortcode = shortcode_match.group(1)
        post = instaloader.Post.from_shortcode(L.context, shortcode)
        
        if not post.is_video:
            raise ValueError("This Instagram post is not a video")
        
        # Download the video
        L.download_post(post, target=str(temp_dir))
        
        # Find the downloaded file
        video_files = list(temp_dir.glob(f"{session_id}*.mp4"))
        if not video_files:
            raise RuntimeError("Downloaded file not found")
        
        file_path = video_files[0]
        title = _sanitize_filename(post.caption[:50] if post.caption else "instagram_video")
        
        return file_path, f"{title}.mp4"
    
    try:
        return await loop.run_in_executor(_executor, _download)
    except Exception as exc:
        logger.error(f"instaloader download fallback failed: {exc}")
        raise


# ============================================================================
# YOUTUBE FALLBACK via INVIDIOUS API (no IP restrictions, no auth needed)
# ============================================================================

# Public Invidious instances — tried in order, first success wins.
# These are community-run mirrors of YouTube that proxy requests through their
# own servers, bypassing cloud-IP blocks entirely.
_INVIDIOUS_INSTANCES = [
    "https://invidious.io.lol",
    "https://invidious.privacydev.net",
    "https://iv.datura.network",
    "https://invidious.nerdvpn.de",
    "https://invidious.slipfox.xyz",
]


def _yt_video_id(url: str) -> Optional[str]:
    """Extract YouTube video ID from any YouTube URL format."""
    patterns = [
        r"(?:v=|youtu\.be/|embed/|shorts/)([A-Za-z0-9_-]{11})",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None


async def get_youtube_metadata_invidious(url: str) -> VideoMetadata:
    """
    Extract YouTube metadata via the Invidious public API.
    Works from any IP including cloud/datacenter — no auth required.
    Tries multiple Invidious instances until one succeeds.
    """
    video_id = _yt_video_id(url)
    if not video_id:
        raise ValueError(f"Could not extract video ID from URL: {url}")

    last_error: Exception = RuntimeError("No Invidious instances available")

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        for instance in _INVIDIOUS_INSTANCES:
            api_url = f"{instance}/api/v1/videos/{video_id}"
            try:
                resp = await client.get(api_url)
                if resp.status_code != 200:
                    logger.debug(f"Invidious {instance} returned {resp.status_code}")
                    continue
                data = resp.json()

                formats: list[VideoFormat] = []

                # Combined video+audio streams (adaptiveFormats with both)
                for f in data.get("adaptiveFormats", []):
                    mime = f.get("type", "")
                    if "video" not in mime and "audio" not in mime:
                        continue
                    is_video = "video" in mime
                    is_audio = "audio" in mime
                    ext = mime.split("/")[1].split(";")[0] if "/" in mime else "mp4"
                    formats.append(VideoFormat(
                        format_id=f.get("itag", ""),
                        resolution=f.get("qualityLabel") or ("audio" if is_audio and not is_video else "video"),
                        ext=ext,
                        filesize=f.get("contentLength") and int(f["contentLength"]),
                        vcodec=f.get("encoding") if is_video else None,
                        acodec=f.get("encoding") if is_audio and not is_video else None,
                        height=f.get("resolution") and int(str(f["resolution"]).rstrip("p")) if f.get("resolution") else None,
                        abr=f"{f['bitrate'] // 1000}k" if f.get("bitrate") and not is_video else None,
                    ))

                # Progressive "formatStreams" (video+audio muxed)
                for f in data.get("formatStreams", []):
                    mime = f.get("type", "")
                    ext = mime.split("/")[1].split(";")[0] if "/" in mime else "mp4"
                    qlabel = f.get("qualityLabel", "")
                    height = None
                    if qlabel.endswith("p"):
                        try:
                            height = int(qlabel.rstrip("p"))
                        except ValueError:
                            pass
                    formats.append(VideoFormat(
                        format_id=f.get("itag", ""),
                        resolution=qlabel or "unknown",
                        ext=ext,
                        filesize=f.get("contentLength") and int(f["contentLength"]),
                        vcodec=f.get("encoding"),
                        acodec="mp4a",
                        height=height,
                    ))

                # Best thumbnail
                thumbs = data.get("videoThumbnails", [])
                thumbnail = next(
                    (t["url"] for t in thumbs if t.get("quality") in ("maxres", "high")),
                    thumbs[0]["url"] if thumbs else None,
                )

                logger.info(f"Invidious {instance} succeeded for {video_id}")
                return VideoMetadata(
                    title=data.get("title", "YouTube Video"),
                    thumbnail=thumbnail,
                    duration=data.get("lengthSeconds"),
                    uploader=data.get("author"),
                    platform="YouTube",
                    url=url,
                    formats=formats,
                    description=(data.get("description") or "")[:400] or None,
                    view_count=data.get("viewCount"),
                )

            except httpx.TimeoutException:
                logger.debug(f"Invidious {instance} timed out")
                last_error = TimeoutError(f"{instance} timed out")
            except Exception as exc:
                logger.debug(f"Invidious {instance} error: {exc}")
                last_error = exc

    raise RuntimeError(f"All Invidious instances failed. Last error: {last_error}")

