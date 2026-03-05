export interface VideoFormat {
  format_id: string
  resolution: string | null
  ext: string
  filesize: number | null
  acodec: string | null
  vcodec: string | null
  tbr: number | null
  abr: number | null
  vbr: number | null
  format_note: string | null
  height: number | null
  width: number | null
}

export interface VideoMetadata {
  title: string
  thumbnail: string | null
  duration: number | null
  uploader: string | null
  platform: string
  url: string
  formats: VideoFormat[]
  description: string | null
  view_count: number | null
  like_count: number | null
}

export interface MetadataResponse {
  success: boolean
  data?: VideoMetadata
  error?: string
}

export interface DownloadRequest {
  url: string
  format_id?: string
  type: "video" | "audio"
  audio_quality?: "128" | "192" | "320"
}

export interface ApiError {
  error: string
  detail?: string
}

export type DownloadType = "video" | "audio"

export interface FormatCardData {
  label: string
  resolution?: string
  quality?: string
  ext: string
  filesize: number | null
  format_id?: string
  bitrate?: string
}
