"use client"

import { motion, type Variants } from "framer-motion"
import { Link2, Search, Download, CheckCircle2 } from "lucide-react"

const steps = [
  {
    icon: Link2,
    step: "01",
    title: "Paste the URL",
    description:
      "Copy any video link from YouTube, Instagram, TikTok, Twitter, or 100+ other platforms and paste it into the input field.",
  },
  {
    icon: Search,
    step: "02",
    title: "Fetch Video Info",
    description:
      "Click Fetch Video. MediaLoader instantly retrieves the title, thumbnail, duration, and all available formats and qualities.",
  },
  {
    icon: Download,
    step: "03",
    title: "Choose Format & Quality",
    description:
      "Pick your preferred video resolution (up to 4K) or extract audio as MP3 at 128, 192, or 320 kbps.",
  },
  {
    icon: CheckCircle2,
    step: "04",
    title: "Download Instantly",
    description:
      "Hit Download. The file is processed server-side and delivered straight to your browser — no waiting, no ads.",
  },
]

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
}

const ACCENT_CYCLE = [
  { color: "#f43f5e", bg: "rgba(244,63,94,0.12)",   border: "rgba(244,63,94,0.25)"   },
  { color: "#e879f9", bg: "rgba(232,121,249,0.12)", border: "rgba(232,121,249,0.25)" },
  { color: "#fb923c", bg: "rgba(251,146,60,0.12)",  border: "rgba(251,146,60,0.25)"  },
  { color: "#34d399", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.25)"  },
]

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-12 sm:py-16 px-3 sm:px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10 sm:mb-14"
        >
          <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: "var(--text)" }}>
            How It{" "}
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
            >
              Works
            </span>
          </h2>
          <p className="text-sm sm:text-base" style={{ color: "var(--text-muted)" }}>
            Download any video in four simple steps
          </p>
        </motion.div>

        {/* Steps — horizontal connector line on md+ */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5"
        >
          {/* Connector line (desktop only) */}
          <div
            className="hidden lg:block absolute top-[2.75rem] left-[12.5%] right-[12.5%] h-px"
            style={{ background: "linear-gradient(to right, transparent, var(--border-accent), transparent)" }}
          />

          {steps.map((step, i) => {
            const { color, bg, border } = ACCENT_CYCLE[i % 4]
            const Icon = step.icon
            return (
              <motion.div
                key={step.step}
                variants={itemVariants}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="relative flex flex-col items-center text-center rounded-2xl p-5 sm:p-6 backdrop-blur-sm"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                {/* Step number badge */}
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: bg,
                    border: `1px solid ${border}`,
                    color,
                  }}
                >
                  {step.step}
                </span>

                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 mt-2"
                  style={{ background: bg, border: `1px solid ${border}` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>

                <h3 className="font-bold text-sm sm:text-base mb-2" style={{ color: "var(--text)" }}>
                  {step.title}
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {step.description}
                </p>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
