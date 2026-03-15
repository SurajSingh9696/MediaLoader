'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MediaFormat, MediaInfo } from '@/lib/extractor/types'

interface DownloadButtonProps {
  selectedFormat: MediaFormat | null
  mediaInfo: MediaInfo
}

type DownloadState = 'idle' | 'starting' | 'downloading' | 'done' | 'error'

export function DownloadButton({ selectedFormat, mediaInfo }: DownloadButtonProps) {
  const [state, setState] = useState<DownloadState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleDownload = useCallback(async () => {
    if (!selectedFormat) return
    setState('starting')
    setErrorMsg(null)

    try {
      // For Instagram formats with a direct URL, we can download directly
      if (selectedFormat.url && mediaInfo.platform === 'instagram') {
        setState('downloading')
        const a = document.createElement('a')
        // Route through our proxy to set proper headers
        a.href = `/api/download?url=${encodeURIComponent(mediaInfo.originalUrl)}&formatId=${encodeURIComponent(selectedFormat.id)}`
        a.download = `${mediaInfo.id}.${selectedFormat.container}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setState('done')
        setTimeout(() => setState('idle'), 3000)
        return
      }

      // For YouTube, proxy through our API
      setState('downloading')
      const downloadUrl = `/api/download?url=${encodeURIComponent(mediaInfo.originalUrl)}&formatId=${encodeURIComponent(selectedFormat.id)}`

      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${mediaInfo.id}.${selectedFormat.container}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      setState('done')
      setTimeout(() => setState('idle'), 4000)
    } catch {
      setState('error')
      setErrorMsg('Download failed. Please try again.')
      setTimeout(() => setState('idle'), 4000)
    }
  }, [selectedFormat, mediaInfo])

  const isLoading = state === 'starting' || state === 'downloading'
  const disabled = !selectedFormat || isLoading

  return (
    <div className="space-y-2">
      <motion.button
        whileHover={disabled ? {} : { scale: 1.02, y: -1 }}
        whileTap={disabled ? {} : { scale: 0.97 }}
        onClick={handleDownload}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-center gap-2.5 px-6 py-3.5',
          'rounded-2xl font-semibold text-sm transition-all duration-200',
          disabled && !isLoading
            ? 'bg-bg-elevated text-text-muted border border-border cursor-not-allowed'
            : isLoading
            ? 'bg-violet-700/50 text-violet-300 cursor-not-allowed'
            : state === 'done'
            ? 'bg-emerald-600 text-white'
            : state === 'error'
            ? 'bg-red-600/80 text-white'
            : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white glow-pulse hover:from-violet-500 hover:to-purple-500 cursor-pointer shadow-glow-violet'
        )}
      >
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              {state === 'starting' ? 'Preparing…' : 'Downloading…'}
            </motion.span>
          ) : state === 'done' ? (
            <motion.span key="done" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              Download started!
            </motion.span>
          ) : state === 'error' ? (
            <motion.span key="error" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2">
              <AlertCircle size={16} />
              Failed — retry
            </motion.span>
          ) : (
            <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-2">
              <Download size={16} />
              {selectedFormat
                ? `Download ${selectedFormat.qualityLabel}`
                : 'Select a format above'}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Progress indicator */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          className="h-0.5 rounded-full overflow-hidden bg-bg-elevated"
        >
          <div className="h-full progress-bar rounded-full" style={{ width: '100%' }} />
        </motion.div>
      )}

      <AnimatePresence>
        {errorMsg && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-red-400 text-center"
          >
            {errorMsg}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
