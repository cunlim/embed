"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Terminal, Globe, Search, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { AuthButtons } from "@/components/auth-buttons";
import { cn } from "@/lib/utils";

export default function Home() {
  const [mounted, setMounted] = React.useState(false);
  const [typedText, setTypedText] = React.useState("");
  const fullText = "Multilingual Category Intelligence";

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setTypedText(fullText.slice(0, i + 1));
      i++;
      if (i >= fullText.length) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: Globe,
      title: "다국어 지원",
      description: "한국어, 중국어, 영어 텍스트 분석 및 카테고리 매핑",
      gradient: "from-blue-500/20 to-blue-600/10",
    },
    {
      icon: Search,
      title: "의미 기반 검색",
      description: "pgvector 코사인 유사도로 정확한 카테고리 추천",
      gradient: "from-purple-500/20 to-purple-600/10",
    },
    {
      icon: Cpu,
      title: "로컬 AI 추론",
      description: "Ollama 기반 온프레미스 LLM으로 데이터 보안 유지",
      gradient: "from-amber-500/20 to-amber-600/10",
    },
    {
      icon: Terminal,
      title: "Async Pipeline",
      description: "Laravel Queue + Redis로 비동기 번역 및 임베딩 처리",
      gradient: "from-emerald-500/20 to-emerald-600/10",
    },
  ];

  const terminalLines = [
    { prefix: "$", text: "analyze --text '새로운 기술 트렌드 분석'", delay: 0 },
    { prefix: ">", text: "ko → en 번역 완료 (145ms)", delay: 1 },
    { prefix: ">", text: "벡터 임베딩 생성 (1024d)", delay: 2 },
    {
      prefix: ">",
      text: "추천: IT/과학 > 기술일반 (0.94)",
      delay: 3,
      highlight: true,
    },
  ];

  const [visibleLines, setVisibleLines] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!mounted) return;
    const timers: NodeJS.Timeout[] = [];
    terminalLines.forEach((line, idx) => {
      const timer = setTimeout(() => {
        setVisibleLines((prev) => [...prev, line.text]);
      }, (idx + 1) * 600);
      timers.push(timer);
    });
    return () => timers.forEach(clearTimeout);
  }, [mounted]);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="noise-overlay" />

      {/* Animated grid background */}
      <div className="absolute inset-0 bg-grid" />

      {/* Glow orbs */}
      <div className="glow-orb -top-40 -right-40 h-96 w-96 bg-blue-500/15 dark:bg-blue-500/10" />
      <div className="glow-orb -bottom-40 -left-40 h-96 w-96 bg-purple-500/15 dark:bg-purple-500/10" />

      {/* Nav */}
      <SiteHeader>
        <AuthButtons />
      </SiteHeader>

      {/* Hero */}
      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-12 sm:px-8">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          AI 카테고리 추천 시스템 v1.0
        </div>

        {/* Main heading */}
        <h1 className="mb-4 text-center text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          <span className="block text-foreground">CL Embed</span>
          <span className="gradient-text mt-2 block">
            {typedText}
            <span className="inline-block h-[1ch] w-[3px] animate-pulse bg-accent align-middle" />
          </span>
        </h1>

        {/* Description */}
        <p className="mt-4 max-w-xl text-center text-base leading-relaxed text-muted-foreground sm:text-lg">
          텍스트 한 줄로 네이버 카테고리를 자동 추천합니다.
          <br />
          한국어, 중국어, 영어를 지원하는 AI 기반 임베딩 시스템.
        </p>

        {/* CTA buttons */}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Button
            size="lg"
            asChild
            className="group h-11 rounded-full px-6 text-sm font-medium shadow-lg shadow-accent/20 transition-all duration-300 hover:shadow-xl hover:shadow-accent/30 hover:scale-105"
          >
            <Link href="/embed">
              기술 시연 보기
              <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            asChild
            className="h-11 rounded-full px-6 text-sm font-medium"
          >
            <a href="https://github.com/cunlim" target="_blank" rel="noopener noreferrer">
              GitHub 저장소
            </a>
          </Button>
        </div>

        {/* Stats strip */}
        <div className="mt-12 flex items-center divide-x divide-border">
          {[
            { value: "3", label: "지원 언어" },
            { value: "1024d", label: "벡터 차원" },
            { value: "실시간", label: "스트리밍" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center px-4 sm:px-8"
            >
              <span className="font-mono text-lg font-bold text-foreground sm:text-xl">
                {stat.value}
              </span>
              <span className="text-xs text-muted-foreground">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </main>

      {/* Features + Terminal Section */}
      <section className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-24 sm:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Terminal window */}
          <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm">
            <div className="terminal-header border-b border-border">
              <span className="terminal-dot bg-red-400" />
              <span className="terminal-dot bg-yellow-400" />
              <span className="terminal-dot bg-emerald-400" />
              <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                pipeline.sh — npm run analyze
              </span>
            </div>
            <div className="p-4 font-mono text-xs leading-relaxed sm:text-sm">
              <div className="mb-1 text-muted-foreground">
                <span className="text-emerald-500">$</span> pipeline initialize
                — model: bge-m3
              </div>
              {terminalLines.map((line, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "transition-all duration-500",
                    visibleLines.includes(line.text)
                      ? "translate-x-0 opacity-100"
                      : "translate-x-2 opacity-0"
                  )}
                >
                  <span
                    className={cn(
                      "mr-2",
                      line.prefix === "$"
                        ? "text-emerald-500"
                        : "text-muted-foreground"
                    )}
                  >
                    {line.prefix}
                  </span>
                  <span
                    className={cn(
                      line.highlight && "text-accent font-semibold"
                    )}
                  >
                    {line.text}
                  </span>
                </div>
              ))}
              <div className="mt-1 flex items-center gap-1 text-muted-foreground">
                <span className="text-emerald-500">$</span>
                <span className="inline-block h-4 w-2 animate-pulse bg-accent" />
              </div>
            </div>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative overflow-hidden rounded-xl border border-border bg-card/50 p-4 transition-all duration-300 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5"
              >
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                    feature.gradient
                  )}
                />
                <div className="relative z-10">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background">
                    <feature.icon className="h-4 w-4 text-accent" />
                  </div>
                  <h3 className="mb-1 text-sm font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row sm:px-8">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} CL Embed. Portfolio Project.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              GitHub
            </a>
            <a
              href="/embed"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              기술 시연
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
