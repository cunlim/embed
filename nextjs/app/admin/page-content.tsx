"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth, getToken } from "@/hooks/useAuth";
import type { User } from "@/lib/api";
import { SettingsPanel } from "@/components/admin/settings-panel";
import { useAdminMenu } from "./layout";

export function AdminPageContent({ serverUser }: { serverUser: User }) {
  const { user, isLoading: authLoading } = useAuth(serverUser);
  const router = useRouter();
  const { active } = useAdminMenu();

  // SSR에서 이미 superadmin 검증을 마쳤으므로, 클라이언트에서는
  // 토큰 만료 등 예외 상황에서만 리다이렉트
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login?redirect=/admin");
    }
  }, [authLoading, user, router]);

  // authLoading 중이거나 user가 없는 상태에서는 아무것도 렌더링하지 않음
  if (authLoading || !user) return null;

  const token = getToken();

  return (
    <>
      {active === "settings" && <SettingsPanel token={token} />}
      {active === "info" && (
        <div className="flex items-center justify-center">
          <Card className="flex w-full max-w-md flex-col items-center gap-4 px-8 py-16 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">기능이 이전되었습니다</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                카테고리 추천 기능이 임베드 페이지로 통합되었습니다.
              </p>
            </div>
            <Button asChild>
              <Link href="/embed">
                임베드 페이지로 이동
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </Card>
        </div>
      )}
    </>
  );
}
