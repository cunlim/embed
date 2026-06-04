"use client";

import { useState, createContext, useContext } from "react";
import { Settings, Inbox, Users } from "lucide-react";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { cn } from "@/lib/utils";

type MenuItem = "settings" | "info" | "users";

const MENU: { id: MenuItem; label: string; icon: typeof Settings }[] = [
  { id: "settings", label: "시스템 설정", icon: Settings },
  { id: "info", label: "안내", icon: Inbox },
  { id: "users", label: "회원 관리", icon: Users },
];

interface AdminMenuContextType {
  active: MenuItem;
  setActive: (id: MenuItem) => void;
}

const AdminMenuContext = createContext<AdminMenuContextType>({
  active: "settings",
  setActive: () => {},
});

export function useAdminMenu() {
  return useContext(AdminMenuContext);
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<MenuItem>("settings");

  return (
    <AdminMenuContext.Provider value={{ active, setActive }}>
      <div className="relative flex min-h-dvh flex-col overflow-hidden">
        <div className="noise-overlay" />
        <div className="absolute inset-0 bg-grid" />
        <div className="glow-orb -top-40 -right-40 h-96 w-96 bg-blue-500/15 dark:bg-blue-500/10" />
        <div className="glow-orb -bottom-40 -left-40 h-96 w-96 bg-purple-500/15 dark:bg-purple-500/10" />

        <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 gap-6 px-6 py-12 sm:px-8">
          <CollapsibleSidebar title="관리자" storageKey="admin-sidebar">
            {MENU.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors whitespace-nowrap overflow-hidden",
                    isActive
                      ? "bg-accent/20 text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </CollapsibleSidebar>

          <div className="min-w-0 flex-1">{children}</div>
        </main>
      </div>
    </AdminMenuContext.Provider>
  );
}
