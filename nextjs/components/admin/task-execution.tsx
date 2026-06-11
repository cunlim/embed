"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Square } from "lucide-react";
import { toast } from "sonner";
import {
  batchRunStream,
  fetchBatchStatus,
} from "@/lib/api";
import type { Category, Recommendation, StepName, BatchRunData, BatchProgress } from "@/lib/api";

interface TaskExecutionProps {
  token: string | null;
  selectedIds: Set<number>;
  categories: (Category | Recommendation)[];
  filter: string | undefined;
  keyword?: string;
  canModify: (cat: Category | Recommendation) => boolean;
  onComplete: (wasStopped: boolean) => void;
  onCategoryComplete?: () => void;
  folder?: string;
  onStepsChange?: (steps: StepName[]) => void;
}

export default function TaskExecution({
  token,
  selectedIds,
  categories,
  filter,
  keyword,
  canModify,
  onComplete,
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

  const [running, setRunning] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<Set<StepName>>(
    new Set<StepName>()
  );
  const [result, setResult] = useState<BatchRunData | null>(null);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 페이지 새로고침/이탈 시 SSE 연결 종료
  useEffect(() => {
    const handleBeforeUnload = () => {
      abortControllerRef.current?.abort();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const toggleStep = (step: StepName) => {
    const next = new Set(checkedSteps);
    if (next.has(step)) next.delete(step);
    else next.add(step);
    setCheckedSteps(next);
    onStepsChange?.(Array.from(next));
  };

  const executeBatch = useCallback(
    async (params: { ids?: number[]; filter?: string; keyword?: string; folder?: string; steps?: StepName[] }) => {
      if (!token) return;

      setRunning(true);
      setResult(null);
      setProgress(null);
      setError(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        await batchRunStream(token, params, {
          onProgress: (p) => setProgress(p),
          onComplete: (data) => {
            setResult(data);
            setProgress(null);

            if (data.failed_categories > 0) {
              toast.warning(`처리 완료: ${data.completed_categories}개 성공, ${data.failed_categories}개 실패`);
            } else {
              toast.success(`처리 완료: ${data.completed_categories}개 처리됨`);
            }
            onComplete(false);
          },
        }, controller.signal);
      } catch (err) {
        if (controller.signal.aborted) {
          // 사용자가 중지
          setRunning(false);
          setProgress(null);
          toast.warning("처리가 중지되었습니다");
          onComplete(true);
          return;
        }
        setError(err instanceof Error ? err.message : "배치 실행 실패");
      } finally {
        setRunning(false);
        abortControllerRef.current = null;
      }
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
    try {
      const steps = Array.from(checkedSteps);
      // 확인 다이얼로그를 위해 상태 조회
      const statusRes = await fetchBatchStatus(token, { ids: targetIds, steps });
      const d = statusRes.data;
      if (d.needs_processing === 0) {
        toast("모든 카테고리가 이미 처리되었습니다");
        return;
      }
      if (!window.confirm(`선택한 ${d.total_selected}개 카테고리 중 ${d.needs_processing}개에서 ${d.total_steps}개 step이 필요합니다. 처리하시겠습니까?`)) return;
      await executeBatch({ ids: targetIds, steps });
    } catch (err) {
      setError(err instanceof Error ? err.message : "상태 확인 실패");
    }
  }, [token, selectedIds, categories, canModify, executeBatch, checkedSteps]);

  const handleFullProcess = useCallback(async () => {
    if (!token) {
      alert("로그인이 필요합니다");
      return;
    }
    try {
      const steps = Array.from(checkedSteps);
      // 확인 다이얼로그를 위해 상태 조회
      const statusRes = await fetchBatchStatus(token, { filter, keyword, folder, steps });
      const d = statusRes.data;
      if (d.needs_processing === 0) {
        toast("처리 가능한 카테고리가 없습니다");
        return;
      }
      if (!window.confirm(`현재 필터에 해당하는 ${d.total_selected}개 카테고리 중 ${d.needs_processing}개에서 ${d.total_steps}개 step이 필요합니다. 처리하시겠습니까?`)) return;
      await executeBatch({ filter, keyword, folder, steps });
    } catch (err) {
      setError(err instanceof Error ? err.message : "상태 확인 실패");
    }
  }, [token, filter, keyword, folder, executeBatch, checkedSteps]);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleRetry = useCallback(async () => {
    if (!token || !result) return;
    // 이전 파라미터로 재실행 (서버에서 이미 완료된 step은 자동 건너뜀)
    const steps = Array.from(checkedSteps);
    await executeBatch({ filter, keyword, folder, steps });
  }, [token, result, executeBatch, checkedSteps, filter, keyword, folder]);

  const pct = result && result.total_steps > 0
    ? Math.round(((result.completed_steps + result.failed_steps) / result.total_steps) * 100)
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

        {running && (
          <div className="space-y-2">
            {progress ? (
              <>
                <div className="flex items-center gap-2">
                  <Progress
                    value={progress.totalSteps > 0
                      ? Math.round(((progress.completedSteps + progress.failedSteps) / progress.totalSteps) * 100)
                      : 0
                    }
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                    [{progress.completedSteps + progress.failedSteps}/{progress.totalSteps}]
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {progress.currentCategory && (
                    <p>
                      <span className="font-medium">"{progress.currentCategory}"</span>
                      {progress.currentStep && (
                        <span className="ml-1">
                          [{progress.currentStepIndex}/{progress.totalStepsInCategory}] {STEP_LABELS[progress.currentStep as StepName] || progress.currentStep}
                        </span>
                      )}
                    </p>
                  )}
                  <p>
                    전체 {progress.totalCategories}개 / 완료 {progress.completedCategories}개 / 실패 {progress.failedCategories}개
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary animate-pulse rounded-full" style={{ width: "100%" }} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">서버에 연결 중...</p>
              </>
            )}
            <Button
              onClick={handleStop}
              variant="destructive"
              className="w-full"
            >
              <Square className="mr-1 h-3 w-3" />
              실행중지
            </Button>
          </div>
        )}

        {result && !running && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Progress value={pct} className="flex-1" />
              <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                [{result.completed_steps + result.failed_steps}/{result.total_steps}]
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>
                전체 {result.total_categories}개 / 완료{" "}
                {result.completed_categories}개 / 실패{" "}
                {result.failed_categories}개
              </p>
              {result.categories.filter(c => c.status === "failed").length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="font-medium">실패한 카테고리:</p>
                  {result.categories
                    .filter(c => c.status === "failed")
                    .map(cat => (
                      <div key={cat.id} className="ml-2">
                        <p className="truncate">- {cat.category_name_ko}</p>
                        {cat.steps
                          .filter(s => s.status === "failed")
                          .map(s => (
                            <p key={s.step} className="ml-2 text-destructive truncate">
                              {s.step}: {s.error}
                            </p>
                          ))}
                      </div>
                    ))}
                </div>
              )}
            </div>
            {result.failed_categories > 0 && (
              <Button
                onClick={handleRetry}
                variant="outline"
                className="w-full"
              >
                실패 항목 재실행
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
