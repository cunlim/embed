# 반응형 Admin/Docs 사이드바 및 Header 개선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** admin과 docs 페이지에 공통 반응형 사이드바를 적용하고, admin 헤더의 불필요한 "admin" 배지를 제거한다.

**Architecture:** `CollapsibleSidebar` 공통 컴포넌트를 만들어 admin/docs 레이아웃에서 공유. 데스크톱은 CSS 트랜지션으로 접기/펼치기, 모바일은 shadcn/ui Sheet으로 슬라이드-in 드로어 제공. `useMediaQuery` 훅으로 반응형 감지, `localStorage`로 상태 영속화.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui (Sheet, Button), lucide-react

---

## 파일 구조

| 파일 | 작업 | 설명 |
|---|---|---|
| `nextjs/hooks/use-media-query.ts` | 신규 | 반응형 브레이크포인트 감지 훅 |
| `nextjs/components/collapsible-sidebar.tsx` | 신규 | 공통 접이식 사이드바 컴포넌트 |
| `nextjs/components/ui/sheet.tsx` | 신규 | shadcn/ui Sheet 컴포넌트 |
| `nextjs/app/admin/layout.tsx` | 신규 | Admin 레이아웃 (사이드바 포함) |
| `nextjs/app/admin/page.tsx` | 수정 | 인라인 사이드바 제거 |
| `nextjs/app/docs/layout.tsx` | 신규 | Docs 레이아웃 (사이드바 포함) |
| `nextjs/app/docs/page.tsx` | 수정 | 사이드바 코드 제거 |
| `nextjs/components/app-header.tsx` | 수정 | admin 배지 제거 |

---

### Task 1: shadcn/ui Sheet 컴포넌트 추가

**Files:**
- Create: `nextjs/components/ui/sheet.tsx`

- [ ] **Step 1: Sheet 컴포넌트 설치**

```bash
cd /var/app/www/cl_embed/nextjs && npx shadcn@latest add sheet -y
```

- [ ] **Step 2: 설치 확인**

```bash
ls -la /var/app/www/cl_embed/nextjs/components/ui/sheet.tsx
```

Expected: 파일이 존재해야 함

- [ ] **Step 3: Sheet 컴포넌트 코드 확인**

`nextjs/components/ui/sheet.tsx` 파일을 읽고, `Sheet`, `SheetTrigger`, `SheetContent`, `SheetTitle`, `SheetDescription` 등이 export 되는지 확인.

- [ ] **Step 4: tsc 검증**

```bash
cd /var/app/www/cl_embed/nextjs && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
git add nextjs/components/ui/sheet.tsx
git commit -m "feat: shadcn/ui Sheet 컴포넌트 추가"
```

---

### Task 2: useMediaQuery 커스텀 훅 생성

**Files:**
- Create: `nextjs/hooks/use-media-query.ts`

- [ ] **Step 1: useMediaQuery 훅 구현**

```typescript
// nextjs/hooks/use-media-query.ts
"use client";

import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
```

- [ ] **Step 2: tsc 검증**

```bash
cd /var/app/www/cl_embed/nextjs && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add nextjs/hooks/use-media-query.ts
git commit -m "feat: useMediaQuery 커스텀 훅 추가"
```

---

### Task 3: CollapsibleSidebar 컴포넌트 생성

**Files:**
- Create: `nextjs/components/collapsible-sidebar.tsx`

- [ ] **Step 1: CollapsibleSidebar 컴포넌트 구현**

```typescript
// nextjs/components/collapsible-sidebar.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // localStorage에서 상태 복원
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      setCollapsed(stored === "collapsed");
    }
  }, [storageKey]);

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
          <nav className="flex-1 overflow-y-auto p-3 space-y-1" onClick={handleItemClick}>
            {children}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
```

- [ ] **Step 2: tsc 검증**

```bash
cd /var/app/www/cl_embed/nextjs && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add nextjs/components/collapsible-sidebar.tsx
git commit -m "feat: CollapsibleSidebar 공통 컴포넌트 추가"
```

---

### Task 4: Admin 레이아웃 생성 및 페이지 리팩토링

