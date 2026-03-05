"use client"

import { motion, type Variants } from "framer-motion"
import { Zap, Shield, Headphones, Film, Globe2, Infinity } from "lucide-react"

const ACCENT_CYCLE = [
  { color: "#f43f5e", bg: "rgba(244,63,94,0.14)",   border: "rgba(244,63,94,0.28)"   },
  { color: "#e879f9", bg: "rgba(232,121,249,0.14)", border: "rgba(232,121,249,0.28)" },
  { color: "#fb923c", bg: "rgba(251,146,60,0.14)",  border: "rgba(251,146,60,0.28)"  },
]

const features = [
  { icon: Zap,        title: "Lightning Fast",   description: "Direct downloads powered by yt-dlp with no intermediate processing delays." },
  { icon: Shield,     title: "Safe & Private",    description: "No sign-ups, no tracking. Your URLs are never stored or logged." },
  { icon: Film,       title: "Multiple Formats",  description: "Videos in 360p, 480p, 720p, 1080p, 4K. Audio in MP3 at various bitrates." },
  { icon: Headphones, title: "Audio Extraction",  description: "Extract clean MP3 audio at 128, 192, or 320 kbps from any video." },
  { icon: Globe2,     title: "Universal Support", description: "Hundreds of video sites supported through yt-dlp's extensive extractor library." },
  { icon: Infinity,   title: "No Limits",         description: "Completely free with no daily download caps or file size restrictions." },
]

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
}

export default function FeaturesSection() {
  return (
    <section id="features" className="py-12 sm:py-16 px-3 sm:px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10 sm:mb-12"
        >
          <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: "var(--text)" }}>
            Everything You{" "}
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
            >
              Need
            </span>
          </h2>
          <p className="text-sm sm:text-base" style={{ color: "var(--text-muted)" }}>
            A production-grade downloader with a clean modern interface
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
        >
          {features.map((feature, i) => {
            const { color, bg, border } = ACCENT_CYCLE[i % 3]
            return (
              <motion.div
                key={feature.title}
                variants={cardVariants}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="rounded-2xl p-4 sm:p-5 backdrop-blur-sm transition-colors duration-200"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center mb-3 sm:mb-4"
                  style={{ color, background: bg, border: `1px solid ${border}` }}
                >
                  <feature.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold mb-1.5 text-sm sm:text-base" style={{ color: "var(--text)" }}>
                  {feature.title}
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {feature.description}
                </p>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
