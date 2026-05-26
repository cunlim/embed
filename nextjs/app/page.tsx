"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Search, Layers, Languages, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const fullText = "Multilingual Category Intelligence";

const features = [
  {
    icon: Search,
    title: "의미 기반 유사도 검색",
    description:
      "한국어·영어·중국어 텍스트를 pgvector 임베딩 벡터로 변환하고, 코사인 유사도로 가장 가까운 카테고리를 찾아냅니다. 검색 결과마다 유사도 점수와 임베딩 상세를 확인할 수 있습니다.",
  },
  {
    icon: Layers,
    title: "4단계 계층 필터링",
    description:
      "네이버 카테고리 체계를 대·중·소·세 4단계로 탐색합니다. 각 단계별 드롭다운으로 원하는 깊이까지 필터링하거나, 키워드로 카테고리명을 직접 검색할 수 있습니다.",
  },
  {
    icon: Languages,
    title: "AI 번역 및 임베딩 파이프라인",
    description:
      "카테고리별로 번역·임베딩·벡터 저장을 비동기 파이프라인으로 처리합니다. 완료·진행중·대기·실패 등 상태를 실시간으로 추적하고, 개별 단계별 재실행이 가능합니다.",
  },
  {
    icon: Zap,
    title: "벌크 작업 실행",
    description:
      "여러 카테고리를 선택해 한 번에 번역·임베딩을 실행하거나, 필터 조건에 맞는 전체 카테고리에 대해 일괄 작업을 예약할 수 있습니다. 진행 중인 작업은 즉시 취소 가능합니다.",
  },
];

const stats = [
  { value: "ko · en · zh", label: "지원 언어" },
  { value: "1024차원", label: "벡터 임베딩" },
  { value: "대·중·소·세", label: "계층 구조" },
  { value: "코사인 유사도", label: "검색 알고리즘" },
];

export default function Home() {
  const [typedText, setTypedText] = React.useState("");

  React.useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setTypedText(fullText.slice(0, i + 1));
      i++;
      if (i >= fullText.length) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="noise-overlay" />
      <div className="absolute inset-0 bg-grid" />
      <div className="glow-orb -top-40 -right-40 h-96 w-96 bg-slate-500/8 dark:bg-slate-500/5" />
      <div className="glow-orb -bottom-40 -left-40 h-96 w-96 bg-slate-500/8 dark:bg-slate-500/5" />

      {/* Hero */}
      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-24 sm:px-8">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          AI 카테고리 추천 시스템
        </div>

        {/* Main heading */}
        <h1 className="mb-4 text-center text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          <span className="block text-foreground">CL Embed</span>
          <span className="mt-2 block text-accent">
            {typedText}
            <span className="inline-block h-[1ch] w-[3px] animate-pulse bg-accent align-middle" />
          </span>
        </h1>

        {/* Description */}
        <p className="mt-4 max-w-xl text-center text-base leading-relaxed text-muted-foreground sm:text-lg">
          텍스트 한 줄로 가장 적합한 카테고리를 찾아주는 AI 임베딩 시스템.
          <br />
          다국어 검색, 계층 필터링, 번역 파이프라인까지 내장된 올인원 카테고리 관리 도구입니다.
        </p>

        {/* CTA buttons */}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Button
            size="lg"
            asChild
            className="group h-11 rounded-full px-6 text-sm font-medium shadow-lg shadow-accent/20 transition-all duration-300 hover:shadow-xl hover:shadow-accent/30 hover:scale-105"
          >
            <Link href="/embed">
              기능시연
              <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            asChild
            className="group h-11 rounded-full px-6 text-sm font-medium hover:bg-muted hover:text-foreground"
          >
            <Link href="/docs">
              문서 보기
              <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>

        {/* Stats strip */}
        <div className="mt-12 flex flex-wrap items-center justify-center divide-x divide-border">
          {stats.map((stat) => (
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

      {/* Features */}
      <section className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-24 sm:px-8">
        <h2 className="mb-8 text-center text-2xl font-bold tracking-tight sm:text-3xl">
          주요 기능
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-border bg-card/50 p-6 transition-all duration-300 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background">
                <feature.icon className="h-5 w-5 text-accent" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
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
              href="https://github.com/cunlim"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              GitHub
            </a>
            <Link
              href="/embed"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              기능시연
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
