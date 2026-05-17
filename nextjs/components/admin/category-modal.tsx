"use client";

import { useState, useCallback } from "react";
import { Copy, Loader2, AlertCircle, Play } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryTranslations } from "@/lib/api";
import { translateEmbedCategory } from "@/lib/api";
import { useCategoryProgress, type StepName, type CategoryProgress } from "@/hooks/useCategoryProgress";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CategoryTranslations | null;
  isLoading: boolean;
  error: string | null;
  token?: string | null;
  onReload?: () => void;
  onListRefresh?: () => void;
}

const LANGUAGES: { key: "ko" | "en" | "zh"; label: string; hasTranslation: boolean }[] = [
  { key: "ko", label: "한국어 (ko)", hasTranslation: false },
  { key: "en", label: "영어 (en)", hasTranslation: true },
  { key: "zh", label: "중국어 (zh)", hasTranslation: true },
];

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast("클립보드에 복사되었습니다");
  }).catch(() => {
    toast("복사에 실패했습니다");
  });
}

export default function CategoryModal({
  open, onOpenChange, data, isLoading, error, token, onReload, onListRefresh,
}: Props) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [runningSteps, setRunningSteps] = useState<Set<StepName>>(new Set());
  const [completedSteps, setCompletedSteps] = useState<Set<StepName>>(new Set());
  const [failedSteps, setFailedSteps] = useState<Set<StepName>>(new Set());

  const handleProgressUpdate = useCallback((progress?: CategoryProgress) => {
    if (progress) {
      if (progress.status === "completed") {
        setCompletedSteps((prev) => new Set(prev).add(progress.stepName));
        setRunningSteps((prev) => {
          const next = new Set(prev);
          next.delete(progress.stepName);
          return next;
        });
      } else if (progress.status === "failed") {
        setFailedSteps((prev) => new Set(prev).add(progress.stepName));
        setRunningSteps((prev) => {
          const next = new Set(prev);
          next.delete(progress.stepName);
          return next;
        });
        if (progress.error) {
          setActionError(progress.error);
        }
      }
      onReload?.();
      onListRefresh?.();
    } else {
      // 전체 완료
      onReload?.();
      onListRefresh?.();
    }
  }, [onReload, onListRefresh]);

  const { isRunning, activeStep, subscribeProgress, cancel } = useCategoryProgress(handleProgressUpdate);

  const handleSingleAction = async (stepName: StepName) => {
    if (!data) return;
    setActionError(null);
    setRunningSteps((prev) => new Set(prev).add(stepName));
    subscribeProgress(data.id);
    try {
      await translateEmbedCategory(data.id, token, [stepName]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "실행 실패";
      setActionError(msg);
      setRunningSteps((prev) => {
        const next = new Set(prev);
        next.delete(stepName);
        return next;
      });
      setFailedSteps((prev) => new Set(prev).add(stepName));
      cancel();
    }
  };

  const handleRunAll = async () => {
    if (!data) return;
    setActionError(null);
    const steps: StepName[] = [];
    for (const lang of LANGUAGES) {
      if (lang.hasTranslation) {
        const tl = data.languages[lang.key];
        if (!tl.translation_text) steps.push(`translation.${lang.key}` as StepName);
        if (tl.embedding.status !== "completed") steps.push(`embedding.${lang.key}` as StepName);
      } else {
        if (data.languages[lang.key].embedding.status !== "completed") steps.push(`embedding.${lang.key}` as StepName);
      }
    }
    if (steps.length === 0) return;
    setRunningSteps(new Set(steps));
    subscribeProgress(data.id);
    try {
      await translateEmbedCategory(data.id, token, steps);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "실행 실패";
      setActionError(msg);
      setRunningSteps(new Set());
      cancel();
    }
  };

  const renderRow = (
    label: string,
    displayValue: string | null,
    copyValue: string | null,
    stepName: StepName | null,
  ) => {
    const hasValue = displayValue !== null;
    const isRunningThis = stepName ? runningSteps.has(stepName) || activeStep === stepName : false;
    const isCompleted = hasValue || (stepName ? completedSteps.has(stepName) : false);
    const isFailed = stepName ? failedSteps.has(stepName) : false;

    return (
      <div className="grid grid-cols-[80px_1fr_40px] gap-3 items-center py-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm truncate font-mono">
          {hasValue ? (
            displayValue
          ) : isRunning ? (
            <Loader2 className="size-3 animate-spin inline" />
          ) : isFailed ? (
            <span className="text-destructive italic">실패</span>
          ) : (
            <span className="text-muted-foreground italic">처리전</span>
          )}
        </span>
        <div>
          {isRunningThis ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : isFailed ? (
            <AlertCircle className="size-4 text-destructive" />
          ) : isCompleted && copyValue ? (
            <Button variant="ghost" size="icon" onClick={() => copyToClipboard(copyValue)} title="복사">
              <Copy className="size-3" />
            </Button>
          ) : stepName ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSingleAction(stepName)}
              title={label + " 실행"}
              disabled={isRunning}
            >
              <Play className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>
    );
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && isRunning) cancel();
    if (!open) {
      setActionError(null);
      setRunningSteps(new Set());
      setCompletedSteps(new Set());
      setFailedSteps(new Set());
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>카테고리 상세</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {data ? (
              `코드: ${data.category_code}`
            ) : (
              <span className="inline-block h-4 w-24 animate-pulse rounded-md bg-muted" />
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        )}

        {(error || actionError) && (
          <div className="flex items-center gap-2 text-red-500 py-4">
            <AlertCircle className="size-4" />
            <span className="text-sm">{actionError || error}</span>
          </div>
        )}

        {data && !isLoading && (
          <div className="space-y-2 py-2">
            {LANGUAGES.map((lang, i) => {
              const detail = data.languages[lang.key];

              return (
                <div key={lang.key}>
                  {i > 0 && <Separator className="my-2" />}
                  <div className="mb-2">
                    <span className="text-sm font-medium">{lang.label}</span>
                  </div>
                  <div className="space-y-0.5">
                    {lang.hasTranslation
                      ? renderRow(
                          "번역",
                          detail.translation_text,
                          detail.translation_text,
                          `translation.${lang.key}` as StepName,
                        )
                      : renderRow(
                          "원본",
                          detail.translation_text,
                          detail.translation_text,
                          null,
                        )
                    }
                    {renderRow(
                      "임베딩",
                      detail.embedding.preview
                        ? `[${detail.embedding.preview.slice(0, 10).map((v) => v.toFixed(3)).join(", ")}…1024차원]`
                        : null,
                      detail.embedding.preview
                        ? JSON.stringify(detail.embedding.preview)
                        : null,
                      `embedding.${lang.key}` as StepName,
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleRunAll} disabled={isRunning}>
            전체 실행
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
