import { Github, Heart } from "lucide-react"
import Image from "next/image"

const platforms = [
  "YouTube", "Instagram", "TikTok", "Twitter / X",
  "Facebook", "Reddit", "Vimeo", "Dailymotion", "Twitch",
]

export default function Footer() {
  return (
    <footer
      className="border-t backdrop-blur-xl"
      style={{
        borderColor: "var(--border)",
        background: "color-mix(in srgb, var(--bg-subtle) 90%, transparent)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 sm:gap-10 mb-8 sm:mb-10">
          {/* Brand */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl overflow-hidden shrink-0"
                style={{
                  background: "#080c14",
                  boxShadow: "0 0 0 1.5px rgba(56,189,248,0.45), 0 0 12px rgba(56,189,248,0.2)",
                }}
              >
                <Image
                  src="/logo.png"
                  alt="MediaLoader"
                  width={180}
                  height={180}
                  className="w-full h-full object-cover object-top"
                  style={{ mixBlendMode: "screen" }}
                />
              </div>
              <span className="text-lg font-bold tracking-tight" style={{ color: "var(--text)" }}>
                Media<span style={{ color: "#38bdf8" }}>Loader</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: "var(--text-subtle)" }}>
              Download Videos from Anywhere in Seconds. Fast, free, and powered by yt-dlp.
            </p>
          </div>

          {/* Platforms */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Supported Platforms
            </h4>
            <ul className="grid grid-cols-2 gap-1.5">
              {platforms.map((p) => (
                <li key={p} className="text-sm transition-colors" style={{ color: "var(--text-subtle)" }}>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {/* How it works */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              How It Works
            </h4>
            <ol className="space-y-2">
              {["Paste your video URL", "Click Fetch Video", "Choose format & quality", "Download instantly"].map(
                (step, i) => (
                  <li key={step} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--text-subtle)" }}>
                    <span className="font-bold text-xs mt-0.5 shrink-0" style={{ color: "var(--accent)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {step}
                  </li>
                )
              )}
            </ol>
          </div>
        </div>

        <div
          className="border-t pt-5 sm:pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4"
          style={{ borderColor: "var(--border)" }}
        >
          <p className="text-sm text-center sm:text-left" style={{ color: "var(--text-subtle)" }}>
            © {new Date().getFullYear()} MediaLoader. For personal use only.
          </p>
          <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-subtle)" }}>
            <span>Built with</span>
            <Heart className="w-3.5 h-3.5 text-red-400/70" />
            <span>using Next.js &amp; yt-dlp</span>
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: "var(--text-subtle)" }}
          >
            <Github className="w-4 h-4" />
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}
