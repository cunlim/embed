# 카테고리 삭제 섹션 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** embed 페이지에 삭제 섹션을 추가하고, 4개 버튼(선택처리/전체처리/선택삭제/전체삭제) 모두 확인 알림과 필터 범위를 통일합니다.

**Architecture:** TaskExecution과 동일한 패턴의 CategoryDelete 컴포넌트를 만들고, embed-page-inner.tsx에서 CategoryHierarchy 필터 상태를 추적하여 두 컴포넌트에 전달합니다.

**Tech Stack:** Next.js 16, React 19, TypeScript, shadcn/ui, Vitest

---

## 파일 구조

| 작업 | 파일 | 역할 |
|------|------|------|
| 수정 | `nextjs/components/admin/task-execution.tsx` | `keyword` prop 추가, 확인 알림 추가 |
| 수정 | `nextjs/components/admin/__tests__/task-execution.test.tsx` | 확인 알림 테스트 추가 |
| 생성 | `nextjs/components/admin/category-delete.tsx` | 삭제 섹션 컴포넌트 |
| 생성 | `nextjs/components/admin/__tests__/category-delete.test.tsx` | 삭제 컴포넌트 테스트 |
| 수정 | `nextjs/app/embed/embed-page-inner.tsx` | keyword state 추적, CategoryDelete 렌더링 |

---

### Task 1: TaskExecution에 keyword prop과 확인 알림 추가

**Files:**
- Modify: `nextjs/components/admin/task-execution.tsx`
- Modify: `nextjs/components/admin/__tests__/task-execution.test.tsx`

- [ ] **Step 1: TaskExecution에 keyword prop 추가**

`task-execution.tsx`의 `TaskExecutionProps`에 `keyword`를 추가하고, `handleFullProcess`에서 `getCategories` 호출 시 전달합니다.

```tsx
// TaskExecutionProps 인터페이스에 추가 (line 17 근처)
interface TaskExecutionProps {
  token: string | null;
  selectedIds: Set<number>;
  categories: (Category | Recommendation)[];
  filter: string | undefined;
  keyword?: string;  // ← 추가
  canModify: (cat: Category | Recommendation) => boolean;
  onComplete: (wasStopped: boolean) => void;
  onCategoryComplete?: () => void;
}
```

```tsx
// destructuring에 keyword 추가 (line 64 근처)
export default function TaskExecution({
  token,
  selectedIds,
  categories,
  filter,
  keyword,  // ← 추가
  canModify,
  onComplete,
  onCategoryComplete,
}: TaskExecutionProps) {
```

```tsx
// handleFullProcess에서 getCategories 호출 시 keyword 전달 (line 307)
const res = await getCategories(token, 1, 100000, filter, keyword);
```

```tsx
// useCallback 의존성 배열에 keyword 추가 (line 321)
}, [token, filter, keyword, canModify, executeQueue]);
```

- [ ] **Step 2: 확인 알림 로직 추가**

`handleSelectedProcess`와 `handleFullProcess`에 `window.confirm`을 추가합니다.

```tsx
// handleSelectedProcess (line 285-299)
const handleSelectedProcess = useCallback(async () => {
  if (!token) {
    alert("로그인이 필요합니다");
    return;
  }
  const targetIds = Array.from(selectedIds).filter((id) => {
    const cat = categories.find((c) => c.id === id);
    return cat && canModify(cat);
  });
  if (targetIds.length === 0) {
    alert("선택된 수정 가능한 카테고리가 없습니다");
    return;
  }
  if (!window.confirm(`선택한 ${targetIds.length}개 카테고리를 처리하시겠습니까?`)) return;
  await executeQueue(targetIds);
}, [token, selectedIds, categories, canModify, executeQueue]);
```

```tsx
// handleFullProcess (line 301-321)
const handleFullProcess = useCallback(async () => {
  if (!token) {
    alert("로그인이 필요합니다");
    return;
  }
  try {
    const res = await getCategories(token, 1, 100000, filter, keyword);
    const targetIds = res.data
      .filter((cat) => canModify(cat))
      .map((cat) => cat.id);
    if (targetIds.length === 0) {
      alert("처리 가능한 카테고리가 없습니다");
      return;
    }
    if (!window.confirm(`현재 필터에 해당하는 ${targetIds.length}개 카테고리를 처리하시겠습니까?`)) return;
    await executeQueue(targetIds);
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "카테고리 목록 조회 실패",
    );
  }
}, [token, filter, keyword, canModify, executeQueue]);
```

- [ ] **Step 3: 테스트 수정 및 실행**

