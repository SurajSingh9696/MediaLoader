export type MediaPlatform = 'youtube' | 'instagram' | 'unknown'

export type FormatType = 'videoaudio' | 'videoonly' | 'audioonly'

export interface MediaFormat {
  id: string
  type: FormatType
  quality: string        // e.g. "1080p", "720p", "320kbps"
  qualityLabel: string   // Display label
  container: string      // e.g. "mp4", "webm", "m4a"
  filesize?: number      // bytes, if known
  bitrate?: number
  fps?: number
  audioSampleRate?: number
  hasAudio: boolean
  hasVideo: boolean
  url?: string           // direct stream URL if available
  itag?: number          // YouTube itag
}

export interface MediaInfo {
  platform: MediaPlatform
  id: string
  title: string
  description?: string
  thumbnail: string
  duration?: number      // seconds
  author?: string
  viewCount?: number
  formats: MediaFormat[]
  originalUrl: string
}

export interface ExtractorResult {
  success: boolean
  data?: MediaInfo
  error?: string
}

export interface DownloadOptions {
  url: string
  formatId: string
  platform: MediaPlatform
}
