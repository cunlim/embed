"use client";

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import CategoryHierarchy, { type HierarchyFilterState } from "@/components/admin/category-hierarchy";
import TaskExecution from "@/components/admin/task-execution";
import CategoryDelete from "@/components/admin/category-delete";
import CategoryDownload from "@/components/admin/category-download";
import FolderSection from "@/components/admin/folder-section";
import CosineDetailDialog from "@/components/admin/cosine-detail-dialog";
import BulkUpload from "@/components/bulk-upload";
import { useAuth, getToken } from "@/hooks/useAuth";
import { cn, isAdmin } from "@/lib/utils";
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
  serverFolder?: string | null;
  serverFolders?: string[];
  serverUsers?: { id: number; name: string; email: string }[];
  serverUserId?: string | null;
  serverFolderGroups?: import("@/lib/api").FolderGroup[];
}) {
  const { user } = useAuth(serverUser);
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
  const initialHierarchy: HierarchyFilterState = embedParams.catPath.length > 0
    ? [...embedParams.catPath]
    : [];
  const initialFilterKeyword = embedParams.keyword ?? "";

  const [perPage, setPerPage] = useState(initialPerPage);
  const [filterSelection, setFilterSelection] = useState<"all" | "my" | null>(serverFilter === "my" ? "my" : serverFilter === "all" ? "all" : null);
  const [keywordSearchActive, setKeywordSearchActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hierarchyRefreshKey, setHierarchyRefreshKey] = useState(0);
  const [hierarchyResetKey, setHierarchyResetKey] = useState(0);
  const [hierarchyKeyword, setHierarchyKeyword] = useState(initialFilterKeyword);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(serverFolder ?? null);
  const selectedFolderRef = useRef(selectedFolder);
  // eslint-disable-next-line react-hooks/refs
  selectedFolderRef.current = selectedFolder;

  const [selectedUserId, setSelectedUserId] = useState<number | null>(
    serverUserId ? parseInt(serverUserId, 10) : null
  );
  const selectedUserIdRef = useRef(selectedUserId);
  // eslint-disable-next-line react-hooks/refs
  selectedUserIdRef.current = selectedUserId;

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryCode, setNewCategoryCode] = useState("");
  const [addMode, setAddMode] = useState<"single" | "bulk">("single");

  // 검색 state (URL 및 SSR prefetch에서 초기값)
  const [searchText, setSearchText] = useState(serverSearchText ?? embedParams.searchText ?? "");
  const [searchLanguage, setSearchLanguage] = useState(serverSearchLang ?? embedParams.searchLang);
  const [searchResults, setSearchResults] = useState<Recommendation[] | null>(serverSearchResults ?? null);
  // useRef로 searchResults 참조 — useEffect 의존성 배열에 추가하지 않고 최신값 읽기
  const searchResultsRef = useRef(searchResults);
  useEffect(() => { searchResultsRef.current = searchResults });
  const searchTextRef = useRef(searchText);
  useEffect(() => { searchTextRef.current = searchText });
  const prevSearchLangRef = useRef(searchLanguage);
  const searchLangRef = useRef(searchLanguage);
  useEffect(() => { searchLangRef.current = searchLanguage });
  const [searchMeta, setSearchMeta] = useState<PaginationMeta | null>(serverSearchMeta ?? null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [cosineDialogOpen, setCosineDialogOpen] = useState(false);
  const [activeResult, setActiveResult] = useState<Recommendation | null>(null);
  const searchPageRef = useRef(1);
  const perPageRef = useRef(perPage);
  useEffect(() => { perPageRef.current = perPage });
  const keywordRef = useRef(initialFilterKeyword);
  // NOTE: serverFilter 폴백 제거 — 초기 상태에서 이미 반영됨 (useState).
  // 폴백이 있으면 setFilterSelection(null) 후에도 서버 초기값으로 되돌아가는 버그 발생.
  const activeFilterSelection = filterSelection;
  const effectiveFilter = activeFilterSelection === "my" ? "my" : undefined;
  // filterSelection을 추적 (effectiveFilter 아님 — "전체" 선택 시 effectiveFilter=undefined가 되어 hasResidual에서 누락됨)
  const filterRef = useRef(filterSelection);
  useEffect(() => { filterRef.current = filterSelection });

  // URL에 초기 필터 파라미터가 있으면 첫 loadCategories를 건너뛴다 (CategoryHierarchy mount effect가 대신 처리)
  const skipInitialLoad = useRef(initialHierarchy.length > 0 || !!initialFilterKeyword);
  // SSR 데이터가 있고 토큰도 있었으면 CSR 재요청 건너뜀 (마이그레이션 대응)
  const hadServerCategories = useRef(serverCategories.length > 0 && serverHadToken);
  // resetToDefault() 직후 data-loading effect가 중복 호출되지 않도록 건너뜀
  const skipLoadEffectRef = useRef(false);
  // SSR에서 결정된 기본 필터 (내 카테고리 보유 시 "my", 미보유 시 null)
  const defaultFilterRef = useRef<"all" | "my" | null>(serverFilter === "my" ? "my" : serverFilter === "all" ? "all" : null);

  const isSearchMode = searchResults !== null && !keywordSearchActive;
  const displayCategories = isSearchMode ? searchResults : categories;
  const displayMeta = isSearchMode ? searchMeta : meta;
  const [modalCategoryId, setModalCategoryId] = useState<number | null>(null);
  const [modalReadOnly, setModalReadOnly] = useState(false);
  const { data: detailData, isLoading: detailLoading, error: detailError, setData } =
    useCategoryDetail(modalCategoryId, token);

  const handleAddCategory = useCallback(async () => {
    if (!newCategoryName.trim()) return;
    try {
      await addCategory(newCategoryName.trim(), newCategoryCode.trim() || undefined, undefined, undefined, selectedFolder ?? undefined, selectedUserId ?? undefined);
      setNewCategoryName("");
      setNewCategoryCode("");
      setHierarchyRefreshKey(prev => prev + 1);
    } catch {
      // 에러는 useCategories에서 이미 처리됨 (catError state)
    }
  }, [newCategoryName, newCategoryCode, selectedFolder, selectedUserId, addCategory]);

  // URL 업데이트 (현재 URL 보존 + 오버라이드만 적용)
  const updateURL = useCallback((overrides: {
    filter?: string | undefined;
    searchText?: string;
    searchLanguage?: string;
    mode?: string;
    catPath?: (string | null)[];
    q?: string;
    folder?: string | null;
    userId?: number | null;
    page?: number;
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
    if ("catPath" in overrides) {
      // 기존 catN 모두 제거
      for (let i = 1; i <= 20; i++) params.delete(`cat${i}`);
      // 새 경로 설정
      if (overrides.catPath) {
        overrides.catPath.forEach((val, i) => {
          if (val) params.set(`cat${i + 1}`, val);
        });
      }
    }
    if ("q" in overrides) apply("q", overrides.q);
    if ("folder" in overrides) {
      if (overrides.folder) params.set("folder", overrides.folder);
      else params.delete("folder");
    }
    if ("userId" in overrides) {
      if (overrides.userId) params.set("user_id", String(overrides.userId));
      else params.delete("user_id");
    }

    const effectivePage = overrides.page ?? page;
    if (effectivePage > 1) params.set("page", String(effectivePage));
    else params.delete("page");
    if (perPage !== 20) params.set("per_page", String(perPage));

    const qs = params.toString();
    router.replace(`/embed${qs ? "?" + qs : ""}`, { scroll: false });
  }, [router, searchParams, page, perPage]);

  const handleSearch = useCallback(async (page?: number, keyword?: string) => {
    const currentPage = page ?? 1;
    searchPageRef.current = currentPage;

    // 빈 검색어 + 키워드 없음 → 검색 모드 해제
    if (!searchText.trim() && !keyword) {
      setSearchResults(null);
      setSearchMeta(null);
      setSearchError(null);
      updateURL({ searchText: "", searchLanguage: "ko" });
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setKeywordSearchActive(false);
    updateURL({ searchText, searchLanguage: searchLangRef.current });
    try {
      const data = await recommend(searchText, searchLangRef.current, token, currentPage, perPageRef.current, filterRef.current ?? undefined, keyword ?? (keywordRef.current || undefined), selectedFolderRef.current ?? undefined, selectedUserIdRef.current);
      setSearchResults(data.data);
      setSearchMeta(data.meta);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "검색에 실패했습니다");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchText, token, updateURL]);

  const handleSearchRef = useRef(handleSearch);
  useEffect(() => { handleSearchRef.current = handleSearch; });

  // 언어 변경 시 검색 모드면 자동 재검색
  useEffect(() => {
    if (!mounted) return;
    if (prevSearchLangRef.current !== searchLanguage && searchResultsRef.current !== null) {
      handleSearchRef.current(1);
    }
    prevSearchLangRef.current = searchLanguage;
  }, [searchLanguage, mounted]);

  // URL page 동기화 (시맨틱 검색 결과가 있으면 필터 변경 시 재검색)
  useEffect(() => {
    if (!mounted) return;
    if (skipLoadEffectRef.current) {
      skipLoadEffectRef.current = false;
      return;
    }
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
      handleSearchRef.current(page);
    } else {
      const kw = keywordRef.current;
      loadCategories(page, perPage, effectiveFilter, kw, selectedFolder ?? undefined, selectedUserId ?? undefined);
    }
  }, [mounted, page, perPage, effectiveFilter, loadCategories]);

  // URL이 비어있는데 검색/필터 상태가 남아있으면 초기화 (기능시연, 뒤로가기 등)
  const resetDoneRef = useRef(false);
  const initialMountDoneRef = useRef(false);
  useEffect(() => {
    if (!mounted) return;
    // 첫 마운트 시에는 SSR 데이터가 있으므로 초기화 건너뜀
    if (!initialMountDoneRef.current) {
      initialMountDoneRef.current = true;
      return;
    }
    if (!searchParams.toString()) {
      // 이미 리셋했으면 건너뜀 (무한 루프 방지)
      if (resetDoneRef.current) return;
      const hasResidual = searchTextRef.current || searchResultsRef.current !== null || filterRef.current !== defaultFilterRef.current || keywordRef.current;
      if (hasResidual) {
        resetDoneRef.current = true;
        setSearchText("");
        setSearchLanguage("ko");
        setSearchResults(null);
        setSearchMeta(null);
        setSearchError(null);
        const defaultFilter = defaultFilterRef.current;
        setFilterSelection(defaultFilter);
        setKeywordSearchActive(false);
        keywordRef.current = "";
        // per_page 초기화 (URL에서 파생된 state이므로 수동 동기화 필요)
        setPerPage(20);
        // 계층 필터 완전 초기화 (CategoryHierarchy의 resetKey 변경 시 selectedPath/levelOptions 리셋)
        setHierarchyResetKey((prev) => prev + 1);
        setHierarchyKeyword("");
        // 필터 ref 초기화 (SSR 기본값으로 복원)
        filterRef.current = defaultFilter;
        // 디폴트 카테고리 목록 리로드 (SSR 기본 필터 적용)
        loadCategories(1, 20, defaultFilter === "my" ? "my" : undefined, "", selectedFolder ?? undefined, selectedUserId ?? undefined);
      }
    } else {
      resetDoneRef.current = false;
    }
  }, [searchParams, mounted, loadCategories]);

  // URL에 검색어가 있는데 state가 불일치하면 동기화 후 검색 실행 (앞으로가기, 뒤로가기)
  useEffect(() => {
    if (!mounted) return;
    const urlSearchText = searchParams.get("stext") || "";
    const urlSearchLang = searchParams.get("slang") || "ko";
    if (urlSearchText && searchTextRef.current !== urlSearchText) {
      setSearchText(urlSearchText);
      setSearchLanguage(urlSearchLang);
      searchLangRef.current = urlSearchLang;
      handleSearchRef.current(1);
    }
  }, [searchParams, mounted]);

  const handleReset = useCallback(() => {
    setSearchText("");
    setSearchResults(null);
    setSearchMeta(null);
    setSearchError(null);
    updateURL({ searchText: "", searchLanguage: "ko" });
  }, [updateURL]);

  // 전체 상태 초기화 (기능시연, 브라우저 뒤로가기 등에서 사용)
  const resetToDefault = useCallback(() => {
    // URL을 즉시 동기화 (window.history.replaceState로 렌더링 지연 없이 즉시 반영)
    // router.replace는 React 상태 배치로 인해 지연됨. <Link>와 충돌도 방지.
    window.history.replaceState(null, "", "/embed");

    // data-loading effect가 중복 호출되지 않도록 건너뜀
    skipLoadEffectRef.current = true;
    // URL reset effect가 기본 필터를 잔여 상태로 오판하지 않도록 방지
    resetDoneRef.current = true;

    // 검색 상태 초기화
    setSearchText("");
    setSearchLanguage("ko");
    setSearchResults(null);
    setSearchMeta(null);
    setSearchError(null);
    setIsSearching(false);

    // 필터 상태 초기화 (SSR 기본값으로 복원)
    const defaultFilter = defaultFilterRef.current;
    setFilterSelection(defaultFilter);
    setKeywordSearchActive(false);
    keywordRef.current = "";
    filterRef.current = defaultFilter;

    // 페이지네이션 초기화
    setPerPage(20);

    // 선택 상태 초기화
    setSelectedIds(new Set());

    // 계층 필터 완전 초기화
    setHierarchyResetKey((prev) => prev + 1);
    setHierarchyKeyword("");

    // 카테고리 목록 리로드 (SSR 기본 필터 적용)
    loadCategories(1, 20, defaultFilter === "my" ? "my" : undefined, "", selectedFolder ?? undefined, selectedUserId ?? undefined);
  }, [loadCategories]);

  // "기능시연" 클릭 시 커스텀 이벤트로 즉시 리셋
  useEffect(() => {
    const handleResetEmbed = () => {
      resetToDefault();
    };
    window.addEventListener("resetEmbedPage", handleResetEmbed);
    return () => window.removeEventListener("resetEmbedPage", handleResetEmbed);
  }, [resetToDefault]);

  const handleKeywordSearch = useCallback((keyword: string) => {
    // SSR 데이터가 이미 있고 같은 키워드면 재요청 건너뜀
    if (keyword === keywordRef.current && hadServerCategories.current) {
      return;
    }
    keywordRef.current = keyword;
    setHierarchyKeyword(keyword);
    if (searchResults !== null) {
      // 시맨틱 검색 활성 상태: 검색 재실행 (필터 컨텍스트는 URL/state로 이미 갱신됨)
      handleSearch(1, keyword);
      return;
    }
    if (!keyword) {
      setKeywordSearchActive(false);
      loadCategories(1, perPage, effectiveFilter, "", selectedFolder ?? undefined, selectedUserId ?? undefined);
      return;
    }
    setSearchResults(null);
    setSearchMeta(null);
    setSearchError(null);
    setKeywordSearchActive(true);
    loadCategories(1, perPage, effectiveFilter, keyword, selectedFolder ?? undefined, selectedUserId ?? undefined);
  }, [perPage, effectiveFilter, loadCategories, searchResults, handleSearch]);

  // 필터 상태 변경 시 URL 업데이트
  const handleFilterChange = useCallback(
    (state: { mode: "hierarchy" | "search"; hierarchy: HierarchyFilterState; keyword: string }) => {
      setHierarchyKeyword(state.keyword);
      updateURL({
        mode: state.mode,
        catPath: state.hierarchy,
        q: state.keyword || undefined,
      });
    },
    [updateURL]
  );

  // SSR에서 prefetch된 사용자 정보를 CSR user가 로드되기 전까지 fallback으로 사용
  const effectiveUser = user ?? serverUser;
  const canModify = useCallback((category: Category | Recommendation) => {
    if (!effectiveUser) return false;
    return isAdmin(effectiveUser) || ("user_id" in category && category.user_id === effectiveUser.id);
  }, [effectiveUser]);

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
                    onClick={() => setSearchLanguage("ko")}
                    aria-pressed={searchLanguage === "ko"}
                  >
                    한국어
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={getPillButtonClass(searchLanguage === "en")}
                    onClick={() => setSearchLanguage("en")}
                    aria-pressed={searchLanguage === "en"}
                  >
                    영어
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={getPillButtonClass(searchLanguage === "zh")}
                    onClick={() => setSearchLanguage("zh")}
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
                  loadCategories(1, perPage, effectiveFilter, keywordRef.current, folder ?? undefined, userId ?? undefined);
                }}
                onFolderActionComplete={() => {
                  // 폴더 이동 후 선택 해제
                  setSelectedIds(new Set());
                  loadCategories(page, perPage, effectiveFilter, keywordRef.current, selectedFolderRef.current ?? undefined, selectedUserId ?? undefined);
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
            />

            {/* 추가 */}
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
                      loadCategories(page, perPage, effectiveFilter, undefined, selectedFolder ?? undefined, selectedUserId ?? undefined);
                      setHierarchyRefreshKey((prev) => prev + 1);
                    }}
                  />
                )}
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
              filter={effectiveFilter}
              keyword={hierarchyKeyword || undefined}
              canModify={canModify}
              folder={selectedFolder ?? undefined}
              onComplete={(wasStopped) => {
                if (!wasStopped) {
                  setSelectedIds(new Set());
                }
                const kw = keywordRef.current;
                loadCategories(page, perPage, effectiveFilter, kw, selectedFolder ?? undefined, selectedUserId ?? undefined);
              }}
              onCategoryComplete={() => {
                const kw = keywordRef.current;
                loadCategories(page, perPage, effectiveFilter, kw, selectedFolder ?? undefined, selectedUserId ?? undefined);
              }}
            />

            {/* 다운로드 */}
            <CategoryDownload
              token={token}
              selectedIds={selectedIds}
              categories={displayCategories}
              filter={effectiveFilter}
              keyword={hierarchyKeyword || undefined}
              folder={selectedFolder ?? undefined}
            />

            {/* 삭제 */}
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
                loadCategories(page, perPage, effectiveFilter, kw, selectedFolder ?? undefined, selectedUserId ?? undefined);
                setHierarchyRefreshKey((prev) => prev + 1);
              }}
              onCategoryComplete={() => {
                const kw = keywordRef.current;
                loadCategories(page, perPage, effectiveFilter, kw, selectedFolder ?? undefined, selectedUserId ?? undefined);
              }}
            />
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
                                  const params = new URLSearchParams(searchParams.toString());
                                  params.set("page", "1");
                                  params.set("per_page", String(newPerPage));
                                  router.push(`/embed?${params.toString()}`);
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
            await handleSingleAction(modalCategoryId, stepName, () => loadCategories(page, perPage, effectiveFilter, undefined, selectedFolder ?? undefined), setData);
          }
        }}
        onRunAll={async () => {
          if (modalCategoryId !== null && detailData) {
            await handleRunAll(modalCategoryId, detailData, () => loadCategories(page, perPage, effectiveFilter, undefined, selectedFolder ?? undefined), setData);
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
