"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  RefreshCw,
  AlertCircle,
  Database,
  Play,
  Loader2,
  Circle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth, getToken } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import type { Category } from "@/lib/api";
import {
  useCategoryProgress,
  type CategoryProgress,
  type StepName,
} from "@/hooks/useCategoryProgress";
import { isAdmin } from "@/lib/utils";

const STEP_LABELS: Record<StepName, string> = {
  "translation.zh": "중국어 번역",
  "translation.en": "영어 번역",
  "embedding.ko": "한국어 임베딩",
  "embedding.zh": "중국어 임베딩",
  "embedding.en": "영어 임베딩",
};

const ALL_STEPS: { step: number; name: StepName }[] = [
  { step: 1, name: "translation.zh" },
  { step: 2, name: "translation.en" },
  { step: 3, name: "embedding.ko" },
  { step: 4, name: "embedding.zh" },
  { step: 5, name: "embedding.en" },
];

function progressForStep(progress: CategoryProgress | null, stepName: StepName): CategoryProgress | null {
  if (progress && progress.stepName === stepName) return progress;
  return null;
}

function StepIcon({ status }: { status: "pending" | "running" | "completed" | "failed" }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case "running":
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "pending":
    default:
      return <Circle className="h-5 w-5 text-muted-foreground" />;
  }
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const authorized = user ? isAdmin(user.id) : false;

  // 인증 가드
  useEffect(() => {
    if (!mounted || authLoading) return;

    if (!user) {
      router.replace("/login?redirect=/admin");
    } else if (!isAdmin(user.id)) {
      router.back();
    }
  }, [mounted, authLoading, user, router]);

  const token = mounted ? getToken() : null;
  const {
    categories,
    isLoading: catLoading,
    error: catError,
    loadCategories,
    addCategory,
  } = useCategories(token);

  const [newCategoryName, setNewCategoryName] = useState("");
  const { progress, isRunning, startTranslation, cancel } = useCategoryProgress();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);

  const handleAddCategory = useCallback(async () => {
    if (!newCategoryName.trim()) return;
    await addCategory(newCategoryName.trim());
    setNewCategoryName("");
  }, [newCategoryName, addCategory]);

  const handleStartTranslation = useCallback(
    async (category: Category) => {
      setActiveCategoryId(category.id);
      setModalOpen(true);
      await startTranslation(category.id, token);
    },
    [startTranslation, token],
  );

  const handleCancel = useCallback(() => {
    cancel();
    setModalOpen(false);
    setActiveCategoryId(null);
  }, [cancel]);

  // 단계별 상태 도출 (진행 정보가 없으면 pending)
  const stepStatuses = ALL_STEPS.map(({ name }) => {
    const p = progressForStep(progress, name);
    if (!p) return "pending" as const;
    return p.status;
  });

  // progress와 일치하는 step의 index (진행 중인 단계 하이라이트)
  const currentStepIndex = progress ? ALL_STEPS.findIndex((s) => s.name === progress.stepName) : -1;

  if (!mounted || !authorized) return null;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="noise-overlay" />
      <div className="absolute inset-0 bg-grid" />
      <div className="glow-orb -top-40 -right-40 h-96 w-96 bg-blue-500/15 dark:bg-blue-500/10" />
      <div className="glow-orb -bottom-40 -left-40 h-96 w-96 bg-purple-500/15 dark:bg-purple-500/10" />

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12 sm:px-8">
        <h1 className="mb-8 text-3xl font-bold tracking-tight sm:text-4xl">
          관리자
        </h1>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 카테고리 추가 (sidebar) */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">카테고리 추가</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="category-name">한국어 카테고리명</Label>
                  <Input
                    id="category-name"
                    placeholder="예: 의류>여성의류>원피스"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddCategory();
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  카테고리 코드는 자동 생성됩니다
                </p>
                <Button
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim()}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  추가
                </Button>
                {catError && (
                  <p className="text-sm text-destructive">{catError}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 카테고리 목록 테이블 */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">카테고리 목록</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={loadCategories}
                disabled={catLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${catLoading ? "animate-spin" : ""}`}
                />
              </Button>
            </CardHeader>
            <CardContent>
              {/* 로딩 */}
              {catLoading && categories.length === 0 && (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              )}

              {/* 에러 */}
              {!catLoading && catError && (
                <div className="flex items-start gap-3 rounded-md border border-destructive/50 p-4">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">
                      오류가 발생했습니다
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {catError}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={loadCategories}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      재시도
                    </Button>
                  </div>
                </div>
              )}

              {/* 빈 상태 */}
              {!catLoading && !catError && categories.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-12">
                  <Database className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    등록된 카테고리가 없습니다
                  </p>
                </div>
              )}

              {/* 테이블 - 데스크톱 */}
              {categories.length > 0 && (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-mono text-xs">
                            코드
                          </TableHead>
                          <TableHead>한국어</TableHead>
                          <TableHead>중국어</TableHead>
                          <TableHead>영어</TableHead>
                          <TableHead className="w-[60px]">작업</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categories.map((cat) => {
                          const isActive = isRunning && activeCategoryId === cat.id;
                          const isOtherRunning = isRunning && activeCategoryId !== cat.id;

                          return (
                            <TableRow key={cat.id}>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {cat.category_code}
                              </TableCell>
                              <TableCell className="font-medium">
                                {cat.category_name_ko}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {cat.category_name_zh || "-"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {cat.category_name_en || "-"}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title={isActive ? "실행 중" : "번역 실행"}
                                  disabled={isOtherRunning}
                                  onClick={() => handleStartTranslation(cat)}
                                  aria-label={isActive ? "실행 중" : "번역 실행"}
                                >
                                  {isActive ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Play className="h-4 w-4" />
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 카드 레이아웃 - 모바일 */}
                  <div className="space-y-2 md:hidden">
                    {categories.map((cat) => {
                      const isActive = isRunning && activeCategoryId === cat.id;
                      const isOtherRunning = isRunning && activeCategoryId !== cat.id;

                      return (
                        <Card key={cat.id} className="p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-mono text-xs text-muted-foreground">
                                {cat.category_code}
                              </p>
                              <p className="font-medium">{cat.category_name_ko}</p>
                              <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                                <span>중: {cat.category_name_zh || "-"}</span>
                                <span>영: {cat.category_name_en || "-"}</span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={isActive ? "실행 중" : "번역 실행"}
                              disabled={isOtherRunning}
                              onClick={() => handleStartTranslation(cat)}
                              aria-label={isActive ? "실행 중" : "번역 실행"}
                            >
                              {isActive ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* 프로그레스 모달 */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) handleCancel(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>번역·임베딩 진행 상황</DialogTitle>
            <DialogDescription>
              5단계 파이프라인이 순차적으로 실행됩니다. 모달을 닫으면 중단됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {ALL_STEPS.map(({ name }, index) => {
              const status = stepStatuses[index];
              const isCurrentStep = index === currentStepIndex;
              const failedProgress = status === "failed" ? progressForStep(progress, name) : null;

              return (
                <div
                  key={name}
                  className={`flex items-center gap-3 rounded-md border p-3 ${
                    isCurrentStep ? "border-blue-500 bg-blue-500/5" : "border-border"
                  }`}
                >
                  <StepIcon status={status} />
                  <span className="flex-1 text-sm font-medium">
                    {STEP_LABELS[name]}
                  </span>
                  {status === "failed" && failedProgress?.error && (
                    <span className="text-xs text-destructive">
                      {failedProgress.error}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {!isRunning && stepStatuses.some((s) => s === "failed") && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (activeCategoryId !== null) {
                    handleStartTranslation({ id: activeCategoryId } as Category);
                  }
                }}
              >
                재시도
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
