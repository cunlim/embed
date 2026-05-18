# WebSocket 제거 및 HTTP API 전환 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all WebSocket (Reverb/Event/Job) + Queue/Batch 시스템을 단순 HTTP 동기 API + 프론트 for 루프로 대체

**Architecture:** 기존 6개 ShouldBroadcast 이벤트 + 3개 Job 파일을 전부 제거하고, `POST /api/categories/{category}/run-step` 하나의 동기 엔드포인트로 대체. 프론트에서 `Promise.all`(단일 카테고리 step 병렬)과 직렬 for 루프(여러 카테고리)로 직접 처리.

**Tech Stack:** Laravel 13 + PHP 8.5 (Pest 4), Next.js 16 + React 19 (Vitest), Playwright

---

### Task 1: run-step 컨트롤러 메서드 생성 (Laravel)

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php`
- Modify: `laravel/routes/api.php`
- Create: `laravel/app/Http/Requests/RunStepRequest.php`
- Test: `laravel/tests/Feature/RunStepApiTest.php`

- [ ] **Step 1: RunStepRequest FormRequest 생성**

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RunStepRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'step' => ['required', 'string', 'in:translation.zh,translation.en,embedding.ko,embedding.zh,embedding.en'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'step.in' => '유효하지 않은 step입니다. (translation.zh, translation.en, embedding.ko, embedding.zh, embedding.en 중 하나)',
        ];
    }
}
```

- [ ] **Step 2: runStep 컨트롤러 메서드 추가**

`CategoryController`에 `runStep(Request, Category)` 메서드 추가:

```php
use App\Http\Requests\RunStepRequest;
use App\Models\CategoryEmbedding;
use App\Services\EmbeddingGenerator;
use App\Services\OllamaTranslator;
use RuntimeException;

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

            return response()->json([
                'step' => $step,
                'status' => 'completed',
                'result' => $translated,
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
            ['embedding' => $vector,]
        );

        return response()->json([
            'step' => $step,
            'status' => 'completed',
            'result' => json_encode(array_slice($vector, 0, 10)),
        ]);
    } catch (RuntimeException $e) {
        $errorMsg = $e->getMessage();
        if (str_contains($errorMsg, 'Ollama rate limit exceeded')) {
            $errorMsg = 'Ollama rate limit exceeded';
        }

        return response()->json([
            'step' => $step,
            'status' => 'failed',
            'error' => $errorMsg,
        ], 500);
    }
}
```

- [ ] **Step 3: 라우트 등록 (`routes/api.php`)**

`Route::post('categories/{category}/translate-embed/cancel', ...)` 라인 제거하고 아래 추가:

```php
Route::post('categories/{category}/run-step', [CategoryController::class, 'runStep'])->middleware('auth:sanctum');
```

이전 엔드포인트들 제거:

```php
// 제거:
// Route::post('categories/batch-translate', ...);
// Route::post('categories/{category}/translate-embed', ...);
// Route::post('categories/{category}/translate-embed/cancel', ...);
```

- [ ] **Step 4: 기존 컨트롤러 메서드 제거**

`CategoryController`에서 다음 메서드들을 제거:
- `batchTranslate()`
- `translateEmbed()`
- `cancelTranslateEmbed()`

- [ ] **Step 5: 라우트에 있는 기존 batch-translate/translate-embed 라인 정리 후 route.php 확인**

```bash
docker exec cl_embed_laravel cat routes/api.php
```

- `POST /api/categories/batch-translate` 제거됨
- `POST /api/categories/{category}/translate-embed` 제거됨
- `POST /api/categories/{category}/translate-embed/cancel` 제거됨
- `POST /api/categories/{category}/run-step` 추가됨

- [ ] **Step 6: runStep Pest 테스트 작성**

`laravel/tests/Feature/RunStepApiTest.php`:

