# Admin 테이블 및 페이지네이션 개선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin 페이지의 테이블 컬럼 너비 고정/줄임표 적용 및 compact 페이지네이션 + 페이지 크기 선택기 구현

**Architecture:** `getPageRange()` 유틸 함수로 페이지 범위 계산, `PaginationEllipsis` 버튼화, `perPage` 상태를 API→Hook→Page로 전달. 백엔드 `CategoryController`에서 `per_page` 쿼리 파라미터 수용.

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Tailwind v4 + shadcn/ui, Laravel 13 + PHP 8.5 + Pest 4

---

### Task 1: 백엔드 - CategoryController에 per_page 파라미터 추가

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php:62-66`

- [ ] **Step 1: `per_page` 쿼리 파라미터로 paginate 동적화**

`index()` 메서드에서 `Request $request`를 주입받아 `per_page` 파라미터를 읽도록 수정한다.

`laravel/app/Http/Controllers/Api/CategoryController.php`의 62-66행:

```php
use Illuminate\Http\Request;

public function index(Request $request): CategoryCollection
{
    $perPage = min((int) $request->input('per_page', 20), 100);

    return new CategoryCollection(
        Category::query()->with('embeddings')->orderBy('id')->paginate($perPage)
    );
}
```

- [ ] **Step 2: pint 포맷팅**

```bash
docker exec cl_embed_laravel vendor/bin/pint --format agent
```

- [ ] **Step 3: 테스트 실행**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryController
```

- [ ] **Step 4: Commit**

```bash
git add laravel/app/Http/Controllers/Api/CategoryController.php
git commit -m "feat: accept per_page query param in CategoryController index

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: API 클라이언트 - getCategories에 perPage 파라미터 추가

**Files:**
- Modify: `nextjs/lib/api.ts:145-154`

- [ ] **Step 1: `getCategories` 시그니처에 `perPage` 추가**

`nextjs/lib/api.ts`의 145-154행:

```typescript
export function getCategories(
  token?: string | null,
  page?: number,
  perPage?: number,
): Promise<CategoryListResponse> {
  const params = new URLSearchParams();
  if (page && page > 1) params.set("page", String(page));
  params.set("per_page", String(perPage ?? 20));
  const qs = params.toString();
  return request<CategoryListResponse>(`/categories?${qs}`, { token });
}
```

- [ ] **Step 2: 타입 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add nextjs/lib/api.ts
git commit -m "feat: add perPage parameter to getCategories API client

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: useCategories 훅 - perPage 지원 추가

**Files:**
- Modify: `nextjs/hooks/useCategories.ts`

- [ ] **Step 1: `loadCategories`에 `perPage` 파라미터 추가, `currentPerPage` ref 추가**

```typescript
// 기존 currentPage ref 근처에 추가
const currentPerPage = useRef(20);

// loadCategories 시그니처 변경
const loadCategories = useCallback(async (page?: number, perPage?: number) => {
  setIsLoading(true);
  setError(null);
  try {
    const data = await getCategories(token, page ?? currentPage.current, perPage ?? currentPerPage.current);
    setCategories(data.data);
    setMeta(data.meta);
    currentPage.current = data.meta.current_page;
    currentPerPage.current = data.meta.per_page;
    setIsLoaded(true);
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Failed to load category list"
    );
  } finally {
    setIsLoading(false);
  }
}, [token]);
```

- [ ] **Step 2: 타입 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add nextjs/hooks/useCategories.ts
git commit -m "feat: add perPage parameter to useCategories hook

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Admin 페이지 - 테이블 컬럼 너비 고정 및 줄임표

**Files:**
- Modify: `nextjs/app/admin/page.tsx`

- [ ] **Step 1: 테이블에 `table-fixed`, 셀에 `truncate` 적용, 컬럼 너비 조정**

`page.tsx`의 `<Table>` (335행) 및 관련 `<TableHead>`, `<TableCell>` 수정:

```tsx
// 335행: Table에 table-fixed 추가
<Table className="table-fixed">

// 338-348행: TableHead 너비 조정
<TableHead>
  {searchLanguage === "ko"
    ? "한국어 카테고리"
    : searchLanguage === "zh"
      ? "중국어 카테고리"
      : "영어 카테고리"}
</TableHead>
{isSearchMode && <TableHead className="w-[80px]">유사도</TableHead>}
<TableHead className="w-[80px]">상태</TableHead>
<TableHead className="w-[52px]">보기</TableHead>

// 353행: 이름 TableCell에 truncate 추가
<TableCell className="max-w-0 w-full truncate font-medium">

// 371행: 보기 TableCell에 text-center 추가
<TableCell className="text-center">
```

- [ ] **Step 2: 브라우저에서 확인**

Playwright로 admin 페이지에 접속하여 테이블 컬럼 너비와 줄임표 동작 확인.

```bash
# Playwright MCP로 https://embed.cunlim.dev/admin 접속하여 확인
```

- [ ] **Step 3: Commit**

```bash
git add nextjs/app/admin/page.tsx
git commit -m "fix: add table-fixed and truncate to admin category table

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Admin 페이지 - compact 페이지네이션 및 페이지 크기 선택기

