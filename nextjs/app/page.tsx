"use client";

import { useState, useEffect } from "react";
import {
  Languages,
  Cpu,
  Zap,
  ArrowRight,
  Sun,
  Moon,
  FileText,
  ChevronDown,
  Globe,
  Clock,
  Shield,
  Container,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ===== Theme Toggle =====
function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(stored === "dark" || (!stored && prefersDark));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  if (!mounted) return <div className="size-5" />;

  return (
    <button
      onClick={toggle}
      className="relative flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-all hover:border-primary/40 hover:text-primary hover:shadow-[0_0_12px_rgba(6,182,212,0.15)]"
      aria-label={dark ? "라이트 모드 전환" : "다크 모드 전환"}
    >
      <Sun
        className={cn(
          "size-[18px] transition-all",
          dark ? "scale-0 opacity-0" : "scale-100 opacity-100",
        )}
      />
      <Moon
        className={cn(
          "absolute size-[18px] transition-all",
          dark ? "scale-100 opacity-100" : "scale-0 opacity-0",
        )}
      />
    </button>
  );
}

// ===== Navbar =====
function Navbar() {
  return (
    <header className="fixed top-0 right-0 left-0 z-50">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="/" className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary text-xs font-bold text-primary-foreground">
            CE
          </div>
          <span className="text-sm font-semibold tracking-tight">
            CL Embed
          </span>
        </a>

        <div className="flex items-center gap-3">
          <a
            href="/embed"
            className="hidden items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 hover:shadow-[0_0_16px_rgba(6,182,212,0.3)] sm:flex"
          >
            기술 시연
            <ArrowRight className="size-3.5" />
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

// ===== Hero Section =====
function HeroSection() {
  return (
    <section className="orb-container relative flex min-h-dvh items-center justify-center overflow-hidden">
      {/* Floating Orbs */}
      <div className="orb orb--cyan animate-float-slow" style={{ top: "-10%", left: "-10%" }} />
      <div className="orb orb--indigo animate-float" style={{ bottom: "-5%", right: "-5%" }} />
      <div className="orb orb--amber animate-float-slow" style={{ top: "40%", right: "30%", animationDelay: "-6s" }} />

      {/* Grid Overlay */}
      <div className="grid-overlay pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.06]" />

      {/* Code Decoration */}
      <div className="pointer-events-none absolute top-24 right-8 hidden font-mono text-[200px] font-black leading-none text-border opacity-30 select-none lg:block">
        {"</>"}
      </div>
      <div className="pointer-events-none absolute bottom-16 left-8 hidden font-mono text-[100px] font-black leading-none text-border opacity-20 select-none lg:block">
        {"{ }"}
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <div className="mb-4 animate-fade-in stagger-1 opacity-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1 text-xs font-medium text-primary">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-current" />
            기술 시연 포트폴리오
          </span>
        </div>

        <h1 className="animate-fade-in-up stagger-2 mb-6 text-4xl font-extrabold leading-tight tracking-tight opacity-0 sm:text-5xl md:text-6xl lg:text-7xl">
          <span className="text-gradient">AI 기반 다국어</span>
          <br />
          <span>카테고리 추천 시스템</span>
        </h1>

        <p className="animate-fade-in-up stagger-3 mx-auto mb-10 max-w-2xl text-base leading-relaxed text-muted-foreground opacity-0 sm:text-lg">
          상품명이나 텍스트를 입력하면 로컬 AI 모델이 분석하여
          <br className="hidden sm:block" />
          <strong className="font-semibold text-foreground">한국어, 중국어, 영어</strong>로
          가장 적합한 카테고리를 실시간 추천합니다.
        </p>

        <div className="animate-fade-in-up stagger-4 flex flex-col items-center justify-center gap-4 opacity-0 sm:flex-row">
          <a
            href="/embed"
            className="group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-primary to-secondary px-7 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_24px_rgba(6,182,212,0.35)]"
          >
            <span className="relative z-10 flex items-center gap-2">
              기술 시연 체험하기
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </a>
          <a
            href="https://github.com/cunlim/cl_embed"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-border bg-card/50 px-7 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all hover:border-primary/30 hover:text-foreground"
          >
            <GitBranch className="size-4" />
            GitHub 저장소
          </a>
        </div>

        {/* Code snippet decorative */}
        <div className="animate-fade-in-up stagger-5 mx-auto mt-12 hidden max-w-lg rounded-xl border border-border bg-card/40 p-4 text-left font-mono text-xs leading-relaxed text-muted-foreground backdrop-blur-sm opacity-0 sm:block">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full bg-red-400" />
            <span className="inline-block size-2.5 rounded-full bg-yellow-400" />
            <span className="inline-block size-2.5 rounded-full bg-green-400" />
            <span className="ml-2 text-[10px] text-muted-foreground/60">embed.cunlim.dev</span>
          </div>
          <div>
            <span className="text-primary">$</span>{" "}
            <span className="text-secondary">curl</span> -X POST{" "}
            <span className="text-accent">/api/recommend</span> \<br />
            &nbsp;&nbsp;-d{' "{"}'}<span className="text-accent">"text"</span>:{" "}
            <span className="text-green-400">"여성 여름 원피스"</span>
            {'"}'}
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 animate-bounce flex-col items-center gap-1 text-muted-foreground/40">
        <span className="text-[10px] font-medium tracking-wider uppercase">Scroll</span>
        <ChevronDown className="size-4" />
      </div>
    </section>
  );
}

// ===== Stats Section =====
const stats = [
  { icon: Globe, value: "3", label: "지원 언어", detail: "한국어 / 중국어 / 영어" },
  { icon: Clock, value: "<100ms", label: "캐시 응답", detail: "동일 키워드 즉시 처리" },
  { icon: Shield, value: "99%+", label: "AI 안정성", detail: "자동 재시도 + 오류 방어" },
  { icon: Container, value: "4", label: "컨테이너", detail: "Next.js / Laravel / DB / Redis" },
];

function StatsSection() {
  return (
    <section className="relative border-t border-border py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={cn(
                "group relative bg-card p-6 transition-colors hover:bg-muted/50 md:p-8",
              )}
            >
              <stat.icon className="mb-3 size-5 text-primary/60" />
              <div className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">{stat.value}</div>
              <div className="mb-0.5 text-sm font-medium">{stat.label}</div>
              <div className="text-xs text-muted-foreground/70">{stat.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== Features Section =====
const features = [
  {
    icon: Languages,
    title: "다국어 지원",
    description: "한국어, 중국어, 영어 3개 언어를 동시에 지원합니다. 각 언어별로 최적화된 카테고리 매핑 결과를 제공합니다.",
    gradient: "from-cyan-500 to-cyan-600",
  },
  {
    icon: Cpu,
    title: "로컬 AI 분석",
    description: "Ollama 기반 로컬 AI 모델(Translategemma, Nomic Embed Text)로 번역 및 임베딩을 처리합니다. 외부 API 의존성 없이 자체 운영됩니다.",
    gradient: "from-indigo-500 to-indigo-600",
  },
  {
    icon: Zap,
    title: "실시간 처리",
    description: "Laravel Queue + Redis + WebSocket(Reverb) 파이프라인을 통해 대량 데이터도 실시간으로 처리하며 진행률을 업데이트합니다.",
    gradient: "from-amber-500 to-orange-600",
  },
];

function FeaturesSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            핵심 기술
          </h2>
          <p className="mx-auto max-w-lg text-muted-foreground">
            pgvector 코사인 유사도 검색과 AI 기반 파이프라인으로
            정확하고 빠른 카테고리 추천을 제공합니다.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="group relative rounded-2xl border border-border bg-card p-8 transition-all hover:border-primary/20 hover:shadow-[0_0_30px_rgba(6,182,212,0.06)]"
            >
              {/* Gradient top border */}
              <div
                className={cn(
                  "absolute top-0 right-6 left-6 h-0.5 rounded-full bg-gradient-to-r opacity-60 transition-all group-hover:opacity-100",
                  feature.gradient,
                )}
              />

              <feature.icon className="mb-5 size-8 text-primary" />
              <h3 className="mb-3 text-lg font-bold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== How It Works Section =====
const steps = [
  { num: 1, title: "텍스트 입력", description: "분석할 상품명이나 텍스트를 입력하고 타겟 언어를 선택합니다." },
  { num: 2, title: "AI 분석", description: "로컬 AI 모델이 번역과 임베딩을 생성하여 벡터 데이터로 변환합니다." },
  { num: 3, title: "카테고리 추천", description: "pgvector 코사인 유사도 검색으로 가장 적합한 카테고리를 추천합니다." },
];

function HowItWorksSection() {
  return (
    <section className="border-t border-border py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            동작 방식
          </h2>
          <p className="mx-auto max-w-lg text-muted-foreground">
            단계별 파이프라인을 통해 입력부터 추천까지 자동으로 처리됩니다.
          </p>
        </div>

        <div className="relative grid gap-8 md:grid-cols-3">
          {/* Connecting line */}
          <div className="absolute top-12 left-[calc(16.67%+12px)] right-[calc(16.67%+12px)] hidden h-0.5 bg-gradient-to-r from-primary/40 via-secondary/40 to-accent/40 md:block" />

          {steps.map((step, i) => (
            <div key={step.num} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 mb-6 flex size-24 items-center justify-center rounded-2xl border border-border bg-card shadow-lg">
                <span className="text-2xl font-bold text-gradient">{step.num}</span>
              </div>
              <h3 className="mb-2 text-lg font-bold">{step.title}</h3>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== Tech Stack Section =====
const techItems = [
  { name: "Next.js", category: "Frontend", color: "from-cyan-500/20 to-cyan-600/10" },
  { name: "TypeScript", category: "Language", color: "from-blue-500/20 to-blue-600/10" },
  { name: "Tailwind CSS", category: "Styling", color: "from-teal-500/20 to-teal-600/10" },
  { name: "Laravel", category: "Backend", color: "from-red-500/20 to-red-600/10" },
  { name: "PHP", category: "Language", color: "from-purple-500/20 to-purple-600/10" },
  { name: "PostgreSQL", category: "Database", color: "from-blue-600/20 to-blue-700/10" },
  { name: "pgvector", category: "Vector Search", color: "from-green-500/20 to-green-600/10" },
  { name: "Redis", category: "Cache", color: "from-rose-500/20 to-rose-600/10" },
  { name: "WebSocket", category: "Realtime", color: "from-orange-500/20 to-orange-600/10" },
  { name: "Ollama", category: "AI", color: "from-yellow-500/20 to-yellow-600/10" },
  { name: "Docker", category: "Infra", color: "from-sky-500/20 to-sky-600/10" },
  { name: "Reverb", category: "WebSocket", color: "from-indigo-500/20 to-indigo-600/10" },
];

function TechStackSection() {
  return (
    <section className="border-t border-border py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            기술 스택
          </h2>
          <p className="mx-auto max-w-lg text-muted-foreground">
            현대적인 기술 스택으로 구축된 엔터프라이즈급 시스템입니다.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl grid-cols-3 gap-3 sm:grid-cols-4 md:gap-4">
          {techItems.map((tech) => (
            <div
              key={tech.name}
              className={cn(
                "group relative overflow-hidden rounded-xl border border-border bg-card p-4 text-center transition-all hover:border-primary/20 hover:shadow-[0_0_20px_rgba(6,182,212,0.05)] md:p-5",
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100",
                  tech.color,
                )}
              />
              <div className="relative z-10">
                <div className="mb-1 text-sm font-semibold">{tech.name}</div>
                <div className="text-[10px] text-muted-foreground/60">{tech.category}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== CTA Section =====
function CTASection() {
  return (
    <section className="relative border-t border-border py-20 md:py-28">
      {/* Background glow */}
      <div className="orb orb--cyan pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.08]" />

      <div className="relative mx-auto max-w-2xl px-6 text-center">
        <h2 className="mb-6 text-3xl font-bold tracking-tight md:text-4xl">
          지금 바로 체험해보세요
        </h2>
        <p className="mb-10 text-muted-foreground">
          텍스트를 입력하면 AI가 분석하여 최적의 카테고리를 실시간으로 추천합니다.
          회원가입 없이 누구나 사용할 수 있습니다.
        </p>
        <a
          href="/embed"
          className="group inline-flex h-14 items-center gap-2.5 rounded-full bg-gradient-to-r from-primary to-secondary px-9 text-base font-semibold text-primary-foreground transition-all hover:shadow-[0_0_32px_rgba(6,182,212,0.35)]"
        >
          기술 시연 시작하기
          <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
        </a>
        <p className="mt-4 text-xs text-muted-foreground/50">
          로그인 없이 자유롭게 체험 가능
        </p>
      </div>
    </section>
  );
}

// ===== Footer =====
function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <span className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-secondary text-[10px] font-bold text-primary-foreground">
            CE
          </span>
          <span>CL Embed &copy; {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-5 text-sm text-muted-foreground">
          <a
            href="https://github.com/cunlim/cl_embed"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <GitBranch className="size-4" />
            GitHub
          </a>
          <a
            href="/docs/PRD.md"
            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <FileText className="size-4" />
            기술 문서
          </a>
        </div>
      </div>
    </footer>
  );
}

// ===== Main Page =====
export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TechStackSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
