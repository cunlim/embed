"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
  activeStep: StepName | null;
  startTranslation: (categoryId: number, token?: string | null, steps?: string[]) => Promise<void>;
  subscribeProgress: (categoryId: number) => void;
  cancel: () => void;
}

export function useCategoryProgress(
  onUpdate?: (progress?: CategoryProgress) => void,
): UseCategoryProgressReturn {
  const echo = useEcho();
  const [progress, setProgress] = useState<CategoryProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeStep, setActiveStep] = useState<StepName | null>(null);
  const channelRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const categoryIdRef = useRef<number | null>(null);
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });

  const subscribeProgress = useCallback(
    (categoryId: number) => {
      setIsRunning(true);
      categoryIdRef.current = categoryId;

      if (!echo) {
        console.warn("Echo 연결이 없습니다. WebSocket 진행 상황을 수신할 수 없습니다.");
        return;
      }

      const channelName = `category.${categoryId}`;
      channelRef.current = channelName;

      const channel = echo.channel(channelName);
      channel.listen(".category.progress", (data: CategoryProgress) => {
        setProgress(data);
        setActiveStep(data.stepName);
        if (data.status === "completed" || data.status === "failed") {
          onUpdateRef.current?.(data);
        }
      });
      channel.listen(".category.completed", () => {
        setIsRunning(false);
        setActiveStep(null);
        onUpdateRef.current?.();
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

      if (categoryIdRef.current !== categoryId) {
        subscribeProgress(categoryId);
      }

      try {
        await translateEmbedCategory(categoryId, token, steps);
      } catch (err) {
        console.error("API 호출 실패:", err);
        setIsRunning(false);
        setActiveStep(null);
        if (channelRef.current) {
          echo.leaveChannel(channelRef.current);
        }
        throw err;
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
    setActiveStep(null);
  }, [echo]);

  return { progress, isRunning, activeStep, startTranslation, subscribeProgress, cancel };
}
