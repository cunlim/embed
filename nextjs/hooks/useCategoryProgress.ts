"use client";

import { useState, useCallback, useRef } from "react";
import { useEcho } from "@/hooks/useEcho";
import {
  translateEmbedCategory,
  cancelTranslateEmbed,
} from "@/lib/api";

export interface CategoryProgress {
  categoryId: number;
  step: number;
  stepName: StepName;
  status: StepStatus;
  error?: string;
}

export type StepName =
  | "translation.zh"
  | "translation.en"
  | "embedding.ko"
  | "embedding.zh"
  | "embedding.en";

export type StepStatus = "pending" | "running" | "completed" | "failed";

export interface CategoryPipelineCompleted {
  categoryId: number;
  allSuccess: boolean;
  failedStep: number;
}

export interface UseCategoryProgressReturn {
  progress: CategoryProgress | null;
  isRunning: boolean;
  startTranslation: (categoryId: number, token?: string | null) => Promise<void>;
  cancel: () => void;
}

export function useCategoryProgress(): UseCategoryProgressReturn {
  const echo = useEcho();
  const [progress, setProgress] = useState<CategoryProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const channelRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const categoryIdRef = useRef<number | null>(null);

  const startTranslation = useCallback(
    async (categoryId: number, token?: string | null) => {
      if (!echo) {
        console.warn("Echo 연결이 없습니다.");
        return;
      }

      setIsRunning(true);
      tokenRef.current = token ?? null;
      categoryIdRef.current = categoryId;

      try {
        await translateEmbedCategory(categoryId, token);
      } catch (err) {
        console.error("API 호출 실패:", err);
        setIsRunning(false);
        return;
      }

      const channelName = `category.${categoryId}`;
      channelRef.current = channelName;

      const channel = echo.channel(channelName);
      channel.listen(".category.progress", (data: CategoryProgress) => {
        setProgress(data);
      });
      channel.listen(".category.completed", (_data: CategoryPipelineCompleted) => {
        setIsRunning(false);
      });
    },
    [echo],
  );

  const cancel = useCallback(() => {
    const channelName = channelRef.current;
    const categoryId = categoryIdRef.current;

    if (channelName && echo) {
      echo.leaveChannel(channelName);
    }

    if (categoryId !== null) {
      cancelTranslateEmbed(categoryId, tokenRef.current).catch((err) => {
        console.error("Cancel API 호출 실패:", err);
      });
    }

    channelRef.current = null;
    categoryIdRef.current = null;
    tokenRef.current = null;
    setProgress(null);
    setIsRunning(false);
  }, [echo]);

  return { progress, isRunning, startTranslation, cancel };
}
