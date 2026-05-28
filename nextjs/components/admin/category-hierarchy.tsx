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
  token?: string | null;
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
  token,
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
      fetchCategoryLevels(undefined, token).then((res) => {
        const opts = res.data.options;
        setLevelOptions([opts]);
        setMaxDepth(res.data.maxDepth);
      }).catch(() => {});
    }
  }, [refreshKey, token]);

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
        for (let j = 0; j <= i; j++) {
          catParams[`cat${j + 1}`] = path[j];
        }
        fetchCategoryLevels(catParams as Parameters<typeof fetchCategoryLevels>[0], token ?? undefined).then((res) => {
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
        reportFilterChange(filterMode, newPath, keywordText);
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
      reportFilterChange(filterMode, newPath, keywordText);

      // 다음 depth 옵션 로드
      try {
        const catParams: Record<string, string> = {};
        const nonNullPath = newPath.filter((v): v is string => v !== null);
        for (let i = 0; i < nonNullPath.length; i++) {
          catParams[`cat${i + 1}`] = nonNullPath[i];
        }
        const res = await fetchCategoryLevels(catParams as Parameters<typeof fetchCategoryLevels>[0], token);
        const nextOpts = res.data.options;

        if (res.data.maxDepth) {
          setMaxDepth(res.data.maxDepth);
        }

        if (res.data.isLeaf) {
          onSelectLeafPath?.(nonNullPath, res.data.leafCategoryId);
          // 리프이면 categoryId로 onSelectCategory 호출
          if (res.data.leafCategoryId) {
            onSelectCategory(res.data.leafCategoryId);
          }
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
    [selectedPath, onKeywordSearch, filterMode, keywordText, reportFilterChange, token, onSelectLeafPath, onSelectCategory]
  );

  // 초과 깊이 옵션 처리: CategoryLevelOption[]에서 categoryId 추출
  const handleLeafOptionClick = useCallback(
    (option: CategoryLevelOption) => {
      onSelectCategory(option.categoryId);
      const fullPath = [...selectedPath, option.label];
      onKeywordSearch(fullPath.join(">"));
    },
    [selectedPath, onSelectCategory, onKeywordSearch]
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

  // 현재 depth에서 표시할 Select 개수: maxDepth 또는 현재 선택된 경로 길이 + 1 중 큰 값
  const visibleLevels = Math.min(maxDepth, Math.max(selectedPath.length + 1, levelOptions.length));

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
                  placeholder="카테고리명 검색..."
                  value={keywordText}
                  onChange={(e) => setKeywordText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleKeywordSubmit();
                  }}
                  className="h-9 text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleKeywordSubmit}
                  disabled={!keywordText.trim()}
                  className="h-9 shrink-0"
                  aria-label="검색"
                >
                  <Search className="h-4 w-4" />
                </Button>
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
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
