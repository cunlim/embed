"use client";

import { useState, useCallback } from "react";
import { Menu, ChevronLeft, X } from "lucide-react";
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

export function CollapsibleSidebar({
  title,
  children,
  storageKey,
  breakpoint = "lg",
}: CollapsibleSidebarProps) {
  const isDesktop = useMediaQuery(BREAKPOINT_MAP[breakpoint]);
  const [collapsed, setCollapsed] = useState(() => {
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
    if (!isDesktop) {
      setSheetOpen(false);
    }
  }, [isDesktop]);

  // 데스크톱 렌더링
  if (isDesktop) {
    return (
      <aside
        className={cn(
          "shrink-0 border-r border-border transition-all duration-300",
          collapsed ? "w-12" : "w-56"
        )}
      >
        <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col">
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-border px-3 py-3">
            {!collapsed && (
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {title}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={toggleCollapsed}
            >
              {collapsed ? (
                <Menu className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
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
        variant="ghost"
        size="icon"
        className="fixed bottom-4 left-4 z-50 h-10 w-10 rounded-full shadow-md bg-background border border-border"
        onClick={() => setSheetOpen(true)}
      >
        <Menu className="h-5 w-5" />
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
