"""
MediaLoader Python Backend
==========================
Wraps yt-dlp + ffmpeg and exposes two endpoints:

  GET /info?url=<media-url>
      → Returns a JSON object matching the MediaInfo shape expected by the Next.js frontend.

  GET /download?url=<media-url>&formatId=<id>&title=<optional-title>
      → Streams the downloaded file directly to the client.

Deploy this on Railway, Render, or Fly.io (any platform that allows
system binaries). The Next.js frontend on Vercel calls this service.
"""

import os
import re
import json
import uuid
import shutil
import tempfile
import subprocess
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# ── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI(title="MediaLoader API", version="1.0.0")

ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN] if ALLOWED_ORIGIN != "*" else ["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ── Binary paths ──────────────────────────────────────────────────────────────

YTDLP_BIN  = os.getenv("YTDLP_PATH", "yt-dlp")
FFMPEG_BIN = os.getenv("FFMPEG_PATH", "ffmpeg")

# ── YouTube helpers ───────────────────────────────────────────────────────────

YT_PATTERNS = [
    r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/v/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})",
    r"youtube\.com/watch\?.*[?&]v=([a-zA-Z0-9_-]{11})",
]

VIDEO_TIERS = [
    {"height": 2160, "label": "4K (2160p)"},
    {"height": 1440, "label": "1440p QHD"},
    {"height": 1080, "label": "1080p FHD"},
    {"height": 720,  "label": "720p HD"},
    {"height": 480,  "label": "480p SD"},
    {"height": 360,  "label": "360p"},
]

AUDIO_TIERS = [
    {"kbps": 320, "label": "Best Quality · M4A", "selector": "bestaudio[ext=m4a]/bestaudio"},
    {"kbps": 128, "label": "~128 kbps · M4A",    "selector": "bestaudio[abr<=132][ext=m4a]/bestaudio[abr<=132]/bestaudio"},
    {"kbps": 64,  "label": "~64 kbps · M4A",     "selector": "bestaudio[abr<=72][ext=m4a]/bestaudio[abr<=72]/bestaudio"},
]

IG_PATTERNS = [
    r"instagram\.com/p/([A-Za-z0-9_-]+)",
    r"instagram\.com/reel(?:s)?/([A-Za-z0-9_-]+)",
    r"instagram\.com/stories/[^/]+/([0-9]+)",
    r"instagram\.com/tv/([A-Za-z0-9_-]+)",
]


def is_youtube_url(url: str) -> bool:
    return any(re.search(p, url) for p in YT_PATTERNS)


def is_instagram_url(url: str) -> bool:
    return any(re.search(p, url) for p in IG_PATTERNS)


def is_valid_url(url: str) -> bool:
    return bool(re.match(r"^https?://", url))


# ── yt-dlp runner ─────────────────────────────────────────────────────────────

def run_ytdlp(args: list[str], timeout: int = 60) -> str:
    """Run yt-dlp synchronously and return stdout."""
    result = subprocess.run(
        [YTDLP_BIN] + args,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"yt-dlp exited with code {result.returncode}")
    return result.stdout


# ── Format builders ───────────────────────────────────────────────────────────

def estimate_tier_size(fmts: list[dict], target_height: int, duration: float) -> Optional[int]:
    if not duration:
        return None
    video_fmts = [
        f for f in fmts
        if f.get("vcodec") and f["vcodec"] != "none" and f.get("height") and f["height"] <= target_height
    ]
    audio_fmts = [
        f for f in fmts
        if (not f.get("vcodec") or f["vcodec"] == "none") and f.get("acodec") and f["acodec"] != "none"
    ]
    video_fmts.sort(key=lambda f: -(f.get("height") or 0))
    audio_fmts.sort(key=lambda f: -(f.get("abr") or 0))

    vf = video_fmts[0] if video_fmts else None
    af = audio_fmts[0] if audio_fmts else None

    vbytes = vf.get("filesize") or vf.get("filesize_approx") or (
        ((vf.get("tbr") or 0) * 1000 * duration) / 8 if vf else 0
    )
    abytes = af.get("filesize") or af.get("filesize_approx") or (
        ((af.get("tbr") or 0) * 1000 * duration) / 8 if af else 0
    )
    return round(vbytes + abytes)


def estimate_audio_size(fmts: list[dict], max_kbps: int, duration: float) -> Optional[int]:
    if not duration:
        return None
    candidates = [
        f for f in fmts
        if (not f.get("vcodec") or f["vcodec"] == "none")
        and f.get("acodec") and f["acodec"] != "none"
        and (f.get("abr") or 0) <= max_kbps + 20
    ]
    candidates.sort(key=lambda f: -(f.get("abr") or 0))
    if not candidates:
        return None
    fmt = candidates[0]
    return fmt.get("filesize") or fmt.get("filesize_approx") or (
        round(((fmt.get("tbr") or 0) * 1000 * duration) / 8) if fmt.get("tbr") else None
    )


