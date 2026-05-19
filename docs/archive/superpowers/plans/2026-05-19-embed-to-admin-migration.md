# embed → admin 기능 이전 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** embed 페이지의 카테고리 계층 탐색, 일괄 번역, 코사인 유사도 상세 다이얼로그를 admin 페이지로 이전하고 embed 페이지는 빈 상태로 만든다.

**Architecture:** embed 페이지에서 3가지 기능의 로직을 추출해 `components/admin/` 아래 3개 신규 컴포넌트로 분리한다. admin 페이지는 이 컴포넌트를 사이드바에 통합하고, 검색 결과 유사도 점수 클릭 시 다이얼로그를 표시한다. 백엔드 변경은 없다.

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Tailwind v4 + shadcn/ui, lucide-react

---

### 파일 구조

| 작업 | 파일 | 설명 |
|------|------|------|
| Create | `components/admin/category-hierarchy.tsx` | 대/중/소 3단계 Select 카드 |
| Create | `components/admin/batch-translate.tsx` | 일괄 번역 카드 (Progress bar) |
| Create | `components/admin/cosine-detail-dialog.tsx` | 5단계 파이프라인 다이얼로그 |
| Modify | `app/admin/page.tsx` | 신규 컴포넌트 통합, 유사도 클릭 핸들러 |
| Modify | `app/embed/page.tsx` | 모든 기능 제거, 안내 메시지만 유지 |

---

### Task 1: `CategoryHierarchy` 컴포넌트 생성

**Files:**
- Create: `nextjs/components/admin/category-hierarchy.tsx`

**Purpose:** embed 페이지의 계층 탐색 Select 3개를 독립 컴포넌트로 추출. `parseHierarchy()`와 `useMemo`로 대/중/소 옵션을 계산하고, 소분류 선택 시 부모로 `categoryId`를 콜백.

- [ ] **Step 1: 컴포넌트 파일 생성**

```tsx
"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseHierarchy } from "@/lib/category";
import type { Category } from "@/lib/api";

interface CategoryHierarchyProps {
  categories: Category[];
  categoriesLoaded: boolean;
  onLoadCategories: () => void;
  onSelectCategory: (categoryId: number) => void;
}

export default function CategoryHierarchy({
  categories,
  categoriesLoaded,
  onLoadCategories,
  onSelectCategory,
}: CategoryHierarchyProps) {
  const [selected대, setSelected대] = useState<string | null>(null);
  const [selected중, setSelected중] = useState<string | null>(null);

  const hierarchy = useMemo(
    () => (categoriesLoaded ? parseHierarchy(categories) : []),
    [categories, categoriesLoaded]
  );

  const 대Options = useMemo(
    () => [...new Set(hierarchy.map((h) => h.대))],
    [hierarchy]
  );

  const 중Options = useMemo(
    () => [
      ...new Set(
        hierarchy
          .filter((h) => !selected대 || h.대 === selected대)
          .map((h) => h.중)
      ),
    ],
    [hierarchy, selected대]
  );

  const 소Options = useMemo(
    () =>
      hierarchy
        .filter(
          (h) =>
            (!selected대 || h.대 === selected대) &&
            (!selected중 || h.중 === selected중)
        )
        .map((h) => ({ 소: h.소, categoryId: h.categoryId, categoryCode: h.categoryCode })),
    [hierarchy, selected대, selected중]
  );

  return (
    <Card className="p-4">
      <h3 className="mb-3 font-medium text-sm">카테고리 계층 탐색</h3>
      {!categoriesLoaded && (
        <Button
          variant="outline"
          size="sm"
          onClick={onLoadCategories}
          className="w-full"
        >
          카테고리 목록 불러오기
        </Button>
      )}

      {categoriesLoaded && hierarchy.length === 0 && (
        <p className="text-xs text-muted-foreground">
          사용 가능한 카테고리가 없습니다
        </p>
      )}

      {categoriesLoaded && hierarchy.length > 0 && (
        <div className="space-y-3">
          <Select
            value={selected대 ?? ""}
            onValueChange={(v) => {
              setSelected대(v);
              setSelected중(null);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="대분류 선택" />
            </SelectTrigger>
            <SelectContent>
              {대Options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selected중 ?? ""}
            onValueChange={setSelected중}
            disabled={!selected대}
          >
            <SelectTrigger>
              <SelectValue placeholder="중분류 선택" />
            </SelectTrigger>
            <SelectContent>
              {중Options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value=""
            onValueChange={(v) => {
              const found = 소Options.find((o) => o.categoryCode === v);
              if (found) onSelectCategory(found.categoryId);
            }}
            disabled={!selected중}
          >
            <SelectTrigger>
              <SelectValue placeholder="소분류 선택" />
            </SelectTrigger>
            <SelectContent>
              {소Options.map((opt) => (
                <SelectItem key={opt.categoryCode} value={opt.categoryCode}>
                  {opt.소}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add nextjs/components/admin/category-hierarchy.tsx
git commit -m "feat: CategoryHierarchy 컴포넌트 추가"
```

