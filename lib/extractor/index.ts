/**
 * MediaExtractor — unified entry point
 * Detects platform from URL and delegates to the correct extractor.
 */

export { isYouTubeUrl, extractYouTubeId, getYouTubeInfo } from './youtube'
export { isInstagramUrl, extractInstagramShortcode, getInstagramInfo } from './instagram'
export type { MediaInfo, MediaFormat, MediaPlatform, FormatType, ExtractorResult } from './types'

import { isYouTubeUrl, getYouTubeInfo } from './youtube'
import { isInstagramUrl, getInstagramInfo } from './instagram'
import type { ExtractorResult } from './types'

export async function extractMediaInfo(url: string): Promise<ExtractorResult> {
  const trimmed = url.trim()

  if (isYouTubeUrl(trimmed)) {
    return getYouTubeInfo(trimmed)
  }

  if (isInstagramUrl(trimmed)) {
    return getInstagramInfo(trimmed)
  }

  return {
    success: false,
    error: 'Unsupported URL. Please paste a YouTube or Instagram video link.',
  }
}
