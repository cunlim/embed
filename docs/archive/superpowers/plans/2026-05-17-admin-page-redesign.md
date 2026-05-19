# Admin 페이지 재설계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin 페이지의 카테고리 리스트를 한국어 3컬럼으로 단순화하고, 카테고리 상세 모달에서 언어별 번역·임베딩을 관리하며, 개별/전체 실행 버튼과 WebSocket 실시간 진행을 제공한다.

**Architecture:** 백엔드에 새 GET 엔드포인트(`/api/categories/{id}/translations`)를 추가하고, 기존 translate-embed 엔드포인트에 steps 파라미터를 추가한다. 프론트엔드는 새 모달 컴포넌트(`CategoryModal`)와 훅(`useCategoryDetail`)으로 모달 상태를 관리하고, WebSocket으로 실시간 진행을 수신한다.

**Tech Stack:** Laravel 13 (PHP 8.5, Pest 4), Next.js 16 (React 19, TypeScript, Tailwind v4, shadcn/ui), Reverb WebSocket, Ollama

---

## Task 1: 백엔드 — CategoryResource에 translation_status 추가

**Files:**
- Modify: `laravel/app/Http/Resources/CategoryResource.php`
- Test: `laravel/tests/Feature/Api/CategoryControllerTest.php`

- [ ] **Step 1: CategoryResource에 status 로직 추가**

`laravel/app/Http/Resources/CategoryResource.php`:
```php
<?php

namespace App\Http\Resources;

use App\Models\CategoryEmbedding;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CategoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category_code' => $this->category_code,
            'category_name_ko' => $this->category_name_ko,
            'category_name_zh' => $this->category_name_zh,
            'category_name_en' => $this->category_name_en,
            'translation_status' => $this->translationStatus(),
        ];
    }

    private function translationStatus(): string
    {
        $hasZh = $this->category_name_zh !== null;
        $hasEn = $this->category_name_en !== null;
        $hasKoEmb = CategoryEmbedding::query()
            ->where('category_id', $this->id)->where('language', 'ko')->exists();
        $hasZhEmb = CategoryEmbedding::query()
            ->where('category_id', $this->id)->where('language', 'zh')->exists();
        $hasEnEmb = CategoryEmbedding::query()
            ->where('category_id', $this->id)->where('language', 'en')->exists();

        $allDone = $hasZh && $hasEn && $hasKoEmb && $hasZhEmb && $hasEnEmb;
        $noneDone = !$hasZh && !$hasEn && !$hasKoEmb && !$hasZhEmb && !$hasEnEmb;

        if ($allDone) return 'completed';
        if ($noneDone) return 'pending';
        return 'partial';
    }
}
```

