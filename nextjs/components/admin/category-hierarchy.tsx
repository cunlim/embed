"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchCategoryLevels } from "@/lib/api";
import { Search, X, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HierarchyFilterState {
  대: string | null;
  중: string | null;
  소: string | null;
  세: string | null;
}

interface CategoryHierarchyProps {
  onSelectCategory: (categoryId: number) => void;
  onKeywordSearch: (keyword: string) => void;
  onSelectLeafPath?: (대: string, 중: string, 소: string, categoryId?: number | null) => void;
  /** URL 등 외부에서 초기값 주입 */
  initialMode?: "hierarchy" | "search";
  initialHierarchy?: HierarchyFilterState;
  initialKeyword?: string;
  /** SSR prefetch 데이터 */
  initial대Options: string[];
  initial중Options?: string[];
  initial소Options?: string[];
  initial세Options?: { 세: string; categoryId: number; categoryCode: string }[];
  /** 필터 상태 변경 시 호출 (URL 동기화용) */
  onFilterChange?: (state: {
    mode: "hierarchy" | "search";
    hierarchy: HierarchyFilterState;
    keyword: string;
  }) => void;
  /** 대Options 갱신 트리거 (카테고리 추가/삭제 시 증가) */
  refreshKey?: number;
  /** 인증 토큰 (refreshKey 기반 refetch에 필요) */
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
  initialHierarchy,
  initialKeyword = "",
  initial대Options,
  initial중Options = [],
  initial소Options = [],
  initial세Options = [],
  onFilterChange,
  onSelectLeafPath,
  refreshKey = 0,
  token,
}: CategoryHierarchyProps) {
  const [filterMode, setFilterMode] = useState<"hierarchy" | "search">(initialMode);
  const [selected대, setSelected대] = useState<string | null>(initialHierarchy?.대 ?? null);
  const [selected중, setSelected중] = useState<string | null>(initialHierarchy?.중 ?? null);
  const [selected소, setSelected소] = useState<string | null>(initialHierarchy?.소 ?? null);
  const [selected세, setSelected세] = useState<string | null>(initialHierarchy?.세 ?? null);
  const [keywordText, setKeywordText] = useState(initialKeyword);

  // 단계별 옵션 (SSR 초기값 + API 응답)
  const [대Options, set대Options] = useState<string[]>(initial대Options);
  const [중Options, set중Options] = useState<string[]>(initial중Options);
  const [소Options, set소Options] = useState<string[]>(initial소Options);
  const [세Options, set세Options] = useState<{ 세: string; categoryId: number; categoryCode: string }[]>(
    initial세Options
  );

  // 로딩 상태
  const [loading중, setLoading중] = useState(false);
  const [loading소, setLoading소] = useState(false);
  const [loading세, setLoading세] = useState(false);

  // refreshKey 변경 또는 token 최초 확보 시 대Options 다시 조회
  const prevTokenRef = useRef<string | null | undefined>(null);
  const hasRestoredRef = useRef(false);
  const hadInitial대 = useRef(initial대Options.length > 0);
  useEffect(() => {
    const tokenChanged = token !== prevTokenRef.current;
    prevTokenRef.current = token;
    const skipInitial = hadInitial대.current;
    hadInitial대.current = false;
    if (token && (refreshKey > 0 || (tokenChanged && !skipInitial))) {
      fetchCategoryLevels(undefined, token).then((res) => {
        set대Options(res.data.대 ?? []);
      }).catch(() => {
        // quietly ignore
      });
    }
  }, [refreshKey, token]);

  // 페이지 새로고침 시 초기 hierarchy 필터 복원
  useEffect(() => {
    if (hasRestoredRef.current) return;
    if (initialMode === "hierarchy" && initialHierarchy?.대) {
      hasRestoredRef.current = true;
      const { 대, 중, 소, 세 } = initialHierarchy;

      const keywordPath = 세
        ? `${대}>${중}>${소}>${세}`
        : 소
          ? `${대}>${중}>${소}`
          : 중
            ? `${대}>${중}`
            : 대!;
      onKeywordSearch(keywordPath);

      fetchCategoryLevels({ 대: 대! }, token ?? undefined).then((res) => {
        const 중List = res.data.중 ?? [];
        if (중List.length === 0) {
          onSelectLeafPath?.(대!, "", "", res.data.leafCategoryId ?? null);
        }
        set중Options(중List);
      }).catch(() => {});

      if (중) {
        fetchCategoryLevels({ 대: 대!, 중 }, token ?? undefined).then((res) => {
          const 소List = res.data.소 ?? [];
          set소Options(소List);
          if (소List.length === 0) {
            onSelectLeafPath?.(대!, 중, "", res.data.leafCategoryId ?? null);
          }
        }).catch(() => {});
      }

      if (소) {
        fetchCategoryLevels({ 대: 대!, 중: 중!, 소 }, token ?? undefined).then((res) => {
          const 세List = res.data.세 ?? [];
          set세Options(세List);
          if (세List.length === 0) {
            onSelectLeafPath?.(대!, 중!, 소, res.data.leafCategoryId ?? null);
          }
        }).catch(() => {});
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reportFilterChange = useCallback(
    (mode: "hierarchy" | "search", 대: string | null, 중: string | null, 소: string | null, 세: string | null, kw: string) => {
      onFilterChange?.({ mode, hierarchy: { 대, 중, 소, 세 }, keyword: kw });
    },
    [onFilterChange]
  );

  const handle대Change = useCallback(
    async (v: string) => {
      if (!v) {
        setSelected대(null);
        setSelected중(null);
        setSelected소(null);
        setSelected세(null);
        set중Options([]);
        set소Options([]);
        set세Options([]);
        onKeywordSearch("");
        reportFilterChange(filterMode, null, null, null, null, keywordText);
        return;
      }
      setSelected대(v);
      setSelected중(null);
      setSelected소(null);
      setSelected세(null);
      set중Options([]);
      set소Options([]);
      set세Options([]);

      onKeywordSearch(v);
      reportFilterChange(filterMode, v, null, null, null, keywordText);

      setLoading중(true);
      try {
        const res = await fetchCategoryLevels({ 대: v }, token);
        const 중List = res.data.중 ?? [];
        if (중List.length === 0) {
          onSelectLeafPath?.(v, "", "", res.data.leafCategoryId ?? null);
        }
        set중Options(중List);
      } catch {
        // quietly ignore
      } finally {
        setLoading중(false);
      }
    },
    [onKeywordSearch, filterMode, keywordText, reportFilterChange, token, onSelectLeafPath]
  );

  const handle중Change = useCallback(
    async (v: string) => {
      if (!v || !selected대) {
        setSelected중(null);
        setSelected소(null);
        setSelected세(null);
        set소Options([]);
        set세Options([]);
        if (selected대) {
          onKeywordSearch(selected대);
          reportFilterChange(filterMode, selected대, null, null, null, keywordText);
        } else {
          onKeywordSearch("");
          reportFilterChange(filterMode, null, null, null, null, keywordText);
        }
        return;
      }
      setSelected중(v);
      setSelected소(null);
      setSelected세(null);
      set소Options([]);
      set세Options([]);

      onKeywordSearch(selected대 + ">" + v);
      reportFilterChange(filterMode, selected대, v, null, null, keywordText);

      setLoading소(true);
      try {
        const res = await fetchCategoryLevels({ 대: selected대, 중: v }, token);
        const 소List = res.data.소 ?? [];
        if (소List.length === 0) {
          onSelectLeafPath?.(selected대, v, "", res.data.leafCategoryId ?? null);
        }
        set소Options(소List);
      } catch {
        // quietly ignore
      } finally {
        setLoading소(false);
      }
    },
    [selected대, onKeywordSearch, filterMode, keywordText, reportFilterChange, token, onSelectLeafPath]
  );

  const handle소Change = useCallback(
    async (v: string) => {
      if (!v || !selected대 || !selected중) {
        setSelected소(null);
        setSelected세(null);
        set세Options([]);
        if (selected대 && selected중) {
          onKeywordSearch(selected대 + ">" + selected중);
          reportFilterChange(filterMode, selected대, selected중, null, null, keywordText);
        } else if (selected대) {
          onKeywordSearch(selected대);
          reportFilterChange(filterMode, selected대, null, null, null, keywordText);
        } else {
          onKeywordSearch("");
          reportFilterChange(filterMode, null, null, null, null, keywordText);
        }
        return;
      }
      setSelected소(v);
      setSelected세(null);
      set세Options([]);

      onKeywordSearch(selected대 + ">" + selected중 + ">" + v);
      reportFilterChange(filterMode, selected대, selected중, v, null, keywordText);

      setLoading세(true);
      try {
        const res = await fetchCategoryLevels({ 대: selected대, 중: selected중, 소: v }, token);
        const 세List = res.data.세 ?? [];
        if (세List.length === 0) {
          onSelectLeafPath?.(selected대, selected중, v, res.data.leafCategoryId ?? null);
        }
        set세Options(세List);
      } catch {
        // quietly ignore
      } finally {
        setLoading세(false);
      }
    },
    [selected대, selected중, onKeywordSearch, filterMode, keywordText, reportFilterChange, token, onSelectLeafPath]
  );

  const handle세Change = useCallback(
    (v: string) => {
      if (!v || !selected대 || !selected중 || !selected소) return;
      const found = 세Options.find((o) => o.세 === v);
      if (!found) return;
      setSelected세(v);
      const keyword = selected대 + ">" + selected중 + ">" + selected소 + ">" + found.세;
      onKeywordSearch(keyword);
      reportFilterChange(filterMode, selected대, selected중, selected소, v, keywordText);
      onSelectCategory(found.categoryId);
    },
    [세Options, onSelectCategory, selected대, selected중, selected소, onKeywordSearch, filterMode, keywordText, reportFilterChange]
  );

  const handleKeywordSubmit = useCallback(() => {
    if (keywordText.trim()) {
      onKeywordSearch(keywordText.trim());
      reportFilterChange("search", selected대, selected중, selected소, selected세, keywordText.trim());
    }
  }, [keywordText, onKeywordSearch, selected대, selected중, selected소, selected세, reportFilterChange]);

  const handleKeywordClear = useCallback(() => {
    setKeywordText("");
    onKeywordSearch("");
    reportFilterChange("search", selected대, selected중, selected소, selected세, "");
  }, [onKeywordSearch, selected대, selected중, selected소, selected세, reportFilterChange]);

  const handleHierarchyReset = useCallback(() => {
    setSelected대(null);
    setSelected중(null);
    setSelected소(null);
    setSelected세(null);
    set중Options([]);
    set소Options([]);
    set세Options([]);
    setKeywordText("");
    onKeywordSearch("");
    reportFilterChange("hierarchy", null, null, null, null, "");
  }, [onKeywordSearch, reportFilterChange]);

  const switchToHierarchy = useCallback(() => {
    setFilterMode("hierarchy");
    if (selected대) {
      const keyword = selected세
        ? selected대 + ">" + selected중 + ">" + selected소 + ">" + selected세
        : selected소
          ? selected대 + ">" + selected중 + ">" + selected소
          : selected중
            ? selected대 + ">" + selected중
            : selected대;
      onKeywordSearch(keyword);
      reportFilterChange("hierarchy", selected대, selected중, selected소, selected세, keywordText);
    } else {
      onKeywordSearch("");
      reportFilterChange("hierarchy", null, null, null, null, keywordText);
    }
  }, [selected대, selected중, selected소, selected세, onKeywordSearch, keywordText, reportFilterChange]);

  const switchToSearch = useCallback(() => {
    setFilterMode("search");
    if (keywordText.trim()) {
      onKeywordSearch(keywordText.trim());
      reportFilterChange("search", selected대, selected중, selected소, selected세, keywordText);
    } else {
      onKeywordSearch("");
      reportFilterChange("search", selected대, selected중, selected소, selected세, "");
    }
  }, [keywordText, onKeywordSearch, selected대, selected중, selected소, selected세, reportFilterChange]);

  const hierarchyDirty = selected대 !== null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-sm">필터</h3>
        {initial대Options.length > 0 && (
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

      {initial대Options.length === 0 && (
        <p className="text-xs text-muted-foreground">
          사용 가능한 카테고리가 없습니다
        </p>
      )}

      {initial대Options.length > 0 && (
        <>
          {filterMode === "hierarchy" ? (
            <div className="space-y-2">
              {/* 대분류 */}
              <Select value={selected대 ?? ""} onValueChange={(value) => handle대Change(value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">카테고리 선택</SelectItem>
                  {대Options.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 중분류 */}
              <div className="relative">
                <Select
                  value={selected중 ?? ""}
                  onValueChange={(value) => handle중Change(value ?? "")}
                  disabled={!selected대 || loading중 || (중Options.length === 0 && !!selected대 && !loading중)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={
                      !selected대 ? "대분류 선택 필요" : loading중 ? "로딩 중..." : 중Options.length === 0 ? "중분류 없음" : "카테고리 선택"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">카테고리 선택</SelectItem>
                    {중Options.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {loading중 && (
                  <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* 소분류 */}
              <div className="relative">
                <Select
                  value={selected소 ?? ""}
                  onValueChange={(value) => handle소Change(value ?? "")}
                  disabled={!selected중 || loading소 || (소Options.length === 0 && !!selected중 && !loading소)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={
                      !selected중 ? "중분류 선택 필요" : loading소 ? "로딩 중..." : 소Options.length === 0 ? "소분류 없음" : "카테고리 선택"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">카테고리 선택</SelectItem>
                    {소Options.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {loading소 && (
                  <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* 세분류 */}
              <div className="relative">
                <Select
                  value={selected세 ?? ""}
                  onValueChange={(value) => handle세Change(value ?? "")}
                  disabled={!selected소 || loading세 || 세Options.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={
                      !selected소 ? "소분류 선택 필요" : loading세 ? "로딩 중..." : 세Options.length === 0 ? "세분류 없음" : "카테고리 선택"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">카테고리 선택</SelectItem>
                    {세Options.map((opt) => (
                      <SelectItem key={opt.categoryCode} value={opt.세}>{opt.세}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {loading세 && (
                  <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

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
