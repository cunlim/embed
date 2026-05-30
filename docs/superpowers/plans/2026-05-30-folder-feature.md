# 폴더 기능 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** embed 페이지에 폴더 기능을 추가하여 카테고리를 폴더별로 분류·관리할 수 있게 합니다.

**Architecture:** categories 테이블에 `folder` 컬럼을 추가하고, 별도 folders 테이블 없이 `SELECT DISTINCT folder`로 폴더 목록을 파생합니다. 프론트엔드는 FolderSection 컴포넌트를 유사도 검색 상단에 배치하고, URL 파라미터 `folder`로 상태를 동기화합니다.

**Tech Stack:** Laravel (PHP), Next.js (TypeScript), PostgreSQL + pgvector, shadcn/ui

---

## 파일 구조

### 새로 생성

| 파일 | 역할 |
|------|------|
| `laravel/database/migrations/2026_05_30_000002_add_folder_to_categories_table.php` | folder 컬럼 + unique 인덱스 |
| `laravel/app/Http/Controllers/Api/FolderController.php` | 폴더 CRUD API |
| `laravel/app/Http/Requests/FolderDeleteRequest.php` | 폴더 삭제 요청 검증 |
| `laravel/app/Http/Requests/MoveFolderRequest.php` | 카테고리 폴더 이동 요청 검증 |
| `nextjs/components/admin/folder-section.tsx` | FolderSection UI 컴포넌트 |
| `nextjs/components/admin/folder-delete-modal.tsx` | 폴더 삭제 확인 모달 |

### 수정

| 파일 | 변경 내용 |
|------|----------|
| `laravel/routes/api.php` | 폴더 관련 라우트 추가 |
| `laravel/app/Http/Controllers/Api/CategoryController.php` | folder 필터링, 생성 시 folder |
| `laravel/app/Http/Requests/CategoryStoreRequest.php` | folder 필드 검증 |
| `laravel/app/Http/Controllers/Api/RecommendController.php` | folder 필터링 |
| `laravel/app/Http/Requests/RecommendRequest.php` | folder 필드 검증 |
| `laravel/app/Services/RecommendationService.php` | folder 조건 추가 |
| `laravel/app/Models/Category.php` | folder fillable |
| `nextjs/lib/api.ts` | folder 관련 타입/함수 |
| `nextjs/lib/embed-params.ts` | folder URL 파라미터 |
| `nextjs/app/embed/page.tsx` | SSR folder 파싱 |
| `nextjs/app/embed/embed-page-inner.tsx` | FolderSection 통합 |
| `nextjs/hooks/useCategories.ts` | folder 파라미터 |
| `nextjs/components/admin/task-execution.tsx` | folder 범위 |
| `nextjs/components/admin/category-delete.tsx` | folder 범위 |
| `nextjs/components/admin/category-download.tsx` | folder 범위 |
| `nextjs/components/bulk-upload.tsx` | folder 전달 |

---

## Task 1: DB 마이그레이션 — folder 컬럼 + unique 인덱스

**Files:**
- Create: `laravel/database/migrations/2026_05_30_000002_add_folder_to_categories_table.php`

- [ ] **Step 1: 마이그레이션 파일 생성**

```bash
docker exec cl_embed_laravel php artisan make:migration add_folder_to_categories_table
```

- [ ] **Step 2: 마이그레이션 코드 작성**

`laravel/database/migrations/2026_05_30_000002_add_folder_to_categories_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // folder 컬럼 추가
        Schema::table('categories', function (Blueprint $table) {
            $table->string('folder', 100)->nullable()->default(null)->after('user_id');
        });

        // 기존 복합 unique 인덱스 제거
        $hasCompositeUnique = DB::selectOne(
            "SELECT 1 FROM pg_indexes WHERE indexname = 'categories_category_code_user_id_unique'"
        );
        if ($hasCompositeUnique) {
            Schema::table('categories', function (Blueprint $table) {
                $table->dropUnique('categories_category_code_user_id_unique');
            });
        }

        // COALESCE 기반 partial unique 인덱스 추가 (NULL 처리)
        DB::statement(
            'CREATE UNIQUE INDEX categories_code_user_folder_unique ON categories (category_code, user_id, COALESCE(folder, \'\'))'
        );
    }

    public function down(): void
    {
        // partial unique 인덱스 제거
        DB::statement('DROP INDEX IF EXISTS categories_code_user_folder_unique');

        // 기존 복합 unique 인덱스 복원
        Schema::table('categories', function (Blueprint $table) {
            $table->unique(['category_code', 'user_id']);
        });

        // folder 컬럼 제거
        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn('folder');
        });
    }
};
```

- [ ] **Step 3: 마이그레이션 실행**

```bash
docker exec cl_embed_laravel php artisan migrate
```

Expected: `Migration ran successfully.`

