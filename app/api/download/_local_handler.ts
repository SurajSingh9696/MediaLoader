/**
 * Local development fallback for the download route.
 * This file is only imported when BACKEND_URL is NOT set (i.e. local dev with yt-dlp installed).
 * It contains the original yt-dlp-based download logic verbatim.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createReadStream, statSync, unlink, existsSync, unlinkSync } from 'fs'
import { isYouTubeUrl, resolveYtFormatSelector, resolveYtVideoOnlySelector } from '@/lib/extractor/youtube'
import { isInstagramUrl, resolveInstagramDirectMediaUrl } from '@/lib/extractor/instagram'
import { mergeVideoWithBestAudio, runYtDlpToFile } from '@/lib/extractor/runner'
import { isValidUrl } from '@/lib/utils'

/** Strip characters that are invalid in filenames across all major OS */
function sanitizeFilename(title: string): string {
  return title
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
    || 'download'
}

/** Build a yt-dlp format selector from our internal formatId */
function buildSelector(formatId: string): { selector: string; isAudio: boolean; outExt: string } {
  const parts    = formatId.split('_')
  const platform = parts[0]
  const type     = parts[1]
  const isAudio  = type === 'ao'
  const rawKey   = parts.slice(2).join('_')

  if (platform === 'yt') {
    return {
      selector: resolveYtFormatSelector(formatId),
      isAudio,
      outExt: isAudio ? 'm4a' : 'mp4',
    }
  }

  if (rawKey === 'best') return { selector: 'bestvideo+bestaudio/best', isAudio: false, outExt: 'mp4' }
  if (rawKey === 'fallback') return { selector: 'bestaudio', isAudio: true, outExt: 'm4a' }
  return { selector: rawKey, isAudio, outExt: isAudio ? 'm4a' : 'mp4' }
}

/** Stream a local file to the client, then unlink it */
function fileToWebStream(filePath: string): ReadableStream<Uint8Array> {
  const nodeStream = createReadStream(filePath)
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data',  (chunk: Buffer | string) => controller.enqueue(new Uint8Array(Buffer.from(chunk))))
      nodeStream.on('end',   () => { controller.close();       unlink(filePath, () => {}) })
      nodeStream.on('error', (err) => { controller.error(err); unlink(filePath, () => {}) })
    },
    cancel() { nodeStream.destroy(); unlink(filePath, () => {}) },
  })
}

function safeUnlink(filePath?: string) {
  if (!filePath) return
  try {
    if (existsSync(filePath)) unlinkSync(filePath)
  } catch {
    // Ignore cleanup errors.
  }
}

async function tryStreamDirectMedia(
  mediaUrl: string,
  filename: string,
  isAudio: boolean
): Promise<NextResponse | null> {
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  }

  if (/instagram\.com/i.test(mediaUrl)) {
    headers.Referer = 'https://www.instagram.com/'
    headers.Origin = 'https://www.instagram.com'
  }

  try {
    const directRes = await fetch(mediaUrl, { headers })
    if (!directRes.ok || !directRes.body) return null

    const contentType = directRes.headers.get('content-type') || (isAudio ? 'audio/mp4' : 'video/mp4')
    const contentLength = directRes.headers.get('content-length') ?? undefined

    return new NextResponse(directRes.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-store',
        ...(contentLength ? { 'Content-Length': contentLength } : {}),
      },
    })
  } catch {
    return null
  }
}

export default async function localDownloadHandler(request: NextRequest): Promise<NextResponse> {
  const sp       = request.nextUrl.searchParams
  const url      = sp.get('url')!
  const formatId = sp.get('formatId')!
  const title    = sp.get('title') ?? ''
  const formatUrl = sp.get('formatUrl')

  const isYT = isYouTubeUrl(url)
  const isIG = isInstagramUrl(url)

  const { selector, isAudio, outExt } = buildSelector(formatId)
  const base = title ? sanitizeFilename(title) : 'download'
  const preferredFilename = `${base}.${outExt}`

  if (formatUrl && isValidUrl(formatUrl) && !(isYT && isAudio)) {
    const directResponse = await tryStreamDirectMedia(formatUrl, preferredFilename, isAudio)
    if (directResponse) return directResponse
  }

  if (isIG) {
    const instagramDirect = await resolveInstagramDirectMediaUrl(url)
    if (instagramDirect) {
      const directResponse = await tryStreamDirectMedia(instagramDirect, preferredFilename, isAudio)
      if (directResponse) return directResponse
    }
  }

  let filePath: string
  let actualExt: string
  let tempVideoPath: string | undefined
  let tempAudioPath: string | undefined

  try {
    if (isYT && !isAudio && formatId.startsWith('yt_va_')) {
      const videoSelector = resolveYtVideoOnlySelector(formatId)

      const videoResult = await runYtDlpToFile([
        '-f', videoSelector,
        '--no-playlist',
        url,
      ])
      tempVideoPath = videoResult.filePath

      const audioResult = await runYtDlpToFile([
        '-f', 'bestaudio',
        '--no-playlist',
        url,
      ])
      tempAudioPath = audioResult.filePath

      const merged = await mergeVideoWithBestAudio(tempVideoPath, tempAudioPath)
      filePath = merged.filePath
      actualExt = merged.ext

      safeUnlink(tempVideoPath)
      safeUnlink(tempAudioPath)
      tempVideoPath = undefined
      tempAudioPath = undefined
    } else {
      const result = await runYtDlpToFile([
        '-f', selector,
        '--no-playlist',
        ...(isAudio
          ? ['-x', '--audio-format', 'm4a', '--audio-quality', '0']
          : ['--merge-output-format', 'mp4']),
        url,
      ])
      filePath  = result.filePath
      actualExt = result.ext
    }
  } catch (err) {
    safeUnlink(tempVideoPath)
    safeUnlink(tempAudioPath)

    const msg = err instanceof Error ? err.message : 'Download failed'
    console.error('[/api/download] yt-dlp error:', msg)

    let userMsg = 'Download failed. Please try again.'
    if (msg.includes('Sign in') || msg.includes('age'))    userMsg = 'This video requires sign-in.'
    if (msg.includes('unavailable'))                       userMsg = 'Video is unavailable.'
    if (msg.includes('private'))                           userMsg = 'This video is private.'
    if (msg.includes('empty media') || msg.includes('login')) userMsg = 'Instagram requires login for this post.'

    return NextResponse.json({ error: userMsg }, { status: 422 })
  }

  const ext      = actualExt || outExt
  const filename = `${base}.${ext}`

  let contentLength: string | undefined
  try {
    contentLength = statSync(filePath).size.toString()
  } catch { /* non-fatal */ }

  const mimeType = ext === 'm4a' || ext === 'webm' && isAudio ? 'audio/mp4' : 'video/mp4'

  return new NextResponse(fileToWebStream(filePath), {
    headers: {
      'Content-Type':        mimeType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Transfer-Encoding':   'chunked',
      'Cache-Control':       'no-store',
      ...(contentLength ? { 'Content-Length': contentLength } : {}),
    },
  })
}
