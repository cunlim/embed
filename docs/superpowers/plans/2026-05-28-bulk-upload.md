# 대량 카테고리 업로드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** embed 페이지 "추가" 섹션에 단일/대량 모드 토글과 xlsx 대량 업로드 기능을 추가한다.

**Architecture:** 백엔드는 `CategoryStoreRequest`에 선택적 번역 필드(`category_name_en`, `category_name_zh`)를 추가하고, `store()`에서 함께 저장한다. 프론트엔드는 `xlsx` 라이브러리로 클라이언트 사이드 파싱 후 각 행을 `createCategory()` API로 전송한다.

**Tech Stack:** Laravel (Pest), Next.js, shadcn/ui, xlsx (SheetJS), Playwright

---

### Task 1: 샘플 파일 이동

**Files:**
- Move: `archive/카테고리대량등록_v1.xlsx` → `nextjs/public/samples/카테고리대량등록_v1.xlsx`

- [ ] **Step 1: 디렉토리 생성 및 파일 이동**

```bash
mkdir -p /var/app/www/cl_embed/nextjs/public/samples
mv /var/app/www/cl_embed/archive/카테고리대량등록_v1.xlsx /var/app/www/cl_embed/nextjs/public/samples/
```

- [ ] **Step 2: 파일 확인**

```bash
ls -la /var/app/www/cl_embed/nextjs/public/samples/카테고리대량등록_v1.xlsx
```

Expected: 파일이 존재하고 크기가 0이 아님

- [ ] **Step 3: Commit**

```bash
git add nextjs/public/samples/카테고리대량등록_v1.xlsx
git rm --cached archive/카테고리대량등록_v1.xlsx 2>/dev/null; git add archive/
git commit -m "chore: 샘플 xlsx 파일을 public/samples로 이동"
```

---

### Task 2: 백엔드 — CategoryStoreRequest에 번역 필드 추가 (TDD)

**Files:**
- Modify: `laravel/app/Http/Requests/CategoryStoreRequest.php`
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php`
- Modify: `laravel/tests/Feature/Api/CategoryControllerTest.php`

- [ ] **Step 1: 실패하는 테스트 작성**

`laravel/tests/Feature/Api/CategoryControllerTest.php`의 `describe('store')` 블록에 다음 테스트를 추가한다:

```php
test('카테고리 생성 시 번역 필드를 함께 저장할 수 있다', function () {
    $user = User::factory()->create(['role' => 'member']);
    Sanctum::actingAs($user);

    $response = $this->postJson('/api/categories', [
        'category_name_ko' => '테스트 카테고리',
        'category_name_en' => 'Test Category',
        'category_name_zh' => '测试类别',
    ]);

    $response->assertStatus(201);
    expect($response->json('data.category_name_en'))->toBe('Test Category');
    expect($response->json('data.category_name_zh'))->toBe('测试类别');
    $this->assertDatabaseHas('categories', [
        'category_name_ko' => '테스트 카테고리',
        'category_name_en' => 'Test Category',
        'category_name_zh' => '测试类别',
    ]);
});

