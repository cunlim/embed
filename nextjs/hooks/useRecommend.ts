"use client";

import { useState, useCallback } from "react";
import { recommend, type Recommendation } from "@/lib/api";

interface UseRecommendReturn {
  recommend: (text: string, targetLanguage: string) => Promise<void>;
  results: Recommendation[];
  isLoading: boolean;
  error: string | null;
}

export function useRecommend(): UseRecommendReturn {
  const [results, setResults] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doRecommend = useCallback(
    async (text: string, targetLanguage: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await recommend(text, targetLanguage);
        setResults(data.recommendations);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "추천 요청에 실패했습니다";
        setError(message);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { recommend: doRecommend, results, isLoading, error };
}
