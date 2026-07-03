"use client";

import { useState, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Square } from "lucide-react";
import { toast } from "sonner";
import {
  runStep,
  fetchBatchStatus,
} from "@/lib/api";
import type { Category, StepName, BatchStatusData } from "@/lib/api";

interface TaskExecutionProps {
  token: string | null;
  selectedIds: Set<number>;
  categories: Category[];
  filter: string | undefined;
  keyword?: string;
  canModify: (cat: Category) => boolean;
  onComplete: (wasStopped: boolean) => void;
  onCategoryComplete?: () => void;
  folder?: string;
  onStepsChange?: (steps: StepName[]) => void;
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
  phase: "process" | "done";
  initialTotalSteps: number;
}

interface StepJob {
  categoryId: number;
  categoryName: string;
  stepName: StepName;
}

export default function TaskExecution({
  token,
  selectedIds,
  categories,
  filter,
  keyword,
  canModify,
  onComplete,
  onCategoryComplete,
  folder,
  onStepsChange,
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

  const MAX_RETRIES = 2; // 총 3회 시도
  const RETRY_DELAY_MS = 1000;
  const STEP_DELAY_MS = 2000;
  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const [running, setRunning] = useState(false);
  const [wasStopped, setWasStopped] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<Set<StepName>>(
    new Set<StepName>()
  );

  const toggleStep = (step: StepName) => {
    const next = new Set(checkedSteps);
    if (next.has(step)) next.delete(step);
    else next.add(step);
    setCheckedSteps(next);
    onStepsChange?.(Array.from(next));
  };

  const [stopping, setStopping] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);
  const targetIdsRef = useRef<number[]>([]);
  const lastBatchRef = useRef<BatchStatusData | null>(null);
  const retryParamsRef = useRef<{
    type: "selected" | "full";
    ids?: number[];
    filter?: string;
    keyword?: string;
    folder?: string;
    steps: StepName[];
  } | null>(null);

  const executeQueue = useCallback(
    async (batchData: BatchStatusData) => {
      setRunning(true);
      setWasStopped(false);
      setStopping(false);
      setError(null);
      abortRef.current = false;

      // 벌크 API 응답으로 큐 구성 (서버에서 이미 checkedSteps + 의존성 필터링 완료)
      const queue: StepJob[] = [];
      for (const cat of batchData.categories) {
        for (const step of cat.missing_steps) {
          queue.push({
            categoryId: cat.id,
            categoryName: cat.category_name_ko,
            stepName: step,
          });
        }
      }

      targetIdsRef.current = batchData.categories.map(c => c.id);
      lastBatchRef.current = batchData;

      if (queue.length === 0) {
        flushSync(() => {
          setProgress({
            totalCategories: batchData.total_selected,
            completedCategories: batchData.total_selected,
            failedCategories: 0,
            totalSteps: 0,
            totalStepsInCategory: 0,
            completedSteps: 0,
            failedSteps: 0,
            currentCategory: "",
            currentStep: "",
            currentStepIndex: 0,
            queueEmpty: true,
            phase: "done",
            initialTotalSteps: 0,
          });
        });
        setRunning(false);
        toast("모든 카테고리가 이미 처리되었습니다");
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

      // 처리 시작
      flushSync(() => {
        setProgress({
          totalCategories: orderedCategoryIds.length,
          completedCategories: 0,
          failedCategories: 0,
          totalSteps: queue.length,
          totalStepsInCategory: 0,
          completedSteps: 0,
          failedSteps: 0,
          currentCategory: "",
          currentStep: "",
          currentStepIndex: 0,
          queueEmpty: false,
          phase: "process",
          initialTotalSteps: queue.length,
        });
      });

      let completedCategories = 0;
      let failedCategories = 0;

      for (let ci = 0; ci < orderedCategoryIds.length; ci++) {
        if (abortRef.current) break;

        const catId = orderedCategoryIds[ci];
        const catSteps = stepsByCategory.get(catId) || [];
        let catFailed = false;

        flushSync(() => {
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
        });

        for (let si = 0; si < catSteps.length; si++) {
          if (abortRef.current) break;

          const job = catSteps[si];

          flushSync(() => {
            setProgress((p) =>
              p
                ? {
                    ...p,
                    currentStepIndex: si + 1,
                    currentStep: job.stepName,
                  }
                : p,
            );
          });

          let stepSucceeded = false;

          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
              const result = await runStep(job.categoryId, job.stepName, token);
              if (result.status === "completed") {
                stepSucceeded = true;
                break;
              }
              // status "failed" — 재시도 불가 (422 validation 등)
              break;
            } catch {
              // 네트워크/500 에러 — 재시도
            }

            if (attempt < MAX_RETRIES && !abortRef.current) {
              await delay(RETRY_DELAY_MS * Math.pow(2, attempt));
            }
          }

          if (stepSucceeded) {
            flushSync(() => {
              setProgress((p) =>
                p ? { ...p, completedSteps: p.completedSteps + 1 } : p,
              );
            });
            // 단계 간 지연 (API 부하 방지)
            if (si < catSteps.length - 1) {
              await delay(STEP_DELAY_MS);
            }
          } else {
            flushSync(() => {
              setProgress((p) =>
                p ? { ...p, failedSteps: p.failedSteps + 1 } : p,
              );
            });
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

        flushSync(() => {
          setProgress((p) =>
            p ? { ...p, completedCategories, failedCategories } : p,
          );
        });

        onCategoryComplete?.();
      }

      if (abortRef.current) {
        setStopping(false);
        setRunning(false);
        setWasStopped(true);
        toast.warning(`처리 중지: ${completedCategories}개 완료, ${failedCategories}개 실패`);
        onComplete(true);
        return;
      }

      setRunning(false);
      if (failedCategories > 0) {
        toast.warning(`처리 완료: ${completedCategories}개 성공, ${failedCategories}개 실패`);
      } else {
        toast.success(`처리 완료: ${completedCategories}개 처리됨`);
      }
      onComplete(false);
    },
    [token, onComplete, onCategoryComplete],
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
    try {
      const steps = Array.from(checkedSteps);
      const res = await fetchBatchStatus(token, { ids: targetIds, steps });
      const d = res.data;
      if (d.needs_processing === 0) {
        toast("모든 카테고리가 이미 처리되었습니다");
        return;
      }
      if (!window.confirm(`선택한 ${d.total_selected}개 카테고리 중 ${d.needs_processing}개에서 ${d.total_steps}개 step이 필요합니다. 처리하시겠습니까?`)) return;
      retryParamsRef.current = { type: "selected", ids: targetIds, steps };
      await executeQueue(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "상태 확인 실패");
    }
  }, [token, selectedIds, categories, canModify, executeQueue, checkedSteps]);

  const handleFullProcess = useCallback(async () => {
    if (!token) {
      alert("로그인이 필요합니다");
      return;
    }
    try {
      const steps = Array.from(checkedSteps);
      const res = await fetchBatchStatus(token, { owner_scope: filter, like_query: keyword, folder, steps });
      const d = res.data;
      if (d.needs_processing === 0) {
        toast("처리 가능한 카테고리가 없습니다");
        return;
      }
      if (!window.confirm(`현재 필터에 해당하는 ${d.total_selected}개 카테고리 중 ${d.needs_processing}개에서 ${d.total_steps}개 step이 필요합니다. 처리하시겠습니까?`)) return;
      retryParamsRef.current = { type: "full", filter, keyword, folder, steps };
      await executeQueue(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "상태 확인 실패");
    }
  }, [token, filter, keyword, folder, executeQueue, checkedSteps]);

  const handleStop = useCallback(() => {
    abortRef.current = true;
    setStopping(true);
    setWasStopped(true);
  }, []);

  const handleRetry = useCallback(async () => {
    if (!retryParamsRef.current || !token) return;
    const params = retryParamsRef.current;
    try {
      const res = await fetchBatchStatus(token, {
        ...(params.type === "selected"
          ? { ids: params.ids }
          : { owner_scope: params.filter, like_query: params.keyword, folder: params.folder }),
        steps: params.steps,
      });
      const d = res.data;
      if (d.needs_processing === 0) {
        toast("모든 카테고리가 이미 처리되었습니다");
        return;
      }
      await executeQueue(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "재실행 실패");
    }
  }, [executeQueue, token]);

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
      <h3 className="font-medium text-sm">작업 실행</h3>
      <div className="space-y-4">
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
              {progress.queueEmpty && progress.initialTotalSteps > 0 && (
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  [{progress.initialTotalSteps}/{progress.initialTotalSteps}]
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {(progress.phase === "process" || progress.phase === "done") && (
                <p>
                  전체 {progress.totalCategories}개 / 완료{" "}
                  {progress.completedCategories}개 / 실패{" "}
                  {progress.failedCategories}개
                </p>
              )}
              {progress.queueEmpty && (
                <p>모든 카테고리가 이미 처리되었습니다</p>
              )}
              {!progress.queueEmpty && progress.currentCategory && (
                <>
                  <p className="truncate">
                    현재 카테고리: &ldquo;{progress.currentCategory}&rdquo;
                  </p>
                  {progress.currentStep && (
                    <p className="truncate">
                      현재: [{progress.currentStepIndex}/{progress.totalStepsInCategory}]{" "}
                      {progress.currentStep}
                    </p>
                  )}
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
