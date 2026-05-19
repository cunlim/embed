# Admin 모달 텍스트 편집 기능 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin 카테고리 상세 모달의 텍스트를 `<input>`으로 변경하고, blur 시 DB 저장 + 임베딩 초기화

**Architecture:** PUT API 엔드포인트 추가 → 프론트엔드에서 text→input 전환 + blur 핸들러 연결. 번역 재실행은 기존 runStep API 활용.

**Tech Stack:** Laravel 13 (PHP 8.5), Next.js 16 (React 19), TypeScript, Pest 4, Vitest

---

## 파일 구조

### 생성
- `laravel/app/Http/Requests/CategoryUpdateTextRequest.php` — FormRequest (field + value 검증)
- `laravel/tests/Feature/CategoryUpdateTextTest.php` — Pest Feature 테스트

### 수정
- `laravel/app/Http/Controllers/Api/CategoryController.php:18` — `updateText` 메서드 추가
- `laravel/routes/api.php:23` — PUT 라우트 추가
- `nextjs/lib/api.ts:209` — `updateCategoryText` 함수 추가
- `nextjs/components/admin/category-modal.tsx` — renderRow input 전환 + blur 핸들러
- `nextjs/components/admin/__tests__/category-modal.test.tsx` — input/blur 테스트 추가

---

### Task 1: 백엔드 — FormRequest 생성

**Files:**
- Create: `laravel/app/Http/Requests/CategoryUpdateTextRequest.php`
- Test: `laravel/tests/Feature/CategoryUpdateTextTest.php` (TDD: test first)

- [ ] **Step 1: Write the failing test for FormRequest validation**

```php
<?php

use App\Http\Requests\CategoryUpdateTextRequest;
use Illuminate\Support\Facades\Validator;

it('유효한 field와 value를 허용한다', function () {
    $validator = Validator::make(
        ['field' => 'category_name_en', 'value' => 'New Name'],
        (new CategoryUpdateTextRequest())->rules()
    );
    expect($validator->passes())->toBeTrue();
});

it('유효하지 않은 field를 거부한다', function () {
    $validator = Validator::make(
        ['field' => 'invalid_field', 'value' => 'test'],
        (new CategoryUpdateTextRequest())->rules()
    );
    expect($validator->fails())->toBeTrue();
});

it('null value를 허용한다', function () {
    $validator = Validator::make(
        ['field' => 'category_name_en', 'value' => null],
        (new CategoryUpdateTextRequest())->rules()
    );
    expect($validator->passes())->toBeTrue();
});

it('255자를 초과하는 value를 거부한다', function () {
    $validator = Validator::make(
        ['field' => 'category_name_ko', 'value' => str_repeat('가', 256)],
        (new CategoryUpdateTextRequest())->rules()
    );
    expect($validator->fails())->toBeTrue();
});
```

Run: `docker exec cl_embed_laravel php artisan test --compact --filter=CategoryUpdateText`
Expected: Test file not found or no tests matched (아직 파일 없음)

- [ ] **Step 2: Create the FormRequest**

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CategoryUpdateTextRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'field' => ['required', 'string', 'in:category_name_ko,category_name_en,category_name_zh'],
            'value' => ['nullable', 'string', 'max:255'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'field.in' => '유효하지 않은 필드입니다. (category_name_ko, category_name_en, category_name_zh 중 하나)',
            'value.max' => '값은 255자를 초과할 수 없습니다.',
        ];
    }
}
```

- [ ] **Step 3: Run tests to verify FormRequest passes**

Run: `docker exec cl_embed_laravel php artisan test --compact --filter=CategoryUpdateText`
Expected: 4 passed

- [ ] **Step 4: Commit**

```bash
git add laravel/app/Http/Requests/CategoryUpdateTextRequest.php laravel/tests/Feature/CategoryUpdateTextTest.php
git commit -m "feat: CategoryUpdateTextRequest FormRequest 추가 (field+value 검증)"
```

---

### Task 2: 백엔드 — Controller + Route

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php` (after line 327)
- Modify: `laravel/routes/api.php` (after line 23)
- Test: `laravel/tests/Feature/CategoryUpdateTextTest.php` (append)

