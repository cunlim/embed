import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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

  // 미인증 사용자는 서버에서 즉시 리다이렉트 (header 플래시 방지)
  if (!token) {
    redirect("/login?redirect=/mypage");
  }

  let user;
  try {
    user = await getUser(token);
  } catch {
    // 토큰이 만료된 경우에도 서버에서 즉시 리다이렉트
    redirect("/login?redirect=/mypage");
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
