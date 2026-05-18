# Admin 카테고리 코드 입력 필드 추가 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin 페이지 카테고리 추가 폼에 선택적 카테고리 코드 입력 필드 추가

**Architecture:** Laravel FormRequest로 `category_code` optional+unique 검증, controller에서 값 유무에 따라 사용자 입력/자동생성 분기. 프론트엔드는 code input을 name input 위에 배치.

**Tech Stack:** Laravel 13 (PHP 8.5), Next.js 16 (React 19), Pest 4, Vitest

**Spec:** `docs/superpowers/specs/2026-05-18-admin-category-code-input-design.md`

---

### Task 1: Laravel FormRequest에 category_code 검증 추가

**Files:**
- Modify: `laravel/app/Http/Requests/CategoryStoreRequest.php`
- Test: `laravel/tests/Feature/CategoryApiTest.php`

- [ ] **Step 1: category_code 검증 규칙 추가**

`CategoryStoreRequest`의 `rules()`에 `category_code` 필드를 nullable string으로 추가:

```php
public function rules(): array
{
    return [
        'category_name_ko' => ['required', 'string', 'max:255'],
        'category_code' => ['nullable', 'string', 'max:255', 'unique:categories,category_code'],
    ];
}
```

- [ ] **Step 2: 카테고리 코드 중복 시 422 반환 테스트 작성**

`CategoryApiTest.php`에 테스트 추가:

```php
test('POST /api/categories — 중복된 category_code는 422를 반환한다', function () {
    $user = User::factory()->create();
    $existing = Category::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories', [
        'category_name_ko' => '새카테고리',
        'category_code' => $existing->category_code,
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['category_code']);
});

test('POST /api/categories — category_code를 명시하면 해당 코드로 생성된다', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories', [
        'category_name_ko' => '새카테고리',
        'category_code' => 'MY_CUSTOM_01',
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.category_code', 'MY_CUSTOM_01');
});

test('POST /api/categories — category_code 미입력 시 자동 생성된다', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories', [
        'category_name_ko' => '새카테고리',
    ]);

    $response->assertCreated();
    $code = $response->json('data.category_code');
    expect($code)->toMatch('/^CAT_[a-z0-9]{8}$/');
});
```

- [ ] **Step 3: 테스트 실행**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryApiTest
```
Expected: 6 passed (기존 3 + 신규 3)

- [ ] **Step 4: Commit**

```bash
git add laravel/app/Http/Requests/CategoryStoreRequest.php laravel/tests/Feature/CategoryApiTest.php
git commit -m "feat: category_code optional+unique 검증 추가 및 테스트"
```

---

### Task 2: Laravel Controller에서 category_code 처리 분기

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php`

- [ ] **Step 1: store() 메서드 수정**

`$request->filled('category_code')`면 해당 값 사용, 아니면 `generateCode()`:

```php
public function store(CategoryStoreRequest $request): CategoryResource
{
    $category = Category::create([
        'category_code' => $request->filled('category_code')
            ? $request->category_code
            : Category::generateCode(),
        'category_name_ko' => $request->category_name_ko,
    ]);

    return new CategoryResource($category);
}
```

