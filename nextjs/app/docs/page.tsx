"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  BookOpen,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

interface DocEntry {
  slug: string;
  title: string;
}

const docList: DocEntry[] = [
  { slug: "PRD", title: "제품 요구사항 (PRD)" },
  { slug: "ARCHITECTURE", title: "아키텍처 (ARCHITECTURE)" },
  { slug: "ADR", title: "아키텍처 결정 기록 (ADR)" },
  { slug: "UI_GUIDE", title: "UI 디자인 가이드" },
];

export default function DocsPage() {
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!activeDoc) return;

    setIsLoading(true);
    setError(null);

    fetch(`/docs/${activeDoc}.md`)
      .then((res) => {
        if (!res.ok) throw new Error("문서를 불러오지 못했습니다");
        return res.text();
      })
      .then((text) => {
        setContent(text);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "문서 로딩에 실패했습니다"
        );
        setIsLoading(false);
      });
  }, [activeDoc]);

  // 기본값: 첫 번째 문서
  useEffect(() => {
    if (!activeDoc && docList.length > 0) {
      setActiveDoc(docList[0].slug);
    }
  }, [activeDoc]);

  function renderMarkdown(md: string): string {
    let html = md;
    // Headings
    html = html.replace(/^### (.+)$/gm, "<h3 class='text-lg font-semibold mt-6 mb-2'>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2 class='text-xl font-bold mt-8 mb-3 border-b border-border pb-2'>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1 class='text-2xl font-bold mt-8 mb-4'>$1</h1>");
    // Inline code
    html = html.replace(/`([^`]+)`/g, "<code class='rounded bg-muted px-1 py-0.5 font-mono text-sm'>$1</code>");
    // Code blocks
    html = html.replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```\w*\n?/g, "").replace(/```$/g, "");
      const escaped = code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<pre class='overflow-x-auto rounded-md border border-border bg-muted/50 p-4 font-mono text-sm my-4'><code>${escaped}</code></pre>`;
    });
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong class='font-semibold'>$1</strong>");
    // Tables (simple: pipe-delimited lines)
    html = html.replace(/^\|(.+)\|$/gm, (line) => {
      const cells = line.split("|").filter((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c.trim()))) return ""; // separator row
      const cellHtml = cells
        .map((c) => `<td class='border border-border px-3 py-2 text-sm'>${c.trim()}</td>`)
        .join("");
      return `<tr>${cellHtml}</tr>`;
    });
    // Wrap consecutive <tr>s in <table>
    html = html.replace(
      /((?:<tr>[\s\S]*?<\/tr>\s*)+)/g,
      "<table class='w-full border-collapse border border-border my-4'>$1</table>"
    );
    // List items
    html = html.replace(/^- (.+)$/gm, "<li class='ml-4 list-disc text-sm leading-relaxed'>$1</li>");
    html = html.replace(
      /((?:<li[^>]*>[\s\S]*?<\/li>\s*)+)/g,
      "<ul class='my-2 space-y-1'>$1</ul>"
    );
    // Paragraphs (double newlines)
    html = html.replace(
      /\n\n+/g,
      "</p><p class='text-sm leading-relaxed my-3'>"
    );
    html = "<p class='text-sm leading-relaxed my-3'>" + html + "</p>";
    // Horizontal rules
    html = html.replace(/^---$/gm, "<hr class='my-6 border-border' />");
    // Links
    html = html.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      "<a href='$2' class='text-accent underline underline-offset-2 hover:text-accent/80'>$1</a>"
    );

    return html;
  }

  const activeTitle = docList.find((d) => d.slug === activeDoc)?.title || "";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="noise-overlay" />
      <div className="absolute inset-0 bg-grid" />
      <div className="glow-orb -top-40 -right-40 h-96 w-96 bg-blue-500/15 dark:bg-blue-500/10" />
      <div className="glow-orb -bottom-40 -left-40 h-96 w-96 bg-purple-500/15 dark:bg-purple-500/10" />

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 sm:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            CL
          </div>
          <span className="font-mono text-sm font-medium text-foreground">
            CL Embed
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {/* 모바일 사이드바 토글 */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 px-6 py-12 sm:px-8">
        <div className="flex w-full gap-8">
          {/* Sidebar - desktop */}
          <aside className="hidden w-56 shrink-0 lg:block">
            <nav className="sticky top-12 space-y-1">
              <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                문서
              </p>
              {docList.map((doc) => (
                <button
                  key={doc.slug}
                  type="button"
                  onClick={() => setActiveDoc(doc.slug)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    activeDoc === doc.slug
                      ? "bg-accent/10 text-accent font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  {doc.title}
                </button>
              ))}
            </nav>
          </aside>

          {/* Mobile sidebar */}
          {sidebarOpen && (
            <aside className="fixed inset-0 z-50 bg-background p-6 lg:hidden">
              <div className="flex items-center justify-between mb-6">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  문서
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <nav className="space-y-1">
                {docList.map((doc) => (
                  <button
                    key={doc.slug}
                    type="button"
                    onClick={() => {
                      setActiveDoc(doc.slug);
                      setSidebarOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm",
                      activeDoc === doc.slug
                        ? "bg-accent/10 text-accent font-medium"
                        : "text-muted-foreground"
                    )}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    {doc.title}
                  </button>
                ))}
              </nav>
            </aside>
          )}

          {/* Content area */}
          <div className="min-w-0 flex-1">
            {/* Loading */}
            {isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
                <Skeleton className="mt-6 h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            )}

            {/* Error */}
            {!isLoading && error && (
              <div>
                <p className="text-destructive">{error}</p>
                {content && (
                  <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-muted/50 p-4 font-mono text-sm">
                    {content}
                  </pre>
                )}
              </div>
            )}

            {/* Content */}
            {!isLoading && !error && content && (
              <article>
                <div className="mb-6 flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-accent" />
                  <h1 className="text-2xl font-bold">{activeTitle}</h1>
                </div>
                <div
                  className="prose-custom"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: 마크다운 렌더링은 신뢰된 로컬 .md 파일에서만 가져옴
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(content),
                  }}
                />
              </article>
            )}

            {/* Empty state - no doc selected */}
            {!activeDoc && (
              <div className="flex flex-col items-center gap-2 py-12">
                <FileText className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  왼쪽에서 문서를 선택하세요
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
