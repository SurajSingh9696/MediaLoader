from pydantic import BaseModel, field_validator
from typing import Optional


class UrlRequest(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        if len(v) > 2048:
            raise ValueError("URL is too long")
        return v


class VideoFormat(BaseModel):
    format_id: str
    resolution: Optional[str] = None
    ext: str
    filesize: Optional[int] = None
    acodec: Optional[str] = None
    vcodec: Optional[str] = None
    tbr: Optional[float] = None
    abr: Optional[float] = None
    vbr: Optional[float] = None
    format_note: Optional[str] = None
    height: Optional[int] = None
    width: Optional[int] = None


class VideoMetadata(BaseModel):
    title: str
    thumbnail: Optional[str] = None
    duration: Optional[float] = None
    uploader: Optional[str] = None
    platform: str
    url: str
    formats: list[VideoFormat]
    description: Optional[str] = None
    view_count: Optional[int] = None
    like_count: Optional[int] = None


class DownloadVideoRequest(BaseModel):
    url: str
    format_id: Optional[str] = None

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        return v


class DownloadAudioRequest(BaseModel):
    url: str
    audio_quality: Optional[str] = "192"

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        return v

    @field_validator("audio_quality")
    @classmethod
    def validate_quality(cls, v: Optional[str]) -> str:
        if v not in ("128", "192", "320", None):
            raise ValueError("audio_quality must be 128, 192, or 320")
        return v or "192"
