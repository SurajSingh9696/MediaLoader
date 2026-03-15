/**
 * YouTube Extractor — yt-dlp backend
 * Uses quality tiers with ffmpeg-static for proper video+audio merging.
 */

import { runYtDlp, streamYtDlp } from './runner'
import type { MediaInfo, MediaFormat, ExtractorResult } from './types'

// ─── URL helpers ──────────────────────────────────────────────────────────────

const YT_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/watch\?.*[?&]v=([a-zA-Z0-9_-]{11})/,
]

export function extractYouTubeId(url: string): string | null {
  for (const p of YT_PATTERNS) {
    const m = url.match(p)
    if (m?.[1]) return m[1]
  }
  return null
}

export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null
}

// ─── Quality tier definitions ─────────────────────────────────────────────────

const VIDEO_TIERS = [
  { height: 2160, label: '4K (2160p)', selector: 'bestvideo[height<=2160,ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=2160]+bestaudio/best[height<=2160]' },
  { height: 1440, label: '1440p QHD',  selector: 'bestvideo[height<=1440,ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1440]+bestaudio/best[height<=1440]' },
  { height: 1080, label: '1080p FHD',  selector: 'bestvideo[height<=1080,ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]' },
  { height: 720,  label: '720p HD',    selector: 'bestvideo[height<=720,ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]' },
  { height: 480,  label: '480p SD',    selector: 'bestvideo[height<=480,ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]' },
  { height: 360,  label: '360p',       selector: 'bestvideo[height<=360,ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=360]+bestaudio/best[height<=360]' },
] as const

const AUDIO_TIERS = [
  { kbps: 320, label: 'Best Quality · M4A',    selector: 'bestaudio[ext=m4a]/bestaudio' },
  { kbps: 128, label: '~128 kbps · M4A', selector: 'bestaudio[abr<=132,ext=m4a]/bestaudio[abr<=132]/bestaudio' },
  { kbps: 64,  label: '~64 kbps · M4A',  selector: 'bestaudio[abr<=72,ext=m4a]/bestaudio[abr<=72]/bestaudio' },
] as const

// ─── yt-dlp types ─────────────────────────────────────────────────────────────

interface RawFormat {
  format_id: string
  vcodec?: string
  acodec?: string
  height?: number
  abr?: number
}

interface RawInfo {
  id: string
  title: string
  description?: string
  thumbnail?: string
  duration?: number
  view_count?: number
  uploader?: string
  formats?: RawFormat[]
}

// ─── Format builder ───────────────────────────────────────────────────────────

function buildFormats(rawFmts: RawFormat[]): MediaFormat[] {
  const result: MediaFormat[] = []

  // Available video heights (muxed and video-only)
  const videoHeights = new Set<number>(
    rawFmts.filter(f => f.vcodec && f.vcodec !== 'none' && f.height).map(f => f.height!)
  )

  // Offer only quality tiers for which the video has a stream at that height
  for (const tier of VIDEO_TIERS) {
    if (![...videoHeights].some(h => h >= tier.height)) continue
    result.push({
      id: `yt_va_${tier.height}`,
      type: 'videoaudio',
      quality: `${tier.height}p`,
      qualityLabel: `${tier.label} · MP4`,
      container: 'mp4',
      hasAudio: true,
      hasVideo: true,
    })
  }

  // Audio tiers — only if audio streams exist
  const hasAudio = rawFmts.some(f => f.acodec && f.acodec !== 'none')
  if (hasAudio) {
    const maxAbr = Math.max(...rawFmts.filter(f => f.abr).map(f => f.abr!))
    for (const tier of AUDIO_TIERS) {
      // Skip low-quality tiers if the video doesn't even have that bitrate
      if (tier.kbps !== 320 && tier.kbps > maxAbr + 20) continue
      result.push({
        id: `yt_ao_${tier.kbps}`,
        type: 'audioonly',
        quality: `~${tier.kbps} kbps`,
        qualityLabel: tier.label,
        container: 'm4a',
        hasAudio: true,
        hasVideo: false,
      })
    }
  }

  return result
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function getYouTubeInfo(url: string): Promise<ExtractorResult> {
  if (!isYouTubeUrl(url)) return { success: false, error: 'Invalid YouTube URL' }

  try {
    const raw = await runYtDlp(['--dump-json', '--no-playlist', '--no-warnings', url])
    const info: RawInfo = JSON.parse(raw.trim().split('\n')[0])
    const formats = buildFormats(info.formats ?? [])

    if (formats.length === 0) {
      return { success: false, error: 'No downloadable formats found for this video.' }
    }

    return {
      success: true,
      data: {
        platform: 'youtube',
        id: info.id,
        title: info.title,
        description: info.description?.slice(0, 300),
        thumbnail: info.thumbnail ?? '',
        duration: info.duration,
        author: info.uploader,
        viewCount: info.view_count,
        formats,
        originalUrl: url,
      },
    }
  } catch (err) {
    let msg = err instanceof Error ? err.message : 'yt-dlp failed'
    if (msg.includes('Sign in') || msg.includes('age')) {
      msg = 'This video requires sign-in or is age-restricted.'
    } else if (msg.includes('unavailable') || msg.includes('not available')) {
      msg = 'Video is unavailable or private.'
    } else if (msg.includes('spawn error')) {
      msg = 'yt-dlp is not installed or not in PATH.'
    }
    return { success: false, error: msg }
  }
}

/** Resolve internal formatId → yt-dlp format selector string */
export function resolveYtFormatSelector(formatId: string): string {
  const parts = formatId.split('_')  // ['yt', 'va'|'ao', '1080'|'320']
  const type = parts[1]
  const key = parseInt(parts[2])

  if (type === 'va') {
    const tier = VIDEO_TIERS.find(t => t.height === key)
    return tier?.selector ?? `bestvideo[height<=${key}]+bestaudio/best`
  }
  const tier = AUDIO_TIERS.find(t => t.kbps === key)
  return tier?.selector ?? 'bestaudio[ext=m4a]/bestaudio'
}

export function getYouTubeDownloadStream(url: string, formatSelector: string) {
  return streamYtDlp(['-f', formatSelector, '--no-playlist', '--no-warnings', '-o', '-', url])
}
