"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Square } from "lucide-react";
import {
  getCategories,
  deleteCategory,
} from "@/lib/api";
import type { Category, Recommendation } from "@/lib/api";

interface CategoryDeleteProps {
  token: string | null;
  selectedIds: Set<number>;
  categories: (Category | Recommendation)[];
  filter: string | undefined;
  keyword?: string;
  canModify: (cat: Category | Recommendation) => boolean;
  onComplete: () => void;
  onCategoryComplete?: () => void;
}

interface DeleteProgress {
  total: number;
  completed: number;
  failed: number;
  currentCategory: string;
  queueEmpty: boolean;
}

export default function CategoryDelete({
  token,
  selectedIds,
  categories,
  filter,
  keyword,
  canModify,
  onComplete,
  onCategoryComplete,
}: CategoryDeleteProps) {
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [wasStopped, setWasStopped] = useState(false);
  const [progress, setProgress] = useState<DeleteProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const executeDelete = useCallback(
    async (targetIds: number[]) => {
      setRunning(true);
      setWasStopped(false);
      setStopping(false);
      setError(null);
      abortRef.current = false;

      setProgress({
        total: targetIds.length,
        completed: 0,
        failed: 0,
        currentCategory: "준비 중...",
        queueEmpty: false,
      });

      if (targetIds.length === 0) {
        setProgress((p) =>
          p ? { ...p, queueEmpty: true, currentCategory: "" } : p,
        );
        setRunning(false);
        onComplete();
        return;
      }

      let completed = 0;
      let failed = 0;

      for (const id of targetIds) {
        if (abortRef.current) break;

        const cat = categories.find((c) => c.id === id);
        setProgress((p) =>
          p ? { ...p, currentCategory: cat?.category_name_ko ?? `ID: ${id}` } : p,
        );

        try {
          await deleteCategory(id, token);
          completed++;
          setProgress((p) =>
            p ? { ...p, completed: p.completed + 1 } : p,
          );
          onCategoryComplete?.();
        } catch {
          failed++;
          setProgress((p) =>
            p ? { ...p, failed: p.failed + 1 } : p,
          );
        }
      }

      if (abortRef.current) {
        setStopping(false);
        setRunning(false);
        setWasStopped(true);
        return;
      }

      setRunning(false);
      onComplete();
    },
    [token, categories, onComplete, onCategoryComplete],
  );

  const handleSelectedDelete = useCallback(async () => {
    if (!token) {
      alert("로그인이 필요합니다");
      return;
    }
    const targetIds = Array.from(selectedIds).filter((id) => {
      const cat = categories.find((c) => c.id === id);
      return cat && canModify(cat);
    });
    if (targetIds.length === 0) {
      alert("선택된 삭제 가능한 카테고리가 없습니다");
      return;
    }
    if (!window.confirm(`선택한 ${targetIds.length}개 카테고리를 삭제하시겠습니까?`)) return;
    await executeDelete(targetIds);
  }, [token, selectedIds, categories, canModify, executeDelete]);

  const handleFullDelete = useCallback(async () => {
    if (!token) {
      alert("로그인이 필요합니다");
      return;
    }
    try {
      const res = await getCategories(token, 1, 100000, filter, keyword);
      const targetIds = res.data
        .filter((cat) => canModify(cat))
        .map((cat) => cat.id);
      if (targetIds.length === 0) {
        alert("삭제 가능한 카테고리가 없습니다");
        return;
      }
      if (!window.confirm(`현재 필터에 해당하는 ${targetIds.length}개 카테고리를 삭제하시겠습니까?`)) return;
      await executeDelete(targetIds);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "카테고리 목록 조회 실패",
      );
    }
  }, [token, filter, keyword, canModify, executeDelete]);

  const handleStop = useCallback(() => {
    abortRef.current = true;
    setStopping(true);
    setWasStopped(true);
  }, []);

  const pct =
    progress && progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  return (
    <Card className="p-4">
      <h3 className="font-medium text-sm">삭제</h3>
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSelectedDelete}
            disabled={running || selectedIds.size === 0}
            className="flex-1"
          >
            선택삭제
          </Button>
          <Button
            variant="destructive"
            onClick={handleFullDelete}
            disabled={running}
            className="flex-1"
          >
            전체삭제
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
              {!progress.queueEmpty && progress.total > 0 && (
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  [{progress.completed + progress.failed}/{progress.total}]
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>
                전체 {progress.total}개 / 완료 {progress.completed}개 / 실패{" "}
                {progress.failed}개
              </p>
              {progress.queueEmpty && (
                <p>삭제할 카테고리가 없습니다</p>
              )}
              {!progress.queueEmpty && progress.currentCategory && (
                <p className="truncate">
                  현재: &ldquo;{progress.currentCategory}&rdquo;
                </p>
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
                {stopping ? "중지 중..." : "삭제중지"}
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
