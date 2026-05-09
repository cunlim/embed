"use client";

import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Globe,
  Cpu,
  Zap,
  Code2,
  GitBranch,
} from "lucide-react";

const features = [
  {
    icon: Globe,
    title: "다국어 지원",
    desc: "한국어, 중국어, 영어 텍스트를 분석하여 최적의 카테고리를 추천합니다.",
  },
  {
    icon: Cpu,
    title: "AI 임베딩",
    desc: "Ollama 로컬 모델로 텍스트를 벡터화하여 의미론적 유사도를 측정합니다.",
  },
  {
    icon: Zap,
    title: "실시간 처리",
    desc: "Laravel Queue + Reverb WebSocket으로 비동기 파이프라인을 구축했습니다.",
  },
];

const techStack = [
  "Next.js 16",
  "React 19",
  "Laravel 13",
  "PostgreSQL + pgvector",
  "Ollama",
  "Docker",
  "Redis",
  "WebSocket",
];

function CursorBlink() {
  return (
    <span className="inline-block w-[3px] h-[1em] bg-primary animate-pulse align-middle ml-1" />
  );
}

function DotGrid() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-background to-transparent" />
    </div>
  );
}

function FloatingShapes() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <>
      <div className="absolute top-20 left-[10%] w-[400px] h-[400px] rounded-full bg-primary/5 blur-3xl animate-[float_12s_ease-in-out_infinite]" />
      <div
        className="absolute top-40 right-[15%] w-[300px] h-[300px] rounded-full bg-accent/5 blur-3xl animate-[float_10s_ease-in-out_infinite]"
        style={{ animationDelay: "-4s" }}
      />
      <div
        className="absolute bottom-32 left-[25%] w-[250px] h-[250px] rounded-full bg-chart-2/5 blur-3xl animate-[float_14s_ease-in-out_infinite]"
        style={{ animationDelay: "-7s" }}
      />
    </>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="relative flex flex-col flex-1 min-h-screen">
      <DotGrid />
      <FloatingShapes />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Code2 className="size-5 text-primary" />
            <span className="font-mono text-sm font-medium tracking-tight">
              cl_embed
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <ThemeToggle />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex flex-1 items-center">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-20 sm:py-28">
          <div className="flex flex-col items-center text-center">
            {/* Tag */}
            <div
              className={`inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-all duration-700 ${
                mounted
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2"
              }`}
            >
              <GitBranch className="size-3" />
              AI 기반 다국어 카테고리 추천 시스템
            </div>

            {/* Title */}
            <h1
              className={`mt-6 font-sans text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl transition-all duration-700 delay-75 ${
                mounted
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2"
              }`}
            >
              텍스트를 이해하는
              <br />
              <span className="text-primary">임베딩 파이프라인</span>
              <CursorBlink />
            </h1>

            {/* Description */}
            <p
              className={`mt-5 max-w-xl text-base text-muted-foreground leading-relaxed sm:text-lg transition-all duration-700 delay-150 ${
                mounted
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2"
              }`}
            >
              사용자 텍스트를 분석해 네이버 카테고리 체계에 맞는 최적의 카테고리를
              추천합니다. pgvector 기반 코사인 유사도 검색, 비동기 파이프라인,
              그리고 WebSocket 실시간 피드백을 갖춘 포트폴리오 프로젝트입니다.
            </p>

            {/* CTA */}
            <div
              className={`mt-8 flex flex-wrap items-center justify-center gap-3 transition-all duration-700 delay-200 ${
                mounted
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2"
              }`}
            >
              <a
                href="/embed"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium transition-all hover:bg-primary/80 active:translate-y-px"
              >
                기술 시연
                <ArrowRight className="size-4" />
              </a>
              <a
                href="https://github.com/cunlim/cl_embed"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-input bg-background text-sm font-medium transition-all hover:bg-muted active:translate-y-px"
              >
                <Code2 className="size-4" />
                GitHub
              </a>
            </div>

            {/* Stats */}
            <div
              className={`mt-14 grid w-full max-w-lg grid-cols-3 gap-4 transition-all duration-700 delay-300 ${
                mounted
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2"
              }`}
            >
              {[
                { value: "3", label: "지원 언어" },
                { value: "4", label: "Docker 컨테이너" },
                { value: "<100ms", label: "평균 응답 시간" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center gap-1 rounded-xl border border-border/50 bg-card/40 p-4 backdrop-blur-sm"
                >
                  <span className="font-mono text-xl font-bold text-primary">
                    {stat.value}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border/40 py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-12 flex flex-col items-center text-center">
            <Badge variant="secondary" className="mb-3">
              핵심 기능
            </Badge>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              어떻게 동작하나
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              텍스트 입력부터 카테고리 추천까지, 전체 파이프라인을 직접
              확인하세요.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="group border-border/50 bg-card/60 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/80">
                <CardContent className="pt-4">
                  <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2.5 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mb-1.5 font-semibold text-foreground">
                    {title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="border-t border-border/40 py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex flex-col items-center text-center">
            <Badge variant="secondary" className="mb-3">
              기술 스택
            </Badge>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              무엇으로 만들었나
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              최신 웹 기술 스택으로 구축된 풀스택 애플리케이션입니다.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-2.5">
            {techStack.map((tech) => (
              <span
                key={tech}
                className="inline-flex items-center rounded-lg border border-border/50 bg-card/50 px-3.5 py-2 font-mono text-xs text-foreground/80 backdrop-blur-sm transition-colors hover:border-primary/30 hover:text-primary"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 sm:px-6 text-center">
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <Code2 className="size-3.5" />
            cl_embed
          </div>
          <p className="text-xs text-muted-foreground/60">
            AI 다국어 카테고리 추천 시스템 &middot; 포트폴리오 프로젝트
          </p>
        </div>
      </footer>
    </div>
  );
}