**Files:**
- Create: `nextjs/app/admin/layout.tsx`
- Modify: `nextjs/app/admin/page.tsx`

- [ ] **Step 1: AdminPage에서 메뉴 타입과 MENU 추출 확인**

현재 `admin/page.tsx`에 정의된 `MenuItem` 타입과 `MENU` 배열을 layout으로 이동한다.

- [ ] **Step 2: admin/layout.tsx 생성**

```typescript
// nextjs/app/admin/layout.tsx
"use client";

import { useState } from "react";
import { Settings, Inbox } from "lucide-react";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { cn } from "@/lib/utils";

type MenuItem = "settings" | "info";

const MENU: { id: MenuItem; label: string; icon: typeof Settings }[] = [
  { id: "settings", label: "시스템 설정", icon: Settings },
  { id: "info", label: "안내", icon: Inbox },
];

// Context로 활성 메뉴와 setter를 page.tsx에 전달
import { createContext, useContext } from "react";

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
                    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
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
```

- [ ] **Step 3: admin/page.tsx 리팩토링**

기존 `admin/page.tsx`에서 사이드바 코드와 레이아웃 래퍼를 제거하고, `useAdminMenu()`로 활성 메뉴를 읽어 콘텐츠만 렌더링하도록 변경한다.

```typescript
// nextjs/app/admin/page.tsx
"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth, getToken } from "@/hooks/useAuth";
import { isSuperAdmin } from "@/lib/utils";
import { SettingsPanel } from "@/components/admin/settings-panel";
import { useAdminMenu } from "./layout";

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { active } = useAdminMenu();
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
    <>
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
    </>
  );
}
```

- [ ] **Step 4: tsc 검증**

```bash
cd /var/app/www/cl_embed/nextjs && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 5: Admin 페이지 접속 테스트 (Playwright)**

```bash
# Playwright로 admin 페이지 접속하여 렌더링 확인
# 브라우저에서 https://embed.cunlim.dev/admin 접속
```

- [ ] **Step 6: Commit**

```bash
git add nextjs/app/admin/layout.tsx nextjs/app/admin/page.tsx
git commit -m "feat: Admin 레이아웃 분리 및 CollapsibleSidebar 적용"
```

---

### Task 5: Docs 레이아웃 생성 및 페이지 리팩토링

**Files:**
- Create: `nextjs/app/docs/layout.tsx`
- Modify: `nextjs/app/docs/page.tsx`

- [ ] **Step 1: DocsPage에서 docList와 사이드바 로직 확인**

현재 `docs/page.tsx`의 `docList`, `sidebarOpen`, 사이드바 렌더링 코드를 layout으로 이동한다.

- [ ] **Step 2: docs/layout.tsx 생성**

```typescript
// nextjs/app/docs/layout.tsx
"use client";

import { useState, useCallback, createContext, useContext } from "react";
import { BookOpen } from "lucide-react";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { cn } from "@/lib/utils";

interface DocEntry {
  slug: string;
  title: string;
  description: string;
}

const docList: DocEntry[] = [
  { slug: "USER_GUIDE", title: "사용자 가이드", description: "시스템 사용 방법 및 API 연동" },
  { slug: "SIMILARITY_SEARCH", title: "유사도 검색 원리", description: "AI 임베딩 및 코사인 유사도 검색" },
  { slug: "RESUME", title: "이력서", description: "포트폴리오 및 경력 사항" },
];

interface DocsContextType {
  activeDoc: string;
  setActiveDoc: (slug: string) => void;
  docList: DocEntry[];
}

const DocsContext = createContext<DocsContextType>({
  activeDoc: "",
  setActiveDoc: () => {},
  docList: [],
});