- [ ] **Step 1: Write the failing Feature test**

```php
<?php

use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Models\User;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->token = $this->user->createToken('test')->plainTextToken;
});

it('인증 없이 요청하면 401을 반환한다', function () {
    $category = Category::factory()->create();
    $response = $this->putJson("/api/categories/{$category->id}/update-text", [
        'field' => 'category_name_en',
        'value' => 'New Name',
    ]);
    $response->assertStatus(401);
});

it('카테고리 텍스트를 업데이트하고 임베딩을 삭제한다', function () {
    $category = Category::factory()->create([
        'category_name_ko' => '원본',
        'category_name_en' => 'Old Name',
    ]);
    // embedding 생성 (삭제 확인용)
    CategoryEmbedding::factory()->create([
        'category_id' => $category->id,
        'language' => 'en',
    ]);
    CategoryEmbedding::factory()->create([
        'category_id' => $category->id,
        'language' => 'ko', // ko embedding은 삭제되면 안 됨
    ]);

    $response = $this->withToken($this->token)
        ->putJson("/api/categories/{$category->id}/update-text", [
            'field' => 'category_name_en',
            'value' => 'New English Name',
        ]);

    $response->assertOk();
    $response->assertJson(['data' => ['updated' => true, 'id' => $category->id]]);

    // DB 확인
    $this->assertDatabaseHas('categories', [
        'id' => $category->id,
        'category_name_en' => 'New English Name',
    ]);
    // en 임베딩은 삭제됨
    $this->assertDatabaseMissing('category_embeddings', [
        'category_id' => $category->id,
        'language' => 'en',
    ]);
    // ko 임베딩은 유지
    $this->assertDatabaseHas('category_embeddings', [
        'category_id' => $category->id,
        'language' => 'ko',
    ]);
});

it('value를 null로 업데이트할 수 있다', function () {
    $category = Category::factory()->create([
        'category_name_en' => 'Old Name',
    ]);

    $response = $this->withToken($this->token)
        ->putJson("/api/categories/{$category->id}/update-text", [
            'field' => 'category_name_en',
            'value' => null,
        ]);

    $response->assertOk();
    $this->assertDatabaseHas('categories', [
        'id' => $category->id,
        'category_name_en' => null,
    ]);
});

it('존재하지 않는 카테고리에 404를 반환한다', function () {
    $response = $this->withToken($this->token)
        ->putJson('/api/categories/99999/update-text', [
            'field' => 'category_name_ko',
            'value' => 'New',
        ]);
    $response->assertStatus(404);
});
```

Run: `docker exec cl_embed_laravel php artisan test --compact --filter=CategoryUpdateText`
Expected: Some tests fail (controller method not found)

- [ ] **Step 2: Add `updateText` method to CategoryController**

Add after `runStep` method (after line 327), before closing brace:

```php
#[OA\Put(
    path: '/api/categories/{category}/update-text',
    summary: '카테고리 텍스트 업데이트',
    description: '카테고리의 특정 언어 텍스트를 업데이트하고 해당 언어의 임베딩을 삭제합니다.',
    tags: ['Categories'],
    security: [['sanctum' => []]],
    parameters: [
        new OA\Parameter(
            name: 'category',
            in: 'path',
            required: true,
            schema: new OA\Schema(type: 'integer')
        ),
    ],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['field', 'value'],
            properties: [
                new OA\Property(property: 'field', type: 'string', enum: ['category_name_ko', 'category_name_en', 'category_name_zh']),
                new OA\Property(property: 'value', type: 'string', nullable: true, maxLength: 255),
            ]
        )
    ),
    responses: [
        new OA\Response(
            response: 200,
            description: '업데이트 성공',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'data', properties: [
                        new OA\Property(property: 'updated', type: 'boolean', example: true),
                        new OA\Property(property: 'id', type: 'integer', example: 1),
                    ], type: 'object'),
                ]
            )
        ),
        new OA\Response(response: 401, description: '인증 필요'),
        new OA\Response(response: 404, description: '카테고리를 찾을 수 없음'),
        new OA\Response(response: 422, description: '입력값 검증 실패'),
    ]
)]
public function updateText(CategoryUpdateTextRequest $request, Category $category): JsonResponse
{
    $field = $request->input('field');
    $value = $request->input('value');

    $category->update([$field => $value]);

    // 해당 언어의 임베딩 삭제
    $lang = match ($field) {
        'category_name_ko' => 'ko',
        'category_name_en' => 'en',
        'category_name_zh' => 'zh',
    };
    CategoryEmbedding::where('category_id', $category->id)
        ->where('language', $lang)
        ->delete();

    return response()->json([
        'data' => [
            'updated' => true,
            'id' => $category->id,
        ],
    ]);
}
```

