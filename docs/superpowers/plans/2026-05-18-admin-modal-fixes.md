# Admin 모달 이슈 수정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin 페이지의 3가지 이슈(임베딩 버튼 disabled, 목록 정렬+페이지네이션, 전체실행 순차 애니메이션)를 수정한다.

**Architecture:** 이슈 1과 4는 `category-modal.tsx`의 renderRow/handleRunAll 로직 수정으로 해결한다. 이슈 3은 Laravel `paginate(20)` + Next.js `useSearchParams` URL 연동으로 서버사이드 페이지네이션을 구현한다. 이슈 4는 WebSocket `completed` 이벤트 수신 시 `pendingSteps` 배열에서 순차적으로 runningSteps를 채우는 방식으로 구현한다.

**Tech Stack:** Next.js 16 + React 19 + TypeScript + shadcn/ui, Laravel 13 + PHP 8.5 + Pest 4

---

### Task 1: 임베딩 버튼 disabled (renderRow 수정)

**Files:**
- Modify: `nextjs/components/admin/category-modal.tsx:163-247` (renderRow)
- Modify: `nextjs/components/admin/__tests__/category-modal.test.tsx`

- [ ] **Step 1: renderRow에 translationDone 파라미터 추가**

`renderRow` 시그니처에 `translationDone` 파라미터를 추가한다. `ko`는 항상 `true`, `en`/`zh`는 `translation_text !== null` 여부를 전달한다.

```tsx
// renderRow line 163 — 파라미터 추가
const renderRow = (
  label: string,
  displayValue: string | null,
  copyValue: string | null,
  stepName: StepName | null,
  translationDone?: boolean,
) => {
```

- [ ] **Step 2: Play 버튼 disabled 조건에 translationDone 추가**

Play 버튼(embedding/translation 실행)은 `translationDone === false`일 때도 disabled 되어야 한다. `isRunning`과 `translationDone === false`를 OR 조건으로 묶는다.

```tsx
// line 237-241 — disabled 조건 변경
) : stepName ? (
  <Button
    variant="ghost"
    size="icon"
    onClick={() => handleSingleAction(stepName)}
    title={label + " 실행"}
    disabled={isRunning || translationDone === false}
  >
    <Play className="size-3" />
  </Button>
) : null}
```

- [ ] **Step 3: 호출부에서 translationDone 전달**

`ko` 언어의 임베딩 행은 `translationDone=true`, `en`/`zh` 언어의 임베딩 행은 `detail.translation_text !== null`을 전달한다.

```tsx
// line 302-327 — renderRow 호출부 수정
<div className="space-y-0.5">
  {lang.hasTranslation
    ? (
      <>
        {renderRow(
          "번역",
          detail.translation_text,
          detail.translation_text,
          `translation.${lang.key}` as StepName,
        )}
        {renderRow(
          "임베딩",
          detail.embedding.preview
            ? `[${detail.embedding.preview.slice(0, 10).map((v) => v.toFixed(3)).join(", ")}…1024차원]`
            : null,
          detail.embedding.preview
            ? JSON.stringify(detail.embedding.preview)
            : null,
          `embedding.${lang.key}` as StepName,
          detail.translation_text !== null,
        )}
      </>
    )
    : (
      <>
        {renderRow(
          "원본",
          detail.translation_text,
          detail.translation_text,
          null,
        )}
        {renderRow(
          "임베딩",
          detail.embedding.preview
            ? `[${detail.embedding.preview.slice(0, 10).map((v) => v.toFixed(3)).join(", ")}…1024차원]`
            : null,
          detail.embedding.preview
            ? JSON.stringify(detail.embedding.preview)
            : null,
          `embedding.${lang.key}` as StepName,
          true,
        )}
      </>
    )
  }
</div>
```

- [ ] **Step 4: 테스트 추가 — 번역 미완료 시 임베딩 버튼 disabled 검증**

`nextjs/components/admin/__tests__/category-modal.test.tsx`에 다음 테스트를 추가한다:

