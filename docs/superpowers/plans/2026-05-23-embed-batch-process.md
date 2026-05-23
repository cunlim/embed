# Embed 페이지 일괄 처리 기능 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed 페이지 카테고리 목록에 체크박스를 추가하고, 기존 BatchTranslate를 TaskExecution으로 교체하여 선택/전체 일괄 처리 기능을 구현한다.

**Architecture:** 새 `TaskExecution` 컴포넌트가 좌측 사이드바에서 일괄 처리를 담당한다. `embed/page.tsx`는 체크박스 상태(`selectedIds`)를 관리하고 `TaskExecution`에 주입한다. `lib/api.ts`에서 사용하지 않는 `getAllCategories`, `translateEmbedCategory`, `cancelTranslateEmbed`를 제거한다.

**Tech Stack:** Next.js 16 + React 19 + TypeScript, shadcn/ui (base-nova), lucide-react

---

### 파일 구조

| 파일 | 작업 |
|------|------|
| `nextjs/components/admin/task-execution.tsx` | 신규 생성 — 일괄 처리 컴포넌트 |
| `nextjs/components/admin/batch-translate.tsx` | 삭제 |
| `nextjs/app/embed/page.tsx` | 수정 — 체크박스 + TaskExecution 교체 |
| `nextjs/lib/api.ts` | 수정 — 미사용 함수 제거 |

---

### Task 1: lib/api.ts 미사용 코드 제거

**Files:**
- Modify: `nextjs/lib/api.ts`

- [ ] **Step 1: `getAllCategories` 함수 제거**

`nextjs/lib/api.ts:160-165` 에서 다음을 삭제:

```typescript
export function getAllCategories(token?: string | null): Promise<CategoryListResponse> {
  const params = new URLSearchParams();
  params.set("per_page", "10000");
  params.set("page", "1");
  return request<CategoryListResponse>(`/categories?${params.toString()}`, { token });
}
```

- [ ] **Step 2: `TranslateEmbedResponse` 인터페이스 제거**

`nextjs/lib/api.ts:195-198` 에서 다음을 삭제:

```typescript
export interface TranslateEmbedResponse {
  message: string;
  category_id: number;
}
```

- [ ] **Step 3: `translateEmbedCategory` 함수 제거**

`nextjs/lib/api.ts:200-210` 에서 다음을 삭제:

```typescript
export function translateEmbedCategory(
  categoryId: number,
  token?: string | null,
  steps?: string[]
): Promise<TranslateEmbedResponse> {
  return request<TranslateEmbedResponse>(`/categories/${categoryId}/translate-embed`, {
    method: "POST",
    body: steps ? { steps } : undefined,
    token,
  });
}
```

- [ ] **Step 4: `cancelTranslateEmbed` 함수 제거**

`nextjs/lib/api.ts:212-220` 에서 다음을 삭제:

```typescript
export function cancelTranslateEmbed(
  categoryId: number,
  token?: string | null,
): Promise<TranslateEmbedResponse> {
  return request<TranslateEmbedResponse>(`/categories/${categoryId}/translate-embed/cancel`, {
    method: "POST",
    token,
  });
}
```

- [ ] **Step 5: 커밋**

```bash
git add nextjs/lib/api.ts
git commit -m "refactor: 미사용 API 함수 제거 (getAllCategories, translateEmbedCategory, cancelTranslateEmbed)"
```

---

### Task 2: BatchTranslate 컴포넌트 삭제

**Files:**
- Delete: `nextjs/components/admin/batch-translate.tsx`

- [ ] **Step 1: 파일 삭제**

```bash
rm nextjs/components/admin/batch-translate.tsx
```

- [ ] **Step 2: 커밋**

```bash
git add nextjs/components/admin/batch-translate.tsx
git commit -m "refactor: BatchTranslate 컴포넌트 제거"
```

---

### Task 3: TaskExecution 컴포넌트 생성

**Files:**
- Create: `nextjs/components/admin/task-execution.tsx`

- [ ] **Step 1: 컴포넌트 파일 생성**

다음 내용으로 `nextjs/components/admin/task-execution.tsx` 생성:

