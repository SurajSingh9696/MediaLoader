"use client"

import { motion, type Variants } from "framer-motion"
import { Youtube, Instagram, Twitter, Facebook, Globe2, Tv2 } from "lucide-react"

const platforms = [
  { name: "YouTube",     icon: Youtube,   hex: "#ef4444" },
  { name: "Instagram",   icon: Instagram, hex: "#ec4899" },
  { name: "TikTok",      icon: Tv2,       hex: "#ff2d55" },
  { name: "Twitter / X", icon: Twitter,   hex: "#1d9bf0" },
  { name: "Facebook",    icon: Facebook,  hex: "#2563eb" },
  { name: "Reddit",      icon: Globe2,    hex: "#f97316" },
  { name: "Vimeo",       icon: Globe2,    hex: "#1ab7ea" },
  { name: "Dailymotion", icon: Globe2,    hex: "#0066dc" },
  { name: "Twitch",      icon: Globe2,    hex: "#9146ff" },
]

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut" },
  },
}

export default function PlatformsSection() {
  return (
    <section id="platforms" className="py-12 sm:py-16 px-3 sm:px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 sm:mb-10"
        >
          <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: "var(--text)" }}>
            Works on{" "}
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
            >
              All Major Platforms
            </span>
          </h2>
          <p className="text-sm sm:text-base" style={{ color: "var(--text-muted)" }}>
            Powered by yt-dlp — supports hundreds of video sites
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-2.5 sm:gap-3"
        >
          {platforms.map(({ name, icon: Icon, hex }) => (
            <motion.div
              key={name}
              variants={itemVariants}
              whileHover={{ scale: 1.07, y: -3, transition: { duration: 0.15 } }}
              className="flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl backdrop-blur-sm cursor-default transition-colors duration-200"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <Icon className="w-4 h-4 shrink-0" style={{ color: hex }} />
              <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>{name}</span>
            </motion.div>
          ))}
          <motion.div
            variants={itemVariants}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl backdrop-blur-sm"
            style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
          >
            <Globe2 className="w-4 h-4" style={{ color: "var(--text-subtle)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--text-subtle)" + "" }}>+ Many More</span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
