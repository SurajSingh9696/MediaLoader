import Navbar from "@/components/navbar"
import Hero from "@/components/hero"
import UrlSection from "@/components/url-section"
import PlatformsSection from "@/components/platforms-section"
import FeaturesSection from "@/components/features-section"
import HowItWorksSection from "@/components/how-it-works-section"
import Footer from "@/components/footer"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg)" }}>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <UrlSection />
        <PlatformsSection />
        <FeaturesSection />
        <HowItWorksSection />
      </main>
      <Footer />
    </div>
  )
}