기존 테스트에 `keyword` prop이 없어도 동작하도록 확인하고, 확인 알림 테스트를 추가합니다.

```tsx
// task-execution.test.tsx에 추가
it("선택 처리 클릭 시 확인 알림이 표시된다", () => {
  const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
  renderTaskExecution({ selectedIds: new Set([1]) });

  fireEvent.click(screen.getByText("선택 처리"));

  expect(confirmSpy).toHaveBeenCalledWith("선택한 1개 카테고리를 처리하시겠습니까?");
  confirmSpy.mockRestore();
});

it("전체 처리 클릭 시 확인 알림이 표시된다", async () => {
  const { getCategories } = await import("@/lib/api");
  vi.mocked(getCategories).mockResolvedValue({
    data: mockCategories,
    meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 },
  });
  const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
  renderTaskExecution();

  fireEvent.click(screen.getByText("전체 처리"));

  // getCategories 호출 후 confirm 표시
  await screen.findByText(/확인/);
  expect(confirmSpy).toHaveBeenCalled();
  confirmSpy.mockRestore();
});
```

Run: `docker exec cl_embed_nextjs npm test -- --reporter=verbose task-execution`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add nextjs/components/admin/task-execution.tsx nextjs/components/admin/__tests__/task-execution.test.tsx
git commit -m "feat: TaskExecution에 keyword prop과 확인 알림 추가"
```

---

### Task 2: CategoryDelete 컴포넌트 생성

**Files:**
- Create: `nextjs/components/admin/category-delete.tsx`
- Create: `nextjs/components/admin/__tests__/category-delete.test.tsx`

- [ ] **Step 1: 테스트 먼저 작성**

```tsx
// nextjs/components/admin/__tests__/category-delete.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CategoryDelete from "@/components/admin/category-delete";
import type { Category } from "@/lib/api";

vi.mock("@/lib/api");

const mockCategories: Category[] = [
  {
    id: 1,
    user_id: 1,
    category_code: "50000000",
    category_name_ko: "테스트>카테고리",
    category_name_zh: null,
    category_name_en: null,
    translation_status: "pending",
  },
  {
    id: 2,
    user_id: 1,
    category_code: "50000001",
    category_name_ko: "테스트>카테고리2",
    category_name_zh: null,
    category_name_en: null,
    translation_status: "pending",
  },
];

function renderCategoryDelete(props: Partial<{
  token: string | null;
  selectedIds: Set<number>;
  categories: Category[];
  filter: string | undefined;
  keyword: string | undefined;
}> = {}) {
  return render(
    <CategoryDelete
      token={props.token ?? "test-token"}
      selectedIds={props.selectedIds ?? new Set()}
      categories={props.categories ?? mockCategories}
      filter={props.filter}
      keyword={props.keyword}
      canModify={() => true}
      onComplete={vi.fn()}
      onCategoryComplete={vi.fn()}
    />
  );
}