- [ ] **Step 4: 인덱스 확인**

```bash
docker exec cl_embed_laravel php artisan tinker --execute="dump(DB::select(\"SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'categories' AND indexname LIKE '%folder%'\")╴"
```

Expected: `categories_code_user_folder_unique` 인덱스 존재

- [ ] **Step 5: Commit**

```bash
git add laravel/database/migrations/2026_05_30_000002_add_folder_to_categories_table.php
git commit -m "feat: categories 테이블에 folder 컬럼 및 unique 인덱스 추가"
```

---

## Task 2: Category 모델 + CategoryStoreRequest 업데이트

**Files:**
- Modify: `laravel/app/Models/Category.php`
- Modify: `laravel/app/Http/Requests/CategoryStoreRequest.php`

- [ ] **Step 1: Category 모델에 folder fillable 추가**

`laravel/app/Models/Category.php` — `#[Fillable]` 어트리뷰트에 `folder` 추가:

```php
#[Fillable(['category_code', 'category_name_ko', 'category_name_zh', 'category_name_en', 'user_id', 'folder'])]
```

- [ ] **Step 2: CategoryStoreRequest에 folder 검증 추가**

`laravel/app/Http/Requests/CategoryStoreRequest.php` — `rules()` 메서드에 folder 규칙 추가:

```php
'folder' => ['nullable', 'string', 'max:100'],
```

- [ ] **Step 3: CategoryController::store에서 folder 처리**

`laravel/app/Http/Controllers/Api/CategoryController.php` — `store()` 메서드에서 folder 포함:

```php
$category = Category::create([
    'category_code' => $request->filled('category_code')
        ? $request->category_code
        : Category::generateCode($request->user('sanctum')->id),
    'category_name_ko' => $request->category_name_ko,
    'category_name_en' => $request->input('category_name_en'),
    'category_name_zh' => $request->input('category_name_zh'),
    'user_id' => $request->user('sanctum')->id,
    'folder' => $request->input('folder'),
]);
```

- [ ] **Step 4: tsc 확인**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: EXIT=0

- [ ] **Step 5: Commit**

```bash
git add laravel/app/Models/Category.php laravel/app/Http/Requests/CategoryStoreRequest.php laravel/app/Http/Controllers/Api/CategoryController.php
git commit -m "feat: Category 모델·생성 요청에 folder 필드 추가"
```

---

## Task 3: 폴더 API — FolderController + 라우트

**Files:**
- Create: `laravel/app/Http/Controllers/Api/FolderController.php`
- Create: `laravel/app/Http/Requests/FolderDeleteRequest.php`
- Create: `laravel/app/Http/Requests/MoveFolderRequest.php`
- Modify: `laravel/routes/api.php`

- [ ] **Step 1: FolderController 생성**

`laravel/app/Http/Controllers/Api/FolderController.php`:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\FolderDeleteRequest;
use App\Http\Requests\MoveFolderRequest;
use App\Models\Category;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FolderController extends Controller
{
    /**
     * 폴더 목록 조회
     * GET /api/folders?user_id={userId}
     */
    public function index(Request $request): JsonResponse
    {
        $user = auth('sanctum')->user();
        $userId = $request->input('user_id');

        $query = Category::query()
            ->whereNotNull('folder')
            ->distinct()
            ->select('folder');

        // user_id가 지정되면 해당 사용자 폴더만
        if ($userId) {
            $query->where('user_id', (int) $userId);
        } else {
            // 기존 범위 규칙 적용
            if ($user && $user->isAdmin()) {
                // admin: 제한 없음
            } elseif ($user) {
                $query->whereIn('user_id', [$user->id, 1]);
            } else {
                $query->where('user_id', 1);
            }
        }

        $folders = $query->orderBy('folder')->pluck('folder');

        return response()->json(['data' => $folders]);
    }

    /**
     * 폴더 삭제
     * DELETE /api/folders/{folderName}
     */
    public function destroy(FolderDeleteRequest $request, string $folderName): JsonResponse
    {
        /** @var User $user */
        $user = $request->user('sanctum');
        $userId = (int) $request->input('user_id', $user->id);
        $moveToDefault = $request->boolean('move_to_default', true);

        // 권한 확인
        if (!$user->isAdmin() && $userId !== $user->id) {
            return response()->json(['message' => '이 회원의 폴더를 삭제할 권한이 없습니다.'], 403);
        }

        $query = Category::where('folder', $folderName)->where('user_id', $userId);
        $count = $query->count();

        if ($count === 0) {
            return response()->json(['message' => '해당 폴더에 카테고리가 없습니다.'], 404);
        }

        if ($moveToDefault) {
            // 기본폴더로 이동
            $query->update(['folder' => null]);
            return response()->json([
                'message' => "폴더 '{$folderName}'의 카테고리 {$count}개를 기본폴더로 이동했습니다.",
                'moved' => $count,
            ]);
        } else {
            // 카테고리도 함께 삭제
            $categoryIds = $query->pluck('id');
            Category::whereIn('id', $categoryIds)->delete();
            return response()->json([
                'message' => "폴더 '{$folderName}'의 카테고리 {$count}개를 삭제했습니다.",
                'deleted' => $count,
            ]);
        }
    }

    /**
     * 카테고리 폴더 이동
     * POST /api/categories/move-folder
     */
    public function moveFolder(MoveFolderRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user('sanctum');
        $categoryIds = $request->input('category_ids', []);
        $targetFolder = $request->input('target_folder'); // null이면 기본폴더

        // category_ids가 비어있으면 현재 사용자의 모든 카테고리 대상
        if (empty($categoryIds)) {
            $query = Category::where('user_id', $user->id);
            if (!$user->isAdmin()) {
                // 일반 사용자는 본인 소유만
            }
            $categoryIds = $query->pluck('id')->toArray();
        }

        // 권한 확인: 본인 소유 또는 admin만
        $categories = Category::whereIn('id', $categoryIds)->get();
        $allowedIds = $categories->filter(function ($cat) use ($user) {
            return $user->isAdmin() || $cat->user_id === $user->id;
        })->pluck('id')->toArray();

        if (empty($allowedIds)) {
            return response()->json(['message' => '이동 가능한 카테고리가 없습니다.'], 400);
        }

        Category::whereIn('id', $allowedIds)->update(['folder' => $targetFolder]);

        return response()->json([
            'message' => count($allowedIds) . '개 카테고리를 이동했습니다.',
            'moved' => count($allowedIds),
        ]);
    }
}
```

- [ ] **Step 2: FolderDeleteRequest 생성**

`laravel/app/Http/Requests/FolderDeleteRequest.php`:

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class FolderDeleteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'move_to_default' => ['nullable', 'boolean'],
        ];
    }
}
```

