"use client"

import { motion } from "framer-motion"
import { AlertTriangle, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorDisplayProps {
  message: string
  onRetry: () => void
}

export default function ErrorDisplay({ message, onRetry }: ErrorDisplayProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-3xl mx-auto px-3 sm:px-4 pb-8 sm:pb-12"
    >
      <div
        className="rounded-2xl backdrop-blur-xl p-6 sm:p-8"
        style={{
          background: "rgba(239,68,68,0.04)",
          border: "1px solid rgba(239,68,68,0.18)",
        }}
      >
        <div className="flex flex-col items-center gap-4 sm:gap-5 text-center">
          <div
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7 text-red-400" />
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-base sm:text-lg" style={{ color: "var(--text)" }}>Something went wrong</p>
            <p className="text-sm max-w-md leading-relaxed" style={{ color: "rgba(252,165,165,0.7)" }}>{message}</p>
          </div>
          <Button variant="destructive" onClick={onRetry} className="gap-2">
            <RefreshCcw className="w-4 h-4" />
            Try Again
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
