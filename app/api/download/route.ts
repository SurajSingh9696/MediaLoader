import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .url("Please provide a valid URL"),
  type: z.enum(["video", "audio"]),
  format_id: z.string().optional(),
  audio_quality: z.enum(["128", "192", "320"]).optional(),
})

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000"

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    )
  }

  const { url, type, format_id, audio_quality } = parsed.data
  const endpoint = type === "audio" ? "/download/audio" : "/download/video"

  try {
    const upstream = await fetch(`${PYTHON_SERVICE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, format_id, audio_quality }),
      signal: AbortSignal.timeout(300000),
    })

    if (!upstream.ok) {
      let detail: string | undefined
      try {
        const errData = (await upstream.json()) as { detail?: string }
        detail = errData?.detail
      } catch {
      }
      const message = detail ?? `Media service responded with status ${upstream.status}.`
      return NextResponse.json({ error: message }, { status: upstream.status })
    }

    if (!upstream.body) {
      return NextResponse.json({ error: "No file data returned from media service." }, { status: 502 })
    }

    const contentType =
      upstream.headers.get("content-type") ??
      (type === "audio" ? "audio/mpeg" : "video/mp4")
    const contentDisposition =
      upstream.headers.get("content-disposition") ??
      `attachment; filename="${type === "audio" ? "audio.mp3" : "video.mp4"}"`
    const contentLength = upstream.headers.get("content-length")
    const xFilename = upstream.headers.get("x-filename")

    const headers = new Headers()
    headers.set("Content-Type", contentType)
    headers.set("Content-Disposition", contentDisposition)
    if (contentLength) headers.set("Content-Length", contentLength)
    if (xFilename) headers.set("X-Filename", xFilename)
    headers.set("Cache-Control", "no-cache")

    return new NextResponse(upstream.body, { status: 200, headers })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        return NextResponse.json(
          { error: "Download timed out (5 min limit). Try a lower quality or shorter video." },
          { status: 504 }
        )
      }
      if (err.message.includes("ECONNREFUSED") || err.message.includes("fetch failed")) {
        return NextResponse.json(
          {
            error:
              "Media service is not running. Please start the Python backend on port 8000.",
          },
          { status: 503 }
        )
      }
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 })
  }
}

