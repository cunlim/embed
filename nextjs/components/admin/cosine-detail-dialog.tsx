"use client";

import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Recommendation } from "@/lib/api";

interface CosineDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: Recommendation | null;
}

const vectorSteps = [
  { label: "검색어 입력", description: "사용자 텍스트 수신" },
  { label: "정규화", description: "공백 정리, 특수문자 처리" },
  { label: "임베딩 생성", description: "bge-m3 (1024차원)" },
  { label: "pgvector 유사도 검색", description: "코사인 유사도 계산" },
  { label: "결과 매핑", description: "카테고리 코드/이름 매핑" },
];

export default function CosineDetailDialog({
  open,
  onOpenChange,
  result,
}: CosineDetailDialogProps) {
  if (!result) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-sm">
            <FileText className="h-4 w-4" />
            코사인 유사도 상세
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">카테고리</p>
            <p className="font-medium">{result.category_name}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {result.category_code}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">유사도 점수</p>
            <p className="text-accent font-mono text-2xl font-bold">
              {((result.similarity_score ?? 0) * 100).toFixed(1)}%
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">처리 과정</p>
            {vectorSteps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
              >
                <Badge variant="secondary" className="shrink-0 font-mono text-xs">
                  {idx + 1}
                </Badge>
                <div>
                  <p className="text-xs font-medium">{step.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
