"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sun, Moon } from "lucide-react"
import { useTheme } from "@/providers/theme-provider"

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = theme === "dark"

  if (!mounted) {
    return (
      <div
        className="w-[52px] h-7 rounded-full"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      />
    )
  }

  return (
    <motion.button
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      whileTap={{ scale: 0.92 }}
      className="relative flex items-center w-[52px] h-7 rounded-full p-0.5 transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      style={{
        background: isDark
          ? "linear-gradient(135deg, #1c1714 0%, #2a1818 100%)"
          : "linear-gradient(135deg, #fde68a 0%, #fed7aa 100%)",
        boxShadow: isDark
          ? "0 0 0 1px rgba(244,63,94,0.28), 0 2px 8px rgba(0,0,0,0.5)"
          : "0 0 0 1px rgba(251,191,36,0.4), 0 2px 8px rgba(0,0,0,0.15)",
      }}
    >
      {/* Track twinkling stars (dark) or rays (light) */}
      <AnimatePresence mode="wait">
        {isDark ? (
          <motion.span
            key="stars"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute left-1.5 top-1 flex flex-col gap-0.5 pointer-events-none"
          >
            {[2, 1.5, 1].map((size, i) => (
              <motion.span
                key={i}
                animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.3, 1] }}
                transition={{ duration: 1.5 + i * 0.4, repeat: Infinity, delay: i * 0.3 }}
                className="rounded-full bg-white"
                style={{ width: size, height: size }}
              />
            ))}
          </motion.span>
        ) : (
          <motion.span
            key="rays"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
          >
            {[...Array(4)].map((_, i) => (
              <motion.span
                key={i}
                animate={{ scaleY: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                className="absolute w-[1.5px] h-[5px] bg-amber-600/70 rounded-full origin-center"
                style={{
                  transform: `rotate(${i * 45}deg) translateY(-7px)`,
                  left: "50%",
                  top: "50%",
                }}
              />
            ))}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Knob */}
      <motion.span
        layout
        animate={{ x: isDark ? 24 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="relative z-10 flex items-center justify-center w-6 h-6 rounded-full shadow-md"
        style={{
          background: isDark
            ? "linear-gradient(135deg, #fda4af 0%, #f472b6 100%)"
            : "linear-gradient(135deg, #fbbf24 0%, #f97316 100%)",
          boxShadow: isDark
            ? "0 0 8px rgba(244,63,94,0.55), 0 2px 4px rgba(0,0,0,0.35)"
            : "0 0 8px rgba(251,191,36,0.7), 0 2px 4px rgba(0,0,0,0.15)",
        }}
      >
        <AnimatePresence mode="wait">
          {isDark ? (
            <motion.span
              key="moon"
              initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="absolute"
            >
              <Moon className="w-3.5 h-3.5 text-rose-950" strokeWidth={2.5} />
            </motion.span>
          ) : (
            <motion.span
              key="sun"
              initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="absolute"
            >
              <Sun className="w-3.5 h-3.5 text-amber-800" strokeWidth={2.5} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>
    </motion.button>
  )
}
