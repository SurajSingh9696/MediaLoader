"use client"

import { AnimatePresence } from "framer-motion"
import UrlInput from "@/components/url-input"
import LoadingState from "@/components/loading-state"
import ErrorDisplay from "@/components/error-display"
import VideoPreview from "@/components/video-preview"
import FormatSelector from "@/components/format-selector"
import { useMediaFetch } from "@/lib/hooks"
import type { DownloadRequest } from "@/lib/types"

export default function UrlSection() {
  const { metadata, isLoading, isDownloading, downloadingId, downloadProgress, error, fetchVideo, download, reset } =
    useMediaFetch()

  function handleDownload(type: "video" | "audio", formatId?: string, audioQuality?: string) {
    if (!metadata) return
    const req: DownloadRequest = {
      url: metadata.url,
      type,
      format_id: formatId,
      audio_quality: audioQuality as DownloadRequest["audio_quality"],
    }
    download(req)
  }

  return (
    <div className="w-full">
      <UrlInput
        onFetch={fetchVideo}
        onReset={reset}
        isLoading={isLoading}
        hasResult={!!metadata}
      />

      <AnimatePresence mode="wait">
        {isLoading && <LoadingState key="loading" />}

        {!isLoading && error && (
          <ErrorDisplay key="error" message={error} onRetry={reset} />
        )}

        {!isLoading && !error && metadata && (
          <div key="result">
            <VideoPreview metadata={metadata} />
            <FormatSelector
              metadata={metadata}
              onDownload={handleDownload}
              isDownloading={isDownloading}
              downloadingId={downloadingId}
              downloadProgress={downloadProgress}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
