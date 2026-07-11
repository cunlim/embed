"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Users } from "lucide-react";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { cn } from "@/lib/utils";

const MENU: { href: string; label: string; icon: typeof Settings; exact?: boolean }[] = [
  { href: "/admin", label: "시스템 설정", icon: Settings, exact: true },
  { href: "/admin/member", label: "회원 관리", icon: Users },
];

export function AdminLayoutClient({
  children,
  initialSidebarCollapsed,
}: {
  readonly children: React.ReactNode;
  readonly initialSidebarCollapsed: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="noise-overlay" />
      <div className="absolute inset-0 bg-grid" />
      <div className="glow-orb -top-40 -right-40 h-96 w-96 bg-blue-500/15 dark:bg-blue-500/10" />
      <div className="glow-orb -bottom-40 -left-40 h-96 w-96 bg-purple-500/15 dark:bg-purple-500/10" />

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 gap-6 px-6 py-12 sm:px-8">
        <CollapsibleSidebar title="관리자" storageKey="admin-sidebar" initialCollapsed={initialSidebarCollapsed}>
          {MENU.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors whitespace-nowrap overflow-hidden",
                  isActive
                    ? "bg-accent/20 text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </CollapsibleSidebar>

        <div className="min-w-0 flex-1">{children}</div>
      </main>
    </div>
  );
}
