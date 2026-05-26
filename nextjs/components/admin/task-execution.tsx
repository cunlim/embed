"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  onComplete: (wasStopped: boolean) => void;
  onCategoryComplete?: () => void;
}

interface BatchProgress {
  totalCategories: number;
  completedCategories: number;
  failedCategories: number;
  totalSteps: number;
  totalStepsInCategory: number;
  completedSteps: number;
  failedSteps: number;
  currentCategory: string;
  currentStep: string;
  currentStepIndex: number;
  queueEmpty: boolean;
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
  onCategoryComplete,
}: TaskExecutionProps) {
  const STEP_ORDER: StepName[] = [
    "embedding.ko",
    "translation.en",
    "embedding.en",
    "translation.zh",
    "embedding.zh",
  ];

  const STEP_LABELS: Record<StepName, string> = {
    "embedding.ko": "한국어 임베딩",
    "translation.en": "영어 번역",
    "embedding.en": "영어 임베딩",
    "translation.zh": "중국어 번역",
    "embedding.zh": "중국어 임베딩",
  };

  const [running, setRunning] = useState(false);
  const [wasStopped, setWasStopped] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<Set<StepName>>(
    new Set<StepName>(["embedding.ko"])
  );

  const toggleStep = (step: StepName) => {
    setCheckedSteps(prev => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  };

  const [stopping, setStopping] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);
  const targetIdsRef = useRef<number[]>([]);

  const executeQueue = useCallback(
    async (targetCategoryIds: number[]) => {
      setRunning(true);
      setWasStopped(false);
      setStopping(false);
      setError(null);
      abortRef.current = false;
      targetIdsRef.current = targetCategoryIds;

      // Phase 1: 카테고리별 누락 step 수집
      setProgress({
        totalCategories: targetCategoryIds.length,
        completedCategories: 0,
        failedCategories: 0,
        totalSteps: 0,
        totalStepsInCategory: 0,
        completedSteps: 0,
        failedSteps: 0,
        currentCategory: "준비 중...",
        currentStep: "",
        currentStepIndex: 0,
        queueEmpty: false,
      });

      const queue: StepJob[] = [];
      for (const id of targetCategoryIds) {
        if (abortRef.current) break;
        try {
          const res = await fetchCategoryTranslations(id, token);
          const missing = determineMissingSteps(res.data);
          const enabled = missing.filter(step => checkedSteps.has(step));
          for (const step of enabled) {
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
        setStopping(false);
        setRunning(false);
        setWasStopped(true);
        onComplete(true);
        return;
      }

      if (queue.length === 0) {
        setProgress((p) =>
          p
            ? {
                ...p,
                queueEmpty: true,
                completedCategories: targetCategoryIds.length,
                currentCategory: "",
                currentStep: "",
              }
            : p,
        );
        setStopping(false);
        setRunning(false);
        onComplete(false);
        return;
      }

      // 카테고리별로 step 그룹화 (순서 보존)
      const orderedCategoryIds: number[] = [];
      const stepsByCategory = new Map<number, StepJob[]>();
      for (const job of queue) {
        if (!stepsByCategory.has(job.categoryId)) {
          orderedCategoryIds.push(job.categoryId);
          stepsByCategory.set(job.categoryId, []);
        }
        stepsByCategory.get(job.categoryId)!.push(job);
      }

      // Phase 2: 카테고리별 step 순차 실행
      setProgress((p) =>
        p ? { ...p, totalSteps: queue.length } : p,
      );

      let completedCategories = 0;
      let failedCategories = 0;

      for (let ci = 0; ci < orderedCategoryIds.length; ci++) {
        if (abortRef.current) break;

        const catId = orderedCategoryIds[ci];
        const catSteps = stepsByCategory.get(catId) || [];
        let catFailed = false;

        setProgress((p) =>
          p
            ? {
                ...p,
                currentCategory: catSteps[0].categoryName,
                totalStepsInCategory: catSteps.length,
                currentStepIndex: 0,
                currentStep: "",
                completedCategories,
                failedCategories,
              }
            : p,
        );

        for (let si = 0; si < catSteps.length; si++) {
          if (abortRef.current) break;

          const job = catSteps[si];

          setProgress((p) =>
            p
              ? {
                  ...p,
                  currentStepIndex: si + 1,
                  currentStep: job.stepName,
                }
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
              catFailed = true;
              break;
            }
          } catch {
            setProgress((p) =>
              p ? { ...p, failedSteps: p.failedSteps + 1 } : p,
            );
            catFailed = true;
            break;
          }
        }

        if (abortRef.current) break;

        if (catFailed) {
          failedCategories++;
        } else {
          completedCategories++;
        }

        setProgress((p) =>
          p ? { ...p, completedCategories, failedCategories } : p,
        );

        onCategoryComplete?.();
      }

      if (abortRef.current) {
        setStopping(false);
        setRunning(false);
        setWasStopped(true);
        onComplete(true);
        return;
      }

      setRunning(false);
      onComplete(false);
    },
    [token, onComplete, onCategoryComplete, checkedSteps],
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
      const res = await getCategories(token, 1, 100000, filter);
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
    setStopping(true);
    setWasStopped(true);
  }, []);

  const handleRetry = useCallback(async () => {
    if (targetIdsRef.current.length === 0) return;
    await executeQueue(targetIdsRef.current);
  }, [executeQueue]);

  const pct =
    progress && progress.totalSteps > 0
      ? Math.round(
          ((progress.completedSteps + progress.failedSteps) /
            progress.totalSteps) *
            100,
        )
      : 0;

  return (
    <Card className="p-4">
      <h3 className="mb-2 font-medium text-sm">작업 실행</h3>
      <div className="space-y-2">
        <div className="space-y-2">
          {STEP_ORDER.map(step => (
            <div key={step} className="flex items-center gap-2">
              <Checkbox
                id={`step-${step}`}
                checked={checkedSteps.has(step)}
                onCheckedChange={() => toggleStep(step)}
                disabled={running}
              />
              <Label htmlFor={`step-${step}`} className="text-xs cursor-pointer">
                {STEP_LABELS[step]}
              </Label>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSelectedProcess}
            disabled={running || selectedIds.size === 0 || checkedSteps.size === 0}
            className="flex-1"
          >
            선택 처리
          </Button>
          <Button
            onClick={handleFullProcess}
            disabled={running || checkedSteps.size === 0}
            className="flex-1"
          >
            전체 처리
          </Button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {progress && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Progress
                value={progress.queueEmpty ? 100 : pct}
                className="flex-1"
              />
              {!progress.queueEmpty && progress.totalSteps > 0 && (
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  [{progress.completedSteps + progress.failedSteps}/
                  {progress.totalSteps}]
                </span>
              )}
              {progress.queueEmpty && (
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  [{progress.totalCategories}/{progress.totalCategories}]
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>
                전체 {progress.totalCategories}개 / 완료{" "}
                {progress.completedCategories}개 / 실패{" "}
                {progress.failedCategories}개
              </p>
              {progress.queueEmpty && (
                <p>모든 카테고리가 이미 처리되었습니다</p>
              )}
              {!progress.queueEmpty && progress.currentCategory && (
                <>
                  <p className="truncate">
                    현재 카테고리: &ldquo;{progress.currentCategory}&rdquo;
                  </p>
                  <p className="truncate">
                    현재: [{progress.currentStepIndex}/{progress.totalStepsInCategory}]{" "}
                    {progress.currentStep}
                  </p>
                </>
              )}
            </div>

            {running && (
              <Button
                onClick={handleStop}
                disabled={stopping}
                variant="destructive"
                className="w-full"
              >
                <Square className="h-4 w-4" />
                {stopping ? "중지 중..." : "실행중지"}
              </Button>
            )}
            {wasStopped && !running && (
              <Button
                onClick={handleRetry}
                variant="outline"
                className="w-full"
              >
                재실행
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
