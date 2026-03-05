"use client"

import { motion, type Variants } from "framer-motion"
import {
  Download,
  Film,
  Music,
  Loader2,
  HardDrive,
  Gauge,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { formatFileSize } from "@/lib/utils"
import type { VideoMetadata, VideoFormat } from "@/lib/types"

interface FormatSelectorProps {
  metadata: VideoMetadata
  onDownload: (type: "video" | "audio", formatId?: string, audioQuality?: string) => void
  isDownloading: boolean
  downloadingId: string | null
  downloadProgress: number
}

const VIDEO_HEIGHTS = [2160, 1440, 1080, 720, 480, 360, 240, 144]

const AUDIO_QUALITIES = [
  { label: "MP3 320 kbps", quality: "320", desc: "High Quality", badge: "success" as const },
  { label: "MP3 192 kbps", quality: "192", desc: "Standard Quality", badge: "default" as const },
  { label: "MP3 128 kbps", quality: "128", desc: "Compact", badge: "secondary" as const },
]

function pickBestVideoFormats(formats: VideoFormat[]): VideoFormat[] {
  const videoFormats = formats.filter(
    (f) => f.vcodec && f.vcodec !== "none" && f.height && f.height > 0
  )

  const byHeight = new Map<number, VideoFormat>()
  for (const f of videoFormats) {
    const h = f.height!
    const existing = byHeight.get(h)
    if (!existing) {
      byHeight.set(h, f)
    } else {
      const existingSize = existing.filesize ?? 0
      const currentSize = f.filesize ?? 0
      if (currentSize > existingSize) byHeight.set(h, f)
    }
  }

  return VIDEO_HEIGHTS.filter((h) => byHeight.has(h)).map((h) => byHeight.get(h)!)
}

function resolutionLabel(f: VideoFormat): string {
  if (f.height) {
    if (f.height >= 2160) return "4K"
    if (f.height >= 1440) return "2K"
    return `${f.height}p`
  }
  return f.resolution ?? f.format_note ?? "Unknown"
}

function qualityBadge(height: number | null): "success" | "default" | "secondary" | "info" {
  if (!height) return "secondary"
  if (height >= 1080) return "success"
  if (height >= 720) return "default"
  if (height >= 480) return "info"
  return "secondary"
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut" },
  },
}

export default function FormatSelector({
  metadata,
  onDownload,
  isDownloading,
  downloadingId,
  downloadProgress,
}: FormatSelectorProps) {
  const videoFormats = pickBestVideoFormats(metadata.formats)

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-3xl mx-auto px-3 sm:px-4 pb-12 sm:pb-16"
    >
      <div
        className="rounded-2xl backdrop-blur-xl p-4 sm:p-6 shadow-2xl"
        style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <div className="flex items-center gap-2 mb-5 sm:mb-6">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
          >
            <Download className="w-4 h-4" style={{ color: "var(--accent)" }} />
          </div>
          <h3 className="font-bold text-base sm:text-lg" style={{ color: "var(--text)" }}>Select Format</h3>
        </div>

        <Tabs defaultValue="video">
          <TabsList className="mb-6 w-full sm:w-auto">
            <TabsTrigger value="video" className="flex items-center gap-2 flex-1 sm:flex-none">
              <Film className="w-4 h-4" />
              Video
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-2 flex-1 sm:flex-none">
              <Music className="w-4 h-4" />
              Audio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="video">
            {videoFormats.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
                No video formats available for this URL.
              </p>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3"
              >
                {videoFormats.map((format) => {
                  const id = format.format_id
                  const downloading = isDownloading && downloadingId === id
                  const label = resolutionLabel(format)
                  const badge = qualityBadge(format.height)

                  return (
                    <motion.div
                      key={id}
                      variants={cardVariants}
                      whileHover={{ scale: 1.015, transition: { duration: 0.15 } }}
                      className="rounded-xl p-3.5 sm:p-4 flex items-center gap-3 sm:gap-4 transition-all duration-200"
                      style={{
                        border: downloading ? "1px solid color-mix(in srgb, var(--accent) 35%, transparent)" : "1px solid var(--border)",
                        background: downloading ? "color-mix(in srgb, var(--accent) 6%, var(--surface))" : "var(--surface)",
                      }}
                    >
                      <div
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                          border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)",
                        }}
                      >
                        <Film className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: "var(--accent)" }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm sm:text-base" style={{ color: "var(--text)" }}>{label}</span>
                          <Badge variant={badge}>{format.ext.toUpperCase()}</Badge>
                        </div>
                        {downloading ? (
                          <div className="mt-1.5">
                            {downloadProgress >= 0 ? (
                              <>
                                <Progress value={downloadProgress} className="h-1.5" />
                                <p className="text-xs mt-1" style={{ color: "var(--accent)" }}>
                                  {downloadProgress < 100 ? `${downloadProgress}%` : "Finalizing…"}
                                </p>
                              </>
                            ) : (
                              <>
                                <Progress value={undefined} className="h-1.5" />
                                <p className="text-xs mt-1" style={{ color: "var(--accent)" }}>Downloading…</p>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5 text-xs" style={{ color: "var(--text-subtle)" }}>
                            <span className="flex items-center gap-1">
                              <HardDrive className="w-3 h-3" />
                              {formatFileSize(format.filesize)}
                            </span>
                            {format.vbr && (
                              <span className="flex items-center gap-1">
                                <Gauge className="w-3 h-3" />
                                {Math.round(format.vbr)}k
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <Button
                        size="sm"
                        onClick={() => onDownload("video", id)}
                        disabled={isDownloading}
                        className="shrink-0 ml-auto min-w-[40px]"
                      >
                        {downloading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">{downloading ? "..." : "DL"}</span>
                      </Button>
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="audio">
              <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3"
            >
              {AUDIO_QUALITIES.map(({ label, quality, desc, badge }) => {
                const id = `audio-${quality}`
                const downloading = isDownloading && downloadingId === id

                return (
                  <motion.div
                    key={quality}
                    variants={cardVariants}
                    whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
                    className="rounded-xl p-4 sm:p-5 flex flex-col gap-3 sm:gap-4 transition-all duration-200"
                    style={{
                      border: downloading ? "1px solid rgba(52,211,153,0.3)" : "1px solid var(--border)",
                      background: downloading ? "rgba(52,211,153,0.05)" : "var(--surface)",
                    }}
                  >
                    <div className="flex flex-col gap-2">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}
                      >
                        <Music className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{label}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{desc}</p>
                      </div>
                      <Badge variant={badge}>MP3</Badge>
                    </div>

                    {downloading && (
                      <div className="mb-1">
                        {downloadProgress >= 0 ? (
                          <>
                            <Progress value={downloadProgress} className="h-1.5" />
                            <p className="text-xs text-emerald-400 mt-1 text-center">
                              {downloadProgress < 100 ? `${downloadProgress}%` : "Finalizing…"}
                            </p>
                          </>
                        ) : (
                          <>
                            <Progress value={undefined} className="h-1.5" />
                            <p className="text-xs text-emerald-400 mt-1 text-center">Downloading…</p>
                          </>
                        )}
                      </div>
                    )}
                    <Button
                      variant="success"
                      size="sm"
                      className="w-full"
                      onClick={() => onDownload("audio", undefined, quality)}
                      disabled={isDownloading}
                    >
                      {downloading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </>
                      )}
                    </Button>
                  </motion.div>
                )
              })}
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </motion.section>
  )
}
