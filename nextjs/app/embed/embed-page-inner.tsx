"use client";

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  RefreshCw,
  AlertCircle,
  Database,
  Eye,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  PaginationEllipsis,
} from "@/components/ui/pagination";
import CategoryModal from "@/components/admin/category-modal";
import StatusBadge from "@/components/admin/status-badge";
import CategoryHierarchy, { type HierarchyFilterState } from "@/components/admin/category-hierarchy";
import TaskExecution from "@/components/admin/task-execution";
import CosineDetailDialog from "@/components/admin/cosine-detail-dialog";
import { useAuth, getToken } from "@/hooks/useAuth";
import { isAdmin } from "@/lib/utils";
import { parseEmbedParams } from "@/lib/embed-params";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryDetail } from "@/hooks/useCategoryDetail";
import { useCategoryExecution } from "@/hooks/useCategoryExecution";
import { recommend } from "@/lib/api";
import type { Category, Recommendation, PaginationMeta } from "@/lib/api";

function getPageRange(current: number, last: number): (number | "...")[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);

  const pages: (number | "...")[] = [1];

  const start = Math.max(2, current - 2);
  const end = Math.min(last - 1, current + 2);

  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < last - 1) pages.push("...");

  pages.push(last);
  return pages;
}

function getEllipsisTarget(current: number, last: number, direction: "prev" | "next"): number {
  if (direction === "prev") return Math.max(1, current - 5);
  return Math.min(last, current + 5);
}