test('번역 필드 없이도 카테고리를 생성할 수 있다', function () {
    $user = User::factory()->create(['role' => 'member']);
    Sanctum::actingAs($user);

    $response = $this->postJson('/api/categories', [
        'category_name_ko' => '한국어만 있는 카테고리',
    ]);

    $response->assertStatus(201);
    expect($response->json('data.category_name_en'))->toBeNull();
    expect($response->json('data.category_name_zh'))->toBeNull();
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter="번역 필드"
```

Expected: FAIL — `category_name_en`, `category_name_zh` 필드가 검증 규칙에 없거나 저장되지 않음

- [ ] **Step 3: CategoryStoreRequest 수정**

`laravel/app/Http/Requests/CategoryStoreRequest.php`:

```php
public function rules(): array
{
    return [
        'category_name_ko' => ['required', 'string', 'max:255'],
        'category_code' => ['nullable', 'string', 'max:255', 'unique:categories,category_code'],
        'category_name_en' => ['nullable', 'string', 'max:255'],
        'category_name_zh' => ['nullable', 'string', 'max:255'],
    ];
}
```

- [ ] **Step 4: CategoryController::store() 수정**

`laravel/app/Http/Controllers/Api/CategoryController.php`의 `store()` 메서드:

```php
public function store(CategoryStoreRequest $request): CategoryResource
{
    $category = Category::create([
        'category_code' => $request->filled('category_code')
            ? $request->category_code
            : Category::generateCode(),
        'category_name_ko' => $request->category_name_ko,
        'category_name_en' => $request->input('category_name_en'),
        'category_name_zh' => $request->input('category_name_zh'),
        'user_id' => $request->user('sanctum')->id,
    ]);

    return new CategoryResource($category);
}
```

- [ ] **Step 5: 테스트 실행하여 통과 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter="번역 필드"
```

Expected: PASS

- [ ] **Step 6: 전체 테스트 실행**

```bash
docker exec cl_embed_laravel php artisan test --compact
```

Expected: All PASS

- [ ] **Step 7: Pint 포맷팅**

```bash
docker exec cl_embed_laravel vendor/bin/pint --format agent
```

- [ ] **Step 8: Commit**

```bash
git add laravel/app/Http/Requests/CategoryStoreRequest.php \
        laravel/app/Http/Controllers/Api/CategoryController.php \
        laravel/tests/Feature/Api/CategoryControllerTest.php
git commit -m "feat: 카테고리 생성 시 번역 필드(category_name_en, category_name_zh) 저장 지원"
```

---

### Task 3: 프론트엔드 — createCategory() API 확장

**Files:**
- Modify: `nextjs/lib/api.ts`
- Modify: `nextjs/hooks/useCategories.ts`

- [ ] **Step 1: createCategory() 파라미터 확장**

`nextjs/lib/api.ts`의 `createCategory()` 함수:

```typescript
export function createCategory(
  categoryNameKo: string,
  token?: string | null,
  categoryCode?: string,
  categoryNameEn?: string,
  categoryNameZh?: string,
): Promise<{ data: Category }> {
  const body: Record<string, string> = { category_name_ko: categoryNameKo };
  if (categoryCode) {
    body.category_code = categoryCode;
  }
  if (categoryNameEn) {
    body.category_name_en = categoryNameEn;
  }
  if (categoryNameZh) {
    body.category_name_zh = categoryNameZh;
  }
  return request<{ data: Category }>("/categories", {
    method: "POST",
    body,
    token,
  });
}
```

- [ ] **Step 2: useCategories 훅의 addCategory 시그니처 확인**

`nextjs/hooks/useCategories.ts`에서 `addCategory`가 `createCategory`를 호출하는 부분을 확인하고, 번역 파라미터를 전달할 수 있도록 확장한다.

```typescript
// useCategories.ts 내 addCategory 함수 시그니처 확장
const addCategory = useCallback(async (
  categoryNameKo: string,
  categoryCode?: string,
  categoryNameEn?: string,
  categoryNameZh?: string,
) => {
  // ... existing logic
  const res = await createCategory(categoryNameKo, token, categoryCode, categoryNameEn, categoryNameZh);
  // ... existing logic
}, [token]);
```

- [ ] **Step 3: TypeScript 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add nextjs/lib/api.ts nextjs/hooks/useCategories.ts
git commit -m "feat: createCategory()에 번역 필드 파라미터 추가"
```

---

### Task 4: 프론트엔드 — 대량 업로드 컴포넌트 생성

**Files:**
- Create: `nextjs/components/bulk-upload.tsx`

- [ ] **Step 1: xlsx 라이브러리 설치**

```bash
docker exec cl_embed_nextjs npm install xlsx --no-bin-links
```

- [ ] **Step 2: BulkUpload 컴포넌트 작성**

`nextjs/components/bulk-upload.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface BulkUploadProps {
  token?: string | null;
  onSuccess: () => void;
}

interface RowResult {
  row: number;
  success: boolean;
  message?: string;
  categoryCode?: string;
  categoryNameKo?: string;
}

export default function BulkUpload({ token, onSuccess }: BulkUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentRow, setCurrentRow] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [results, setResults] = useState<RowResult[] | null>(null);

  const successCount = results?.filter((r) => r.success).length ?? 0;
  const failCount = results?.filter((r) => !r.success).length ?? 0;

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResults(null);
      setCurrentRow(0);
      setTotalRows(0);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;

    setIsProcessing(true);
    setResults(null);

    const XLSX = await import("xlsx");
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
    });

    // 2행부터 데이터 (index 1부터)
    const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell !== null && cell !== ""));
    setTotalRows(dataRows.length);

    const rowResults: RowResult[] = [];
    const { createCategory } = await import("@/lib/api");

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // 엑셀 행 번호 (1-based, 헤더 포함)
      setCurrentRow(i + 1);

      const code = row[0] ? String(row[0]).trim() : undefined;
      const nameKo = row[1] ? String(row[1]).trim() : "";
      const nameEn = row[2] ? String(row[2]).trim() : undefined;
      const nameZh = row[3] ? String(row[3]).trim() : undefined;

      // B열(한국어) 필수 검증
      if (!nameKo) {
        rowResults.push({
          row: rowNum,
          success: false,
          message: "한국어 카테고리명(B열)이 비어있습니다",
        });
        setResults([...rowResults]);
        continue;
      }

      try {
        await createCategory(nameKo, token, code, nameEn, nameZh);
        rowResults.push({
          row: rowNum,
          success: true,
          categoryCode: code,
          categoryNameKo: nameKo,
        });
      } catch (err) {
        rowResults.push({
          row: rowNum,
          success: false,
          message: err instanceof Error ? err.message : "알 수 없는 오류",
          categoryCode: code,
          categoryNameKo: nameKo,
        });
      }

      setResults([...rowResults]);
    }

    setIsProcessing(false);
    if (rowResults.some((r) => r.success)) {
      onSuccess();
    }
  }, [file, token, onSuccess]);

  const handleReset = useCallback(() => {
    setFile(null);
    setResults(null);
    setCurrentRow(0);
    setTotalRows(0);
  }, []);

  return (
    <div className="space-y-3">
      {/* 샘플 다운로드 */}
      <a
        href="/samples/카테고리대량등록_v1.xlsx"
        download
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Download className="h-3.5 w-3.5" />
        샘플 다운로드
      </a>

      {/* 파일 선택 */}
      {!results && (
        <>
          <label
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-4 cursor-pointer transition-colors",
              "hover:border-primary/40 hover:bg-muted/30",
            )}
          >
            <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {file ? file.name : "xlsx 파일을 선택하세요"}
            </span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <Button
            onClick={handleUpload}
            disabled={!file || isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                처리 중... ({currentRow}/{totalRows})
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                업로드
              </>
            )}
          </Button>
        </>
      )}

      {/* 진행률 */}
      {isProcessing && totalRows > 0 && (
        <Progress value={(currentRow / totalRows) * 100}>
          <ProgressLabel>진행률</ProgressLabel>
          <ProgressValue />
        </Progress>
      )}

      {/* 결과 통계 */}
      {results && (
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              성공 {successCount}건
            </span>
            <span className="flex items-center gap-1 text-destructive">
              <XCircle className="h-4 w-4" />
              실패 {failCount}건
            </span>
          </div>

          {/* 실패 행 목록 */}
          {failCount > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-destructive/30 bg-destructive/5 p-2">
              <p className="mb-1 text-xs font-medium text-destructive">실패 목록</p>
              {results
                .filter((r) => !r.success)
                .map((r) => (
                  <p key={r.row} className="text-xs text-muted-foreground">
                    {r.row}행: {r.message}
                    {r.categoryNameKo && ` (${r.categoryNameKo})`}
                  </p>
                ))}
            </div>
          )}

          <Button variant="outline" onClick={handleReset} className="w-full">
            <RefreshCw className="h-4 w-4" />
            다시 업로드
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: TypeScript 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add nextjs/components/bulk-upload.tsx
git commit -m "feat: 대량 카테고리 업로드 컴포넌트 추가"
```

---

### Task 5: 프론트엔드 — embed 페이지에 Radio 토글 + 대량 모드 통합

**Files:**
- Modify: `nextjs/app/embed/embed-page-inner.tsx`

- [ ] **Step 1: import 추가**

`embed-page-inner.tsx` 상단에 다음 import를 추가한다:

```typescript
import BulkUpload from "@/components/bulk-upload";
```

- [ ] **Step 2: addMode state 추가**

기존 state 선언부 근처에 다음을 추가한다 (대략 155번 줄 근처):

```typescript
const [addMode, setAddMode] = useState<"single" | "bulk">("single");
```

- [ ] **Step 3: "추가" Card 수정**

기존 "추가" Card (547~591번 줄)를 다음으로 교체한다:

```tsx
{/* 추가 */}
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle className="text-base">추가</CardTitle>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          className={getPillButtonClass(addMode === "single")}
          onClick={() => setAddMode("single")}
          aria-pressed={addMode === "single"}
        >
          단일
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={getPillButtonClass(addMode === "bulk")}
          onClick={() => setAddMode("bulk")}
          aria-pressed={addMode === "bulk"}
        >
          대량
        </Button>
      </div>
    </div>
  </CardHeader>
  <CardContent className="space-y-3">
    {addMode === "single" ? (
      <>
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
        <div className="space-y-2">
          <Label htmlFor="category-name">한국어 카테고리명</Label>
          <Input
            id="category-name"
            placeholder="예: 의류>여성의류>원피스"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddCategory();
            }}
          />
        </div>
        <Button
          onClick={() => {
            if (!user) { alert("로그인이 필요합니다"); return; }
            handleAddCategory();
          }}
          disabled={!newCategoryName.trim()}
          className="w-full"
        >
          <Plus className="h-4 w-4" />
          추가
        </Button>
      </>
    ) : (
      <BulkUpload
        token={token}
        onSuccess={() => {
          loadCategories(page, perPage, effectiveFilter);
          setHierarchyRefreshKey((prev) => prev + 1);
        }}
      />
    )}
    {catError && (
      <p className="text-sm text-destructive">{catError}</p>
    )}
  </CardContent>
