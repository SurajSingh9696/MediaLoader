'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Navbar } from '@/components/navbar'
import { UrlInput } from '@/components/url-input'
import { VideoPreview } from '@/components/video-preview'
import { FormatSelector } from '@/components/format-selector'
import { DownloadButton } from '@/components/download-button'
import type { MediaInfo, MediaFormat } from '@/lib/extractor/types'
import { Youtube, Instagram, Shield, Zap, Sparkles } from 'lucide-react'

// Skeleton loader for while fetching
function SkeletonLoader() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      <div className="glass-card rounded-2xl overflow-hidden flex flex-col sm:flex-row">
        <div className="sm:w-52 h-32 sm:h-auto shimmer" />
        <div className="flex-1 p-4 space-y-2.5">
          <div className="h-4 rounded-lg shimmer w-4/5" />
          <div className="h-4 rounded-lg shimmer w-3/5" />
          <div className="h-3 rounded-lg shimmer w-2/5 mt-2" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-9 w-32 rounded-xl shimmer" />
        <div className="h-9 w-28 rounded-xl shimmer" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl shimmer" />
        ))}
      </div>
    </motion.div>
  )
}

// Feature cards shown before search
function FeatureCards() {
  const features = [
    {
      icon: Youtube,
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
      title: 'YouTube',
      desc: 'Videos, Shorts & playlists',
    },
    {
      icon: Instagram,
      color: 'text-pink-400',
      bg: 'bg-pink-500/10 border-pink-500/20',
      title: 'Instagram',
      desc: 'Posts, Reels & IGTV',
    },
    {
      icon: Zap,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      title: 'Multiple Qualities',
      desc: 'Up to 1080p HD video',
    },
    {
      icon: Shield,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      title: 'Privacy First',
      desc: 'No login, no tracking',
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10"
    >
      {features.map((f, i) => (
        <motion.div
          key={f.title}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 + i * 0.07 }}
          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border ${f.bg} text-center`}
        >
          <div className={`${f.color} opacity-90`}>
            <f.icon size={22} />
          </div>
          <p className="text-xs font-semibold text-text-primary">{f.title}</p>
          <p className="text-[11px] text-text-muted leading-tight">{f.desc}</p>
        </motion.div>
      ))}
    </motion.div>
  )
}

export default function Home() {
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<MediaFormat | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleResult = (info: MediaInfo) => {
    setMediaInfo(info)
    setSelectedFormat(null)
  }

  const handleReset = () => {
    setMediaInfo(null)
    setSelectedFormat(null)
  }

  return (
    <div className="min-h-screen bg-bg-base relative overflow-x-hidden">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="orb w-[600px] h-[600px] bg-sky-500/15 -top-64 -left-32"
          style={{ animationDelay: '0s' }}
        />
        <div
          className="orb w-[500px] h-[500px] bg-blue-600/10 top-1/2 -right-48"
          style={{ animationDelay: '3s' }}
        />
        <div
          className="orb w-[400px] h-[400px] bg-teal-500/10 bottom-0 left-1/3"
          style={{ animationDelay: '6s' }}
        />
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(139,92,246,1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(139,92,246,1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <Navbar />

      <main className="relative z-10 min-h-screen flex flex-col items-center justify-start pt-28 pb-20 px-4">
        <div className="w-full max-w-2xl mx-auto">
          {/* Hero heading */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-8 space-y-3"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                         bg-sky-500/10 border border-sky-500/20 text-sky-500 text-xs font-medium mb-2"
            >
              <Sparkles size={11} />
              Free · No login required · Unlimited downloads
            </motion.div>

            <h1 className="display-font text-4xl sm:text-5xl font-black tracking-tight leading-tight">
              <span className="text-text-primary">Download </span>
              <span className="gradient-text">Any Video</span>
              <br />
              <span className="text-text-primary text-3xl sm:text-4xl font-bold">
                in seconds
              </span>
            </h1>

            <p className="text-text-secondary text-base max-w-md mx-auto leading-relaxed">
              Paste a YouTube or Instagram link. Choose your quality.
              Get your file — video with audio or audio only.
            </p>
          </motion.div>

          {/* URL Input */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <UrlInput
              onResult={handleResult}
              onLoading={setIsLoading}
              onSearchStart={handleReset}
              isLoading={isLoading}
            />
          </motion.div>

          {/* Results section */}
          <AnimatePresence mode="wait">
            {isLoading ? (
              <div className="mt-6" key="skeleton">
                <SkeletonLoader />
              </div>
            ) : mediaInfo ? (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-6 space-y-4"
              >
                {/* Video preview */}
                <VideoPreview info={mediaInfo} />

                {/* Format selector */}
                <FormatSelector
                  formats={mediaInfo.formats}
                  selectedId={selectedFormat?.id ?? null}
                  onSelect={setSelectedFormat}
                />

                {/* Download */}
                <DownloadButton
                  selectedFormat={selectedFormat}
                  mediaInfo={mediaInfo}
                />

                {/* New search */}
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  onClick={handleReset}
                  className="w-full py-2 text-xs text-text-muted hover:text-text-secondary
                             transition-colors"
                >
                  ← Search another URL
                </motion.button>
              </motion.div>
            ) : (
              <div key="features">
                <FeatureCards />
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-auto pt-16 text-center text-xs text-text-muted space-y-1"
        >
          <p>MediaLoader — For personal use only. Respect copyright laws.</p>
          <p className="text-[11px] opacity-60">
            YouTube and Instagram are trademarks of their respective owners.
          </p>
        </motion.footer>
      </main>
    </div>
  )
}
