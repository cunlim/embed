"use client";

import { useState, useCallback, useRef } from "react";
import { Copy, Loader2, AlertCircle, Play, Check, Clock, Square } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryTranslations } from "@/lib/api";

type StepName = "translation.zh" | "translation.en" | "embedding.ko" | "embedding.zh" | "embedding.en";

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
  const [pendingSteps, setPendingSteps] = useState<StepName[]>([]);
  const [completedSteps, setCompletedSteps] = useState<Set<StepName>>(new Set());
  const [failedSteps, setFailedSteps] = useState<Set<StepName>>(new Set());
  const [stepResults, setStepResults] = useState<Map<StepName, string>>(new Map());
  const [copyableSteps, setCopyableSteps] = useState<Set<StepName>>(new Set());
  const [embeddingFullData, setEmbeddingFullData] = useState<Map<StepName, string>>(new Map());
  const [flashSteps, setFlashSteps] = useState<Set<StepName>>(new Set());

  const abortRef = useRef(false);

  const enableStepCopy = (stepName: StepName) => {
    setTimeout(() => {
      setCopyableSteps((prev) => new Set(prev).add(stepName));
    }, 2000);
  };

  const handleSingleAction = async (stepName: StepName) => {
    if (!data) return;
    setActionError(null);
    setRunningSteps((prev) => new Set(prev).add(stepName));
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "https://embed.cunlim.dev/api"}/categories/${data.id}/run-step`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ step: stepName }),
        }
      );
      const result = await res.json();
      if (result.status === 'completed') {
        setCompletedSteps((prev) => new Set(prev).add(stepName));
        setStepResults((prev) => new Map(prev).set(stepName, result.result));
        if (stepName.startsWith("embedding")) {
          handleStepComplete(stepName, data.id);
        } else {
          enableStepCopy(stepName);
        }
      } else {
        throw new Error(result.error || '실행 실패');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '실행 실패';
      setActionError(msg);
      setFailedSteps((prev) => new Set(prev).add(stepName));
    } finally {
      setRunningSteps((prev) => {
        const next = new Set(prev);
        next.delete(stepName);
        return next;
      });
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

    abortRef.current = false;
    setRunningSteps(new Set([steps[0]]));
    setPendingSteps(steps.slice(1));

    for (let i = 0; i < steps.length; i++) {
      if (abortRef.current) break;

      const stepName = steps[i];
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "https://embed.cunlim.dev/api"}/categories/${data.id}/run-step`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ step: stepName }),
          }
        );
        const result = await res.json();

        if (result.status === 'completed') {
          setCompletedSteps((prev) => new Set(prev).add(stepName));
          setStepResults((prev) => new Map(prev).set(stepName, result.result));

          if (stepName.startsWith("embedding")) {
            handleStepComplete(stepName, data.id);
          } else {
            enableStepCopy(stepName);
          }

          onListRefresh?.();
        } else {
          throw new Error(result.error || '실행 실패');
        }

        if (abortRef.current) break;

        const nextIndex = i + 1;
        if (nextIndex < steps.length) {
          setRunningSteps(new Set([steps[nextIndex]]));
          setPendingSteps(steps.slice(nextIndex + 1));
        } else {
          setRunningSteps(new Set());
          setPendingSteps([]);
        }
      } catch (err) {
        if (abortRef.current) break;
        const msg = err instanceof Error ? err.message : '실행 실패';
        setActionError(msg);
        setFailedSteps((prev) => new Set(prev).add(stepName));
        setRunningSteps(new Set());
        setPendingSteps([]);
        break;
      }
    }
  };

  const handleCancelPending = () => {
    abortRef.current = true;
    setPendingSteps([]);
  };

  const handleStepComplete = useCallback(async (stepName: StepName, categoryId: number) => {
    const isEmbedding = stepName.startsWith("embedding");
    if (isEmbedding) {
      const { fetchCategoryTranslations } = await import("@/lib/api");
      try {
        const res = await fetchCategoryTranslations(categoryId, token ?? null);
        const lang = stepName.split(".")[1] as "ko" | "en" | "zh";
        const emb = res.data.languages[lang].embedding;
        if (emb.preview) {
          setEmbeddingFullData((prev) => new Map(prev).set(stepName, JSON.stringify(emb.preview)));
        }
      } catch { /* 실패 시 무시 */ }
    }
  }, [token]);

  const renderRow = (
    label: string,
    displayValue: string | null,
    copyValue: string | null,
    stepName: StepName | null,
    translationDone?: boolean,
    isExecuting?: boolean,
    isPending?: boolean,
  ) => {
    const hasValue = displayValue !== null;
    const isRunningThis = stepName ? runningSteps.has(stepName) : false;
    const isCompleted = hasValue || (stepName ? completedSteps.has(stepName) : false);
    const isFailed = stepName ? failedSteps.has(stepName) : false;
    const hasResult = stepName ? stepResults.has(stepName) : false;
    const isEmbedding = stepName?.startsWith("embedding") ?? false;
    const canCopy = stepName ? copyableSteps.has(stepName) : false;
    const isJustCopied = stepName ? flashSteps.has(stepName) : false;
    const effectiveCopyValue = isEmbedding
      ? (copyValue ?? (canCopy ? embeddingFullData.get(stepName!) ?? null : null))
      : (copyValue ?? (canCopy ? stepResults.get(stepName!) ?? null : null));

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
          ) : (isCompleted || hasResult) && effectiveCopyValue && !isJustCopied ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                copyToClipboard(effectiveCopyValue);
                if (stepName) {
                  setFlashSteps((prev) => new Set(prev).add(stepName));
                  setTimeout(() => {
                    setFlashSteps((prev) => {
                      const next = new Set(prev);
                      next.delete(stepName);
                      return next;
                    });
                  }, 1500);
                }
              }}
              title="복사"
            >
              <Copy className="size-3" />
            </Button>
          ) : (isCompleted || hasResult) ? (
            <Button variant="ghost" size="icon" disabled title={flashSteps.has(stepName!) ? "복사됨" : "완료됨"}>
              <Check className="size-3 text-muted-foreground" />
            </Button>
          ) : stepName ? (
            isPending ? (
              <Button variant="ghost" size="icon" disabled title={label + " 대기 중"}>
                <Clock className="size-3 animate-pulse" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleSingleAction(stepName)}
                title={label + " 실행"}
                disabled={isExecuting || translationDone === false}
              >
                <Play className="size-3" />
              </Button>
            )
          ) : null}
        </div>
      </div>
    );
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setActionError(null);
      setRunningSteps(new Set());
      setPendingSteps([]);
      setCompletedSteps(new Set());
      setFailedSteps(new Set());
      setStepResults(new Map());
      setCopyableSteps(new Set());
      setEmbeddingFullData(new Map());
      setFlashSteps(new Set());
      abortRef.current = false;
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
              const isExecuting = runningSteps.size > 0 || pendingSteps.length > 0;

              return (
                <div key={lang.key}>
                  {i > 0 && <Separator className="my-2" />}
                  <div className="mb-2">
                    <span className="text-sm font-medium">{lang.label}</span>
                  </div>
                  <div className="space-y-0.5">
                    {lang.hasTranslation
                      ? (
                        <>
                          {renderRow(
                            "번역",
                            detail.translation_text,
                            detail.translation_text,
                            `translation.${lang.key}` as StepName,
                            undefined,
                            isExecuting,
                            pendingSteps.includes(`translation.${lang.key}` as StepName),
                          )}
                          {renderRow(
                            "임베딩",
                            detail.embedding.preview
                              ? `[${detail.embedding.preview.slice(0, 10).map((v) => v.toFixed(3)).join(", ")}…1024차원]`
                              : null,
                            detail.embedding.preview
                              ? JSON.stringify(detail.embedding.preview)
                              : null,
                            `embedding.${lang.key}` as StepName,
                            detail.translation_text !== null,
                            isExecuting,
                            pendingSteps.includes(`embedding.${lang.key}` as StepName),
                          )}
                        </>
                      )
                      : (
                        <>
                          {renderRow(
                            "원본",
                            detail.translation_text,
                            detail.translation_text,
                            null,
                          )}
                          {renderRow(
                            "임베딩",
                            detail.embedding.preview
                              ? `[${detail.embedding.preview.slice(0, 10).map((v) => v.toFixed(3)).join(", ")}…1024차원]`
                              : null,
                            detail.embedding.preview
                              ? JSON.stringify(detail.embedding.preview)
                              : null,
                            `embedding.${lang.key}` as StepName,
                            true,
                            isExecuting,
                            pendingSteps.includes(`embedding.${lang.key}` as StepName),
                          )}
                        </>
                      )
                    }
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
          const isExecuting = runningSteps.size > 0 || pendingSteps.length > 0;
          const allCompleted = data ? ALL_STEPS.every(isStepDone) : false;
          const hasPending = pendingSteps.length > 0;

          return (
            <div className="flex justify-end">
              {hasPending ? (
                <Button variant="destructive" onClick={handleCancelPending}>
                  <Square className="mr-1.5 h-4 w-4" />
                  실행중지
                </Button>
              ) : (
                <Button onClick={handleRunAll} disabled={isExecuting || allCompleted}>
                  {isExecuting ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : allCompleted ? (
                    <Check className="mr-1.5 h-4 w-4" />
                  ) : (
                    <Play className="mr-1.5 h-4 w-4" />
                  )}
                  전체 실행
                </Button>
              )}
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
