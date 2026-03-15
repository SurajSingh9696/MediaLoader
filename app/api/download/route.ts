import { NextRequest, NextResponse } from 'next/server'
import type { Readable } from 'stream'
import { isYouTubeUrl, extractYouTubeId, resolveYtFormatSelector } from '@/lib/extractor/youtube'
import { isInstagramUrl, extractInstagramShortcode } from '@/lib/extractor/instagram'
import { streamYtDlp } from '@/lib/extractor/runner'
import { isValidUrl } from '@/lib/utils'
import type { ChildProcess } from 'child_process'

// Convert Node.js Readable → Web ReadableStream
function nodeToWebStream(nodeStream: Readable, proc: ChildProcess): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
      nodeStream.on('end', () => controller.close())
      nodeStream.on('error', (err) => { controller.error(err); proc.kill() })
    },
    cancel() { proc.kill() },
  })
}

/** Resolve yt-dlp format selector from our internal formatId */
function getFormatSelector(formatId: string): { selector: string; isAudio: boolean; ext: string } {
  const parts = formatId.split('_')
  const type = parts[1] // 'va' or 'ao'
  const isAudio = type === 'ao'
  const ext = isAudio ? 'm4a' : 'mp4'

  // Handle Instagram special cases
  if (parts[0] === 'ig') {
    const raw = parts.slice(2).join('_')
    if (raw === 'best') return { selector: 'bestvideo+bestaudio/best', isAudio: false, ext: 'mp4' }
    if (raw === 'fallback') return { selector: 'bestaudio', isAudio: true, ext: 'm4a' }
    return { selector: raw, isAudio, ext }
  }

  // YouTube — use the tier resolver
  return { selector: resolveYtFormatSelector(formatId), isAudio, ext }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const url = searchParams.get('url')
  const formatId = searchParams.get('formatId')

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

  const { selector, isAudio, ext } = getFormatSelector(formatId)

  // Build filename
  let baseName = 'media'
  if (isYT) baseName = `yt_${extractYouTubeId(url) ?? 'video'}`
  if (isIG) baseName = `ig_${extractInstagramShortcode(url) ?? 'video'}`
  const filename = `${baseName}.${ext}`

  const { stream, proc } = streamYtDlp([
    '-f', selector,
    '--no-playlist',
    '--no-warnings',
    '-o', '-',
    url,
  ])

  const webStream = nodeToWebStream(stream, proc)

  return new NextResponse(webStream, {
    headers: {
      'Content-Type': isAudio ? 'audio/mp4' : 'video/mp4',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-store',
    },
  })
}
