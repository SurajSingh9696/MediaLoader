"use client"

import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"

export default function LoadingState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="max-w-3xl mx-auto px-3 sm:px-4 pb-8 sm:pb-12"
    >
      <div
        className="rounded-2xl backdrop-blur-xl p-8"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
              }}
            >
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
            </div>
            <div
              className="absolute inset-0 rounded-2xl blur-xl animate-pulse"
              style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)" }}
            />
          </div>

          <div className="text-center space-y-2">
            <p className="font-semibold text-lg" style={{ color: "var(--text)" }}>Fetching video info...</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Extracting metadata from the video source
            </p>
          </div>

          <div className="w-full max-w-xs space-y-2">
            {[60, 85, 40].map((w, i) => (
              <motion.div
                key={i}
                className="h-2 rounded-full"
                style={{ width: `${w}%`, background: "var(--surface-hover)" }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(to right, var(--accent), var(--accent-2))" }}
                  animate={{ width: ["0%", "100%", "0%"] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut",
                  }}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