- [ ] **Step 3: MoveFolderRequest 생성**

`laravel/app/Http/Requests/MoveFolderRequest.php`:

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MoveFolderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
            'target_folder' => ['nullable', 'string', 'max:100'],
        ];
    }
}
```

- [ ] **Step 4: api.php에 라우트 추가**

`laravel/routes/api.php` — 기존 카테고리 라우트 근처에 추가:

```php
// 폴더
Route::get('/folders', [FolderController::class, 'index']);
Route::delete('/folders/{folderName}', [FolderController::class, 'destroy']);
Route::post('/categories/move-folder', [FolderController::class, 'moveFolder']);
```

- [ ] **Step 5: PHP 문법 확인**

```bash
docker exec cl_embed_laravel php artisan route:list --path=api/folders
```

Expected: 3개 라우트 출력

- [ ] **Step 6: Commit**

```bash
git add laravel/app/Http/Controllers/Api/FolderController.php laravel/app/Http/Requests/FolderDeleteRequest.php laravel/app/Http/Requests/MoveFolderRequest.php laravel/routes/api.php
git commit -m "feat: 폴더 CRUD API (목록·삭제·이동) 추가"
```

---

## Task 4: 기존 API에 folder 필터링 추가

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php`
- Modify: `laravel/app/Http/Controllers/Api/RecommendController.php`
- Modify: `laravel/app/Http/Requests/RecommendRequest.php`
- Modify: `laravel/app/Services/RecommendationService.php`

- [ ] **Step 1: CategoryController::index에 folder 필터 추가**

`laravel/app/Http/Controllers/Api/CategoryController.php` — `index()` 메서드의 `$query` 빌드 부분에 추가:

```php
// folder 필터
if ($request->filled('folder')) {
    $folder = $request->input('folder');
    if ($folder === '기본폴더') {
        $query->whereNull('folder');
    } else {
        $query->where('folder', $folder);
    }
}
```

- [ ] **Step 2: CategoryController::levels에 folder 필터 추가**

`laravel/app/Http/Controllers/Api/CategoryController.php` — `levels()` 메서드의 `$scopeQuery` 빌드 부분에 추가:

```php
// folder 필터
if ($request->filled('folder')) {
    $folder = $request->input('folder');
    if ($folder === '기본폴더') {
        $scopeQuery->whereNull('folder');
    } else {
        $scopeQuery->where('folder', $folder);
    }
}
```

- [ ] **Step 3: RecommendRequest에 folder 필드 추가**

`laravel/app/Http/Requests/RecommendRequest.php` — `rules()` 배열에 추가:

```php
'folder' => ['nullable', 'string', 'max:100'],
```

- [ ] **Step 4: RecommendController에 folder 필터 전달**

`laravel/app/Http/Controllers/Api/RecommendController.php` — `recommend()` 메서드에서 folder 추출 및 전달:

```php
$folder = $request->validated('folder');
```

