from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    temp_download_dir: str = "/tmp/mediafetch"
    max_filesize_bytes: int = 2 * 1024 * 1024 * 1024
    allowed_origins: list[str] = [
        "https://media-loader.vercel.app",
    ]
    yt_dlp_retries: int = 5
    yt_dlp_socket_timeout: int = 30
    yt_dlp_concurrent_fragments: int = 4

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
