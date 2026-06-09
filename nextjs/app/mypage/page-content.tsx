"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getToken } from "@/hooks/useAuth";
import type {
  User,
  ApiKeyItem,
  UsageStats,
  UsageHistoryItem,
  ChartDataPoint,
} from "@/lib/api";
import { ApiKeySection } from "@/components/mypage/api-key-section";
import { UsageDashboard } from "@/components/mypage/usage-dashboard";
import { UsageChart } from "@/components/mypage/usage-chart";
import { UsageHistory } from "@/components/mypage/usage-history";

interface MyPageContentProps {
  serverUser: User | null;
  serverApiKeys: ApiKeyItem[];
  serverUsageStats: UsageStats | null;
  serverUsageHistory: UsageHistoryItem[];
  serverChartData: ChartDataPoint[];
}

export function MyPageContent({
  serverUser,
  serverApiKeys,
  serverUsageStats,
  serverUsageHistory,
  serverChartData,
}: MyPageContentProps) {
  const { user, isLoading: authLoading } = useAuth(serverUser);
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const fullPath = window.location.pathname + window.location.search + window.location.hash;
      router.replace(`/login?redirect=${encodeURIComponent(fullPath)}`);
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  const token = getToken();

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">마이페이지</h1>
        <p className="text-muted-foreground">
          API key 관리 및 사용량을 확인할 수 있습니다.
        </p>
      </div>

      <ApiKeySection token={token} initialApiKeys={serverApiKeys} />
      <UsageDashboard stats={serverUsageStats} />
      <UsageChart chart={serverChartData} />
      <UsageHistory history={serverUsageHistory} />
    </>
  );
}