---

### Task 2: `BatchTranslate` 컴포넌트 생성

**Files:**
- Create: `nextjs/components/admin/batch-translate.tsx`

**Purpose:** embed 페이지의 일괄 번역 섹션을 독립 컴포넌트로 추출. 언어 선택 탭, "전체 번역 실행" 버튼, Progress bar 포함.

- [ ] **Step 1: 컴포넌트 파일 생성**

```tsx
"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { getAllCategories, runStep } from "@/lib/api";

interface BatchTranslateProps {
  token: string | null;
  onComplete?: () => void;
}

export default function BatchTranslate({ token, onComplete }: BatchTranslateProps) {
  const [batchLanguage, setBatchLanguage] = useState("zh");
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    status: string;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
  } | null>(null);

  const handleBatchTranslate = useCallback(async () => {
    setIsBatchLoading(true);
    setBatchError(null);
    try {
      const cats = await getAllCategories(token || null);
      const allCategories = cats.data;
      const totalJobs = allCategories.length;

      setBatchProgress({
        status: "processing",
        totalJobs,
        completedJobs: 0,
        failedJobs: 0,
      });

      for (const cat of allCategories) {
        try {
          const steps = [`translation.${batchLanguage}`, `embedding.${batchLanguage}`];
          await Promise.all(
            steps.map((step) => runStep(cat.id, step, token ?? null))
          );
          setBatchProgress((p) =>
            p ? { ...p, completedJobs: p.completedJobs + 1 } : p
          );
        } catch {
          setBatchProgress((p) =>
            p ? { ...p, failedJobs: p.failedJobs + 1 } : p
          );
        }
      }

      setBatchProgress((p) => (p ? { ...p, status: "completed" } : p));
      onComplete?.();
    } catch (err) {
      setBatchError(
        err instanceof Error ? err.message : "일괄 번역 요청에 실패했습니다"
      );
    } finally {
      setIsBatchLoading(false);
    }
  }, [batchLanguage, token, onComplete]);

  const pct =
    batchProgress && batchProgress.totalJobs > 0
      ? Math.round(
          (batchProgress.completedJobs / batchProgress.totalJobs) * 100
        )
      : 0;

  return (
    <Card className="p-4">
      <h3 className="mb-3 font-medium text-sm">일괄 번역</h3>
      <div className="space-y-3">
        <Tabs value={batchLanguage} onValueChange={setBatchLanguage}>
          <TabsList className="w-full">
            <TabsTrigger value="zh" className="flex-1">
              중국어
            </TabsTrigger>
            <TabsTrigger value="en" className="flex-1">
              영어
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          onClick={handleBatchTranslate}
          disabled={isBatchLoading}
          variant="outline"
          className="w-full"
        >
          {isBatchLoading ? "실행 중..." : "전체 번역 실행"}
        </Button>

        {batchError && (
          <p className="text-xs text-destructive">{batchError}</p>
        )}

        {batchProgress && (
          <div className="space-y-2">
            <Progress value={pct} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {batchProgress.completedJobs}/{batchProgress.totalJobs} 완료
              </span>
              <span>
                {batchProgress.failedJobs > 0 &&
                  `${batchProgress.failedJobs} 실패 · `}
                {batchProgress.status === "completed" ? "완료" : "처리 중"}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add nextjs/components/admin/batch-translate.tsx
git commit -m "feat: BatchTranslate 컴포넌트 추가"
```

---

### Task 3: `CosineDetailDialog` 컴포넌트 생성

**Files:**
- Create: `nextjs/components/admin/cosine-detail-dialog.tsx`

**Purpose:** embed 페이지의 코사인 유사도 상세 다이얼로그를 독립 컴포넌트로 추출. 추천 결과의 5단계 벡터 처리 파이프라인을 교육용으로 표시.

