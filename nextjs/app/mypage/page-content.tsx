"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getToken } from "@/hooks/useAuth";
import type { User } from "@/lib/api";
import { ApiKeySection } from "@/components/mypage/api-key-section";
import { UsageDashboard } from "@/components/mypage/usage-dashboard";
import { UsageChart } from "@/components/mypage/usage-chart";
import { UsageHistory } from "@/components/mypage/usage-history";

export function MyPageContent({ serverUser }: { serverUser: User }) {
  const { user, isLoading: authLoading } = useAuth(serverUser);
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login?redirect=/mypage");
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

      <ApiKeySection token={token} />
      <UsageDashboard token={token} />
      <UsageChart token={token} />
      <UsageHistory token={token} />
    </>
  );
}
