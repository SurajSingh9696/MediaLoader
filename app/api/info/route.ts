import { NextRequest, NextResponse } from 'next/server'
import { extractMediaInfo } from '@/lib/extractor'
import { isValidUrl } from '@/lib/utils'

const PROXY_ENABLED = process.env.ENABLE_EXTERNAL_DOWNLOADER_PROXY === 'true'
const EXTERNAL_DOWNLOADER_URL = process.env.EXTERNAL_DOWNLOADER_URL?.replace(/\/+$/, '')

function canProxyToExternalDownloader(): boolean {
  return PROXY_ENABLED && !!EXTERNAL_DOWNLOADER_URL
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'url parameter is required' }, { status: 400 })
  }

  if (!isValidUrl(url)) {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
  }

  if (canProxyToExternalDownloader()) {
    try {
      const upstream = await fetch(
        `${EXTERNAL_DOWNLOADER_URL}/api/info?url=${encodeURIComponent(url)}`,
        {
          headers: {
            Accept: 'application/json',
          },
          cache: 'no-store',
        }
      )

      const contentType = upstream.headers.get('content-type') ?? ''
      if (!contentType.toLowerCase().includes('application/json')) {
        const text = await upstream.text()
        return NextResponse.json(
          { error: text || 'External downloader returned non-JSON response.' },
          { status: upstream.status || 502 }
        )
      }

      const json = await upstream.json()
      return NextResponse.json(json, { status: upstream.status })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'External downloader request failed'
      return NextResponse.json({ error: message }, { status: 502 })
    }
  }

  try {
    const result = await extractMediaInfo(url)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 })
    }

    return NextResponse.json(result.data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    console.error('[/api/info]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
