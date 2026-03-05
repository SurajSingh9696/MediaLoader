"use client"

import { useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link2, Loader2, Search, ClipboardPaste, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { urlSchema, type UrlFormValues } from "@/lib/validators"
import { cn } from "@/lib/utils"

interface UrlInputProps {
  onFetch: (url: string) => void
  onReset: () => void
  isLoading: boolean
  hasResult: boolean
}

export default function UrlInput({ onFetch, onReset, isLoading, hasResult }: UrlInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UrlFormValues>({
    resolver: zodResolver(urlSchema),
  })

  const currentUrl = watch("url")

  useEffect(() => {
    const handleFocus = () => inputRef.current?.focus()
    handleFocus()
  }, [])

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      if (text?.startsWith("http")) {
        setValue("url", text.trim(), { shouldValidate: true })
      }
    } catch {
    }
  }

  function handleClear() {
    reset()
    onReset()
    inputRef.current?.focus()
  }

  function onSubmit(data: UrlFormValues) {
    onFetch(data.url)
  }

  const inputProps = register("url")

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-3xl mx-auto px-3 sm:px-4 pb-8 sm:pb-12"
    >
      <div
        className="relative rounded-2xl backdrop-blur-xl p-4 sm:p-6"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ background: "linear-gradient(to bottom, color-mix(in srgb, var(--accent) 4%, transparent), transparent)" }}
        />

        <form onSubmit={handleSubmit(onSubmit)} className="relative flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
            <div className="relative flex-1">
              <Link2
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: "var(--text-subtle)" }}
              />
              <Input
                {...inputProps}
                ref={(e) => {
                  inputProps.ref(e)
                  ;(inputRef as React.MutableRefObject<HTMLInputElement | null>).current = e
                }}
                type="url"
                placeholder="Paste a video URL here..."
                className="pl-10 pr-10 h-12 sm:h-13 text-base"
                disabled={isLoading}
              />
              {currentUrl && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "var(--text-subtle)" }}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isLoading}
              className="w-full sm:w-auto shrink-0 h-12 sm:h-13"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Fetch Video
                </>
              )}
            </Button>
          </div>

          {errors.url && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-red-400 flex items-center gap-1.5"
            >
              <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
              {errors.url.message}
            </motion.p>
          )}

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-0.5">
            <button
              type="button"
              onClick={handlePaste}
              className={cn(
                "flex items-center gap-1.5 text-xs transition-colors py-1.5 px-2.5 rounded-lg"
              )}
              style={{ color: "var(--text-muted)" }}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              Paste from clipboard
            </button>
            <span className="text-xs hidden sm:block" style={{ color: "var(--text-subtle)" }}>•</span>
            <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
              YouTube · TikTok · Instagram · Twitter · and more
            </span>
          </div>
        </form>
      </div>
    </motion.section>
  )
}
