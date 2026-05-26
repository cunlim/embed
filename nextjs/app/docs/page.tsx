"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import Link from "next/link";
import { BookOpen, Menu, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface DocEntry {
  slug: string;
  title: string;
  description: string;
}

const docList: DocEntry[] = [
  { slug: "USER_GUIDE", title: "사용자 가이드", description: "시스템 사용 방법 및 API 연동" },
  { slug: "SIMILARITY_SEARCH", title: "유사도 검색 원리", description: "AI 임베딩 및 코사인 유사도 검색" },
];

export default function DocsPage() {
  const [activeDoc, setActiveDoc] = useState<string>(docList[0]?.slug ?? "");
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const initialLoadDone = useRef(false);

  const loadDoc = useCallback((slug: string) => {
    setIsLoading(true);
    setError(null);
    setContent(null);

    fetch(`/content/${slug}.md`)
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
  }, []);

  // 첫 번째 문서 자동 로드
  useEffect(() => {
    if (!initialLoadDone.current && activeDoc) {
      initialLoadDone.current = true;
      loadDoc(activeDoc);
    }
  }, [activeDoc, loadDoc]);

  function handleSelectDoc(slug: string) {
    setActiveDoc(slug);
    setSidebarOpen(false);
    loadDoc(slug);
  }

  const activeTitle = docList.find((d) => d.slug === activeDoc)?.title || "";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="noise-overlay" />
      <div className="absolute inset-0 bg-grid" />
      <div className="glow-orb -top-40 -right-40 h-96 w-96 bg-blue-500/15 dark:bg-blue-500/10" />
      <div className="glow-orb -bottom-40 -left-40 h-96 w-96 bg-purple-500/15 dark:bg-purple-500/10" />

      {/* 모바일 사이드바 토글 */}
      <div className="relative z-10 flex justify-end px-6 sm:px-8 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <Menu className="h-4 w-4" />
          )}
        </Button>
      </div>

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
                  onClick={() => handleSelectDoc(doc.slug)}
                  className={cn(
                    "flex w-full flex-col items-start rounded-md px-3 py-2 text-left transition-colors",
                    activeDoc === doc.slug
                      ? "bg-accent/10 text-accent font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="text-sm">{doc.title}</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">
                    {doc.description}
                  </span>
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
                    onClick={() => handleSelectDoc(doc.slug)}
                    className={cn(
                      "flex w-full flex-col items-start rounded-md px-3 py-2 text-left",
                      activeDoc === doc.slug
                        ? "bg-accent/10 text-accent font-medium"
                        : "text-muted-foreground"
                    )}
                  >
                    <span className="text-sm">{doc.title}</span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">
                      {doc.description}
                    </span>
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
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <p className="text-sm font-medium text-destructive">{error}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => activeDoc && loadDoc(activeDoc)}
                >
                  다시 시도
                </Button>
              </div>
            )}

            {/* Content */}
            {!isLoading && !error && content !== null && (
              <article className="prose-custom">
                <div className="mb-6 flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-accent" />
                  <h1 className="text-2xl font-bold">{activeTitle}</h1>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          target={href?.startsWith("http") ? "_blank" : undefined}
                          rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                </div>
              </article>
            )}

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row sm:px-8">
          <p className="text-xs text-muted-foreground">
            CL Embed. Portfolio Project.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              홈
            </Link>
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
