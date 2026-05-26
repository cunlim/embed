"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Inbox, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth, getToken } from "@/hooks/useAuth";
import { isSuperAdmin } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { SettingsPanel } from "@/components/admin/settings-panel";

type MenuItem = "settings" | "info";

const MENU: { id: MenuItem; label: string; icon: typeof Settings }[] = [
  { id: "settings", label: "시스템 설정", icon: Settings },
  { id: "info", label: "안내", icon: Inbox },
];

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [active, setActive] = useState<MenuItem>("settings");
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

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 gap-6 px-6 py-12 sm:px-8">
        <nav className="w-44 shrink-0">
          <Card className="p-1.5">
            {MENU.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </Card>
        </nav>

        <div className="min-w-0 flex-1">
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
        </div>
      </main>
    </div>
  );
}
