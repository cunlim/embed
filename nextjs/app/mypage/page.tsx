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

export default async function MyPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    redirect("/login?redirect=/mypage");
  }

  let user;
  try {
    user = await getUser(token);
  } catch {
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
