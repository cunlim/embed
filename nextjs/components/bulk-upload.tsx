"use client";

import { useState, useCallback } from "react";
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface BulkUploadProps {
  token?: string | null;
  onSuccess: () => void;
}

interface RowResult {
  row: number;
  success: boolean;
  message?: string;
  categoryCode?: string;
  categoryNameKo?: string;
}

export default function BulkUpload({ token, onSuccess }: BulkUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentRow, setCurrentRow] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [results, setResults] = useState<RowResult[] | null>(null);

  const successCount = results?.filter((r) => r.success).length ?? 0;
  const failCount = results?.filter((r) => !r.success).length ?? 0;

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResults(null);
      setCurrentRow(0);
      setTotalRows(0);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;

    setIsProcessing(true);
    setResults(null);

    const XLSX = await import("xlsx");
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
    });

    // 2행부터 데이터 (index 1부터)
    const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell !== null && cell !== ""));
    setTotalRows(dataRows.length);

    const rowResults: RowResult[] = [];
    const { createCategory } = await import("@/lib/api");

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // 엑셀 행 번호 (1-based, 헤더 포함)
      setCurrentRow(i + 1);

      const code = row[0] ? String(row[0]).trim() : undefined;
      const nameKo = row[1] ? String(row[1]).trim() : "";
      const nameEn = row[2] ? String(row[2]).trim() : undefined;
      const nameZh = row[3] ? String(row[3]).trim() : undefined;

      // B열(한국어) 필수 검증
      if (!nameKo) {
        rowResults.push({
          row: rowNum,
          success: false,
          message: "한국어 카테고리명(B열)이 비어있습니다",
        });
        setResults([...rowResults]);
        continue;
      }

      try {
        await createCategory(nameKo, token, code, nameEn, nameZh);
        rowResults.push({
          row: rowNum,
          success: true,
          categoryCode: code,
          categoryNameKo: nameKo,
        });
      } catch (err) {
        rowResults.push({
          row: rowNum,
          success: false,
          message: err instanceof Error ? err.message : "알 수 없는 오류",
          categoryCode: code,
          categoryNameKo: nameKo,
        });
      }

      setResults([...rowResults]);
    }

    setIsProcessing(false);
    if (rowResults.some((r) => r.success)) {
      onSuccess();
    }
  }, [file, token, onSuccess]);

  const handleReset = useCallback(() => {
    setFile(null);
    setResults(null);
    setCurrentRow(0);
    setTotalRows(0);
  }, []);

  return (
    <div className="space-y-3">
      {/* 샘플 다운로드 */}
      <a
        href="/samples/카테고리대량등록_v1.xlsx"
        download
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Download className="h-3.5 w-3.5" />
        샘플 다운로드
      </a>

      {/* 파일 선택 */}
      {!results && (
        <>
          <label
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-4 cursor-pointer transition-colors",
              "hover:border-primary/40 hover:bg-muted/30",
            )}
          >
            <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {file ? file.name : "xlsx 파일을 선택하세요"}
            </span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <Button
            onClick={handleUpload}
            disabled={!file || isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                처리 중... ({currentRow}/{totalRows})
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                업로드
              </>
            )}
          </Button>
        </>
      )}

      {/* 진행률 */}
      {isProcessing && totalRows > 0 && (
        <Progress value={(currentRow / totalRows) * 100}>
          <ProgressLabel>진행률</ProgressLabel>
          <ProgressValue />
        </Progress>
      )}

      {/* 결과 통계 */}
      {results && (
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              성공 {successCount}건
            </span>
            <span className="flex items-center gap-1 text-destructive">
              <XCircle className="h-4 w-4" />
              실패 {failCount}건
            </span>
          </div>

          {/* 실패 행 목록 */}
          {failCount > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-destructive/30 bg-destructive/5 p-2">
              <p className="mb-1 text-xs font-medium text-destructive">실패 목록</p>
              {results
                .filter((r) => !r.success)
                .map((r) => (
                  <p key={r.row} className="text-xs text-muted-foreground">
                    {r.row}행: {r.message}
                    {r.categoryNameKo && ` (${r.categoryNameKo})`}
                  </p>
                ))}
            </div>
          )}

          <Button variant="outline" onClick={handleReset} className="w-full">
            <RefreshCw className="h-4 w-4" />
            다시 업로드
          </Button>
        </div>
      )}
    </div>
  );
}
