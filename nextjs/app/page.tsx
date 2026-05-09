"use client";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const techStack = [
  { name: "Next.js 16", icon: "▲" },
  { name: "Laravel 13", icon: "⚡" },
  { name: "pgvector", icon: "◇" },
  { name: "Ollama", icon: "●" },
  { name: "Redis", icon: "⚙" },
  { name: "Reverb", icon: "◈" },
];

const codeSnippets = [
  { line: "01", text: 'import { AI } from "cl-embed";' },
  { line: "02", text: "const result = await AI.categorize(input);" },
  { line: "03", text: "// → [{ category: \"패션의류\", score: 0.97 }]" },
];

export default function Home() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Grid Background */}
      <div className="grid-bg pointer-events-none absolute inset-0" />

      {/* Radial gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,var(--color-accent)/0.06,transparent_70%)]" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10 lg:px-16">
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg font-bold tracking-tight text-foreground">
            <span className="text-accent">&gt;</span> cl_embed
          </span>
        </div>
        <div className="flex items-center gap-4">
          <nav className="hidden items-center gap-6 sm:flex">
            <a
              href="#"
              className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              /docs
            </a>
            <a
              href="#"
              className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              /playground
            </a>
            <a
              href="#"
              className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              /status
            </a>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-24 pt-8 sm:px-10 lg:px-16">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
          {/* Code line decoration */}
          <div className="code-line mb-6 hidden sm:flex" data-line="//">
            <span className="font-mono text-xs text-muted-foreground/40">
              --- multilingual category engine ---
            </span>
          </div>

          {/* Tagline */}
          <div className="animate-fade-in-up mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/50 px-4 py-1 font-mono text-[11px] tracking-wide text-muted-foreground backdrop-blur-sm">
              <span className="inline-block size-1.5 rounded-full bg-accent" />
              AI-Powered Semantic Categorization
            </span>
          </div>

          {/* Main headline */}
          <h1 className="animate-fade-in-up-delay-1 mt-4 max-w-3xl text-balance text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Your text.{" "}
            <span className="gradient-text">Our categories.</span>
            <br />
            <span className="text-muted-foreground">Instantly mapped.</span>
            <span className="cursor-blink font-mono text-accent" />
          </h1>

          {/* Description */}
          <p className="animate-fade-in-up-delay-2 mt-6 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
            AI 기반 다국어 카테고리 추천 엔진. 한국어, 영어, 중국어 텍스트를
            분석하여 네이버 카테고리 체계로 정확하게 매핑합니다.
          </p>

          {/* CTA */}
          <div className="animate-fade-in-up-delay-3 mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="h-11 rounded-xl px-7 font-mono text-sm font-medium tracking-tight"
            >
              <span className="mr-1.5 text-primary-foreground/70">&gt;</span>
              Try the Embed API
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-11 rounded-xl px-7 font-mono text-sm tracking-tight"
            >
              View on GitHub
              <svg
                className="ml-2 size-4"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </Button>
          </div>

          {/* Code preview */}
          <div className="animate-fade-in-up-delay-4 mt-16 w-full max-w-lg">
            <div className="rounded-xl border border-border bg-card/40 p-4 backdrop-blur-sm sm:p-5">
              <div className="mb-3 flex items-center gap-2 border-b border-border pb-3">
                <div className="flex gap-1.5">
                  <span className="inline-block size-2.5 rounded-full bg-destructive/60" />
                  <span className="inline-block size-2.5 rounded-full bg-amber-400/60" />
                  <span className="inline-block size-2.5 rounded-full bg-emerald-500/60" />
                </div>
                <span className="font-mono text-[10px] tracking-wider text-muted-foreground/50">
                  api-response.ts — 2026
                </span>
              </div>
              <div className="space-y-[3px]">
                {codeSnippets.map((snippet) => (
                  <div key={snippet.line} className="code-line" data-line={snippet.line}>
                    <span className="font-mono text-xs text-muted-foreground/50">
                      {snippet.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Tech Stack Bar */}
      <footer className="relative z-10 border-t border-border">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-6 py-4 sm:px-10 lg:px-16">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground/40 uppercase">
            Stack
          </span>
          {techStack.map((tech) => (
            <span
              key={tech.name}
              className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground/60 transition-colors hover:text-foreground"
            >
              <span className="text-accent/60">{tech.icon}</span>
              {tech.name}
            </span>
          ))}
          <span className="font-mono text-[10px] text-muted-foreground/30">
            &copy; {new Date().getFullYear()}
          </span>
        </div>
      </footer>
    </div>
  );
}
