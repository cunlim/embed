"use client";

import { useState } from "react";
import { Copy, Loader2, AlertCircle, Play, Check, Clock, Square } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { updateCategoryText } from "@/lib/api";
import type { CategoryTranslations, StepName } from "@/lib/api";
import type { CatExecState } from "@/hooks/useCategoryExecution";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CategoryTranslations | null;
  isLoading: boolean;
  error: string | null;
  token?: string | null;
  onUpdateData?: (data: CategoryTranslations) => void;
  onUpdateListRow?: (row: { id: number; translation_status: string; category_name_ko: string; category_name_zh: string | null; category_name_en: string | null }) => void;
  // New props from useCategoryExecution
  execState: CatExecState | null;
  onSingleAction: (stepName: StepName) => Promise<void>;
  onRunAll: () => Promise<void>;
  onCancelPending: () => void;
  onClearStep?: (stepName: StepName) => void;
  readOnly?: boolean;
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
  open, onOpenChange, data, isLoading, error, token,
  onUpdateData, onUpdateListRow,
  execState, onSingleAction, onRunAll, onCancelPending, onClearStep,
  readOnly = false,
}: Props) {
  const [flashSteps, setFlashSteps] = useState<Set<StepName>>(new Set());
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const runningSteps = execState?.runningSteps ?? new Set<StepName>();
  const pendingSteps = execState?.pendingSteps ?? [];
  const completedSteps = execState?.completedSteps ?? new Set<StepName>();
  const failedSteps = execState?.failedSteps ?? new Set<StepName>();
  const stepResults = execState?.stepResults ?? new Map<StepName, string>();
  const copyableSteps = execState?.copyableSteps ?? new Set<StepName>();
  const embeddingFullData = execState?.embeddingFullData ?? new Map<StepName, string>();
  const actionError = execState?.actionError ?? null;

  const renderRow = (
    label: string,
    displayValue: string | null,
    copyValue: string | null,
    stepName: StepName | null,
    translationDone?: boolean,
    isExecuting?: boolean,
    isPending?: boolean,
    langKey?: "ko" | "en" | "zh",
    showDisabledCopy?: boolean,
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
        {langKey ? (
          <input
            type="text"
            className="text-sm truncate font-mono w-full bg-transparent border-b border-border px-1 py-0.5 focus:outline-none focus:border-accent read-only:opacity-60 read-only:cursor-default"
            value={editValues[langKey] ?? displayValue ?? ""}
            onChange={(e) => setEditValues((prev) => ({ ...prev, [langKey]: e.target.value }))}
            onBlur={() => handleBlur(langKey)}
            readOnly={runningSteps.size > 0 || pendingSteps.length > 0 || readOnly}
          />
        ) : (
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
        )}
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
                onClick={() => onSingleAction(stepName)}
                title={label + " 실행"}
                disabled={isExecuting || translationDone === false || readOnly}
              >
                <Play className="size-3" />
              </Button>
            )
          ) : showDisabledCopy ? (
            <Button variant="ghost" size="icon" disabled title="복사">
              <Copy className="size-3 text-muted-foreground" />
            </Button>
          ) : null}
        </div>
      </div>
    );
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset flashSteps locally (transient UI concern)
      setFlashSteps(new Set());
      // Reset editValues so stale values don't persist on next open
      setEditValues({});
    }
    onOpenChange(open);
  };

  const handleBlur = async (langKey: "ko" | "en" | "zh") => {
    if (!data || readOnly) return;
    const fieldMap: Record<string, "category_name_ko" | "category_name_en" | "category_name_zh"> = {
      ko: "category_name_ko",
      en: "category_name_en",
      zh: "category_name_zh",
    };
    const originalValue = data.languages[langKey].translation_text ?? "";
    const newValue = editValues[langKey] ?? originalValue;
    if (newValue === originalValue) return;

    try {
      const res = await updateCategoryText(data.id, fieldMap[langKey], newValue || null, token);
      setEditValues({});
      onUpdateData?.(res.data.translations);
      onUpdateListRow?.(res.data.listRow);
      onClearStep?.(`embedding.${langKey}` as StepName);
      toast("저장되었습니다");
    } catch {
      toast("저장에 실패했습니다");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{readOnly ? "카테고리 보기" : "카테고리 상세"}</DialogTitle>
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
              const transKey = `translation.${lang.key}` as StepName;
              const isKoEmpty = !data.category_name_ko?.trim();
              const hasTranslationText = detail.translation_text !== null || completedSteps.has(transKey) || stepResults.has(transKey);
              const embeddingReady = lang.hasTranslation
                ? hasTranslationText
                : !isKoEmpty;

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
                            !isKoEmpty,
                            isExecuting,
                            pendingSteps.includes(`translation.${lang.key}` as StepName),
                            lang.key,
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
                            embeddingReady,
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
                            undefined,
                            undefined,
                            undefined,
                            "ko",
                            isKoEmpty,
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
                            embeddingReady,
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
          const isKoEmpty = data ? !data.category_name_ko?.trim() : false;
          const allCompleted = data ? ALL_STEPS.every(isStepDone) : false;
          const hasPending = pendingSteps.length > 0;

          return (
            <>
              {!readOnly && (
                <div className="flex justify-end">
                  {hasPending ? (
                    <Button variant="destructive" onClick={onCancelPending}>
                      <Square className="mr-1.5 h-4 w-4" />
                      실행중지
                    </Button>
                  ) : (
                    <Button onClick={onRunAll} disabled={isExecuting || allCompleted || isKoEmpty}>
                      {allCompleted ? (
                        <Check className="mr-1.5 h-4 w-4" />
                      ) : (
                        <Play className="mr-1.5 h-4 w-4" />
                      )}
                      전체 실행
                    </Button>
                  )}
                </div>
              )}
            </>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