- [ ] **Step 2: 기존 CategoryControllerTest가 통과하는지 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryControllerTest
```

**Expected:** 모든 기존 테스트 통과 (translation_status 필드가 추가되어도 기존 assertion은 data.* 속성 체크 방식이므로 무방)

- [ ] **Step 3: N+1 쿼리 문제 확인 및 해결**

`translationStatus()`에서 언어당 개별 쿼리(N+1)가 발생한다. `CategoryCollection`에서 Eager load하도록 수정:

`laravel/app/Http/Resources/CategoryResource.php`의 `translationStatus()`를 static 컨텍스트에서 동작하도록 수정하거나, `CategoryController::index()`에서 `Category::query()->with('embeddings')->get()`로 변경한다. Category 모델에 `embeddings()` 관계가 필요하면 추가.

`laravel/app/Models/Category.php`에 관계 추가:
```php
public function embeddings(): HasMany
{
    return $this->hasMany(CategoryEmbedding::class);
}
```

`laravel/app/Http/Controllers/Api/CategoryController.php`의 `index()`:
```php
public function index(): CategoryCollection
{
    return new CategoryCollection(Category::query()->with('embeddings')->get());
}
```

`translationStatus()` 수정:
```php
private function translationStatus(): string
{
    $hasZh = $this->category_name_zh !== null;
    $hasEn = $this->category_name_en !== null;

    $embeddings = $this->relationLoaded('embeddings')
        ? $this->embeddings->pluck('language')->toArray()
        : CategoryEmbedding::query()->where('category_id', $this->id)->pluck('language')->toArray();

    $hasKoEmb = in_array('ko', $embeddings);
    $hasZhEmb = in_array('zh', $embeddings);
    $hasEnEmb = in_array('en', $embeddings);

    $allDone = $hasZh && $hasEn && $hasKoEmb && $hasZhEmb && $hasEnEmb;
    $noneDone = !$hasZh && !$hasEn && !$hasKoEmb && !$hasZhEmb && !$hasEnEmb;

    if ($allDone) return 'completed';
    if ($noneDone) return 'pending';
    return 'partial';
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryControllerTest
```

- [ ] **Step 5: Pint 포맷팅**

```bash
docker exec cl_embed_laravel vendor/bin/pint --format agent
```

- [ ] **Step 6: Commit**

```bash
git add laravel/app/Http/Resources/CategoryResource.php laravel/app/Http/Controllers/Api/CategoryController.php laravel/app/Models/Category.php
git commit -m "feat(api): CategoryResource에 translation_status 필드 추가"
```

---

## Task 2: 백엔드 — 새 GET /api/categories/{id}/translations 엔드포인트

**Files:**
- Create: `laravel/app/Http/Resources/CategoryTranslationsResource.php`
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php`
- Modify: `laravel/routes/api.php`
- Create: `laravel/tests/Feature/Api/CategoryTranslationsTest.php`

- [ ] **Step 1: 테스트 작성**

`laravel/tests/Feature/Api/CategoryTranslationsTest.php`:
```php
<?php

use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Models\User;

beforeEach(function () {
    $this->user = User::factory()->create();
});

test('GET /api/categories/{id}/translations returns translations and embeddings', function () {
    $category = Category::factory()->create([
        'category_name_ko' => '테스트>카테고리',
        'category_name_zh' => '测试>类别',
        'category_name_en' => 'Test>Category',
    ]);

    $embedding = [0.022, -0.056, 0.091, 0.003, -0.018];

    CategoryEmbedding::factory()->create([
        'category_id' => $category->id,
        'language' => 'ko',
        'embedding' => $embedding,
        'embed_model_name' => 'bge-m3:latest',
    ]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->getJson("/api/categories/{$category->id}/translations");

    $response->assertOk()
        ->assertJsonPath('data.id', $category->id)
        ->assertJsonPath('data.category_code', $category->category_code)
        ->assertJsonPath('data.languages.ko.translation_text', '테스트>카테고리')
        ->assertJsonPath('data.languages.ko.embedding.status', 'completed')
        ->assertJsonPath('data.languages.ko.embedding.preview', array_slice($embedding, 0, 5))
        ->assertJsonPath('data.languages.en.translation_text', 'Test>Category')
        ->assertJsonPath('data.languages.en.embedding.status', 'pending')
        ->assertJsonPath('data.languages.zh.translation_text', '测试>类别')
        ->assertJsonPath('data.languages.zh.embedding.status', 'pending');
});

test('GET /api/categories/{id}/translations returns 401 without auth', function () {
    $category = Category::factory()->create();

    $response = $this->getJson("/api/categories/{$category->id}/translations");

    $response->assertUnauthorized();
});

test('GET /api/categories/{id}/translations returns 404 for missing category', function () {
    $response = $this->actingAs($this->user, 'sanctum')
        ->getJson('/api/categories/99999/translations');

    $response->assertNotFound();
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryTranslationsTest
```

**Expected:** FAIL — route not found (404)

- [ ] **Step 3: CategoryTranslationsResource 생성**

`laravel/app/Http/Resources/CategoryTranslationsResource.php`:
```php
<?php

namespace App\Http\Resources;

use App\Models\CategoryEmbedding;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CategoryTranslationsResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category_code' => $this->category_code,
            'category_name_ko' => $this->category_name_ko,
            'embedding_dimensions' => $this->embeddingDimensions(),
            'languages' => [
                'ko' => $this->languageData('ko', false),
                'en' => $this->languageData('en', true),
                'zh' => $this->languageData('zh', true),
            ],
        ];
    }

    private function languageData(string $lang, bool $needsTranslation): array
    {
        $translationText = $needsTranslation
            ? $this->{'category_name_'.$lang}
            : $this->category_name_ko;

        return [
            'translation_text' => $translationText,
            'embedding' => $this->embeddingData($lang),
        ];
    }

    private function embeddingData(string $lang): array
    {
        $emb = CategoryEmbedding::query()
            ->where('category_id', $this->id)
            ->where('language', $lang)
            ->first();

        if (!$emb || !$emb->embedding) {
            return ['status' => 'pending', 'preview' => null];
        }

        $vector = json_decode($emb->embedding, true);

        return [
            'status' => 'completed',
            'preview' => array_slice($vector, 0, 5),
        ];
    }

    private function embeddingDimensions(): ?int
    {
        $emb = CategoryEmbedding::query()
            ->where('category_id', $this->id)
            ->whereNotNull('embedding')
            ->first();

        if (!$emb || !$emb->embedding) {
            return null;
        }

        return count(json_decode($emb->embedding, true));
    }
}
```

- [ ] **Step 4: 라우트 추가**

`laravel/routes/api.php`:
```php
Route::middleware('auth:sanctum')->group(function () {
    // ... 기존 라우트 ...
    Route::get('categories/{category}/translations', [CategoryController::class, 'translations']);
});
```

- [ ] **Step 5: 컨트롤러 메서드 추가**

`laravel/app/Http/Controllers/Api/CategoryController.php`에 추가:
```php
use App\Http\Resources\CategoryTranslationsResource;

public function translations(Category $category): CategoryTranslationsResource
{
    return new CategoryTranslationsResource($category);
}
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryTranslationsTest
```

- [ ] **Step 7: Pint 포맷팅 + Commit**

```bash
docker exec cl_embed_laravel vendor/bin/pint --format agent
git add laravel/app/Http/Resources/CategoryTranslationsResource.php laravel/app/Http/Controllers/Api/CategoryController.php laravel/routes/api.php laravel/tests/Feature/Api/CategoryTranslationsTest.php
git commit -m "feat(api): GET /api/categories/{id}/translations 엔드포인트 추가"
```

---

## Task 3: 백엔드 — translate-embed 엔드포인트에 steps 파라미터 추가

**Files:**
- Modify: `laravel/app/Jobs/CategoryTranslateEmbedPipeline.php`
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php`
- Modify: `laravel/tests/Feature/Jobs/CategoryTranslateEmbedPipelineTest.php`

- [ ] **Step 1: 테스트 먼저 확인 (기존 테스트 통과 확인)**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryTranslateEmbedPipelineTest
```

- [ ] **Step 2: Pipeline에 $steps 파라미터 추가**

`laravel/app/Jobs/CategoryTranslateEmbedPipeline.php` 수정:

```php
public function __construct(
    private int $categoryId,
    private ?array $onlySteps = null, // null → 전체 실행
) {}
```

그리고 `$steps` 배열 정의 후 필터링 로직 추가:

```php
$allSteps = [
    ['step' => 1, 'name' => 'translation.zh', 'language' => 'zh', 'type' => 'translation'],
    ['step' => 2, 'name' => 'translation.en', 'language' => 'en', 'type' => 'translation'],
    ['step' => 3, 'name' => 'embedding.ko', 'language' => 'ko', 'type' => 'embedding'],
    ['step' => 4, 'name' => 'embedding.zh', 'language' => 'zh', 'type' => 'embedding'],
    ['step' => 5, 'name' => 'embedding.en', 'language' => 'en', 'type' => 'embedding'],
];

$steps = $this->onlySteps !== null
    ? array_values(array_filter($allSteps, fn($s) => in_array($s['name'], $this->onlySteps)))
    : $allSteps;
```

- [ ] **Step 3: Controller에서 steps 파라미터 전달**

`laravel/app/Http/Controllers/Api/CategoryController.php`의 `translateEmbed()` 수정:

```php
public function translateEmbed(Category $category): JsonResponse
{
    $steps = request()->input('steps'); // null 또는 string[]

    CategoryTranslateEmbedPipeline::dispatch($category->id, $steps);

    return response()->json([
        'message' => '카테고리 번역·임베딩이 시작되었습니다.',
        'category_id' => $category->id,
    ], 202);
}
```

- [ ] **Step 4: 기존 + 새 테스트 통과 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryTranslateEmbedPipelineTest
```

- [ ] **Step 5: Pint + Commit**

```bash
docker exec cl_embed_laravel vendor/bin/pint --format agent
git add laravel/app/Jobs/CategoryTranslateEmbedPipeline.php laravel/app/Http/Controllers/Api/CategoryController.php
git commit -m "feat(api): translate-embed 엔드포인트에 steps 파라미터 추가"
```

---

## Task 4: WebSocket 디버깅 및 수정

**Files:**
- Modify: `laravel/app/Events/CategoryProgress.php` (확인)
- Modify: `laravel/.env` REVERB_APP_KEY 확인
- Modify: `nextjs/.env.local` NEXT_PUBLIC_REVERB_APP_KEY 확인

- [ ] **Step 1: Reverb 설정 불일치 확인**

```bash
docker exec cl_embed_laravel grep REVERB_APP_KEY /var/www/html/.env
grep NEXT_PUBLIC_REVERB /var/app/www/cl_embed/nextjs/.env.local
```

두 값이 동일해야 한다. 다르면 `.env.local`을 수정.

- [ ] **Step 2: CategoryProgress 이벤트 확인**

`laravel/app/Events/CategoryProgress.php`가 `ShouldBroadcast`를 구현하는지, `broadcastOn()`이 올바른 채널(`category.{categoryId}`)을 반환하는지 확인.

```php
public function broadcastOn(): array
{
    return [new Channel("category.{$this->categoryId}")];
}
```

- [ ] **Step 3: Reverb queue worker 로그 확인**

```bash
docker exec cl_embed_laravel supervisorctl tail -500 reverb
```

- [ ] **Step 4: 실제 WebSocket 테스트**

프론트엔드에서 `useEcho`의 디버그 로그를 활성화하여 채널 구독 성공 여부 확인.

`nextjs/lib/echo.ts`:
```typescript
echo.connector.pusher.connection.bind('connected', () => {
  console.log('[Echo] connected');
});
```

- [ ] **Step 5: 이슈 발견 시 수정 후 Commit**

```bash
git add nextjs/.env.local
git commit -m "fix(websocket): Reverb 앱 키 불일치 수정"
```

---

## Task 5: 프론트엔드 — api.ts에 새 타입과 함수 추가

**Files:**
- Modify: `nextjs/lib/api.ts`
- Create: `nextjs/lib/__tests__/api.test.ts` (기존 파일에 테스트 추가)

- [ ] **Step 1: 타입 및 함수 추가**

`nextjs/lib/api.ts`에 추가:

```typescript
// --- 카테고리 상세 (번역·임베딩 상태) ---

export type EmbeddingStatus = "completed" | "pending" | "failed" | "running";

export interface LanguageDetail {
  translation_text: string | null;
  embedding: {
    status: EmbeddingStatus;
    preview: number[] | null;
  };
}

export interface CategoryTranslations {
  id: number;
  category_code: string;
  category_name_ko: string;
  embedding_dimensions: number | null;
  languages: {
    ko: LanguageDetail;
    en: LanguageDetail;
    zh: LanguageDetail;
  };
}

export interface CategoryTranslationsResponse {
  data: CategoryTranslations;
}

export function fetchCategoryTranslations(
  categoryId: number,
  token?: string | null
): Promise<CategoryTranslationsResponse> {
  return request<CategoryTranslationsResponse>(
    `/categories/${categoryId}/translations`,
    { token }
  );
}

// translateEmbedCategory에 steps 파라미터 추가
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

// Category 타입에 translation_status 추가
export interface Category {
  id: number;
  category_code: string;
  category_name_ko: string;
  category_name_zh: string | null;
  category_name_en: string | null;
  translation_status: "completed" | "partial" | "pending";
}
```

- [ ] **Step 2: 테스트 작성 (기존 api.test.ts 확인 후 추가)**

`nextjs/lib/__tests__/api.test.ts`에 추가:
```typescript
import { fetchCategoryTranslations, translateEmbedCategory } from "@/lib/api";

describe("fetchCategoryTranslations", () => {
  it("returns category translations with correct structure", async () => {
    const mockData: CategoryTranslationsResponse = {
      data: {
        id: 1,
        category_code: "TEST",
        category_name_ko: "테스트",
        embedding_dimensions: 1024,
        languages: {
          ko: { translation_text: "테스트", embedding: { status: "completed", preview: [0.1, 0.2, 0.3, 0.4, 0.5] } },
          en: { translation_text: null, embedding: { status: "pending", preview: null } },
          zh: { translation_text: null, embedding: { status: "pending", preview: null } },
        },
      },
    };
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });

    const result = await fetchCategoryTranslations(1);
    expect(result.data.languages.ko.embedding.status).toBe("completed");
  });
});
```

- [ ] **Step 3: 테스트 통과 확인**

```bash
docker exec cl_embed_nextjs npm test -- --run
```

- [ ] **Step 4: Commit**

```bash
git add nextjs/lib/api.ts nextjs/lib/__tests__/api.test.ts
git commit -m "feat(frontend): api.ts에 category translations 타입 및 함수 추가"
```

---

## Task 6: 프론트엔드 — useCategoryDetail 훅

**Files:**
- Create: `nextjs/hooks/useCategoryDetail.ts`
- Create: `nextjs/hooks/__tests__/useCategoryDetail.test.ts`

- [ ] **Step 1: 테스트 작성**

`nextjs/hooks/__tests__/useCategoryDetail.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCategoryDetail } from "@/hooks/useCategoryDetail";
import * as api from "@/lib/api";

