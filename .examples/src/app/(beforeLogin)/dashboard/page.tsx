import { AuthRedirect } from '../_components/auth-redirect'
import FeaturesSection from '../_components/features-section'
import Footer from '../_components/footer'
import Header from '../_components/header'
import HeroSection from '../_components/hero-section'

export default function DashboardPage() {
  return (
    <div className="box-border flex h-full w-full flex-col overflow-auto">
      <Header />
      <AuthRedirect />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
      </main>
      <Footer />
    </div>
  )
}