```typescript
"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Square } from "lucide-react";
import {
  runStep,
  getCategories,
  fetchCategoryTranslations,
} from "@/lib/api";
import type { Category, Recommendation, CategoryTranslations, StepName } from "@/lib/api";

interface TaskExecutionProps {
  token: string | null;
  selectedIds: Set<number>;
  categories: (Category | Recommendation)[];
  filter: string | undefined;
  canModify: (cat: Category | Recommendation) => boolean;
  onComplete: () => void;
}

interface BatchProgress {
  totalCategories: number;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  currentCategory: string;
  currentStep: string;
}

interface StepJob {
  categoryId: number;
  categoryName: string;
  stepName: StepName;
}

function determineMissingSteps(data: CategoryTranslations): StepName[] {
  const steps: StepName[] = [];

  // en: 번역 + 임베딩
  if (!data.languages.en.translation_text) steps.push("translation.en");
  if (data.languages.en.embedding.status !== "completed") steps.push("embedding.en");

  // zh: 번역 + 임베딩
  if (!data.languages.zh.translation_text) steps.push("translation.zh");
  if (data.languages.zh.embedding.status !== "completed") steps.push("embedding.zh");

  // ko: 임베딩만 (원본 언어)
  if (data.languages.ko.embedding.status !== "completed") steps.push("embedding.ko");

  return steps;
}

export default function TaskExecution({
  token,
  selectedIds,
  categories,
  filter,
  canModify,
  onComplete,
}: TaskExecutionProps) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const executeQueue = useCallback(
    async (targetCategoryIds: number[]) => {
      setRunning(true);
      setError(null);
      abortRef.current = false;

      // Phase 1: 카테고리별 누락 step 수집
      setProgress({
        totalCategories: targetCategoryIds.length,
        totalSteps: 0,
        completedSteps: 0,
        failedSteps: 0,
        currentCategory: "준비 중...",
        currentStep: "",
      });

      const queue: StepJob[] = [];
      for (const id of targetCategoryIds) {
        if (abortRef.current) break;
        try {
          const res = await fetchCategoryTranslations(id, token);
          const missing = determineMissingSteps(res.data);
          for (const step of missing) {
            queue.push({
              categoryId: id,
              categoryName: res.data.category_name_ko,
              stepName: step,
            });
          }
        } catch {
          // 조회 실패한 카테고리는 건너뜀
        }
      }

      if (abortRef.current) {
        setRunning(false);
        setProgress(null);
        return;
      }

      if (queue.length === 0) {
        setRunning(false);
        setProgress(null);
        return;
      }

      setProgress({
        totalCategories: targetCategoryIds.length,
        totalSteps: queue.length,
        completedSteps: 0,
        failedSteps: 0,
        currentCategory: "",
        currentStep: "",
      });

      // Phase 2: step 순차 실행
      for (const job of queue) {
        if (abortRef.current) break;

        setProgress((p) =>
          p
            ? { ...p, currentCategory: job.categoryName, currentStep: job.stepName }
            : p,
        );

        try {
          const result = await runStep(job.categoryId, job.stepName, token);
          if (result.status === "completed") {
            setProgress((p) =>
              p ? { ...p, completedSteps: p.completedSteps + 1 } : p,
            );
          } else {
            setProgress((p) =>
              p ? { ...p, failedSteps: p.failedSteps + 1 } : p,
            );
          }
        } catch {
          setProgress((p) =>
            p ? { ...p, failedSteps: p.failedSteps + 1 } : p,
          );
        }
      }

      setRunning(false);
      onComplete();
    },
    [token, onComplete],
  );

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
    await executeQueue(targetIds);
  }, [token, selectedIds, categories, canModify, executeQueue]);

  const handleFullProcess = useCallback(async () => {
    if (!token) {
      alert("로그인이 필요합니다");
      return;
    }
    try {
      const res = await getCategories(token, 1, 10000, filter);
      const targetIds = res.data
        .filter((cat) => canModify(cat))
        .map((cat) => cat.id);
      if (targetIds.length === 0) {
        alert("처리 가능한 카테고리가 없습니다");
        return;
      }
      await executeQueue(targetIds);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "카테고리 목록 조회 실패",
      );
    }
  }, [token, filter, canModify, executeQueue]);

  const handleStop = useCallback(() => {
    abortRef.current = true;
  }, []);

  const pct =
    progress && progress.totalSteps > 0
      ? Math.round((progress.completedSteps / progress.totalSteps) * 100)
      : 0;

  return (
    <Card className="p-4">
      <h3 className="mb-3 font-medium text-sm">작업 실행</h3>
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button
            onClick={handleSelectedProcess}
            disabled={running || selectedIds.size === 0}
            variant="outline"
            className="flex-1"
          >
            선택 처리
          </Button>
          <Button
            onClick={handleFullProcess}
            disabled={running}
            variant="outline"
            className="flex-1"
          >
            전체 처리
          </Button>
          <Button
            onClick={handleStop}
            disabled={!running}
            variant="outline"
            size="icon"
            className="shrink-0"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {progress && (
          <div className="space-y-2">
            <Progress value={pct} />
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>
                전체 {progress.totalCategories}개 / 실행할 {progress.totalSteps}개
              </p>
              <p>
                완료 {progress.completedSteps}개 / 실패 {progress.failedSteps}개
              </p>
              {progress.currentCategory && (
                <p className="truncate">
                  현재: &ldquo;{progress.currentCategory} &mdash;{" "}
                  {progress.currentStep}&rdquo;
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: 컨테이너에 파일 동기화**

```bash
cat /var/app/www/cl_embed/nextjs/components/admin/task-execution.tsx | base64 | docker exec -i cl_embed_nextjs bash -c "base64 -d > /app/components/admin/task-execution.tsx"
docker exec cl_embed_nextjs wc -l /app/components/admin/task-execution.tsx
```

- [ ] **Step 3: 커밋**

```bash
git add nextjs/components/admin/task-execution.tsx
git commit -m "feat: TaskExecution 컴포넌트 추가"
```

---

### Task 4: embed/page.tsx 수정 (체크박스 + TaskExecution 교체)

**Files:**
- Modify: `nextjs/app/embed/page.tsx`

- [ ] **Step 1: import 수정**

`nextjs/app/embed/page.tsx` 42행, `BatchTranslate` import를 제거하고 `Checkbox`, `TaskExecution` import를 추가:

```typescript
// 제거
import BatchTranslate from "@/components/admin/batch-translate";