```php
<?php

use App\Models\Category;
use App\Models\User;
use App\Services\EmbeddingGenerator;
use App\Services\OllamaTranslator;
use RuntimeException;

test('POST /api/categories/{category}/run-step — 인증 없이 401을 반환한다', function () {
    $category = Category::factory()->create();

    $response = $this->postJson("/api/categories/{$category->id}/run-step", [
        'step' => 'translation.zh',
    ]);

    $response->assertUnauthorized();
});

test('POST /api/categories/{category}/run-step — 유효하지 않은 step은 422를 반환한다', function () {
    $user = User::factory()->create();
    $category = Category::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson("/api/categories/{$category->id}/run-step", [
        'step' => 'invalid.step',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['step']);
});

test('POST /api/categories/{category}/run-step — translation.zh가 정상 동작한다', function () {
    $translator = mock(OllamaTranslator::class);
    $translator->shouldReceive('translate')
        ->once()
        ->with('테스트 카테고리', 'zh')
        ->andReturn('测试分类');
    app()->instance(OllamaTranslator::class, $translator);

    $user = User::factory()->create();
    $category = Category::factory()->create(['category_name_ko' => '테스트 카테고리']);

    $response = $this->actingAs($user, 'sanctum')->postJson("/api/categories/{$category->id}/run-step", [
        'step' => 'translation.zh',
    ]);

    $response->assertOk()
        ->assertJson([
            'step' => 'translation.zh',
            'status' => 'completed',
        ]);
    expect($response->json('result'))->toBe('测试分类');

    // DB에 저장되었는지 확인
    $category->refresh();
    expect($category->category_name_zh)->toBe('测试分类');
});

test('POST /api/categories/{category}/run-step — embedding.ko가 정상 동작한다', function () {
    $embedder = mock(EmbeddingGenerator::class);
    $embedder->shouldReceive('generate')
        ->once()
        ->with('테스트 카테고리')
        ->andReturn(array_fill(0, 1024, 0.01));
    app()->instance(EmbeddingGenerator::class, $embedder);

    $user = User::factory()->create();
    $category = Category::factory()->create(['category_name_ko' => '테스트 카테고리']);

    $response = $this->actingAs($user, 'sanctum')->postJson("/api/categories/{$category->id}/run-step", [
        'step' => 'embedding.ko',
    ]);

    $response->assertOk()
        ->assertJson([
            'step' => 'embedding.ko',
            'status' => 'completed',
        ]);

    // DB에 저장되었는지 확인
    $this->assertDatabaseHas('category_embeddings', [
        'category_id' => $category->id,
        'language' => 'ko',
    ]);
});

test('POST /api/categories/{category}/run-step — 번역 없이 임베딩 실행 시 422를 반환한다', function () {
    $user = User::factory()->create();
    $category = Category::factory()->create(['category_name_ko' => '테스트']);

    $response = $this->actingAs($user, 'sanctum')->postJson("/api/categories/{$category->id}/run-step", [
        'step' => 'embedding.zh',
    ]);

    $response->assertStatus(422);
});

test('POST /api/categories/{category}/run-step — Ollama 실패 시 500과 failed 상태를 반환한다', function () {
    $translator = mock(OllamaTranslator::class);
    $translator->shouldReceive('translate')
        ->once()
        ->andThrow(new RuntimeException('Ollama rate limit exceeded'));
    app()->instance(OllamaTranslator::class, $translator);

    $user = User::factory()->create();
    $category = Category::factory()->create(['category_name_ko' => '테스트']);

    $response = $this->actingAs($user, 'sanctum')->postJson("/api/categories/{$category->id}/run-step", [
        'step' => 'translation.zh',
    ]);

    $response->assertStatus(500)
        ->assertJson([
            'step' => 'translation.zh',
            'status' => 'failed',
            'error' => 'Ollama rate limit exceeded',
        ]);
});
```

