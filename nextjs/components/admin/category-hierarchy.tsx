"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchCategoryLevels } from "@/lib/api";
import { Search, X, RotateCcw, Loader2 } from "lucide-react";

export interface HierarchyFilterState {
  대: string | null;
  중: string | null;
  소: string | null;
}

interface CategoryHierarchyProps {
  onSelectCategory: (categoryId: number) => void;
  onKeywordSearch: (keyword: string) => void;
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
}: CategoryHierarchyProps) {
  const [filterMode, setFilterMode] = useState<"hierarchy" | "search">(initialMode);
  const [selected대, setSelected대] = useState<string | null>(initialHierarchy?.대 ?? null);
  const [selected중, setSelected중] = useState<string | null>(initialHierarchy?.중 ?? null);
  const [selected소, setSelected소] = useState<string | null>(initialHierarchy?.소 ?? null);
  const [keywordText, setKeywordText] = useState(initialKeyword);

  // 단계별 옵션 (SSR 초기값 + API 응답)
  const [대Options] = useState<string[]>(initial대Options);
  const [중Options, set중Options] = useState<string[]>(initial중Options);
  const [소Options, set소Options] = useState<string[]>(initial소Options);
  const [세Options, set세Options] = useState<{ 세: string; categoryId: number; categoryCode: string }[]>(
    initial세Options
  );

  // 로딩 상태
  const [loading중, setLoading중] = useState(false);
  const [loading소, setLoading소] = useState(false);
  const [loading세, setLoading세] = useState(false);

  const reportFilterChange = useCallback(
    (mode: "hierarchy" | "search", 대: string | null, 중: string | null, 소: string | null, kw: string) => {
      onFilterChange?.({ mode, hierarchy: { 대, 중, 소 }, keyword: kw });
    },
    [onFilterChange]
  );

  const handle대Change = useCallback(
    async (v: string) => {
      if (!v) return;
      setSelected대(v);
      setSelected중(null);
      setSelected소(null);
      set중Options([]);
      set소Options([]);
      set세Options([]);

      onKeywordSearch(v);
      reportFilterChange(filterMode, v, null, null, keywordText);

      setLoading중(true);
      try {
        const res = await fetchCategoryLevels({ 대: v });
        set중Options(res.data.중 ?? []);
      } catch {
        // quietly ignore
      } finally {
        setLoading중(false);
      }
    },
    [onKeywordSearch, filterMode, keywordText, reportFilterChange]
  );

  const handle중Change = useCallback(
    async (v: string) => {
      if (!v || !selected대) return;
      setSelected중(v);
      setSelected소(null);
      set소Options([]);
      set세Options([]);

      onKeywordSearch(selected대 + " > " + v);
      reportFilterChange(filterMode, selected대, v, null, keywordText);

      setLoading소(true);
      try {
        const res = await fetchCategoryLevels({ 대: selected대, 중: v });
        set소Options(res.data.소 ?? []);
      } catch {
        // quietly ignore
      } finally {
        setLoading소(false);
      }
    },
    [selected대, onKeywordSearch, filterMode, keywordText, reportFilterChange]
  );

  const handle소Change = useCallback(
    async (v: string) => {
      if (!v || !selected대 || !selected중) return;
      setSelected소(v);
      set세Options([]);

      onKeywordSearch(selected대 + " > " + selected중 + " > " + v);
      reportFilterChange(filterMode, selected대, selected중, v, keywordText);

      setLoading세(true);
      try {
        const res = await fetchCategoryLevels({ 대: selected대, 중: selected중, 소: v });
        set세Options(res.data.세 ?? []);
      } catch {
        // quietly ignore
      } finally {
        setLoading세(false);
      }
    },
    [selected대, selected중, onKeywordSearch, filterMode, keywordText, reportFilterChange]
  );

  const handle세Change = useCallback(
    (v: string) => {
      if (!v) return;
      const found = 세Options.find((o) => o.categoryCode === v);
      if (found) onSelectCategory(found.categoryId);
    },
    [세Options, onSelectCategory]
  );

  const handleKeywordSubmit = useCallback(() => {
    if (keywordText.trim()) {
      onKeywordSearch(keywordText.trim());
      reportFilterChange("search", selected대, selected중, selected소, keywordText.trim());
    }
  }, [keywordText, onKeywordSearch, selected대, selected중, selected소, reportFilterChange]);

  const handleKeywordClear = useCallback(() => {
    setKeywordText("");
    onKeywordSearch("");
    reportFilterChange("search", selected대, selected중, selected소, "");
  }, [onKeywordSearch, selected대, selected중, selected소, reportFilterChange]);

  const handleHierarchyReset = useCallback(() => {
    setSelected대(null);
    setSelected중(null);
    setSelected소(null);
    set중Options([]);
    set소Options([]);
    set세Options([]);
    onKeywordSearch("");
    reportFilterChange("hierarchy", null, null, null, keywordText);
  }, [onKeywordSearch, keywordText, reportFilterChange]);

  const switchToHierarchy = useCallback(() => {
    setFilterMode("hierarchy");
    if (selected대) {
      const keyword = selected소
        ? selected대 + " > " + selected중 + " > " + selected소
        : selected중
          ? selected대 + " > " + selected중
          : selected대;
      onKeywordSearch(keyword);
      reportFilterChange("hierarchy", selected대, selected중, selected소, keywordText);
    } else {
      onKeywordSearch("");
      reportFilterChange("hierarchy", null, null, null, keywordText);
    }
  }, [selected대, selected중, selected소, onKeywordSearch, keywordText, reportFilterChange]);

  const switchToSearch = useCallback(() => {
    setFilterMode("search");
    if (keywordText.trim()) {
      onKeywordSearch(keywordText.trim());
      reportFilterChange("search", selected대, selected중, selected소, keywordText);
    } else {
      onKeywordSearch("");
      reportFilterChange("search", selected대, selected중, selected소, "");
    }
  }, [keywordText, onKeywordSearch, selected대, selected중, selected소, reportFilterChange]);

  const hierarchyDirty = selected대 !== null;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-medium text-sm">필터</h3>
        {initial대Options.length > 0 && (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={filterMode === "hierarchy" ? "secondary" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={switchToHierarchy}
            >
              분류선택
            </Button>
            <Button
              size="sm"
              variant={filterMode === "search" ? "secondary" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={switchToSearch}
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
              <select
                value={selected대 ?? ""}
                onChange={(e) => handle대Change(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                <option value="">카테고리 선택</option>
                {대Options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>

              {selected대 && (
                <div className="relative">
                  <select
                    value={selected중 ?? ""}
                    onChange={(e) => handle중Change(e.target.value)}
                    disabled={loading중}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:opacity-50"
                  >
                    <option value="">
                      {loading중 ? "로딩 중..." : 중Options.length === 0 ? "중분류 없음" : "카테고리 선택"}
                    </option>
                    {중Options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {loading중 && (
                    <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              )}

              {selected중 && (
                <div className="relative">
                  <select
                    value={selected소 ?? ""}
                    onChange={(e) => handle소Change(e.target.value)}
                    disabled={loading소}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:opacity-50"
                  >
                    <option value="">
                      {loading소 ? "로딩 중..." : 소Options.length === 0 ? "소분류 없음" : "카테고리 선택"}
                    </option>
                    {소Options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {loading소 && (
                    <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              )}

              {selected소 && (
                <div className="relative">
                  <select
                    value=""
                    onChange={(e) => handle세Change(e.target.value)}
                    disabled={loading세 || 세Options.length === 0}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:opacity-50"
                  >
                    <option value="">
                      {loading세 ? "로딩 중..." : 세Options.length === 0 ? "세분류 없음" : "카테고리 선택"}
                    </option>
                    {세Options.map((opt) => (
                      <option key={opt.categoryCode} value={opt.categoryCode}>{opt.세}</option>
                    ))}
                  </select>
                  {loading세 && (
                    <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              )}

              {hierarchyDirty && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleHierarchyReset}
                  className="w-full h-8 text-xs"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  초기화
                </Button>
              )}
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
                  variant="secondary"
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
