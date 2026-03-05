"use client"

import { useState, useCallback } from "react"
import { fetchMetadata, downloadFile } from "@/lib/api"
import type { VideoMetadata, DownloadRequest } from "@/lib/types"

export function useMediaFetch() {
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<number>(0)

  const fetchVideo = useCallback(async (url: string) => {
    setIsLoading(true)
    setError(null)
    setMetadata(null)
    try {
      const result = await fetchMetadata(url)
      if (result.success && result.data) {
        setMetadata(result.data)
      } else {
        setError(result.error ?? "Failed to fetch video metadata")
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const download = useCallback(async (request: DownloadRequest) => {
    const id = request.format_id ?? `audio-${request.audio_quality ?? "192"}`
    setIsDownloading(true)
    setDownloadingId(id)
    setDownloadProgress(0)
    setError(null)
    try {
      await downloadFile(request, (percent) => {
        setDownloadProgress(percent < 0 ? -1 : percent)
      })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Download failed. Please try again."
      setError(message)
    } finally {
      setIsDownloading(false)
      setDownloadingId(null)
      setDownloadProgress(0)
    }
  }, [])

  const reset = useCallback(() => {
    setMetadata(null)
    setError(null)
    setIsLoading(false)
    setIsDownloading(false)
    setDownloadingId(null)
    setDownloadProgress(0)
  }, [])

  return {
    metadata,
    isLoading,
    isDownloading,
    downloadingId,
    downloadProgress,
    error,
    fetchVideo,
    download,
    reset,
  }
}