Add import at the top of controller:
```php
use App\Http\Requests\CategoryUpdateTextRequest;
```

- [ ] **Step 3: Add route to `routes/api.php`**

After line 23 (`Route::post('categories/{category}/run-step', ...)`):

```php
Route::put('categories/{category}/update-text', [CategoryController::class, 'updateText'])->middleware('auth:sanctum');
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker exec cl_embed_laravel php artisan test --compact --filter=CategoryUpdateText`
Expected: All tests pass

- [ ] **Step 5: Format with Pint**

Run: `docker exec cl_embed_laravel vendor/bin/pint --format agent`

- [ ] **Step 6: Commit**

```bash
git add laravel/app/Http/Controllers/Api/CategoryController.php laravel/routes/api.php laravel/tests/Feature/CategoryUpdateTextTest.php
git commit -m "feat: 카테고리 텍스트 업데이트 API 추가 (PUT /categories/{id}/update-text, 임베딩 자동 삭제)"
```

---

### Task 3: 프론트엔드 — API 함수 추가

**Files:**
- Modify: `nextjs/lib/api.ts` (after line 209)

- [ ] **Step 1: Write the failing test**

```typescript
// nextjs/lib/__tests__/api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequest = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, request: mockRequest };
});

import { updateCategoryText } from "@/lib/api";

describe("updateCategoryText", () => {
  it("올바른 URL과 body로 PUT 요청을 보낸다", async () => {
    mockRequest.mockResolvedValue({ data: { updated: true, id: 1 } });
    const result = await updateCategoryText(1, "category_name_en", "New Name", "token");
    expect(mockRequest).toHaveBeenCalledWith("/categories/1/update-text", {
      method: "PUT",
      body: { field: "category_name_en", value: "New Name" },
      token: "token",
    });
    expect(result.data.updated).toBe(true);
  });

  it("null value를 전달할 수 있다", async () => {
    mockRequest.mockResolvedValue({ data: { updated: true, id: 1 } });
    await updateCategoryText(1, "category_name_ko", null, "token");
    expect(mockRequest).toHaveBeenCalledWith("/categories/1/update-text", {
      method: "PUT",
      body: { field: "category_name_ko", value: null },
      token: "token",
    });
  });
});
```

Run: `docker exec cl_embed_nextjs npm test -- --run`
Expected: Test failure (function not defined)

- [ ] **Step 2: Add `updateCategoryText` function to `lib/api.ts`**

After `runStep` function (after line 209):

```typescript
export function updateCategoryText(
  categoryId: number,
  field: "category_name_ko" | "category_name_en" | "category_name_zh",
  value: string | null,
  token?: string | null
): Promise<{ data: { updated: boolean; id: number } }> {
  return request(`/categories/${categoryId}/update-text`, {
    method: "PUT",
    body: { field, value },
    token,
  });
}
```

- [ ] **Step 3: Run test to verify pass**

Run: `docker exec cl_embed_nextjs npm test -- --run`
Expected: Tests pass

- [ ] **Step 4: Commit**

```bash
git add nextjs/lib/api.ts nextjs/lib/__tests__/api.test.ts
git commit -m "feat: updateCategoryText API 함수 추가"
```

