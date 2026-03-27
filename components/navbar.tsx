'use client'

import { motion } from 'framer-motion'
import { Download, Zap } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'

export function Navbar() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 px-4 py-3"
    >
      <div className="max-w-5xl mx-auto">
        <div className="glass rounded-2xl px-4 py-2.5 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700
                            flex items-center justify-center shadow-glow-sm">
              <Download size={15} className="text-white" strokeWidth={2.5} />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-base text-text-primary tracking-tight">
                Media<span className="gradient-text">Loader</span>
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md
                               bg-sky-500/15 text-sky-500 border border-sky-500/25 leading-none">
                BETA
              </span>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-text-secondary">
              <Zap size={11} className="text-amber-400" />
              <span>YouTube &amp; Instagram</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-border mx-1" />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </motion.header>
  )
}