- [ ] **Step 7: 테스트 실행**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=RunStepApiTest
```
Expected: 모든 테스트 PASS

- [ ] **Step 8: 기존 CategoryApiTest에서 제거된 API 테스트 삭제**

`laravel/tests/Feature/CategoryApiTest.php` 에서 다음 테스트 제거:
- `POST /api/categories/batch-translate — 인증 없이 401을 반환한다`
- `POST /api/categories/batch-translate — 인증된 사용자는 202를 반환한다`
- `POST /api/categories/batch-translate — target_language가 없으면 422를 반환한다`
- `POST /api/categories/batch-translate — 지원하지 않는 언어면 422를 반환한다`

그리고 `use App\Jobs\BatchTranslatePipeline;` import도 제거.

- [ ] **Step 9: 테스트 스위트 실행**

```bash
docker exec cl_embed_laravel php artisan test --compact
```
Expected: 0 failure (제거된 Job/Event 테스트는 아직 존재해도 무방)

- [ ] **Step 10: Pint 포맷팅**

```bash
docker exec cl_embed_laravel vendor/bin/pint --format agent
```

- [ ] **Step 11: 커밋**

```bash
cd /var/app/www/cl_embed
git add laravel/app/Http/Controllers/Api/CategoryController.php \
       laravel/app/Http/Requests/RunStepRequest.php \
       laravel/routes/api.php \
       laravel/tests/Feature/RunStepApiTest.php \
       laravel/tests/Feature/CategoryApiTest.php
git commit -m "feat: run-step 동기 API 추가 (WebSocket/Job 대체)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Laravel 불필요 파일 정리 (Events, Jobs, config)

**Files:**
- Delete: `laravel/app/Events/` (6 files)
- Delete: `laravel/app/Jobs/` (3 files)
- Delete: `laravel/config/reverb.php`
- Delete: `laravel/routes/channels.php`
- Modify: `laravel/config/broadcasting.php`
- Modify: `laravel/composer.json`
- Create: `laravel/database/migrations/2026_05_18_000000_clear_translation_embedding_data.php`
- Delete: `laravel/tests/Feature/Events/` (6 files)
- Delete: `laravel/tests/Feature/Jobs/` (3 files)
- Delete: `laravel/tests/Feature/BatchTranslateTest.php` (batch-translate 테스트)

- [ ] **Step 1: Events 디렉토리 삭제**

```bash
docker exec cl_embed_laravel rm -rf app/Events
```

- [ ] **Step 2: Jobs 디렉토리 삭제**

```bash
docker exec cl_embed_laravel rm -rf app/Jobs
```

- [ ] **Step 3: config/reverb.php 삭제**

```bash
docker exec cl_embed_laravel rm -f config/reverb.php
```

- [ ] **Step 4: routes/channels.php 비우기 (또는 삭제)**

```bash
docker exec cl_embed_laravel rm -f routes/channels.php
```

- [ ] **Step 5: broadcasting.php 정리**

`laravel/config/broadcasting.php`에서 `connections.reverb` 섹션 제거. `default`는 `log`로 변경.

```php
'default' => env('BROADCAST_CONNECTION', 'log'),

'connections' => [
    'log' => [
        'driver' => 'log',
    ],
    'null' => [
        'driver' => 'null',
    ],
],
```

- [ ] **Step 6: composer.json에서 laravel/reverb 제거**

```bash
docker exec cl_embed_laravel composer remove laravel/reverb
```

- [ ] **Step 7: 데이터 정리 migration 생성**

`laravel/database/migrations/2026_05_18_000000_clear_translation_embedding_data.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('categories')->update([
            'category_name_zh' => null,
            'category_name_en' => null,
        ]);
        DB::table('category_embeddings')->truncate();
        DB::table('translation_caches')->truncate();
    }

    public function down(): void
    {
        // 되돌릴 데이터 없음
    }
};
```

- [ ] **Step 8: migration 실행**

```bash
docker exec cl_embed_laravel php artisan migrate --force
```

- [ ] **Step 9: Event/Job 테스트 파일 삭제**

```bash
rm -rf laravel/tests/Feature/Events laravel/tests/Feature/Jobs
```

