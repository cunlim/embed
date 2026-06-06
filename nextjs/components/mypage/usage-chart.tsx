"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUsageStats } from "@/hooks/useUsageStats";

interface UsageChartProps {
  token: string | null;
}

export function UsageChart({ token }: UsageChartProps) {
  const { chart, isLoading } = useUsageStats(token);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const maxValue = chart.length > 0 ? Math.max(...chart.map((d) => d.total), 1) : 1;

  // 바 영역 외부를 클릭하면 활성 바 해제
  useEffect(() => {
    if (!activeDate) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-chart-bar]")) {
        setActiveDate(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [activeDate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">기간별 추이</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-end gap-1" style={{ height: 176 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="flex-1" style={{ height: `${30 + ((i * 17 + 13) % 50)}%` }} />
            ))}
          </div>
        ) : chart.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            차트 데이터가 없습니다.
          </div>
        ) : (
          <div className="flex items-end gap-1" style={{ height: 176 }}>
            {chart.map((point) => {
              const height = Math.max((point.total / maxValue) * 100, 2);
              const dateLabel = point.date.slice(5); // MM-DD
              const isActive = activeDate === point.date;
              return (
                <div
                  key={point.date}
                  data-chart-bar
                  onClick={() => setActiveDate(isActive ? null : point.date)}
                  className="group flex flex-1 cursor-pointer flex-col items-center gap-1"
                >
                  <div className="relative w-full" style={{ height: 140 }}>
                    <div
                      className="absolute bottom-0 w-full rounded-t bg-primary/80 transition-all group-hover:bg-primary"
                      style={{ height: `${height}%` }}
                    />
                    <span
                      className={`pointer-events-none absolute left-1/2 -translate-x-1/2 rounded bg-background/90 px-1 text-[10px] font-medium tabular-nums text-foreground transition-opacity ${
                        isActive
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                      style={{ bottom: `calc(${height}% + 2px)` }}
                    >
                      {point.total}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {dateLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
