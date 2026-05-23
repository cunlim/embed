"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategoryHierarchy } from "@/hooks/useCategoryHierarchy";
import { Search, X } from "lucide-react";

interface CategoryHierarchyProps {
  onSelectCategory: (categoryId: number) => void;
  onKeywordSearch: (keyword: string) => void;
}

export default function CategoryHierarchy({
  onSelectCategory,
  onKeywordSearch,
}: CategoryHierarchyProps) {
  const { hierarchyCategories: hierarchy, hierarchyLoaded: categoriesLoaded, loadHierarchyCategories } = useCategoryHierarchy();
  const [filterMode, setFilterMode] = useState<"hierarchy" | "search">("hierarchy");
  const [selected대, setSelected대] = useState<string | null>(null);
  const [selected중, setSelected중] = useState<string | null>(null);
  const [selected소, setSelected소] = useState<string | null>(null);
  const [keywordText, setKeywordText] = useState("");

  const 대Options = useMemo(
    () => [...new Set(hierarchy.map((h) => h.대))],
    [hierarchy]
  );

  const 중Options = useMemo(
    () => [
      ...new Set(
        hierarchy
          .filter((h) => !selected대 || h.대 === selected대)
          .map((h) => h.중)
      ),
    ],
    [hierarchy, selected대]
  );

  const 소Options = useMemo(
    () => [
      ...new Set(
        hierarchy
          .filter((h) => (!selected대 || h.대 === selected대) && (!selected중 || h.중 === selected중))
          .map((h) => h.소)
      ),
    ],
    [hierarchy, selected대, selected중]
  );

  const 세Options = useMemo(
    () =>
      hierarchy
        .filter(
          (h) =>
            (!selected대 || h.대 === selected대) &&
            (!selected중 || h.중 === selected중) &&
            (!selected소 || h.소 === selected소)
        )
        .map((h) => ({ 세: h.세, categoryId: h.categoryId, categoryCode: h.categoryCode })),
    [hierarchy, selected대, selected중, selected소]
  );

  const handle대Change = useCallback((v: string | null) => {
    if (!v) return;
    setSelected대(v);
    setSelected중(null);
    setSelected소(null);
    onKeywordSearch(v);
  }, [onKeywordSearch]);

  const handle중Change = useCallback((v: string | null) => {
    if (!v) return;
    setSelected중(v);
    setSelected소(null);
    if (selected대) {
      onKeywordSearch(selected대 + ">" + v);
    }
  }, [selected대, onKeywordSearch]);

  const handle소Change = useCallback((v: string | null) => {
    if (!v) return;
    setSelected소(v);
    if (selected대 && selected중) {
      onKeywordSearch(selected대 + ">" + selected중 + ">" + v);
    }
  }, [selected대, selected중, onKeywordSearch]);

  const handle세Change = useCallback((v: string | null) => {
    if (!v) return;
    const found = 세Options.find((o) => o.categoryCode === v);
    if (found) onSelectCategory(found.categoryId);
  }, [세Options, onSelectCategory]);

  const handleKeywordSubmit = useCallback(() => {
    if (keywordText.trim()) {
      onKeywordSearch(keywordText.trim());
    }
  }, [keywordText, onKeywordSearch]);

  const switchToHierarchy = useCallback(() => {
    setFilterMode("hierarchy");
    onKeywordSearch("");
  }, [onKeywordSearch]);

  const switchToSearch = useCallback(() => {
    setFilterMode("search");
    onKeywordSearch("");
  }, [onKeywordSearch]);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-medium text-sm">필터</h3>
        {categoriesLoaded && hierarchy.length > 0 && (
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

      {!categoriesLoaded && (
        <Button
          variant="outline"
          size="sm"
          onClick={loadHierarchyCategories}
          className="w-full"
        >
          카테고리 목록 불러오기
        </Button>
      )}

      {categoriesLoaded && hierarchy.length === 0 && (
        <p className="text-xs text-muted-foreground">
          사용 가능한 카테고리가 없습니다
        </p>
      )}

      {categoriesLoaded && hierarchy.length > 0 && (
        <>
          {filterMode === "hierarchy" ? (
            <div className="space-y-3">
              <Select
                value={selected대 ?? ""}
                onValueChange={handle대Change}
              >
                <SelectTrigger>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {대Options.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selected중 ?? ""}
                onValueChange={handle중Change}
                disabled={!selected대 || 중Options.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!selected대 ? "대분류 먼저 선택" : 중Options.length === 0 ? "중분류 없음" : "카테고리 선택"} />
                </SelectTrigger>
                <SelectContent>
                  {중Options.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selected소 ?? ""}
                onValueChange={handle소Change}
                disabled={!selected중 || 소Options.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!selected중 ? "중분류 먼저 선택" : 소Options.length === 0 ? "소분류 없음" : "카테고리 선택"} />
                </SelectTrigger>
                <SelectContent>
                  {소Options.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value=""
                onValueChange={handle세Change}
                disabled={!selected소 || 세Options.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!selected소 ? "소분류 먼저 선택" : 세Options.length === 0 ? "세분류 없음" : "카테고리 선택"} />
                </SelectTrigger>
                <SelectContent>
                  {세Options.map((opt) => (
                    <SelectItem key={opt.categoryCode} value={opt.categoryCode}>
                      {opt.세}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
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
                  onClick={() => {
                    setKeywordText("");
                    onKeywordSearch("");
                  }}
                  className="h-9 shrink-0"
                  aria-label="초기화"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