- [ ] **Step 10: BatchTranslateTest 삭제**

```bash
rm -f laravel/tests/Feature/BatchTranslateTest.php
```

- [ ] **Step 11: 전체 테스트 실행**

```bash
docker exec cl_embed_laravel php artisan test --compact
```
Expected: 0 failure

- [ ] **Step 12: Pint 포맷팅**

```bash
docker exec cl_embed_laravel vendor/bin/pint --format agent
```

- [ ] **Step 13: 커밋**

```bash
cd /var/app/www/cl_embed
git add -A
git commit -m "refactor: Events/Jobs/Reverb 제거, 데이터 정리 migration

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Admin 모달 HTTP 전환 (Next.js)

**Files:**
- Modify: `nextjs/components/admin/category-modal.tsx`
- Delete: `nextjs/hooks/useEcho.ts`
- Delete: `nextjs/hooks/useCategoryProgress.ts`
- Delete: `nextjs/hooks/useBatchProgress.ts`
- Delete: `nextjs/lib/echo.ts`
- Delete: `nextjs/global.d.ts`
- Modify: `nextjs/package.json` (패키지 제거)
- Delete: `nextjs/hooks/__tests__/useCategoryProgress.test.ts`
- Modify: `nextjs/components/admin/__tests__/category-modal.test.tsx`
- Modify: `nextjs/app/admin/__tests__/page.test.tsx`

- [ ] **Step 1: 불필요 라이브러리 제거**

```bash
docker exec cl_embed_nextjs npm uninstall laravel-echo pusher-js
docker exec cl_embed_nextjs npm uninstall @types/pusher-js --save-dev
```

- [ ] **Step 2: 훅/라이브러리 파일 제거**

```bash
rm nextjs/hooks/useEcho.ts nextjs/hooks/useCategoryProgress.ts nextjs/hooks/useBatchProgress.ts nextjs/lib/echo.ts nextjs/global.d.ts
```

- [ ] **Step 3: useCategoryProgress 테스트 파일 제거**

```bash
rm nextjs/hooks/__tests__/useCategoryProgress.test.ts
```

- [ ] **Step 4: category-modal.tsx에서 WebSocket 의존성 제거**

`category-modal.tsx` 변경사항:
- `import { useCategoryProgress, type StepName, type CategoryProgress } from "@/hooks/useCategoryProgress"` → 제거
- `type StepName`과 `type CategoryProgress`를 로컬 타입으로 정의 또는 별도 파일 유지

필요한 타입만 파일 하단 또는 별도 파일로 유지:

```typescript
export type StepName =
  | "translation.zh"
  | "translation.en"
  | "embedding.ko"
  | "embedding.zh"
  | "embedding.en";