RecommendationService 호출 시 folder 전달:

```php
$results = $this->recommendation->recommendPaginated(
    $searchLog, $targetLanguage, $perPage, $page, $scopeUserId, $keyword, $folder
);
```

text가 비어있는 경우의 일반 목록 쿼리에도 folder 필터 추가:

```php
if ($folder) {
    if ($folder === '기본폴더') {
        $query->whereNull('categories.folder');
    } else {
        $query->where('categories.folder', $folder);
    }
}
```

- [ ] **Step 5: RecommendationService에 folder 파라미터 추가**

`laravel/app/Services/RecommendationService.php` — `recommendPaginated()` 시그니처 변경:

```php
public function recommendPaginated(SearchLog $searchLog, string $targetLanguage, int $perPage = 20, int $page = 1, int|array|null $userId = null, ?string $keyword = null, ?string $folder = null): LengthAwarePaginator
```

keyword 조건 뒤에 folder 조건 추가:

```php
if ($folder) {
    if ($folder === '기본폴더') {
        $query->whereNull('categories.folder');
    } else {
        $query->where('categories.folder', $folder);
    }
}
```

- [ ] **Step 6: PHP 문법 확인**

```bash
docker exec cl_embed_laravel php artisan tinker --execute="echo 'OK';"
```

Expected: `OK`

- [ ] **Step 7: Commit**

```bash
git add laravel/app/Http/Controllers/Api/CategoryController.php laravel/app/Http/Controllers/Api/RecommendController.php laravel/app/Http/Requests/RecommendRequest.php laravel/app/Services/RecommendationService.php
git commit -m "feat: 카테고리·추천 API에 folder 필터링 추가"
```

---

## Task 5: 프론트엔드 타입·함수 — api.ts + embed-params.ts

**Files:**
- Modify: `nextjs/lib/api.ts`
- Modify: `nextjs/lib/embed-params.ts`

- [ ] **Step 1: api.ts에 folder 관련 함수 추가**

`nextjs/lib/api.ts` — 파일 끝에 추가:

```typescript
// --- 폴더 ---

export function fetchFolders(
  token?: string | null,
  userId?: number | null,
): Promise<{ data: string[] }> {
  const params = new URLSearchParams();
  if (userId) params.set("user_id", String(userId));
  const qs = params.toString();
  return request<{ data: string[] }>(`/folders${qs ? "?" + qs : ""}`, { token });
}

export function deleteFolder(
  folderName: string,
  token?: string | null,
  userId?: number | null,
  moveToDefault: boolean = true,
): Promise<{ message: string }> {
  const params = new URLSearchParams();
  if (userId) params.set("user_id", String(userId));
  params.set("move_to_default", String(moveToDefault));
  const qs = params.toString();
  return request<{ message: string }>(`/folders/${encodeURIComponent(folderName)}?${qs}`, {
    method: "DELETE",
    token,
  });
}

export function moveCategoriesToFolder(
  categoryIds: number[],
  targetFolder: string | null,
  token?: string | null,
): Promise<{ message: string; moved: number }> {
  return request<{ message: string; moved: number }>("/categories/move-folder", {
    method: "POST",
    body: { category_ids: categoryIds, target_folder: targetFolder },
    token,
  });
}

export function fetchUsers(token?: string | null): Promise<{ data: { id: number; name: string; email: string }[] }> {
  return request<{ data: { id: number; name: string; email: string }[] }>("/admin/users", { token });
}
```

- [ ] **Step 2: getCategories에 folder 파라미터 추가**

`nextjs/lib/api.ts` — `getCategories()` 시그니처 변경:

```typescript
export function getCategories(
  token?: string | null,
  page?: number,
  perPage?: number,
  filter?: string,
  search?: string,
  folder?: string,
): Promise<CategoryListResponse> {
  const params = new URLSearchParams();
  if (page && page > 1) params.set("page", String(page));
  params.set("per_page", String(perPage ?? 20));
  if (filter) params.set("filter", filter);
  if (search) params.set("search", search);
  if (folder) params.set("folder", folder);
  const qs = params.toString();
  return request<CategoryListResponse>(`/categories?${qs}`, { token });
}
```

- [ ] **Step 3: recommend에 folder 파라미터 추가**

`nextjs/lib/api.ts` — `recommend()` 시그니처 변경:

```typescript
export function recommend(
  text: string,
  targetLanguage: string,
  token?: string | null,
  page?: number,
  perPage?: number,
  filter?: string,
  keyword?: string,
  folder?: string,
): Promise<RecommendResponse> {
  const body: Record<string, string | number> = { text, target_language: targetLanguage };
  if (page) body.page = page;
  if (perPage) body.per_page = perPage;
  if (filter) body.filter = filter;
  if (keyword) body.keyword = keyword;
  if (folder) body.folder = folder;
  return request<RecommendResponse>("/recommend", {
    method: "POST",
    body,
    token,
  });
}
```

