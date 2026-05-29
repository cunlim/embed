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
import { cn } from "@/lib/utils";

interface CollapsibleSidebarProps {
  title: string;
  children: React.ReactNode;
  storageKey: string;
}

/**
 * localStorage 기반 collapsed 상태 관리 (hydration-safe)
 * - 서버: 항상 false 반환 (ChevronLeft 아이콘, 펼쳐진 상태)
 * - 클라이언트 첫 렌더: false 반환 (서버와 일치 → hydration mismatch 없음)
 * - 클라이언트 동기화 후: localStorage 값으로 업데이트
 */
function useCollapsedState(storageKey: string) {
  const collapsed = useSyncExternalStore(
    // subscribe: storage 이벤트 + 커스텀 이벤트 리스너
    (onStoreChange) => {
      const handler = (e: StorageEvent) => {
        if (e.key === storageKey) onStoreChange();
      };
      // 같은 탭의 toggle에서도 반영하기 위한 커스텀 이벤트
      const customHandler = () => onStoreChange();
      window.addEventListener("storage", handler);
      window.addEventListener(`sidebar-${storageKey}`, customHandler);
      return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener(`sidebar-${storageKey}`, customHandler);
      };
    },
    // getSnapshot: 클라이언트에서 localStorage 값 읽기
    () => localStorage.getItem(storageKey) === "collapsed",
    // getServerSnapshot: 서버에서는 항상 false (hydration-safe)
    () => false,
  );

  const toggle = useCallback(() => {
    const next = !collapsed;
    localStorage.setItem(storageKey, next ? "collapsed" : "expanded");
    // 같은 탭에서 반영하기 위해 커스텀 이벤트 dispatch
    window.dispatchEvent(new Event(`sidebar-${storageKey}`));
  }, [storageKey, collapsed]);

  return [collapsed, toggle] as const;
}

export function CollapsibleSidebar({
  title,
  children,
  storageKey,
}: CollapsibleSidebarProps) {
  const [collapsed, toggleCollapsed] = useCollapsedState(storageKey);
  const [sheetOpen, setSheetOpen] = useState(false);

  // 모바일: 네비게이션 아이템 클릭 시 Sheet 닫기
  const handleItemClick = useCallback(() => {
    setSheetOpen(false);
  }, []);

  return (
    <>
      {/* 데스크톱 사이드바 — lg 이상에서만 표시 */}
      <aside
        className={cn(
          "hidden lg:block shrink-0 border-r border-border transition-all duration-300 overflow-hidden",
          collapsed ? "w-12" : "w-56"
        )}
      >
        <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col">
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
            <span
              className={cn(
                "ml-2 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap transition-all duration-300",
                collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto"
              )}
            >
              {title}
            </span>
          </div>

          <nav
            className={cn(
              "overflow-y-auto p-3 space-y-1 transition-all duration-300",
              collapsed
                ? "h-0 overflow-hidden opacity-0 pointer-events-none p-0"
                : "flex-1 opacity-100"
            )}
          >
            {children}
          </nav>
        </div>
      </aside>

      {/* 모바일 토글 버튼 — lg 미만에서만 표시 */}
      <Button
        variant="outline"
        size="icon"
        className="fixed top-16 left-3 z-50 h-9 w-9 shadow-sm lg:hidden"
        onClick={() => setSheetOpen(true)}
      >
        <PanelLeft className="h-4 w-4" />
      </Button>

      {/* 모바일 Sheet 드로어 */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
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
