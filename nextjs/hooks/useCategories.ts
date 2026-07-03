"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  getCategories,
  createCategory,
  deleteCategory as deleteCategoryApi,
  type Category,
  type PaginationMeta,
  type StepName,
} from "@/lib/api";

interface UseCategoriesReturn {
  categories: Category[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  loadCategories: (pageNumber?: number, pageSize?: number, ownerScope?: string, likeQuery?: string, folder?: string, userId?: number | null, steps?: StepName[], hierarchyLang?: string) => Promise<void>;
  addCategory: (categoryNameKo: string, categoryCode?: string, categoryNameEn?: string, categoryNameZh?: string, folder?: string, userId?: number) => Promise<void>;
  updateCategoryStatus: (id: number, updates: Partial<Category>) => void;
  deleteCategory: (id: number) => Promise<void>;
}

export function useCategories(
  token?: string | null,
  initialCategories?: Category[],
  initialMeta?: PaginationMeta | null,
): UseCategoriesReturn {
  const [categories, setCategories] = useState<Category[]>(initialCategories ?? []);
  const [meta, setMeta] = useState<PaginationMeta | null>(initialMeta ?? null);
  const [isLoading, setIsLoading] = useState(initialCategories ? false : !!token);
  const [isLoaded, setIsLoaded] = useState(!!initialCategories);
  const [error, setError] = useState<string | null>(null);
  const hadInitialData = useRef(!!initialCategories?.length);
  const loadedToken = useRef<string | null | undefined>(undefined);
  const currentPageNumber = useRef<number>(1);
  const currentPageSize = useRef<number>(20);
  const currentOwnerScope = useRef<string | undefined>(undefined);
  const currentLikeQuery = useRef<string | undefined>(undefined);
  const currentFolder = useRef<string | undefined>(undefined);
  const currentSteps = useRef<StepName[] | undefined>(undefined);

  const loadCategories = useCallback(async (pageNumber?: number, pageSize?: number, ownerScope?: string, likeQuery?: string, folder?: string, userId?: number | null, steps?: StepName[], hierarchyLang?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCategories(
        token,
        pageNumber ?? currentPageNumber.current,
        pageSize ?? currentPageSize.current,
        ownerScope ?? currentOwnerScope.current,
        likeQuery ?? currentLikeQuery.current,
        folder,
        userId,
        steps,
        hierarchyLang
      );
      setCategories(data.data);
      setMeta(data.meta);
      currentPageNumber.current = data.meta.current_page;
      currentPageSize.current = data.meta.per_page;
      currentOwnerScope.current = ownerScope;
      currentLikeQuery.current = likeQuery !== undefined ? likeQuery : currentLikeQuery.current;
      currentFolder.current = folder;
      currentSteps.current = steps;
      setIsLoaded(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "카테고리 목록을 불러오지 못했습니다"
      );
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // token 변경 시 상태 초기화 (SSR initial data 있으면 유지, 데이터 로드는 컴포넌트가 담당)
  useEffect(() => {
    if (loadedToken.current !== token) {
      loadedToken.current = token;
      if (!hadInitialData.current) {
        setCategories([]);
        setMeta(null);
        setIsLoaded(false);
      }
    }
  }, [token]);

  const addCategory = useCallback(
    async (categoryNameKo: string, categoryCode?: string, categoryNameEn?: string, categoryNameZh?: string, folder?: string, userId?: number) => {
      setIsLoading(true);
      setError(null);
      try {
        await createCategory(categoryNameKo, token, categoryCode, categoryNameEn, categoryNameZh, folder, userId);
        const data = await getCategories(
          token,
          currentPageNumber.current,
          currentPageSize.current,
          currentOwnerScope.current,
          currentLikeQuery.current,
          currentFolder.current,
          undefined,
          currentSteps.current
        );
        setCategories(data.data);
        setMeta(data.meta);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "카테고리 추가에 실패했습니다"
        );
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  const updateCategoryStatus = useCallback(
    (id: number, updates: Partial<Category>) => {
      setCategories((prev) =>
        prev.map((cat) => (cat.id === id ? { ...cat, ...updates } : cat))
      );
    },
    []
  );

  const deleteCategory = useCallback(
    async (id: number) => {
      setIsLoading(true);
      setError(null);
      try {
        await deleteCategoryApi(id, token);
        const data = await getCategories(
          token,
          currentPageNumber.current,
          currentPageSize.current,
          currentOwnerScope.current,
          currentLikeQuery.current,
          currentFolder.current,
          undefined,
          currentSteps.current
        );
        setCategories(data.data);
        setMeta(data.meta);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "카테고리 삭제에 실패했습니다"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  return { categories, meta, isLoading, isLoaded, error, loadCategories, addCategory, updateCategoryStatus, deleteCategory };
}
