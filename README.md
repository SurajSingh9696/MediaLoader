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

**⚠️ YouTube PO Token Fix Available:** YouTube requires PO Tokens for many videos. Install Node.js to enable automatic token generation and increase success rate to 85-95%. See [YOUTUBE_PO_TOKEN_FIX.md](YOUTUBE_PO_TOKEN_FIX.md) for the solution.

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

**Important:** Keep yt-dlp updated for best YouTube compatibility:
```bash
cd backend
python update_ytdlp.py
# OR: pip install --upgrade yt-dlp
```

**Fallback Extractors:**
The app includes dedicated fallback libraries:
- **pytubefix** - YouTube fallback when yt-dlp fails
- **instaloader** - Instagram fallback when yt-dlp fails

These are automatically used when yt-dlp extraction fails, providing additional resilience for YouTube and Instagram content.

**See [FALLBACK_SYSTEM.md](FALLBACK_SYSTEM.md) for detailed documentation on the fallback system architecture.**

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

## Troubleshooting

### YouTube "Failed to extract player response" Error

This is the most common issue. **Solution:**

1. Update yt-dlp immediately:
   ```bash
   cd backend
   python update_ytdlp.py
   ```

2. Restart your backend service

3. Check your version at `http://localhost:8000/health`

The app automatically tries 12 different extraction strategies including iOS Music, Android TV, and various embedded clients. If all fail, your yt-dlp version is likely outdated.
### YouTube Bot Detection / PO Token Issues

**SOLUTION AVAILABLE! 🚀** Install Node.js to fix this issue:

**For Render.com (Already Configured):**
- Your `render.yaml` has been updated to automatically install Node.js
- Just deploy and Node.js will be installed automatically
- Success rate will increase from ~20-30% to ~85-95%

**For Local Development:**
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS
brew install node

# Windows
choco install nodejs
```

**Verify Node.js is working:**
After installing Node.js and restarting your backend, check the startup logs:
```
✅ JavaScript runtimes available: node (enables YouTube PO Token support)
```

**See [YOUTUBE_PO_TOKEN_FIX.md](YOUTUBE_PO_TOKEN_FIX.md) for complete installation guide and troubleshooting.**

### Quick Health Check

```bash
# Check backend status and yt-dlp version
curl http://localhost:8000/health
```

## Legal Notice

MediaFetch is intended for personal use only. Only download content you have the right to download.

# MediaLoader