vi.mock("@/lib/api");

describe("useCategoryDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockData: api.CategoryTranslationsResponse = {
    data: {
      id: 1,
      category_code: "TEST",
      category_name_ko: "테스트",
      embedding_dimensions: 1024,
      languages: {
        ko: { translation_text: "테스트", embedding: { status: "completed" as const, preview: [0.1, 0.2] } },
        en: { translation_text: null, embedding: { status: "pending" as const, preview: null } },
        zh: { translation_text: null, embedding: { status: "pending" as const, preview: null } },
      },
    },
  };

  it("fetches translations on mount", async () => {
    vi.mocked(api.fetchCategoryTranslations).mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useCategoryDetail(1, "token"));

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await vi.waitFor(() => !result.current.isLoading);
    });

    expect(result.current.data).toEqual(mockData.data);
    expect(vi.mocked(api.fetchCategoryTranslations)).toHaveBeenCalledWith(1, "token");
  });

  it("returns null when categoryId is null", () => {
    vi.mocked(api.fetchCategoryTranslations).mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useCategoryDetail(null, "token"));

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
docker exec cl_embed_nextjs npm test -- --run 2>&1 | tail -20
```

- [ ] **Step 3: 훅 구현**

`nextjs/hooks/useCategoryDetail.ts`:
```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import type { CategoryTranslations } from "@/lib/api";
import { fetchCategoryTranslations } from "@/lib/api";

export function useCategoryDetail(categoryId: number | null, token?: string | null) {
  const [data, setData] = useState<CategoryTranslations | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (categoryId === null) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchCategoryTranslations(categoryId, token);
      setData(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, [categoryId, token]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, isLoading, error, reload: load };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
docker exec cl_embed_nextjs npm test -- --run
```

- [ ] **Step 5: Commit**

```bash
git add nextjs/hooks/useCategoryDetail.ts nextjs/hooks/__tests__/useCategoryDetail.test.ts
git commit -m "feat(frontend): useCategoryDetail 훅 추가"
```

---

## Task 7: 프론트엔드 — CategoryModal 컴포넌트

**Files:**
- Create: `nextjs/components/admin/category-modal.tsx`
- Modify: `nextjs/components/admin/__tests__/category-modal.test.tsx` (신규)

- [ ] **Step 1: 컴포넌트 구현**

`nextjs/components/admin/category-modal.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Eye, Copy, Check, Loader2, XCircle, Circle, Play, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryTranslations, LanguageDetail } from "@/lib/api";
import { translateEmbedCategory } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CategoryTranslations | null;
  isLoading: boolean;
  error: string | null;
  token?: string | null;
}

