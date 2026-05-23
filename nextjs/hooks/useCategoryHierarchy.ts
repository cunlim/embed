"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { fetchCategoryLevels, type HierarchyLevelItem } from "@/lib/api";

interface UseCategoryHierarchyReturn {
  hierarchyCategories: HierarchyLevelItem[];
  hierarchyLoaded: boolean;
  loadHierarchyCategories: () => void;
}

export function useCategoryHierarchy(): UseCategoryHierarchyReturn {
  const [hierarchyCategories, setHierarchyCategories] = useState<HierarchyLevelItem[]>([]);
  const [hierarchyLoaded, setHierarchyLoaded] = useState(false);
  const loadedRef = useRef(false);

  const loadHierarchyCategories = useCallback(async () => {
    try {
      const res = await fetchCategoryLevels();
      setHierarchyCategories(res.data as unknown as HierarchyLevelItem[]);
      setHierarchyLoaded(true);
      loadedRef.current = true;
    } catch {
      // 계층 데이터 로드 실패 시 조용히 무시
    }
  }, []);

  // mount 시 자동으로 한 번만 로드
  useEffect(() => {
    if (!loadedRef.current) {
      loadHierarchyCategories();
    }
  }, [loadHierarchyCategories]);

  return { hierarchyCategories, hierarchyLoaded, loadHierarchyCategories };
}