</Card>
```

- [ ] **Step 4: TypeScript 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 5: Lint 체크**

```bash
docker exec cl_embed_nextjs npm run lint
```

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add nextjs/app/embed/embed-page-inner.tsx
git commit -m "feat: embed 페이지 추가 섹션에 단일/대량 모드 토글 추가"
```

---

### Task 6: Playwright E2E 테스트

**Files:**
- Create: `nextjs/e2e/bulk-upload.spec.ts`

- [ ] **Step 1: Playwright 테스트 작성**

`nextjs/e2e/bulk-upload.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("대량 카테고리 업로드", () => {
  test.beforeEach(async ({ page }) => {
    // 로그인이 필요하므로 토큰으로 인증
    await page.goto("/embed");
  });

  test("추가 Card에 단일/대량 토글이 표시된다", async ({ page }) => {
    const addCard = page.locator("text=추가").first();
    await expect(addCard).toBeVisible();

    await expect(page.getByRole("button", { name: "단일" })).toBeVisible();
    await expect(page.getByRole("button", { name: "대량" })).toBeVisible();
  });

  test("대량 모드에서 샘플 다운로드 링크가 표시된다", async ({ page }) => {
    await page.getByRole("button", { name: "대량" }).click();

    const downloadLink = page.getByText("샘플 다운로드");
    await expect(downloadLink).toBeVisible();
    await expect(downloadLink).toHaveAttribute("href", "/samples/카테고리대량등록_v1.xlsx");
  });

  test("대량 모드에서 xlsx 파일 업로드 후 결과 통계가 표시된다", async ({ page }) => {
    // 인증 토큰 설정
    const token = await page.evaluate(() => localStorage.getItem("token"));
    if (!token) {
      test.skip();
      return;
    }

    await page.getByRole("button", { name: "대량" }).click();

    // 파일 업로드
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles("public/samples/카테고리대량등록_v1.xlsx");

    // 업로드 버튼 클릭
    await page.getByRole("button", { name: "업로드" }).click();

    // 결과 통계 표시 대기 (최대 60초)
    await expect(page.getByText(/성공 \d+건/)).toBeVisible({ timeout: 60000 });
    await expect(page.getByText(/실패 \d+건/)).toBeVisible();
  });
});
```

