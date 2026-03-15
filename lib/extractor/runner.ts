/**
 * yt-dlp subprocess runner
 * Safely spawns yt-dlp with arguments (no shell = no injection risk).
 * Automatically injects --ffmpeg-location from ffmpeg-static if available.
 */

import { spawn } from 'child_process'
import { existsSync } from 'fs'

const YTDLP_BIN = process.env.YTDLP_PATH ?? 'yt-dlp'

// Resolve bundled ffmpeg-static path
function getFfmpegPath(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require('ffmpeg-static') as string
    if (p && existsSync(p)) return p
  } catch {}
  return null
}

const FFMPEG_PATH = getFfmpegPath()

/** Prepend --ffmpeg-location if we have a bundled binary */
function withFfmpeg(args: string[]): string[] {
  if (FFMPEG_PATH) return ['--ffmpeg-location', FFMPEG_PATH, ...args]
  return args
}

export function runYtDlp(
  args: string[],
  opts?: { timeout?: number; maxBuffer?: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const finalArgs = withFfmpeg(args)
    const proc = spawn(YTDLP_BIN, finalArgs, {
      timeout: opts?.timeout ?? 30_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []
    let totalSize = 0
    const maxBuffer = opts?.maxBuffer ?? 20 * 1024 * 1024

    proc.stdout.on('data', (chunk: Buffer) => {
      totalSize += chunk.length
      if (totalSize > maxBuffer) {
        proc.kill()
        return reject(new Error('yt-dlp output exceeded buffer limit'))
      }
      chunks.push(chunk)
    })

    proc.stderr.on('data', (chunk: Buffer) => errChunks.push(chunk))
    proc.on('error', (err) => reject(new Error(`yt-dlp spawn error: ${err.message}`)))
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks).toString('utf8'))
      } else {
        const stderrText = Buffer.concat(errChunks).toString('utf8')
        reject(new Error(stderrText.trim() || `yt-dlp exited with code ${code}`))
      }
    })
  })
}

/**
 * Stream yt-dlp output to stdout (for proxied downloads).
 */
export function streamYtDlp(args: string[]) {
  const finalArgs = withFfmpeg(args)
  const proc = spawn(YTDLP_BIN, finalArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { stream: proc.stdout, proc }
}