def find_audio_url_by_tier(fmts: list[dict], max_kbps: int) -> Optional[str]:
    candidates = [
        f for f in fmts
        if f.get("url")
        and (not f.get("vcodec") or f["vcodec"] == "none")
        and f.get("acodec") and f["acodec"] != "none"
        and (f.get("abr") or 0) <= max_kbps + 20
    ]
    candidates.sort(key=lambda f: -(f.get("abr") or 0))
    return candidates[0]["url"] if candidates else None


def build_yt_formats(raw_fmts: list[dict], duration: Optional[float]) -> list[dict]:
    result = []
    video_heights = set(
        f["height"] for f in raw_fmts
        if f.get("vcodec") and f["vcodec"] != "none" and f.get("height")
    )

    for tier in VIDEO_TIERS:
        if not any(h >= tier["height"] for h in video_heights):
            continue
        result.append({
            "id":           f"yt_va_{tier['height']}",
            "type":         "videoaudio",
            "quality":      f"{tier['height']}p",
            "qualityLabel": f"{tier['label']} · MP4",
            "container":    "mp4",
            "hasAudio":     True,
            "hasVideo":     True,
            "filesize":     estimate_tier_size(raw_fmts, tier["height"], duration or 0) if duration else None,
            "url":          None,
        })

    has_audio = any(
        f.get("acodec") and f["acodec"] != "none" for f in raw_fmts
    )
    if has_audio:
        abrs = [f["abr"] for f in raw_fmts if f.get("abr")]
        max_abr = max(abrs) if abrs else 0
        for tier in AUDIO_TIERS:
            if tier["kbps"] != 320 and tier["kbps"] > max_abr + 20:
                continue
            result.append({
                "id":           f"yt_ao_{tier['kbps']}",
                "type":         "audioonly",
                "quality":      f"~{tier['kbps']} kbps",
                "qualityLabel": tier["label"],
                "container":    "m4a",
                "hasAudio":     True,
                "hasVideo":     False,
                "filesize":     estimate_audio_size(raw_fmts, tier["kbps"], duration or 0) if duration else None,
                "url":          find_audio_url_by_tier(raw_fmts, tier["kbps"]),
            })

    return result


def build_ig_formats(raw_fmts: list[dict]) -> list[dict]:
    """Build a simple best/audio format list for Instagram."""
    # Try to find a muxed (video+audio) format
    muxed = [
        f for f in raw_fmts
        if f.get("vcodec") and f["vcodec"] != "none"
        and f.get("acodec") and f["acodec"] != "none"
        and f.get("url")
    ]
    muxed.sort(key=lambda f: -(f.get("height") or 0))

    # Video-only formats (for merging)
    video_only = [
        f for f in raw_fmts
        if f.get("vcodec") and f["vcodec"] != "none"
        and (not f.get("acodec") or f["acodec"] == "none")
        and f.get("url")
    ]
    video_only.sort(key=lambda f: -(f.get("height") or 0))

    audio_only = [
        f for f in raw_fmts
        if (not f.get("vcodec") or f["vcodec"] == "none")
        and f.get("acodec") and f["acodec"] != "none"
        and f.get("url")
    ]
    audio_only.sort(key=lambda f: -(f.get("abr") or 0))

    result = []

    best_url = (muxed[0]["url"] if muxed else None) or (video_only[0]["url"] if video_only else None)
    result.append({
        "id":           "ig_va_best",
        "type":         "videoaudio",
        "quality":      "best",
        "qualityLabel": "Best Quality · MP4",
        "container":    "mp4",
        "hasAudio":     True,
        "hasVideo":     True,
        "filesize":     None,
        "url":          best_url,
    })

    if audio_only:
        result.append({
            "id":           "ig_ao_fallback",
            "type":         "audioonly",
            "quality":      "best",
            "qualityLabel": "Audio Only · M4A",
            "container":    "m4a",
            "hasAudio":     True,
            "hasVideo":     False,
            "filesize":     None,
            "url":          audio_only[0].get("url"),
        })

    return result


# ── Format selector resolution (mirrors youtube.ts logic) ────────────────────

def resolve_yt_format_selector(format_id: str) -> str:
    parts = format_id.split("_")   # e.g. ['yt', 'va', '1080'] or ['yt', 'ao', '320']
    kind = parts[1]
    key  = int(parts[2])

    if kind == "va":
        return f"bestvideo[height<={key}]+bestaudio/bestvideo[height<={key}][ext=mp4]+bestaudio[ext=m4a]"

    # Audio tier
    tier_map = {t["kbps"]: t["selector"] for t in AUDIO_TIERS}
    return tier_map.get(key, "bestaudio[ext=m4a]/bestaudio")


