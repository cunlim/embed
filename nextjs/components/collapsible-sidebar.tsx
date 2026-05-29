"use client";

import { useState, useCallback } from "react";
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

export function CollapsibleSidebar({
  title,
  children,
  storageKey,
}: CollapsibleSidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    // 서버에서는 false 반환, 클라이언트에서는 localStorage 값 사용
    if (typeof window === "undefined") return false;
    return localStorage.getItem(storageKey) === "collapsed";
  });
  const [sheetOpen, setSheetOpen] = useState(false);

  // 접기/펼치기 토글 (데스크톱만)
  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(storageKey, next ? "collapsed" : "expanded");
      return next;
    });
  }, [storageKey]);

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
            {!collapsed && (
              <span className="ml-2 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                {title}
              </span>
            )}
          </div>

          {!collapsed && (
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {children}
            </nav>
          )}
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