- [ ] **Step 1: 컴포넌트 파일 생성**

```tsx
"use client";

import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Recommendation } from "@/lib/api";

interface CosineDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: Recommendation | null;
}

const vectorSteps = [
  { label: "검색어 입력", description: "사용자 텍스트 수신" },
  { label: "정규화", description: "공백 정리, 특수문자 처리" },
  { label: "임베딩 생성", description: "bge-m3 (1024차원)" },
  { label: "pgvector 유사도 검색", description: "코사인 유사도 계산" },
  { label: "결과 매핑", description: "카테고리 코드/이름 매핑" },
];

export default function CosineDetailDialog({
  open,
  onOpenChange,
  result,
}: CosineDetailDialogProps) {
  if (!result) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-sm">
            <FileText className="h-4 w-4" />
            코사인 유사도 상세
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">카테고리</p>
            <p className="font-medium">{result.category_name}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {result.category_code}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">유사도 점수</p>
            <p className="text-accent font-mono text-2xl font-bold">
              {((result.similarity_score ?? 0) * 100).toFixed(1)}%
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">처리 과정</p>
            {vectorSteps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
              >
                <Badge variant="secondary" className="shrink-0 font-mono text-xs">
                  {idx + 1}
                </Badge>
                <div>
                  <p className="text-xs font-medium">{step.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add nextjs/components/admin/cosine-detail-dialog.tsx
git commit -m "feat: CosineDetailDialog 컴포넌트 추가"
```

---

### Task 4: admin 페이지에 신규 컴포넌트 통합

**Files:**
- Modify: `nextjs/app/admin/page.tsx`

**Purpose:** 3개 신규 컴포넌트를 admin 페이지에 통합하고, 검색 결과의 유사도 점수를 클릭 가능하게 변경.

- [ ] **Step 1: import 추가**

`app/admin/page.tsx` 상단 import 영역에 추가:

```tsx
import CategoryHierarchy from "@/components/admin/category-hierarchy";
import BatchTranslate from "@/components/admin/batch-translate";
import CosineDetailDialog from "@/components/admin/cosine-detail-dialog";
```

- [ ] **Step 2: cosine dialog state 추가**

`AdminPageInner` 함수 내, 기존 `searchError` state 아래에 추가:

```tsx
const [cosineDialogOpen, setCosineDialogOpen] = useState(false);
const [activeResult, setActiveResult] = useState<Recommendation | null>(null);
```

- [ ] **Step 3: 사이드바에 CategoryHierarchy 카드 추가**

기존 사이드바에서 "카테고리 검색" Card와 "카테고리 추가" Card 사이에 삽입:

```tsx
{/* 카테고리 계층 탐색 */}
<CategoryHierarchy
  categories={categories}
  categoriesLoaded={!catLoading}
  onLoadCategories={() => loadCategories()}
  onSelectCategory={(categoryId) => setModalCategoryId(categoryId)}
/>
```

- [ ] **Step 4: 사이드바에 BatchTranslate 카드 추가**

"카테고리 추가" Card 아래에 추가:

```tsx
{/* 일괄 번역 */}
<BatchTranslate
  token={token}
  onComplete={() => loadCategories(page)}
/>
```

- [ ] **Step 5: 데스크톱 테이블 유사도 점수 셀에 onClick 추가**

`isSearchMode` 조건부 컬럼의 `TableCell` 변경:

기존:
```tsx
<TableCell className="font-mono text-sm text-accent">
  {cat.similarity_score != null
    ? `${(cat.similarity_score * 100).toFixed(1)}%`
    : "-"}
</TableCell>
```

변경:
```tsx
<TableCell className="font-mono text-sm text-accent">
  {cat.similarity_score != null ? (
    <button
      type="button"
      className="cursor-pointer hover:underline"
      onClick={() => {
        setActiveResult(cat as Recommendation);
        setCosineDialogOpen(true);
      }}
    >
      {(cat.similarity_score * 100).toFixed(1)}%
    </button>
  ) : (
    "-"
  )}
</TableCell>
```

- [ ] **Step 6: 모바일 카드 유사도 점수에 onClick 추가**

모바일 레이아웃의 유사도 span 변경:

기존:
```tsx
{isSearchMode && cat.similarity_score != null && (
  <span className="ml-2 font-mono text-sm text-accent">
    {(cat.similarity_score * 100).toFixed(1)}%
  </span>
)}
```

