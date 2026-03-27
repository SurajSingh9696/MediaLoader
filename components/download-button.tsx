'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Loader2, CheckCircle2, AlertCircle, HardDrive } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import type { MediaFormat, MediaInfo } from '@/lib/extractor/types'

interface DownloadButtonProps {
  selectedFormat: MediaFormat | null
  mediaInfo: MediaInfo
}

type DownloadState = 'idle' | 'preparing' | 'saving' | 'done' | 'error'

const STATE_LABEL: Record<DownloadState, string> = {
  idle:     '',
  preparing: 'Preparing download…',
  saving:    'Saving to disk…',
  done:      'Download started!',
  error:     'Failed — retry',
}

export function DownloadButton({ selectedFormat, mediaInfo }: DownloadButtonProps) {
  const [state, setState]       = useState<DownloadState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleDownload = useCallback(async () => {
    if (!selectedFormat) return
    setState('preparing')
    setErrorMsg(null)

    const downloadUrl =
      `/api/download` +
      `?url=${encodeURIComponent(mediaInfo.originalUrl)}` +
      `&formatId=${encodeURIComponent(selectedFormat.id)}` +
      `&title=${encodeURIComponent(mediaInfo.title)}` +
      (selectedFormat.url ? `&formatUrl=${encodeURIComponent(selectedFormat.url)}` : '')

    try {
      const response = await fetch(downloadUrl)

      // ── Server error ────────────────────────────────────────────────────────
      if (!response.ok) {
        let msg = 'Download failed. Please try again.'
        try { msg = (await response.json()).error ?? msg } catch { /* ignore */ }
        throw new Error(msg)
      }

      setState('saving')

      // ── Extract filename from Content-Disposition ───────────────────────────
      const disposition = response.headers.get('Content-Disposition') ?? ''
      // RFC 5987 extended syntax: filename*=UTF-8''...
      let filename = selectedFormat.container
        ? `${mediaInfo.title}.${selectedFormat.container}`
        : 'download'
      const extMatch  = disposition.match(/filename\*=UTF-8''(.+)/i)
      const normMatch = disposition.match(/filename="?([^";\r\n]+)"?/i)
      if (extMatch?.[1])  filename = decodeURIComponent(extMatch[1])
      else if (normMatch?.[1]) filename = normMatch[1]

      // ── Read blob and trigger download ─────────────────────────────────────
      const blob    = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a       = document.createElement('a')
      a.href        = blobUrl
      a.download    = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)

      setState('done')
      setTimeout(() => setState('idle'), 5000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed.'
      setState('error')
      setErrorMsg(msg)
      setTimeout(() => setState('idle'), 6000)
    }
  }, [selectedFormat, mediaInfo])

  const isLoading = state === 'preparing' || state === 'saving'
  const disabled  = !selectedFormat || isLoading

  return (
    <div className="space-y-2">
      {/* Size hint above the button */}
      {selectedFormat?.filesize && state === 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-1.5 text-xs text-text-muted"
        >
          <HardDrive size={11} />
          <span>
            Estimated size: <span className="text-text-secondary font-medium">
              {formatFileSize(selectedFormat.filesize)}
            </span>
          </span>
        </motion.div>
      )}

      {/* Main button */}
      <motion.button
        whileHover={disabled ? {} : { scale: 1.02, y: -1 }}
        whileTap={disabled   ? {} : { scale: 0.97 }}
        onClick={handleDownload}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-center gap-2.5 px-6 py-3.5',
          'rounded-2xl font-semibold text-sm transition-all duration-200',
          !selectedFormat
            ? 'bg-bg-elevated text-text-muted border border-border cursor-not-allowed'
            : isLoading
            ? 'bg-blue-700/35 text-sky-200 border border-sky-500/30 cursor-not-allowed'
            : state === 'done'
            ? 'bg-emerald-600 text-white'
            : state === 'error'
            ? 'bg-red-600/80 text-white'
            : 'bg-gradient-to-r from-sky-600 to-blue-700 text-white glow-pulse cursor-pointer'
        )}
      >
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.span key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <Loader2 size={16} className="animate-spin" />
              {STATE_LABEL[state]}
            </motion.span>
          ) : state === 'done' ? (
            <motion.span key="done"
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2"
            >
              <CheckCircle2 size={16} />
              Download started!
            </motion.span>
          ) : state === 'error' ? (
            <motion.span key="error"
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2"
            >
              <AlertCircle size={16} />
              Failed — retry
            </motion.span>
          ) : (
            <motion.span key="idle"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-2"
            >
              <Download size={16} />
              {selectedFormat
                ? `Download ${selectedFormat.qualityLabel}`
                : 'Select a format above'}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Animated progress bar */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="space-y-1"
        >
          <div className="h-1 rounded-full overflow-hidden bg-bg-elevated">
            <div className="h-full progress-bar rounded-full w-full" />
          </div>
          {state === 'preparing' && (
            <p className="text-center text-[11px] text-text-muted">
              Server is processing the video — this may take a moment for large files
            </p>
          )}
        </motion.div>
      )}

      {/* Error message */}
      <AnimatePresence>
        {errorMsg && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-red-400 text-center px-2"
          >
            {errorMsg}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