```

`handleSingleAction` 함수 변경:
```typescript
const handleSingleAction = async (stepName: StepName) => {
  if (!data) return;
  setActionError(null);
  setRunningSteps((prev) => new Set(prev).add(stepName));
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/categories/${data.id}/run-step`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ step: stepName }),
      }
    );
    const result = await res.json();
    if (result.status === 'completed') {
      setCompletedSteps((prev) => new Set(prev).add(stepName));
      setStepResults((prev) => new Map(prev).set(stepName, result.result));
      handleStepComplete(stepName, data.id);
    } else {
      throw new Error(result.error || '실행 실패');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '실행 실패';
    setActionError(msg);
    setFailedSteps((prev) => new Set(prev).add(stepName));
  } finally {
    setRunningSteps((prev) => {
      const next = new Set(prev);
      next.delete(stepName);
      return next;
    });
  }
};
```

`handleRunAll` 함수 변경:
```typescript
const handleRunAll = async () => {
  if (!data) return;
  setActionError(null);

  // 실행할 step 목록 계산 (기존 로직과 동일)
  const steps: StepName[] = [];
  for (const lang of LANGUAGES) {
    if (lang.hasTranslation) {
      const tl = data.languages[lang.key];
      const transKey = `translation.${lang.key}` as StepName;
      const embedKey = `embedding.${lang.key}` as StepName;
      if (!tl.translation_text && !completedSteps.has(transKey) && !stepResults.has(transKey)) {
        steps.push(transKey);
      }
      if (tl.embedding.status !== "completed" && !completedSteps.has(embedKey) && !stepResults.has(embedKey)) {
        steps.push(embedKey);
      }
    } else {
      const embedKey = `embedding.${lang.key}` as StepName;
      if (data.languages[lang.key].embedding.status !== "completed" && !completedSteps.has(embedKey) && !stepResults.has(embedKey)) {
        steps.push(embedKey);
      }
    }
  }
  if (steps.length === 0) return;

  setIsRunning(true);

  const results = await Promise.allSettled(
    steps.map(async (step) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/categories/${data.id}/run-step`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ step }),
        }
      );
      return { step, response: await res.json() };
    })
  );

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      const { step, response } = result.value;
      if (response.status === 'completed') {
        setCompletedSteps((prev) => new Set(prev).add(step));
        setStepResults((prev) => new Map(prev).set(step, response.result));
        handleStepComplete(step, data.id);
      } else {
        setFailedSteps((prev) => new Set(prev).add(step));
        setActionError(response.error || '실패');
      }
    } else {
      // network error
      setActionError('네트워크 오류가 발생했습니다');
    }
  });

  setIsRunning(false);
  onListRefresh?.();
};
```

`handleStepComplete` 헬퍼 함수 (임베딩 step 완료 후 API 재조회 로직 분리):
```typescript
const handleStepComplete = useCallback(async (stepName: StepName, categoryId: number) => {
  const isEmbedding = stepName.startsWith("embedding");
  if (isEmbedding) {
    const { fetchCategoryTranslations } = await import("@/lib/api");
    try {
      const res = await fetchCategoryTranslations(categoryId, token ?? null);
      const lang = stepName.split(".")[1] as "ko" | "en" | "zh";
      const emb = res.data.languages[lang].embedding;
      if (emb.preview) {
        setEmbeddingFullData((prev) => new Map(prev).set(stepName, JSON.stringify(emb.preview)));
      }
    } catch { /* 실패 시 무시 */ }
  }
}, [token]);
```

`cancel` 함수 제거 — 더 이상 필요 없음 (각 요청이 독립적).

`isRunning` 상태를 `useState`로 관리:

```typescript
const [isRunning, setIsRunning] = useState(false);
```

`handleOpenChange`에서 cancel 호출 제거:
```typescript
const handleOpenChange = (open: boolean) => {
  if (!open) {
    setActionError(null);
    setRunningSteps(new Set());
    setPendingSteps([]);
    setCompletedSteps(new Set());
    setFailedSteps(new Set());
    setStepResults(new Map());
    setCopyableSteps(new Set());
    setEmbeddingFullData(new Map());
    setFlashSteps(new Set());
    setIsRunning(false);
  }
  onOpenChange(open);
};
```

`renderRow`에서 `isRunningThis` 판단 로직을 `runningSteps.has(stepName)` 기반으로 변경:
```typescript
const isRunningThis = stepName ? runningSteps.has(stepName) : false;
```

- [ ] **Step 5: admin page test에서 useCategoryProgress mock 제거**

`nextjs/app/admin/__tests__/page.test.tsx`에서:
```typescript
// 제거:
// vi.mock("@/hooks/useCategoryProgress", () => ({
//   useCategoryProgress: vi.fn(),
// }));
```
그리고 `import { useCategoryProgress } from "@/hooks/useCategoryProgress";` import도 제거.

- [ ] **Step 6: category-modal.test.tsx에서 useCategoryProgress mock 제거**

`nextjs/components/admin/__tests__/category-modal.test.tsx`에서:
```typescript
// 제거:
// const mockSubscribeProgress = vi.fn();
// const mockCancel = vi.fn();
// const mockProgressDefault = { ... };
// vi.mock("@/hooks/useCategoryProgress", () => ({ ... }));