변경:
```tsx
{isSearchMode && cat.similarity_score != null && (
  <button
    type="button"
    className="ml-2 font-mono text-sm text-accent cursor-pointer hover:underline"
    onClick={(e) => {
      e.stopPropagation();
      setActiveResult(cat as Recommendation);
      setCosineDialogOpen(true);
    }}
  >
    {(cat.similarity_score * 100).toFixed(1)}%
  </button>
)}
```

- [ ] **Step 7: CosineDetailDialog 컴포넌트 추가**

`</main>` 태그 직전, `CategoryModal` 아래에 추가:

```tsx
{/* 코사인 유사도 상세 다이얼로그 */}
<CosineDetailDialog
  open={cosineDialogOpen}
  onOpenChange={setCosineDialogOpen}
  result={activeResult}
/>
```

- [ ] **Step 8: `Recommendation` import 확인**

admin 페이지 상단 import에 `Recommendation` 타입이 포함되어 있는지 확인. `@/lib/api` import에서 `Recommendation`을 추가:

```tsx
import { recommend, type Category, type Recommendation, type PaginationMeta } from "@/lib/api";
```

- [ ] **Step 9: lint + tsc 확인**

```bash
docker exec cl_embed_nextjs npm run lint
```

- [ ] **Step 10: Commit**

```bash
git add nextjs/app/admin/page.tsx
git commit -m "feat: admin에 계층 탐색, 일괄 번역, 코사인 다이얼로그 통합"
```

---

### Task 5: embed 페이지 최소화

**Files:**
- Modify: `nextjs/app/embed/page.tsx`

**Purpose:** embed 페이지에서 모든 기능 로직을 제거하고 인증 가드와 안내 메시지만 남긴다.

- [ ] **Step 1: embed 페이지 재작성**

```tsx
"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getToken } from "@/hooks/useAuth";

export default function EmbedPage() {
  const router = useRouter();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    if (mounted && !getToken()) {
      router.replace("/login?redirect=/embed");
    }
  }, [mounted, router]);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="noise-overlay" />
      <div className="absolute inset-0 bg-grid" />
      <div className="glow-orb -top-40 -right-40 h-96 w-96 bg-blue-500/15 dark:bg-blue-500/10" />
      <div className="glow-orb -bottom-40 -left-40 h-96 w-96 bg-purple-500/15 dark:bg-purple-500/10" />

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12 sm:px-8">
        <div className="flex flex-1 items-center justify-center">
          <Card className="flex flex-col items-center gap-4 py-16 px-8 max-w-md text-center">
            <Inbox className="h-12 w-12 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">기능이 이전되었습니다</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                카테고리 추천 기능이 관리자 페이지로 통합되었습니다.
              </p>
            </div>
            <Button asChild>
              <Link href="/admin">
                관리자 페이지로 이동
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </Card>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: lint 확인**

```bash
docker exec cl_embed_nextjs npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add nextjs/app/embed/page.tsx
git commit -m "refactor: embed 페이지 최소화, admin 이전 안내로 대체"
```

---

### Task 6: 테스트 및 최종 검증

**Purpose:** lint, tsc, Vitest, Pest, Playwright 순으로 전체 검증. 실패 건이 있으면 수정.

- [ ] **Step 1: lint + tsc 검증**

```bash
docker exec cl_embed_nextjs npm run lint
docker exec cl_embed_nextjs npx tsc --noEmit
```

- [ ] **Step 2: Vitest 실행**

```bash
docker exec cl_embed_nextjs npm test
```

- [ ] **Step 3: Pest 실행**

```bash
docker exec cl_embed_laravel php artisan config:clear
docker exec cl_embed_laravel php artisan test --compact
```

- [ ] **Step 4: run-all-checks.sh 실행**

```bash
.claude/hooks/run-all-checks.sh
```

- [ ] **Step 5: Playwright 브라우저 테스트**

admin 페이지 접속 후 수동 검증 항목:
- 계층 탐색 Select 3개가 정상 동작하는지
- 소분류 선택 시 CategoryModal이 열리는지
- 일괄 번역 "전체 번역 실행" 클릭 시 Progress bar가 표시되는지
- 검색 결과의 유사도 점수 클릭 시 CosineDetailDialog가 열리는지
- embed 페이지 접속 시 안내 메시지가 표시되는지

- [ ] **Step 6: 실패 건 수정 후 최종 커밋**

검증 중 발견된 이슈 수정 후 커밋.