---

### Task 4: 프론트엔드 — 모달 input + blur 저장

**Files:**
- Modify: `nextjs/components/admin/category-modal.tsx`
- Modify: `nextjs/components/admin/__tests__/category-modal.test.tsx`

- [ ] **Step 1: Write failing tests for input behavior**

```typescript
// Add to nextjs/components/admin/__tests__/category-modal.test.tsx
import userEvent from "@testing-library/user-event";

it("텍스트가 input으로 렌더링된다", () => {
  const completedData = {
    ...pendingData,
    languages: {
      ko: { translation_text: "원본", embedding: { status: "completed" as const, preview: [0.1] } },
      en: { translation_text: "English", embedding: { status: "completed" as const, preview: [0.2] } },
      zh: { translation_text: "中文", embedding: { status: "completed" as const, preview: [0.3] } },
    },
  };
  render(<CategoryModal open={true} onOpenChange={vi.fn()} data={completedData} isLoading={false} error={null} token="token" execState={createEmptyExecState()} onSingleAction={defaultHandlers.onSingleAction} onRunAll={defaultHandlers.onRunAll} onCancelPending={defaultHandlers.onCancelPending} />);
  const inputs = screen.getAllByRole("textbox");
  expect(inputs.length).toBe(3); // ko, en, zh
});

it("실행 중 input이 readonly가 된다", () => {
  const completedData = {
    ...pendingData,
    languages: {
      ko: { translation_text: "원본", embedding: { status: "completed" as const, preview: [0.1] } },
      en: { translation_text: "English", embedding: { status: "completed" as const, preview: [0.2] } },
      zh: { translation_text: "中文", embedding: { status: "completed" as const, preview: [0.3] } },
    },
  };
  const execState = {
    ...createEmptyExecState(),
    runningSteps: new Set(["translation.en" as const]),
  };
  render(<CategoryModal open={true} onOpenChange={vi.fn()} data={completedData} isLoading={false} error={null} token="token" execState={execState} onSingleAction={defaultHandlers.onSingleAction} onRunAll={defaultHandlers.onRunAll} onCancelPending={defaultHandlers.onCancelPending} />);
  const inputs = screen.getAllByRole("textbox");
  inputs.forEach(input => {
    expect(input).toHaveAttribute("readonly");
  });
});

it("임베딩 행은 input이 아닌 text로 표시된다", () => {
  const completedData = {
    ...pendingData,
    languages: {
      ko: { translation_text: "원본", embedding: { status: "completed" as const, preview: [0.1, 0.2] } },
      en: { translation_text: "English", embedding: { status: "completed" as const, preview: [0.3] } },
      zh: { translation_text: "中文", embedding: { status: "completed" as const, preview: [0.4] } },
    },
  };
  render(<CategoryModal open={true} onOpenChange={vi.fn()} data={completedData} isLoading={false} error={null} token="token" execState={createEmptyExecState()} onSingleAction={defaultHandlers.onSingleAction} onRunAll={defaultHandlers.onRunAll} onCancelPending={defaultHandlers.onCancelPending} />);
  // textbox는 3개 (ko, en, zh translations) — 임베딩은 textbox가 아님
  const inputs = screen.getAllByRole("textbox");
  expect(inputs.length).toBe(3);
});
```

Run: `docker exec cl_embed_nextjs npm test -- --run`
Expected: Tests fail (no input elements yet)

- [ ] **Step 2: Modify `category-modal.tsx` — add edit state and blur handler**

Add `useState` import (already imported), add state and handler inside `CategoryModal` function:

After `const [flashSteps, setFlashSteps] = useState<Set<StepName>>(new Set());` (line 49):

```typescript
const [editValues, setEditValues] = useState<Record<string, string>>({});
```