// vi.mock("@/lib/api")는 translateEmbedCategory 대신 유지하거나 제거
```

`translateEmbedCategory` mock 제거:
```typescript
// vi.mock("@/lib/api", () => ({
//   translateEmbedCategory: vi.fn().mockResolvedValue({}),
// }));
```

테스트 케이스 중 `subscribeProgress`, `cancel`, `activeStep`, `isRunning` 관련 테스트는 수정:
- `isRunning`/`activeStep` 모킹 → 직접 state로 동작하므로 `data` prop 기반 테스트로 변경
- `전체실행 클릭 시 첫 번째 step만 running 상태가 된다` 테스트는 fetch를 mock하여 재작성

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CategoryModal from "@/components/admin/category-modal";

vi.mock("sonner", () => ({ toast: vi.fn() }));

const mockWriteText = vi.fn();
Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

// 전역 fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

const pendingData = {
  id: 4,
  category_code: "CAT_004",
  category_name_ko: "생활/건강>세탁용품>다림판",
  embedding_dimensions: 1024,
  languages: {
    ko: {
      translation_text: "생활/건강>세탁용품>다림판",
      embedding: { status: "pending" as const, preview: null },
    },
    en: {
      translation_text: null,
      embedding: { status: "pending" as const, preview: null },
    },
    zh: {
      translation_text: null,
      embedding: { status: "pending" as const, preview: null },
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteText.mockResolvedValue(undefined);
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ step: "translation.zh", status: "completed", result: "测试" }),
  });
});

afterEach(cleanup);

describe("CategoryModal", () => {
  it("미완료 항목에 Play 아이콘 실행 버튼이 표시된다", () => {
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={pendingData} isLoading={false} error={null} token="token" />);
    expect(screen.getAllByRole("button", { name: "번역 실행" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("button", { name: "임베딩 실행" }).length).toBeGreaterThanOrEqual(1);
  });

  it("완료된 항목에 복사 버튼이 표시된다", () => {
    const completedData = {
      ...pendingData,
      languages: { ...pendingData.languages, en: { translation_text: "Life/Health", embedding: { status: "completed" as const, preview: [0.1, 0.2, 0.3] } } },
    };
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={completedData} isLoading={false} error={null} token="token" />);
    expect(screen.getAllByRole("button", { name: "복사" }).length).toBeGreaterThan(0);
  });

  it("로딩 중 스켈레톤이 표시된다", () => {
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={null} isLoading={true} error={null} token="token" />);
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("에러 발생 시 에러 메시지가 표시된다", () => {
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={pendingData} isLoading={false} error="번역 API 호출 실패" token="token" />);
    expect(screen.getByText("번역 API 호출 실패")).toBeInTheDocument();
  });

  it("전체실행 버튼이 표시되고 클릭 가능하다", () => {
    render(<CategoryModal open={true} onOpenChange={vi.fn()} data={pendingData} isLoading={false} error={null} token="token" />);
    const runAllButton = screen.getByRole("button", { name: "전체 실행" });
    expect(runAllButton).not.toBeDisabled();
  });
});
```

- [ ] **Step 7: 프론트엔드 테스트 실행**

```bash
docker exec cl_embed_nextjs npm test
```
Expected: 0 failure

- [ ] **Step 8: 커밋**

```bash
cd /var/app/www/cl_embed
git add -A
git commit -m "refactor: Admin 모달 WebSocket 제거 및 HTTP API 전환

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Embed 페이지 일괄 번역 HTTP 전환 (Next.js)

**Files:**
- Modify: `nextjs/app/embed/page.tsx`
- Create: `nextjs/app/embed/__tests__/page.test.tsx` (또는 기존 파일 수정)
- Modify: `nextjs/lib/api.ts` (batchTranslate 제거, runStep 추가)

- [ ] **Step 1: api.ts에서 batchTranslate 제거 및 runStep 추가**

`lib/api.ts`에서:
- `batchTranslate()` 함수 제거
- `BatchTranslateResponse` 인터페이스 제거
- `runStep()` 함수 추가:

```typescript
export interface RunStepResponse {
  step: string;
  status: "completed" | "failed";
  result?: string;
  error?: string;
}

