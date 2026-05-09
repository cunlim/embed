import { Header } from "@/components/header";
import { HeroSection } from "@/components/hero-section";
import { TechBadges } from "@/components/tech-badges";
import { StatsCards } from "@/components/stats-cards";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <TechBadges />
        <StatsCards />
      </main>
      <Footer />
    </div>
  );
}
