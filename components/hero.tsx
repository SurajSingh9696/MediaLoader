"use client"

import { motion, type Variants } from "framer-motion"
import {
  Youtube,
  Instagram,
  Twitter,
  Facebook,
  Zap,
  Shield,
  Globe2,
} from "lucide-react"

const floatingIcons = [
  { icon: Youtube,    color: "text-red-400",   delay: 0,   x: -140, y: -55 },
  { icon: Instagram,  color: "text-pink-400",  delay: 0.3, x: 140,  y: -70 },
  { icon: Twitter,    color: "text-sky-400",   delay: 0.6, x: -155, y: 55  },
  { icon: Facebook,   color: "text-blue-400",  delay: 0.9, x: 155,  y: 70  },
  { icon: Globe2,     color: "text-emerald-400",delay:1.2, x: 0,    y: -110},
]

const features = [
  { icon: Zap,    label: "Lightning Fast" },
  { icon: Shield, label: "Safe & Private" },
  { icon: Globe2, label: "100+ Platforms" },
]

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.14, delayChildren: 0.2 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: "easeOut" },
  },
}

export default function Hero() {
  return (
    <section className="relative pt-44 pb-10 sm:pb-16 px-4 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, color-mix(in srgb, var(--bg-subtle) 80%, transparent), var(--bg))" }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(900px,100vw)] h-[400px] rounded-full blur-3xl opacity-25"
          style={{ background: "radial-gradient(ellipse, var(--accent) 0%, var(--accent-2) 50%, transparent 70%)" }} />
        <div className="absolute top-16 left-1/4 w-48 sm:w-72 h-48 sm:h-72 rounded-full blur-3xl opacity-10 animate-pulse"
          style={{ background: "var(--accent)" }} />
        <div className="absolute top-16 right-1/4 w-48 sm:w-72 h-48 sm:h-72 rounded-full blur-3xl opacity-10 animate-pulse [animation-delay:1s]"
          style={{ background: "var(--accent-2)" }} />
      </div>

      <div className="relative max-w-4xl mx-auto text-center">
        {/* Icon cluster */}
        <div className="relative inline-block mb-6 sm:mb-8">
          {floatingIcons.map(({ icon: Icon, color, delay, x, y }, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0, x: x * 0.4, y: y * 0.4 }}
              animate={{
                opacity: [0, 0.75, 0.6],
                scale: [0, 1.1, 1],
                x: [x * 0.4, x * 1.05, x],
                y: [y * 0.4, y * 1.05, y],
              }}
              transition={{ duration: 1.1, delay, ease: "easeOut" }}
              whileHover={{ scale: 1.25 }}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-xl backdrop-blur-sm flex items-center justify-center ${color} shadow-lg`}
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
            </motion.div>
          ))}

          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "backOut" }}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center shadow-2xl mx-auto"
            style={{
              background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
              boxShadow: "0 20px 60px var(--glow)",
            }}
          >
            <span className="text-2xl sm:text-3xl">⬇️</span>
          </motion.div>
        </div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          {/* Badge */}
          <motion.div variants={itemVariants}>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold mb-5 sm:mb-6"
              style={{
                background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--accent) 28%, transparent)",
                color: "var(--accent)",
              }}
            >
              <Zap className="w-3 h-3" />
              Free · No Login · No Limits
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            variants={itemVariants}
            className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.08] tracking-tight mb-4 sm:mb-6"
            style={{ color: "var(--text)" }}
          >
            Download Videos
            <br />
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(135deg, var(--accent), var(--accent-2) 55%, var(--accent-3))" }}
            >
              Instantly
            </span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            variants={itemVariants}
            className="text-base sm:text-lg md:text-xl max-w-xl sm:max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2"
            style={{ color: "var(--text-muted)" }}
          >
            Paste a YouTube, Instagram, TikTok, or any link below and download it in seconds —
            in your preferred quality and format.
          </motion.p>

          {/* Feature pills */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap items-center justify-center gap-3 sm:gap-6"
          >
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-subtle)" }}>
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{
                    background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                  }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                </div>
                {label}
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
