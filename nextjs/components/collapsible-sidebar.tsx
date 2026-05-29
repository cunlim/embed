"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { ChevronLeft, X, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

interface CollapsibleSidebarProps {
  title: string;
  children: React.ReactNode;
  storageKey: string;
  breakpoint?: "sm" | "md" | "lg" | "xl";
}

const BREAKPOINT_MAP = {
  sm: "(min-width: 640px)",
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1280px)",
} as const;

// localStorage 기반 collapsed 상태 관리 (hydration-safe)
function useCollapsedState(storageKey: string) {
  const collapsed = useSyncExternalStore(
    // subscribe: storage 이벤트 리스너
    (onStoreChange) => {
      const handler = (e: StorageEvent) => {
        if (e.key === storageKey) onStoreChange();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
    // getSnapshot: localStorage에서 현재 값 읽기
    () => localStorage.getItem(storageKey) === "collapsed",
    // getServerSnapshot: 서버에서는 항상 false
    () => false,
  );

  const toggle = useCallback(() => {
    const next = !collapsed;
    localStorage.setItem(storageKey, next ? "collapsed" : "expanded");
    // storage 이벤트는 같은 탭에서 발생하지 않으므로 직접 dispatch
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: storageKey,
        newValue: next ? "collapsed" : "expanded",
      }),
    );
  }, [storageKey, collapsed]);

  return [collapsed, toggle] as const;
}

export function CollapsibleSidebar({
  title,
  children,
  storageKey,
  breakpoint = "lg",
}: CollapsibleSidebarProps) {
  const isDesktop = useMediaQuery(BREAKPOINT_MAP[breakpoint]);
  const [collapsed, toggleCollapsed] = useCollapsedState(storageKey);
  const [sheetOpen, setSheetOpen] = useState(false);

  // 모바일: 네비게이션 아이템 클릭 시 Sheet 닫기
  const handleItemClick = useCallback(() => {
    if (!isDesktop) {
      setSheetOpen(false);
    }
  }, [isDesktop]);

  // 데스크톱 렌더링
  if (isDesktop) {
    return (
      <aside
        className={cn(
          "shrink-0 border-r border-border transition-all duration-300 overflow-hidden",
          collapsed ? "w-12" : "w-56"
        )}
      >
        <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col">
          {/* 헤더 */}
          <div className="flex items-center border-b border-border px-3 py-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={toggleCollapsed}
            >
              {collapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
            {!collapsed && (
              <span className="ml-2 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                {title}
              </span>
            )}
          </div>

          {/* 네비게이션 */}
          {!collapsed && (
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {children}
            </nav>
          )}
        </div>
      </aside>
    );
  }

  // 모바일 렌더링
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="fixed top-16 left-3 z-50 h-9 w-9 shadow-sm"
        onClick={() => setSheetOpen(true)}
      >
        <PanelLeft className="h-4 w-4" />
      </Button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <SheetTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {title} 네비게이션 메뉴
            </SheetDescription>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSheetOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <nav
            className="flex-1 overflow-y-auto p-3 space-y-1"
            onClick={handleItemClick}
          >
            {children}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
