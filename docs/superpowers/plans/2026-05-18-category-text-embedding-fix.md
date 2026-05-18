# 카테고리 텍스트/임베딩 수정 모달 버그 픽스 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 한국어 카테고리 텍스트를 비울 수 있게 하고, 텍스트 수정 시 임베딩 버튼 상태가 올바르게 갱신되도록 수정

**Architecture:** 백엔드 DB 스키마에서 `category_name_ko` NOT NULL 제약을 제거하고, 프론트엔드 `useCategoryExecution`에 `clearStep`을 추가해 execState를 텍스트 수정 시점에 정리. 빈 한국어 텍스트일 때 번역/임베딩 액션 버튼 disabled 처리.

**Tech Stack:** Laravel 13 (PHP 8.5, PostgreSQL + pgvector), Next.js 16 (React 19, TypeScript 5, Tailwind v4)

---

### Task 1: DB 마이그레이션 — `category_name_ko` nullable 전환

**Files:**
- Create: `laravel/database/migrations/2026_05_18_000001_alter_categories_make_name_ko_nullable.php`

- [ ] **Step 1: Create migration file**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->string('category_name_ko', 255)->nullable()->change();
        });
    }

    public function down(): void
    {
        // NOT NULL 복원 시 기존 null 행을 기본값으로 채워야 함
        Schema::table('categories', function (Blueprint $table) {
            $table->string('category_name_ko', 255)->nullable(false)->change();
        });
    }
};
```

- [ ] **Step 2: Run migration**

Run: `docker exec cl_embed_laravel php artisan migrate`

Expected: `2026_05_18_000001_alter_categories_make_name_ko_nullable ........................... DONE`

- [ ] **Step 3: Update existing test for null ko value**

**Files:** `laravel/tests/Feature/CategoryUpdateTextTest.php`

Add test case after line 153 (기존 `value를 null로 업데이트할 수 있다` 테스트):

```php
it('category_name_ko를 null로 업데이트할 수 있다', function () {
    $category = Category::factory()->create([
        'category_name_ko' => '원본 이름',
    ]);

    $response = $this->withToken($this->token)
        ->putJson("/api/categories/{$category->id}/update-text", [
            'field' => 'category_name_ko',
            'value' => null,
        ]);

    $response->assertOk();
    $this->assertDatabaseHas('categories', [
        'id' => $category->id,
        'category_name_ko' => null,
    ]);
});
```

- [ ] **Step 4: Run tests**

Run: `docker exec cl_embed_laravel php artisan test --compact --filter=CategoryUpdateTextTest`

Expected: 모든 테스트 PASS (기존 8개 + 신규 1개)

- [ ] **Step 5: Run Pint**

Run: `docker exec cl_embed_laravel vendor/bin/pint --format agent`

- [ ] **Step 6: Commit**

```bash
git add laravel/database/migrations/2026_05_18_000001_alter_categories_make_name_ko_nullable.php laravel/tests/Feature/CategoryUpdateTextTest.php
git commit -m "fix: category_name_ko nullable 전환 및 null 업데이트 테스트 추가"
```

---

### Task 2: `useCategoryExecution`에 `clearStep` 추가

**Files:**
- Modify: `nextjs/hooks/useCategoryExecution.ts`

- [ ] **Step 1: `UseCategoryExecutionReturn` 인터페이스에 `clearStep` 추가**

```typescript
export interface UseCategoryExecutionReturn {
  getState: (catId: number) => CatExecState;
  handleSingleAction: (
    catId: number,
    stepName: StepName,
    onListRefresh?: () => void,
    onUpdateData?: (data: CategoryTranslations) => void,
  ) => Promise<void>;
  handleRunAll: (
    catId: number,
    data: CategoryTranslations,
    onListRefresh?: () => void,
    onUpdateData?: (data: CategoryTranslations) => void,
  ) => Promise<void>;
  handleCancelPending: (catId: number) => void;
  clearStep: (catId: number, stepName: StepName) => void;
}
```

- [ ] **Step 2: `clearStep` 구현 추가** (`handleCancelPending` 다음, return 구문 전)

```typescript
const clearStep = useCallback((catId: number, stepName: StepName) => {
    const state = getState(catId);
    const nextCompleted = new Set(state.completedSteps);
    nextCompleted.delete(stepName);
    state.completedSteps = nextCompleted;

    const nextResults = new Map(state.stepResults);
    nextResults.delete(stepName);
    state.stepResults = nextResults;

    const nextCopyable = new Set(state.copyableSteps);
    nextCopyable.delete(stepName);
    state.copyableSteps = nextCopyable;

    forceUpdate();
}, [getState]);
```

- [ ] **Step 3: return 객체에 `clearStep` 추가**

```typescript
return {
    getState,
    handleSingleAction,
    handleRunAll,
    handleCancelPending,
    clearStep,
};
```

- [ ] **Step 4: `clearStep` 테스트 추가**

**Files:** `nextjs/hooks/__tests__/useCategoryExecution.test.ts`

Add test after `handleCancelPending` test:

```typescript
it("clearStep으로 completedSteps/stepResults/copyableSteps에서 step이 제거된다", () => {
    const { result } = renderHook(() => useCategoryExecution("token"));

    // 먼저 step 실행으로 상태 채우기
    mockFetch.mockResolvedValueOnce({
        json: async () => ({ status: "completed", result: "some result" }),
    });

    act(async () => {
        await result.current.handleSingleAction(1, "translation.en");
    });

    let state = result.current.getState(1);
    expect(state.completedSteps.has("translation.en")).toBe(true);
    expect(state.stepResults.size).toBe(1);

    // clearStep 호출
    act(() => {
        result.current.clearStep(1, "translation.en");
    });

    state = result.current.getState(1);
    expect(state.completedSteps.has("translation.en")).toBe(false);
    expect(state.stepResults.has("translation.en")).toBe(false);
    expect(state.copyableSteps.has("translation.en")).toBe(false);
});
```

- [ ] **Step 5: Run tests**

Run: `docker exec cl_embed_nextjs npm test`

Expected: 모든 테스트 PASS

- [ ] **Step 6: Commit**

```bash
git add nextjs/hooks/useCategoryExecution.ts nextjs/hooks/__tests__/useCategoryExecution.test.ts
git commit -m "feat: useCategoryExecution에 clearStep 메서드 추가"
```

---

### Task 3: `CategoryModal` — `onClearStep` 및 `isKoEmpty` 처리

**Files:**
- Modify: `nextjs/components/admin/category-modal.tsx`

- [ ] **Step 1: Props 인터페이스에 `onClearStep` 추가**

```typescript
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CategoryTranslations | null;
  isLoading: boolean;
  error: string | null;
  token?: string | null;
  onUpdateData?: (data: CategoryTranslations) => void;
  onUpdateListRow?: (row: { id: number; translation_status: string }) => void;
  execState: CatExecState | null;
  onSingleAction: (stepName: StepName) => Promise<void>;
  onRunAll: () => Promise<void>;
  onCancelPending: () => void;
  onClearStep?: (stepName: StepName) => void;  // ← 추가
}
```

Note: `catId`는 `data.id`로 이미 접근 가능하므로 `stepName`만 받음.

- [ ] **Step 2: `handleBlur` 성공 시 `onClearStep` 호출**

```typescript
const handleBlur = async (langKey: "ko" | "en" | "zh") => {
    if (!data) return;
    const fieldMap: Record<string, "category_name_ko" | "category_name_en" | "category_name_zh"> = {
      ko: "category_name_ko",
      en: "category_name_en",
      zh: "category_name_zh",
    };
    const originalValue = data.languages[langKey].translation_text ?? "";
    const newValue = editValues[langKey] ?? originalValue;
    if (newValue === originalValue) return;

    try {
      const res = await updateCategoryText(data.id, fieldMap[langKey], newValue || null, token);
      setEditValues({});
      onUpdateData?.(res.data.translations);
      onUpdateListRow?.(res.data.listRow);
      // 해당 언어의 임베딩 step을 execState에서 정리
      const embedStep = `embedding.${langKey}` as StepName;
      onClearStep?.(embedStep);
      toast("저장되었습니다");
    } catch {
      toast("저장에 실패했습니다");
    }
};
```

- [ ] **Step 3: `isKoEmpty` 변수 추가 및 버튼 disabled 로직 적용**

`data && !isLoading` 블록 내부, `LANGUAGES.map` 직전에 추가:

```typescript
const isKoEmpty = data && !data.category_name_ko;
```

`LANGUAGES.map` 루프 내 `translationDone` 계산 후 추가 변수:

```typescript
const noSourceText = isKoEmpty && lang.hasTranslation;          // en/zh 번역 버튼
const noSourceTextForEmbedding = isKoEmpty;                     // 모든 임베딩 버튼
```

번역 play 버튼 `disabled`에 `noSourceText` 추가:

```typescript
disabled={isExecuting || translationDone === false || noSourceText}
```

임베딩 play 버튼 `disabled`에 `noSourceTextForEmbedding` 추가:

```typescript
disabled={isExecuting || translationDone === false || noSourceTextForEmbedding}
```

"전체 실행" 버튼 `disabled`에 `isKoEmpty` 추가:

```typescript
<Button onClick={onRunAll} disabled={isExecuting || allCompleted || isKoEmpty}>
```

- [ ] **Step 4: prop destructuring에 `onClearStep` 추가**

```typescript
export default function CategoryModal({
  open, onOpenChange, data, isLoading, error, token,
  onUpdateData, onUpdateListRow,
  execState, onSingleAction, onRunAll, onCancelPending, onClearStep,
}: Props) {
```

- [ ] **Step 5: Run tests**

Run: `docker exec cl_embed_nextjs npm test`

Expected: 모든 테스트 PASS

- [ ] **Step 6: Commit**

```bash
git add nextjs/components/admin/category-modal.tsx
git commit -m "feat: CategoryModal에 onClearStep/onKoEmpty 처리 추가"
```

---

### Task 4: `AdminPage` — `clearStep`을 `CategoryModal`에 연결

**Files:**
- Modify: `nextjs/app/admin/page.tsx`

- [ ] **Step 1: `useCategoryExecution`에서 `clearStep` 구조분해**

```typescript
const { getState, handleSingleAction, handleRunAll, handleCancelPending, clearStep } =
    useCategoryExecution(token);
```

- [ ] **Step 2: `onClearStep` prop 전달**

`CategoryModal`에 다음 prop 추가:

```typescriptx
onClearStep={(stepName) => {
    if (modalCategoryId !== null) {
        clearStep(modalCategoryId, stepName);
    }
}}
```

- [ ] **Step 3: Run tests**

Run: `docker exec cl_embed_nextjs npm test`

Expected: 모든 테스트 PASS

- [ ] **Step 4: Commit**

```bash
git add nextjs/app/admin/page.tsx
git commit -m "feat: AdminPage - clearStep을 CategoryModal에 연결"
```

---

### Task 5: 통합 검증 (Playwright)

**Verification points:**
- 한국어 텍스트 비우고 blur → "저장되었습니다" (에러 없음)
- 한국어 빈 상태에서 en/zh 번역 버튼 disabled
- 한국어 빈 상태에서 모든 임베딩 버튼 disabled
- 한국어 빈 상태에서 "전체 실행" disabled
- 텍스트 수정 후 임베딩 버튼이 play 버튼으로 표시

- [ ] **Step 1: 한국어 삭제 후 저장 성공 확인**

Playwright에서 admin 페이지 진입 → 모달 열기 → 한국어 입력창 비우고 blur → "저장되었습니다" 토스트 확인

- [ ] **Step 2: 빈 한국어 상태에서 버튼 disabled 확인**

한국어가 빈 상태에서 en/zh 번역 버튼 disabled 상태 확인
임베딩 버튼 disabled 상태 확인
"전체 실행" disabled 상태 확인

- [ ] **Step 3: DB 데이터 복원**

```bash
docker exec cl_embed_laravel php artisan tinker --execute 'echo \App\Models\Category::where("id", 1)->update(["category_name_ko" => "가구/인테리어>침실가구>서랍장"]);'
```