- [ ] **Step 2: 기존 테스트 재실행**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryApiTest
```
Expected: 6 passed

- [ ] **Step 3: Commit**

```bash
git add laravel/app/Http/Controllers/Api/CategoryController.php
git commit -m "feat: store()에서 category_code 유무에 따라 입력/자동생성 분기"
```

---

### Task 3: Frontend API 함수에 categoryCode 파라미터 추가

**Files:**
- Modify: `nextjs/lib/api.ts`

- [ ] **Step 1: createCategory에 categoryCode 파라미터 추가**

```typescript
export function createCategory(
  categoryNameKo: string,
  token?: string | null,
  categoryCode?: string
): Promise<{ data: Category }> {
  const body: Record<string, string> = { category_name_ko: categoryNameKo };
  if (categoryCode) {
    body.category_code = categoryCode;
  }
  return request<{ data: Category }>("/categories", {
    method: "POST",
    body,
    token,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add nextjs/lib/api.ts
git commit -m "feat: createCategory에 optional categoryCode 파라미터 추가"
```

---

### Task 4: Frontend useCategories 훅에 categoryCode 전달

**Files:**
- Modify: `nextjs/hooks/useCategories.ts`

- [ ] **Step 1: addCategory에 categoryCode 파라미터 추가**

`addCategory` 시그니처 변경 및 `createCategory` 호출 시 전달:

```typescript
const addCategory = useCallback(
  async (categoryNameKo: string, categoryCode?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await createCategory(categoryNameKo, token, categoryCode);
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
```

- [ ] **Step 2: 기존 useCategories 테스트 assertion 업데이트**

`hooks/__tests__/useCategories.test.ts`에서 3번째 인자 `undefined`를 assertion에 추가:

```typescript
expect(mockCreateCategory).toHaveBeenCalledWith("의류>여성의류>원피스", "token", undefined);
```

`addCategory("의류>여성의류>원피스")` 호출 시 내부적으로 `createCategory("의류>여성의류>원피스", "token", undefined)`가 호출되므로, 기존 2-인자 assertion은 실패한다.

- [ ] **Step 3: 기존 테스트 통과 확인**

```bash
docker exec cl_embed_nextjs npm test -- --run hooks/__tests__/useCategories.test.ts
```
Expected: all tests pass (기존 테스트는 시그니처 호환 — 2번째 인자 categoryCode는 optional)

- [ ] **Step 3: Commit**

```bash
git add nextjs/hooks/useCategories.ts
git commit -m "feat: addCategory에 categoryCode 파라미터 전달"
```

---

### Task 5: Admin 페이지에 카테고리 코드 input 추가

**Files:**
- Modify: `nextjs/app/admin/page.tsx`
- Modify: `nextjs/app/admin/__tests__/page.test.tsx`

- [ ] **Step 1: 코드 input 추가, addCategory 호출 시 코드 전달**

`admin/page.tsx`에서:
1. `newCategoryCode` state 추가
2. "카테고리 코드는 자동 생성됩니다" 텍스트 제거
3. name input 위에 code input 렌더링 (placeholder: "입력하지 않을 시 자동 생성")
4. `handleAddCategory`에서 `addCategory(newCategoryName.trim(), newCategoryCode.trim() || undefined)` 호출
5. 추가 후 `setNewCategoryCode("")` 리셋

변경 내용:

```tsx
const [newCategoryName, setNewCategoryName] = useState("");
const [newCategoryCode, setNewCategoryCode] = useState("");

const handleAddCategory = useCallback(async () => {
  if (!newCategoryName.trim()) return;
  await addCategory(newCategoryName.trim(), newCategoryCode.trim() || undefined);
  setNewCategoryName("");
  setNewCategoryCode("");
}, [newCategoryName, newCategoryCode, addCategory]);
```

JSX code input (name input 위에 배치):

```tsx
<div className="space-y-2">
  <Label htmlFor="category-code">카테고리 코드</Label>
  <Input
    id="category-code"
    placeholder="입력하지 않을 시 자동 생성"
    value={newCategoryCode}
    onChange={(e) => setNewCategoryCode(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter") handleAddCategory();
    }}
  />
</div>
```

- [ ] **Step 2: 테스트에 category_code input 확인 추가**

`admin/__tests__/page.test.tsx`에 테스트 추가:

```tsx
it("카테고리 코드 input이 렌더링된다", () => {
  render(<AdminPage />);
  expect(screen.getByPlaceholderText("입력하지 않을 시 자동 생성")).toBeInTheDocument();
});
```

- [ ] **Step 3: 테스트 실행**

```bash
docker exec cl_embed_nextjs npm test -- --run app/admin/__tests__/page.test.tsx
```
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add nextjs/app/admin/page.tsx nextjs/app/admin/__tests__/page.test.tsx
git commit -m "feat: admin 페이지에 category_code 입력 필드 추가"
```

---

### Task 6: Laravel Pint 포맷팅 및 전체 테스트

**Files:** (no changes — run commands)

- [ ] **Step 1: Laravel Pint 실행**

```bash
docker exec cl_embed_laravel vendor/bin/pint --format agent
```

- [ ] **Step 2: Laravel 전체 테스트**

```bash
docker exec cl_embed_laravel php artisan test --compact
```
Expected: 0 failures

- [ ] **Step 3: Next.js 전체 테스트 + lint**

```bash
docker exec cl_embed_nextjs npm test -- --run
docker exec cl_embed_nextjs npm run lint
```
Expected: 0 failures

- [ ] **Step 4: 최종 커밋 (Pint 수정사항만)**

```bash
git add -A
git commit -m "style: pint 포맷팅 적용"
```