- [ ] **Step 4: createCategory에 folder 파라미터 추가**

`nextjs/lib/api.ts` — `createCategory()` 시그니처 변경:

```typescript
export function createCategory(
  categoryNameKo: string,
  token?: string | null,
  categoryCode?: string,
  categoryNameEn?: string,
  categoryNameZh?: string,
  folder?: string,
): Promise<{ data: Category }> {
  const body: Record<string, string> = { category_name_ko: categoryNameKo };
  if (categoryCode) body.category_code = categoryCode;
  if (categoryNameEn) body.category_name_en = categoryNameEn;
  if (categoryNameZh) body.category_name_zh = categoryNameZh;
  if (folder) body.folder = folder;
  return request<{ data: Category }>("/categories", {
    method: "POST",
    body,
    token,
  });
}
```

- [ ] **Step 5: embed-params.ts에 folder 파라미터 추가**

`nextjs/lib/embed-params.ts` — `EmbedParams` 인터페이스와 `parseEmbedParams()` 함수:

```typescript
export interface EmbedParams {
  mode: "hierarchy" | "search";
  keyword: string | null;
  filter: string | undefined;
  searchText: string | null;
  searchLang: string;
  catPath: string[];
  folder: string | null;  // 추가
}

export function parseEmbedParams(params: EmbedParamsReader): EmbedParams {
  // ... 기존 코드 ...
  const folder = params.get("folder") || null;

  return { mode, keyword, filter, searchText, searchLang, catPath, folder };
}
```

- [ ] **Step 6: tsc 확인**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: EXIT=0

- [ ] **Step 7: Commit**

```bash
git add nextjs/lib/api.ts nextjs/lib/embed-params.ts
git commit -m "feat: 프론트엔드 folder 타입·함수 추가"
```

---

## Task 6: FolderSection 컴포넌트 + FolderDeleteModal

**Files:**
- Create: `nextjs/components/admin/folder-section.tsx`
- Create: `nextjs/components/admin/folder-delete-modal.tsx`

- [ ] **Step 1: FolderDeleteModal 컴포넌트 생성**

`nextjs/components/admin/folder-delete-modal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface FolderDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string;
  onConfirm: (moveToDefault: boolean) => void;
}

export default function FolderDeleteModal({
  open,
  onOpenChange,
  folderName,
  onConfirm,
}: FolderDeleteModalProps) {
  const [moveToDefault, setMoveToDefault] = useState(true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>폴더 삭제</DialogTitle>
          <DialogDescription>
            &ldquo;{folderName}&rdquo; 폴더를 삭제하시겠습니까?
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={String(moveToDefault)} onValueChange={(v) => setMoveToDefault(v === "true")}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="true" id="move-default" />
            <Label htmlFor="move-default">기본폴더로 이동</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="false" id="delete-all" />
            <Label htmlFor="delete-all">카테고리도 함께 삭제</Label>
          </div>
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(moveToDefault)}>
            삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: FolderSection 컴포넌트 생성**

`nextjs/components/admin/folder-section.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { FolderPlus, FolderMinus, ArrowRightLeft } from "lucide-react";
import { fetchFolders, deleteFolder, moveCategoriesToFolder, fetchUsers } from "@/lib/api";
import { isAdmin } from "@/lib/utils";
import FolderDeleteModal from "./folder-delete-modal";

interface FolderSectionProps {
  token: string | null;
  user: import("@/lib/api").User | null;
  selectedFolder: string | null;
  selectedIds: Set<number>;
  onFolderChange: (folder: string | null) => void;
  onFolderActionComplete: () => void;
}

interface UserData {
  id: number;
  name: string;
  email: string;
}

const DEFAULT_FOLDER_LABEL = "기본폴더";
const ALL_FOLDERS_VALUE = "__all__";

