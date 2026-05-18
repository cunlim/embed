"use client";

import { useRef, useCallback, useReducer } from "react";
import type { StepName, CategoryTranslations } from "@/lib/api";

export interface CatExecState {
  runningSteps: Set<StepName>;
  pendingSteps: StepName[];
  completedSteps: Set<StepName>;
  failedSteps: Set<StepName>;
  stepResults: Map<StepName, string>;
  copyableSteps: Set<StepName>;
  embeddingFullData: Map<StepName, string>;
  flashSteps: Set<StepName>;
  abortRef: { current: boolean };
  actionError: string | null;
}

export interface UseCategoryExecutionReturn {
  getState: (catId: number) => CatExecState;
  handleSingleAction: (
    catId: number,
    stepName: StepName,
    onListRefresh?: () => void,
    onUpdateData?: (data: CategoryTranslations) => void,
  ) => Promise<void>;
  handleRunAll: (
    catId: number,
    data: CategoryTranslations,
    onListRefresh?: () => void,
    onUpdateData?: (data: CategoryTranslations) => void,
  ) => Promise<void>;
  handleCancelPending: (catId: number) => void;
}

function createInitialState(): CatExecState {
  return {
    runningSteps: new Set(),
    pendingSteps: [],
    completedSteps: new Set(),
    failedSteps: new Set(),
    stepResults: new Map(),
    copyableSteps: new Set(),
    embeddingFullData: new Map(),
    flashSteps: new Set(),
    abortRef: { current: false },
    actionError: null,
  };
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useCategoryExecution(
  token: string | null,
): UseCategoryExecutionReturn {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const stateMapRef = useRef<Map<number, CatExecState>>(new Map());

  const getState = useCallback((catId: number): CatExecState => {
    if (!stateMapRef.current.has(catId)) {
      stateMapRef.current.set(catId, createInitialState());
    }
    return stateMapRef.current.get(catId)!;
  }, []);

  const handleSingleAction = useCallback(
    async (catId: number, stepName: StepName, onListRefresh?: () => void, onUpdateData?: (data: CategoryTranslations) => void) => {
      const state = getState(catId);
      state.runningSteps = new Set(state.runningSteps).add(stepName);
      state.completedSteps.delete(stepName);
      state.failedSteps.delete(stepName);
      state.actionError = null;
      forceUpdate();

      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "https://embed.cunlim.dev/api";
        const res = await fetch(
          `${apiUrl}/categories/${catId}/run-step`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ step: stepName }),
          },
        );
        const result = await res.json();

        if (result.status === "completed") {
          state.completedSteps = new Set(state.completedSteps).add(stepName);
          state.stepResults = new Map(state.stepResults).set(
            stepName,
            result.result,
          );
          state.copyableSteps = new Set(state.copyableSteps);

          delayMs(2000).then(() => {
            state.copyableSteps.add(stepName);
            forceUpdate();
          });

          if (result.translations && onUpdateData) {
            onUpdateData(result.translations);
          }

          onListRefresh?.();
        } else {
          throw new Error(result.error || "실행 실패");
        }
      } catch (err) {
        state.failedSteps = new Set(state.failedSteps).add(stepName);
        state.actionError =
          err instanceof Error ? err.message : "실행 실패";
      } finally {
        const next = new Set(state.runningSteps);
        next.delete(stepName);
        state.runningSteps = next;
        forceUpdate();
      }
    },
    [token, getState],
  );

  const handleRunAll = useCallback(
    async (
      catId: number,
      data: CategoryTranslations,
      onListRefresh?: () => void,
      onUpdateData?: (data: CategoryTranslations) => void,
    ) => {
      const state = getState(catId);
      state.actionError = null;

      const LANGUAGES: {
        key: "ko" | "en" | "zh";
        hasTranslation: boolean;
      }[] = [
        { key: "ko", hasTranslation: false },
        { key: "en", hasTranslation: true },
        { key: "zh", hasTranslation: true },
      ];

      const steps: StepName[] = [];
      for (const lang of LANGUAGES) {
        if (lang.hasTranslation) {
          const tl = data.languages[lang.key];
          const transKey = `translation.${lang.key}` as StepName;
          const embedKey = `embedding.${lang.key}` as StepName;
          if (
            !tl.translation_text &&
            !state.completedSteps.has(transKey) &&
            !state.stepResults.has(transKey)
          ) {
            steps.push(transKey);
          }
          if (
            tl.embedding.status !== "completed" &&
            !state.completedSteps.has(embedKey) &&
            !state.stepResults.has(embedKey)
          ) {
            steps.push(embedKey);
          }
        } else {
          const embedKey = `embedding.${lang.key}` as StepName;
          if (
            data.languages[lang.key].embedding.status !== "completed" &&
            !state.completedSteps.has(embedKey) &&
            !state.stepResults.has(embedKey)
          ) {
            steps.push(embedKey);
          }
        }
      }

      if (steps.length === 0) return;

      state.abortRef.current = false;
      state.runningSteps = new Set([steps[0]]);
      state.pendingSteps = steps.slice(1);
      forceUpdate();

      for (let i = 0; i < steps.length; i++) {
        if (state.abortRef.current) {
          state.runningSteps = new Set();
          state.pendingSteps = [];
          forceUpdate();
          break;
        }

        const stepName = steps[i];
        try {
          const apiUrl =
            process.env.NEXT_PUBLIC_API_URL || "https://embed.cunlim.dev/api";
          const res = await fetch(
            `${apiUrl}/categories/${catId}/run-step`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ step: stepName }),
            },
          );
          const result = await res.json();

          if (result.status === "completed") {
            state.completedSteps = new Set(state.completedSteps).add(stepName);
            state.stepResults = new Map(state.stepResults).set(
              stepName,
              result.result,
            );
            state.copyableSteps = new Set(state.copyableSteps);

            delayMs(2000).then(() => {
              state.copyableSteps.add(stepName);
              forceUpdate();
            });

            if (result.translations && onUpdateData) {
              onUpdateData(result.translations);
            }

            onListRefresh?.();
          } else {
            throw new Error(result.error || "실행 실패");
          }

          if (state.abortRef.current) {
            state.runningSteps = new Set();
            state.pendingSteps = [];
            forceUpdate();
            break;
          }

          const nextIndex = i + 1;
          if (nextIndex < steps.length) {
            state.runningSteps = new Set([steps[nextIndex]]);
            state.pendingSteps = steps.slice(nextIndex + 1);
          } else {
            state.runningSteps = new Set();
            state.pendingSteps = [];
          }
          forceUpdate();
        } catch (err) {
          if (state.abortRef.current) {
            state.runningSteps = new Set();
            state.pendingSteps = [];
            forceUpdate();
            break;
          }
          state.failedSteps = new Set(state.failedSteps).add(stepName);
          state.actionError =
            err instanceof Error ? err.message : "실행 실패";
          state.runningSteps = new Set();
          state.pendingSteps = [];
          forceUpdate();
          break;
        }
      }
    },
    [token, getState],
  );

  const handleCancelPending = useCallback(
    (catId: number) => {
      const state = getState(catId);
      state.abortRef.current = true;
      state.pendingSteps = [];
      forceUpdate();
    },
    [getState],
  );

  return {
    getState,
    handleSingleAction,
    handleRunAll,
    handleCancelPending,
  };
}
