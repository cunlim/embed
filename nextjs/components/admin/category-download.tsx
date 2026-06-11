"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { bulkDownload } from "@/lib/api";
import type { Category, Recommendation } from "@/lib/api";

interface CategoryDownloadProps {
  token: string | null;
  selectedIds: Set<number>;
  categories: (Category | Recommendation)[];
  filter: string | undefined;
  keyword?: string;
  folder?: string;
}

export default function CategoryDownload({
  token,
  selectedIds,
  categories,
  filter,
  keyword,
  folder,
}: CategoryDownloadProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 선택다운로드: 클라이언트에서 이미 로드된 데이터로 엑셀 생성 */
  const handleSelectedDownload = useCallback(async () => {
    if (selectedIds.size === 0) {
      alert("선택된 카테고리가 없습니다");
      return;
    }
    const XLSX = await import("xlsx");
    const selected = categories.filter((c) => selectedIds.has(c.id));
    const rows = selected.map((cat) => ({
      category_code: cat.category_code ?? "",
      category_ko: cat.category_name_ko ?? "",
      category_en: cat.category_name_en ?? "",
      category_zh: cat.category_name_zh ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows, {
      header: ["category_code", "category_ko", "category_en", "category_zh"],
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "카테고리");
    XLSX.writeFile(wb, "카테고리_선택다운로드.xlsx");
  }, [selectedIds, categories]);

  /** 전체다운로드: 서버에서 xlsx 파일을 스트리밍 다운로드 */
  const handleFullDownload = useCallback(async () => {
    if (!token) {
      alert("로그인이 필요합니다");
      return;
    }
    setDownloading(true);
    setError(null);
    try {
      const blob = await bulkDownload(token, { filter, search: keyword, folder });
      if (blob.size === 0) {
        alert("다운로드할 카테고리가 없습니다");
        return;
      }
      // Blob을 파일로 다운로드
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `categories_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "다운로드 실패",
      );
    } finally {
      setDownloading(false);
    }
  }, [token, filter, keyword, folder]);

  return (
    <Card className="p-4">
      <h3 className="font-medium text-sm">다운로드</h3>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            onClick={handleSelectedDownload}
            disabled={selectedIds.size === 0}
            className="flex-1"
          >
            선택다운로드
          </Button>
          <Button
            onClick={handleFullDownload}
            disabled={downloading}
            className="flex-1"
          >
            {downloading ? "다운로드 중..." : "전체다운로드"}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </Card>
  );
}
