import { cookies } from "next/headers";
import {
  getUser,
  getApiKeys,
  getUsageStats,
  getUsageHistory,
  getUsageChart,
} from "@/lib/api";
import { MyPageContent } from "./page-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "마이페이지",
};

export default async function MyPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  // 토큰이 없으면 클라이언트에서 전체 URL(쿼리+해시) 포함하여 리다이렉트
  if (!token) {
    return (
      <MyPageContent
        serverUser={null}
        serverApiKeys={[]}
        serverUsageStats={null}
        serverUsageHistory={[]}
        serverChartData={[]}
      />
    );
  }

  let user;
  try {
    user = await getUser(token);
  } catch {
    // 토큰이 만료되면 클라이언트에서 리다이렉트
    return (
      <MyPageContent
        serverUser={null}
        serverApiKeys={[]}
        serverUsageStats={null}
        serverUsageHistory={[]}
        serverChartData={[]}
      />
    );
  }

  const [apiKeysRes, statsRes, historyRes, chartRes] = await Promise.all([
    getApiKeys(token, true).catch(() => ({ data: [] })),
    getUsageStats(token, true).catch(() => ({ data: null })),
    getUsageHistory(token, undefined, true).catch(() => ({ data: [] })),
    getUsageChart(token, undefined, true).catch(() => ({ data: [] })),
  ]);

  return (
    <MyPageContent
      serverUser={user}
      serverApiKeys={apiKeysRes.data}
      serverUsageStats={statsRes.data}
      serverUsageHistory={historyRes.data}
      serverChartData={chartRes.data}
    />
  );
}
