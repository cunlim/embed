"use client";

import { useState, useCallback } from "react";
import { Copy, Loader2, AlertCircle, Play, Check } from "lucide-react";
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
  open, onOpenChange, data, isLoading, error, token, onListRefresh,
}: Props) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [runningSteps, setRunningSteps] = useState<Set<StepName>>(new Set());
  const [completedSteps, setCompletedSteps] = useState<Set<StepName>>(new Set());
  const [failedSteps, setFailedSteps] = useState<Set<StepName>>(new Set());
  const [stepResults, setStepResults] = useState<Map<StepName, string>>(new Map());
  const [copyableSteps, setCopyableSteps] = useState<Set<StepName>>(new Set());
  const [embeddingFullData, setEmbeddingFullData] = useState<Map<StepName, string>>(new Map());

  const handleProgressUpdate = useCallback((progress?: CategoryProgress) => {
    if (progress) {
      if (progress.status === "completed") {
        setCompletedSteps((prev) => new Set(prev).add(progress.stepName));
        setRunningSteps((prev) => {
          const next = new Set(prev);
          next.delete(progress.stepName);
          return next;
        });
        if (progress.result) {
          setStepResults((prev) => new Map(prev).set(progress.stepName, progress.result));
          if (progress.stepName.startsWith("embedding")) {
            const stepName = progress.stepName;
            const categoryId = data?.id;
            const authToken = token;
            setTimeout(async () => {
              if (categoryId) {
                const { fetchCategoryTranslations } = await import("@/lib/api");
                try {
                  const res = await fetchCategoryTranslations(categoryId, authToken);
                  const lang = stepName.split(".")[1] as "ko" | "en" | "zh";
                  const emb = res.data.languages[lang].embedding;
                  if (emb.preview) {
                    setEmbeddingFullData((prev) => new Map(prev).set(stepName, JSON.stringify(emb.preview)));
                  }
                } catch { /* fetch 실패 시 copyableSteps만 설정 */ }
              }
              setCopyableSteps((prev) => new Set(prev).add(stepName));
            }, 2000);
          }
        }
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
      onListRefresh?.();
    } else {
      onListRefresh?.();
    }
  }, [onListRefresh, data?.id, token]);

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
        const transKey = `translation.${lang.key}` as StepName;
        const embedKey = `embedding.${lang.key}` as StepName;
        if (!tl.translation_text && !completedSteps.has(transKey) && !stepResults.has(transKey)) {
          steps.push(transKey);
        }
        if (tl.embedding.status !== "completed" && !completedSteps.has(embedKey) && !stepResults.has(embedKey)) {
          steps.push(embedKey);
        }
      } else {
        const embedKey = `embedding.${lang.key}` as StepName;
        if (data.languages[lang.key].embedding.status !== "completed" && !completedSteps.has(embedKey) && !stepResults.has(embedKey)) {
          steps.push(embedKey);
        }
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
    const hasResult = stepName ? stepResults.has(stepName) : false;
    const isEmbedding = stepName?.startsWith("embedding") ?? false;
    const canCopy = stepName ? copyableSteps.has(stepName) : false;
    const effectiveCopyValue = isEmbedding
      ? (copyValue ?? (canCopy ? embeddingFullData.get(stepName!) ?? null : null))
      : (copyValue ?? (hasResult ? stepResults.get(stepName!) ?? null : null));

    return (
      <div className="grid grid-cols-[80px_1fr_40px] gap-3 items-center py-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm truncate font-mono">
          {hasValue ? (
            displayValue
          ) : stepName && stepResults.has(stepName) ? (
            isEmbedding ? (() => {
              try {
                const arr = JSON.parse(stepResults.get(stepName)!) as number[];
                const dims = data?.embedding_dimensions ?? 1024;
                return `[${arr.slice(0, 10).map((v) => v.toFixed(3)).join(", ")}…${dims}차원]`;
              } catch { return stepResults.get(stepName); }
            })() : stepResults.get(stepName)
          ) : isFailed ? (
            <span className="text-destructive italic">실패</span>
          ) : (
            <span className="text-muted-foreground italic">처리전</span>
          )}
        </span>
        <div>
          {isRunningThis ? (
            <Button variant="ghost" size="icon" disabled title={label + " 실행 중"}>
              <Loader2 className="size-3 animate-spin" />
            </Button>
          ) : isFailed ? (
            <AlertCircle className="size-4 text-destructive" />
          ) : (isCompleted || hasResult) && effectiveCopyValue ? (
            <Button variant="ghost" size="icon" onClick={() => copyToClipboard(effectiveCopyValue)} title="복사">
              <Copy className="size-3" />
            </Button>
          ) : (isCompleted || hasResult) ? (
            <Button variant="ghost" size="icon" disabled title="완료됨">
              <Check className="size-3 text-muted-foreground" />
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
      setStepResults(new Map());
      setCopyableSteps(new Set());
      setEmbeddingFullData(new Map());
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

        {(() => {
          const ALL_STEPS: StepName[] = ["translation.zh", "translation.en", "embedding.ko", "embedding.zh", "embedding.en"];
          const isStepDone = (step: StepName): boolean => {
            if (!data) return false;
            if (completedSteps.has(step)) return true;
            if (step.startsWith("translation")) {
              const lang = step.split(".")[1] as "en" | "zh";
              return data.languages[lang].translation_text !== null;
            }
            const lang = step.split(".")[1] as "ko" | "en" | "zh";
            return data.languages[lang].embedding.status === "completed";
          };
          const allCompleted = data ? ALL_STEPS.every(isStepDone) : false;

          return (
            <div className="flex justify-end">
              <Button onClick={handleRunAll} disabled={isRunning || allCompleted}>
                전체 실행
              </Button>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
