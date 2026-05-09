# 랜딩 페이지 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** shadcn/ui 기반 Neural Bloom 스타일의 랜딩 페이지 구현 (다크/라이트 모드, 반응형, 애니메이션)

**Architecture:** Next.js 16 App Router + next-themes + Tailwind CSS v4. CSS 변수로 Neural Bloom 컬러 시스템 적용, 클라이언트 컴포넌트로 테마 토글, 서버 컴포넌트로 정적 섹션 렌더링.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, next-themes, lucide-react, shadcn/ui

---

## 파일 구조

```
nextjs/
├── app/
│   ├── globals.css          # Neural Bloom CSS 변수, 애니메이션
│   ├── layout.tsx            # ThemeProvider 적용
│   └── page.tsx             # 랜딩 페이지 assembly
├── components/
│   ├── theme-provider.tsx   # next-themes 프로바이더
│   ├── header.tsx           # 헤더 (로고 + 테마 토글)
│   ├── hero-section.tsx     # 히어로 (타이틀 + CTA)
│   ├── tech-badges.tsx      # 기술 스택 배지
│   ├── stats-cards.tsx      # 핵심 수치 카드
│   └── footer.tsx           # 푸터
└── lib/
    └── utils.ts             # shadcn 유틸 (이미 존재 가능)
```

---

## 사전 확인

- [ ] `nextjs/lib/utils.ts` 존재 여부 확인 (shadcn 유틸용)
- [ ] `package.json`에 `next-themes` 의존성 확인

---

### Task 1: globals.css - Neural Bloom 테마 변수 및 애니메이션 정의

**Files:**
- Modify: `nextjs/app/globals.css`

- [ ] **Step 1: globals.css에 Neural Bloom CSS 변수 및 애니메이션 추가**

```css
@import "tailwindcss";

/* ============================================
   Neural Bloom Theme - CSS Variables
   ============================================ */

:root {
  /* Light Mode */
  --background: #fafafa;
  --foreground: #18181b;
  --primary: #6366f1;
  --accent: #8b5cf6;
  --muted: #a1a1aa;
  --border: #e5e5e5;
  --card-bg: rgba(255, 255, 255, 0.03);
  --glow-primary: rgba(99, 102, 241, 0.25);
  --glow-accent: rgba(139, 92, 246, 0.2);
}

.dark {
  /* Dark Mode */
  --background: #09090b;
  --foreground: #fafafa;
  --primary: #6366f1;
  --accent: #a78bfa;
  --muted: #71717a;
  --border: #27272a;
  --card-bg: rgba(255, 255, 255, 0.03);
  --glow-primary: rgba(99, 102, 241, 0.35);
  --glow-accent: rgba(139, 92, 246, 0.25);
}

/* ============================================
   Tailwind Theme Integration
   ============================================ */

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-accent: var(--accent);
  --color-muted: var(--muted);
  --color-border: var(--border);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

/* ============================================
   Base Styles
   ============================================ */

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans), system-ui, sans-serif;
}

/* ============================================
   Gradient Text Utility
   ============================================ */

.gradient-text {
  background: linear-gradient(135deg, #e0e0e0 0%, #a0a0ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.dark .gradient-text {
  background: linear-gradient(135deg, #e0e0e0 0%, #a0a0ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ============================================
   Animations
   ============================================ */

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes stagger-fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes glow-pulse {
  0%, 100% {
    box-shadow: 0 0 16px var(--glow-primary);
  }
  50% {
    box-shadow: 0 0 24px var(--glow-primary), 0 0 32px var(--glow-accent);
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

.animate-fade-up {
  animation: fade-up 0.3s ease-out forwards;
}

.animate-stagger-1 { animation: stagger-fade-in 0.4s ease-out 0.1s both; }
.animate-stagger-2 { animation: stagger-fade-in 0.4s ease-out 0.2s both; }
.animate-stagger-3 { animation: stagger-fade-in 0.4s ease-out 0.3s both; }
.animate-stagger-4 { animation: stagger-fade-in 0.4s ease-out 0.4s both; }
.animate-stagger-5 { animation: stagger-fade-in 0.4s ease-out 0.5s both; }
.animate-stagger-6 { animation: stagger-fade-in 0.4s ease-out 0.6s both; }

.animate-float {
  animation: float 6s ease-in-out infinite;
}

/* ============================================
   Glow Button
   ============================================ */

.btn-glow {
  background: linear-gradient(135deg, var(--primary), var(--accent));
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.btn-glow:hover {
  box-shadow: 0 0 20px var(--glow-primary), 0 0 40px var(--glow-accent);
  transform: translateY(-1px);
}
```

---

### Task 2: next-themes 설치 및 ThemeProvider 생성

**Files:**
- Modify: `nextjs/package.json` (의존성 추가)
- Create: `nextjs/components/theme-provider.tsx`

- [ ] **Step 1: next-themes 설치**

Run: `docker exec cl_embed_nextjs npm install next-themes --no-bin-links`
Expected: 패키지 설치 완료

- [ ] **Step 2: theme-provider.tsx 생성**

Create: `nextjs/components/theme-provider.tsx`

```typescript
"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

---

### Task 3: layout.tsx 업데이트 - ThemeProvider 적용

**Files:**
- Modify: `nextjs/app/layout.tsx`

- [ ] **Step 1: layout.tsx에 ThemeProvider 및 메타데이터 업데이트**

```typescript
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "cl_embed | AI-Powered Category Intelligence",
  description: "다국어 AI 카테고리 추천 시스템. pgvector 코사인 유사도 검색으로 정확한 카테고리 추천을 제공합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-full antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

