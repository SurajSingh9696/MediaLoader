import logging

from fastapi import APIRouter, HTTPException

from backend.models.schemas import UrlRequest, VideoMetadata
from backend.services import ytdlp_service
from backend.services.ytdlp_service import _classify_error

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/metadata", tags=["metadata"])


@router.post("", response_model=VideoMetadata)
async def get_video_metadata(request: UrlRequest) -> VideoMetadata:
    try:
        return await ytdlp_service.get_metadata(request.url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        status_code, detail = _classify_error(exc)
        logger.error("Metadata extraction error for %s: %s", request.url, exc)
        raise HTTPException(status_code=status_code, detail=detail) from exc

