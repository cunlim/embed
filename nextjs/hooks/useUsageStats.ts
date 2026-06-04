"use client";

import { useState, useCallback, useEffect } from "react";
import {
  getUsageStats,
  getUsageHistory,
  getUsageChart,
  type UsageStats,
  type UsageHistoryItem,
  type ChartDataPoint,
} from "@/lib/api";

interface UseUsageStatsReturn {
  stats: UsageStats | null;
  history: UsageHistoryItem[];
  chart: ChartDataPoint[];
  isLoading: boolean;
  error: string | null;
  loadStats: () => Promise<void>;
  loadHistory: (limit?: number) => Promise<void>;
  loadChart: (days?: number) => Promise<void>;
}

export function useUsageStats(token?: string | null): UseUsageStatsReturn {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [history, setHistory] = useState<UsageHistoryItem[]>([]);
  const [chart, setChart] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(!!token);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUsageStats(token);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "사용량 통계를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const loadHistory = useCallback(
    async (limit?: number) => {
      if (!token) return;
      try {
        const response = await getUsageHistory(token, limit);
        setHistory(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "호출 이력을 불러오지 못했습니다.");
      }
    },
    [token],
  );

  const loadChart = useCallback(
    async (days?: number) => {
      if (!token) return;
      try {
        const response = await getUsageChart(token, days);
        setChart(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "차트 데이터를 불러오지 못했습니다.");
      }
    },
    [token],
  );

  useEffect(() => {
    async function init() {
      await Promise.all([loadStats(), loadHistory(), loadChart()]);
    }
    init();
  }, [loadStats, loadHistory, loadChart]);

  return {
    stats,
    history,
    chart,
    isLoading,
    error,
    loadStats,
    loadHistory,
    loadChart,
  };
}
