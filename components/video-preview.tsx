"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import { Clock, User, Eye, ThumbsUp, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatDuration, extractPlatform } from "@/lib/utils"
import type { VideoMetadata } from "@/lib/types"

interface VideoPreviewProps {
  metadata: VideoMetadata
}

const platformColors: Record<string, string> = {
  YouTube: "destructive",
  Instagram: "default",
  TikTok: "secondary",
  "Twitter / X": "info",
  Facebook: "info",
  Reddit: "warning",
  Vimeo: "success",
  Dailymotion: "warning",
  Twitch: "default",
  Unknown: "secondary",
}

function formatCount(n: number | null): string {
  if (!n) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function VideoPreview({ metadata }: VideoPreviewProps) {
  const platform = extractPlatform(metadata.url)
  const badgeVariant = (platformColors[platform] ?? "secondary") as
    | "destructive"
    | "default"
    | "secondary"
    | "success"
    | "warning"
    | "info"

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-3xl mx-auto px-3 sm:px-4 pb-4 sm:pb-6"
    >
      <div
        className="rounded-2xl backdrop-blur-xl overflow-hidden shadow-2xl"
        style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <div className="flex flex-col sm:flex-row gap-0">
          {metadata.thumbnail && (
            <div className="sm:w-56 md:w-64 shrink-0 relative">
              <div className="relative aspect-video sm:aspect-auto sm:h-full min-h-36 bg-black/30">
                <Image
                  src={metadata.thumbnail}
                  alt={metadata.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent sm:hidden" />
                {metadata.duration && (
                  <div className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-sm text-white text-xs font-mono px-2 py-0.5 rounded-md">
                    {formatDuration(metadata.duration)}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 p-4 sm:p-5 flex flex-col gap-2.5 sm:gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <Badge variant={badgeVariant} className="mb-2">
                  {platform}
                </Badge>
                <h2
                  className="font-bold text-base sm:text-lg leading-snug line-clamp-2 mb-1"
                  style={{ color: "var(--text)" }}
                >
                  {metadata.title}
                </h2>
                {metadata.uploader && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <User className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                    <span className="truncate" style={{ color: "var(--text-muted)" }}>{metadata.uploader}</span>
                  </div>
                )}
              </div>
              <a
                href={metadata.url}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors shrink-0 mt-1"
                style={{ color: "var(--text-subtle)" }}
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
              {metadata.duration && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                  {formatDuration(metadata.duration)}
                </span>
              )}
              {metadata.view_count && (
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                  {formatCount(metadata.view_count)} views
                </span>
              )}
              {metadata.like_count && (
                <span className="flex items-center gap-1.5">
                  <ThumbsUp className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                  {formatCount(metadata.like_count)} likes
                </span>
              )}
            </div>

            {metadata.description && (
              <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text-subtle)" }}>
                {metadata.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  )
}
