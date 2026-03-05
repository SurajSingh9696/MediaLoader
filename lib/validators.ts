import { z } from "zod"

export const urlSchema = z.object({
  url: z
    .string()
    .min(1, "Please enter a URL")
    .url("Please enter a valid URL")
    .refine(
      (val) => {
        try {
          const u = new URL(val)
          return u.protocol === "http:" || u.protocol === "https:"
        } catch {
          return false
        }
      },
      { message: "URL must start with http:// or https://" }
    ),
})

export type UrlFormValues = z.infer<typeof urlSchema>

export const downloadRequestSchema = z.object({
  url: z.string().url(),
  format_id: z.string().optional(),
  type: z.enum(["video", "audio"]),
  audio_quality: z.enum(["128", "192", "320"]).optional(),
})
