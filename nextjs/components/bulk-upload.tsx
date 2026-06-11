"use client";

import { useState, useCallback, type DragEvent } from "react";
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { bulkUpload } from "@/lib/api";
import type { BulkUploadRowResult } from "@/lib/api";

interface BulkUploadProps {
  token?: string | null;
  onSuccess: () => void;
  folder?: string;
}

export default function BulkUpload({ token, onSuccess, folder }: BulkUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<BulkUploadRowResult[] | null>(null);
  const [summary, setSummary] = useState<{ total: number; success: number; failed: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const successCount = summary?.success ?? 0;
  const failCount = summary?.failed ?? 0;

  /** 파일 상태 초기화 후 선택된 파일 설정 (xlsx/xls 검증 포함) */
  const applyFile = useCallback((selected: File) => {
    const ext = selected.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") return;
    setFile(selected);
    setResults(null);
    setSummary(null);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) applyFile(selected);
    },
    [applyFile],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) applyFile(dropped);
    },
    [applyFile],
  );

  const handleUpload = useCallback(async () => {
    if (!file) return;

    setIsProcessing(true);
    setResults(null);
    setSummary(null);

    try {
      const res = await bulkUpload(file, token, folder);
      setResults(res.data.results);
      setSummary(res.data.summary);

      if (res.data.summary.success > 0) {
        onSuccess();
      }
    } catch (err) {
      setResults([{
        row: 0,
        success: false,
        message: err instanceof Error ? err.message : "업로드 실패",
      }]);
      setSummary({ total: 0, success: 0, failed: 1 });
    } finally {
      setIsProcessing(false);
    }
  }, [file, token, folder, onSuccess]);

  const handleReset = useCallback(() => {
    setFile(null);
    setResults(null);
    setSummary(null);
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
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-4 cursor-pointer transition-colors",
              "hover:border-primary/40 hover:bg-muted/30",
              isDragging && "border-primary bg-primary/5",
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
                서버에서 처리 중...
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

      {/* 결과 통계 */}
      {results && summary && (
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
                    {r.row > 0 ? `${r.row}행: ` : ""}{r.message}
                    {r.category_name_ko && ` (${r.category_name_ko})`}
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
