"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseHierarchy } from "@/lib/category";
import type { Category } from "@/lib/api";

interface CategoryHierarchyProps {
  categories: Category[];
  categoriesLoaded: boolean;
  onLoadCategories: () => void;
  onSelectCategory: (categoryId: number) => void;
}

export default function CategoryHierarchy({
  categories,
  categoriesLoaded,
  onLoadCategories,
  onSelectCategory,
}: CategoryHierarchyProps) {
  const [selected대, setSelected대] = useState<string | null>(null);
  const [selected중, setSelected중] = useState<string | null>(null);

  const hierarchy = useMemo(
    () => (categoriesLoaded ? parseHierarchy(categories) : []),
    [categories, categoriesLoaded]
  );

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
    () =>
      hierarchy
        .filter(
          (h) =>
            (!selected대 || h.대 === selected대) &&
            (!selected중 || h.중 === selected중)
        )
        .map((h) => ({ 소: h.소, categoryId: h.categoryId, categoryCode: h.categoryCode })),
    [hierarchy, selected대, selected중]
  );

  return (
    <Card className="p-4">
      <h3 className="mb-3 font-medium text-sm">카테고리 계층 탐색</h3>
      {!categoriesLoaded && (
        <Button
          variant="outline"
          size="sm"
          onClick={onLoadCategories}
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
        <div className="space-y-3">
          <Select
            value={selected대 ?? ""}
            onValueChange={(v) => {
              setSelected대(v);
              setSelected중(null);
            }}
            disabled
          >
            <SelectTrigger>
              <SelectValue placeholder="대분류 선택" />
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
            onValueChange={setSelected중}
            disabled
          >
            <SelectTrigger>
              <SelectValue placeholder="중분류 선택" />
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
            value=""
            onValueChange={(v) => {
              const found = 소Options.find((o) => o.categoryCode === v);
              if (found) onSelectCategory(found.categoryId);
            }}
            disabled
          >
            <SelectTrigger>
              <SelectValue placeholder="소분류 선택" />
            </SelectTrigger>
            <SelectContent>
              {소Options.map((opt) => (
                <SelectItem key={opt.categoryCode} value={opt.categoryCode}>
                  {opt.소}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </Card>
  );
}
