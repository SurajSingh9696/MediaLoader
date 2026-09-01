import { NextRequest, NextResponse } from 'next/server'
import { isValidUrl } from '@/lib/utils'

/**
 * GET /api/info?url=<media-url>
 *
 * Thin proxy to the Python backend (/info endpoint).
 * On Vercel (no yt-dlp available), this forwards the request to BACKEND_URL.
 * On localhost (BACKEND_URL not set), it falls back to the local extractor.
 */

const BACKEND_URL = process.env.BACKEND_URL?.replace(/\/$/, '')

async function localFallback(url: string): Promise<NextResponse> {
  // Local dev fallback — only runs when BACKEND_URL is not set
  const { extractMediaInfo } = await import('@/lib/extractor')
  const result = await extractMediaInfo(url)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }
  return NextResponse.json(result.data, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  })
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'url parameter is required' }, { status: 400 })
  }
  if (!isValidUrl(url)) {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
  }

  // ── Local dev: no BACKEND_URL set ─────────────────────────────────────────
  if (!BACKEND_URL) {
    try {
      return await localFallback(url)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected server error'
      console.error('[/api/info] local fallback error:', message)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  // ── Production: forward to Python backend ─────────────────────────────────
  try {
    const backendRes = await fetch(
      `${BACKEND_URL}/info?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(70_000) }
    )

    const data = await backendRes.json()

    if (!backendRes.ok) {
      return NextResponse.json(
        { error: (data as { detail?: string }).detail ?? 'Backend error' },
        { status: backendRes.status }
      )
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not reach backend'
    console.error('[/api/info] backend proxy error:', message)
    return NextResponse.json({ error: 'Backend service unavailable. Please try again.' }, { status: 502 })
  }
}
