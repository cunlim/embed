import { Activity, CalendarDays, BarChart3, Key } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UsageStats } from "@/lib/api";

interface UsageDashboardProps {
  stats: UsageStats | null;
}

const STATS = [
  {
    key: "total_calls" as const,
    label: "총 호출",
    icon: Activity,
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "today_calls" as const,
    label: "오늘 호출",
    icon: CalendarDays,
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "quota_remaining" as const,
    label: "남은 회수",
    icon: BarChart3,
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "active_keys" as const,
    label: "활성 key",
    icon: Key,
    format: (v: number) => String(v),
  },
] as const;

export function UsageDashboard({ stats }: UsageDashboardProps) {

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">사용량 현황</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS.map(({ key, label, icon: Icon, format }) => (
            <div
              key={key}
              className="flex flex-col items-center gap-1 rounded-lg border p-4 text-center"
            >
              <Icon className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">
                {stats ? format(stats[key]) : "0"}
              </span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
        {stats && stats.quota_limit > 0 && (
          <div className="mt-4 text-center text-xs text-muted-foreground">
            전체 한도: {stats.quota_limit.toLocaleString()}회
          </div>
        )}
      </CardContent>
    </Card>
  );
}
