'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link2, Loader2, ArrowRight, X, Youtube, Instagram, ClipboardPaste } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MediaInfo } from '@/lib/extractor/types'

interface UrlInputProps {
  onResult: (info: MediaInfo) => void
  onLoading: (loading: boolean) => void
  isLoading: boolean
}

function detectPlatform(url: string): 'youtube' | 'instagram' | null {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube'
  if (/instagram\.com/.test(url)) return 'instagram'
  return null
}

export function UrlInput({ onResult, onLoading, isLoading }: UrlInputProps) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const platform = detectPlatform(url)

  const handleSubmit = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    setError(null)
    onLoading(true)

    try {
      const res = await fetch(`/api/info?url=${encodeURIComponent(trimmed)}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to fetch video info')
        return
      }

      onResult(data)
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      onLoading(false)
    }
  }, [url, onResult, onLoading])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) handleSubmit()
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setUrl(text)
      setError(null)
    } catch {
      inputRef.current?.focus()
    }
  }

  const clear = () => {
    setUrl('')
    setError(null)
    inputRef.current?.focus()
  }

  return (
    <div className="w-full space-y-3">
      {/* Input container */}
      <motion.div
        animate={{
          boxShadow: focused
            ? '0 0 0 2px rgba(139,92,246,0.5), 0 0 30px rgba(139,92,246,0.12)'
            : error
            ? '0 0 0 2px rgba(239,68,68,0.4)'
            : '0 0 0 1px rgba(255,255,255,0.06)',
        }}
        transition={{ duration: 0.2 }}
        className="relative flex items-center rounded-2xl bg-bg-elevated overflow-hidden"
      >
        {/* Left icon */}
        <div className="pl-4 pr-2 flex-shrink-0">
          <AnimatePresence mode="wait">
            {platform === 'youtube' ? (
              <motion.div key="yt" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
                <Youtube size={18} className="text-red-400" />
              </motion.div>
            ) : platform === 'instagram' ? (
              <motion.div key="ig" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
                <Instagram size={18} className="text-pink-400" />
              </motion.div>
            ) : (
              <motion.div key="link" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
                <Link2 size={18} className="text-text-muted" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={e => { setUrl(e.target.value); setError(null) }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKey}
          placeholder="Paste YouTube or Instagram URL…"
          className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted
                     text-sm py-4 pr-2 outline-none min-w-0"
          disabled={isLoading}
          autoComplete="off"
          spellCheck={false}
        />

        {/* Right controls */}
        <div className="flex items-center gap-1 pr-2 flex-shrink-0">
          {url && !isLoading && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileTap={{ scale: 0.85 }}
              onClick={clear}
              className="w-7 h-7 rounded-lg flex items-center justify-center
                         text-text-muted hover:text-text-secondary hover:bg-bg-hover
                         transition-colors"
            >
              <X size={13} />
            </motion.button>
          )}

          {!url && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handlePaste}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                         text-xs text-text-muted hover:text-violet-400 hover:bg-violet-500/10
                         transition-colors border border-transparent hover:border-violet-500/20"
            >
              <ClipboardPaste size={12} />
              <span>Paste</span>
            </motion.button>
          )}

          {/* Submit button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSubmit}
            disabled={!url.trim() || isLoading}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold',
              'transition-all duration-200',
              url.trim() && !isLoading
                ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 shadow-glow-sm cursor-pointer'
                : 'bg-bg-hover text-text-muted cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span className="hidden sm:inline">Fetching</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Analyze</span>
                <ArrowRight size={14} />
              </>
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            className="flex items-start gap-2 px-4 py-3 rounded-xl
                       bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            <X size={14} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Supported platforms hint */}
      {!url && !error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-xs text-text-muted"
        >
          Supports YouTube videos, Shorts, playlists &amp; Instagram posts, Reels
        </motion.p>
      )}
    </div>
  )
}
