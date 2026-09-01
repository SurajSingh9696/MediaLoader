import { NextRequest, NextResponse } from 'next/server'
import { isYouTubeUrl } from '@/lib/extractor/youtube'
import { isInstagramUrl } from '@/lib/extractor/instagram'
import { isValidUrl } from '@/lib/utils'

/**
 * GET /api/download?url=&formatId=&title=&formatUrl=
 *
 * Thin proxy to the Python backend (/download endpoint).
 * On Vercel (BACKEND_URL set): streams the download from the Python service.
 * On localhost (BACKEND_URL not set): falls back to the original local yt-dlp logic.
 */

// Allow up to 5 minutes for large video downloads
export const maxDuration = 300

const BACKEND_URL = process.env.BACKEND_URL?.replace(/\/$/, '')

/** Strip characters that are invalid in filenames across all major OS */
function sanitizeFilename(title: string): string {
  return title
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
    || 'download'
}

async function localFallbackDownload(request: NextRequest): Promise<NextResponse> {
  // Dynamically import original download logic — only used in local dev
  const { default: localHandler } = await import('./_local_handler')
  return localHandler(request)
}

export async function GET(request: NextRequest) {
  const sp        = request.nextUrl.searchParams
  const url       = sp.get('url')
  const formatId  = sp.get('formatId')
  const title     = sp.get('title') ?? ''
  const formatUrl = sp.get('formatUrl') ?? ''

  if (!url || !formatId) {
    return NextResponse.json({ error: 'url and formatId are required' }, { status: 400 })
  }
  if (!isValidUrl(url)) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const isYT = isYouTubeUrl(url)
  const isIG = isInstagramUrl(url)
  if (!isYT && !isIG) {
    return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 })
  }

  // ── Local dev fallback ────────────────────────────────────────────────────
  if (!BACKEND_URL) {
    return localFallbackDownload(request)
  }

  // ── Production: proxy stream from Python backend ──────────────────────────
  const params = new URLSearchParams({
    url,
    formatId,
    ...(title     ? { title }     : {}),
    ...(formatUrl ? { formatUrl } : {}),
  })

  let backendRes: Response
  try {
    backendRes = await fetch(`${BACKEND_URL}/download?${params}`, {
      signal: AbortSignal.timeout(310_000), // slightly above maxDuration
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error'
    console.error('[/api/download] backend fetch error:', msg)
    return NextResponse.json({ error: 'Backend service unavailable. Please try again.' }, { status: 502 })
  }

  if (!backendRes.ok || !backendRes.body) {
    let detail = 'Download failed.'
    try {
      const errJson = await backendRes.json() as { detail?: string }
      detail = errJson.detail ?? detail
    } catch { /* non-fatal */ }
    console.error('[/api/download] backend error:', detail)
    return NextResponse.json({ error: detail }, { status: backendRes.status })
  }

  // Forward all relevant headers from the Python response
  const forwardHeaders: Record<string, string> = {
    'Cache-Control': 'no-store',
  }
  const passThrough = [
    'content-type',
    'content-disposition',
    'content-length',
    'transfer-encoding',
  ]
  for (const h of passThrough) {
    const val = backendRes.headers.get(h)
    if (val) forwardHeaders[h] = val
  }

  // Ensure a sensible Content-Disposition fallback
  if (!forwardHeaders['content-disposition']) {
    const base = title ? sanitizeFilename(title) : 'download'
    forwardHeaders['content-disposition'] =
      `attachment; filename*=UTF-8''${encodeURIComponent(base)}`
  }

  return new NextResponse(backendRes.body, { headers: forwardHeaders })
}
