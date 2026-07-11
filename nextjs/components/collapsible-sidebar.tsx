"use client";

import { useState, useCallback, useEffect, useSyncExternalStore } from "react";
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
  readonly title: string;
  readonly children: React.ReactNode;
  readonly storageKey: string;
  /** 서버에서 전달된 초기 collapsed 상태 (cookie 기반) */
  readonly initialCollapsed?: boolean;
}

/**
 * cookie 기반 collapsed 상태 관리 (hydration-safe)
 *
 * SSR 시퀀스:
 * 1. Server Component에서 cookie를 읽어 initialCollapsed prop으로 전달
 * 2. getServerSnapshot이 initialCollapsed 값을 반환 → SSR이 올바른 상태 렌더링
 * 3. 클라이언트 getSnapshot이 cookie에서 읽음 → 서버와 동일 소스이므로 mismatch 없음
 *
 * cookie:
 * - toggle 시 cookie에만 저장 (SameSite=Lax, 1년 유효)
 * - localStorage 미사용 — cookie가 단일 진실 공급원
 */
function useCollapsedState(storageKey: string, initialCollapsed: boolean) {
  const collapsed = useSyncExternalStore(
    // subscribe: 같은 탭 toggle 반영을 위한 커스텀 이벤트
    (onStoreChange) => {
      const customHandler = () => onStoreChange();
      globalThis.addEventListener(`sidebar-${storageKey}`, customHandler);
      return () => globalThis.removeEventListener(`sidebar-${storageKey}`, customHandler);
    },
    // getSnapshot: cookie에서 현재 상태 읽기 (서버와 동일 소스)
    () => {
      const match = new RegExp(String.raw`(?:^|;\s*)${storageKey}=([^;]*)`).exec(document.cookie);
      return match ? match[1] === "collapsed" : false;
    },
    // getServerSnapshot: Server Component에서 전달된 cookie 기반 값
    () => initialCollapsed,
  );

  const toggle = useCallback(() => {
    const next = !collapsed;
    const value = next ? "collapsed" : "expanded";
    document.cookie = `${storageKey}=${value}; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 365}`;
    window.dispatchEvent(new Event(`sidebar-${storageKey}`));
  }, [storageKey, collapsed]);

  return [collapsed, toggle] as const;
}

export function CollapsibleSidebar({
  title,
  children,
  storageKey,
  initialCollapsed = false,
}: CollapsibleSidebarProps) {
  const [collapsed, toggleCollapsed] = useCollapsedState(storageKey, initialCollapsed);
  const [sheetOpen, setSheetOpen] = useState(false);
  // 첫 마운트 시 transition 억제 → toggle 시점부터 애니메이션 활성화
  const [suppressTransition, setSuppressTransition] = useState(true);
  useEffect(() => {
    // 2프레임 후 transition 활성화 (상태 동기화 + 리렌더 완료 후)
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSuppressTransition(false);
      });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // 모바일: 네비게이션 아이템 클릭 시 Sheet 닫기
  const handleItemClick = useCallback(() => {
    setSheetOpen(false);
  }, []);

  const transitionClass = suppressTransition ? "" : "transition-all duration-300";

  return (
    <>
      {/* 데스크톱 사이드바 — lg 이상에서만 표시 */}
      <aside
        className={cn(
          "hidden lg:block shrink-0 border-r border-border overflow-hidden",
          transitionClass,
          collapsed ? "w-12" : "w-56"
        )}
      >
        <div className="flex h-full flex-col">
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
                "ml-2 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap",
                transitionClass,
                collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto"
              )}
            >
              {title}
            </span>
          </div>

          <nav
            className={cn(
              "overflow-y-auto p-3 space-y-1",
              transitionClass,
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
