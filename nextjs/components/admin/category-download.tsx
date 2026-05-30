"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download } from "lucide-react";
import { getCategories } from "@/lib/api";
import type { Category, Recommendation } from "@/lib/api";

interface CategoryDownloadProps {
  token: string | null;
  selectedIds: Set<number>;
  categories: (Category | Recommendation)[];
  filter: string | undefined;
  keyword?: string;
}

export default function CategoryDownload({
  token,
  selectedIds,
  categories,
  filter,
  keyword,
}: CategoryDownloadProps) {
  const [error, setError] = useState<string | null>(null);

  /** 엑셀 다운로드 공통 함수 */
  const downloadExcel = useCallback(
    async (data: (Category | Recommendation)[], filename: string) => {
      const XLSX = await import("xlsx");
      const rows = data.map((cat) => ({
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
      XLSX.writeFile(wb, filename);
    },
    [],
  );

  /** 선택다운로드: 체크박스 선택된 카테고리만 엑셀 다운로드 */
  const handleSelectedDownload = useCallback(async () => {
    if (selectedIds.size === 0) {
      alert("선택된 카테고리가 없습니다");
      return;
    }
    const selected = categories.filter((c) => selectedIds.has(c.id));
    await downloadExcel(selected, "카테고리_선택다운로드.xlsx");
  }, [selectedIds, categories, downloadExcel]);

  /** 전체다운로드: 현재 필터 조건에 맞는 전체 카테고리 엑셀 다운로드 */
  const handleFullDownload = useCallback(async () => {
    if (!token) {
      alert("로그인이 필요합니다");
      return;
    }
    try {
      const res = await getCategories(token, 1, 100000, filter, keyword);
      if (res.data.length === 0) {
        alert("다운로드할 카테고리가 없습니다");
        return;
      }
      await downloadExcel(res.data, "카테고리_전체다운로드.xlsx");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "카테고리 목록 조회 실패",
      );
    }
  }, [token, filter, keyword, downloadExcel]);

  return (
    <Card className="p-4">
      <h3 className="font-medium text-sm">다운로드</h3>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectedDownload}
            disabled={selectedIds.size === 0}
            className="flex-1 text-xs"
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            선택다운로드
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFullDownload}
            className="flex-1 text-xs"
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            전체다운로드
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </Card>
  );
}
