# MediaLoader Python Backend

A tiny FastAPI service that wraps **yt-dlp** and **ffmpeg**.  
The Next.js frontend on Vercel proxies all media extraction and download requests to this service.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/info?url=<url>` | Returns `MediaInfo` JSON |
| `GET` | `/download?url=<url>&formatId=<id>&title=<title>` | Streams the file |

---

## Deploy on Railway (Recommended)

1. Push your repo to GitHub (the `backend/` folder is included).

2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.

3. Set the **Root Directory** to `backend` in Railway's service settings.

4. Add these environment variables in Railway:

   | Variable | Value |
   |---|---|
   | `ALLOWED_ORIGIN` | Your Vercel URL, e.g. `https://medialoader.vercel.app` |

5. Railway reads `nixpacks.toml` automatically — it will install **ffmpeg** and **yt-dlp** for you.

6. After deploy, copy the Railway service URL (e.g. `https://medialoader-api.railway.app`).

7. In your **Vercel** project → Settings → Environment Variables, add:

   | Variable | Value |
   |---|---|
   | `BACKEND_URL` | `https://medialoader-api.railway.app` |

8. Redeploy the Vercel project. Done! ✅

---

## Deploy on Render (Free tier)

> ⚠️ Render free tier **spins down** after 15 minutes of inactivity (30s cold start). Upgrade to avoid.

1. Go to [render.com](https://render.com) → **New Web Service** → connect your repo.
2. Set:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt && pip install yt-dlp`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Under **Environment**, add a custom `apt` package: add a build script or use Docker (see below).

**Important:** Render's free tier does not support arbitrary system packages via `apt`.  
Use the **Docker** approach below for Render if you need `ffmpeg`.

---

## Deploy with Docker (any platform: Fly.io, Render, VPS)

Create a `Dockerfile` in the `backend/` folder:

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
RUN pip install yt-dlp fastapi uvicorn[standard]

WORKDIR /app
COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Then deploy to **Fly.io**:
```bash
cd backend
fly launch
fly deploy
```

Or deploy to **Render** as a Docker service.

---

## Local Development

With yt-dlp and ffmpeg installed locally, you can run the backend yourself:

```bash
cd backend
pip install -r requirements.txt
pip install yt-dlp
uvicorn main:app --reload
```

Then set in your Next.js `.env.local`:
```
BACKEND_URL=http://localhost:8000
```

Or leave `BACKEND_URL` unset — the Next.js routes will fall back to calling yt-dlp directly (original behavior).