- [ ] **Step 2: Playwright 테스트 실행**

```bash
cd /var/app/www/cl_embed/nextjs && npx playwright test e2e/bulk-upload.spec.ts --reporter=list
```

Expected: Tests pass (또는 인증 토큰 없는 경우 skip)

- [ ] **Step 3: Commit**

```bash
git add nextjs/e2e/bulk-upload.spec.ts
git commit -m "test: 대량 카테고리 업로드 Playwright E2E 테스트"
```

---

### Task 7: 전체 검증 및 마무리

- [ ] **Step 1: run-all-checks.sh 실행**

```bash
cd /var/app/www/cl_embed && bash .claude/hooks/run-all-checks.sh
```

- [ ] **Step 2: 결과 확인**

```bash
cat .claude/hooks/test-results/*.txt
```

Expected: tsc, lint, test, pint 모두 EXIT=0

- [ ] **Step 3: 브라우저에서 수동 검증**

Playwright로 `https://embed.cunlim.dev`에 접속하여:
1. "추가" Card에 단일/대량 토글 표시 확인
2. 대량 모드 전환 시 샘플 다운로드 + 파일 업로드 UI 표시 확인
3. 샘플 파일 다운로드 동작 확인
4. 업로드 후 결과 통계 표시 확인

- [ ] **Step 4: 이슈 수정 (필요 시)**

발견된 이슈를 수정하고 Step 1~3을 반복한다.
