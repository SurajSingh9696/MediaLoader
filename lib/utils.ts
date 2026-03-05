import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "Unknown"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${m}:${String(s).padStart(2, "0")}`
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return "Unknown size"
  const units = ["B", "KB", "MB", "GB"]
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

export function extractPlatform(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    if (hostname.includes("youtube") || hostname.includes("youtu.be")) return "YouTube"
    if (hostname.includes("instagram")) return "Instagram"
    if (hostname.includes("tiktok")) return "TikTok"
    if (hostname.includes("twitter") || hostname.includes("x.com")) return "Twitter / X"
    if (hostname.includes("facebook") || hostname.includes("fb.watch")) return "Facebook"
    if (hostname.includes("reddit")) return "Reddit"
    if (hostname.includes("vimeo")) return "Vimeo"
    if (hostname.includes("dailymotion")) return "Dailymotion"
    if (hostname.includes("twitch")) return "Twitch"
    return "Unknown"
  } catch {
    return "Unknown"
  }
}

export function sanitizeUrl(url: string): string {
  return url.trim().replace(/[<>"'`;]/g, "")
}