---

### Task 4: Header 컴포넌트 생성

**Files:**
- Create: `nextjs/components/header.tsx`

- [ ] **Step 1: header.tsx 생성**

Create: `nextjs/components/header.tsx`

```typescript
"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-sm bg-background/80 border-b border-border">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
        <div className="font-semibold text-base tracking-tight">cl_embed</div>
        <button
          onClick={toggleTheme}
          className="rounded-md p-2 hover:bg-accent/10 transition-colors"
          aria-label="테마 토글"
        >
          {mounted && theme === "dark" ? (
            <Sun className="h-4 w-4 text-muted" />
          ) : (
            <Moon className="h-4 w-4 text-muted" />
          )}
        </button>
      </div>
    </header>
  );
}
```

---

### Task 5: Hero Section 컴포넌트 생성

**Files:**
- Create: `nextjs/components/hero-section.tsx`

- [ ] **Step 1: hero-section.tsx 생성**

Create: `nextjs/components/hero-section.tsx`

```typescript
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
```

---

### Task 6: Tech Badges 컴포넌트 생성

**Files:**
- Create: `nextjs/components/tech-badges.tsx`

- [ ] **Step 1: tech-badges.tsx 생성**

Create: `nextjs/components/tech-badges.tsx`

```typescript
const techStack = [
  { name: "pgvector", delay: "animate-stagger-1" },
  { name: "Ollama", delay: "animate-stagger-2" },
  { name: "Laravel", delay: "animate-stagger-3" },
  { name: "Next.js", delay: "animate-stagger-4" },
  { name: "Redis", delay: "animate-stagger-5" },
  { name: "Docker", delay: "animate-stagger-6" },
];

export function TechBadges() {
  return (
    <div className="flex flex-wrap justify-center gap-2 px-6 py-8">
      {techStack.map((tech) => (
        <span
          key={tech.name}
          className={`${tech.delay} border border-border bg-card-bg px-3 py-1.5 rounded-full font-mono text-xs text-primary hover:border-primary/50 transition-colors cursor-default`}
        >
          {tech.name}
        </span>
      ))}
    </div>
  );
}
```

---

### Task 7: Stats Cards 컴포넌트 생성

**Files:**
- Create: `nextjs/components/stats-cards.tsx`

- [ ] **Step 1: stats-cards.tsx 생성**

Create: `nextjs/components/stats-cards.tsx`

```typescript
const stats = [
  { value: "100ms", label: "캐시 응답", icon: "⚡" },
  { value: "3개", label: "다국어 지원", icon: "🌐" },
  { value: "cosine", label: "유사도 검색", icon: "🔍" },
];

export function StatsCards() {
  return (
    <div className="flex flex-wrap justify-center gap-4 px-6 py-8">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-card-bg border border-border rounded-xl px-5 py-4 text-center min-w-[120px]"
        >
          <div className="text-2xl font-bold gradient-text">{stat.value}</div>
          <div className="text-xs text-muted mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
```

---

### Task 8: Footer 컴포넌트 생성

**Files:**
- Create: `nextjs/components/footer.tsx`

- [ ] **Step 1: footer.tsx 생성**

Create: `nextjs/components/footer.tsx`

```typescript
export function Footer() {
  return (
    <footer className="border-t border-border py-6 text-center">
      <p className="text-xs text-muted">MIT © 2026 cunlim</p>
    </footer>
  );
}
```

---

### Task 9: page.tsx 업데이트 - 랜딩 페이지 Assembly

**Files:**
- Modify: `nextjs/app/page.tsx`

- [ ] **Step 1: page.tsx를 랜딩 페이지로 교체**

```typescript
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
```

---

### Task 10: 빌드 및 브라우저 검증

**Files:**
- 전 단계에서 생성/수정한 모든 파일

- [ ] **Step 1: Next.js 빌드 실행**

Run: `docker exec cl_embed_nextjs npm run build`
Expected: 빌드 성공, 에러 없음

- [ ] **Step 2: 브라우저 검증 (Playwright)**

1. https://embed.cunlim.dev 접속
2. 다크/라이트 모드 전환 확인
3. 반응형 레이아웃 확인 (브라우저 너비 변경)
4. 애니메이션 동작 확인
5. CTA 버튼 hover 효과 확인

---

## 구현 완료 후

- [ ] 디자인 문서 상태를 "구현 완료"로 업데이트
- [ ] `docs/UI_GUIDE.md` 작성 (로그인, `/embed` 페이지용 디자인 가이드라인)

---

## Plan Self-Review

**Spec Coverage:**
- [x] Neural Bloom 컬러 시스템 - Task 1
- [x] Header (로고 + 테마 토글) - Task 4
- [x] Hero Section (타이틀 + CTA) - Task 5
- [x] Tech Badges (6개 스택) - Task 6
- [x] Stats Cards (3개 수치) - Task 7
- [x] Footer - Task 8
- [x] 다크/라이트 모드 - Task 2, 3
- [x] 애니메이션 - Task 1
- [x] 반응형 - 각 컴포넌트에 responsive 클래스 적용

**Placeholder Scan:** 없음. 모든 코드 스니펫이 완성형으로 작성됨.

**Type Consistency:** 모든 TypeScript 컴포넌트가 올바른 import 및 export 사용.