```ts
it("번역이 완료되지 않은 언어의 임베딩 실행 버튼은 disabled 된다", () => {
  render(
    <CategoryModal
      open={true}
      onOpenChange={vi.fn()}
      data={pendingData}
      isLoading={false}
      error={null}
      token="token"
    />,
  );

  // en, zh 번역이 null → 임베딩 버튼은 disabled
  const embeddingButtons = screen.getAllByRole("button", { name: "임베딩 실행" });
  // ko의 임베딩 버튼은 활성화 (번역 불필요)
  // en, zh의 임베딩 버튼은 disabled (번역 미완료)
  const disabledEmbeds = embeddingButtons.filter((btn) => (btn as HTMLButtonElement).disabled);
  expect(disabledEmbeds.length).toBe(2); // en, zh
});

it("번역이 완료된 언어의 임베딩 실행 버튼은 활성화된다", () => {
  const partialData = {
    ...pendingData,
    languages: {
      ...pendingData.languages,
      en: {
        translation_text: "Life/Health>Laundry>Ironing Board",
        embedding: { status: "pending" as const, preview: null },
      },
    },
  };

  render(
    <CategoryModal
      open={true}
      onOpenChange={vi.fn()}
      data={partialData}
      isLoading={false}
      error={null}
      token="token"
    />,
  );

  const embeddingButtons = screen.getAllByRole("button", { name: "임베딩 실행" });
  // ko: 활성화, en: 활성화 (번역 완료), zh: disabled (번역 미완료)
  const enabledEmbeds = embeddingButtons.filter((btn) => !(btn as HTMLButtonElement).disabled);
  expect(enabledEmbeds.length).toBe(2); // ko, en
});
```

- [ ] **Step 5: 테스트 실행 및 확인**

```bash
docker exec cl_embed_nextjs npm test -- --filter="category-modal"
```

Expected: 12 tests (기존 10 + 신규 2) all pass.

- [ ] **Step 6: Commit**

```bash
git add nextjs/components/admin/category-modal.tsx nextjs/components/admin/__tests__/category-modal.test.tsx
git commit -m "fix: 임베딩 버튼 번역 미완료 시 disabled 처리"
```

---

### Task 2: Laravel 카테고리 목록 정렬 + 페이지네이션

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php:49-52`
- Modify: `laravel/tests/Feature/Api/CategoryControllerTest.php`

- [ ] **Step 1: 테스트 작성 — orderBy + paginate 검증**

`laravel/tests/Feature/Api/CategoryControllerTest.php`의 `'GET /api/categories — 카테고리 목록을 반환한다'` 테스트를 확장한다:

```php
test('GET /api/categories — id 오름차순으로 정렬된 카테고리 목록을 반환한다', function () {
    // id 역순으로 생성해도 응답은 id 오름차순이어야 함
    $cat3 = Category::factory()->create(['id' => 3, 'category_name_ko' => 'C']);
    $cat2 = Category::factory()->create(['id' => 2, 'category_name_ko' => 'B']);
    $cat1 = Category::factory()->create(['id' => 1, 'category_name_ko' => 'A']);

    $response = $this->getJson('/api/categories');

    $response->assertOk()
        ->assertJsonPath('data.0.id', 1)
        ->assertJsonPath('data.1.id', 2)
        ->assertJsonPath('data.2.id', 3);
});

test('GET /api/categories — 페이지네이션 응답에 meta와 links가 포함된다', function () {
    Category::factory()->count(25)->create();

    $response = $this->getJson('/api/categories');

    $response->assertOk()
        ->assertJsonCount(20, 'data')
        ->assertJsonStructure([
            'data',
            'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            'links' => ['first', 'last', 'prev', 'next'],
        ])
        ->assertJsonPath('meta.per_page', 20)
        ->assertJsonPath('meta.total', 25);
});

