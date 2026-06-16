"use client";


import {
  Plus,
  RefreshCw,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
import CategoryHierarchy from "@/components/admin/category-hierarchy";
import TaskExecution from "@/components/admin/task-execution";
import CategoryDelete from "@/components/admin/category-delete";
import CategoryDownload from "@/components/admin/category-download";
import FolderSection from "@/components/admin/folder-section";
import CosineDetailDialog from "@/components/admin/cosine-detail-dialog";
import BulkUpload from "@/components/bulk-upload";
import { useEmbedState } from "@/hooks/useEmbedState";
import { cn } from "@/lib/utils";
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

function getPillButtonClass(active: boolean): string {
  return cn(
    "h-7 rounded-full px-2.5 text-xs font-medium transition-colors",
    active
      ? "border border-primary/40 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
      : "border border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

export function EmbedPageInner({
  serverLevelOptions,
  serverMaxDepth,
  serverCategories,
  serverMeta,
  serverHadToken,
  serverFilter,
  serverUser,
  serverSearchResults,
  serverSearchMeta,
  serverSearchText,
  serverSearchLang,
  serverHierarchyLang,
  serverFolder,
  serverFolders,
  serverUsers,
  serverUserId,
  serverFolderGroups,
}: {
  serverLevelOptions: string[][];
  serverMaxDepth: number;
  serverCategories: Category[];
  serverMeta: PaginationMeta | null;
  serverHadToken: boolean;
  serverFilter: string | null;
  serverUser?: import("@/lib/api").User | null;
  serverSearchResults: Recommendation[] | null;
  serverSearchMeta: PaginationMeta | null;
  serverSearchText: string | null;
  serverSearchLang: string;
  serverHierarchyLang?: string;
  serverFolder?: string | null;
  serverFolders?: string[];
  serverUsers?: { id: number; name: string; email: string }[];
  serverUserId?: string | null;
  serverFolderGroups?: import("@/lib/api").FolderGroup[];
}) {
  const state = useEmbedState({
    serverLevelOptions,
    serverMaxDepth,
    serverCategories,
    serverMeta,
    serverHadToken,
    serverFilter,
    serverUser,
    serverSearchResults,
    serverSearchMeta,
    serverSearchText,
    serverSearchLang,
    serverHierarchyLang,
    serverFolder,
    serverFolders,
    serverUsers,
    serverUserId,
    serverFolderGroups,
  });

  const {
    user,
    token,
    page,
    perPage,
    setPerPage,
    setPage,
    setFilterSelection,
    selectedIds,
    setSelectedIds,
    hierarchyRefreshKey,
    setHierarchyRefreshKey,
    hierarchyResetKey,
    setHierarchyResetKey,
    hierarchyKeyword,
    setHierarchyKeyword,
    selectedFolder,
    setSelectedFolder,
    selectedUserId,
    setSelectedUserId,
    newCategoryName,
    setNewCategoryName,
    newCategoryCode,
    setNewCategoryCode,
    addMode,
    setAddMode,
    searchText,
    setSearchText,
    searchLanguage,
    setSearchLanguage,
    hierarchyLang,
    setHierarchyLang,
    isSearching,
    searchError,
    cosineDialogOpen,
    setCosineDialogOpen,
    activeResult,
    setActiveResult,
    modalCategoryId,
    setModalCategoryId,
    modalReadOnly,
    setModalReadOnly,
    detailData,
    detailLoading,
    detailError,
    setData,
    catLoading,
    catError,
    isSearchMode,
    displayCategories,
    displayMeta,
    effectiveUser,
    activeFilterSelection,
    effectiveFilter,
    stepsRef,
    hierarchyLangRef,
    keywordRef,
    filterRef,
    // Actions & Handlers
    getState,
    handleSingleAction,
    handleRunAll,
    handleCancelPending,
    clearStep,
    loadCategories,
    updateCategoryStatus,
    handleAddCategory,
    handleStepsChange,
    updateURL,
    handleSearch,
    handleReset,
    handleKeywordSearch,
    handleFilterChange,
    canModify,
    toggleSelectAll,
    toggleSelect,
    handleDelete,
    handlePageChange,
    initialFilterMode,
    initialHierarchy,
    initialFilterKeyword,
    selectedFolderRef,
    setKeywordSearchActive,
  } = state;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="noise-overlay" />
      <div className="absolute inset-0 bg-grid" />
      <div className="glow-orb -top-40 -right-40 h-96 w-96 bg-slate-500/10 dark:bg-slate-500/8" />
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
                <div className="flex flex-wrap justify-end gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className={getPillButtonClass(searchLanguage === "ko")}
                    onClick={() => { setSearchLanguage("ko"); updateURL({ searchLanguage: "ko" }); }}
                    aria-pressed={searchLanguage === "ko"}
                  >
                    한국어
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={getPillButtonClass(searchLanguage === "en")}
                    onClick={() => { setSearchLanguage("en"); updateURL({ searchLanguage: "en" }); }}
                    aria-pressed={searchLanguage === "en"}
                  >
                    영어
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={getPillButtonClass(searchLanguage === "zh")}
                    onClick={() => { setSearchLanguage("zh"); updateURL({ searchLanguage: "zh" }); }}
                    aria-pressed={searchLanguage === "zh"}
                  >
                    중국어
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="검색어 입력..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearch();
                    }}
                    className="h-9 text-sm"
                  />
                  {searchText && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleReset}
                      className="h-9 shrink-0"
                      aria-label="초기화"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => handleSearch()}
                    disabled={isSearching || !searchText.trim()}
                    className="h-9 shrink-0"
                    aria-label="검색"
                  >
                    {isSearching ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {searchError && (
                  <p className="text-sm text-destructive">{searchError}</p>
                )}
              </CardContent>
            </Card>

            {/* 폴더 */}
            {serverHadToken && (
              <FolderSection
                token={token}
                user={effectiveUser ?? null}
                selectedFolder={selectedFolder}
                selectedIds={selectedIds}
                serverFolders={serverFolders}
                serverUsers={serverUsers}
                serverFolderGroups={serverFolderGroups}
                initialUserId={selectedUserId}
                filter={effectiveFilter}
                keyword={hierarchyKeyword || undefined}
                currentFolder={selectedFolder}
                currentUserId={selectedUserId}
                onFolderChange={(folder, userId) => {
                  setSelectedFolder(folder);
                  if (userId !== undefined) {
                    setSelectedUserId(userId);
                  }
                  // 계층 필터만 초기화 (유사도 검색, 전체/내카테고리, 검색어는 유지)
                  setKeywordSearchActive(false);
                  setHierarchyKeyword("");
                  keywordRef.current = "";
                  setHierarchyResetKey(prev => prev + 1);
                  // page=1, folder + user_id URL 반영 (기존 filter 등 파라미터 보존)
                  updateURL({ folder: folder ?? null, userId: userId ?? null, page: 1 });
                  // 폴더 범위로 카테고리 재로드 (기존 필터 유지)
                  loadCategories(1, perPage, effectiveFilter, keywordRef.current, folder ?? undefined, userId ?? undefined, stepsRef.current, hierarchyLangRef.current);
                }}
                onFolderActionComplete={() => {
                  // 폴더 이동 후 선택 해제
                  setSelectedIds(new Set());
                  loadCategories(page, perPage, effectiveFilter, keywordRef.current, selectedFolderRef.current ?? undefined, selectedUserId ?? undefined, stepsRef.current, hierarchyLangRef.current);
                }}
              />
            )}

            {/* 필터 */}
            <CategoryHierarchy
              onSelectCategory={(categoryId) => {
                const cat = displayCategories.find(c => c.id === categoryId);
                setModalReadOnly(cat ? !canModify(cat) : false);
                setModalCategoryId(categoryId);
              }}
              onSelectLeafPath={() => {
                // 리프 선택 시 모달 자동 open 제거 — 사용자가 직접 클릭으로만 모달 열기
              }}
              onKeywordSearch={handleKeywordSearch}
              initialMode={initialFilterMode}
              initialHierarchy={initialHierarchy}
              initialKeyword={initialFilterKeyword}
              onFilterChange={handleFilterChange}
              initialLevelOptions={serverLevelOptions}
              initialMaxDepth={serverMaxDepth}
              refreshKey={hierarchyRefreshKey}
              resetKey={hierarchyResetKey}
              token={token}
              folder={selectedFolder}
              userId={selectedUserId}
              lang={hierarchyLang}
              onLangChange={(lang, mode, catPath, keyword) => {
                setHierarchyLang(lang);
                updateURL({
                  hierarchyLang: lang,
                  ...(mode !== undefined && { mode }),
                  ...(catPath !== undefined && { catPath }),
                  ...(keyword !== undefined && { q: keyword || undefined }),
                });
              }}
            />

            {/* 추가 */}
            {serverHadToken && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">추가</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className={getPillButtonClass(addMode === "single")}
                      onClick={() => setAddMode("single")}
                      aria-pressed={addMode === "single"}
                    >
                      단일
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={getPillButtonClass(addMode === "bulk")}
                      onClick={() => setAddMode("bulk")}
                      aria-pressed={addMode === "bulk"}
                    >
                      대량
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {addMode === "single" ? (
                  <>
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
                  </>
                ) : (
                  <BulkUpload
                    token={token}
                    folder={selectedFolder ?? undefined}
                    onSuccess={() => {
                      loadCategories(page, perPage, effectiveFilter, undefined, selectedFolder ?? undefined, selectedUserId ?? undefined, stepsRef.current, hierarchyLangRef.current);
                      setHierarchyRefreshKey((prev) => prev + 1);
                    }}
                  />
                )}
                {catError && (
                  <p className="text-sm text-destructive">{catError}</p>
                )}
              </CardContent>
            </Card>
            )}

            {/* 작업 실행 */}
            <TaskExecution
              token={token}
              selectedIds={selectedIds}
              categories={displayCategories}
              filter={effectiveFilter}
              keyword={hierarchyKeyword || undefined}
              canModify={canModify}
              folder={selectedFolder ?? undefined}
              onStepsChange={handleStepsChange}
              onComplete={(wasStopped) => {
                if (!wasStopped) {
                  setSelectedIds(new Set());
                }
                const kw = keywordRef.current;
                const ef = filterRef.current === "my" ? "my" : undefined;
                loadCategories(1, perPage, ef, kw, selectedFolder ?? undefined, selectedUserId ?? undefined, stepsRef.current, hierarchyLangRef.current);
                updateURL({ page: 1 });
              }}
              onCategoryComplete={() => {
                // 배치 루프 중에는 목록을 새로고침하지 않음
                // (page 불일치 방지 — onComplete에서 최종 새로고침)
              }}
            />

            {/* 다운로드 */}
            {serverHadToken && (
            <CategoryDownload
              token={token}
              selectedIds={selectedIds}
              categories={displayCategories}
              filter={effectiveFilter}
              keyword={hierarchyKeyword || undefined}
              folder={selectedFolder ?? undefined}
            />
            )}

            {/* 삭제 */}
            {serverHadToken && (
            <CategoryDelete
              token={token}
              selectedIds={selectedIds}
              categories={displayCategories}
              filter={effectiveFilter}
              keyword={hierarchyKeyword || undefined}
              canModify={canModify}
              folder={selectedFolder ?? undefined}
              onComplete={() => {
                setSelectedIds(new Set());
                const kw = keywordRef.current;
                const ef = filterRef.current === "my" ? "my" : undefined;
                loadCategories(1, perPage, ef, kw, selectedFolder ?? undefined, selectedUserId ?? undefined, stepsRef.current, hierarchyLangRef.current);
                updateURL({ page: 1 });
                setHierarchyRefreshKey((prev) => prev + 1);
              }}
              onCategoryComplete={() => {
                // 배치 루프 중에는 목록을 새로고침하지 않음
                // (page 불일치 방지 — onComplete에서 최종 새로고침)
              }}
            />
            )}
          </div>

          {/* 카테고리 목록 테이블 */}
          <Card className="min-w-0 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-base">카테고리 목록</CardTitle>
              <div className="flex flex-wrap justify-end gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className={getPillButtonClass(activeFilterSelection === "all")}
                  onClick={() => {
                    setFilterSelection("all");
                    updateURL({ filter: "all" });
                  }}
                  aria-pressed={activeFilterSelection === "all"}
                >
                  전체
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={getPillButtonClass(activeFilterSelection === "my")}
                  onClick={() => {
                    if (!user) { alert("로그인이 필요합니다"); return; }
                    setFilterSelection("my");
                    updateURL({ filter: "my" });
                  }}
                  aria-pressed={activeFilterSelection === "my"}
                >
                  내 카테고리
                </Button>
              </div>
            </CardHeader>
            <CardContent className="min-w-0">
              {/* 로딩 */}
              {(catLoading || isSearching) && displayCategories.length === 0 && (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
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
                          <TableHead className="w-[80px] text-center">상태</TableHead>
                          <TableHead className="w-[92px] text-center">작업</TableHead>
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
                            <TableCell className="max-w-0 truncate font-medium">
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
                            <TableCell className="text-center">
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
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <Checkbox
                              checked={selectedIds.has(cat.id)}
                              disabled={!canModify(cat)}
                              onCheckedChange={() => toggleSelect(cat.id)}
                              aria-label={`${cat.category_name_ko ?? cat.category_name} 선택`}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {searchLanguage === "ko"
                                  ? cat.category_name_ko ?? cat.category_name
                                  : searchLanguage === "zh"
                                    ? cat.category_name_zh ?? cat.category_name
                                    : cat.category_name_en ?? cat.category_name}
                              </p>
                              {isSearchMode && cat.similarity_score != null && (
                                <button
                                  type="button"
                                  className="mt-1 w-fit cursor-pointer font-mono text-xs text-accent hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveResult(cat as Recommendation);
                                    setCosineDialogOpen(true);
                                  }}
                                >
                                  유사도 {(cat.similarity_score * 100).toFixed(1)}%
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center justify-center">
                            <StatusBadge status={cat.translation_status} />
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
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
                            <Select
                              value={String(perPage)}
                              onValueChange={(value) => {
                                const newPerPage = Number(value);
                                setPerPage(newPerPage);
                                if (isSearchMode) {
                                  handleSearch(1);
                                } else {
                                  setPage(1);
                                  const params = new URLSearchParams(window.location.search);
                                  params.set("page", "1");
                                  params.set("per_page", String(newPerPage));
                                  window.history.pushState(null, "", `/embed?${params.toString()}`);
                                }
                              }}
                            >
                              <SelectTrigger size="sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="10">10 / page</SelectItem>
                                <SelectItem value="20">20 / page</SelectItem>
                                <SelectItem value="50">50 / page</SelectItem>
                              </SelectContent>
                            </Select>
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
        searchKeyword={searchText}
        targetLanguage={searchLanguage}
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
            await handleSingleAction(modalCategoryId, stepName, () => loadCategories(page, perPage, effectiveFilter, undefined, selectedFolder ?? undefined, selectedUserId ?? undefined, stepsRef.current, hierarchyLangRef.current), setData);
          }
        }}
        onRunAll={async () => {
          if (modalCategoryId !== null && detailData) {
            await handleRunAll(modalCategoryId, detailData, () => loadCategories(page, perPage, effectiveFilter, undefined, selectedFolder ?? undefined, selectedUserId ?? undefined, stepsRef.current, hierarchyLangRef.current), setData);
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
