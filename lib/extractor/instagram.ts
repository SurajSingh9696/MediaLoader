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

import { runYtDlp } from './runner'
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

function normalizeInstagramUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (!/instagram\.com$/i.test(parsed.hostname) && !/\.instagram\.com$/i.test(parsed.hostname)) {
      return url
    }

    // Remove share tracking params/hash; keep only canonical path.
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}/`
  } catch {
    return url
  }
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
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().includes('application/json')) return null
    const data = await res.json() as OEmbedData
    return data
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
  const embedUrls = [
    `https://www.instagram.com/reel/${shortcode}/embed/captioned/`,
    `https://www.instagram.com/p/${shortcode}/embed/captioned/`,
  ]

  for (const embedUrl of embedUrls) {
    try {
      const res = await fetch(embedUrl, { headers: BROWSER_HEADERS })
      if (!res.ok) continue
      const html = await res.text()

      const result: EmbedScrapedData = {}

      // Extract video_url from the embed HTML (Instagram puts it in a JSON blob)
      const videoUrlPatterns = [
        /video_url":"(https:[^"]+)"/,
        /"video_url":"([^"]+)"/,
        /src="(https:\/\/[^\"]*\.mp4[^\"]*)"/,
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

      if (result.videoUrl || result.thumbnailUrl) return result
    } catch {
      // Try next embed variant.
    }
  }

  return {}
}

async function scrapePostPageForVideo(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS })
    if (!res.ok) return null
    const html = await res.text()

    const patterns = [
      /"video_url":"([^"]+)"/,
      /property="og:video"\s+content="([^"]+)"/,
      /"contentUrl":"([^"]+)"/,
      /"video_versions":\[\{"type":\d+,"url":"([^"]+)"/,
    ]

    for (const p of patterns) {
      const m = html.match(p)
      if (m?.[1]) return m[1].replace(/\\u0026/g, '&').replace(/\\/g, '')
    }
  } catch {
    // Ignore and return null.
  }
  return null
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
  const paths = ['reel', 'p']

  for (const path of paths) {
    try {
      const apiUrl = `https://www.instagram.com/${path}/${shortcode}/?__a=1&__d=dis`
      const res = await fetch(apiUrl, {
        headers: {
          ...BROWSER_HEADERS,
          Accept: 'application/json',
          'X-IG-App-ID': '936619743392459',
          'X-Requested-With': 'XMLHttpRequest',
        },
      })
      if (!res.ok) continue

      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.toLowerCase().includes('application/json')) continue

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json()

      const media =
        json?.graphql?.shortcode_media ??
        json?.items?.[0]

      if (!media) continue

      const isVideo = media.is_video || media.media_type === 2
      if (!isVideo) continue

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
      // Try next endpoint variant.
    }
  }

  return null
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
  const normalizedUrl = normalizeInstagramUrl(url)
  const shortcode = extractInstagramShortcode(normalizedUrl)
  if (!shortcode) return { success: false, error: 'Invalid Instagram URL' }

  // Try yt-dlp first (most reliable)
  const ytdlpResult = await getInstagramViaYtDlp(normalizedUrl)
  // If yt-dlp succeeded, return immediately
  if (ytdlpResult?.success) return ytdlpResult
  const ytdlpError = ytdlpResult && !ytdlpResult.success ? ytdlpResult.error : null

  const postType = getPostType(url)

  // Run parallel fallback requests
  const [oEmbedResult, embedResult, graphResult] = await Promise.allSettled([
    fetchOEmbed(normalizedUrl),
    scrapeEmbedPage(shortcode),
    fetchGraphQL(shortcode),
  ])

  const oEmbed = oEmbedResult.status === 'fulfilled' ? oEmbedResult.value : null
  const embedData = embedResult.status === 'fulfilled' ? embedResult.value : {}
  const graphqlData = graphResult.status === 'fulfilled' ? graphResult.value : null

  // Determine video URL (prefer GraphQL > embed scraping)
  const videoUrl = graphqlData?.videoUrl ?? embedData.videoUrl

  if (!videoUrl) {
    return {
      success: false,
      error: ytdlpError ??
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
      id: 'ig_va_best',
      type: 'videoaudio',
      quality: '720p',
      qualityLabel: 'Best Quality · MP4',
      container: 'mp4',
      hasAudio: true,
      hasVideo: true,
      url: videoUrl,
    },
    {
      id: 'ig_ao_fallback',
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
    originalUrl: normalizedUrl,
  }

  return { success: true, data: mediaInfo }
}

/**
 * Instagram-only fallback resolver used by /api/download when yt-dlp fails.
 * Returns a direct MP4 URL if any public source exposes it.
 */
export async function resolveInstagramDirectMediaUrl(url: string): Promise<string | null> {
  const normalizedUrl = normalizeInstagramUrl(url)
  const shortcode = extractInstagramShortcode(normalizedUrl)
  if (!shortcode) return null

  const [graphResult, embedResult, pageResult] = await Promise.allSettled([
    fetchGraphQL(shortcode),
    scrapeEmbedPage(shortcode),
    scrapePostPageForVideo(normalizedUrl),
  ])

  const graphUrl = graphResult.status === 'fulfilled' ? graphResult.value?.videoUrl : null
  const embedUrl = embedResult.status === 'fulfilled' ? embedResult.value.videoUrl : null
  const pageUrl = pageResult.status === 'fulfilled' ? pageResult.value : null

  return graphUrl ?? embedUrl ?? pageUrl ?? null
}