// 추가 (Checkbox import는 기존 ui import에 추가)
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

// 추가 (컴포넌트 import)
import TaskExecution from "@/components/admin/task-execution";
```

- [ ] **Step 2: selectedIds state 추가**

`EmbedPageInner` 함수 내, `perPage` state 선언 근처(115행 부근)에 추가:

```typescript
const [perPage, setPerPage] = useState(initialPerPage);
const [filter, setFilter] = useState<string | undefined>(undefined);
const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
```

- [ ] **Step 3: 페이지/필터 변경 시 selectedIds 초기화**

`useEffect` 내에서 페이지/필터 변경 시 `selectedIds`를 초기화하는 effect 추가. 기존 119-122행의 effect 아래에 추가:

```typescript
// 페이지/필터 변경 시 selectedIds 초기화
useEffect(() => {
  setSelectedIds(new Set());
}, [page, perPage, filter]);
```

- [ ] **Step 4: 체크박스 핸들러 함수 추가**

`canModify` 정의(179행) 바로 아래에 추가:

```typescript
const toggleSelectAll = useCallback(() => {
  const modifiableIds = displayCategories
    .filter((cat) => canModify(cat))
    .map((cat) => cat.id);
  setSelectedIds((prev) => {
    const allChecked = modifiableIds.length > 0 && modifiableIds.every((id) => prev.has(id));
    return allChecked ? new Set() : new Set(modifiableIds);
  });
}, [displayCategories, canModify]);

const toggleSelect = useCallback((id: number) => {
  setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}, []);
