import axios, { AxiosError } from "axios"
import type { MetadataResponse, DownloadRequest } from "./types"

const api = axios.create({
  baseURL: "",
  timeout: 60000,
})

export async function fetchMetadata(url: string): Promise<MetadataResponse> {
  try {
    const response = await api.post<MetadataResponse>("/api/metadata", { url })
    return response.data
  } catch (err: unknown) {
    if (err instanceof AxiosError) {
      const serverError =
        (err.response?.data as { error?: string; success?: boolean })?.error
      if (serverError) throw new Error(serverError)
      if (err.code === "ECONNABORTED" || err.message.includes("timeout")) {
        throw new Error("Request timed out. The video may be unavailable or the platform is slow.")
      }
      if (!err.response) {
        throw new Error("Could not connect to the server. Make sure the API is running.")
      }
    }
    throw err
  }
}

export async function downloadFile(
  request: DownloadRequest,
  onProgress?: (percent: number) => void
): Promise<void> {
  try {
    const response = await api.post("/api/download", request, {
      responseType: "blob",
      timeout: 300000,
      onDownloadProgress: (event) => {
        if (onProgress && event.total && event.total > 0) {
          const percent = Math.round((event.loaded / event.total) * 100)
          onProgress(Math.min(percent, 99))
        } else if (onProgress && event.loaded > 0) {
          onProgress(-1)
        }
      },
    })

    onProgress?.(100)

    const xFilename = response.headers["x-filename"]
    const contentDisposition = response.headers["content-disposition"]
    let filename = request.type === "audio" ? "audio.mp3" : "video.mp4"

    if (xFilename && typeof xFilename === "string") {
      filename = decodeURIComponent(xFilename)
    } else if (contentDisposition) {
      const match = contentDisposition.match(
        /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
      )
      if (match?.[1]) {
        filename = match[1].replace(/['"]/g, "").trim()
      }
    }

    const blob = new Blob([response.data], {
      type: request.type === "audio" ? "audio/mpeg" : "video/mp4",
    })
    const blobUrl = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = blobUrl
    link.setAttribute("download", filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000)
  } catch (err: unknown) {
    if (err instanceof AxiosError) {
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text()
          const parsed = JSON.parse(text) as { error?: string }
          if (parsed.error) throw new Error(parsed.error)
        } catch (parseErr) {
          if (parseErr instanceof SyntaxError) {
          } else {
            throw parseErr
          }
        }
      }
      const serverError = (err.response?.data as { error?: string })?.error
      if (serverError) throw new Error(serverError)
      if (err.code === "ECONNABORTED" || err.message.includes("timeout")) {
        throw new Error("Download timed out. Please try a lower quality or shorter video.")
      }
      if (!err.response) {
        throw new Error("Could not connect to the server. Make sure the API is running.")
      }
    }
    throw err
  }
}

