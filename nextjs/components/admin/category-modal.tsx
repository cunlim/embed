"use client";

import { useState } from "react";
import { Copy, Check, Loader2, XCircle, Circle, Play, AlertCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryTranslations } from "@/lib/api";
import { translateEmbedCategory } from "@/lib/api";
import { useCategoryProgress } from "@/hooks/useCategoryProgress";
import type { StepName } from "@/hooks/useCategoryProgress";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CategoryTranslations | null;
  isLoading: boolean;
  error: string | null;
  token?: string | null;
}

const LANGUAGES: { key: "ko" | "en" | "zh"; label: string; hasTranslation: boolean }[] = [
  { key: "ko", label: "한국어 (ko)", hasTranslation: false },
  { key: "en", label: "영어 (en)", hasTranslation: true },
  { key: "zh", label: "중국어 (zh)", hasTranslation: true },
];

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge variant="outline" className="text-green-600 border-green-600 gap-1"><Check className="size-3" />완료</Badge>;
    case "running":
      return <Badge variant="outline" className="text-blue-600 border-blue-600 gap-1"><Loader2 className="size-3 animate-spin" />진행중</Badge>;
    case "failed":
      return <Badge variant="outline" className="text-red-600 border-red-600 gap-1"><XCircle className="size-3" />실패</Badge>;
    default:
      return <Badge variant="outline" className="text-muted-foreground gap-1"><Circle className="size-3" />대기</Badge>;
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

export default function CategoryModal({ open, onOpenChange, data, isLoading, error, token }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({ ko: true, en: true, zh: true });
  const { progress, isRunning, subscribeProgress, cancel } = useCategoryProgress();

  const handleSingleAction = async (stepName: StepName) => {
    if (!data) return;
    subscribeProgress(data.id);
    await translateEmbedCategory(data.id, token, [stepName]);
  };

  const handleRunAll = async () => {
    if (!data) return;
    const steps: StepName[] = [];
    for (const lang of LANGUAGES) {
      if (!checked[lang.key]) continue;
      if (lang.hasTranslation) {
        const tl = data.languages[lang.key];
        if (!tl.translation_text) steps.push(`translation.${lang.key}` as StepName);
        if (tl.embedding.status !== "completed") steps.push(`embedding.${lang.key}` as StepName);
      } else {
        if (data.languages.ko.embedding.status !== "completed") steps.push("embedding.ko" as StepName);
      }
    }
    if (steps.length === 0) return;
    subscribeProgress(data.id);
    await translateEmbedCategory(data.id, token, steps);
  };

  const renderRow = (label: string, value: string | null, actionLabel: string, stepName: StepName | null) => {
    const hasValue = value !== null;
    return (
      <div className="grid grid-cols-[80px_1fr_40px] gap-3 items-center py-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm truncate font-mono">
          {value ?? (
            isRunning && stepName && progress?.stepName === stepName
              ? <Loader2 className="size-3 animate-spin inline" />
              : <span className="text-muted-foreground italic">처리전</span>
          )}
        </span>
        <div>
          {isRunning && stepName && progress?.stepName === stepName ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : hasValue ? (
            <Button variant="ghost" size="icon" onClick={() => copyToClipboard(value!)} title="복사">
              <Copy className="size-3" />
            </Button>
          ) : stepName ? (
            <Button variant="ghost" size="icon" onClick={() => handleSingleAction(stepName)} title={actionLabel}>
              <Play className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>
    );
  };

  // Cleanup on close
  const handleOpenChange = (open: boolean) => {
    if (!open && isRunning) cancel();
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>카테고리 상세</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {data ? `코드: ${data.category_code}` : <span className="inline-block h-4 w-24 animate-pulse rounded-md bg-muted" />}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-500 py-4">
            <AlertCircle className="size-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {data && !isLoading && (
          <div className="space-y-2 py-2">
            {LANGUAGES.map((lang, i) => {
              const detail = data.languages[lang.key];
              const embStatus = detail.embedding.status;
              const tlStatus = detail.translation_text ? "completed" : "pending";
              const overallStatus = lang.hasTranslation
                ? (tlStatus === "completed" && embStatus === "completed" ? "completed"
                  : tlStatus === "pending" && embStatus === "pending" ? "pending"
                  : embStatus === "failed" ? "failed"
                  : "partial")
                : embStatus;

              return (
                <div key={lang.key}>
                  {i > 0 && <Separator className="my-2" />}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={checked[lang.key]}
                        onCheckedChange={(v) => setChecked((prev) => ({ ...prev, [lang.key]: !!v }))}
                      />
                      <span className="text-sm font-medium">{lang.label}</span>
                    </div>
                    {statusBadge(overallStatus)}
                  </div>
                  <div className="pl-7 space-y-0.5">
                    {lang.hasTranslation
                      ? renderRow("번역", detail.translation_text, "번역 실행", `translation.${lang.key}` as StepName)
                      : renderRow("원본", detail.translation_text, "", null)
                    }
                    {renderRow("임베딩",
                      detail.embedding.preview ? `[${detail.embedding.preview.slice(0, 5).map(v => v.toFixed(3)).join(", ")}]…` : null,
                      "임베딩 실행",
                      `embedding.${lang.key}` as StepName
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleRunAll} disabled={isRunning}>
            {isRunning ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            전체 실행
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
