"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getToken } from "@/hooks/useAuth";

export default function EmbedPage() {
  const router = useRouter();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    if (mounted && !getToken()) {
      router.replace("/login?redirect=/embed");
    }
  }, [mounted, router]);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="noise-overlay" />
      <div className="absolute inset-0 bg-grid" />
      <div className="glow-orb -top-40 -right-40 h-96 w-96 bg-blue-500/15 dark:bg-blue-500/10" />
      <div className="glow-orb -bottom-40 -left-40 h-96 w-96 bg-purple-500/15 dark:bg-purple-500/10" />

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12 sm:px-8">
        <div className="flex flex-1 items-center justify-center">
          <Card className="flex flex-col items-center gap-4 py-16 px-8 max-w-md text-center">
            <Inbox className="h-12 w-12 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">기능이 이전되었습니다</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                카테고리 추천 기능이 관리자 페이지로 통합되었습니다.
              </p>
            </div>
            <Button asChild>
              <Link href="/admin">
                관리자 페이지로 이동
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </Card>
        </div>
      </main>
    </div>
  );
}
