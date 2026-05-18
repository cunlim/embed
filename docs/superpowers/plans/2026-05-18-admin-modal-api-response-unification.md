# Admin 모달 API 응답 통합 및 렌더링 개선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin 카테고리 모달의 두 가지 이슈 수정 (빈 텍스트 input 표시, blur 저장 시 깜빡임 제거) 및 API 응답 통합

**Architecture:** `updateText`와 `runStep` API 응답에 전체 translations 데이터를 포함시켜 프론트가 API 응답으로 직접 모달 데이터를 갱신 (re-fetch 없음). useCategoryDetail에 setData 노출, useCategoryExecution에 onUpdateData 콜백 추가.

**Tech Stack:** Laravel 13 (PHP 8.5), Next.js 16 (React 19, TypeScript), Pest 4

---

### Task 1: 백엔드 — `updateText` 응답에 translations + listRow 추가

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php:372-394`

- [ ] **Step 1: `updateText` 응답 변경**

CategoryController.php의 `updateText` 메서드에서 `$category->fresh()`로 최신 상태를 읽고, `CategoryTranslationsResource`의 `resolve()`로 translations 데이터를 추출하여 응답에 포함. `listRow`는 `(new CategoryResource($category))->resolve()`로 추출함.

변경 코드 (`laravel/app/Http/Controllers/Api/CategoryController.php`):
```php
public function updateText(CategoryUpdateTextRequest $request, Category $category): JsonResponse
{
    $field = $request->input('field');
    $value = $request->input('value');

    $category->update([$field => $value]);

    $lang = match ($field) {
        'category_name_ko' => 'ko',
        'category_name_en' => 'en',
        'category_name_zh' => 'zh',
    };
    CategoryEmbedding::where('category_id', $category->id)
        ->where('language', $lang)
        ->delete();

    $category->fresh();
    $translations = (new CategoryTranslationsResource($category))->resolve();
    $listRow = (new CategoryResource($category))->resolve();

    return response()->json([
        'data' => [
            'updated' => true,
            'id' => $category->id,
            'translations' => $translations,
            'listRow' => $listRow,
        ],
    ]);
}
```

- [ ] **Step 2: 테스트 실행**

Run: `docker exec cl_embed_laravel php artisan test --compact --filter=updateText`
Expected: 기존 테스트 통과 (응답 구조 변경으로 테스트 수정이 필요할 수 있음)

  테스트 실패 시 `tests/Feature/Http/Controllers/Api/CategoryControllerTest.php`에서 응답 검증 부분을 새 구조에 맞게 업데이트.

- [ ] **Step 3: Pint 실행**

Run: `docker exec cl_embed_laravel vendor/bin/pint --format agent`

- [ ] **Step 4: Commit**

```bash
git add laravel/app/Http/Controllers/Api/CategoryController.php
git commit -m "feat: updateText 응답에 translations + listRow 추가"
```

---

### Task 2: 백엔드 — `runStep` 응답에 translations 추가

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php:261-328`

- [ ] **Step 1: `runStep` 응답 변경**

번역 및 임베딩 실행 완료 후 `$category->fresh()`로 최신 상태 반영 후 `CategoryTranslationsResource`를 함께 반환.

변경 코드 (`laravel/app/Http/Controllers/Api/CategoryController.php`):
```php
public function runStep(RunStepRequest $request, Category $category): JsonResponse
{
    $step = $request->input('step');
    $categoryNameKo = $category->category_name_ko;
    $embedModelName = config('services.ollama.embedding_model');
    $translator = app(OllamaTranslator::class);
    $embedder = app(EmbeddingGenerator::class);

    try {
        [$type, $lang] = explode('.', $step);

        if ($type === 'translation') {
            $column = $lang === 'zh' ? 'category_name_zh' : 'category_name_en';
            $translated = $translator->translate($categoryNameKo, $lang);
            $category->{$column} = $translated;
            $category->save();

            $category->fresh();
            $translations = (new CategoryTranslationsResource($category))->resolve();

            return response()->json([
                'step' => $step,
                'status' => 'completed',
                'result' => $translated,
                'translations' => $translations,
            ]);
        }

        // embedding
        $textForEmbedding = match ($lang) {
            'ko' => $category->category_name_ko,
            'zh' => $category->category_name_zh,
            'en' => $category->category_name_en,
        };

        if ($textForEmbedding === null) {
            return response()->json([
                'step' => $step,
                'status' => 'failed',
                'error' => "{$lang} 번역 텍스트가 없습니다. 먼저 번역을 실행해주세요.",
            ], 422);
        }

        $vector = $embedder->generate($textForEmbedding);

        CategoryEmbedding::updateOrCreate(
            [
                'category_id' => $category->id,
                'language' => $lang,
                'embed_model_name' => $embedModelName,
            ],
            ['embedding' => $vector]
        );

        $category->fresh();
        $translations = (new CategoryTranslationsResource($category))->resolve();

        return response()->json([
            'step' => $step,
            'status' => 'completed',
            'result' => json_encode(array_slice($vector, 0, 10)),
            'translations' => $translations,
        ]);
    } catch (\Throwable $e) {
        // 기존 에러 핸들링 유지, 변경 없음
        // ...
    }
}
```

