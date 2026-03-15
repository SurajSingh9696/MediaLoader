/**
 * Instagram Extractor
 *
 * Strategy (in order of preference):
 *  1. yt-dlp (most reliable, handles auth/rate limits well)
 *  2. Instagram oEmbed API for title/thumbnail
 *  3. Instagram embed page scraping
 *  4. Instagram GraphQL endpoint
 *
 * Note: Instagram aggressively rate-limits and blocks bots.
 * This extractor works for public posts/reels only.
 */

import { runYtDlp, streamYtDlp } from './runner'
import type { MediaInfo, MediaFormat, ExtractorResult } from './types'

// ─── URL helpers ────────────────────────────────────────────────────────────

const IG_PATTERNS = [
  // Post
  /instagram\.com\/p\/([A-Za-z0-9_-]+)/,
  // Reel
  /instagram\.com\/reel(?:s)?\/([A-Za-z0-9_-]+)/,
  // Story (limited support)
  /instagram\.com\/stories\/[^/]+\/([0-9]+)/,
  // Username/video format
  /instagram\.com\/tv\/([A-Za-z0-9_-]+)/,
]

export function extractInstagramShortcode(url: string): string | null {
  for (const pattern of IG_PATTERNS) {
    const match = url.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

export function isInstagramUrl(url: string): boolean {
  return extractInstagramShortcode(url) !== null
}

type InstagramPostType = 'post' | 'reel' | 'tv'

function getPostType(url: string): InstagramPostType {
  if (/\/reel/.test(url)) return 'reel'
  if (/\/tv\//.test(url)) return 'tv'
  return 'post'
}

// ─── Shared fetch headers ───────────────────────────────────────────────────

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
}

// ─── Approach 1 — oEmbed API ─────────────────────────────────────────────────

interface OEmbedData {
  title?: string
  author_name?: string
  thumbnail_url?: string
  thumbnail_width?: number
  thumbnail_height?: number
}

async function fetchOEmbed(url: string): Promise<OEmbedData | null> {
  try {
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}&maxwidth=640`
    const res = await fetch(oembedUrl, { headers: { 'User-Agent': BROWSER_HEADERS['User-Agent'] } })
    if (!res.ok) return null
    return res.json() as Promise<OEmbedData>
  } catch {
    return null
  }
}

// ─── Approach 2 — Embed page scraping ────────────────────────────────────────

interface EmbedScrapedData {
  videoUrl?: string
  thumbnailUrl?: string
}

async function scrapeEmbedPage(shortcode: string): Promise<EmbedScrapedData> {
  const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`
  try {
    const res = await fetch(embedUrl, { headers: BROWSER_HEADERS })
    if (!res.ok) return {}
    const html = await res.text()

    const result: EmbedScrapedData = {}

    // Extract video_url from the embed HTML (Instagram puts it in a JSON blob)
    const videoUrlPatterns = [
      /video_url":"(https:[^"]+)"/,
      /"video_url":"([^"]+)"/,
      /src="(https:\/\/[^"]*\.mp4[^"]*)"/,
    ]
    for (const p of videoUrlPatterns) {
      const m = html.match(p)
      if (m?.[1]) {
        result.videoUrl = m[1].replace(/\\u0026/g, '&').replace(/\\/g, '')
        break
      }
    }

    // Extract thumbnail / display_url
    const thumbPatterns = [
      /"display_url":"([^"]+)"/,
      /display_url":"(https:[^"]+)"/,
    ]
    for (const p of thumbPatterns) {
      const m = html.match(p)
      if (m?.[1]) {
        result.thumbnailUrl = m[1].replace(/\\u0026/g, '&').replace(/\\/g, '')
        break
      }
    }

    return result
  } catch {
    return {}
  }
}

// ─── Approach 3 — GraphQL / query endpoint ───────────────────────────────────

interface GraphQLData {
  videoUrl?: string
  thumbnailUrl?: string
  title?: string
  owner?: string
  viewCount?: number
  duration?: number
}

async function fetchGraphQL(shortcode: string): Promise<GraphQLData | null> {
  // Try the unofficial ?__a=1 endpoint
  try {
    const apiUrl = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`
    const res = await fetch(apiUrl, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: 'application/json',
        'X-IG-App-ID': '936619743392459',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (!res.ok) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json()

    const media =
      json?.graphql?.shortcode_media ??
      json?.items?.[0]

    if (!media) return null

    const isVideo = media.is_video || media.media_type === 2
    if (!isVideo) return null

    return {
      videoUrl: media.video_url,
      thumbnailUrl:
        media.thumbnail_src ||
        media.image_versions2?.candidates?.[0]?.url,
      title: media.title || media.edge_media_to_caption?.edges?.[0]?.node?.text,
      owner: media.owner?.username,
      viewCount: media.video_view_count,
      duration: media.video_duration,
    }
  } catch {
    return null
  }
}

// ─── yt-dlp extractor (primary) ──────────────────────────────────────────────

interface YtDlpIgInfo {
  id: string
  title?: string
  description?: string
  thumbnail?: string
  duration?: number
  view_count?: number
  uploader?: string
  formats?: Array<{
    format_id: string
    ext: string
    vcodec?: string
    acodec?: string
    height?: number
    tbr?: number
    abr?: number
    filesize?: number
    filesize_approx?: number
    url?: string
  }>
  url?: string // single-format fallback
}

async function getInstagramViaYtDlp(url: string): Promise<ExtractorResult | null> {
  try {
    const raw = await runYtDlp([
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      url,
    ])
    const info: YtDlpIgInfo = JSON.parse(raw.trim().split('\n')[0])

    const formats: MediaFormat[] = []

    const fmts = info.formats ?? []
    // Video+Audio
    const muxed = fmts
      .filter(f => f.vcodec && f.vcodec !== 'none' && f.acodec && f.acodec !== 'none' && f.url)
      .sort((a, b) => (b.height ?? 0) - (a.height ?? 0))

    if (muxed.length > 0) {
      const f = muxed[0]
      formats.push({
        id: `ig_va_${f.format_id}`,
        type: 'videoaudio',
        quality: f.height ? `${f.height}p` : 'Best',
        qualityLabel: `${f.height ? `${f.height}p` : 'Best Quality'} · MP4`,
        container: 'mp4',
        filesize: f.filesize ?? f.filesize_approx,
        hasAudio: true,
        hasVideo: true,
        url: f.url,
      })
    } else if (info.url) {
      // Single-format (no formats array)
      formats.push({
        id: 'ig_va_best',
        type: 'videoaudio',
        quality: 'Best',
        qualityLabel: 'Best Quality · MP4',
        container: 'mp4',
        hasAudio: true,
        hasVideo: true,
        url: info.url,
      })
    }

    // Audio only
    const audioOnly = fmts
      .filter(f => (f.vcodec === 'none' || !f.vcodec) && f.acodec && f.acodec !== 'none' && f.url)
      .sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0))

    if (audioOnly.length > 0) {
      const f = audioOnly[0]
      formats.push({
        id: `ig_ao_${f.format_id}`,
        type: 'audioonly',
        quality: f.abr ? `${Math.round(f.abr)}kbps` : 'Best',
        qualityLabel: `${f.abr ? `${Math.round(f.abr)} kbps` : 'Best'} · M4A`,
        container: 'm4a',
        filesize: f.filesize ?? f.filesize_approx,
        hasAudio: true,
        hasVideo: false,
        url: f.url,
      })
    } else if (formats.length > 0) {
      // Use video URL as audio fallback
      formats.push({
        id: 'ig_ao_fallback',
        type: 'audioonly',
        quality: 'best',
        qualityLabel: 'Audio Only · MP4',
        container: 'mp4',
        hasAudio: true,
        hasVideo: false,
        url: formats[0].url,
      })
    }

    if (formats.length === 0) return null

    return {
      success: true,
      data: {
        platform: 'instagram',
        id: info.id,
        title: info.title ?? 'Instagram Video',
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
    const msg = err instanceof Error ? err.message : ''
    // Surface auth errors immediately — scraping fallback won't help
    if (msg.includes('empty media response') || msg.includes('login') || msg.includes('cookies')) {
      return {
        success: false,
        error: 'Instagram requires login for this post. Only public posts/Reels accessible without an account can be downloaded.',
      }
    }
    return null
  }
}

// ─── Main extractor ───────────────────────────────────────────────────────────

export async function getInstagramInfo(url: string): Promise<ExtractorResult> {
  const shortcode = extractInstagramShortcode(url)
  if (!shortcode) return { success: false, error: 'Invalid Instagram URL' }

  // Try yt-dlp first (most reliable)
  const ytdlpResult = await getInstagramViaYtDlp(url)
  // If yt-dlp returned a definitive error (e.g. auth required), stop here
  if (ytdlpResult && !ytdlpResult.success) return ytdlpResult
  // If yt-dlp succeeded, return immediately
  if (ytdlpResult?.success) return ytdlpResult

  const postType = getPostType(url)

  // Run parallel fallback requests
  const [oEmbed, embedData, graphqlData] = await Promise.all([
    fetchOEmbed(url),
    scrapeEmbedPage(shortcode),
    fetchGraphQL(shortcode),
  ])

  // Determine video URL (prefer GraphQL > embed scraping)
  const videoUrl = graphqlData?.videoUrl ?? embedData.videoUrl

  if (!videoUrl) {
    return {
      success: false,
      error:
        'Instagram requires login to access this content. Only fully public posts/Reels (visible without an account) can be downloaded. Private accounts and login-gated content are not supported.',
    }
  }

  // Build thumbnail
  const thumbnail =
    graphqlData?.thumbnailUrl ??
    embedData.thumbnailUrl ??
    oEmbed?.thumbnail_url ??
    ''

  // Build title / author
  const title =
    graphqlData?.title ||
    oEmbed?.title ||
    `Instagram ${postType.charAt(0).toUpperCase() + postType.slice(1)}`

  const author = graphqlData?.owner ?? oEmbed?.author_name ?? 'Instagram User'

  // Build formats  — Instagram typically serves a single MP4 with audio
  const formats: MediaFormat[] = [
    {
      id: `ig_va_mp4`,
      type: 'videoaudio',
      quality: '720p',
      qualityLabel: 'Best Quality · MP4',
      container: 'mp4',
      hasAudio: true,
      hasVideo: true,
      url: videoUrl,
    },
    {
      id: 'ig_ao_mp4',
      type: 'audioonly',
      quality: 'best',
      qualityLabel: 'Audio Only · M4A',
      container: 'm4a',
      hasAudio: true,
      hasVideo: false,
      url: videoUrl, // Same source, stripped server-side or client-side
    },
  ]

  const mediaInfo: MediaInfo = {
    platform: 'instagram',
    id: shortcode,
    title,
    thumbnail,
    duration: graphqlData?.duration,
    author,
    viewCount: graphqlData?.viewCount,
    formats,
    originalUrl: url,
  }

  return { success: true, data: mediaInfo }
}
