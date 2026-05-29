"use client";

import { useState, useRef } from "react";
import { Copy, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { Recommendation } from "@/lib/api";

interface CosineDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: Recommendation | null;
  searchKeyword?: string;
  targetLanguage?: string;
}

// --- Helpers ---

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast("클립보드에 복사되었습니다");
  } catch {
    toast("복사에 실패했습니다");
  }
}

export function formatEmbeddingPreview(embedding: number[] | null): string {
  if (!embedding || embedding.length === 0) return "—";
  const previewCount = Math.min(6, embedding.length);
  const preview = embedding.slice(0, previewCount).map((v) => v.toFixed(3)).join(", ");
  if (embedding.length <= 6) return `[${preview}]`;
  return `[${preview}, ...]`;
}

export function dotProductExpression(a: number[], b: number[]): string {
  const len = Math.min(a.length, b.length);
  return Array.from({ length: len }, (_, i) => `(${a[i]}*${b[i]})`).join("+");
}

export function normExpression(v: number[]): string {
  return v.map((x) => `(${x})**2`).join("+");
}

export function pythonExpression(a: number[], b: number[]): string {
  const dotExpr = dotProductExpression(a, b);
  const normAExpr = normExpression(a);
  const normBExpr = normExpression(b);
  return `print((${dotExpr})/(((${normAExpr})**0.5)*((${normBExpr})**0.5)))`;
}

export function firstDotTerm(a: number[], b: number[]): string {
  if (a.length === 0 || b.length === 0) return "—";
  return `(${a[0].toFixed(3)}×${b[0].toFixed(3)})`;
}

// --- SVG ---

function VectorAngleSvg({ similarityScore }: { similarityScore: number }) {
  const cx = 52, cy = 52, r = 40;
  const clamped = Math.min(1, Math.max(-1, similarityScore));
  const theta = Math.acos(clamped);
  const thetaDeg = (theta * 180) / Math.PI;

  // A: 3 o'clock (0 rad)
  const ax = cx + r, ay = cy;
  // B: counter-clockwise from A by theta (SVG y down → subtract sin)
  const bx = cx + r * Math.cos(theta);
  const by = cy - r * Math.sin(theta);

  // Arrow head size
  const headLen = 6, headW = 3;

  // A arrow head (pointing right)
  const aHeadPts = `${ax},${ay} ${ax - headLen},${ay - headW} ${ax - headLen},${ay + headW}`;

  // B arrow head (pointing toward tip from center)
  const bdx = (bx - cx) / r; // direction cos
  const bdy = (by - cy) / r; // direction sin (negative for upward in SVG)
  // perpendicular (clockwise 90° in SVG): (bdy', -bdx') = (bdy, -bdx)
  const bpx = bdy, bpy = -bdx;
  const baseX = bx - headLen * bdx;
  const baseY = by - headLen * bdy;
  const bHead1x = baseX + headW * bpx;
  const bHead1y = baseY + headW * bpy;
  const bHead2x = baseX - headW * bpx;
  const bHead2y = baseY - headW * bpy;
  const bHeadPts = `${bx},${by} ${bHead1x.toFixed(1)},${bHead1y.toFixed(1)} ${bHead2x.toFixed(1)},${bHead2y.toFixed(1)}`;

  // Angle arc (radius 16, from angle 0 to theta counter-clockwise)
  const arcR = 16;
  const arcStartX = cx + arcR;
  const arcStartY = cy;
  const arcEndX = cx + arcR * Math.cos(theta);
  const arcEndY = cy - arcR * Math.sin(theta);
  const arcPath = `M ${arcStartX},${arcStartY} A ${arcR},${arcR} 0 0,0 ${arcEndX.toFixed(1)},${arcEndY.toFixed(1)}`;

  // θ label at arc midpoint (radius 22)
  const labelR = 24;
  const labelX = cx + labelR * Math.cos(theta / 2);
  const labelY = cy - labelR * Math.sin(theta / 2);

  return (
    <svg viewBox="0 0 110 110" className="h-24 w-24 shrink-0" aria-label={`코사인 유사도 각도 ${thetaDeg.toFixed(1)}°`}>
      {/* Dashed circle background */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} strokeDasharray="4 3" />

      {/* Axis lines */}
      <line x1={cx} y1={14} x2={cx} y2={90} stroke="currentColor" strokeOpacity={0.1} strokeWidth={0.5} />
      <line x1={14} y1={cy} x2={90} y2={cy} stroke="currentColor" strokeOpacity={0.1} strokeWidth={0.5} />
      <text x={92} y={cy - 4} fill="currentColor" opacity={0.2} fontSize={7}>x</text>
      <text x={cx + 4} y={16} fill="currentColor" opacity={0.2} fontSize={7}>y</text>

      {/* Angle arc */}
      <path d={arcPath} fill="none" stroke="currentColor" strokeOpacity={0.3} strokeWidth={1.5} />
      <text x={labelX} y={labelY} fill="currentColor" fontSize={9} textAnchor="middle" dominantBaseline="central" fontWeight={600}>
        θ
      </text>

      {/* A vector (blue) */}
      <line x1={cx} y1={cy} x2={ax} y2={ay} stroke="#3b82f6" strokeWidth={2.5} />
      <polygon points={aHeadPts} fill="#3b82f6" />
      <text x={ax + 4} y={ay - 4} fill="#3b82f6" fontSize={10} fontWeight={700}>A</text>

      {/* B vector (red) */}
      <line x1={cx} y1={cy} x2={bx} y2={by} stroke="#ef4444" strokeWidth={2.5} />
      <polygon points={bHeadPts} fill="#ef4444" />
      <text x={bx + 2} y={by - 4} fill="#ef4444" fontSize={10} fontWeight={700}>B</text>

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={2.5} fill="currentColor" />
    </svg>
  );
}

