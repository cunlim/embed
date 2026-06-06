"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUsageStats } from "@/hooks/useUsageStats";

interface UsageChartProps {
  token: string | null;
}

export function UsageChart({ token }: UsageChartProps) {
  const { chart, isLoading } = useUsageStats(token);

  const maxValue = chart.length > 0 ? Math.max(...chart.map((d) => d.total), 1) : 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">기간별 추이</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-end gap-1" style={{ height: 160 }}>
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
              return (
                <div
                  key={point.date}
                  className="group flex flex-1 flex-col items-center gap-1"
                >
                  <span className="text-[10px] font-medium tabular-nums text-foreground">
                    {point.total}
                  </span>
                  <div className="relative w-full" style={{ height: 140 }}>
                    <div
                      className="absolute bottom-0 w-full rounded-t bg-primary/80 transition-all group-hover:bg-primary"
                      style={{ height: `${height}%` }}
                    />
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