type StepName = "translation.zh" | "translation.en" | "embedding.ko" | "embedding.zh" | "embedding.en";

const LANGUAGES: { key: "ko" | "en" | "zh"; label: string; hasTranslation: boolean }[] = [
  { key: "ko", label: "한국어 (ko)", hasTranslation: false },
  { key: "en", label: "영어 (en)", hasTranslation: true },
  { key: "zh", label: "중국어 (zh)", hasTranslation: true },
];

function statusBadge(status: string) {
  switch (status) {
    case "completed": return <Badge variant="outline" className="text-green-600 border-green-600 gap-1"><Check className="size-3" />완료</Badge>;
    case "running": return <Badge variant="outline" className="text-blue-600 border-blue-600 gap-1"><Loader2 className="size-3 animate-spin" />진행중</Badge>;
    case "failed": return <Badge variant="outline" className="text-red-600 border-red-600 gap-1"><XCircle className="size-3" />실패</Badge>;
    default: return <Badge variant="outline" className="text-muted-foreground gap-1"><Circle className="size-3" />대기</Badge>;
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

export default function CategoryModal({ open, onOpenChange, data, isLoading, error, token }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({ ko: true, en: true, zh: true });
  const [running, setRunning] = useState<Set<string>>(new Set());

  const handleSingleAction = async (stepName: StepName) => {
    if (!data) return;
    setRunning((prev) => new Set(prev).add(stepName));
    try {
      await translateEmbedCategory(data.id, token, [stepName]);
    } finally {
      setRunning((prev) => {
        const next = new Set(prev);
        next.delete(stepName);
        return next;
      });
    }
  };

  const handleRunAll = async () => {
    if (!data) return;
    const steps: StepName[] = [];
    for (const lang of LANGUAGES) {
      if (!checked[lang.key]) continue;
      if (lang.hasTranslation) {
        const tl = data.languages[lang.key];
        if (!tl.translation_text) steps.push(`translation.${lang.key}` as StepName);
        if (tl.embedding.status !== "completed") steps.push(`embedding.${lang.key}` as StepName);
      } else {
        if (data.languages.ko.embedding.status !== "completed") steps.push("embedding.ko" as StepName);
      }
    }

    if (steps.length === 0) return;
    setRunning(new Set(steps));
    try {
      await translateEmbedCategory(data.id, token, steps);
    } finally {
      setRunning(new Set());
    }
  };

  const renderRow = (label: string, value: string | null, actionLabel: string, stepName: StepName | null) => {
    const isRunning = stepName && running.has(stepName);
    const hasValue = value !== null;

    return (
      <div className="grid grid-cols-[80px_1fr_40px] gap-3 items-center py-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm truncate font-mono">
          {value ?? (isRunning ? <Loader2 className="size-3 animate-spin inline" /> : <span className="text-muted-foreground italic">처리전</span>)}
        </span>
        <div>
          {isRunning ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : hasValue ? (
            <Button variant="ghost" size="icon-sm" onClick={() => copyToClipboard(value!)} title="복사">
              <Copy className="size-3" />
            </Button>
          ) : stepName ? (
            <Button variant="ghost" size="icon-sm" onClick={() => handleSingleAction(stepName)} title={actionLabel}>
              <Play className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>카테고리 상세</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {data ? `코드: ${data.category_code}` : <Skeleton className="h-4 w-24" />}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-500 py-4">
            <AlertCircle className="size-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {data && !isLoading && (
          <div className="space-y-2 py-2">
            {LANGUAGES.map((lang, i) => {
              const detail = data.languages[lang.key];
              const embStatus = detail.embedding.status;
              const tlStatus = detail.translation_text ? "completed" : "pending";
              const overallStatus = lang.hasTranslation
                ? (tlStatus === "completed" && embStatus === "completed" ? "completed"
                  : tlStatus === "pending" && embStatus === "pending" ? "pending"
                  : embStatus === "failed" || embStatus === "failed" ? "failed"
                  : "partial")
                : embStatus;

              return (
                <div key={lang.key}>
                  {i > 0 && <Separator className="my-2" />}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={checked[lang.key]}
                        onCheckedChange={(v) => setChecked((prev) => ({ ...prev, [lang.key]: !!v }))}
                      />
                      <span className="text-sm font-medium">{lang.label}</span>
                    </div>
                    {statusBadge(overallStatus)}
                  </div>
                  <div className="pl-7 space-y-0.5">
                    {lang.hasTranslation
                      ? renderRow("번역", detail.translation_text, "번역 실행", `translation.${lang.key}` as StepName)
                      : renderRow("원본", detail.translation_text, "", null)
                    }
                    {renderRow("임베딩",
                      detail.embedding.preview ? `[${detail.embedding.preview.join(", ")}]…` : null,
                      "임베딩 실행",
                      `embedding.${lang.key}` as StepName
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleRunAll} disabled={running.size > 0}>
            {running.size > 0 ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            전체 실행
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: 컴포넌트 빌드 확인 (타입 체크)**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add nextjs/components/admin/category-modal.tsx
git commit -m "feat(frontend): CategoryModal 컴포넌트 추가"
```

---

## Task 8: 프론트엔드 — useCategoryProgress 수정 (자동 실행 제거)

**Files:**
- Modify: `nextjs/hooks/useCategoryProgress.ts`

- [ ] **Step 1: 자동 실행 로직 분리**

현재 `startTranslation`은 API 호출 + WebSocket 구독을 동시에 수행한다. 모달에서는 View 버튼 클릭 시 구독만 먼저 하고, 실행 버튼 클릭 시 API 호출을 하도록 분리.

`nextjs/hooks/useCategoryProgress.ts`에 `subscribeProgress` 함수 추가 (API 호출 없이 WebSocket만 구독):

```typescript
const subscribeProgress = useCallback((categoryId: number, echo: ReverbEcho) => {
  const channelName = `category.${categoryId}`;
  const ref = channelRef as { current: string | null };
  ref.current = channelName;

  setIsRunning(true);
  categoryIdRef.current = categoryId;

  echo.channel(channelName)
    .listen(".category.progress", (data: CategoryProgress) => {
      setProgress(data);
    })
    .listen(".category.completed", (data: CategoryPipelineCompleted) => {
      setIsRunning(false);
      setProgress(null);
    });
}, []);
```

`startTranslation`은 API 호출만 담당하고, WebSocket 구독은 별도로 `subscribeProgress`를 통해 한다.

- [ ] **Step 2: 기존 테스트 통과 확인**

```bash
docker exec cl_embed_nextjs npm test -- --run
```

- [ ] **Step 3: Commit**

```bash
git add nextjs/hooks/useCategoryProgress.ts
git commit -m "refactor(frontend): useCategoryProgress API 호출과 WebSocket 구독 분리"
```

---

## Task 9: 프론트엔드 — Admin 페이지 테이블 재설계

**Files:**
- Modify: `nextjs/app/admin/page.tsx`
- Modify: `nextjs/app/admin/__tests__/page.test.tsx`

- [ ] **Step 1: page.tsx에서 기존 모달 관련 코드 제거, CategoryModal 통합**

주요 변경:
- `useCategoryProgress` import 제거 또는 유지 (모달에서 사용)
- Play 버튼 → View 버튼 (`Eye` 아이콘) + 클릭 시 모달 오픈만
- `handleStartTranslation` → `handleOpenModal`
- 테이블 컬럼: 한국어 카테고리명 | 상태 아이콘 | 보기 버튼
- 모달 상태: `modalCategoryId` state로 관리
- `useCategoryDetail(modalCategoryId, token)` 호출

`nextjs/app/admin/page.tsx` 핵심 변경부:

```tsx
"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Eye, CheckCircle2, AlertTriangle, Minus, Plus, Database, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryDetail } from "@/hooks/useCategoryDetail";
import { isAdmin, getToken } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import CategoryModal from "@/components/admin/category-modal";

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed": return <CheckCircle2 className="size-4 text-green-500" />;
    case "partial": return <AlertTriangle className="size-4 text-yellow-500" />;
    default: return <Minus className="size-4 text-muted-foreground" />;
  }
}

export default function AdminPage() {
  // ... auth guard (기존 코드 유지) ...
  const [modalCategoryId, setModalCategoryId] = useState<number | null>(null);

  const { data: detailData, isLoading: detailLoading, error: detailError } = useCategoryDetail(modalCategoryId, token);

  // ... category list, add category (기존 useCategories 사용) ...

  return (
    <>
      {/* ... 기존 레이아웃 ... */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>한국어 카테고리</TableHead>
            <TableHead className="w-[100px]">상태</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((cat) => (
            <TableRow key={cat.id}>
              <TableCell className="font-medium">{cat.category_name_ko}</TableCell>
              <TableCell><StatusIcon status={cat.translation_status} /></TableCell>
              <TableCell>
                <Button variant="ghost" size="icon-sm" onClick={() => setModalCategoryId(cat.id)}>
                  <Eye className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CategoryModal
        open={modalCategoryId !== null}
        onOpenChange={(open) => { if (!open) setModalCategoryId(null); }}
        data={detailData}
        isLoading={detailLoading}
        error={detailError}
        token={token}
      />
    </>
  );
}
```

- [ ] **Step 2: 테스트 업데이트**

`nextjs/app/admin/__tests__/page.test.tsx` 수정 — 기존 Play 버튼 테스트를 View 버튼으로 변경.

- [ ] **Step 3: 빌드 확인**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
docker exec cl_embed_nextjs npm test -- --run
```

- [ ] **Step 5: Commit**

```bash
git add nextjs/app/admin/page.tsx nextjs/app/admin/__tests__/page.test.tsx
git commit -m "feat(frontend): admin 페이지 테이블 재설계 및 CategoryModal 통합"
```

---

## Task 10: Playwright E2E 테스트

**Files:**
- Create: `nextjs/e2e/admin-page.spec.ts`

- [ ] **Step 1: Playwright 테스트 작성**

`nextjs/e2e/admin-page.spec.ts`:
```typescript
import { test, expect } from "@playwright/test";

const ADMIN_TOKEN = process.env.ADMIN_TEST_TOKEN || "";

test.describe("Admin Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("https://embed.cunlim.dev/admin");
    await page.evaluate((token) => {
      localStorage.setItem("auth_token", token);
    }, ADMIN_TOKEN);
    await page.reload();
    await page.waitForSelector("table");
  });

  test("renders table with Korean names and status icons", async ({ page }) => {
    await expect(page.locator("table tbody tr").first()).toBeVisible();
    // 상태 아이콘 확인
    await expect(page.locator("table tbody tr td:nth-child(2) svg").first()).toBeVisible();
    // 보기 버튼 확인
    await expect(page.getByRole("button").first()).toBeVisible();
  });

  test("opens modal on view button click", async ({ page }) => {
    await page.locator("table tbody tr:first-child button").first().click();
    await expect(page.getByText("카테고리 상세")).toBeVisible();
    await expect(page.getByText("코드:")).toBeVisible();
  });

  test("modal shows language sections", async ({ page }) => {
    await page.locator("table tbody tr:first-child button").first().click();
    await expect(page.getByText("한국어 (ko)")).toBeVisible();
    await expect(page.getByText("영어 (en)")).toBeVisible();
    await expect(page.getByText("중국어 (zh)")).toBeVisible();
  });

  test("copy button copies text", async ({ page }) => {
    await page.locator("table tbody tr:first-child button").first().click();
    const copyBtn = page.locator("[title=복사]").first();
    if (await copyBtn.isVisible()) {
      await copyBtn.click();
    }
  });

  test("closes modal", async ({ page }) => {
    await page.locator("table tbody tr:first-child button").first().click();
    await page.keyboard.press("Escape");
    await expect(page.getByText("카테고리 상세")).not.toBeVisible();
  });
});
```

- [ ] **Step 2: Playwright 실행**

```bash
npx playwright test nextjs/e2e/admin-page.spec.ts --reporter=list
```

- [ ] **Step 3: 실패 시 디버깅 및 수정**

- [ ] **Step 4: Commit**

```bash
git add nextjs/e2e/admin-page.spec.ts
git commit -m "test(e2e): admin 페이지 Playwright E2E 테스트 추가"
```

---

## Task 11: Swagger 문서 갱신

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php` (OA annotations)

- [ ] **Step 1: 새 엔드포인트에 OA 어노테이션 추가**

`translations()` 메서드에 `#[OA\Get]` 어노테이션 추가

- [ ] **Step 2: Swagger 문서 생성**

```bash
docker exec cl_embed_laravel php artisan l5-swagger:generate
```

- [ ] **Step 3: Commit**

```bash
git add laravel/app/Http/Controllers/Api/CategoryController.php
git commit -m "docs(swagger): GET /api/categories/{id}/translations Swagger 문서 추가"
```

---

## Task 12: 최종 통합 테스트

- [ ] **Step 1: 모든 테스트 실행**

```bash
docker exec cl_embed_laravel php artisan test --compact
docker exec cl_embed_nextjs npm test -- --run
```

- [ ] **Step 2: 실패 테스트 수정**

- [ ] **Step 3: Pint 포맷팅**

```bash
docker exec cl_embed_laravel vendor/bin/pint --format agent
```

- [ ] **Step 4: 최종 Commit**

```bash
git add -A
git commit -m "chore: 최종 통합 테스트 통과 확인 및 수정"
```