```

전체선택 체크박스의 `checked` 상태는 JSX 내에서 직접 계산:

```typescript
// <Checkbox checked={...}> 에서 사용
const modifiableIds = displayCategories.filter((cat) => canModify(cat)).map((cat) => cat.id);
const allChecked = modifiableIds.length > 0 && modifiableIds.every((id) => selectedIds.has(id));
```

- [ ] **Step 5: 데스크톱 테이블 — 체크박스 컬럼 추가 (헤더)**

`<TableHeader>` 내 첫 번째 자식으로 추가. 기존 405행 `<TableHeader>` 내:

```tsx
<TableHead className="w-[40px]">
  <Checkbox
    checked={
      (() => {
        const ids = displayCategories.filter((cat) => canModify(cat)).map((cat) => cat.id);
        return ids.length > 0 && ids.every((id) => selectedIds.has(id));
      })()
    }
    onCheckedChange={toggleSelectAll}
    aria-label="전체 선택"
  />
</TableHead>
```

- [ ] **Step 6: 데스크톱 테이블 — 체크박스 컬럼 추가 (각 행)**

`<TableRow key={cat.id}>` 내 첫 번째 자식으로 추가. 기존 422행 `<TableCell className="max-w-0...">` 앞에:

```tsx
<TableCell className="w-[40px]">
  <Checkbox
    checked={selectedIds.has(cat.id)}
    disabled={!canModify(cat)}
    onCheckedChange={() => toggleSelect(cat.id)}
    aria-label={`${cat.category_name_ko ?? cat.category_name} 선택`}
  />
</TableCell>
```

- [ ] **Step 7: 모바일 Card — 체크박스 추가**

각 모바일 Card (489행 부근)의 `<div className="flex items-center justify-between">` 내부 첫 요소로 추가:

```tsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2 mr-2">
    <Checkbox
      checked={selectedIds.has(cat.id)}
      disabled={!canModify(cat)}
      onCheckedChange={() => toggleSelect(cat.id)}
      aria-label={`${cat.category_name_ko ?? cat.category_name} 선택`}
    />
    <div className="flex-1 min-w-0">
      ...
```

이 변경은 모바일 Card의 구조를 변경하므로 `<div className="flex-1 min-w-0">`가 기존의 `<div className="flex items-center justify-between">`의 직계 자식이 아니라 checkbox wrapper의 자식이 된다. 기존 구조에서 `<div className="flex-1 min-w-0">` 앞에 Checkbox + wrapper div를 추가하고, 그 wrapper div 아래에 기존 `flex-1 min-w-0` div와 오른쪽 버튼 영역을 재배치한다.

모바일 Card 전체 수정 후 구조:

```tsx
{displayCategories.map((cat) => (
  <Card key={cat.id} className="p-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0 mr-2">
        <Checkbox
          checked={selectedIds.has(cat.id)}
          disabled={!canModify(cat)}
          onCheckedChange={() => toggleSelect(cat.id)}
          aria-label={`${cat.category_name_ko ?? cat.category_name} 선택`}
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">
            {...}
          </p>
          <div className="mt-1">
            <StatusBadge status={cat.translation_status} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {canModify(cat) && (
          <Button ...>
            <Trash2 ... />
          </Button>
        )}
        <Button ...>
          {canModify(cat) ? <Pencil ... /> : <Eye ... />}
        </Button>
      </div>
    </div>
  </Card>
))}
```

- [ ] **Step 8: BatchTranslate → TaskExecution 교체**

325행의 `<BatchTranslate ... />`를 제거하고 다음으로 교체:

```tsx
{/* 작업 실행 */}
<TaskExecution
  token={token}
  selectedIds={selectedIds}
  categories={displayCategories}
  filter={filter}
  canModify={canModify}
  onComplete={() => {
    setSelectedIds(new Set());
    loadCategories(page, perPage, filter);
  }}