> `$category->fresh()`는 embedding 생성 후 `CategoryEmbedding` 관계를 다시 로드하지 않는다. `fresh()`는 모델의 속성만 리로드한다. 따라서 `CategoryTranslationsResource::findEmbedding()`이 다시 DB 조회를 수행하므로 `fresh()`만으로 충분하다 (embedding 관계는 `relationLoaded` 체크 후 새로 조회).

- [ ] **Step 2: 테스트 실행**

Run: `docker exec cl_embed_laravel php artisan test --compact --filter=runStep`
Expected: 기존 테스트 통과

- [ ] **Step 3: Pint 실행**

Run: `docker exec cl_embed_laravel vendor/bin/pint --format agent`

- [ ] **Step 4: Commit**

```bash
git add laravel/app/Http/Controllers/Api/CategoryController.php
git commit -m "feat: runStep 응답에 translations 추가"
```

---

### Task 3: 프론트엔드 — `api.ts` 타입 변경

**Files:**
- Modify: `nextjs/lib/api.ts:37-75, 192-227`

- [ ] **Step 1: `updateCategoryText` 반환 타입 변경**

변경 코드 (`nextjs/lib/api.ts`):
```typescript
export interface UpdateTextResponse {
  data: {
    updated: boolean;
    id: number;
    translations: CategoryTranslations;
    listRow: {
      id: number;
      category_code: string;
      category_name_ko: string;
      category_name_zh: string | null;
      category_name_en: string | null;
      translation_status: string;
    };
  };
}

export function updateCategoryText(
  categoryId: number,
  field: "category_name_ko" | "category_name_en" | "category_name_zh",
  value: string | null,
  token?: string | null
): Promise<UpdateTextResponse> {
  return request<UpdateTextResponse>(`/categories/${categoryId}/update-text`, {
    method: "PUT",
    body: { field, value },
    token,
  });
}
```

**`RunStepResponse`에 `translations` 필드 추가:**
```typescript
export interface RunStepResponse {
  step: string;
  status: "completed" | "failed";
  result: string | null;
  error?: string;
  translations?: CategoryTranslations; // 추가
}
```

- [ ] **Step 2: TypeScript 타입 체크**

Run: `docker exec cl_embed_nextjs npx tsc --noEmit`
Expected: 타입 에러 없음

- [ ] **Step 3: Commit**

```bash
git add nextjs/lib/api.ts
git commit -m "feat: updateText/RunStepResponse 타입에 translations 필드 추가"
```

---

### Task 4: 프론트엔드 — `useCategoryDetail`에 `setData` 노출

**Files:**
- Modify: `nextjs/hooks/useCategoryDetail.ts:8,35`

- [ ] **Step 1: `setData` 반환 추가**

변경 코드 (`nextjs/hooks/useCategoryDetail.ts`):
```typescript
export function useCategoryDetail(categoryId: number | null, token?: string | null) {
  const [data, setData] = useState<CategoryTranslations | null>(null);
  // ... (기존 코드 유지)
  return { data, isLoading, error, reload: load, setData };
}
```

- [ ] **Step 2: 타입 체크**

Run: `docker exec cl_embed_nextjs npx tsc --noEmit`
Expected: 타입 에러 없음

- [ ] **Step 3: Commit**

```bash
git add nextjs/hooks/useCategoryDetail.ts
git commit -m "feat: useCategoryDetail에 setData 노출"
```

---

### Task 5: 프론트엔드 — `useCategoryExecution`에 `onUpdateData` 콜백 추가

**Files:**
- Modify: `nextjs/hooks/useCategoryExecution.ts:21-26, 66-137, 139-289`

- [ ] **Step 1: `handleSingleAction`에 `onUpdateData` 파라미터 추가**