export function runStep(
  categoryId: number,
  step: string,
  token?: string | null
): Promise<RunStepResponse> {
  return request<RunStepResponse>(`/categories/${categoryId}/run-step`, {
    method: "POST",
    body: { step },
    token,
  });
}
```

- [ ] **Step 2: embed/page.tsx에서 batchTranslate 제거 및 for 루프 구현**

변경사항:
- `import { batchTranslate } from "@/lib/api";` → 제거
- `import { runStep, getCategories } from "@/lib/api";` → 추가 (또는 기존 import에 추가)
- `import { useBatchProgress } from "@/hooks/useBatchProgress";` → 제거
- `useBatchProgress` hook과 `batchId` state 제거
- `Progress` 컴포넌트 import 유지

`handleBatchTranslate` 함수 변경:

```typescript
const handleBatchTranslate = useCallback(async () => {
  setIsBatchLoading(true);
  setBatchError(null);

  const cats = await getCategories(token || null);
  const allCategories = cats.data;
  const totalJobs = allCategories.length;

  setBatchProgress({
    status: "processing",
    totalJobs,
    completedJobs: 0,
    failedJobs: 0,
  });

  for (const cat of allCategories) {
    try {
      const steps = [`translation.${batchLanguage}`, `embedding.${batchLanguage}`];
      await Promise.all(
        steps.map(step =>
          runStep(cat.id, step, token ?? null)
        )
      );
      setBatchProgress(p => p ? { ...p, completedJobs: p.completedJobs + 1 } : p);
    } catch {
      setBatchProgress(p => p ? { ...p, failedJobs: p.failedJobs + 1 } : p);
    }
  }

  setBatchProgress(p => p ? { ...p, status: "completed" } : p);
  setIsBatchLoading(false);
}, [batchLanguage, token]);
```

`batchId` state 제거:
```typescript
// const [batchId, setBatchId] = useState<string | null>(null);  → 제거
```

`batchProgress` state를 로컬 useState로 변경:
```typescript
const [batchProgress, setBatchProgress] = useState<{
  status: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
} | null>(null);
```

`handleBatchTranslate`의 초기 호출에서 `setBatchId(data.batch_id)` 대신 직접 setBatchProgress로 변경.

렌더링 부분에서 `batchId` 관련 조건 제거:
- `batchId` 대신 `batchProgress`만으로 조건부 렌더링

- [ ] **Step 3: embed 페이지 테스트 작성/갱신**

`nextjs/app/embed/__tests__/page.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import EmbedPage from "../page";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
  getToken: vi.fn(() => "test-token"),
}));

vi.mock("@/hooks/useCategories", () => ({
  useCategories: vi.fn(() => ({
    categories: [],
    isLoaded: true,
    loadCategories: vi.fn(),
  })),
}));

vi.mock("@/hooks/useRecommend", () => ({
  useRecommend: vi.fn(() => ({
    recommend: vi.fn(),
    results: [],
    isLoading: false,
    error: null,
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn(), back: vi.fn(), push: vi.fn() })),
}));