def resolve_yt_video_only_selector(format_id: str) -> str:
    parts = format_id.split("_")
    kind = parts[1]
    key  = int(parts[2]) if len(parts) > 2 else 0
    if kind != "va" or not key:
        return "bestvideo"
    return f"bestvideo[height<={key}]/bestvideo[height<={key}][ext=mp4]"


def build_selector(format_id: str) -> tuple[str, bool, str]:
    """Returns (selector, is_audio, out_ext)."""
    parts    = format_id.split("_")
    platform = parts[0]   # 'yt' | 'ig'
    kind     = parts[1]   # 'va' | 'ao'
    is_audio = kind == "ao"
    raw_key  = "_".join(parts[2:])

    if platform == "yt":
        return resolve_yt_format_selector(format_id), is_audio, "m4a" if is_audio else "mp4"

    # Instagram
    if raw_key == "best":
        return "bestvideo+bestaudio/best", False, "mp4"
    if raw_key == "fallback":
        return "bestaudio", True, "m4a"
    return raw_key, is_audio, "m4a" if is_audio else "mp4"


# ── Filename helpers ──────────────────────────────────────────────────────────

def sanitize_filename(title: str) -> str:
    return (
        re.sub(r'[\\/:*?"<>|]', "", title)
        .replace("\n", " ")
        .strip()[:200]
    ) or "download"


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/info")
def get_info(url: str = Query(..., description="YouTube or Instagram URL")):
    if not is_valid_url(url):
        raise HTTPException(status_code=400, detail="Invalid URL")

    is_yt = is_youtube_url(url)
    is_ig = is_instagram_url(url)

    if not is_yt and not is_ig:
        raise HTTPException(status_code=400, detail="Unsupported platform. Only YouTube and Instagram are supported.")

    try:
        raw = run_ytdlp(["--dump-json", "--no-playlist", "--no-warnings", url], timeout=60)
        info = json.loads(raw.strip().split("\n")[0])
    except Exception as e:
        msg = str(e)
        if "Sign in" in msg or "age" in msg:
            raise HTTPException(status_code=422, detail="This video requires sign-in or is age-restricted.")
        if "unavailable" in msg or "not available" in msg:
            raise HTTPException(status_code=422, detail="Video is unavailable or private.")
        if "spawn" in msg or "No such file" in msg:
            raise HTTPException(status_code=500, detail="yt-dlp is not installed on the server.")
        raise HTTPException(status_code=422, detail=msg)

    raw_fmts = info.get("formats") or []
    duration = info.get("duration")

    if is_yt:
        formats = build_yt_formats(raw_fmts, duration)
    else:
        formats = build_ig_formats(raw_fmts)

    if not formats:
        raise HTTPException(status_code=422, detail="No downloadable formats found for this media.")

    return {
        "platform":    "youtube" if is_yt else "instagram",
        "id":          info.get("id", ""),
        "title":       info.get("title", ""),
        "description": (info.get("description") or "")[:300],
        "thumbnail":   info.get("thumbnail") or "",
        "duration":    duration,
        "author":      info.get("uploader") or info.get("channel") or info.get("creator"),
        "viewCount":   info.get("view_count"),
        "formats":     formats,
        "originalUrl": url,
    }


