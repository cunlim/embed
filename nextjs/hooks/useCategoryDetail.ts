"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { CategoryTranslations } from "@/lib/api";
import { fetchCategoryTranslations } from "@/lib/api";

export function useCategoryDetail(categoryId: number | null, token?: string | null) {
  const [data, setData] = useState<CategoryTranslations | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedId = useRef<number | null>(undefined);

  const load = useCallback(async () => {
    if (categoryId === null) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchCategoryTranslations(categoryId, token);
      setData(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, [categoryId, token]);

  // mount 시 자동 로드, categoryId 변경 시 재로드
  useEffect(() => {
    if (loadedId.current !== categoryId) {
      loadedId.current = categoryId;
      load();
    }
  }, [categoryId, load]);

  return { data, isLoading, error, reload: load, setData };
}
