# Vercel Parity Deployment (Recommended)

This setup keeps frontend on Vercel and moves heavy media extraction/download work to a Docker service.

## Why this keeps behavior consistent

- Vercel handles UI and lightweight API proxying.
- Docker service handles yt-dlp + ffmpeg in a stable Linux runtime.
- Same extraction/download code path runs in container every time.

## 1) Deploy downloader container

Option A: Local/VPS quick start

```bash
docker compose -f docker-compose.downloader.yml up -d --build
```

Option B: Any container host (Railway/Fly/Render/etc)

- Use `Dockerfile.downloader`.
- Expose port `3000`.
- Set env: `ENABLE_EXTERNAL_DOWNLOADER_PROXY=false`.

## 2) Configure Vercel project env vars

Set these in Vercel Environment Variables:

- `ENABLE_EXTERNAL_DOWNLOADER_PROXY=true`
- `EXTERNAL_DOWNLOADER_URL=https://<your-downloader-domain>`

Do **not** set `ENABLE_EXTERNAL_DOWNLOADER_PROXY=true` in the Docker downloader service.

## 3) Verify

- `GET /api/info?url=<media-url>` should return metadata through proxy.
- `GET /api/download?...` should stream file through proxy.
- If downloader is down, Vercel APIs return `502` with clear upstream error.

## Optional hardening

- Put downloader behind a private network and add auth token between Vercel and downloader.
- Add rate limiting at downloader ingress.
- Pin `yt-dlp` version in Docker image for deterministic behavior.