export default function FolderSection({
  token,
  user,
  selectedFolder,
  selectedIds,
  onFolderChange,
  onFolderActionComplete,
}: FolderSectionProps) {
  const [folders, setFolders] = useState<string[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [moveTargetFolder, setMoveTargetFolder] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const isViewerAdmin = user ? isAdmin(user) : false;

  // 회원 목록 로드 (관리자만)
  useEffect(() => {
    if (!token || !isViewerAdmin) return;
    fetchUsers(token).then((res) => setUsers(res.data)).catch(() => {});
  }, [token, isViewerAdmin]);

  // 폴더 목록 로드
  const loadFolders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchFolders(token, selectedUserId);
      setFolders(res.data);
    } catch {
      // 무시
    } finally {
      setLoading(false);
    }
  }, [token, selectedUserId]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  // 폴더 추가
  const handleAddFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name || !token) return;
    if (name === DEFAULT_FOLDER_LABEL) {
      setError(`"${DEFAULT_FOLDER_LABEL}"은(는) 사용할 수 없는 이름입니다.`);
      return;
    }
    if (folders.includes(name)) {
      setError("이미 존재하는 폴더명입니다.");
      return;
    }

    // 빈 카테고리를 임시 생성했다 삭제하는 방식 대신,
    // 실제 카테고리 이동 시 폴더가 자동 생성되므로 여기서는 목록에만 추가
    setFolders((prev) => [...prev, name].sort());
    setNewFolderName("");
    setError(null);
  }, [newFolderName, token, folders]);

  // 폴더 삭제
  const handleDeleteFolder = useCallback(async (moveToDefault: boolean) => {
    if (!token || !selectedFolder || selectedFolder === ALL_FOLDERS_VALUE) return;
    try {
      await deleteFolder(selectedFolder, token, selectedUserId, moveToDefault);
      setDeleteModalOpen(false);
      onFolderChange(null);
      await loadFolders();
      onFolderActionComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "폴더 삭제 실패");
    }
  }, [token, selectedFolder, selectedUserId, loadFolders, onFolderChange, onFolderActionComplete]);

  // 선택 폴더 이동
  const handleMoveSelected = useCallback(async () => {
    if (!token || selectedIds.size === 0) return;
    const target = moveTargetFolder === DEFAULT_FOLDER_LABEL ? null : moveTargetFolder || null;
    try {
      await moveCategoriesToFolder(Array.from(selectedIds), target, token);
      setMoveTargetFolder("");
      await loadFolders();
      onFolderActionComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "폴더 이동 실패");
    }
  }, [token, selectedIds, moveTargetFolder, loadFolders, onFolderActionComplete]);

  // 전체 폴더 이동
  const handleMoveAll = useCallback(async () => {
    if (!token) return;
    const target = moveTargetFolder === DEFAULT_FOLDER_LABEL ? null : moveTargetFolder || null;
    try {
      await moveCategoriesToFolder([], target, token);
      setMoveTargetFolder("");
      await loadFolders();
      onFolderActionComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "폴더 이동 실패");
    }
  }, [token, moveTargetFolder, loadFolders, onFolderActionComplete]);

  // 회원 변경
  const handleUserChange = useCallback((value: string) => {
    if (value === "all") {
      setSelectedUserId(null);
    } else {
      setSelectedUserId(Number(value));
    }
    onFolderChange(null);
  }, [onFolderChange]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">폴더</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 관리자: 회원 select */}
          {isViewerAdmin && (
            <div className="space-y-1">
              <Label className="text-xs">회원</Label>
              <Select value={selectedUserId ? String(selectedUserId) : "all"} onValueChange={handleUserChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 폴더 select */}
          <div className="space-y-1">
            <Label className="text-xs">폴더</Label>
            <Select
              value={selectedFolder ?? ALL_FOLDERS_VALUE}
              onValueChange={(value) => onFolderChange(value === ALL_FOLDERS_VALUE ? null : value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FOLDERS_VALUE}>전체</SelectItem>
                <SelectItem value={DEFAULT_FOLDER_LABEL}>
                  <span className="italic text-muted-foreground">{DEFAULT_FOLDER_LABEL}</span>
                </SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 새 폴더 추가 */}
          <div className="flex gap-2">
            <Input
              placeholder="새 폴더명"
              value={newFolderName}
              onChange={(e) => { setNewFolderName(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddFolder(); }}
              className="h-8 text-sm"
            />
            <Button size="sm" onClick={handleAddFolder} disabled={!newFolderName.trim()} className="h-8 shrink-0">
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* 폴더 이동 */}
          <div className="space-y-2">
            <Select value={moveTargetFolder} onValueChange={setMoveTargetFolder}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="이동할 폴더 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_FOLDER_LABEL}>{DEFAULT_FOLDER_LABEL}</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleMoveSelected}
                disabled={selectedIds.size === 0 || !moveTargetFolder}
                className="flex-1 h-8 text-xs"
              >
                <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                선택이동
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleMoveAll}
                disabled={!moveTargetFolder}
                className="flex-1 h-8 text-xs"
              >
                <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                전체이동
              </Button>
            </div>
          </div>

          {/* 폴더 삭제 */}
          {selectedFolder && selectedFolder !== ALL_FOLDERS_VALUE && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setDeleteModalOpen(true)}
              className="w-full h-8 text-xs"
            >
              <FolderMinus className="h-3.5 w-3.5 mr-1" />
              &ldquo;{selectedFolder}&rdquo; 삭제
            </Button>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <FolderDeleteModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        folderName={selectedFolder ?? ""}
        onConfirm={handleDeleteFolder}
      />
    </>
  );
}
```

- [ ] **Step 3: tsc 확인**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: EXIT=0

- [ ] **Step 4: Commit**

```bash
git add nextjs/components/admin/folder-section.tsx nextjs/components/admin/folder-delete-modal.tsx
git commit -m "feat: FolderSection·FolderDeleteModal 컴포넌트 추가"
```

---

## Task 7: SSR page.tsx + embed-page-inner.tsx 통합

**Files:**
- Modify: `nextjs/app/embed/page.tsx`
- Modify: `nextjs/app/embed/embed-page-inner.tsx`

- [ ] **Step 1: SSR page.tsx에 folder 파싱 추가**

`nextjs/app/embed/page.tsx` — `parseEmbedParams` 호출 후 folder 추출:

```typescript
const { keyword, searchText, searchLang, filter: urlFilter, folder: urlFolder } = parseEmbedParams(reader);
```

SSR prefetch 시 folder 파라미터 전달:

```typescript
// 카테고리 목록 prefetch
const categoriesRes = await getCategories(token, page, perPage, serverDefaultFilter ?? undefined, keyword ?? undefined, urlFolder ?? undefined);
```

유사도 검색 prefetch 시 folder 전달:

```typescript
if (searchText) {
  const searchRes = await recommend(searchText, searchLang, token, page, perPage, serverDefaultFilter ?? undefined, keyword ?? undefined, urlFolder ?? undefined);
}
```

EmbedPageInner에 folder props 전달:

```tsx
<EmbedPageInner
  // ... 기존 props ...
  serverFolder={urlFolder}