export function EmbedPageInner({
  server대Options,
  server중Options,
  server소Options,
  server세Options,
  serverCategories,
  serverMeta,
  serverHadToken,
  serverFilter,
  serverSearchResults,
  serverSearchMeta,
  serverSearchText,
  serverSearchLang,
}: {
  server대Options: string[];
  server중Options: string[];
  server소Options: string[];
  server세Options: { 세: string; categoryId: number; categoryCode: string }[];
  serverCategories: Category[];
  serverMeta: PaginationMeta | null;
  serverHadToken: boolean;
  serverFilter: string | null;
  serverSearchResults: Recommendation[] | null;
  serverSearchMeta: PaginationMeta | null;
  serverSearchText: string | null;
  serverSearchLang: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Parse page and per_page from URL
  const pageParam = searchParams.get("page");
  const urlPage = parseInt(pageParam ?? "1", 10);
  const page = Number.isNaN(urlPage) || urlPage < 1 ? 1 : urlPage;

  const perPageParam = searchParams.get("per_page");
  const urlPerPage = parseInt(perPageParam ?? "20", 10);
  const validPerPageValues = [10, 20, 50];
  const initialPerPage = validPerPageValues.includes(urlPerPage) ? urlPerPage : 20;

  const token = getToken();
  const { getState, handleSingleAction, handleRunAll, handleCancelPending, clearStep } =
    useCategoryExecution(token);
  const {
    categories,
    meta,
    isLoading: catLoading,
    error: catError,
    loadCategories,
    addCategory,
    updateCategoryStatus,
    deleteCategory,
  } = useCategories(token, serverCategories, serverMeta);

  // URL에서 파라미터 파싱
  const embedParams = parseEmbedParams(searchParams);
  const initialFilterMode = embedParams.mode;
  const initialHierarchy: HierarchyFilterState = {
    대: searchParams.get("cat1"),
    중: searchParams.get("cat2"),
    소: searchParams.get("cat3"),
    세: searchParams.get("cat4"),
  };
  const initialFilterKeyword = embedParams.keyword ?? "";

  const [perPage, setPerPage] = useState(initialPerPage);
  const [filter, setFilter] = useState<string | undefined>(embedParams.filter);
  const [keywordSearchActive, setKeywordSearchActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hierarchyRefreshKey, setHierarchyRefreshKey] = useState(0);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryCode, setNewCategoryCode] = useState("");

  // 검색 state (URL 및 SSR prefetch에서 초기값)
  const [searchText, setSearchText] = useState(serverSearchText ?? embedParams.searchText ?? "");
  const [searchLanguage, setSearchLanguage] = useState(serverSearchLang ?? embedParams.searchLang);
  const [searchResults, setSearchResults] = useState<Recommendation[] | null>(serverSearchResults ?? null);
  // useRef로 searchResults 참조 — useEffect 의존성 배열에 추가하지 않고 최신값 읽기
  const searchResultsRef = useRef(searchResults);
  useEffect(() => { searchResultsRef.current = searchResults });
  const [searchMeta, setSearchMeta] = useState<PaginationMeta | null>(serverSearchMeta ?? null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [cosineDialogOpen, setCosineDialogOpen] = useState(false);
  const [activeResult, setActiveResult] = useState<Recommendation | null>(null);
  const searchPageRef = useRef(1);
  const perPageRef = useRef(perPage);
  useEffect(() => { perPageRef.current = perPage });
  const filterRef = useRef(filter);
  useEffect(() => { filterRef.current = filter });
  const keywordRef = useRef(initialFilterKeyword);

  // URL에 초기 필터 파라미터가 있으면 첫 loadCategories를 건너뛴다 (CategoryHierarchy mount effect가 대신 처리)
  const skipInitialLoad = useRef(!!initialHierarchy.대 || !!initialFilterKeyword);
  // SSR 데이터가 있고 토큰도 있었으면 CSR 재요청 건너뜀 (마이그레이션 대응)
  const hadServerCategories = useRef(serverCategories.length > 0 && serverHadToken);

  const isSearchMode = searchResults !== null && !keywordSearchActive;
  const displayCategories = isSearchMode ? searchResults : categories;
  const displayMeta = isSearchMode ? searchMeta : meta;
  const [modalCategoryId, setModalCategoryId] = useState<number | null>(null);
  const [modalReadOnly, setModalReadOnly] = useState(false);
  const { data: detailData, isLoading: detailLoading, error: detailError, setData } =
    useCategoryDetail(modalCategoryId, token);

  const handleAddCategory = useCallback(async () => {
    if (!newCategoryName.trim()) return;
    await addCategory(newCategoryName.trim(), newCategoryCode.trim() || undefined);
    setNewCategoryName("");
    setNewCategoryCode("");
    setHierarchyRefreshKey(prev => prev + 1);
  }, [newCategoryName, newCategoryCode, addCategory]);

  // URL 업데이트 (현재 URL 보존 + 오버라이드만 적용)
  const updateURL = useCallback((overrides: {
    filter?: string | undefined;
    searchText?: string;
    searchLanguage?: string;
    mode?: string;
    cat1?: string | null; cat2?: string | null; cat3?: string | null; cat4?: string | null;
    q?: string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    const apply = (key: string, value: string | null | undefined, clearChildren?: string[]) => {
      if (value) { params.set(key, value); return; }
      params.delete(key);
      if (clearChildren) clearChildren.forEach(k => params.delete(k));
    };

    if ("filter" in overrides) apply("filter", overrides.filter);
    if ("searchText" in overrides) {
      if (overrides.searchText) params.set("stext", overrides.searchText);
      else { params.delete("stext"); params.delete("slang"); }
    }
    if ("searchLanguage" in overrides) {
      if (overrides.searchLanguage && overrides.searchLanguage !== "ko") params.set("slang", overrides.searchLanguage);
      else params.delete("slang");
    }
    if ("mode" in overrides && overrides.mode) params.set("mode", overrides.mode);
    if ("cat1" in overrides) apply("cat1", overrides.cat1, ["cat2", "cat3", "cat4"]);
    if ("cat2" in overrides) apply("cat2", overrides.cat2, ["cat3", "cat4"]);
    if ("cat3" in overrides) apply("cat3", overrides.cat3, ["cat4"]);
    if ("cat4" in overrides) apply("cat4", overrides.cat4);
    if ("q" in overrides) apply("q", overrides.q);

    if (page > 1) params.set("page", String(page));
    if (perPage !== 20) params.set("per_page", String(perPage));

    const qs = params.toString();
    router.replace(`/embed${qs ? "?" + qs : ""}`, { scroll: false });
  }, [router, searchParams, page, perPage]);

  const handleSearch = useCallback(async (page?: number, keyword?: string) => {
    const currentPage = page ?? 1;
    searchPageRef.current = currentPage;
    setIsSearching(true);
    setSearchError(null);
    setKeywordSearchActive(false);
    updateURL({ searchText, searchLanguage });
    try {
      const data = await recommend(searchText, searchLanguage, token, currentPage, perPageRef.current, filterRef.current, keyword ?? (keywordRef.current || undefined));
      setSearchResults(data.data);
      setSearchMeta(data.meta);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "검색에 실패했습니다");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchText, searchLanguage, token, updateURL]);

  // URL page 동기화 (시맨틱 검색 결과가 있으면 필터 변경 시 재검색)
  useEffect(() => {
    if (!mounted) return;
    if (skipInitialLoad.current) {
      skipInitialLoad.current = false;
      return;
    }
    // SSR 데이터가 이미 있으면 reload 건너뜀
    if (hadServerCategories.current) {
      hadServerCategories.current = false;
      return;
    }
    if (searchResultsRef.current !== null) {
      handleSearch(page);
    } else {
      const kw = keywordRef.current || undefined;
      loadCategories(page, perPage, filter, kw);
    }
  }, [mounted, page, perPage, filter, loadCategories, handleSearch]);

  const handleReset = useCallback(() => {
    setSearchText("");
    setSearchResults(null);
    setSearchMeta(null);
    setSearchError(null);
    updateURL({ searchText: "", searchLanguage: "ko" });
  }, [updateURL]);

  const handleKeywordSearch = useCallback((keyword: string) => {
    // SSR 데이터가 이미 있고 같은 키워드면 재요청 건너뜀
    if (keyword === keywordRef.current && hadServerCategories.current) {
      return;
    }
    keywordRef.current = keyword;
    if (searchResults !== null) {
      // 시맨틱 검색 활성 상태: 검색 재실행 (필터 컨텍스트는 URL/state로 이미 갱신됨)
      handleSearch(1, keyword || undefined);
      return;
    }
    if (!keyword) {
      setKeywordSearchActive(false);
      loadCategories(1, perPage, filter, "");
      return;
    }
    setSearchResults(null);
    setSearchMeta(null);
    setSearchError(null);
    setKeywordSearchActive(true);
    loadCategories(1, perPage, filter, keyword);
  }, [perPage, filter, loadCategories, searchResults, handleSearch]);

  // 필터 상태 변경 시 URL 업데이트
  const handleFilterChange = useCallback(
    (state: { mode: "hierarchy" | "search"; hierarchy: HierarchyFilterState; keyword: string }) => {
      updateURL({
        mode: state.mode,
        cat1: state.hierarchy.대, cat2: state.hierarchy.중,
        cat3: state.hierarchy.소, cat4: state.hierarchy.세,
        q: state.keyword || undefined,
      });
    },
    [updateURL]
  );

  const canModify = useCallback((category: Category | Recommendation) => {
    if (!user) return false;
    return isAdmin(user) || ("user_id" in category && category.user_id === user.id);
  }, [user]);

  const toggleSelectAll = useCallback(() => {
    const modifiableIds = displayCategories
      .filter((cat) => canModify(cat))
      .map((cat) => cat.id);
    setSelectedIds((prev) => {
      const allChecked = modifiableIds.length > 0 && modifiableIds.every((id) => prev.has(id));
      return allChecked ? new Set() : new Set(modifiableIds);
    });
  }, [displayCategories, canModify]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDelete = useCallback(async (cat: Category | Recommendation) => {
    if (!window.confirm(`"${cat.category_name_ko}" 카테고리를 삭제하시겠습니까?`)) return;
    await deleteCategory(cat.id);
    setHierarchyRefreshKey(prev => prev + 1);
  }, [deleteCategory]);

  const handlePageChange = useCallback((newPage: number) => {
    if (isSearchMode) {
      handleSearch(newPage);
    } else {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(newPage));
      params.set("per_page", String(perPage));
      router.push(`/embed?${params.toString()}`);
    }
  }, [isSearchMode, handleSearch, router, perPage, searchParams]);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="noise-overlay" />
      <div className="absolute inset-0 bg-grid" />
      <div className="glow-orb -top-40 -right-40 h-96 w-96 bg-blue-500/15 dark:bg-blue-500/10" />
      <div className="glow-orb -bottom-40 -left-40 h-96 w-96 bg-purple-500/15 dark:bg-purple-500/10" />

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12 sm:px-8">
        <h1 className="mb-8 text-3xl font-bold tracking-tight sm:text-4xl">
          카테고리 추천
        </h1>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 사이드바 */}
          <div className="space-y-6">
            {/* 유사도 검색 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">유사도 검색</CardTitle>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={searchLanguage === "ko" ? "default" : "ghost"}
                    className={`h-7 px-2 text-xs ${searchLanguage !== "ko" ? "hover:bg-primary/50" : ""}`}
                    onClick={() => setSearchLanguage("ko")}
                  >
                    한국어
                  </Button>
                  <Button
                    size="sm"
                    variant={searchLanguage === "zh" ? "default" : "ghost"}
                    className={`h-7 px-2 text-xs ${searchLanguage !== "zh" ? "hover:bg-primary/50" : ""}`}
                    onClick={() => setSearchLanguage("zh")}
                  >
                    중국어
                  </Button>
                  <Button
                    size="sm"
                    variant={searchLanguage === "en" ? "default" : "ghost"}
                    className={`h-7 px-2 text-xs ${searchLanguage !== "en" ? "hover:bg-primary/50" : ""}`}
                    onClick={() => setSearchLanguage("en")}
                  >
                    영어
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="검색어 입력..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleSearch()}
                    disabled={isSearching}
                    className="flex-1"
                  >
                    {isSearching ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    검색
                  </Button>
                  {searchText && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleReset}
                      title="초기화"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {searchError && (
                  <p className="text-sm text-destructive">{searchError}</p>
                )}
              </CardContent>
            </Card>

            {/* 필터 */}
            <CategoryHierarchy
              onSelectCategory={(categoryId) => {
                const cat = displayCategories.find(c => c.id === categoryId);
                setModalReadOnly(cat ? !canModify(cat) : false);
                setModalCategoryId(categoryId);
              }}
              onSelectLeafPath={(대, 중, 소, categoryId) => {
                if (categoryId) {
                  // ID로 직접 조회 (stale closure 회피)
                  setModalReadOnly(!canModify({ id: categoryId } as Category | Recommendation));
                  setModalCategoryId(categoryId);
                } else {
                  // 폴백: 경로 문자열로 검색 (빈 세그먼트 제외)
                  const path = [대, 중, 소].filter(Boolean).join(">");
                  const cat = displayCategories.find(c => c.category_name_ko === path);
                  if (cat) {
                    setModalReadOnly(!canModify(cat));
                    setModalCategoryId(cat.id);
                  }
                }
              }}
              onKeywordSearch={handleKeywordSearch}
              initialMode={initialFilterMode}
              initialHierarchy={initialHierarchy}
              initialKeyword={initialFilterKeyword}
              onFilterChange={handleFilterChange}
              initial대Options={server대Options}
              initial중Options={server중Options}
              initial소Options={server소Options}
              initial세Options={server세Options}
              refreshKey={hierarchyRefreshKey}
              token={token}
            />

            {/* 추가 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">추가</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="category-code">카테고리 코드</Label>
                  <Input
                    id="category-code"
                    placeholder="입력하지 않을 시 자동 생성"
                    value={newCategoryCode}
                    onChange={(e) => setNewCategoryCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddCategory();
                    }}
                  />
                </div>
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
                <Button
                  onClick={() => {
                    if (!user) { alert("로그인이 필요합니다"); return; }
                    handleAddCategory();
                  }}
                  disabled={!newCategoryName.trim()}
                  className="w-full"
                >
                  <Plus className="h-4 w-4" />
                  추가
                </Button>
                {catError && (
                  <p className="text-sm text-destructive">{catError}</p>
                )}
              </CardContent>
            </Card>

            {/* 작업 실행 */}
            <TaskExecution
              token={token}
              selectedIds={selectedIds}
              categories={displayCategories}
              filter={filter}
              canModify={canModify}
              onComplete={(wasStopped) => {
                if (!wasStopped) {
                  setSelectedIds(new Set());
                }
                loadCategories(page, perPage, filter);
              }}
              onCategoryComplete={() => {
                loadCategories(page, perPage, filter);
              }}
            />
          </div>

          {/* 카테고리 목록 테이블 */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">카테고리 목록</CardTitle>
              <div className="flex gap-1">
                <Button
                  variant={filter === undefined ? "default" : "ghost"}
                  size="sm"
                  className={`h-7 px-2 text-xs ${filter !== undefined ? "hover:bg-primary/50" : ""}`}
                  onClick={() => { setFilter(undefined); updateURL({ filter: undefined }); }}
                >
                  전체
                </Button>
                <Button
                  variant={filter === "my" ? "default" : "ghost"}
                  size="sm"
                  className={`h-7 px-2 text-xs ${filter !== "my" ? "hover:bg-primary/50" : ""}`}
                  onClick={() => {
                    if (!user) { alert("로그인이 필요합니다"); return; }
                    setFilter("my"); updateURL({ filter: "my" });
                  }}
                >
                  내 카테고리
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* 로딩 */}
              {(catLoading || isSearching) && displayCategories.length === 0 && (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              )}

              {/* 에러 */}
              {!catLoading && !isSearching && catError && (
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
                      onClick={() => loadCategories(page, perPage, filter)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      재시도
                    </Button>
                  </div>
                </div>
              )}

              {/* 빈 상태 */}
              {!catLoading && !isSearching && !catError && displayCategories.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-12">
                  <Database className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    등록된 카테고리가 없습니다
                  </p>
                </div>
              )}

              {/* 테이블 */}
              {displayCategories.length > 0 && (
                <div>
                  {/* 데스크톱 */}
                  <div className="hidden md:block">
                    <Table className="table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">
                            <Checkbox
                              checked={
                                (() => {
                                  const ids = displayCategories.filter((cat) => canModify(cat)).map((cat) => cat.id);
                                  return ids.length > 0 && ids.every((id) => selectedIds.has(id));
                                })()
                              }
                              onCheckedChange={toggleSelectAll}
                              aria-label="전체 선택"
                            />
                          </TableHead>
                          <TableHead>
                            {searchLanguage === "ko"
                              ? "한국어 카테고리"
                              : searchLanguage === "zh"
                                ? "중국어 카테고리"
                                : "영어 카테고리"}
                          </TableHead>
                          {isSearchMode && <TableHead className="w-[80px]">유사도</TableHead>}
                          <TableHead className="w-[80px]">상태</TableHead>
                          <TableHead className="w-[92px]">작업</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayCategories.map((cat) => (
                          <TableRow key={cat.id}>
                            <TableCell className="w-[40px]">
                              <Checkbox
                                checked={selectedIds.has(cat.id)}
                                disabled={!canModify(cat)}
                                onCheckedChange={() => toggleSelect(cat.id)}
                                aria-label={`${cat.category_name_ko ?? cat.category_name} 선택`}
                              />
                            </TableCell>
                            <TableCell className="max-w-0 w-full truncate font-medium">
                              {searchLanguage === "ko"
                                ? cat.category_name_ko ?? cat.category_name
                                : searchLanguage === "zh"
                                  ? cat.category_name_zh ?? cat.category_name
                                  : cat.category_name_en ?? cat.category_name}
                            </TableCell>
                            {isSearchMode && (
                              <TableCell className="font-mono text-sm text-accent">
                                {cat.similarity_score != null ? (
                                  <button
                                    type="button"
                                    className="cursor-pointer hover:underline"
                                    onClick={() => {
                                      setActiveResult(cat as Recommendation);
                                      setCosineDialogOpen(true);
                                    }}
                                  >
                                    {(cat.similarity_score * 100).toFixed(1)}%
                                  </button>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                            )}
                            <TableCell>
                              <StatusBadge status={cat.translation_status} />
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-0.5">
                                {canModify(cat) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="hover:bg-foreground/10 hover:text-foreground"
                                    title="삭제"
                                    onClick={() => handleDelete(cat)}
                                    aria-label="삭제"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="hover:bg-foreground/10 hover:text-foreground"
                                  title={canModify(cat) ? "수정" : "보기"}
                                  onClick={() => {
                                    setModalReadOnly(!canModify(cat));
                                    setModalCategoryId(cat.id);
                                  }}
                                  aria-label={canModify(cat) ? "수정" : "보기"}
                                >
                                  {canModify(cat) ? (
                                    <Pencil className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 모바일 */}
                  <div className="space-y-2 md:hidden">
                    {displayCategories.map((cat) => (
                      <Card key={cat.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0 mr-2">
                            <Checkbox
                              checked={selectedIds.has(cat.id)}
                              disabled={!canModify(cat)}
                              onCheckedChange={() => toggleSelect(cat.id)}
                              aria-label={`${cat.category_name_ko ?? cat.category_name} 선택`}
                            />
                            <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {searchLanguage === "ko"
                                ? cat.category_name_ko ?? cat.category_name
                                : searchLanguage === "zh"
                                  ? cat.category_name_zh ?? cat.category_name
                                  : cat.category_name_en ?? cat.category_name}
                              {isSearchMode && cat.similarity_score != null && (
                                <button
                                  type="button"
                                  className="ml-2 font-mono text-sm text-accent cursor-pointer hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveResult(cat as Recommendation);
                                    setCosineDialogOpen(true);
                                  }}
                                >
                                  {(cat.similarity_score * 100).toFixed(1)}%
                                </button>
                              )}
                            </p>
                            <div className="mt-1">
                              <StatusBadge status={cat.translation_status} />
                            </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {canModify(cat) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="hover:bg-foreground/10 hover:text-foreground"
                                title="삭제"
                                onClick={() => handleDelete(cat)}
                                aria-label="삭제"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="hover:bg-foreground/10 hover:text-foreground"
                              title={canModify(cat) ? "수정" : "보기"}
                              onClick={() => {
                                setModalReadOnly(!canModify(cat));
                                setModalCategoryId(cat.id);
                              }}
                              aria-label={canModify(cat) ? "수정" : "보기"}
                            >
                              {canModify(cat) ? (
                                <Pencil className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* 페이지네이션 */}
                  {displayMeta && displayMeta.last_page > 1 && (
                    <div className="mt-4 overflow-x-auto">
                      <Pagination className="mx-0 w-auto justify-start">
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationLink
                              onClick={() => handlePageChange(displayMeta.current_page - 1)}
                              className={displayMeta.current_page <= 1 ? "pointer-events-none opacity-50" : ""}
                              aria-disabled={displayMeta.current_page <= 1}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </PaginationLink>
                          </PaginationItem>
                          {(() => {
                            const range = getPageRange(displayMeta.current_page, displayMeta.last_page);
                            const currentIndex = range.indexOf(displayMeta.current_page);
                            return range.map((p, i) => {
                              if (p === "...") {
                                const direction = i < currentIndex ? "prev" : "next";
                                const target = getEllipsisTarget(
                                  displayMeta.current_page,
                                  displayMeta.last_page,
                                  direction,
                                );
                                return (
                                  <PaginationItem key={`e-${i}`}>
                                    <PaginationLink
                                      className="h-9 w-9 p-0"
                                      onClick={() => handlePageChange(target)}
                                    >
                                      <PaginationEllipsis />
                                    </PaginationLink>
                                  </PaginationItem>
                                );
                              }
                              return (
                                <PaginationItem key={p}>
                                  <PaginationLink
                                    isActive={p === displayMeta.current_page}
                                    onClick={() => handlePageChange(p)}
                                  >
                                    {p}
                                  </PaginationLink>
                                </PaginationItem>
                              );
                            });
                          })()}
                          <PaginationItem>
                            <PaginationLink
                              onClick={() => handlePageChange(displayMeta.current_page + 1)}
                              className={displayMeta.current_page >= displayMeta.last_page ? "pointer-events-none opacity-50" : ""}
                              aria-disabled={displayMeta.current_page >= displayMeta.last_page}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </PaginationLink>
                          </PaginationItem>
                          <PaginationItem className="ml-2">
                            <select
                              value={perPage}
                              onChange={(e) => {
                                const newPerPage = Number(e.target.value);
                                setPerPage(newPerPage);
                                if (isSearchMode) {
                                  handleSearch(1);
                                } else {
                                  const params = new URLSearchParams(searchParams.toString());
                                  params.set("page", "1");
                                  params.set("per_page", String(newPerPage));
                                  router.push(`/embed?${params.toString()}`);
                                }
                              }}
                              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                            >
                              <option value={10}>10 / page</option>
                              <option value={20}>20 / page</option>
                              <option value={50}>50 / page</option>
                            </select>
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

      {/* 코사인 유사도 상세 다이얼로그 */}
      <CosineDetailDialog
        open={cosineDialogOpen}
        onOpenChange={setCosineDialogOpen}
        result={activeResult}
      />

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
        onUpdateData={setData}
        onUpdateListRow={(row) => updateCategoryStatus(row.id, {
          translation_status: row.translation_status as Category["translation_status"],
          category_name_ko: row.category_name_ko,
          category_name_zh: row.category_name_zh,
          category_name_en: row.category_name_en,
        })}
        execState={modalCategoryId ? getState(modalCategoryId) : null}
        onSingleAction={async (stepName) => {
          if (modalCategoryId !== null) {
            await handleSingleAction(modalCategoryId, stepName, () => loadCategories(page, perPage, filter), setData);
          }
        }}
        onRunAll={async () => {
          if (modalCategoryId !== null && detailData) {
            await handleRunAll(modalCategoryId, detailData, () => loadCategories(page, perPage, filter), setData);
          }
        }}
        onCancelPending={() => {
          if (modalCategoryId !== null) {
            handleCancelPending(modalCategoryId);
          }
        }}
        onClearStep={(stepName) => {
          if (modalCategoryId !== null) {
            clearStep(modalCategoryId, stepName);
          }
        }}
        readOnly={modalReadOnly}
      />
    </div>
  );
}
