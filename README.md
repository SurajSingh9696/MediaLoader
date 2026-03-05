# MediaFetch

> Download Videos from Anywhere in Seconds

A production-grade social media video downloader built with **Next.js 16**, **FastAPI**, and **yt-dlp**.

## Features

- Paste any video URL and download in seconds
- Supports YouTube, Instagram, TikTok, Twitter/X, Facebook, Reddit, Vimeo, Dailymotion, Twitch, and 100+ more
- Multiple video resolutions (360p, 480p, 720p, 1080p, 4K)
- MP3 audio extraction at 128/192/320 kbps
- Video metadata preview with thumbnail, title, duration
- Glassmorphism dark UI with Framer Motion animations
- Mobile-first responsive design

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, TailwindCSS, Framer Motion |
| Form | React Hook Form + Zod |
| HTTP | Axios |
| Backend Gateway | Next.js API Routes |
| Media Engine | Python FastAPI + yt-dlp |
| Icons | Lucide React |

## Project Structure

```
mediafetch/
├── app/
│   ├── api/
│   │   ├── metadata/route.ts
│   │   └── download/route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ui/
│   ├── navbar.tsx
│   ├── hero.tsx
│   ├── url-input.tsx
│   ├── url-section.tsx
│   ├── video-preview.tsx
│   ├── format-selector.tsx
│   ├── loading-state.tsx
│   ├── error-display.tsx
│   ├── platforms-section.tsx
│   ├── features-section.tsx
│   └── footer.tsx
├── lib/
│   ├── types.ts
│   ├── validators.ts
│   ├── api.ts
│   ├── hooks.ts
│   └── utils.ts
├── backend/
│   ├── main.py
│   ├── core/config.py
│   ├── models/schemas.py
│   ├── services/ytdlp_service.py
│   ├── routers/metadata.py
│   ├── routers/download.py
│   └── requirements.txt
├── .env.local
└── next.config.ts
```

## Setup & Development

### Prerequisites

- Node.js 18+
- Python 3.11+
- [ffmpeg](https://ffmpeg.org/download.html) installed and in PATH

### Frontend

```bash
npm install
npm run dev
```

Runs at http://localhost:3000

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Runs at http://localhost:8000

### Environment Variables

**.env.local** (frontend):
```
PYTHON_SERVICE_URL=http://localhost:8000
```

**backend/.env**:
```
TEMP_DOWNLOAD_DIR=C:/temp/mediafetch
```

## API Reference

### POST /api/metadata
```json
{ "url": "https://youtube.com/watch?v=..." }
```

### POST /api/download
```json
{ "url": "...", "type": "video", "format_id": "137" }
{ "url": "...", "type": "audio", "audio_quality": "320" }
```

## Legal Notice

MediaFetch is intended for personal use only. Only download content you have the right to download.

# MediaLoader