// --- Main ---

export default function CosineDetailDialog({
  open,
  onOpenChange,
  result,
  searchKeyword,
  targetLanguage = "ko",
}: CosineDetailDialogProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<"ko" | "en" | "zh">(targetLanguage as "ko" | "en" | "zh");
  const prevOpenRef = useRef(open);

  // 모달이 열릴 때 targetLanguage로 초기화
  // eslint-disable-next-line react-hooks/refs -- 모달 open 시점에만 상태 초기화 필요
  if (open && !prevOpenRef.current) {
    setSelectedLanguage(targetLanguage as "ko" | "en" | "zh");
  }
  // eslint-disable-next-line react-hooks/refs
  prevOpenRef.current = open;

  if (!result) return null;

  // 선택된 언어의 데이터 추출
  const selectedScores = result.per_language_scores?.[selectedLanguage];
  const score = selectedScores?.similarity_score ?? result.similarity_score ?? 0;
  const clampedScore = Math.min(1, Math.max(-1, score));
  const scorePercent = (score * 100).toFixed(1);
  const thetaDeg = ((Math.acos(clampedScore) * 180) / Math.PI).toFixed(1);
  const aEmb = result.query_embedding;
  // 선택된 언어의 카테고리 임베딩 사용, 없으면 기본값
  const bEmb = selectedScores?.category_embedding ?? result.category_embedding;
  const normA = aEmb ? Math.sqrt(aEmb.reduce((s, v) => s + v * v, 0)) : 1;
  const normB = bEmb ? Math.sqrt(bEmb.reduce((s, v) => s + v * v, 0)) : 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-sm">
            <Hash className="h-4 w-4" />
            코사인 유사도 상세
          </DialogTitle>
          <DialogDescription className="sr-only">
            검색어와 카테고리 임베딩 간 코사인 유사도 상세 정보
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-6">
          {/* 유사도 점수 */}
          <div className="flex items-center justify-center gap-4">
            <VectorAngleSvg similarityScore={score} />
            <div className="text-left">
              <p className="font-mono text-3xl font-bold tabular-nums">
                {scorePercent}%
              </p>
              <p className="text-xs text-muted-foreground">
                cos θ = {score.toFixed(4)}
              </p>
              <p className="text-xs text-muted-foreground">
                θ = {thetaDeg}°
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
          {/* A. 검색어 임베딩 */}
          <div className="space-y-1">
            <p className="min-w-0 truncate text-xs text-[#3b82f6]">
              <span className="font-medium">A</span>. {searchKeyword ?? result.category_name} (검색어 임베딩)
            </p>
            <div className="min-w-0 flex items-center gap-2 rounded bg-muted/50 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-[#3b82f6]">
                {formatEmbeddingPreview(aEmb)}
              </span>
              {aEmb && aEmb.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-[#3b82f6] hover:text-[#3b82f6]"
                  onClick={() => copyToClipboard(JSON.stringify(aEmb))}
                  title="임베딩 벡터 복사"
                >
                  <Copy className="!size-3" />
                </Button>
              )}
            </div>
          </div>

          {/* B. 카테고리 임베딩 */}
          <div className="space-y-1">
            <p className="min-w-0 truncate text-xs text-[#ef4444]">
              <span className="font-medium">B</span>. {result.category_name} (카테고리 임베딩)
            </p>
            <div className="min-w-0 flex items-center gap-2 rounded bg-muted/50 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-[#ef4444]">
                {formatEmbeddingPreview(bEmb)}
              </span>
              {bEmb && bEmb.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-[#ef4444] hover:text-[#ef4444]"
                  onClick={() => copyToClipboard(JSON.stringify(bEmb))}
                  title="임베딩 벡터 복사"
                >
                  <Copy className="!size-3" />
                </Button>
              )}
            </div>
          </div>
        </div>

          <Separator />

          {/* 계산 과정 */}
          <div className="space-y-2">
            <span className="text-xs font-medium inline-block">계산 과정 <span className="text-[10px] text-muted-foreground font-normal">(전체 dot product 식으로 복사)</span></span>
            <div className="min-w-0 flex items-center gap-2 rounded bg-muted/50 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {aEmb && bEmb && aEmb.length > 0 && bEmb.length > 0 ? (
                  <>
                    cos(θ) = (<span className="text-[#3b82f6]">A</span>·<span className="text-[#ef4444]">B</span>) / (|<span className="text-[#3b82f6]">A</span>|×|<span className="text-[#ef4444]">B</span>|) = ((<span className="text-[#3b82f6]">{aEmb[0].toFixed(3)}</span>×<span className="text-[#ef4444]">{bEmb[0].toFixed(3)}</span>) + ...) / (<span className="text-[#3b82f6]">{normA.toFixed(4)}</span>×<span className="text-[#ef4444]">{normB.toFixed(4)}</span>) = {score.toFixed(4)}
                  </>
                ) : (
                  "—"
                )}
              </span>
              {aEmb && bEmb && aEmb.length > 0 && bEmb.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => copyToClipboard(pythonExpression(aEmb, bEmb))}
                  title="python 계산식 복사"
                >
                  <Copy className="!size-3" />
                </Button>
              )}
            </div>

          </div>

          {result.per_language_scores && (
            <>
              <Separator />

              <div className="space-y-2">
                <span className="text-xs font-medium inline-block">언어별 유사도 ({result.category_code})</span>
                <div className="flex flex-col gap-2">
                  {(
                    [
                      { code: "ko", label: "한국어", name: result.category_name_ko },
                      { code: "en", label: "English", name: result.category_name_en },
                      { code: "zh", label: "中文", name: result.category_name_zh },
                    ] as const
                  ).map(({ code, label, name }) => {
                    const scores = result.per_language_scores![code];
                    const isSelected = code === selectedLanguage;
                    return (
                      <label
                        key={code}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                          isSelected
                            ? "border-primary ring-2 ring-primary shadow-md bg-primary/5"
                            : "border-muted-foreground/15 bg-muted/30 hover:bg-muted/50"
                        )}
                      >
                        <input
                          type="radio"
                          name="modal-language"
                          value={code}
                          checked={isSelected}
                          onChange={() => setSelectedLanguage(code)}
                          className="sr-only"
                        />
                        <span
                          className={cn(
                            "flex items-center justify-center w-4 h-4 rounded-full border-2 shrink-0",
                            isSelected
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/30"
                          )}
                        >
                          {isSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-medium min-w-[42px]",
                            isSelected ? "text-primary" : "text-muted-foreground"
                          )}
                        >
                          {label}
                        </span>
                        <span className="flex-1 min-w-0 truncate text-xs">
                          {name ?? "—"}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 font-mono text-base font-bold tabular-nums",
                            !isSelected && "text-muted-foreground"
                          )}
                        >
                          {scores.similarity_score != null
                            ? `${(scores.similarity_score * 100).toFixed(1)}%`
                            : "—"}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded",
                            isSelected
                              ? "bg-primary/10 text-primary"
                              : "bg-muted/50 text-muted-foreground"
                          )}
                        >
                          {scores.rank != null ? `${scores.rank}위` : "—"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
