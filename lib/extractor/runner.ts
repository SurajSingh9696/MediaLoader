/**
 * yt-dlp subprocess runner
 * Safely spawns yt-dlp with arguments (no shell = no injection risk).
 * Automatically injects --ffmpeg-location from ffmpeg-static if available.
 */

import { spawn } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'

const YTDLP_BIN = process.env.YTDLP_PATH ?? 'yt-dlp'
const YTDLP_COOKIES_FROM_BROWSER = process.env.YTDLP_COOKIES_FROM_BROWSER?.trim()

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

/** Prepend optional cookie source for sites that require authenticated sessions */
function withCookies(args: string[]): string[] {
  if (!YTDLP_COOKIES_FROM_BROWSER) return args
  return ['--cookies-from-browser', YTDLP_COOKIES_FROM_BROWSER, ...args]
}

export function runYtDlp(
  args: string[],
  opts?: { timeout?: number; maxBuffer?: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const finalArgs = withFfmpeg(withCookies(args))
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
  const finalArgs = withFfmpeg(withCookies(args))
  const proc = spawn(YTDLP_BIN, finalArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { stream: proc.stdout, proc }
}

/**
 * Download via yt-dlp to a temp file and resolve with the file path + extension.
 * On failure throws with the yt-dlp stderr message.
 *
 * The CALLER is responsible for deleting the file when done.
 */
export function runYtDlpToFile(
  args: string[],
  opts?: { timeout?: number }
): Promise<{ filePath: string; ext: string }> {
  const uid        = randomUUID()
  const outDir     = tmpdir()
  const outTemplate = join(outDir, `medialoader_${uid}.%(ext)s`)

  return new Promise((resolve, reject) => {
    const finalArgs = withFfmpeg(withCookies([
      ...args,
      '--no-part',             // no .part files mid-download
      '--no-warnings',
      '-o', outTemplate,
    ]))

    const errChunks: Buffer[] = []
    const proc = spawn(YTDLP_BIN, finalArgs, {
      timeout: opts?.timeout ?? 600_000, // 10 min max per download
      stdio: ['ignore', 'ignore', 'pipe'],
    })

    proc.stderr.on('data', (chunk: Buffer) => errChunks.push(chunk))
    proc.on('error', (err) => reject(new Error(`yt-dlp spawn error: ${err.message}`)))
    proc.on('close', (code) => {
      if (code !== 0) {
        const msg = Buffer.concat(errChunks).toString('utf8').trim()
        return reject(new Error(msg || `yt-dlp exited with code ${code}`))
      }

      // Find the output file (uid prefix, ignoring any temp yt-dlp artefacts)
      const prefix = `medialoader_${uid}.`
      const files = readdirSync(outDir).filter(
        f => f.startsWith(prefix) && !f.endsWith('.part') && !f.endsWith('.ytdl')
      )

      if (files.length === 0) {
        return reject(new Error('yt-dlp finished but no output file was found'))
      }

      const filename = files[0]
      const ext = filename.slice(filename.lastIndexOf('.') + 1)
      resolve({ filePath: join(outDir, filename), ext })
    })
  })
}
