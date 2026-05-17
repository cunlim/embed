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
  /** WebSocket 구독 + API 호출 (기존 호환) */
  startTranslation: (categoryId: number, token?: string | null, steps?: string[]) => Promise<void>;
  /** WebSocket 구독만 먼저 수행 */
  subscribeProgress: (categoryId: number) => void;
  cancel: () => void;
}

export function useCategoryProgress(): UseCategoryProgressReturn {
  const echo = useEcho();
  const [progress, setProgress] = useState<CategoryProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const channelRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const categoryIdRef = useRef<number | null>(null);

  const subscribeProgress = useCallback(
    (categoryId: number) => {
      if (!echo) {
        console.warn("Echo 연결이 없습니다.");
        return;
      }

      setIsRunning(true);
      categoryIdRef.current = categoryId;

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

  const startTranslation = useCallback(
    async (categoryId: number, token?: string | null, steps?: string[]) => {
      if (!echo) {
        console.warn("Echo 연결이 없습니다.");
        return;
      }

      tokenRef.current = token ?? null;

      // 아직 구독 안 되어 있으면 WebSocket 구독 먼저
      if (categoryIdRef.current !== categoryId) {
        subscribeProgress(categoryId);
      }

      try {
        await translateEmbedCategory(categoryId, token, steps);
      } catch (err) {
        console.error("API 호출 실패:", err);
        setIsRunning(false);
        if (channelRef.current) {
          echo.leaveChannel(channelRef.current);
        }
      }
    },
    [echo, subscribeProgress],
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

  return { progress, isRunning, startTranslation, subscribeProgress, cancel };
}
