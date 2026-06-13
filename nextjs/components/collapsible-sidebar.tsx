"use client";

import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from "react";
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
  /** 서버에서 전달된 초기 collapsed 상태 (cookie 기반) */
  initialCollapsed?: boolean;
}

/**
 * localStorage + cookie 기반 collapsed 상태 관리 (hydration-safe)
 *
 * SSR 시퀀스:
 * 1. Server Component에서 cookie를 읽어 initialCollapsed prop으로 전달
 * 2. getServerSnapshot이 initialCollapsed 값을 반환 → SSR이 올바른 상태 렌더링
 * 3. 클라이언트 첫 렌더: getSnapshot이 initialCollapsed 반환 (서버와 일치 → no mismatch)
 * 4. useEffect에서 localStorage ↔ cookie 동기화 후 커스텀 이벤트 dispatch
 * 5. getSnapshot이 localStorage 값을 반환 → 리렌더 (전환 없이 즉시 적용)
 *
 * cookie 동기화:
 * - toggle 시 localStorage + cookie 양쪽에 저장
 * - cookie는 SameSite=Lax, 1년 유효
 * - 첫 마운트 시 localStorage ↔ cookie 양방향 동기화
 */
function useCollapsedState(storageKey: string, initialCollapsed: boolean) {
  // hydration-safe: 첫 렌더에서는 initialCollapsed 사용 (서버 스냅샷과 일치)
  const initializedRef = useRef(false);

  const collapsed = useSyncExternalStore(
    // subscribe: storage 이벤트 + 커스텀 이벤트 리스너
    (onStoreChange) => {
      const storageHandler = (e: StorageEvent) => {
        if (e.key === storageKey) onStoreChange();
      };
      const customHandler = () => onStoreChange();
      window.addEventListener("storage", storageHandler);
      window.addEventListener(`sidebar-${storageKey}`, customHandler);
      return () => {
        window.removeEventListener("storage", storageHandler);
        window.removeEventListener(`sidebar-${storageKey}`, customHandler);
      };
    },
    // getSnapshot: 클라이언트에서 localStorage 값 읽기
    // 첫 렌더에서는 initialCollapsed를 반환하여 서버 스냅샷과 일치시킴
    () => {
      if (!initializedRef.current) return initialCollapsed;
      return localStorage.getItem(storageKey) === "collapsed";
    },
    // getServerSnapshot: Server Component에서 전달된 cookie 기반 값 사용
    () => initialCollapsed,
  );

  // 클라이언트 동기화: localStorage ↔ cookie
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      // localStorage가 있으면 cookie에 동기화 (다음 SSR을 위해)
      document.cookie = `${storageKey}=${stored}; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 365}`;
    } else {
      // localStorage가 없으면 cookie에서 읽어 동기화
      const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${storageKey}=([^;]*)`));
      if (match) {
        localStorage.setItem(storageKey, match[1]);
      }
    }
    // 초기화 완료 → 이후 getSnapshot은 localStorage 직접 읽기
    initializedRef.current = true;
    // 동기화 완료를 알리는 커스텀 이벤트 dispatch (리렌더 트리거)
    window.dispatchEvent(new Event(`sidebar-${storageKey}`));
  }, [storageKey]);

  const toggle = useCallback(() => {
    const next = !collapsed;
    const value = next ? "collapsed" : "expanded";
    localStorage.setItem(storageKey, value);
    // cookie에도 저장 (다음 SSR 시 서버에서 읽기 위해)
    document.cookie = `${storageKey}=${value}; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 365}`;
    // 같은 탭에서 반영하기 위해 커스텀 이벤트 dispatch
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
  // 첫 마운트 후 localStorage 동기화가 완료될 때까지 transition 억제
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
