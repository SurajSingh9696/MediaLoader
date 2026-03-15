import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'

export const metadata: Metadata = {
  title: 'MediaLoader — YouTube & Instagram Downloader',
  description:
    'Download YouTube videos, Shorts, and Instagram Reels in the best quality. Video + Audio or Audio Only — free and fast.',
  keywords: ['youtube downloader', 'instagram downloader', 'video download', 'audio download', 'reels downloader'],
  openGraph: {
    title: 'MediaLoader',
    description: 'Download YouTube & Instagram videos with ease',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
