"use client";

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth, getToken } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryDetail } from "@/hooks/useCategoryDetail";
import { useCategoryExecution } from "@/hooks/useCategoryExecution";
import { getCategories } from "@/lib/api";
import { parseEmbedParams } from "@/lib/embed-params";
import { isAdmin } from "@/lib/utils";
import type { HierarchyFilterState } from "@/components/admin/category-hierarchy";
import type { Category, PaginationMeta, User, StepName, FolderGroup } from "@/lib/api";

export interface UseEmbedStateProps {
  serverLevelOptions: string[][];
  serverMaxDepth: number;
  serverCategories: Category[];
  serverMeta: PaginationMeta | null;
  serverHadToken: boolean;
  serverFilter: string | null;
  serverUser?: User | null;
  serverSearchResults: Category[] | null;
  serverSearchMeta: PaginationMeta | null;
  serverQueryEmbedding?: number[] | null;
  serverSearchText: string | null;
  serverSearchLang: string;
  serverHierarchyLang?: string;
  serverFolder?: string | null;
  serverFolders?: string[];
  serverUsers?: { id: number; name: string; email: string }[];
  serverUserId?: string | null;
  serverFolderGroups?: FolderGroup[];
}

export function useEmbedState(props: UseEmbedStateProps) {
  const { user } = useAuth(props.serverUser);
  const searchParams = useSearchParams();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Parse page and per_page from URL
  const [page, setPage] = useState(() => {
    const pageParam = searchParams.get("page_number");
    const urlPage = Number.parseInt(pageParam ?? "1", 10);
    return Number.isNaN(urlPage) || urlPage < 1 ? 1 : urlPage;
  });

  const perPageParam = searchParams.get("page_size");
  const urlPerPage = Number.parseInt(perPageParam ?? "20", 10);
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
  } = useCategories(token, props.serverCategories, props.serverMeta);

  // URL에서 파라미터 파싱
  const embedParams = parseEmbedParams(searchParams);
  const initialFilterMode = embedParams.searchMode;
  const initialHierarchy: HierarchyFilterState = embedParams.catPath.length > 0
    ? [...embedParams.catPath]
    : [];
  const initialFilterKeyword = embedParams.likeQuery ?? "";

  const [perPage, setPerPage] = useState(initialPerPage);
  // 비로그인 또는 카테고리 미보유 시 "all"로 기본값 설정 (null 방지 — UI에서 둘 다 비활성 상태 방지)
  const [filterSelection, setFilterSelection] = useState<"all" | "my">(
    props.serverFilter === "my" ? "my" : "all"
  );
  const [keywordSearchActive, setKeywordSearchActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hierarchyRefreshKey, setHierarchyRefreshKey] = useState(0);
  const [hierarchyResetKey, setHierarchyResetKey] = useState(0);
  const [hierarchyKeyword, setHierarchyKeyword] = useState(initialFilterKeyword);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(props.serverFolder ?? null);
  const selectedFolderRef = useRef(selectedFolder);
  // eslint-disable-next-line react-hooks/refs
  selectedFolderRef.current = selectedFolder;

  const [selectedUserId, setSelectedUserId] = useState<number | null>(
    props.serverUserId ? Number.parseInt(props.serverUserId, 10) : null
  );
  const selectedUserIdRef = useRef(selectedUserId);
  // eslint-disable-next-line react-hooks/refs
  selectedUserIdRef.current = selectedUserId;

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryCode, setNewCategoryCode] = useState("");
  const [addMode, setAddMode] = useState<"single" | "bulk">("single");

  // 검색 state (URL 및 SSR prefetch에서 초기값)
  const [searchText, setSearchText] = useState(props.serverSearchText ?? embedParams.similarityQuery ?? "");
  const [searchLanguage, setSearchLanguage] = useState(props.serverSearchLang ?? embedParams.translationLang);
  const [hierarchyLang, setHierarchyLang] = useState(props.serverHierarchyLang ?? embedParams.hierarchyLang ?? "ko");
  const [searchResults, setSearchResults] = useState<Category[] | null>(props.serverSearchResults ?? null);
  const [queryEmbedding, setQueryEmbedding] = useState<number[] | null>(props.serverQueryEmbedding ?? null);

  // useRef로 searchResults 참조 — useEffect 의존성 배열에 추가하지 않고 최신값 읽기
  const searchResultsRef = useRef(searchResults);
  useEffect(() => { searchResultsRef.current = searchResults; });
  const searchTextRef = useRef(searchText);
  useEffect(() => { searchTextRef.current = searchText; });
  const prevSearchLangRef = useRef(searchLanguage);
  const searchLangRef = useRef(searchLanguage);
  useEffect(() => { searchLangRef.current = searchLanguage; });
  const hierarchyLangRef = useRef(hierarchyLang);
  useEffect(() => { hierarchyLangRef.current = hierarchyLang; });
  const [searchMeta, setSearchMeta] = useState<PaginationMeta | null>(props.serverSearchMeta ?? null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [cosineDialogOpen, setCosineDialogOpen] = useState(false);
  const [activeResult, setActiveResult] = useState<Category | null>(null);
  const searchPageRef = useRef(1);
  const perPageRef = useRef(perPage);
  useEffect(() => { perPageRef.current = perPage; });
  const keywordRef = useRef(initialFilterKeyword);

  const activeFilterSelection = filterSelection;
  const effectiveFilter = activeFilterSelection === "my" ? "my" : undefined;
  const filterRef = useRef(filterSelection);
  useEffect(() => { filterRef.current = filterSelection; });
  // steps 필터 (TaskExecution 체크박스 상태)
  const stepsRef = useRef<StepName[] | undefined>(undefined);

  // URL에 초기 필터 파라미터가 있으면 첫 loadCategories를 건너뛴다 (CategoryHierarchy mount effect가 대신 처리)
  const skipInitialLoad = useRef(initialHierarchy.length > 0 || !!initialFilterKeyword);
  // SSR 데이터가 있으면 CSR 재요청 건너뜀 (비로그인 사용자도 SSR에서 공개 카테고리 prefetch)
  const hadServerCategories = useRef(props.serverCategories.length > 0);
  // resetToDefault() 직후 data-loading effect가 중복 호출되지 않도록 건너뜀
  const skipLoadEffectRef = useRef(false);
  // SSR에서 결정된 기본 필터 (내 카테고리 보유 시 "my", 미보유 시 "all")
  const defaultFilterRef = useRef<"all" | "my">(
    props.serverFilter === "my" ? "my" : "all"
  );
  // SSR 데이터 skip 후 의존성 변화 추적 — useAuth 등 비사용자 리렌더에서 중복 호출 방지
  const prevDepsForSkipRef = useRef({ page, perPage, effectiveFilter });

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
      await addCategory(
        newCategoryName.trim(),
        newCategoryCode.trim() || undefined,
        undefined,
        undefined,
        selectedFolder ?? undefined,
        selectedUserId ?? undefined
      );
      setNewCategoryName("");
      setNewCategoryCode("");
      setHierarchyRefreshKey(prev => prev + 1);
    } catch {
      // 에러는 useCategories에서 이미 처리됨 (catError state)
    }
  }, [newCategoryName, newCategoryCode, selectedFolder, selectedUserId, addCategory]);

  // TaskExecution 체크박스 변경 시 카테고리 목록을 steps 필터로 갱신
  const handleStepsChange = useCallback((steps: StepName[]) => {
    stepsRef.current = steps.length > 0 ? steps : undefined;
    const kw = keywordRef.current;
    loadCategories(
      1,
      perPage,
      effectiveFilter,
      kw,
      selectedFolder ?? undefined,
      selectedUserId ?? undefined,
      stepsRef.current,
      hierarchyLangRef.current
    );
  }, [perPage, effectiveFilter, loadCategories, selectedFolder, selectedUserId]);

  // URL 업데이트 (현재 URL 보존 + 오버라이드만 적용)
  const updateURL = useCallback((overrides: {
    ownerScope?: string | undefined;
    similarityQuery?: string;
    translationLang?: string;
    hierarchyLang?: string;
    searchMode?: string;
    catPath?: (string | null)[];
    likeQuery?: string;
    folder?: string | null;
    userId?: number | null;
    pageNumber?: number;
  }) => {
    const params = new URLSearchParams(globalThis.location.search);

    const apply = (key: string, value: string | null | undefined, clearChildren?: string[]) => {
      if (value) { params.set(key, value); return; }
      params.delete(key);
      if (clearChildren) clearChildren.forEach(k => params.delete(k));
    };

    if ("ownerScope" in overrides) apply("owner_scope", overrides.ownerScope);
    if ("similarityQuery" in overrides) {
      if (overrides.similarityQuery) params.set("similarity_query", overrides.similarityQuery);
      else { params.delete("similarity_query"); params.delete("translation_lang"); }
    }
    if ("translationLang" in overrides) {
      if (overrides.translationLang && overrides.translationLang !== "ko") params.set("translation_lang", overrides.translationLang);
      else params.delete("translation_lang");
    }
    if ("hierarchyLang" in overrides) {
      if (overrides.hierarchyLang && overrides.hierarchyLang !== "ko") params.set("hierarchy_lang", overrides.hierarchyLang);
      else params.delete("hierarchy_lang");
    }
    if ("searchMode" in overrides && overrides.searchMode) params.set("search_mode", overrides.searchMode);
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
    if ("likeQuery" in overrides) apply("like_query", overrides.likeQuery);
    if ("folder" in overrides) {
      if (overrides.folder) params.set("folder", overrides.folder);
      else params.delete("folder");
    }
    if ("userId" in overrides) {
      if (overrides.userId) params.set("user_id", String(overrides.userId));
      else params.delete("user_id");
    }

    const effectivePage = overrides.pageNumber ?? page;
    if (effectivePage > 1) params.set("page_number", String(effectivePage));
    else params.delete("page_number");
    if (perPage !== 20) params.set("page_size", String(perPage));

    const qs = params.toString();
    globalThis.history.replaceState(null, "", `/embed${qs ? "?" + qs : ""}`);
  }, [page, perPage]);

  const handleSearch = useCallback(async (pageArg?: number, keyword?: string) => {
    const currentPage = pageArg ?? 1;
    searchPageRef.current = currentPage;

    // 빈 검색어 + 키워드 없음 → 검색 모드 해제
    if (!searchText.trim() && !keyword) {
      setSearchResults(null);
      setSearchMeta(null);
      setSearchError(null);
      updateURL({ similarityQuery: "", translationLang: "ko" });
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setKeywordSearchActive(false);
    updateURL({ similarityQuery: searchText, translationLang: searchLangRef.current });
    try {
      const data = await getCategories(
        token,
        currentPage,
        perPageRef.current,
        filterRef.current ?? undefined,
        keyword ?? (keywordRef.current || undefined),
        selectedFolderRef.current ?? undefined,
        selectedUserIdRef.current,
        undefined, // steps
        undefined, // searchLang
        searchText,           // text (유사도 검색)
        searchLangRef.current // targetLanguage
      );
      setSearchResults(data.data);
      setSearchMeta(data.meta);
      setQueryEmbedding(data.query_embedding ?? null);
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
    // 단, 의존성(page, perPage, effectiveFilter)이 실제로 변경된 경우에만 skip 해제
    // → useAuth getUser() 등 비사용자 리렌더에서 중복 호출 방지
    if (hadServerCategories.current) {
      const depsChanged =
        prevDepsForSkipRef.current.page !== page ||
        prevDepsForSkipRef.current.perPage !== perPage ||
        prevDepsForSkipRef.current.effectiveFilter !== effectiveFilter;
      prevDepsForSkipRef.current = { page, perPage, effectiveFilter };
      if (!depsChanged) {
        return;
      }
      hadServerCategories.current = false;
    }
    if (searchResultsRef.current !== null) {
      handleSearchRef.current(page);
    } else {
      const kw = keywordRef.current;
      loadCategories(
        page,
        perPage,
        effectiveFilter,
        kw,
        selectedFolder ?? undefined,
        selectedUserId ?? undefined,
        stepsRef.current,
        hierarchyLangRef.current
      );
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
      const hasResidual =
        searchTextRef.current ||
        searchResultsRef.current !== null ||
        filterRef.current !== defaultFilterRef.current ||
        keywordRef.current;
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
        stepsRef.current = undefined;
        loadCategories(
          1,
          20,
          defaultFilter === "my" ? "my" : undefined,
          "",
          selectedFolder ?? undefined,
          selectedUserId ?? undefined
        );
      }
    } else {
      resetDoneRef.current = false;
    }
  }, [searchParams, mounted, loadCategories]);

  // URL에 검색어가 있는데 state가 불일치하면 동기화 후 검색 실행 (앞으로가기, 뒤로가기)
  useEffect(() => {
    if (!mounted) return;
    const urlSearchText = searchParams.get("similarity_query") || "";
    const urlSearchLang = searchParams.get("translation_lang") || "ko";
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
    updateURL({ similarityQuery: "", translationLang: "ko" });
    // API에서 최신 카테고리 목록 로드 (캐시 대신)
    loadCategories(
      page,
      perPageRef.current,
      filterRef.current ?? undefined,
      keywordRef.current || undefined,
      selectedFolderRef.current ?? undefined,
      selectedUserIdRef.current ?? undefined,
      stepsRef.current,
      hierarchyLangRef.current,
    );
  }, [updateURL, page, loadCategories]);

  // 전체 상태 초기화 (기능시연, 브라우저 뒤로가기 등에서 사용)
  const resetToDefault = useCallback(() => {
    // URL을 즉시 동기화 (window.history.replaceState로 렌더링 지연 없이 즉시 반영)
    globalThis.history.replaceState(null, "", "/embed");

    // data-loading effect가 중복 호출되지 않도록 건너뜀
    skipLoadEffectRef.current = true;
    // URL reset effect가 기본 필터를 잔여 상태로 오판하지 않도록 방지
    resetDoneRef.current = true;

    // 검색 상태 초기화
    setSearchText("");
    setSearchLanguage("ko");
    setHierarchyLang("ko");
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

    // 폴더 선택 초기화 (전체)
    setSelectedFolder(null);
    setSelectedUserId(null);

    // 계층 필터 완전 초기화
    setHierarchyResetKey((prev) => prev + 1);
    setHierarchyKeyword("");

    // 카테고리 목록 리로드 (SSR 기본 필터 적용, 폴더 초기화)
    stepsRef.current = undefined;
    loadCategories(1, 20, defaultFilter === "my" ? "my" : undefined, "", undefined, undefined);
  }, [loadCategories]);

  // "기능시연" 클릭 시 커스텀 이벤트로 즉시 리셋
  useEffect(() => {
    const handleResetEmbed = () => {
      resetToDefault();
    };
    globalThis.addEventListener("resetEmbedPage", handleResetEmbed);
    return () => globalThis.removeEventListener("resetEmbedPage", handleResetEmbed);
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
      loadCategories(
        1,
        perPage,
        effectiveFilter,
        "",
        selectedFolder ?? undefined,
        selectedUserId ?? undefined,
        stepsRef.current
      );
      return;
    }
    setSearchResults(null);
    setSearchMeta(null);
    setSearchError(null);
    setKeywordSearchActive(true);
    // 검색 모드: 모든 언어 컬럼에서 부분 검색 (search_lang 미전달)
    loadCategories(
      1,
      perPage,
      effectiveFilter,
      keyword,
      selectedFolder ?? undefined,
      selectedUserId ?? undefined,
      stepsRef.current
    );
  }, [perPage, effectiveFilter, loadCategories, searchResults, handleSearch]);

  // 필터 상태 변경 시 URL 업데이트
  const handleFilterChange = useCallback(
    (state: { mode: "hierarchy" | "search"; hierarchy: HierarchyFilterState; keyword: string }) => {
      setHierarchyKeyword(state.keyword);
      updateURL({
        searchMode: state.mode,
        catPath: state.hierarchy,
        likeQuery: state.keyword || undefined,
      });
    },
    [updateURL]
  );

  // SSR에서 prefetch된 사용자 정보를 CSR user가 로드되기 전까지 fallback으로 사용
  const effectiveUser = user ?? props.serverUser;
  const canModify = useCallback((category: Category) => {
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

  const handleDelete = useCallback(async (cat: Category) => {
    if (!globalThis.confirm(`"${cat.category_name_ko}" 카테고리를 삭제하시겠습니까?`)) return;
    await deleteCategory(cat.id);
    setHierarchyRefreshKey(prev => prev + 1);
  }, [deleteCategory]);

  const handlePageChange = useCallback((newPage: number) => {
    if (isSearchMode) {
      handleSearch(newPage);
    } else {
      setPage(newPage);
      const params = new URLSearchParams(globalThis.location.search);
      params.set("page_number", String(newPage));
      params.set("page_size", String(perPage));
      globalThis.history.pushState(null, "", `/embed?${params.toString()}`);
    }
  }, [isSearchMode, handleSearch, perPage]);

  return {
    user,
    mounted,
    token,
    page,
    setPage,
    perPage,
    setPerPage,
    filterSelection,
    setFilterSelection,
    keywordSearchActive,
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
    searchResults,
    setSearchResults,
    searchMeta,
    queryEmbedding,
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
    categories,
    meta,
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
    addCategory,
    updateCategoryStatus,
    deleteCategory,
    handleAddCategory,
    handleStepsChange,
    updateURL,
    handleSearch,
    handleReset,
    resetToDefault,
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
    selectedUserIdRef,
    setKeywordSearchActive,
  };
}