**Files:**
- Modify: `nextjs/app/admin/page.tsx`

- [ ] **Step 1: `getPageRange` 유틸 함수 추가**

컴포넌트 외부(파일 상단)에 추가:

```typescript
function getPageRange(current: number, last: number): (number | '...')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);

  const pages: (number | '...')[] = [1];

  const start = Math.max(2, current - 2);
  const end = Math.min(last - 1, current + 2);

  if (start > 2) pages.push('...');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < last - 1) pages.push('...');

  pages.push(last);
  return pages;
}
```

예: `getPageRange(5, 242)` → `[1, '...', 3, 4, 5, 6, 7, '...', 242]`

- [ ] **Step 2: `perPage` 상태 추가**

기존 state 선언 영역(100행 근처)에 추가:

```typescript
const [perPage, setPerPage] = useState(20);
```

- [ ] **Step 3: `loadCategories` 호출에 `perPage` 전달**

95-98행 useEffect 수정:

```typescript
useEffect(() => {
  if (!mounted) return;
  loadCategories(page, perPage);
}, [mounted, page, perPage, loadCategories]);
```

- [ ] **Step 4: `PaginationEllipsis` import 추가 + `getEllipsisTarget` 유틸 + compact 페이지네이션 UI**

먼저 31-35행의 import 문에 `PaginationEllipsis` 추가:

```typescript
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
} from "@/components/ui/pagination";
```

`getPageRange` 아래에 추가:

```typescript
function getEllipsisTarget(current: number, last: number, direction: 'prev' | 'next'): number {
  if (direction === 'prev') return Math.max(1, current - 5);
  return Math.min(last, current + 5);
}
```

424-462행의 페이지네이션 블록을 다음으로 교체:

```tsx
{displayMeta && displayMeta.last_page > 1 && (
  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handlePageChange(displayMeta.current_page - 1)}
            disabled={displayMeta.current_page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </PaginationItem>
        {(() => {
          let ellipsisCount = 0;
          return getPageRange(displayMeta.current_page, displayMeta.last_page).map((p, i) => {
            if (p === '...') {
              const direction = ellipsisCount++ === 0 ? 'prev' : 'next';
              const target = getEllipsisTarget(
                displayMeta.current_page,
                displayMeta.last_page,
                direction,
              );
              return (
                <PaginationItem key={`e-${i}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => handlePageChange(target)}
                  >
                    <PaginationEllipsis />
                  </Button>
                </PaginationItem>
              );
            }
            return (
              <PaginationItem key={p}>
                <PaginationLink
                  isActive={p === displayMeta.current_page}
                  onClick={() => handlePageChange(p)}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            );
          });
        })()}
        <PaginationItem>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handlePageChange(displayMeta.current_page + 1)}
            disabled={displayMeta.current_page >= displayMeta.last_page}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>

    {/* 페이지 크기 선택기 */}
    <select
      value={perPage}
      onChange={(e) => {
        const newPerPage = Number(e.target.value);
        setPerPage(newPerPage);
        if (isSearchMode) {
          handleSearch(1);
        } else {
          router.push('/admin?page=1');
        }
      }}
      className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
    >
      <option value={10}>10 / page</option>
      <option value={20}>20 / page</option>
      <option value={50}>50 / page</option>
    </select>
  </div>
)}
```

ellipsis 좌우 판별은 `ellipsisCount` 카운터로: 첫 번째 `'...'` = 왼쪽(prev, -5), 두 번째 `'...'` = 오른쪽(next, +5). `getPageRange`는 최대 2개의 `'...'`만 생성하므로 안전하다.

- [ ] **Step 6: 타입 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7: 브라우저에서 확인**

Playwright로 admin 페이지에 접속하여 compact 페이지네이션 및 페이지 크기 선택기 동작 확인.

- [ ] **Step 8: Commit**

```bash
git add nextjs/app/admin/page.tsx
git commit -m "feat: add compact pagination and page size selector to admin

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 전체 검증

- [ ] **Step 1: `run-all-checks.sh` 실행**

```bash
.claude/hooks/run-all-checks.sh
```

Exit code 0인지 확인.

- [ ] **Step 2: Playwright E2E 확인**

```bash
# admin 페이지 접속하여 테이블 줄임표, 페이지네이션 compact 동작 확인
```

- [ ] **Step 3: 실패 시 디버깅 및 수정**

---

## Self-Review

**1. Spec coverage:** 모든 spec 요구사항이 태스크에 포함됨
- 테이블 컬럼 너비 고정 및 줄임표 → Task 4
- 페이지네이션 compact + 페이지 크기 선택기 → Task 5
- 백엔드 per_page 확인 → Task 1
- api.ts getCategories perPage 파라미터 → Task 2
- useCategories 훅 perPage 지원 → Task 3

**2. Placeholder scan:** 없음 — 모든 단계에 구체적 코드 포함

**3. Type consistency:**
- `getCategories(token, page, perPage)` → `useCategories`에서 `loadCategories(page, perPage)` → `admin/page.tsx`에서 `perPage` state로 관리
- `getPageRange(current, last)` 시그니처 일관
- `PaginationEllipsis`는 shadcn/ui에서 import (기존 import에 추가 필요)
