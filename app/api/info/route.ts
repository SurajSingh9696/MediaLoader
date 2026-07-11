import { NextRequest, NextResponse } from 'next/server'
import { extractMediaInfo } from '@/lib/extractor'
import { isValidUrl } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'url parameter is required' }, { status: 400 })
  }

  if (!isValidUrl(url)) {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
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
