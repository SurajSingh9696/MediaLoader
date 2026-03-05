import asyncio
import logging
import mimetypes
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from backend.models.schemas import DownloadVideoRequest, DownloadAudioRequest
from backend.services import ytdlp_service
from backend.services.ytdlp_service import _classify_error

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/download", tags=["download"])

_LOOP_DELAY_CLEANUP = 60


def _schedule_cleanup(file_path: Path) -> None:
    try:
        loop = asyncio.get_event_loop()
        loop.call_later(_LOOP_DELAY_CLEANUP, ytdlp_service.cleanup_file, file_path)
    except RuntimeError:
        ytdlp_service.cleanup_file(file_path)


@router.post("/video")
async def download_video(request: DownloadVideoRequest):
    file_path: Path | None = None
    try:
        file_path, filename = await ytdlp_service.download_video(
            request.url, format_id=request.format_id
        )

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        file_size = file_path.stat().st_size
        media_type = mimetypes.guess_type(str(file_path))[0] or "video/mp4"

        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(file_size),
            "Cache-Control": "no-cache",
            "X-Filename": filename,
        }

        _schedule_cleanup(file_path)

        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type=media_type,
            headers=headers,
        )

    except HTTPException:
        if file_path:
            ytdlp_service.cleanup_file(file_path)
        raise
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Downloaded file not found on server.") from exc
    except Exception as exc:
        if file_path:
            ytdlp_service.cleanup_file(file_path)
        status_code, detail = _classify_error(exc)
        logger.error("Video download error for %s: %s", request.url, exc)
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.post("/audio")
async def download_audio(request: DownloadAudioRequest):
    file_path: Path | None = None
    try:
        file_path, filename = await ytdlp_service.download_audio(
            request.url, quality=request.audio_quality or "192"
        )

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        file_size = file_path.stat().st_size

        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(file_size),
            "Cache-Control": "no-cache",
            "X-Filename": filename,
        }

        _schedule_cleanup(file_path)

        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type="audio/mpeg",
            headers=headers,
        )

    except HTTPException:
        if file_path:
            ytdlp_service.cleanup_file(file_path)
        raise
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Audio file not found on server.") from exc
    except Exception as exc:
        if file_path:
            ytdlp_service.cleanup_file(file_path)
        status_code, detail = _classify_error(exc)
        logger.error("Audio download error for %s: %s", request.url, exc)
        raise HTTPException(status_code=status_code, detail=detail) from exc

