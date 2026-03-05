import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .url("Please provide a valid URL")
    .refine(
      (v) => v.startsWith("http://") || v.startsWith("https://"),
      "URL must use http or https"
    ),
})

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000"

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid URL" },
      { status: 400 }
    )
  }

  const { url } = parsed.data

  try {
    const upstream = await fetch(`${PYTHON_SERVICE_URL}/metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(60000),
    })

    let data: unknown
    try {
      data = await upstream.json()
    } catch {
      return NextResponse.json(
        { success: false, error: "Media service returned an invalid response." },
        { status: 502 }
      )
    }

    if (!upstream.ok) {
      const detail = (data as { detail?: string })?.detail
      const message = detail ?? `Media service error (${upstream.status})`
      return NextResponse.json({ success: false, error: message }, { status: upstream.status })
    }

    return NextResponse.json({ success: true, data })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        return NextResponse.json(
          {
            success: false,
            error: "Request timed out. The video may be unavailable or the platform is slow.",
          },
          { status: 504 }
        )
      }
      if (err.message.includes("ECONNREFUSED") || err.message.includes("fetch failed")) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Media service is not running. Please start the Python backend on port 8000.",
          },
          { status: 503 }
        )
      }
      return NextResponse.json({ success: false, error: err.message }, { status: 502 })
    }
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    )
  }
}