export function useDocs() {
  return useContext(DocsContext);
}

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeDoc, setActiveDoc] = useState<string>(docList[0]?.slug ?? "");

  return (
    <DocsContext.Provider value={{ activeDoc, setActiveDoc, docList }}>
      <div className="relative flex min-h-dvh flex-col overflow-hidden">
        <div className="noise-overlay" />
        <div className="absolute inset-0 bg-grid" />
        <div className="glow-orb -top-40 -right-40 h-96 w-96 bg-blue-500/15 dark:bg-blue-500/10" />
        <div className="glow-orb -bottom-40 -left-40 h-96 w-96 bg-purple-500/15 dark:bg-purple-500/10" />

        <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 gap-8 px-6 py-12 sm:px-8">
          <CollapsibleSidebar title="문서" storageKey="docs-sidebar">
            {docList.map((doc) => (
              <DocsNavButton key={doc.slug} doc={doc} />
            ))}
          </CollapsibleSidebar>

          <div className="min-w-0 flex-1">{children}</div>
        </main>
      </div>
    </DocsContext.Provider>
  );
}

function DocsNavButton({ doc }: { doc: DocEntry }) {
  const { activeDoc, setActiveDoc } = useDocs();
  const isActive = activeDoc === doc.slug;

  return (
    <button
      type="button"
      onClick={() => setActiveDoc(doc.slug)}
      className={cn(
        "flex w-full flex-col items-start rounded-md px-3 py-2 text-left transition-colors",
        isActive
          ? "bg-accent/20 text-foreground font-semibold"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
      )}
    >
      <span className="text-sm">{doc.title}</span>
      <span className="text-[11px] text-muted-foreground mt-0.5">
        {doc.description}
      </span>
    </button>
  );
}
```

- [ ] **Step 3: docs/page.tsx 리팩토링**

사이드바 코드를 전부 제거하고, `useDocs()`로 활성 문서를 읽어 콘텐츠만 렌더링하도록 변경한다. `loadDoc` 로직은 유지하되, `activeDoc` 변경을 감지하는 `useEffect`로 문서 로드를 트리거한다.

```typescript
// nextjs/app/docs/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { BookOpen, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocs } from "./layout";

export default function DocsPage() {
  const { activeDoc } = useDocs();
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  const loadDoc = useCallback((slug: string) => {
    setIsLoading(true);
    setError(null);
    setContent(null);

    fetch(`/content/${slug}.md`)
      .then((res) => {
        if (!res.ok) throw new Error("문서를 불러오지 못했습니다");
        return res.text();
      })
      .then((text) => {
        setContent(text);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "문서 로딩에 실패했습니다"
        );
        setIsLoading(false);
      });
  }, []);

  // 첫 번째 문서 자동 로드
  useEffect(() => {
    if (!initialLoadDone.current && activeDoc) {
      initialLoadDone.current = true;
      loadDoc(activeDoc);
    }
  }, [activeDoc, loadDoc]);

  // 활성 문서 변경 시 로드
  useEffect(() => {
    if (initialLoadDone.current && activeDoc) {
      loadDoc(activeDoc);
    }
  }, [activeDoc, loadDoc]);

  const activeTitle = useDocs().docList.find((d) => d.slug === activeDoc)?.title || "";

  return (
    <>
      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="mt-6 h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm font-medium text-destructive">{error}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => activeDoc && loadDoc(activeDoc)}
          >
            다시 시도
          </Button>
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && content !== null && (
        <article className="prose-custom">
          <div className="mb-6 flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-accent" />
            <h1 className="text-2xl font-bold">{activeTitle}</h1>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target={href?.startsWith("http") ? "_blank" : undefined}
                    rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </article>
      )}
    </>
  );
}
```

- [ ] **Step 4: tsc 검증**

```bash
cd /var/app/www/cl_embed/nextjs && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 5: Docs 페이지 접속 테스트 (Playwright)**

```bash
# Playwright로 docs 페이지 접속하여 렌더링 확인
# 브라우저에서 https://embed.cunlim.dev/docs 접속
```

- [ ] **Step 6: Commit**

```bash
git add nextjs/app/docs/layout.tsx nextjs/app/docs/page.tsx
git commit -m "feat: Docs 레이아웃 분리 및 CollapsibleSidebar 적용"
```

---

### Task 6: Admin 헤더 배지 제거

**Files:**
- Modify: `nextjs/components/app-header.tsx`

- [ ] **Step 1: admin 배지 코드 제거**

`nextjs/components/app-header.tsx`에서 다음 코드를 변경한다:

```typescript
// 변경 전 (라인 29)
const badge = pathname === "/admin" ? "admin" : undefined;

// 변경 후
const badge = undefined;
```

- [ ] **Step 2: tsc 검증**

```bash
cd /var/app/www/cl_embed/nextjs && npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: Admin 페이지에서 배지 미표시 확인 (Playwright)**

```bash
# Playwright로 admin 페이지 접속하여 헤더에 "admin" 배지가 없는지 확인
```

- [ ] **Step 4: Commit**

```bash
git add nextjs/components/app-header.tsx
git commit -m "fix: Admin 페이지 헤더에서 불필요한 admin 배지 제거"
```

---

### Task 7: Docs 페이지 푸터 복원 확인

**Files:**
- Modify: `nextjs/app/docs/layout.tsx` (필요 시)

- [ ] **Step 1: 기존 푸터 확인**

기존 `docs/page.tsx`에 있던 푸터(홈, 기능시연 링크)가 layout으로 이동되었는지 확인한다. 현재 plan의 `docs/layout.tsx`에는 푸터가 포함되어 있지 않다.

푸터를 layout에 추가해야 한다면:

```typescript
// docs/layout.tsx의 </main> 뒤에 추가
<footer className="relative z-10 border-t border-border">
  <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row sm:px-8">
    <p className="text-xs text-muted-foreground">
      CL Embed. Portfolio Project.
    </p>
    <div className="flex items-center gap-4">
      <Link
        href="/"
        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        홈
      </Link>
      <Link
        href="/embed"
        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        기능시연
      </Link>
    </div>
  </div>
</footer>
```

- [ ] **Step 2: Docs 페이지 렌더링 확인 (Playwright)**

푸터가 정상적으로 표시되는지 확인.

- [ ] **Step 3: Commit (변경 시)**

```bash
git add nextjs/app/docs/layout.tsx
git commit -m "fix: Docs 레이아웃에 푸터 추가"
```

---

### Task 8: 반응형 동작 종합 검증

- [ ] **Step 1: Admin 페이지 반응형 테스트 (Playwright)**

1. 데스크톱 뷰포트(1280px)에서 admin 접속 → 사이드바 펼쳐진 상태 확인
2. 토글 버튼 클릭 → 사이드바 접힘 확인
3. 뷰포트를 768px로 변경 → 모바일 Sheet 드로어 동작 확인
4. localStorage에 `admin-sidebar` 값 저장 확인

- [ ] **Step 2: Docs 페이지 반응형 테스트 (Playwright)**

1. 데스크톱 뷰포트에서 docs 접속 → 사이드바 펼쳐진 상태 확인
2. 토글 버튼 클릭 → 사이드바 접힘 확인
3. 뷰포트를 768px로 변경 → 모바일 Sheet 드로어 동작 확인
4. 문서 전환 → 콘텐츠 변경 확인
5. localStorage에 `docs-sidebar` 값 저장 확인

- [ ] **Step 3: 전체 lint 및 tsc 검증**

```bash
cd /var/app/www/cl_embed/nextjs && npx tsc --noEmit && npx eslint app/admin/ app/docs/ components/collapsible-sidebar.tsx hooks/use-media-query.ts --max-warnings=0
```

Expected: 에러 없음

- [ ] **Step 4: 최종 Commit**

```bash
git add -A
git commit -m "feat: 반응형 Admin/Docs 사이드바 및 Header 개선 완료"
```

---

## 실행 순서 요약

1. **Task 1**: Sheet 컴포넌트 설치 → 기반 확보
2. **Task 2**: useMediaQuery 훅 → 반응형 감지 기능
3. **Task 3**: CollapsibleSidebar → 공통 컴포넌트
4. **Task 4**: Admin 레이아웃 분리 → 적용 및 검증
5. **Task 5**: Docs 레이아웃 분리 → 적용 및 검증
6. **Task 6**: 헤더 배지 제거 → 간단한 수정
7. **Task 7**: 푸터 복원 → 빠진 부분 확인
8. **Task 8**: 종합 검증 → 반응형 동작 확인