vi.mock("@/lib/api", () => ({
  getCategories: vi.fn().mockResolvedValue({ data: [] }),
  runStep: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("EmbedPage", () => {
  it("기본 UI 요소가 표시된다", () => {
    render(<EmbedPage />);
    expect(screen.getByText("기술 시연")).toBeInTheDocument();
    expect(screen.getByText("일괄 번역")).toBeInTheDocument();
  });

  it("전체 번역 실행 버튼이 표시된다", () => {
    render(<EmbedPage />);
    expect(screen.getByRole("button", { name: "전체 번역 실행" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: 전체 프론트 테스트 실행**

```bash
docker exec cl_embed_nextjs npm test
```
Expected: 0 failure

- [ ] **Step 5: 커밋**

```bash
cd /var/app/www/cl_embed
git add -A
git commit -m "refactor: Embed 페이지 WebSocket 제거, 일괄 번역 HTTP 루프로 전환

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Playwright E2E 테스트

**Files:**
- Create: `nextjs/e2e/admin-modal-run-steps.spec.ts` (또는 기존 Playwright 디렉토리 확인)

- [ ] **Step 1: Playwright 디렉토리 확인**

```bash
ls nextjs/e2e/ 2>/dev/null || echo "no e2e dir"
```

- [ ] **Step 2: 관리자 모달 Playwright 테스트 작성**

인증 토큰 발급:
```bash
docker exec cl_embed_laravel php artisan tinker --execute 'echo \App\Models\User::first()->createToken("e2e")->plainTextToken;'
```

Playwright 테스트:
```typescript
import { test, expect } from "@playwright/test";

test.describe("Admin 모달 - run-step HTTP API", () => {
  test("전체 실행 버튼 클릭 후 step이 순차적으로 완료된다", async ({ page }) => {
    // Step 2에서 발급한 Sanctum 토큰 사용
    const token = process.env.E2E_TOKEN || "your-token-here";
    await page.goto(`/login?token=${token}`);
    await page.goto("/admin");

    // 카테고리 목록 로드 대기
    await page.waitForSelector('text=카테고리 관리');

    // 첫 번째 카테고리 클릭
    const firstCategory = page.locator('text=CAT_').first();
    await firstCategory.click();

    // 모달 열림 확인
    await expect(page.locator('text=카테고리 상세')).toBeVisible();

    // 전체 실행 버튼 클릭
    await page.click('text=전체 실행');

    // step들이 순차적으로 완료되는지 확인
    // 각 step 완료 후 Check 아이콘 표시 확인
    for (const label of ["번역 실행", "임베딩 실행"]) {
      await expect(page.locator(`button[title="${label} 실행 중"]`)).toBeVisible({ timeout: 10000 });
    }
  });
});
```

- [ ] **Step 3: Embed 페이지 Playwright 테스트 작성**

```typescript
test.describe("Embed 페이지 - 일괄 번역", () => {
  test("전체 번역 실행 후 Progress 바가 표시된다", async ({ page }) => {
    const token = process.env.E2E_TOKEN || "your-token-here";
    await page.goto(`/login?token=${token}`);
    await page.goto("/embed");

    // 일괄 번역 실행
    await page.click('text=전체 번역 실행');

    // Progress 컴포넌트 표시 확인
    await expect(page.locator('[role="progressbar"]')).toBeVisible({ timeout: 5000 });
  });
});
```

- [ ] **Step 4: 커밋**

```bash
cd /var/app/www/cl_embed
git add -A
git commit -m "test: Playwright E2E 테스트 추가 (run-step HTTP API)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 마무리 (Swagger + Pint + 최종 테스트)

**Files:**
- Modify: `laravel/app/Http/Controllers/Api/TestController.php` (OA\Info 유지)

- [ ] **Step 1: Swagger 문서 갱신**

```bash
docker exec cl_embed_laravel php artisan l5-swagger:generate
```

- [ ] **Step 2: Pint 포맷팅**

```bash
docker exec cl_embed_laravel vendor/bin/pint --format agent
```

- [ ] **Step 3: 전체 Laravel 테스트**

```bash
docker exec cl_embed_laravel php artisan test --compact
```
Expected: 0 failure

- [ ] **Step 4: 전체 Next.js 테스트**

```bash
docker exec cl_embed_nextjs npm test
```
Expected: 0 failure

- [ ] **Step 5: 최종 커밋**

```bash
cd /var/app/www/cl_embed
git add -A
git status
git commit -m "chore: Swagger 문서 갱신 및 최종 정리

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```