describe("CategoryDelete", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("선택삭제와 전체삭제 버튼을 렌더링한다", () => {
    renderCategoryDelete();
    expect(screen.getByText("선택삭제")).toBeInTheDocument();
    expect(screen.getByText("전체삭제")).toBeInTheDocument();
  });

  it("선택된 ID가 없으면 선택삭제 버튼이 disabled 된다", () => {
    renderCategoryDelete({ selectedIds: new Set() });
    expect(screen.getByText("선택삭제")).toBeDisabled();
  });

  it("선택삭제 클릭 시 확인 알림이 표시된다", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderCategoryDelete({ selectedIds: new Set([1]) });

    fireEvent.click(screen.getByText("선택삭제"));

    expect(confirmSpy).toHaveBeenCalledWith("선택한 1개 카테고리를 삭제하시겠습니까?");
    confirmSpy.mockRestore();
  });

  it("전체삭제 클릭 시 확인 알림이 표시된다", async () => {
    const { getCategories } = await import("@/lib/api");
    vi.mocked(getCategories).mockResolvedValue({
      data: mockCategories,
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 2 },
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderCategoryDelete();

    fireEvent.click(screen.getByText("전체삭제"));

    // getCategories 호출 후 confirm 표시
    await screen.findByText(/삭제/);
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
```

Run: `docker exec cl_embed_nextjs npm test -- --reporter=verbose category-delete`
Expected: FAIL (component not found)

- [ ] **Step 2: CategoryDelete 컴포넌트 구현**

```tsx
// nextjs/components/admin/category-delete.tsx
"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Square } from "lucide-react";
import {
  getCategories,
  deleteCategory,
} from "@/lib/api";
import type { Category, Recommendation } from "@/lib/api";

interface CategoryDeleteProps {
  token: string | null;
  selectedIds: Set<number>;
  categories: (Category | Recommendation)[];
  filter: string | undefined;
  keyword?: string;
  canModify: (cat: Category | Recommendation) => boolean;
  onComplete: () => void;
  onCategoryComplete?: () => void;
}

interface DeleteProgress {
  total: number;
  completed: number;
  failed: number;
  currentCategory: string;
  queueEmpty: boolean;
}

export default function CategoryDelete({
  token,
  selectedIds,
  categories,
  filter,
  keyword,
  canModify,
  onComplete,
  onCategoryComplete,
}: CategoryDeleteProps) {
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [wasStopped, setWasStopped] = useState(false);
  const [progress, setProgress] = useState<DeleteProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const executeDelete = useCallback(
    async (targetIds: number[]) => {
      setRunning(true);
      setWasStopped(false);
      setStopping(false);
      setError(null);
      abortRef.current = false;

      setProgress({
        total: targetIds.length,
        completed: 0,
        failed: 0,
        currentCategory: "준비 중...",
        queueEmpty: false,
      });

      if (targetIds.length === 0) {
        setProgress((p) =>
          p ? { ...p, queueEmpty: true, currentCategory: "" } : p,
        );
        setRunning(false);
        onComplete();
        return;
      }

      let completed = 0;
      let failed = 0;

      for (const id of targetIds) {
        if (abortRef.current) break;

        const cat = categories.find((c) => c.id === id);
        setProgress((p) =>
          p ? { ...p, currentCategory: cat?.category_name_ko ?? `ID: ${id}` } : p,
        );

        try {
          await deleteCategory(id, token);
          completed++;
          setProgress((p) =>
            p ? { ...p, completed: p.completed + 1 } : p,
          );
          onCategoryComplete?.();
        } catch {
          failed++;
          setProgress((p) =>
            p ? { ...p, failed: p.failed + 1 } : p,
          );
        }
      }

      if (abortRef.current) {
        setStopping(false);
        setRunning(false);
        setWasStopped(true);
        return;
      }

      setRunning(false);
      onComplete();
    },
    [token, categories, onComplete, onCategoryComplete],
  );

  const handleSelectedDelete = useCallback(async () => {
    if (!token) {
      alert("로그인이 필요합니다");
      return;
    }
    const targetIds = Array.from(selectedIds).filter((id) => {
      const cat = categories.find((c) => c.id === id);
      return cat && canModify(cat);
    });
    if (targetIds.length === 0) {
      alert("선택된 삭제 가능한 카테고리가 없습니다");
      return;
    }
    if (!window.confirm(`선택한 ${targetIds.length}개 카테고리를 삭제하시겠습니까?`)) return;
    await executeDelete(targetIds);
  }, [token, selectedIds, categories, canModify, executeDelete]);

  const handleFullDelete = useCallback(async () => {
    if (!token) {
      alert("로그인이 필요합니다");
      return;
    }
    try {
      const res = await getCategories(token, 1, 100000, filter, keyword);
      const targetIds = res.data
        .filter((cat) => canModify(cat))
        .map((cat) => cat.id);
      if (targetIds.length === 0) {
        alert("삭제 가능한 카테고리가 없습니다");
        return;
      }
      if (!window.confirm(`현재 필터에 해당하는 ${targetIds.length}개 카테고리를 삭제하시겠습니까?`)) return;
      await executeDelete(targetIds);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "카테고리 목록 조회 실패",
      );
    }
  }, [token, filter, keyword, canModify, executeDelete]);

  const handleStop = useCallback(() => {
    abortRef.current = true;
    setStopping(true);
    setWasStopped(true);
  }, []);

  const pct =
    progress && progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  return (
    <Card className="p-4">
      <h3 className="font-medium text-sm">삭제</h3>
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSelectedDelete}
            disabled={running || selectedIds.size === 0}
            className="flex-1"
          >
            선택삭제
          </Button>
          <Button
            variant="destructive"
            onClick={handleFullDelete}
            disabled={running}
            className="flex-1"
          >
            전체삭제
          </Button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {progress && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Progress
                value={progress.queueEmpty ? 100 : pct}
                className="flex-1"
              />
              {!progress.queueEmpty && progress.total > 0 && (
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  [{progress.completed + progress.failed}/{progress.total}]
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>
                전체 {progress.total}개 / 완료 {progress.completed}개 / 실패{" "}
                {progress.failed}개
              </p>
              {progress.queueEmpty && (
                <p>삭제할 카테고리가 없습니다</p>
              )}
              {!progress.queueEmpty && progress.currentCategory && (
                <p className="truncate">
                  현재: &ldquo;{progress.currentCategory}&rdquo;
                </p>
              )}
            </div>

            {running && (
              <Button
                onClick={handleStop}
                disabled={stopping}
                variant="destructive"
                className="w-full"
              >
                <Square className="h-4 w-4" />
                {stopping ? "중지 중..." : "삭제중지"}
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: 테스트 실행**

Run: `docker exec cl_embed_nextjs npm test -- --reporter=verbose category-delete`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add nextjs/components/admin/category-delete.tsx nextjs/components/admin/__tests__/category-delete.test.tsx
git commit -m "feat: CategoryDelete 컴포넌트 추가"
```

---

### Task 3: embed-page-inner.tsx에 keyword state 추적 및 CategoryDelete 렌더링

**Files:**
- Modify: `nextjs/app/embed/embed-page-inner.tsx`

- [ ] **Step 1: hierarchyKeyword state 추가**

`embed-page-inner.tsx`의 state 선언 부분(약 line 153)에 `hierarchyKeyword`를 추가합니다.

```tsx
// 기존 state 선언 근처에 추가
const [hierarchyKeyword, setHierarchyKeyword] = useState(initialFilterKeyword);
```

- [ ] **Step 2: handleFilterChange에서 keyword 업데이트**

`handleFilterChange` 콜백(약 line 374)에서 `hierarchyKeyword`도 업데이트합니다.

```tsx
const handleFilterChange = useCallback(
  (state: { mode: "hierarchy" | "search"; hierarchy: HierarchyFilterState; keyword: string }) => {
    setHierarchyKeyword(state.keyword);  // ← 추가
    updateURL({
      mode: state.mode,
      catPath: state.hierarchy,
      q: state.keyword || undefined,
    });
  },
  [updateURL]
);
```

- [ ] **Step 3: TaskExecution에 keyword prop 전달**

TaskExecution 렌더링 부분(약 line 630)에 `keyword` prop을 추가합니다.

```tsx
<TaskExecution
  token={token}
  selectedIds={selectedIds}
  categories={displayCategories}
  filter={effectiveFilter}
  keyword={hierarchyKeyword || undefined}  // ← 추가
  canModify={canModify}
  onComplete={(wasStopped) => {
    if (!wasStopped) {
      setSelectedIds(new Set());
    }
    loadCategories(page, perPage, effectiveFilter);
  }}
  onCategoryComplete={() => {
    loadCategories(page, perPage, effectiveFilter);
  }}
/>
```

- [ ] **Step 4: CategoryDelete 렌더링**

TaskExecution 아래(약 line 645)에 CategoryDelete를 렌더링합니다.

```tsx
{/* 삭제 */}
<CategoryDelete
  token={token}
  selectedIds={selectedIds}
  categories={displayCategories}
  filter={effectiveFilter}
  keyword={hierarchyKeyword || undefined}
  canModify={canModify}
  onComplete={() => {
    setSelectedIds(new Set());
    loadCategories(page, perPage, effectiveFilter);
    setHierarchyRefreshKey((prev) => prev + 1);
  }}
  onCategoryComplete={() => {
    loadCategories(page, perPage, effectiveFilter);
  }}
/>
```

- [ ] **Step 5: import 추가**

파일 상단 import에 CategoryDelete를 추가합니다.

```tsx
import CategoryDelete from "@/components/admin/category-delete";
```

- [ ] **Step 6: 타입 체크 실행**

Run: `docker exec cl_embed_nextjs npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: 전체 테스트 실행**

Run: `docker exec cl_embed_nextjs npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add nextjs/app/embed/embed-page-inner.tsx
git commit -m "feat: embed 페이지에 삭제 섹션 추가 및 필터 범위 통일"
```

---

## 검증

1. **브라우저 확인:** `https://embed.cunlim.dev/embed` 접속
   - 사이드바에 "삭제" 섹션이 "작업 실행" 아래에 표시되는지 확인
   - 선택삭제: 카테고리 선택 후 클릭 → 확인 알림 → 삭제 진행
   - 전체삭제: 클릭 → 확인 알림 → 삭제 진행
   - 선택처리/전체처리: 클릭 → 확인 알림 → 처리 진행

2. **전체 검증 스크립트:**
   ```bash
   .claude/hooks/run-all-checks.sh
   cat .claude/hooks/test-results/*.txt
   ```
   tsc, lint, test, pint 모두 EXIT=0 확인
