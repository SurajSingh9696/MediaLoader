'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Film, Music, Check, HardDrive } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import type { MediaFormat, FormatType } from '@/lib/extractor/types'

interface FormatSelectorProps {
  formats: MediaFormat[]
  selectedId: string | null
  onSelect: (format: MediaFormat) => void
}

const TAB_TYPES: { key: FormatType | 'videoaudio'; label: string; icon: React.ElementType }[] = [
  { key: 'videoaudio', label: 'Video + Audio', icon: Film },
  { key: 'audioonly', label: 'Audio Only', icon: Music },
]

function QualityTag({ quality }: { quality: string }) {
  const isHD = quality.includes('1080') || quality.includes('2160') || quality.includes('1440')
  const is720 = quality.includes('720')
  const isAudio = quality.includes('kbps')

  return (
    <span
      className={cn(
        'text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none',
        isHD
          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
          : is720
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
          : isAudio
          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
          : 'bg-bg-hover text-text-secondary border border-border'
      )}
    >
      {isHD ? 'HD' : is720 ? '720' : isAudio ? 'AUDIO' : quality}
    </span>
  )
}

export function FormatSelector({ formats, selectedId, onSelect }: FormatSelectorProps) {
  const [activeTab, setActiveTab] = useState<'videoaudio' | 'audioonly'>('videoaudio')

  const videoFormats = formats.filter(f => f.type === 'videoaudio')
  const audioFormats = formats.filter(f => f.type === 'audioonly')

  const shown = activeTab === 'videoaudio' ? videoFormats : audioFormats

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className="space-y-3"
    >
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-bg-elevated rounded-xl w-fit">
        {TAB_TYPES.map(tab => {
          const count = tab.key === 'videoaudio' ? videoFormats.length : audioFormats.length
          const active = activeTab === tab.key
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'videoaudio' | 'audioonly')}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200',
                active
                  ? 'bg-violet-600 text-white shadow-glow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              )}
            >
              <Icon size={13} />
              {tab.label}
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none min-w-[18px] text-center',
                  active ? 'bg-white/20 text-white' : 'bg-bg-hover text-text-muted'
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Format cards */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: activeTab === 'videoaudio' ? -10 : 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: activeTab === 'videoaudio' ? 10 : -10 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
        >
          {shown.length === 0 ? (
            <p className="col-span-full text-center text-text-muted text-sm py-6">
              No {activeTab === 'videoaudio' ? 'video' : 'audio'} formats available.
            </p>
          ) : (
            shown.map(format => {
              const selected = selectedId === format.id
              return (
                <motion.button
                  key={format.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelect(format)}
                  className={cn(
                    'relative flex flex-col gap-1.5 p-3.5 rounded-xl text-left',
                    'border transition-all duration-200 cursor-pointer',
                    selected
                      ? 'format-card-selected'
                      : 'bg-bg-elevated border-border hover:border-violet-500/30 hover:bg-bg-hover'
                  )}
                >
                  {/* Check mark */}
                  {selected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full
                                 bg-violet-500 flex items-center justify-center"
                    >
                      <Check size={11} className="text-white" strokeWidth={3} />
                    </motion.div>
                  )}

                  <div className="flex items-center gap-2 pr-6">
                    <span className="text-sm font-semibold text-text-primary">
                      {format.quality}
                    </span>
                    <QualityTag quality={format.quality} />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-text-muted uppercase font-medium tracking-wide">
                      {format.container}
                    </span>
                    {format.fps && format.fps > 0 && (
                      <span className="text-xs text-text-muted">{format.fps}fps</span>
                    )}
                    {format.filesize && (
                      <span className="flex items-center gap-1 text-xs text-text-muted">
                        <HardDrive size={10} />
                        {formatFileSize(format.filesize)}
                      </span>
                    )}
                  </div>
                </motion.button>
              )
            })
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
