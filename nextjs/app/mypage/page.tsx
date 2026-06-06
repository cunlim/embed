import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getUser,
  getApiKeysServer,
  getUsageStatsServer,
  getUsageHistoryServer,
  getUsageChartServer,
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
    getApiKeysServer(token).catch(() => ({ data: [] })),
    getUsageStatsServer(token).catch(() => ({ data: null })),
    getUsageHistoryServer(token).catch(() => ({ data: [] })),
    getUsageChartServer(token).catch(() => ({ data: [] })),
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