/>
```

- [ ] **Step 9: 컨테이너에 파일 동기화**

```bash
cat /var/app/www/cl_embed/nextjs/app/embed/page.tsx | base64 | docker exec -i cl_embed_nextjs bash -c "base64 -d > /app/app/embed/page.tsx"
docker exec cl_embed_nextjs wc -l /app/app/embed/page.tsx
```

- [ ] **Step 10: 커밋**

```bash
git add nextjs/app/embed/page.tsx
git commit -m "feat: embed 페이지 체크박스 및 TaskExecution 통합"
```

---

### Task 5: TypeScript 타입 체크 및 수정

**Files:**
- Check: 전체 TypeScript 파일

- [ ] **Step 1: 컨테이너에서 tsc 실행**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

예상: 0 errors

오류 발생 시 파일별로 수정하고 다시 실행. 주요 예상 이슈:
- `Checkbox`의 `checked` prop: `@base-ui/react`의 `Checkbox.Root`는 `checked` prop이 없고 `defaultChecked`만 있을 수 있음 → `checked` 대신 별도 상태 없이 `aria-checked`로만 처리하거나, `checked` prop이 지원되면 그대로 사용
- `onCheckedChange` 시그니처 불일치 → `@base-ui/react` API에 맞게 수정

- [ ] **Step 2: ESLint 실행**

```bash
docker exec cl_embed_nextjs npm run lint
```

예상: 0 errors, 0 warnings

- [ ] **Step 3: issue 해결 완료 시 커밋**

```bash
git add -A
git commit -m "fix: TypeScript 및 ESLint 오류 수정"
```

---

### Task 6: Vitest 실행

**Files:**
- 기존 테스트 파일들 (변경 없음)

- [ ] **Step 1: 테스트 실행**

```bash
docker exec cl_embed_nextjs npm test
```

예상: all tests pass (제거한 함수를 참조하는 테스트가 없으므로 영향 없음)

---

### Task 7: Laravel 테스트 실행

- [ ] **Step 1: Pest 테스트 실행**

```bash
docker exec cl_embed_laravel php artisan config:clear
docker exec cl_embed_laravel php artisan test --compact --env=testing
```

예상: all tests pass

---

### Task 8: Playwright 검증

**Browser:** `mcp__plugin_playwright_playwright`

- [ ] **Step 1: Embed 페이지 접속 및 로그인**

Playwright로 `https://embed.cunlim.dev/embed` 접속. 로그인 필요 시 Sanctum 토큰 생성 후 localStorage에 주입 (CLAUDE.md "알려진 이슈" 참조).

- [ ] **Step 2: 체크박스 UI 확인**

- 전체선택 체크박스가 테이블 헤더 첫 컬럼에 존재하는지
- 각 행 첫 컬럼에 개별 체크박스가 존재하는지
- 다른 사용자 소유 카테고리(타인 카테고리)의 체크박스가 `disabled` 상태인지
- 전체선택 클릭 시 `canModify=true`인 행만 모두 체크되는지
- 한 번 더 클릭 시 모두 해제되는지

- [ ] **Step 3: "선택 처리" 버튼 확인**

- 1개 이상 체크 후 "선택 처리" 버튼 활성화 확인
- "선택 처리" 클릭 후 진행률 표시 확인
- 완료 후 목록 갱신 확인

- [ ] **Step 4: "전체 처리" 버튼 확인**

- "전체 처리" 클릭 후 모든 카테고리에 대한 진행률 표시 확인
- 체크박스 상태와 무관하게 동작하는지 확인

- [ ] **Step 5: "중지" 버튼 확인**

- 실행 중 "중지" 클릭 → 현재 step 완료 후 중단
- 중단 후 다시 "선택 처리" 실행 시 "실행할 개수"가 줄어든 것 확인

---

### Task 9: run-all-checks.sh 최종 검증

- [ ] **Step 1: 전체 검증 실행**

```bash
.claude/hooks/run-all-checks.sh
```

예상: lint → tsc → vitest → pint → pest 모두 통과.

실패한 항목이 있으면 해당 항목 수정 후 재실행.

---

### Task 10: PHP 코드 정리 (Pint)

- [ ] **Step 1: Pint 실행**

```bash
docker exec cl_embed_laravel vendor/bin/pint --format agent
```

예상: No changes needed (Laravel 코드 변경 없음)
