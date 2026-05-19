"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { getAllCategories, runStep } from "@/lib/api";

interface BatchTranslateProps {
  token: string | null;
  onComplete?: () => void;
}

export default function BatchTranslate({ token, onComplete }: BatchTranslateProps) {
  const [batchLanguage, setBatchLanguage] = useState("zh");
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    status: string;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
  } | null>(null);

  const handleBatchTranslate = useCallback(async () => {
    if (!token) { alert("로그인이 필요합니다"); return; }
    setIsBatchLoading(true);
    setBatchError(null);
    try {
      const cats = await getAllCategories(token || null);
      const allCategories = cats.data;
      const totalJobs = allCategories.length;

      setBatchProgress({
        status: "processing",
        totalJobs,
        completedJobs: 0,
        failedJobs: 0,
      });

      for (const cat of allCategories) {
        try {
          const steps = [`translation.${batchLanguage}`, `embedding.${batchLanguage}`];
          await Promise.all(
            steps.map((step) => runStep(cat.id, step, token ?? null))
          );
          setBatchProgress((p) =>
            p ? { ...p, completedJobs: p.completedJobs + 1 } : p
          );
        } catch {
          setBatchProgress((p) =>
            p ? { ...p, failedJobs: p.failedJobs + 1 } : p
          );
        }
      }

      setBatchProgress((p) => (p ? { ...p, status: "completed" } : p));
      onComplete?.();
    } catch (err) {
      setBatchError(
        err instanceof Error ? err.message : "일괄 번역 요청에 실패했습니다"
      );
    } finally {
      setIsBatchLoading(false);
    }
  }, [batchLanguage, token, onComplete]);

  const pct =
    batchProgress && batchProgress.totalJobs > 0
      ? Math.round(
          (batchProgress.completedJobs / batchProgress.totalJobs) * 100
        )
      : 0;

  return (
    <Card className="p-4">
      <h3 className="mb-3 font-medium text-sm">일괄 번역</h3>
      <div className="space-y-3">
        <Tabs value={batchLanguage} onValueChange={setBatchLanguage}>
          <TabsList className="w-full">
            <TabsTrigger value="zh" className="flex-1">
              중국어
            </TabsTrigger>
            <TabsTrigger value="en" className="flex-1">
              영어
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          onClick={handleBatchTranslate}
          disabled
          variant="outline"
          className="w-full"
        >
          {isBatchLoading ? "실행 중..." : "전체 번역 실행"}
        </Button>

        {batchError && (
          <p className="text-xs text-destructive">{batchError}</p>
        )}

        {batchProgress && (
          <div className="space-y-2">
            <Progress value={pct} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {batchProgress.completedJobs}/{batchProgress.totalJobs} 완료
              </span>
              <span>
                {batchProgress.failedJobs > 0 &&
                  `${batchProgress.failedJobs} 실패 · `}
                {batchProgress.status === "completed" ? "완료" : "처리 중"}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
