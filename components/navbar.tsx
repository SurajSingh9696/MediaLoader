"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Menu, X, Zap } from "lucide-react"
import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import ThemeToggle from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

const navLinks = [
  { label: "Platforms", href: "#platforms" },
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b"
      style={{
        backgroundColor: "color-mix(in srgb, var(--bg) 85%, transparent)",
        borderColor: "var(--border)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-3">
          {/* Logo */}
          <motion.a
            href="/"
            className="flex items-center gap-2.5 shrink-0"
            whileHover={{ scale: 1.03 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            {/* Icon chip — shows just the animal/play mark from the PNG */}
            <div
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden shrink-0"
              style={{
                background: "#080c14",
                boxShadow: "0 0 0 1.5px rgba(56,189,248,0.45), 0 0 14px rgba(56,189,248,0.25)",
              }}
            >
              <Image
                src="/logo.png"
                alt="MediaLoader"
                width={200}
                height={200}
                className="w-full h-full object-cover object-top"
                style={{ mixBlendMode: "screen" }}
                priority
              />
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
              Media<span style={{ color: "#38bdf8" }}>Loader</span>
            </span>
          </motion.a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-4 py-2 text-sm rounded-lg transition-all duration-200"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "var(--text)"
                  ;(e.currentTarget as HTMLElement).style.background = "var(--surface)"
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"
                  ;(e.currentTarget as HTMLElement).style.background = "transparent"
                }}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Button size="sm" variant="secondary" className="hidden sm:flex gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              Free Forever
            </Button>
            <button
              className="md:hidden p-2 rounded-lg transition-colors"
              style={{ color: "var(--text-muted)" }}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              <AnimatePresence mode="wait">
                {mobileOpen ? (
                  <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <X className="w-5 h-5" />
                  </motion.span>
                ) : (
                  <motion.span key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <Menu className="w-5 h-5" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="md:hidden border-t overflow-hidden"
            style={{
              borderColor: "var(--border)",
              background: "color-mix(in srgb, var(--bg) 95%, transparent)",
              backdropFilter: "blur(20px)",
            }}
          >
            <div className="px-4 py-4 flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "px-4 py-3 text-sm rounded-xl transition-all"
                  )}
                  style={{ color: "var(--text-muted)" }}
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                <span className="text-xs" style={{ color: "var(--text-subtle)" }}>Appearance</span>
                <ThemeToggle />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
