import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 overflow-hidden">
      {/* Gradient Orbs */}
      <div className="absolute top-0 left-0 w-[300px] h-[300px] bg-primary/10 rounded-full blur-[150px] animate-float pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[200px] h-[200px] bg-accent/10 rounded-full blur-[150px] animate-float pointer-events-none" style={{ animationDelay: "-3s" }} />

      {/* Content */}
      <div className="relative z-10 text-center space-y-6 max-w-3xl animate-fade-up">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight gradient-text">
          AI-Powered<br />Category Intelligence
        </h1>
        <p className="text-sm md:text-base text-muted max-w-md mx-auto">
          다국어 AI 카테고리 추천 시스템
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link
            href="/embed"
            className="btn-glow inline-flex h-11 items-center justify-center rounded-lg px-6 text-sm font-medium text-white transition-colors"
          >
            기술 시연
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-primary/50 px-6 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            로그인
          </Link>
        </div>
      </div>
    </section>
  );
}