@app.get("/download")
def download_media(
    url:       str           = Query(...),
    formatId:  str           = Query(...),
    title:     Optional[str] = Query(default=None),
    formatUrl: Optional[str] = Query(default=None),
):
    if not is_valid_url(url):
        raise HTTPException(status_code=400, detail="Invalid URL")

    is_yt = is_youtube_url(url)
    is_ig = is_instagram_url(url)

    if not is_yt and not is_ig:
        raise HTTPException(status_code=400, detail="Unsupported platform")

    selector, is_audio, out_ext = build_selector(formatId)
    base     = sanitize_filename(title) if title else "download"
    filename = f"{base}.{out_ext}"

    # ── Direct URL path (forward stream to client) ────────────────────────────
    if formatUrl and is_valid_url(formatUrl) and not (is_yt and is_audio):
        import urllib.request
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        }
        if "instagram.com" in formatUrl:
            headers["Referer"] = "https://www.instagram.com/"
            headers["Origin"]  = "https://www.instagram.com"

        try:
            req = urllib.request.Request(formatUrl, headers=headers)
            resp = urllib.request.urlopen(req, timeout=30)
            content_type   = resp.headers.get("Content-Type", "video/mp4" if not is_audio else "audio/mp4")
            content_length = resp.headers.get("Content-Length")

            response_headers = {
                "Content-Disposition": f"attachment; filename*=UTF-8''{urllib.parse.quote(filename)}",
                "Cache-Control":       "no-store",
                "Content-Type":        content_type,
            }
            if content_length:
                response_headers["Content-Length"] = content_length

            def stream_direct():
                while True:
                    chunk = resp.read(65536)
                    if not chunk:
                        break
                    yield chunk

            return StreamingResponse(stream_direct(), headers=response_headers)
        except Exception:
            pass  # Fall through to yt-dlp path

    # ── yt-dlp download to temp file, then stream ─────────────────────────────
    tmp_dir  = tempfile.mkdtemp()
    uid      = uuid.uuid4().hex
    template = os.path.join(tmp_dir, f"medialoader_{uid}.%(ext)s")

    try:
        if is_yt and not is_audio and formatId.startswith("yt_va_"):
            # Separate video + audio, then merge with ffmpeg
            video_template = os.path.join(tmp_dir, f"video_{uid}.%(ext)s")
            audio_template = os.path.join(tmp_dir, f"audio_{uid}.%(ext)s")
            video_selector = resolve_yt_video_only_selector(formatId)

            subprocess.run(
                [YTDLP_BIN, "-f", video_selector, "--no-playlist", "--no-part", "--no-warnings",
                 "-o", video_template, url],
                check=True, timeout=600, capture_output=True
            )
            subprocess.run(
                [YTDLP_BIN, "-f", "bestaudio", "--no-playlist", "--no-part", "--no-warnings",
                 "-o", audio_template, url],
                check=True, timeout=600, capture_output=True
            )

            # Find the downloaded files
            video_file = next(
                (os.path.join(tmp_dir, f) for f in os.listdir(tmp_dir)
                 if f.startswith(f"video_{uid}") and not f.endswith((".part", ".ytdl"))), None
            )
            audio_file = next(
                (os.path.join(tmp_dir, f) for f in os.listdir(tmp_dir)
                 if f.startswith(f"audio_{uid}") and not f.endswith((".part", ".ytdl"))), None
            )

            if not video_file or not audio_file:
                raise RuntimeError("yt-dlp produced no output files")

            merged_path = os.path.join(tmp_dir, f"merged_{uid}.mp4")
            subprocess.run(
                [FFMPEG_BIN, "-y",
                 "-i", video_file, "-i", audio_file,
                 "-map", "0:v:0", "-map", "1:a:0",
                 "-c:v", "copy", "-c:a", "aac", "-b:a", "320k",
                 merged_path],
                check=True, timeout=600, capture_output=True
            )

            final_path = merged_path
            actual_ext = "mp4"
        else:
            ytdlp_args = [
                YTDLP_BIN,
                "-f", selector,
                "--no-playlist",
                "--no-part",
                "--no-warnings",
                "-o", template,
            ]
            if is_audio:
                ytdlp_args += ["-x", "--audio-format", "m4a", "--audio-quality", "0"]
            else:
                ytdlp_args += ["--merge-output-format", "mp4"]
            ytdlp_args.append(url)

            result = subprocess.run(ytdlp_args, check=True, timeout=600, capture_output=True, text=True)

            prefix = f"medialoader_{uid}."
            files  = [
                f for f in os.listdir(tmp_dir)
                if f.startswith(prefix) and not f.endswith((".part", ".ytdl"))
            ]
            if not files:
                raise RuntimeError("yt-dlp finished but produced no output file")

            final_path = os.path.join(tmp_dir, files[0])
            actual_ext = files[0].rsplit(".", 1)[-1]

        # Adjust extension in filename
        real_filename = f"{base}.{actual_ext}"
        file_size     = os.path.getsize(final_path)
        mime = "audio/mp4" if actual_ext in ("m4a", "aac") else "video/mp4"

        import urllib.parse

        def stream_file():
            try:
                with open(final_path, "rb") as fh:
                    while True:
                        chunk = fh.read(65536)
                        if not chunk:
                            break
                        yield chunk
            finally:
                shutil.rmtree(tmp_dir, ignore_errors=True)

        return StreamingResponse(
            stream_file(),
            media_type=mime,
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{urllib.parse.quote(real_filename)}",
                "Content-Length":      str(file_size),
                "Cache-Control":       "no-store",
            },
        )

    except subprocess.CalledProcessError as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        stderr = (e.stderr or b"").decode(errors="replace").strip() if isinstance(e.stderr, bytes) else str(e.stderr or "")
        msg = stderr or f"yt-dlp exited with code {e.returncode}"

        user_msg = "Download failed. Please try again."
        if "Sign in" in msg or "age" in msg:
            user_msg = "This video requires sign-in."
        elif "unavailable" in msg:
            user_msg = "Video is unavailable."
        elif "private" in msg:
            user_msg = "This video is private."
        elif "login" in msg or "empty media" in msg:
            user_msg = "Instagram requires login for this post."

        raise HTTPException(status_code=422, detail=user_msg)

    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))
