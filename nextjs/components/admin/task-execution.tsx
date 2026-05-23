"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Square } from "lucide-react";
import {
  runStep,
  getCategories,
  fetchCategoryTranslations,
} from "@/lib/api";
import type { Category, Recommendation, CategoryTranslations, StepName } from "@/lib/api";

interface TaskExecutionProps {
  token: string | null;
  selectedIds: Set<number>;
  categories: (Category | Recommendation)[];
  filter: string | undefined;
  canModify: (cat: Category | Recommendation) => boolean;
  onComplete: () => void;
}

interface BatchProgress {
  totalCategories: number;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  currentCategory: string;
  currentStep: string;
}

interface StepJob {
  categoryId: number;
  categoryName: string;
  stepName: StepName;
}

function determineMissingSteps(data: CategoryTranslations): StepName[] {
  const steps: StepName[] = [];

  // en: 번역 + 임베딩
  if (!data.languages.en.translation_text) steps.push("translation.en");
  if (data.languages.en.embedding.status !== "completed") steps.push("embedding.en");

  // zh: 번역 + 임베딩
  if (!data.languages.zh.translation_text) steps.push("translation.zh");
  if (data.languages.zh.embedding.status !== "completed") steps.push("embedding.zh");

  // ko: 임베딩만 (원본 언어)
  if (data.languages.ko.embedding.status !== "completed") steps.push("embedding.ko");

  return steps;
}

export default function TaskExecution({
  token,
  selectedIds,
  categories,
  filter,
  canModify,
  onComplete,
}: TaskExecutionProps) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const executeQueue = useCallback(
    async (targetCategoryIds: number[]) => {
      setRunning(true);
      setError(null);
      abortRef.current = false;

      // Phase 1: 카테고리별 누락 step 수집
      setProgress({
        totalCategories: targetCategoryIds.length,
        totalSteps: 0,
        completedSteps: 0,
        failedSteps: 0,
        currentCategory: "준비 중...",
        currentStep: "",
      });

      const queue: StepJob[] = [];
      for (const id of targetCategoryIds) {
        if (abortRef.current) break;
        try {
          const res = await fetchCategoryTranslations(id, token);
          const missing = determineMissingSteps(res.data);
          for (const step of missing) {
            queue.push({
              categoryId: id,
              categoryName: res.data.category_name_ko,
              stepName: step,
            });
          }
        } catch {
          // 조회 실패한 카테고리는 건너뜀
        }
      }

      if (abortRef.current) {
        setRunning(false);
        setProgress(null);
        return;
      }

      if (queue.length === 0) {
        setRunning(false);
        setProgress(null);
        return;
      }

      setProgress({
        totalCategories: targetCategoryIds.length,
        totalSteps: queue.length,
        completedSteps: 0,
        failedSteps: 0,
        currentCategory: "",
        currentStep: "",
      });

      // Phase 2: step 순차 실행
      for (const job of queue) {
        if (abortRef.current) break;

        setProgress((p) =>
          p
            ? { ...p, currentCategory: job.categoryName, currentStep: job.stepName }
            : p,
        );

        try {
          const result = await runStep(job.categoryId, job.stepName, token);
          if (result.status === "completed") {
            setProgress((p) =>
              p ? { ...p, completedSteps: p.completedSteps + 1 } : p,
            );
          } else {
            setProgress((p) =>
              p ? { ...p, failedSteps: p.failedSteps + 1 } : p,
            );
          }
        } catch {
          setProgress((p) =>
            p ? { ...p, failedSteps: p.failedSteps + 1 } : p,
          );
        }
      }

      setRunning(false);
      onComplete();
    },
    [token, onComplete],
  );

  const handleSelectedProcess = useCallback(async () => {
    if (!token) {
      alert("로그인이 필요합니다");
      return;
    }
    const targetIds = Array.from(selectedIds).filter((id) => {
      const cat = categories.find((c) => c.id === id);
      return cat && canModify(cat);
    });
    if (targetIds.length === 0) {
      alert("선택된 수정 가능한 카테고리가 없습니다");
      return;
    }
    await executeQueue(targetIds);
  }, [token, selectedIds, categories, canModify, executeQueue]);

  const handleFullProcess = useCallback(async () => {
    if (!token) {
      alert("로그인이 필요합니다");
      return;
    }
    try {
      const res = await getCategories(token, 1, 10000, filter);
      const targetIds = res.data
        .filter((cat) => canModify(cat))
        .map((cat) => cat.id);
      if (targetIds.length === 0) {
        alert("처리 가능한 카테고리가 없습니다");
        return;
      }
      await executeQueue(targetIds);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "카테고리 목록 조회 실패",
      );
    }
  }, [token, filter, canModify, executeQueue]);

  const handleStop = useCallback(() => {
    abortRef.current = true;
  }, []);

  const pct =
    progress && progress.totalSteps > 0
      ? Math.round((progress.completedSteps / progress.totalSteps) * 100)
      : 0;

  return (
    <Card className="p-4">
      <h3 className="mb-3 font-medium text-sm">작업 실행</h3>
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button
            onClick={handleSelectedProcess}
            disabled={running || selectedIds.size === 0}
            variant="outline"
            className="flex-1"
          >
            선택 처리
          </Button>
          <Button
            onClick={handleFullProcess}
            disabled={running}
            variant="outline"
            className="flex-1"
          >
            전체 처리
          </Button>
          <Button
            onClick={handleStop}
            disabled={!running}
            variant="outline"
            size="icon"
            className="shrink-0"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {progress && (
          <div className="space-y-2">
            <Progress value={pct} />
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>
                전체 {progress.totalCategories}개 / 실행할 {progress.totalSteps}개
              </p>
              <p>
                완료 {progress.completedSteps}개 / 실패 {progress.failedSteps}개
              </p>
              {progress.currentCategory && (
                <p className="truncate">
                  현재: &ldquo;{progress.currentCategory} &mdash;{" "}
                  {progress.currentStep}&rdquo;
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
