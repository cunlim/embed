"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, getToken } from "@/hooks/useAuth";
import { isSuperAdmin } from "@/lib/utils";
import { SettingsPanel } from "@/components/admin/settings-panel";

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!mounted || authLoading) return;

    if (!user) {
      router.replace("/login?redirect=/admin");
    } else if (!isSuperAdmin(user)) {
      router.back();
    }
  }, [mounted, authLoading, user, router]);

  if (!mounted || !user || !isSuperAdmin(user)) return null;

  const token = getToken();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="noise-overlay" />
      <div className="absolute inset-0 bg-grid" />
      <div className="glow-orb -top-40 -right-40 h-96 w-96 bg-blue-500/15 dark:bg-blue-500/10" />
      <div className="glow-orb -bottom-40 -left-40 h-96 w-96 bg-purple-500/15 dark:bg-purple-500/10" />

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12 sm:px-8">
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="info">안내</TabsTrigger>
            <TabsTrigger value="settings">시스템 설정</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <div className="flex flex-1 items-center justify-center">
              <Card className="flex flex-col items-center gap-4 py-16 px-8 max-w-md text-center">
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
          </TabsContent>

          <TabsContent value="settings">
            <SettingsPanel token={token} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
