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

type MyPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function MyPage({ searchParams }: MyPageProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  // 쿼리 파라미터를 포함한 redirect 경로 생성
  const sp = await searchParams;
  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]
  ).toString();
  const redirectPath = qs ? `/mypage?${qs}` : "/mypage";

  // 미인증 사용자는 서버에서 즉시 리다이렉트 (header 플래시 방지)
  if (!token) {
    redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  }

  let user;
  try {
    user = await getUser(token);
  } catch {
    // 토큰이 만료된 경우에도 서버에서 즉시 리다이렉트
    redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`);
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
