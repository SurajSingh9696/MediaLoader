'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Clock, Eye, User, Youtube, Instagram, ExternalLink } from 'lucide-react'
import { formatDuration, formatViewCount } from '@/lib/utils'
import type { MediaInfo } from '@/lib/extractor/types'

interface VideoPreviewProps {
  info: MediaInfo
}

export function VideoPreview({ info }: VideoPreviewProps) {
  const isYT = info.platform === 'youtube'
  const isIG = info.platform === 'instagram'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="glass-card rounded-2xl overflow-hidden"
    >
      <div className="flex flex-col sm:flex-row gap-0">
        {/* Thumbnail */}
        <div className="relative sm:w-52 sm:flex-shrink-0 aspect-video sm:aspect-auto overflow-hidden
                        bg-bg-elevated">
          {info.thumbnail ? (
            <Image
              src={info.thumbnail}
              alt={info.title}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-muted">
              {isYT ? <Youtube size={32} /> : <Instagram size={32} />}
            </div>
          )}

          {/* Duration badge */}
          {info.duration && info.duration > 0 && (
            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md
                            bg-black/70 text-white text-xs font-mono font-medium backdrop-blur-sm">
              {formatDuration(info.duration)}
            </div>
          )}

          {/* Platform badge */}
          <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg
                           text-xs font-medium backdrop-blur-sm
                           ${isYT ? 'badge-youtube' : 'badge-instagram'}`}>
            {isYT ? <Youtube size={10} /> : <Instagram size={10} />}
            {isYT ? 'YouTube' : 'Instagram'}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 p-4 flex flex-col gap-2 min-w-0">
          <h3 className="font-semibold text-text-primary text-sm leading-snug line-clamp-2">
            {info.title}
          </h3>

          <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
            {info.author && (
              <span className="flex items-center gap-1">
                <User size={11} />
                {info.author}
              </span>
            )}
            {info.viewCount != null && info.viewCount > 0 && (
              <span className="flex items-center gap-1">
                <Eye size={11} />
                {formatViewCount(info.viewCount)}
              </span>
            )}
            {info.duration != null && info.duration > 0 && (
              <span className="flex items-center gap-1 sm:hidden">
                <Clock size={11} />
                {formatDuration(info.duration)}
              </span>
            )}
          </div>

          {info.description && (
            <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
              {info.description}
            </p>
          )}

          <a
            href={info.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center gap-1 text-xs text-violet-400
                       hover:text-violet-300 transition-colors w-fit"
          >
            <ExternalLink size={11} />
            Open original
          </a>
        </div>
      </div>
    </motion.div>
  )
}
