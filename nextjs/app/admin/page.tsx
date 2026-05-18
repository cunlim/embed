"use client";

import { useState, useEffect, useCallback, useSyncExternalStore, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  RefreshCw,
  AlertCircle,
  Database,
  Eye,
  ChevronLeft,
  ChevronRight,
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import CategoryModal from "@/components/admin/category-modal";
import StatusBadge from "@/components/admin/status-badge";
import { useAuth, getToken } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryDetail } from "@/hooks/useCategoryDetail";
import { useCategoryExecution } from "@/hooks/useCategoryExecution";
import { isAdmin } from "@/lib/utils";

export default function AdminPage() {
  return (
    <Suspense>
      <AdminPageInner />
    </Suspense>
  );
}

function AdminPageInner() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const authorized = user ? isAdmin(user.id) : false;

  // Parse page from URL
  const pageParam = searchParams.get("page");
  const urlPage = parseInt(pageParam ?? "1", 10);
  const page = Number.isNaN(urlPage) || urlPage < 1 ? 1 : urlPage;

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
  const { getState, handleSingleAction, handleRunAll, handleCancelPending } =
    useCategoryExecution(token);
  const {
    categories,
    meta,
    isLoading: catLoading,
    error: catError,
    loadCategories,
    addCategory,
  } = useCategories(token);

  // URL page 동기화
  useEffect(() => {
    if (!mounted) return;
    loadCategories(page);
  }, [mounted, page, loadCategories]);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [modalCategoryId, setModalCategoryId] = useState<number | null>(null);
  const { data: detailData, isLoading: detailLoading, error: detailError, reload } =
    useCategoryDetail(modalCategoryId, token);

  const handleAddCategory = useCallback(async () => {
    if (!newCategoryName.trim()) return;
    await addCategory(newCategoryName.trim());
    setNewCategoryName("");
  }, [newCategoryName, addCategory]);

  const handlePageChange = useCallback((newPage: number) => {
    router.push(`/admin?page=${newPage}`);
  }, [router]);

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
                onClick={() => loadCategories(page)}
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
                      onClick={() => loadCategories(page)}
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

              {/* 테이블 */}
              {categories.length > 0 && (
                <div>
                  {/* 데스크톱 */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>한국어 카테고리</TableHead>
                          <TableHead className="w-[100px]">상태</TableHead>
                          <TableHead className="w-[60px]">보기</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categories.map((cat) => (
                          <TableRow key={cat.id}>
                            <TableCell className="font-medium">
                              {cat.category_name_ko}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={cat.translation_status} />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="상세 보기"
                                onClick={() => setModalCategoryId(cat.id)}
                                aria-label="상세 보기"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 모바일 */}
                  <div className="space-y-2 md:hidden">
                    {categories.map((cat) => (
                      <Card key={cat.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {cat.category_name_ko}
                            </p>
                            <div className="mt-1">
                              <StatusBadge status={cat.translation_status} />
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="상세 보기"
                            onClick={() => setModalCategoryId(cat.id)}
                            aria-label="상세 보기"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* 페이지네이션 */}
                  {meta && meta.last_page > 1 && (
                    <div className="mt-4">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePageChange(meta.current_page - 1)}
                              disabled={meta.current_page <= 1}
                            >
                              <ChevronLeft className="mr-1 h-4 w-4" />
                              이전
                            </Button>
                          </PaginationItem>
                          {Array.from({ length: meta.last_page }, (_, i) => i + 1).map((p) => (
                            <PaginationItem key={p}>
                              <PaginationLink
                                isActive={p === meta.current_page}
                                onClick={() => handlePageChange(p)}
                              >
                                {p}
                              </PaginationLink>
                            </PaginationItem>
                          ))}
                          <PaginationItem>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePageChange(meta.current_page + 1)}
                              disabled={meta.current_page >= meta.last_page}
                            >
                              다음
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* 카테고리 상세 모달 */}
      <CategoryModal
        open={modalCategoryId !== null}
        onOpenChange={(open) => {
          if (!open) setModalCategoryId(null);
        }}
        data={detailData}
        isLoading={detailLoading}
        error={detailError}
        token={token}
        onReload={reload}
        onListRefresh={() => loadCategories(page)}
        execState={modalCategoryId ? getState(modalCategoryId) : null}
        onSingleAction={async (stepName) => {
          if (modalCategoryId !== null) {
            await handleSingleAction(modalCategoryId, stepName, () => loadCategories(page));
          }
        }}
        onRunAll={async () => {
          if (modalCategoryId !== null && detailData) {
            await handleRunAll(modalCategoryId, detailData, () => loadCategories(page));
          }
        }}
        onCancelPending={() => {
          if (modalCategoryId !== null) {
            handleCancelPending(modalCategoryId);
          }
        }}
      />
    </div>
  );
}