```typescript
export interface UseCategoryExecutionReturn {
  // ...기존...
  handleSingleAction: (
    catId: number,
    stepName: StepName,
    onListRefresh?: () => void,
    onUpdateData?: (data: CategoryTranslations) => void,  // 추가
  ) => Promise<void>;
  handleRunAll: (
    catId: number,
    data: CategoryTranslations,
    onListRefresh?: () => void,
    onUpdateData?: (data: CategoryTranslations) => void,  // 추가
  ) => Promise<void>;
  // ...기존...
}
```

- [ ] **Step 2: `handleSingleAction` — 응답 translations로 모달 데이터 갱신 + embedding 추가 fetch 제거**

변경 코드 (`nextjs/hooks/useCategoryExecution.ts`):
```typescript
const handleSingleAction = useCallback(
  async (catId: number, stepName: StepName, onListRefresh?: () => void, onUpdateData?: (data: CategoryTranslations) => void) => {
    const state = getState(catId);
    state.runningSteps = new Set(state.runningSteps).add(stepName);
    state.completedSteps.delete(stepName);
    state.failedSteps.delete(stepName);
    state.actionError = null;
    forceUpdate();

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://embed.cunlim.dev/api";
      const res = await fetch(`${apiUrl}/categories/${catId}/run-step`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ step: stepName }),
      });
      const result = await res.json();

      if (result.status === "completed") {
        state.completedSteps = new Set(state.completedSteps).add(stepName);
        state.stepResults = new Map(state.stepResults).set(stepName, result.result);
        state.copyableSteps = new Set(state.copyableSteps);

        delayMs(2000).then(() => {
          state.copyableSteps.add(stepName);
          forceUpdate();
        });

        // 응답 translations로 모달 데이터 직접 갱신
        if (result.translations && onUpdateData) {
          onUpdateData(result.translations);
        }

        onListRefresh?.();
      } else {
        throw new Error(result.error || "실행 실패");
      }
    } catch (err) {
      state.failedSteps = new Set(state.failedSteps).add(stepName);
      state.actionError = err instanceof Error ? err.message : "실행 실패";
    } finally {
      const next = new Set(state.runningSteps);
      next.delete(stepName);
      state.runningSteps = next;
      forceUpdate();
    }
  },
  [token, getState],
);
```

> **변경점:** embedding 실행 후 `fetchCategoryTranslations` 재호출 제거, `onUpdateData` 콜백으로 `result.translations` 전달

- [ ] **Step 3: `handleRunAll`에도 동일하게 `onUpdateData` 파라미터 추가 및 적용**

`handleRunAll`의 시그니처 변경:
```typescript
handleRunAll: (
  catId: number,
  data: CategoryTranslations,
  onListRefresh?: () => void,
  onUpdateData?: (data: CategoryTranslations) => void,
) => Promise<void>;
```

`handleRunAll` 내부에서 번역/임베딩 완료 후 (기존 `fetchCategoryTranslations` 호출 부분을 포함하여) 동일하게 `onUpdateData?.(result.translations)` 호출 추가. `embedding` 완료 후의 추가 `fetchCategoryTranslations` 호출 블록도 제거.

```typescript
// handleRunAll 내부, step 완료 후 (기존 lines 221-248):
if (result.status === "completed") {
  state.completedSteps = new Set(state.completedSteps).add(stepName);
  state.stepResults = new Map(state.stepResults).set(stepName, result.result);
  state.copyableSteps = new Set(state.copyableSteps);

  delayMs(2000).then(() => {
    state.copyableSteps.add(stepName);
    forceUpdate();
  });

  // 응답 translations로 모달 데이터 직접 갱신
  if (result.translations && onUpdateData) {
    onUpdateData(result.translations);
  }

  onListRefresh?.();
}
// ...이하 동일
```

> **변경점:** `handleRunAll`의 `if (stepName.startsWith("embedding")) { const { fetchCategoryTranslations } = await import(...)... }` 블록 제거 (lines 234-248)

- [ ] **Step 4: 타입 체크**

Run: `docker exec cl_embed_nextjs npx tsc --noEmit`
Expected: 타입 에러 없음

- [ ] **Step 5: Commit**

```bash
git add nextjs/hooks/useCategoryExecution.ts
git commit -m "feat: useCategoryExecution에 onUpdateData 콜백 추가, embedding 후 추가 fetch 제거"
```

---

### Task 6: 프론트엔드 — `category-modal.tsx` 수정 (Issue 1 + Issue 2 + props)

**Files:**
- Modify: `nextjs/components/admin/category-modal.tsx:16-198`

- [ ] **Step 1: Props에 `onUpdateData` / `onUpdateListRow` 추가**

