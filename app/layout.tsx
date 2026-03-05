import type { Metadata, Viewport } from "next"
import "./globals.css"
import { ThemeProvider } from "@/providers/theme-provider"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export const metadata: Metadata = {
  title: "MediaLoader — Download Videos from Anywhere in Seconds",
  description:
    "Paste a YouTube, Instagram, TikTok, Twitter, or any video link and download it in seconds. Supports MP4 video and MP3 audio in multiple qualities. Free, fast, and no sign-up required.",
  keywords: [
    "video downloader",
    "youtube downloader",
    "instagram downloader",
    "tiktok downloader",
    "mp3 downloader",
    "mp4 downloader",
    "MediaLoader",
  ],
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
    shortcut: "/logo.png",
  },
  openGraph: {
    title: "MediaLoader — Download Videos from Anywhere in Seconds",
    description:
      "Free video downloader supporting YouTube, Instagram, TikTok, Twitter, and 100+ platforms.",
    type: "website",
    images: [{ url: "/logo.png" }],
    favicon: "/logo.png",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Prevent theme flash before JS loads */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  try {
    var t = localStorage.getItem('mf-theme');
    if (!t) t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.classList.add(t);
    document.documentElement.style.colorScheme = t;
  } catch(e){}
})();
          `,
          }}
        />
      </head>
      <body className="min-h-screen antialiased" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
