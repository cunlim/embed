"use client";

import { useState, useCallback } from "react";
import {
  getCategories,
  createCategory,
  type Category,
} from "@/lib/api";

interface UseCategoriesReturn {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  loadCategories: () => Promise<void>;
  addCategory: (categoryNameKo: string) => Promise<void>;
}

export function useCategories(token?: string | null): UseCategoriesReturn {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCategories(token);
      setCategories(data.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "카테고리 목록을 불러오지 못했습니다"
      );
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const addCategory = useCallback(
    async (categoryNameKo: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await createCategory(categoryNameKo, token);
        const data = await getCategories(token);
        setCategories(data.data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "카테고리 추가에 실패했습니다"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  return { categories, isLoading, error, loadCategories, addCategory };
}