```typescript
interface Props {
  // ...기존 props...
  onReload?: () => void;
  onListRefresh?: () => void;
  onUpdateData?: (data: CategoryTranslations) => void;      // 추가
  onUpdateListRow?: (row: { id: number; translation_status: string }) => void;  // 추가
  // ...
}
```

컴포넌트 선언부도 업데이트:
```typescript
export default function CategoryModal({
  open, onOpenChange, data, isLoading, error, token, onReload, onListRefresh,
  onUpdateData, onUpdateListRow,  // 추가
  execState, onSingleAction, onRunAll, onCancelPending,
}: Props) {
```

- [ ] **Step 2: renderRow — 번역 row는 항상 `<input>` (Issue 1)**

변경 전 (`langKey && hasValue` 조건):
```tsx
{langKey && hasValue ? (
  <input ... />
) : (
  <span className="text-sm truncate font-mono">
    {hasValue ? displayValue : "처리전"}
  </span>
)}
```

변경 후 (`langKey` 조건으로 항상 input):
```tsx
{langKey ? (
  <input
    type="text"
    className="text-sm truncate font-mono w-full bg-transparent border-b border-border px-1 py-0.5 focus:outline-none focus:border-accent read-only:opacity-60 read-only:cursor-default"
    value={editValues[langKey] ?? displayValue ?? ""}
    onChange={(e) => setEditValues((prev) => ({ ...prev, [langKey]: e.target.value }))}
    onBlur={() => handleBlur(langKey)}
    readOnly={runningSteps.size > 0 || pendingSteps.length > 0}
  />
) : (
  <span className="text-sm truncate font-mono">
    {hasValue ? (
      displayValue
    ) : stepName && stepResults.has(stepName) ? (
      isEmbedding ? (() => {
        try {
          const arr = JSON.parse(stepResults.get(stepName)!) as number[];
          const dims = data?.embedding_dimensions ?? 1024;
          return `[${arr.slice(0, 10).map((v) => v.toFixed(3)).join(", ")}…${dims}차원]`;
        } catch { return stepResults.get(stepName); }
      })() : stepResults.get(stepName)
    ) : isFailed ? (
      <span className="text-destructive italic">실패</span>
    ) : (
      <span className="text-muted-foreground italic">처리전</span>
    )}
  </span>
)}
```

> `langKey`는 ko(원본), en(번역), zh(번역)에서만 전달됨. 임베딩 row는 `langKey`가 `undefined`이므로 기존 `<span>` 로직 유지.

- [ ] **Step 3: `handleBlur` 수정 (Issue 2)**

변경 전:
```typescript
const handleBlur = async (langKey: "ko" | "en" | "zh") => {
  if (!data) return;
  const fieldMap = { ko: "category_name_ko", en: "category_name_en", zh: "category_name_zh" };
  const originalValue = data.languages[langKey].translation_text ?? "";
  const newValue = editValues[langKey] ?? originalValue;
  if (newValue === originalValue) return;

  try {
    await updateCategoryText(data.id, fieldMap[langKey], newValue || null, token);
    setEditValues({});
    onReload?.();
    onListRefresh?.();
    toast("저장되었습니다");
  } catch {
    toast("저장에 실패했습니다");
  }
};
```

변경 후:
```typescript
const handleBlur = async (langKey: "ko" | "en" | "zh") => {
  if (!data) return;
  const fieldMap = { ko: "category_name_ko", en: "category_name_en", zh: "category_name_zh" };
  const originalValue = data.languages[langKey].translation_text ?? "";
  const newValue = editValues[langKey] ?? originalValue;
  if (newValue === originalValue) return;

  try {
    const res = await updateCategoryText(data.id, fieldMap[langKey], newValue || null, token);
    // 응답 데이터로 직접 갱신 (re-fetch 없음)
    onUpdateData?.(res.data.translations);
    onUpdateListRow?.(res.data.listRow);
    toast("저장되었습니다");
  } catch {
    toast("저장에 실패했습니다");
  }
};
```

- [ ] **Step 4: `onSingleAction`, `onRunAll` 호출부에 `onUpdateData` 전달**

admin/page.tsx에서 `onSingleAction`과 `onRunAll`이 `onUpdateData`를 받도록 변경할 것이지만, 먼저 CategoryModal에서 이들을 호출하는 방식을 확인하고 변경이 필요한지 확인.

