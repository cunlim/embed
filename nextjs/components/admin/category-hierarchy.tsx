"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchCategoryLevels, type CategoryLevelOption } from "@/lib/api";
import { Search, X, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** 인덱스 기반 계층 필터 상태. 인덱스가 depth, 값이 선택된 카테고리명. */
export type HierarchyFilterState = (string | null)[];

interface CategoryHierarchyProps {
  onSelectCategory: (categoryId: number) => void;
  onKeywordSearch: (keyword: string) => void;
  onSelectLeafPath?: (path: string[], categoryId?: number | null) => void;
  initialMode?: "hierarchy" | "search";
  initialHierarchy?: HierarchyFilterState;
  initialKeyword?: string;
  /** SSR prefetch 데이터: 각 depth별 옵션 배열 */
  initialLevelOptions: string[][];
  /** SSR prefetch에서 받은 maxDepth */
  initialMaxDepth: number;
  onFilterChange?: (state: {
    mode: "hierarchy" | "search";
    hierarchy: HierarchyFilterState;
    keyword: string;
  }) => void;
  refreshKey?: number;
  /** 값이 변경되면 계층 필터 상태를 완전 초기화 */
  resetKey?: number;
  token?: string | null;
  folder?: string | null;
  userId?: number | null;
  /** 분류선택 계층 언어 */
  lang?: string;
  /** 언어 변경 콜백 (언어, 필터모드, 계층경로, 키워드) */
  onLangChange?: (lang: string, mode?: "hierarchy" | "search", catPath?: HierarchyFilterState, keyword?: string) => void;
}

function getPillButtonClass(active: boolean): string {
  return cn(
    "h-7 rounded-full px-2.5 text-xs font-medium transition-colors",
    active
      ? "border border-primary/40 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
      : "border border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

export default function CategoryHierarchy({
  onSelectCategory,
  onKeywordSearch,
  initialMode = "hierarchy",
  initialHierarchy = [],
  initialKeyword = "",
  initialLevelOptions = [],
  initialMaxDepth = 1,
  onFilterChange,
  onSelectLeafPath,
  refreshKey = 0,
  resetKey = 0,
  token,
  folder,
  userId,
  lang = "ko",
  onLangChange,
}: CategoryHierarchyProps) {
  const [filterMode, setFilterMode] = useState<"hierarchy" | "search">(initialMode);
  const [selectedPath, setSelectedPath] = useState<HierarchyFilterState>(initialHierarchy);
  const [keywordText, setKeywordText] = useState(initialKeyword);
  const [maxDepth, setMaxDepth] = useState(initialMaxDepth);

  // 각 depth별 옵션 상태
  const [levelOptions, setLevelOptions] = useState<(string[] | CategoryLevelOption[])[]>(initialLevelOptions);

  // 각 depth별 로딩 상태
  const [loadingStates, setLoadingStates] = useState<boolean[]>([]);

  // refreshKey 변경 시 최상위 옵션 다시 조회
  const prevTokenRef = useRef<string | null | undefined>(null);
  const hasRestoredRef = useRef(false);
  const hadInitialOptions = useRef(initialLevelOptions.length > 0 && initialLevelOptions[0].length > 0);

  useEffect(() => {
    const tokenChanged = token !== prevTokenRef.current;
    prevTokenRef.current = token;
    const skipInitial = hadInitialOptions.current;
    hadInitialOptions.current = false;
    if (token && (refreshKey > 0 || (tokenChanged && !skipInitial))) {
      const params: Record<string, string> = {};
      if (lang !== "ko") params["lang"] = lang;
      if (folder) params["folder"] = folder;
      if (userId) params["user_id"] = String(userId);
      fetchCategoryLevels(Object.keys(params).length > 0 ? params : undefined, token, userId ?? undefined).then((res) => {
        const opts = res.data.options;
        setLevelOptions((prev) => prev.length > 1 ? [opts, ...prev.slice(1)] : [opts]);
        setMaxDepth(res.data.maxDepth);
      }).catch(() => {});
    }
  }, [refreshKey, token, lang]);

  // resetKey 변경 시 계층 필터 상태 완전 초기화 (기능시연 버튼 등)
  const prevResetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (resetKey === prevResetKeyRef.current) return;
    prevResetKeyRef.current = resetKey;
    setSelectedPath([]);
    setLevelOptions(initialLevelOptions.length > 0 ? initialLevelOptions : []);
    setLoadingStates([]);
    setKeywordText("");
    setFilterMode(initialMode);
    hasRestoredRef.current = true;
    // 최상위 옵션 다시 조회
    if (token) {
      const params: Record<string, string> = {};
      if (lang !== "ko") params["lang"] = lang;
      if (folder) params["folder"] = folder;
      if (userId) params["user_id"] = String(userId);
      fetchCategoryLevels(Object.keys(params).length > 0 ? params : undefined, token, userId ?? undefined).then((res) => {
        setLevelOptions((prev) => prev.length > 0 ? [res.data.options, ...prev.slice(1)] : [res.data.options]);
        setMaxDepth(res.data.maxDepth);
      }).catch(() => {});
    }
  }, [resetKey, initialMode, token, lang]);

  // 페이지 새로고침 시 초기 hierarchy 필터 복원
  useEffect(() => {
    if (hasRestoredRef.current) return;
    if (initialMode === "hierarchy" && initialHierarchy.length > 0 && initialHierarchy[0]) {
      hasRestoredRef.current = true;
      const path = initialHierarchy.filter((v): v is string => v !== null);
      onKeywordSearch(path.join(">"));

      // 각 depth에 대해 다음 옵션 로드
      for (let i = 0; i < path.length; i++) {
        const catParams: Record<string, string> = {};
        if (lang !== "ko") catParams["lang"] = lang;
        for (let j = 0; j <= i; j++) {
          catParams[`cat${j + 1}`] = path[j];
        }
        fetchCategoryLevels(catParams as Parameters<typeof fetchCategoryLevels>[0], token ?? undefined, userId ?? undefined).then((res) => {
          const nextOpts = res.data.options;
          setLevelOptions((prev) => {
            const next = [...prev];
            next[i + 1] = nextOpts;
            return next;
          });
          if (res.data.isLeaf) {
            onSelectLeafPath?.(path.slice(0, i + 1), res.data.leafCategoryId);
          }
          if (res.data.maxDepth) {
            setMaxDepth(res.data.maxDepth);
          }
        }).catch(() => {});
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reportFilterChange = useCallback(
    (mode: "hierarchy" | "search", path: HierarchyFilterState, kw: string) => {
      onFilterChange?.({ mode, hierarchy: path, keyword: kw });
    },
    [onFilterChange]
  );

  const handleLevelChange = useCallback(
    async (depth: number, value: string) => {
      if (!value) {
        // 현재 depth부터 하위 모두 초기화
        const newPath = selectedPath.slice(0, depth);
        setSelectedPath(newPath);
        setLevelOptions((prev) => prev.slice(0, depth + 1));
        setLoadingStates((prev) => prev.slice(0, depth));

        const keyword = newPath.filter(Boolean).join(">");
        onKeywordSearch(keyword || "");
        reportFilterChange(filterMode, newPath, keyword || "");
        return;
      }

      // 현재 depth 선택 + 하위 초기화
      const newPath = [...selectedPath.slice(0, depth), value];
      setSelectedPath(newPath);
      setLevelOptions((prev) => prev.slice(0, depth + 1));
      setLoadingStates((prev) => {
        const next = [...prev];
        next[depth] = true;
        return next;
      });

      const keyword = newPath.join(">");
      onKeywordSearch(keyword);
      reportFilterChange(filterMode, newPath, keyword);

      // 다음 depth 옵션 로드
      try {
        const catParams: Record<string, string> = {};
        if (lang !== "ko") catParams["lang"] = lang;
        const nonNullPath = newPath.filter((v): v is string => v !== null);
        for (let i = 0; i < nonNullPath.length; i++) {
          catParams[`cat${i + 1}`] = nonNullPath[i];
        }
        if (folder) catParams["folder"] = folder;
        if (userId) catParams["user_id"] = String(userId);
        const res = await fetchCategoryLevels(catParams as Parameters<typeof fetchCategoryLevels>[0], token, userId ?? undefined);
        const nextOpts = res.data.options;

        if (res.data.maxDepth) {
          setMaxDepth(res.data.maxDepth);
        }

        if (res.data.isLeaf) {
          onSelectLeafPath?.(nonNullPath, res.data.leafCategoryId);
        }

        setLevelOptions((prev) => {
          const next = [...prev];
          next[depth + 1] = nextOpts;
          return next;
        });
      } catch {
        // quietly ignore
      } finally {
        setLoadingStates((prev) => {
          const next = [...prev];
          next[depth] = false;
          return next;
        });
      }
    },
    [selectedPath, onKeywordSearch, filterMode, keywordText, reportFilterChange, token, onSelectLeafPath, lang, folder, userId]
  );

  // 초과 깊이 옵션 처리: CategoryLevelOption[]에서 categoryId 추출
  const handleLeafOptionClick = useCallback(
    (option: CategoryLevelOption) => {
      onSelectCategory(option.categoryId);
      const fullPath = [...selectedPath, option.label];
      const keyword = fullPath.join(">");
      onKeywordSearch(keyword);
      reportFilterChange("hierarchy", [...selectedPath, option.label], keyword);
    },
    [selectedPath, onSelectCategory, onKeywordSearch, reportFilterChange]
  );

  const handleKeywordSubmit = useCallback(() => {
    if (keywordText.trim()) {
      onKeywordSearch(keywordText.trim());
      reportFilterChange("search", selectedPath, keywordText.trim());
    }
  }, [keywordText, onKeywordSearch, selectedPath, reportFilterChange]);

  const handleKeywordClear = useCallback(() => {
    setKeywordText("");
    onKeywordSearch("");
    reportFilterChange("search", selectedPath, "");
  }, [onKeywordSearch, selectedPath, reportFilterChange]);

  const handleHierarchyReset = useCallback(() => {
    setSelectedPath([]);
    setLevelOptions((prev) => prev.slice(0, 1));
    setLoadingStates([]);
    setKeywordText("");
    onKeywordSearch("");
    reportFilterChange("hierarchy", [], "");
  }, [onKeywordSearch, reportFilterChange]);

  const handleLangChange = useCallback(
    async (newLang: string) => {
      if (newLang === lang) return;
      // 모든 드롭다운 초기화 (levelOptions는 유지 — 깜빡임 방지)
      setSelectedPath([]);
      setLoadingStates([]);
      setKeywordText("");
      onKeywordSearch("");
      // 부모 콜백: 언어 변경 + URL 파라미터를 한 번에 전달
      onLangChange?.(newLang, "hierarchy", [], "");
      // 새 언어로 최상위 옵션 재조회
      const params: Record<string, string> = {};
      if (newLang !== "ko") params["lang"] = newLang;
      if (folder) params["folder"] = folder;
      if (userId) params["user_id"] = String(userId);
      try {
        const res = await fetchCategoryLevels(Object.keys(params).length > 0 ? params : undefined, token, userId ?? undefined);
        setLevelOptions([res.data.options]);
        setMaxDepth(res.data.maxDepth);
      } catch {}
    },
    [lang, onLangChange, onKeywordSearch, token, folder, userId]
  );

  const switchToHierarchy = useCallback(() => {
    setFilterMode("hierarchy");
    const keyword = selectedPath.filter(Boolean).join(">");
    if (keyword) {
      onKeywordSearch(keyword);
    } else {
      onKeywordSearch("");
    }
    reportFilterChange("hierarchy", selectedPath, keywordText);
  }, [selectedPath, onKeywordSearch, keywordText, reportFilterChange]);

  const switchToSearch = useCallback(() => {
    setFilterMode("search");
    if (keywordText.trim()) {
      onKeywordSearch(keywordText.trim());
    } else {
      onKeywordSearch("");
    }
    reportFilterChange("search", selectedPath, keywordText);
  }, [keywordText, onKeywordSearch, selectedPath, reportFilterChange]);

  const hierarchyDirty = selectedPath.length > 0 && selectedPath.some((v) => v !== null);
  const hasOptions = levelOptions.length > 0 && levelOptions[0].length > 0;

  // maxDepth만큼 Select를 항상 노출 (상위 미선택 시 disabled 상태)
  const visibleLevels = maxDepth;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-sm">필터</h3>
        {hasOptions && (
          <div className="flex flex-wrap justify-end gap-1">
            <Button
              size="sm"
              variant="outline"
              className={getPillButtonClass(filterMode === "hierarchy")}
              onClick={switchToHierarchy}
              aria-pressed={filterMode === "hierarchy"}
            >
              분류선택
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={getPillButtonClass(filterMode === "search")}
              onClick={switchToSearch}
              aria-pressed={filterMode === "search"}
            >
              검색
            </Button>
          </div>
        )}
      </div>

      {!hasOptions && (
        <p className="text-xs text-muted-foreground">
          사용 가능한 카테고리가 없습니다
        </p>
      )}

      {hasOptions && (
        <>
          {filterMode === "hierarchy" ? (
            <div className="space-y-2">
              {/* 언어 선택 radio button */}
              <div className="flex flex-wrap justify-end gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className={getPillButtonClass(lang === "ko")}
                  onClick={() => handleLangChange("ko")}
                  aria-pressed={lang === "ko"}
                >
                  한국어
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={getPillButtonClass(lang === "en")}
                  onClick={() => handleLangChange("en")}
                  aria-pressed={lang === "en"}
                >
                  영어
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={getPillButtonClass(lang === "zh")}
                  onClick={() => handleLangChange("zh")}
                  aria-pressed={lang === "zh"}
                >
                  중국어
                </Button>
              </div>
              {Array.from({ length: visibleLevels }, (_, depth) => {
                const opts = levelOptions[depth] ?? [];
                const isLoading = loadingStates[depth] ?? false;
                const isDisabled = depth > 0 && !selectedPath[depth - 1];
                const isEmpty = !isLoading && opts.length === 0 && depth > 0 && !!selectedPath[depth - 1];

                // 초과 깊이 옵션 (CategoryLevelOption[])
                const isLeafOptions = depth > 0 && opts.length > 0 && typeof opts[0] === "object" && "categoryId" in opts[0];

                return (
                  <div key={depth} className="relative">
                    {isLeafOptions ? (
                      // 초과 깊이: 마지막 단계에서 하위 경로를 포함한 옵션 표시
                      <div className="space-y-1">
                        {(opts as CategoryLevelOption[]).map((opt) => (
                          <Button
                            key={opt.categoryId}
                            size="sm"
                            variant="outline"
                            className="w-full h-8 text-xs justify-start font-normal"
                            onClick={() => handleLeafOptionClick(opt)}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <Select
                        value={selectedPath[depth] ?? ""}
                        onValueChange={(value) => handleLevelChange(depth, value ?? "")}
                        disabled={isDisabled || isLoading || isEmpty}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={
                            isDisabled ? "상위 분류 선택 필요"
                            : isLoading ? "로딩 중..."
                            : isEmpty ? "하위 분류 없음"
                            : "카테고리 선택"
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">카테고리 선택</SelectItem>
                          {(opts as string[]).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {isLoading && (
                      <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                );
              })}

              <Button
                size="sm"
                variant="outline"
                onClick={handleHierarchyReset}
                disabled={!hierarchyDirty}
                className="w-full h-8 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                초기화
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="카테고리명 또는 코드 검색..."
                  value={keywordText}
                  onChange={(e) => setKeywordText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleKeywordSubmit();
                  }}
                  className="h-9 text-sm"
                />
                {keywordText && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleKeywordClear}
                    className="h-9 shrink-0"
                    aria-label="초기화"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleKeywordSubmit}
                  disabled={!keywordText.trim()}
                  className="h-9 shrink-0"
                  aria-label="검색"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