test('GET /api/categories — page 파라미터로 다른 페이지 조회', function () {
    Category::factory()->count(25)->create();

    $response = $this->getJson('/api/categories?page=2');

    $response->assertOk()
        ->assertJsonCount(5, 'data')
        ->assertJsonPath('meta.current_page', 2)
        ->assertJsonPath('meta.last_page', 2);
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter="GET /api/categories"
```

Expected: 신규 추가된 3개 테스트 FAIL (기존 2개는 통과).

- [ ] **Step 3: CategoryController::index() 수정**

```php
public function index(): CategoryCollection
{
    return new CategoryCollection(
        Category::query()->with('embeddings')->orderBy('id')->paginate(20)
    );
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter="GET /api/categories"
```

Expected: 5 tests (기존 2 + 신규 3) all PASS.

- [ ] **Step 5: Commit**

```bash
git add laravel/app/Http/Controllers/Api/CategoryController.php laravel/tests/Feature/Api/CategoryControllerTest.php
git commit -m "feat: 카테고리 목록 id 오름차순 정렬 및 페이지네이션 (per_page=20)"
```

---

### Task 3: 프론트엔드 페이지네이션 + URL 연동

**Files:**
- Modify: `nextjs/hooks/useCategories.ts`
- Modify: `nextjs/lib/api.ts:108-114` (getCategories, CategoryListResponse)
- Modify: `nextjs/app/admin/page.tsx` (Suspense 경계 추가, Pagination UI, URL 동기화 effect)
- Modify: `nextjs/hooks/__tests__/useCategories.test.ts`

Shadcn Pagination 컴포넌트가 없으므로 추가한다.

- [ ] **Step 1: shadcn Pagination 컴포넌트 추가**

```bash
docker exec cl_embed_nextjs sh -c "echo 'y' | npx shadcn@latest add pagination"
```

- [ ] **Step 2: API 함수 수정 — getCategories에 page 파라미터 추가**

`nextjs/lib/api.ts`:

```ts
export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

export interface CategoryListResponse {
  data: Category[];
  meta: PaginationMeta;
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
}

export function getCategories(
  token?: string | null,
  page?: number,
): Promise<CategoryListResponse> {
  const params = new URLSearchParams();
  if (page && page > 1) params.set("page", String(page));
  params.set("per_page", "20");
  const qs = params.toString();
  return request<CategoryListResponse>(`/categories?${qs}`, { token });
}
```

- [ ] **Step 3: useCategories 훅 수정 — page 파라미터 + meta 반환**

`nextjs/hooks/useCategories.ts`:

```ts
import { useState, useCallback, useEffect, useRef } from "react";
import {
  getCategories,
  createCategory,
  type Category,
  type PaginationMeta,
} from "@/lib/api";

interface UseCategoriesReturn {
  categories: Category[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  loadCategories: (page?: number) => Promise<void>;
  addCategory: (categoryNameKo: string) => Promise<void>;
}

export function useCategories(token?: string | null): UseCategoriesReturn {
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedToken = useRef<string | null | undefined>(undefined);
  const currentPage = useRef<number>(1);

  const loadCategories = useCallback(async (page?: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCategories(token, page ?? currentPage.current);
      setCategories(data.data);
      setMeta(data.meta);
      currentPage.current = data.meta.current_page;
      setIsLoaded(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "카테고리 목록을 불러오지 못했습니다"
      );
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // mount 시 자동 로드, token 변경 시 재로드
  useEffect(() => {
    if (loadedToken.current !== token) {
      loadedToken.current = token;
      setCategories([]);
      setMeta(null);
      setIsLoaded(false);
      loadCategories(1);
    }
  }, [token, loadCategories]);

  const addCategory = useCallback(
    async (categoryNameKo: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await createCategory(categoryNameKo, token);
        const data = await getCategories(token, currentPage.current);
        setCategories(data.data);
        setMeta(data.meta);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "카테고리 추가에 실패했습니다"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  return { categories, meta, isLoading, isLoaded, error, loadCategories, addCategory };
}
```

- [ ] **Step 4: admin/page.tsx 수정 — Suspense 경계 + Pagination UI**

`useSearchParams()`는 Suspense 경계가 필요하므로, 내부 컴포넌트 `AdminPageInner`를 생성하고 default export를 Suspense로 감싼다.

```tsx
"use client";

import { useState, useCallback, useSyncExternalStore, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus, RefreshCw, AlertCircle, Database, Eye,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import CategoryModal from "@/components/admin/category-modal";
import StatusBadge from "@/components/admin/status-badge";
import { useAuth, getToken } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryDetail } from "@/hooks/useCategoryDetail";
import { isAdmin } from "@/lib/utils";

export default function AdminPage() {
  return (
    <Suspense>
      <AdminPageInner />
    </Suspense>
  );
}

function AdminPageInner() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const authorized = user ? isAdmin(user.id) : false;

  // URL에서 현재 페이지 파싱
  const pageParam = searchParams.get("page");
  const [currentPage, setCurrentPage] = useState(() => {
    const p = parseInt(pageParam ?? "1", 10);
    return Number.isNaN(p) || p < 1 ? 1 : p;
  });

  // URL page 파라미터 변경 감지 → currentPage 동기화
  const urlPage = parseInt(pageParam ?? "1", 10);
  const effectivePage = Number.isNaN(urlPage) || urlPage < 1 ? 1 : urlPage;
  // effect 대신 렌더링 중 동기화 (이미 mount 완료 상태이므로 안전)
  const page = effectivePage;

  // 인증 가드
  useEffect(() => {
    if (!mounted || authLoading) return;

    if (!user) {
      router.replace("/login?redirect=/admin");
    } else if (!isAdmin(user.id)) {
      router.back();
    }
  }, [mounted, authLoading, user, router]);

  // URL page 파라미터 동기화 (mount 시 + URL 변경 시 해당 페이지 로드)
  useEffect(() => {
    if (!mounted) return;
    loadCategories(page);
  }, [mounted, page, loadCategories]);

  const token = mounted ? getToken() : null;
  const {
    categories,
    meta,
    isLoading: catLoading,
    error: catError,
    loadCategories,
    addCategory,
  } = useCategories(token);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [modalCategoryId, setModalCategoryId] = useState<number | null>(null);
  const { data: detailData, isLoading: detailLoading, error: detailError, reload } =
    useCategoryDetail(modalCategoryId, token);

  // page 변경 시 데이터 로드
  const handlePageChange = useCallback((newPage: number) => {
    router.push(`/admin?page=${newPage}`);
    // loadCategories는 page 파라미터를 받아 요청
    loadCategories(newPage);
  }, [router, loadCategories]);

  // ... (기존 handleAddCategory, return JSX 그대로)

  // 테이블 아래 Pagination 추가 (테이블이 표시될 때만)
  // CardContent 내부, 테이블 div 바로 아래에 추가:
```

Pagination UI:

```tsx
{/* 페이지네이션 */}
{meta && meta.last_page > 1 && (
  <div className="mt-4">
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (meta.current_page > 1) handlePageChange(meta.current_page - 1);
            }}
            disabled={meta.current_page <= 1}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            이전
          </Button>
        </PaginationItem>
        {Array.from({ length: meta.last_page }, (_, i) => i + 1).map((p) => (
          <PaginationItem key={p}>
            <PaginationLink
              isActive={p === meta.current_page}
              onClick={() => handlePageChange(p)}
            >
              {p}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (meta.current_page < meta.last_page) handlePageChange(meta.current_page + 1);
            }}
            disabled={meta.current_page >= meta.last_page}
          >
            다음
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  </div>
)}
```

- [ ] **Step 5: useCategories 테스트 수정**

`nextjs/hooks/__tests__/useCategories.test.ts` — mock 응답에 `meta` 추가, page 파라미터 검증:

```ts
const mockCategoryList = {
  data: [mockCategory],
  meta: {
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 1,
    from: 1,
    to: 1,
  },
  links: {
    first: null,
    last: null,
    prev: null,
    next: null,
  },
};

// 성공 시 meta도 반환되는지 검증 추가
it("성공 시 meta를 반환한다", async () => {
  mockGetCategories.mockResolvedValue(mockCategoryList);

  const { result } = renderHook(() => useCategories("token"));

  await act(async () => {
    await result.current.loadCategories();
  });

  expect(result.current.meta).toEqual(mockCategoryList.meta);
});
```

- [ ] **Step 6: 테스트 실행 및 확인**

```bash
docker exec cl_embed_nextjs npm test
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add nextjs/lib/api.ts nextjs/hooks/useCategories.ts nextjs/hooks/__tests__/useCategories.test.ts nextjs/app/admin/page.tsx nextjs/components/ui/pagination.tsx
git commit -m "feat: 카테고리 목록 서버사이드 페이지네이션 및 URL 연동"
```

---

### Task 4: 전체실행 순차 애니메이션 (pendingSteps 도입)

**Files:**
- Modify: `nextjs/components/admin/category-modal.tsx`
- Modify: `nextjs/components/admin/__tests__/category-modal.test.tsx`

- [ ] **Step 1: pendingSteps state 추가 및 초기화**

```tsx
// line 44-51 — pendingSteps state 추가
const [pendingSteps, setPendingSteps] = useState<StepName[]>([]);
```

`handleOpenChange`에서도 `pendingSteps` 초기화 추가:

```tsx
// line 252-261
if (!open) {
  setActionError(null);
  setRunningSteps(new Set());
  setPendingSteps([]);
  setCompletedSteps(new Set());
  setFailedSteps(new Set());
  setStepResults(new Map());
  setCopyableSteps(new Set());
  setEmbeddingFullData(new Map());
  setFlashSteps(new Set());
}
```

- [ ] **Step 2: handleRunAll 수정 — 첫 step만 running, 나머지는 pending**

```tsx
// line 128-161 — handleRunAll 변경
const handleRunAll = async () => {
  if (!data) return;
  setActionError(null);
  const steps: StepName[] = [];
  for (const lang of LANGUAGES) {
    if (lang.hasTranslation) {
      const tl = data.languages[lang.key];
      const transKey = `translation.${lang.key}` as StepName;
      const embedKey = `embedding.${lang.key}` as StepName;
      if (!tl.translation_text && !completedSteps.has(transKey) && !stepResults.has(transKey)) {
        steps.push(transKey);
      }
      if (tl.embedding.status !== "completed" && !completedSteps.has(embedKey) && !stepResults.has(embedKey)) {
        steps.push(embedKey);
      }
    } else {
      const embedKey = `embedding.${lang.key}` as StepName;
      if (data.languages[lang.key].embedding.status !== "completed" && !completedSteps.has(embedKey) && !stepResults.has(embedKey)) {
        steps.push(embedKey);
      }
    }
  }
  if (steps.length === 0) return;

  // 첫 step만 running, 나머지는 pending
  const firstStep = steps[0];
  const rest = steps.slice(1);
  setRunningSteps(new Set(firstStep ? [firstStep] : []));
  setPendingSteps(rest);

  subscribeProgress(data.id);
  try {
    await translateEmbedCategory(data.id, token, steps);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "실행 실패";
    setActionError(msg);
    setRunningSteps(new Set());
    setPendingSteps([]);
    cancel();
  }
};
```

- [ ] **Step 3: handleProgressUpdate — completed 시 pending→running 이동**

`completed` 케이스에서 `pendingSteps`를 소비하는 로직 추가:

```tsx
// handleProgressUpdate 내 completed 케이스 (line 88 line, setCopyableSteps 이후)
setPendingSteps((prev) => {
  if (prev.length === 0) return prev;
  const [nextStep, ...remaining] = prev;
  setRunningSteps((running) => new Set(running).add(nextStep));
  return remaining;
});
```

`failed` 케이스에서도 `pendingSteps` 초기화:

```tsx
// failed 케이스 (line 89-98)
} else if (progress.status === "failed") {
  setFailedSteps((prev) => new Set(prev).add(progress.stepName));
  setRunningSteps((prev) => {
    const next = new Set(prev);
    next.delete(progress.stepName);
    return next;
  });
  setPendingSteps([]);  // 추가
  if (progress.error) {
    setActionError(progress.error);
  }
}
```

- [ ] **Step 4: 전체실행 버튼 disabled 조건에 pendingSteps 반영**

전체실행 버튼은 `isRunning` 또는 `pendingSteps.length > 0` 일 때 disabled:

```tsx
// line 350
<Button onClick={handleRunAll} disabled={isRunning || pendingSteps.length > 0 || allCompleted}>
  전체 실행
</Button>
```

- [ ] **Step 5: 테스트 추가 — 전체실행 시 첫 step만 running 상태 검증**

```ts
it("전체실행 클릭 시 첫 번째 step만 running 상태가 된다", async () => {
  const { useCategoryProgress } = await import("@/hooks/useCategoryProgress");
  const mockStartTranslation = vi.fn();
  (useCategoryProgress as ReturnType<typeof vi.fn>).mockReturnValue({
    progress: null,
    isRunning: false,
    activeStep: null as string | null,
    startTranslation: mockStartTranslation,
    subscribeProgress: mockSubscribeProgress,
    cancel: mockCancel,
  });

  render(
    <CategoryModal
      open={true}
      onOpenChange={vi.fn()}
      data={pendingData}
      isLoading={false}
      error={null}
      token="token"
    />,
  );

  const runAllButton = screen.getByRole("button", { name: "전체 실행" });
  fireEvent.click(runAllButton);

  // 전체실행 클릭 후 첫 step만 Loader2(spinner) — 나머지는 Play 아이콘
  const loaderIcons = document.querySelectorAll(".animate-spin");
  expect(loaderIcons.length).toBe(1);
});
```

- [ ] **Step 6: 테스트 실행 및 확인**

```bash
docker exec cl_embed_nextjs npm test -- --filter="category-modal"
```

Expected: 13 tests (기존 12 + 신규 1) all pass.

- [ ] **Step 7: Commit**

```bash
git add nextjs/components/admin/category-modal.tsx nextjs/components/admin/__tests__/category-modal.test.tsx
git commit -m "feat: 전체실행 시 WebSocket 이벤트 기반 순차 애니메이션 구현"
```