`category-modal.tsx` 내에서 `onSingleAction`과 `onRunAll`을 호출하는 부분:
- `renderRow`의 Play 버튼: `onClick={() => onSingleAction(stepName)}` — `onUpdateData`는 이미 props로 전달되므로, admin/page.tsx에서 `onSingleAction` 호출부에 전달

모달 내에서는 `onSingleAction(stepName)`만 호출하므로, 자체적으로 `onUpdateData`를 전달하지 않음. `onUpdateData`는 `admin/page.tsx`에서 `onSingleAction`/`onRunAll` 호출 시 추가 파라미터로 전달.

- [ ] **Step 5: 타입 체크**

Run: `docker exec cl_embed_nextjs npx tsc --noEmit`
Expected: 타입 에러 없음

- [ ] **Step 6: Commit**

```bash
git add nextjs/components/admin/category-modal.tsx
git commit -m "fix: 모달 input 조건 변경 (항상 input), blur 저장 시 응답 데이터 갱신"
```

---

### Task 7: 프론트엔드 — `admin/page.tsx` props 전달

**Files:**
- Modify: `nextjs/app/admin/page.tsx:96-361`

- [ ] **Step 1: `setData`와 `updateListRow` 바인딩**

변경 코드 (`nextjs/app/admin/page.tsx`):
```typescript
// useCategoryDetail에서 setData 사용
const { data: detailData, isLoading: detailLoading, error: detailError, reload, setData } =
  useCategoryDetail(modalCategoryId, token);

// 리스트 row 업데이트 함수
const updateListRow = useCallback(
  (row: { id: number; translation_status: string }) => {
    setCategories(prev => prev.map(cat =>
      cat.id === row.id ? { ...cat, translation_status: row.translation_status } : cat
    ));
  },
  [],
);

// 모달에 onUpdateData/onUpdateListRow 전달
// onSingleAction/onRunAll에도 onUpdateData 추가 파라미터 전달
<CategoryModal
  open={modalCategoryId !== null}
  onOpenChange={(open) => {
    if (!open) setModalCategoryId(null);
  }}
  data={detailData}
  isLoading={detailLoading}
  error={detailError}
  token={token}
  onReload={reload}
  onListRefresh={() => loadCategories(page)}
  onUpdateData={setData}
  onUpdateListRow={updateListRow}
  execState={modalCategoryId ? getState(modalCategoryId) : null}
  onSingleAction={async (stepName) => {
    if (modalCategoryId !== null) {
      await handleSingleAction(modalCategoryId, stepName, () => loadCategories(page), setData);
    }
  }}
  onRunAll={async () => {
    if (modalCategoryId !== null && detailData) {
      await handleRunAll(modalCategoryId, detailData, () => loadCategories(page), setData);
    }
  }}
  onCancelPending={() => {
    if (modalCategoryId !== null) {
      handleCancelPending(modalCategoryId);
    }
  }}
/>
```

> `onUpdateData` prop은 `setData`를 직접 전달. `onSingleAction`과 `onRunAll`의 새 `onUpdateData` 콜백에도 `setData` 전달.

- [ ] **Step 2: 타입 체크**

Run: `docker exec cl_embed_nextjs npx tsc --noEmit`
Expected: 타입 에러 없음

- [ ] **Step 3: Commit**

```bash
git add nextjs/app/admin/page.tsx
git commit -m "feat: admin page에 setData/updateListRow 전달, onSingleAction/onRunAll에 onUpdateData 추가"
```

---

### Task 8: 통합 테스트

- [ ] **Step 1: 백엔드 테스트 실행**

Run: `docker exec cl_embed_laravel php artisan test --compact`
Expected: 모든 테스트 통과

- [ ] **Step 2: 프론트엔드 타입 체크**

Run: `docker exec cl_embed_nextjs npx tsc --noEmit`
Expected: 타입 에러 없음

- [ ] **Step 3: 프론트엔드 테스트 실행**

Run: `docker exec cl_embed_nextjs npm test`
Expected: 모든 테스트 통과

- [ ] **Step 4: 브라우저로 수동 확인 (권장)**

Playwright으로 다음 시나리오 확인:
1. `처리전` 상태인 번역 필드에 빈 `<input>`이 표시되는지 확인
2. 기존 번역 텍스트 수정 후 blur → 저장 완료 toast 확인, 모달 깜빡임 없음
3. blur 저장 후 리스트 status가 올바르게 변경되는지 확인
4. 번역 실행 → 결과가 input에 표시되고 embedding이 "처리전"으로 변경되는지 확인
5. 수동 새로고침 버튼(모달 닫았다 다시 열기)으로 기존 `onReload` 동작 유지 확인