/>
```

- [ ] **Step 2: embed-page-inner.tsx에 folder state 추가**

`nextjs/app/embed/embed-page-inner.tsx` — props에 `serverFolder` 추가:

```typescript
export function EmbedPageInner({
  // ... 기존 props ...
  serverFolder,
}: {
  // ... 기존 타입 ...
  serverFolder?: string | null;
}) {
```

folder state 추가:

```typescript
const [selectedFolder, setSelectedFolder] = useState<string | null>(serverFolder ?? null);
```

- [ ] **Step 3: FolderSection import 및 배치**

유사도 검색 Card 앞에 FolderSection 배치:

```tsx
import FolderSection from "@/components/admin/folder-section";

// ... JSX ...
<div className="space-y-6">
  {/* 폴더 */}
  {token && (
    <FolderSection
      token={token}
      user={effectiveUser}
      selectedFolder={selectedFolder}
      selectedIds={selectedIds}
      onFolderChange={(folder) => {
        setSelectedFolder(folder);
        // page=1, 필터 초기화, per_page/전체·내카테고리 유지
        const params = new URLSearchParams();
        if (folder) params.set("folder", folder);
        if (perPage !== 20) params.set("per_page", String(perPage));
        if (activeFilterSelection) params.set("filter", activeFilterSelection);
        router.replace(`/embed${params.toString() ? "?" + params.toString() : ""}`, { scroll: false });
        // 카테고리 목록 리로드
        loadCategories(1, perPage, effectiveFilter, undefined, folder ?? undefined);
      }}
      onFolderActionComplete={() => {
        loadCategories(page, perPage, effectiveFilter, keywordRef.current, selectedFolder ?? undefined);
      }}
    />
  )}

  {/* 유사도 검색 */}
  <Card>
    // ...
  </Card>
```

- [ ] **Step 4: loadCategories 호출부에 folder 전달**

`embed-page-inner.tsx`의 모든 `loadCategories()` 호출에 `selectedFolder` 전달:

```typescript
loadCategories(page, perPage, effectiveFilter, keyword, selectedFolder ?? undefined);
```

- [ ] **Step 5: handleSearch에 folder 전달**

`handleSearch()` 내 `recommend()` 호출에 folder 전달:

```typescript
const data = await recommend(searchText, searchLangRef.current, token, currentPage, perPageRef.current, filterRef.current ?? undefined, keyword ?? (keywordRef.current || undefined), selectedFolder ?? undefined);
```

- [ ] **Step 6: updateURL에 folder 포함**

`updateURL()` 함수에 folder 처리 추가:

```typescript
if ("folder" in overrides) {
  if (overrides.folder) params.set("folder", overrides.folder);
  else params.delete("folder");
}
```

- [ ] **Step 7: tsc 확인**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: EXIT=0

- [ ] **Step 8: Commit**

```bash
git add nextjs/app/embed/page.tsx nextjs/app/embed/embed-page-inner.tsx
git commit -m "feat: SSR·CSR 폴더 상태 동기화 및 FolderSection 통합"
```

---

## Task 8: 기존 컴포넌트 folder 전달

**Files:**
- Modify: `nextjs/hooks/useCategories.ts`
- Modify: `nextjs/components/admin/task-execution.tsx`
- Modify: `nextjs/components/admin/category-delete.tsx`
- Modify: `nextjs/components/admin/category-download.tsx`
- Modify: `nextjs/components/bulk-upload.tsx`

- [ ] **Step 1: useCategories에 folder 파라미터 추가**

`nextjs/hooks/useCategories.ts` — `loadCategories` 시그니처 변경:

```typescript
loadCategories: (page?: number, perPage?: number, filter?: string, search?: string, folder?: string) => Promise<void>;
```

구현부에서 `getCategories()` 호출에 folder 전달:

```typescript
const data = await getCategories(token, page ?? currentPage.current, perPage ?? currentPerPage.current, filter, search ?? currentSearch.current, folder);
```

- [ ] **Step 2: TaskExecution에 folder prop 추가**

`nextjs/components/admin/task-execution.tsx` — props에 folder 추가:

```typescript
interface TaskExecutionProps {
  // ... 기존 ...
  folder?: string;
}
```

`handleFullProcess()`의 `getCategories()` 호출에 folder 전달:

```typescript
const res = await getCategories(token, 1, 100000, filter, keyword, folder);
```

- [ ] **Step 3: CategoryDelete에 folder prop 추가**

`nextjs/components/admin/category-delete.tsx` — 동일한 패턴:

```typescript
interface CategoryDeleteProps {
  // ... 기존 ...
  folder?: string;
}
```

`handleFullDelete()`의 `getCategories()` 호출에 folder 전달:

```typescript
const res = await getCategories(token, 1, 100000, filter, keyword, folder);
```

- [ ] **Step 4: CategoryDownload에 folder prop 추가**

`nextjs/components/admin/category-download.tsx` — 동일한 패턴:

```typescript
interface CategoryDownloadProps {
  // ... 기존 ...
  folder?: string;
}
```

`handleFullDownload()`의 `getCategories()` 호출에 folder 전달:

```typescript
const res = await getCategories(token, 1, 100000, filter, keyword, folder);
```

- [ ] **Step 5: BulkUpload에 folder prop 추가**

`nextjs/components/bulk-upload.tsx` — props에 folder 추가:

```typescript
interface BulkUploadProps {
  token?: string | null;
  onSuccess: () => void;
  folder?: string;
}
```

`handleUpload()`의 `createCategory()` 호출에 folder 전달:

```typescript
await createCategory(nameKo, token, code, nameEn, nameZh, folder);
```

- [ ] **Step 6: embed-page-inner.tsx에서 folder prop 전달**

embed-page-inner.tsx의 각 컴포넌트 사용부에 `selectedFolder` 전달:

```tsx
<TaskExecution
  // ... 기존 props ...
  folder={selectedFolder ?? undefined}
/>

<CategoryDownload
  // ... 기존 props ...
  folder={selectedFolder ?? undefined}
/>

<CategoryDelete
  // ... 기존 props ...
  folder={selectedFolder ?? undefined}
/>

<BulkUpload
  token={token}
  folder={selectedFolder ?? undefined}
  onSuccess={() => { ... }}
/>
```

- [ ] **Step 7: tsc 확인**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: EXIT=0

- [ ] **Step 8: Commit**

```bash
git add nextjs/hooks/useCategories.ts nextjs/components/admin/task-execution.tsx nextjs/components/admin/category-delete.tsx nextjs/components/admin/category-download.tsx nextjs/components/bulk-upload.tsx nextjs/app/embed/embed-page-inner.tsx
git commit -m "feat: 기존 컴포넌트에 folder 범위 파라미터 전달"
```

---

## Task 9: Playwright 테스트 + run-all-checks.sh

**Files:**
- Test: Playwright 브라우저 테스트

- [ ] **Step 1: 개발 서버 확인**

```bash
docker compose ps
```

Expected: nextjs, laravel 컨테이너 실행 중

- [ ] **Step 2: Playwright로 폴더 UI 확인**

WSL2 호스트에서 `https://embed.cunlim.dev` 접속 후:
1. 로그인
2. 폴더 section이 유사도 검색 상단에 표시되는지 확인
3. 폴더 select에 "전체", "기본폴더" 옵션 확인
4. 새 폴더 추가 테스트
5. 카테고리를 폴더로 이동 테스트
6. 폴더 선택 시 URL에 `folder=` 파라미터 확인
7. 폴더 삭제 모달 테스트

- [ ] **Step 3: run-all-checks.sh 실행**

```bash
bash .claude/hooks/run-all-checks.sh
```

- [ ] **Step 4: 결과 확인**

```bash
cat .claude/hooks/test-results/*.txt
```

Expected: tsc, lint, test, pint 모두 EXIT=0

- [ ] **Step 5: 이슈 해결 (있다면)**

각 검사 결과에 따라 수정 후 재실행.

- [ ] **Step 6: 최종 Commit**

```bash
git add -A
git commit -m "fix: 폴더 기능 검증 이슈 해결"
```