Add after the `handleOpenChange` function (after line 161):

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
    await updateCategoryText(data.id, fieldMap[langKey], newValue || null, token);
    onReload?.();
    onListRefresh?.();
    toast("저장되었습니다");
  } catch {
    toast("저장에 실패했습니다");
  }
};
```

Add import at top:
```typescript
import { updateCategoryText } from "@/lib/api";
```

- [ ] **Step 3: Modify `renderRow` to render `<input>` for text rows**

In `renderRow`, change the text display section (lines 84-99). Add `isTextField` prop to distinguish text vs embedding rows:

Update the `renderRow` function signature (line 60):
```typescript
const renderRow = (
  label: string,
  displayValue: string | null,
  copyValue: string | null,
  stepName: StepName | null,
  translationDone?: boolean,
  isExecuting?: boolean,
  isPending?: boolean,
  langKey?: "ko" | "en" | "zh",  // NEW: for text inputs
) => {
```

Within `renderRow`, change the value display section. Replace lines 82-100:

```typescript
return (
  <div className="grid grid-cols-[80px_1fr_40px] gap-3 items-center py-1.5">
    <span className="text-sm text-muted-foreground">{label}</span>
    {langKey && hasValue ? (
      <input
        type="text"
        className="text-sm truncate font-mono w-full bg-transparent border-b border-border px-1 py-0.5 focus:outline-none focus:border-accent read-only:opacity-60 read-only:cursor-default"
        value={editValues[langKey] ?? displayValue ?? ""}
        onChange={(e) => setEditValues((prev) => ({ ...prev, [langKey!]: e.target.value }))}
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
    <div>
      {isRunningThis ? ( ...
```

Note: Keep the action button section (lines 101-150) exactly as is.

- [ ] **Step 4: Update the renderRow calls to pass `langKey`**

For the Korean section (line 236-241):
```tsx
{renderRow(
  "원본",
  detail.translation_text,
  detail.translation_text,
  null,
  undefined,
  isExecuting,
  undefined,
  "ko",
)}
```

For English (line 210-218):
```tsx
{renderRow(
  "번역",
  detail.translation_text,
  detail.translation_text,
  `translation.${lang.key}` as StepName,
  undefined,
  isExecuting,
  pendingSteps.includes(`translation.${lang.key}` as StepName),
  lang.key,
)}
```

For Chinese (same pattern as English, line 210-218).

- [ ] **Step 5: Also update the Korean embedding row `translationDone` prop**

The Korean translation is always done (line 251: `true`), so it stays the same.

- [ ] **Step 6: Run tests to verify they pass**

Run: `docker exec cl_embed_nextjs npm test -- --run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add nextjs/components/admin/category-modal.tsx nextjs/components/admin/__tests__/category-modal.test.tsx
git commit -m "feat: Admin 모달 텍스트 input 전환 + blur 시 저장 + 임베딩 초기화"
```

---

### Task 5: E2E Playwright 테스트 (옵션)

- [ ] **Step 1: Write Playwright test for text editing**

```typescript
// nextjs/e2e/admin-text-edit.spec.ts
import { test, expect } from "@playwright/test";

test("카테고리 텍스트 수정 후 blur 시 저장된다", async ({ page }) => {
  await page.goto("https://embed.cunlim.dev/admin");
  // localStorage에 auth_token 설정 후 reload
  await page.evaluate((token) => {
    localStorage.setItem("auth_token", token);
  }, process.env.E2E_AUTH_TOKEN || "");
  await page.reload();
  await page.waitForLoadState("networkidle");

  // 첫 번째 카테고리 상세 보기 클릭
  await page.getByRole("button", { name: "상세 보기" }).first().click();
  await page.waitForTimeout(500);

  // 첫 번째 input 값 변경
  const firstInput = page.getByRole("textbox").first();
  await firstInput.click();
  await firstInput.fill("수정된 텍스트");
  await firstInput.blur();
  await page.waitForTimeout(500);

  // 모달 닫고 다시 열어서 반영 확인
  await page.getByRole("button", { name: "Close" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "상세 보기" }).first().click();
  await page.waitForTimeout(500);

  const reopenedInput = page.getByRole("textbox").first();
  await expect(reopenedInput).toHaveValue("수정된 텍스트");
});
```
