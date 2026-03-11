"""
Fallback extraction services for when yt-dlp fails.
Uses platform-specific libraries for YouTube and Instagram.
"""

import asyncio
import logging
import os
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

# Public Invidious instances — tried in order, first valid JSON response wins.
# These are community-run mirrors; some may be slow or return empty bodies.
_INVIDIOUS_INSTANCES = [
    "https://invidious.privacydev.net",
    "https://inv.nadeko.net",
    "https://yt.cdaut.de",
    "https://invidious.nerdvpn.de",
    "https://invidious.slipfox.xyz",
    "https://invidious.io.lol",
    "https://invidious.reallyaweso.me",
    "https://iv.datura.network",
    "https://invidious.flossboxin.org.in",
    "https://invidious.jing.rocks",
    "https://watch.oshi.at",
    "https://vid.puffyan.us",
    "https://invidious.fdn.fr",
    "https://iv.melmac.space",
]


async def _get_invidious_instances() -> list[str]:
    """Fetch live Invidious instance list from the official API, fall back to static list."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("https://api.invidious.io/instances.json?pretty=1&sort_by=health")
            if resp.status_code == 200 and resp.content:
                data = resp.json()
                # data is [[host, {...}], ...] — filter for https instances with api=True
                instances = [
                    f"https://{item[0]}"
                    for item in data
                    if isinstance(item, list)
                    and isinstance(item[1], dict)
                    and item[1].get("api") is True
                    and item[1].get("uri", "").startswith("https")
                ][:20]
                if instances:
                    logger.debug(f"Got {len(instances)} live Invidious instances from API")
                    return instances
    except Exception as e:
        logger.debug(f"Invidious instance API fetch failed: {e}")
    return _INVIDIOUS_INSTANCES


def _yt_video_id(url: str) -> Optional[str]:
    """Extract YouTube video ID from any YouTube URL format."""
    m = re.search(r"(?:v=|youtu\.be/|embed/|shorts/)([A-Za-z0-9_-]{11})", url)
    return m.group(1) if m else None


async def get_youtube_metadata_invidious(url: str) -> VideoMetadata:
    """
    Extract YouTube metadata via the Invidious public API.
    Works from any IP including cloud/datacenter — no auth required.
    Tries multiple Invidious instances until one returns valid data.
    """
    video_id = _yt_video_id(url)
    if not video_id:
        raise ValueError(f"Could not extract video ID from URL: {url}")

    instances = await _get_invidious_instances()
    last_error: Exception = RuntimeError("No Invidious instances available")

    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
        for instance in instances:
            api_url = f"{instance}/api/v1/videos/{video_id}"
            try:
                resp = await client.get(api_url)

                # Some instances return 200 with empty body or HTML — skip them
                if resp.status_code != 200:
                    logger.debug(f"Invidious {instance} returned HTTP {resp.status_code}")
                    continue
                if not resp.content:
                    logger.debug(f"Invidious {instance} returned empty body")
                    continue
                content_type = resp.headers.get("content-type", "")
                if "html" in content_type:
                    logger.debug(f"Invidious {instance} returned HTML (probably a captcha/redirect page)")
                    continue

                try:
                    data = resp.json()
                except Exception as je:
                    logger.debug(f"Invidious {instance} JSON parse failed: {je} | body: {resp.text[:120]}")
                    continue

                # Some instances return a JSON error object (e.g. their own IP is blocked by YouTube)
                if "error" in data:
                    err_msg = data['error']
                    logger.warning(f"Invidious {instance} returned error: {err_msg}")
                    last_error = RuntimeError(f"{instance}: {err_msg}")
                    continue

                # Must have at least a title to be useful
                if not data.get("title"):
                    logger.debug(f"Invidious {instance} response missing title field")
                    continue

                formats: list[VideoFormat] = []

                for f in data.get("adaptiveFormats", []):
                    mime = f.get("type", "")
                    is_video = "video" in mime
                    is_audio = "audio" in mime
                    if not is_video and not is_audio:
                        continue
                    ext = mime.split("/")[1].split(";")[0] if "/" in mime else "mp4"
                    formats.append(VideoFormat(
                        format_id=str(f.get("itag", "")),
                        resolution=f.get("qualityLabel") or ("audio" if is_audio and not is_video else "video"),
                        ext=ext,
                        filesize=int(f["contentLength"]) if f.get("contentLength") else None,
                        vcodec=f.get("encoding") if is_video else None,
                        acodec=f.get("encoding") if is_audio and not is_video else None,
                        height=int(str(f["resolution"]).rstrip("p")) if f.get("resolution") else None,
                        abr=f"{f['bitrate'] // 1000}k" if f.get("bitrate") and not is_video else None,
                    ))

                for f in data.get("formatStreams", []):
                    mime = f.get("type", "")
                    ext = mime.split("/")[1].split(";")[0] if "/" in mime else "mp4"
                    qlabel = f.get("qualityLabel", "")
                    height = None
                    try:
                        height = int(qlabel.rstrip("p")) if qlabel.endswith("p") else None
                    except ValueError:
                        pass
                    formats.append(VideoFormat(
                        format_id=str(f.get("itag", "")),
                        resolution=qlabel or "unknown",
                        ext=ext,
                        filesize=int(f["contentLength"]) if f.get("contentLength") else None,
                        vcodec=f.get("encoding"),
                        acodec="mp4a",
                        height=height,
                    ))

                thumbs = data.get("videoThumbnails", [])
                thumbnail = next(
                    (t["url"] for t in thumbs if t.get("quality") in ("maxres", "high")),
                    thumbs[0]["url"] if thumbs else None,
                )

                logger.info(f"Invidious {instance} succeeded for {video_id} ({len(formats)} formats)")
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


# ============================================================================
# INNERTUBE FALLBACK (direct YouTube InnerTube API)
# ============================================================================

async def get_youtube_metadata_innertube(url: str) -> VideoMetadata:
    """
    Extract YouTube metadata + stream URLs via the InnerTube API directly.

    Uses the TV_EMBEDDED and ANDROID_MUSIC clients, which YouTube treats as
    trusted embedded/app clients with lighter bot-detection than the web client.
    No authentication required. Works as a fallback when yt-dlp's web/android
    clients are blocked from cloud IPs.
    """
    try:
        from innertube import InnerTube
    except ImportError:
        raise ImportError("innertube is not installed. Add innertube>=5.0.0 to requirements.txt")

    video_id = _yt_video_id(url)
    if not video_id:
        raise ValueError(f"Could not extract video ID from URL: {url}")

    # TV_EMBEDDED: used by embedded YouTube players; historically low restrictions.
    # ANDROID_MUSIC: YouTube Music's Android client; less aggressively blocked.
    # WEB_CREATOR: YouTube Studio client; different fingerprint from regular web.
    _CLIENTS = ["TV_EMBEDDED", "ANDROID_MUSIC", "ANDROID", "WEB_CREATOR"]

    loop = asyncio.get_running_loop()
    last_exc: Exception = RuntimeError("innertube: no clients tried")

    for client_name in _CLIENTS:
        def _fetch(cn: str = client_name) -> dict:
            client = InnerTube(cn)
            return client.player(video_id)

        try:
            data = await loop.run_in_executor(_executor, _fetch)
        except Exception as exc:
            logger.debug(f"innertube client {client_name} request failed: {exc}")
            last_exc = exc
            continue

        # Check playability
        playability = data.get("playabilityStatus", {})
        status = playability.get("status", "")
        if status not in ("OK", "LIVE_STREAM_OFFLINE"):
            reason = playability.get("reason") or playability.get("errorScreen", {}).get("playerErrorMessageRenderer", {}).get("subreason", {}).get("simpleText", status)
            logger.debug(f"innertube {client_name}: playabilityStatus={status} ({reason})")
            last_exc = RuntimeError(f"{client_name}: {reason or status}")
            continue

        video_details = data.get("videoDetails", {})
        streaming_data = data.get("streamingData", {})

        formats: list[VideoFormat] = []
        for f in streaming_data.get("formats", []) + streaming_data.get("adaptiveFormats", []):
            mime = f.get("mimeType", "")
            if not mime:
                continue
            is_video = "video" in mime
            is_audio = "audio" in mime
            ext = mime.split("/")[1].split(";")[0] if "/" in mime else "mp4"

            # Prefer url; some clients use signatureCipher which we can't easily decrypt here
            if not f.get("url"):
                continue

            qlabel = f.get("qualityLabel", "")
            height: Optional[int] = None
            try:
                height = int(qlabel.rstrip("p")) if qlabel.endswith("p") else f.get("height")
            except (ValueError, TypeError):
                height = f.get("height")

            abr_val: Optional[str] = None
            if f.get("audioSampleRate") and is_audio and not is_video:
                bitrate = f.get("bitrate")
                abr_val = f"{bitrate // 1000}k" if bitrate else None

            formats.append(VideoFormat(
                format_id=str(f.get("itag", "")),
                resolution=qlabel or ("audio" if is_audio and not is_video else "video"),
                ext=ext,
                filesize=f.get("contentLength") and int(f["contentLength"]),
                vcodec=mime.split("codecs=")[-1].strip('"') if is_video and "codecs=" in mime else None,
                acodec=mime.split("codecs=")[-1].strip('"') if is_audio and not is_video and "codecs=" in mime else None,
                height=height,
                abr=abr_val,
            ))

        thumbnails = video_details.get("thumbnail", {}).get("thumbnails", [])
        thumbnail = thumbnails[-1]["url"] if thumbnails else None

        duration: Optional[int] = None
        try:
            duration = int(video_details.get("lengthSeconds", 0)) or None
        except (ValueError, TypeError):
            pass

        view_count: Optional[int] = None
        try:
            view_count = int(video_details.get("viewCount", 0)) or None
        except (ValueError, TypeError):
            pass

        logger.info(f"innertube {client_name} succeeded for {video_id} ({len(formats)} formats)")
        return VideoMetadata(
            title=video_details.get("title", "YouTube Video"),
            thumbnail=thumbnail,
            duration=duration,
            uploader=video_details.get("author"),
            platform="YouTube",
            url=url,
            formats=formats,
            description=(video_details.get("shortDescription") or "")[:400] or None,
            view_count=view_count,
        )

    raise RuntimeError(f"innertube: all clients failed. Last error: {last_exc}")

def _parse_iso8601_duration(duration_str: str) -> Optional[int]:
    """Convert ISO 8601 duration string (e.g. PT4M13S) to total seconds."""
    if not duration_str:
        return None
    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration_str)
    if not m:
        return None
    hours = int(m.group(1) or 0)
    minutes = int(m.group(2) or 0)
    seconds = int(m.group(3) or 0)
    return hours * 3600 + minutes * 60 + seconds


async def get_youtube_metadata_ytdata_api(url: str) -> VideoMetadata:
    """
    Extract YouTube metadata via the official YouTube Data API v3.

    Works from any IP (including cloud/Render). Returns title, thumbnail,
    duration, view/like counts — but no stream download URLs.

    Setup (one-time, free):
      1. Go to https://console.cloud.google.com/apis/library/youtube.googleapis.com
      2. Enable YouTube Data API v3 and create an API key
      3. Set YOUTUBE_API_KEY in your Render dashboard environment variables
      (Free quota: 10,000 units/day; a metadata lookup costs 1 unit)
    """
    api_key = os.environ.get("YOUTUBE_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("YOUTUBE_API_KEY not configured")

    video_id = _yt_video_id(url)
    if not video_id:
        raise ValueError(f"Could not extract video ID from URL: {url}")

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            "https://www.googleapis.com/youtube/v3/videos",
            params={
                "id": video_id,
                "part": "snippet,contentDetails,statistics",
                "key": api_key,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    items = data.get("items", [])
    if not items:
        raise ValueError(f"Video {video_id} not found via YouTube Data API")

    item = items[0]
    snippet = item.get("snippet", {})
    content_details = item.get("contentDetails", {})
    statistics = item.get("statistics", {})

    duration = _parse_iso8601_duration(content_details.get("duration", ""))

    thumbnails = snippet.get("thumbnails", {})
    thumbnail = (
        thumbnails.get("maxres", {}).get("url")
        or thumbnails.get("high", {}).get("url")
        or thumbnails.get("default", {}).get("url")
    )

    view_count: Optional[int] = None
    try:
        view_count = int(statistics["viewCount"])
    except (KeyError, ValueError, TypeError):
        pass

    like_count: Optional[int] = None
    try:
        like_count = int(statistics["likeCount"])
    except (KeyError, ValueError, TypeError):
        pass

    logger.info(f"YouTube Data API v3 succeeded for {video_id}")
    return VideoMetadata(
        title=snippet.get("title", "YouTube Video"),
        thumbnail=thumbnail,
        duration=duration,
        uploader=snippet.get("channelTitle"),
        platform="YouTube",
        url=url,
        # No stream URLs available from the Data API; the frontend will show
        # metadata/preview but download will require OAuth2 or a proxy.
        formats=[],
        description=(snippet.get("description") or "")[:400] or None,
        view_count=view_count,
        like_count=like_count,
    )

