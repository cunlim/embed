"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocs } from "./layout";

export default function DocsPage() {
  const { activeDoc, docList } = useDocs();
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  // 활성 문서 변경 시 로드
  useEffect(() => {
    if (initialLoadDone.current && activeDoc) {
      loadDoc(activeDoc);
    }
  }, [activeDoc, loadDoc]);

  const activeTitle = docList.find((d) => d.slug === activeDoc)?.title || "";

  return (
    <>
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
              remarkPlugins={[remarkGfm]}
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
    </>
  );
}
