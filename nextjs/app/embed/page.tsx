"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Search,
  ChevronRight,
  FileText,
  AlertCircle,
  Inbox,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRecommend } from "@/hooks/useRecommend";
import { useBatchProgress } from "@/hooks/useBatchProgress";
import { useAuth, getToken } from "@/hooks/useAuth";
import { getCategories, batchTranslate, type Category } from "@/lib/api";
import { parseHierarchy, type HierarchyLevel } from "@/lib/category";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function EmbedPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 인증 가드 — 비로그인 시 /login?redirect=/embed로 리다이렉트
  useEffect(() => {
    if (mounted && !user && !getToken()) {
      router.push("/login?redirect=/embed");
    }
  }, [mounted, user, router]);

  const [text, setText] = useState("");
  const [language, setLanguage] = useState("ko");
  const { recommend: doRecommend, results, isLoading, error } = useRecommend();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [selected대, setSelected대] = useState<string | null>(null);
  const [selected중, setSelected중] = useState<string | null>(null);
  const [selected소, setSelected소] = useState<string | null>(null);

  const [batchId, setBatchId] = useState<string | null>(null);
  const batchProgress = useBatchProgress(batchId);
  const [batchLanguage, setBatchLanguage] = useState("zh");
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeResult, setActiveResult] = useState<number | null>(null);

  const hierarchy = useMemo(
    () => (categoriesLoaded ? parseHierarchy(categories) : []),
    [categories, categoriesLoaded]
  );

  const 대Options = useMemo(
    () => [...new Set(hierarchy.map((h) => h.대))],
    [hierarchy]
  );

  const 중Options = useMemo(
    () => [
      ...new Set(
        hierarchy
          .filter((h) => !selected대 || h.대 === selected대)
          .map((h) => h.중)
      ),
    ],
    [hierarchy, selected대]
  );

  const 소Options = useMemo(
    () =>
      hierarchy
        .filter(
          (h) =>
            (!selected대 || h.대 === selected대) &&
            (!selected중 || h.중 === selected중)
        )
        .map((h) => ({ 소: h.소, categoryCode: h.categoryCode })),
    [hierarchy, selected대, selected중]
  );

  const loadCategories = useCallback(async () => {
    try {
      const data = await getCategories();
      setCategories(data.data);
      setCategoriesLoaded(true);
    } catch {
      // 카테고리 로드 실패 시 무시 (계층형 Select Box 비활성화)
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleRecommend = useCallback(() => {
    if (!text.trim()) return;
    doRecommend(text.trim(), language);
  }, [text, language, doRecommend]);

  const handleBatchTranslate = useCallback(async () => {
    setIsBatchLoading(true);
    setBatchError(null);
    try {
      const data = await batchTranslate(batchLanguage);
      setBatchId(data.batch_id);
    } catch (err) {
      setBatchError(
        err instanceof Error ? err.message : "일괄 번역 요청에 실패했습니다"
      );
    } finally {
      setIsBatchLoading(false);
    }
  }, [batchLanguage]);

  const vectorSteps = [
    { label: "검색어 입력", description: "사용자 텍스트 수신" },
    { label: "정규화", description: "공백 정리, 특수문자 처리" },
    { label: "임베딩 생성", description: "bge-m3 (1024차원)" },
    { label: "pgvector 유사도 검색", description: "코사인 유사도 계산" },
    { label: "결과 매핑", description: "카테고리 코드/이름 매핑" },
  ];

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
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12 sm:px-8">
        {/* Search section */}
        <div className="mb-10">
          <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl">
            기술 시연
          </h1>
          <p className="text-muted-foreground">
            텍스트를 입력하면 AI가 가장 적합한 네이버 카테고리를 추천합니다
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRecommend();
              }}
              className="relative flex-1"
            >
              <label htmlFor="search-input" className="sr-only">
                검색어 입력
              </label>
              <Search
                aria-hidden="true"
                className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="search-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="분석할 텍스트를 입력하세요..."
                className="h-12 rounded-full pl-12 pr-4 text-base"
              />
            </form>
          </div>

          <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Tabs value={language} onValueChange={setLanguage}>
              <TabsList>
                <TabsTrigger value="ko">한국어</TabsTrigger>
                <TabsTrigger value="zh">중국어</TabsTrigger>
                <TabsTrigger value="en">영어</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              onClick={handleRecommend}
              disabled={isLoading || !text.trim()}
              className="rounded-full px-6 shadow-lg shadow-accent/20 transition-all duration-300 hover:shadow-xl hover:shadow-accent/30 hover:scale-105"
            >
              {isLoading ? "분석 중..." : "분석"}
              {!isLoading && (
                <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              )}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Results */}
          <div className="lg:col-span-3">
            {/* Loading */}
            {isLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-4">
                    <Skeleton className="mb-2 h-5 w-32" />
                    <Skeleton className="h-4 w-64" />
                  </Card>
                ))}
              </div>
            )}

            {/* Error */}
            {!isLoading && error && (
              <Card className="border-destructive/50 p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                  <div className="flex-1">
                    <p className="font-medium text-destructive">
                      오류가 발생했습니다
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {error}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={handleRecommend}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      재시도
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Empty state - no search attempted */}
            {!isLoading && !error && results.length === 0 && (
              <Card className="flex flex-col items-center gap-2 py-12">
                <Inbox className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  검색어를 입력하고 분석 버튼을 눌러주세요
                </p>
              </Card>
            )}

            {/* Results */}
            {!isLoading && results.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {results.length}개 추천 결과
                </p>
                {results.map((result, idx) => (
                  <Card
                    key={idx}
                    className={cn(
                      "group cursor-pointer p-4 transition-all duration-300 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5",
                      activeResult === idx && "border-accent/50"
                    )}
                    onClick={() => {
                      setActiveResult(idx);
                      setDialogOpen(true);
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs text-muted-foreground">
                          {result.category_code}
                        </p>
                        <p className="mt-0.5 font-medium text-foreground">
                          {result.category_name}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className={cn(
                            "text-accent font-mono text-lg font-semibold"
                          )}
                        >
                          {(result.similarity_score * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar: hierarchical select + batch translate */}
          <div className="space-y-6 lg:col-span-2">
            {/* Hierarchical Select Box */}
            <Card className="p-4">
              <h3 className="mb-3 font-medium text-sm">카테고리 계층 탐색</h3>
              {!categoriesLoaded && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadCategories}
                  className="w-full"
                >
                  카테고리 목록 불러오기
                </Button>
              )}

              {categoriesLoaded && hierarchy.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  사용 가능한 카테고리가 없습니다
                </p>
              )}

              {categoriesLoaded && hierarchy.length > 0 && (
                <div className="space-y-3">
                  <Select
                    value={selected대 ?? ""}
                    onValueChange={(v) => {
                      setSelected대(v);
                      setSelected중(null);
                      setSelected소(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="대분류 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {대Options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={selected중 ?? ""}
                    onValueChange={setSelected중}
                    disabled={!selected대}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="중분류 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {중Options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={selected소 ?? ""}
                    onValueChange={setSelected소}
                    disabled={!selected중}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="소분류 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {소Options.map((opt) => (
                        <SelectItem
                          key={opt.소}
                          value={opt.categoryCode}
                        >
                          {opt.소}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </Card>

            {/* Batch Translate */}
            <Card className="p-4">
              <h3 className="mb-3 font-medium text-sm">일괄 번역</h3>
              <div className="space-y-3">
                <Tabs value={batchLanguage} onValueChange={setBatchLanguage}>
                  <TabsList className="w-full">
                    <TabsTrigger value="zh" className="flex-1">
                      중국어
                    </TabsTrigger>
                    <TabsTrigger value="en" className="flex-1">
                      영어
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <Button
                  onClick={handleBatchTranslate}
                  disabled={isBatchLoading}
                  variant="outline"
                  className="w-full"
                >
                  {isBatchLoading ? "실행 중..." : "전체 번역 실행"}
                </Button>

                {batchError && (
                  <p className="text-xs text-destructive">{batchError}</p>
                )}

                {batchProgress && (() => {
                  const pct = batchProgress.totalJobs > 0
                    ? Math.round((batchProgress.completedJobs / batchProgress.totalJobs) * 100)
                    : 0;
                  return (
                  <div className="space-y-2">
                    <Progress value={pct} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {batchProgress.completedJobs}/
                        {batchProgress.totalJobs} 완료
                      </span>
                      <span>
                        {batchProgress.failedJobs > 0 &&
                          `${batchProgress.failedJobs} 실패 · `}
                        {batchProgress.status === "completed"
                          ? "완료"
                          : "처리 중"}
                      </span>
                    </div>
                  </div>
                  );
                })()}
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* Vector process modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono text-sm">
              <FileText className="h-4 w-4" />
              코사인 유사도 상세
            </DialogTitle>
          </DialogHeader>
          {activeResult !== null && results[activeResult] && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">카테고리</p>
                <p className="font-medium">{results[activeResult].category_name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {results[activeResult].category_code}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">유사도 점수</p>
                <p className="text-accent font-mono text-2xl font-bold">
                  {(results[activeResult].similarity_score * 100).toFixed(1)}%
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">처리 과정</p>
                {vectorSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <Badge variant="secondary" className="shrink-0 font-mono text-xs">
                      {idx + 1}
                    </Badge>
                    <div>
                      <p className="text-xs font-medium">{step.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
