# 카테고리별 번역→임베딩 WebSocket 프로그레스 표시 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin 페이지에서 카테고리별 "번역 실행" 버튼 클릭 시 5단계(번역zh, 번역en, 임베딩ko, 임베딩zh, 임베딩en) 파이프라인을 실행하고 WebSocket으로 실시간 진행 상황을 모달에 표시한다.

**Architecture:** Laravel Job이 Redis lock으로 중복 실행을 방지하며 5단계를 순차 실행, 각 단계마다 `CategoryProgress` Reverb 이벤트를 broadcast. 프론트엔드는 `useCategoryProgress` 훅이 Echo로 채널을 구독해 상태를 관리하고, Admin 페이지 모달이 체크리스트 형태로 표시.

**Tech Stack:** Laravel 13 (Job, Reverb, Redis), Next.js 16 (React 19, laravel-echo, shadcn/ui Dialog)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `laravel/app/Events/CategoryProgress.php` | Create | 단계별 진행 이벤트 (ShouldBroadcast) |
| `laravel/app/Events/CategoryPipelineCompleted.php` | Create | 전체 파이프라인 완료 이벤트 (ShouldBroadcast) |
| `laravel/app/Jobs/CategoryTranslateEmbedPipeline.php` | Create | 5단계 순차 실행 + WebSocket broadcast |
| `laravel/routes/api.php` | Modify | translate-embed + cancel 라우트 추가 |
| `laravel/app/Http/Controllers/Api/CategoryController.php` | Modify | translateEmbed(), cancel() 메서드 추가 |
| `laravel/tests/Feature/Events/CategoryProgressTest.php` | Create | 이벤트 테스트 |
| `laravel/tests/Feature/Events/CategoryPipelineCompletedTest.php` | Create | 이벤트 테스트 |
| `laravel/tests/Feature/Jobs/CategoryTranslateEmbedPipelineTest.php` | Create | Job 테스트 |
| `nextjs/lib/api.ts` | Modify | translateEmbedCategory(), cancelTranslateEmbed() 추가 |
| `nextjs/hooks/useCategoryProgress.ts` | Create | WebSocket 구독 + 상태 관리 훅 |
| `nextjs/hooks/__tests__/useCategoryProgress.test.ts` | Create | 훅 테스트 |
| `nextjs/app/admin/page.tsx` | Modify | 버튼 + 모달 추가 |

---

### Task 1: CategoryProgress 이벤트 + 테스트

**Files:**
- Create: `laravel/app/Events/CategoryProgress.php`
- Create: `laravel/tests/Feature/Events/CategoryProgressTest.php`

- [ ] **Step 1: CategoryProgress 이벤트 클래스 작성**

```php
<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CategoryProgress implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $categoryId,
        public int $step,
        public string $stepName,
        public string $status,
        public ?string $error = null,
    ) {}

    public function broadcastOn(): Channel
    {
        return new Channel("category.{$this->categoryId}");
    }

    public function broadcastAs(): string
    {
        return 'category.progress';
    }
}
```

- [ ] **Step 2: CategoryProgress 이벤트 테스트 작성**

```php
<?php

use App\Events\CategoryProgress;
use Illuminate\Broadcasting\Channel;

test('CategoryProgress broadcasts on category.{categoryId} channel', function () {
    $event = new CategoryProgress(1, 2, 'translation.en', 'running');

    expect($event->broadcastOn())->toEqual(new Channel('category.1'));
});

test('CategoryProgress broadcasts as category.progress', function () {
    $event = new CategoryProgress(1, 1, 'translation.zh', 'running');

    expect($event->broadcastAs())->toBe('category.progress');
});

test('CategoryProgress sets all public properties', function () {
    $event = new CategoryProgress(42, 3, 'embedding.ko', 'completed');

    expect($event->categoryId)->toBe(42);
    expect($event->step)->toBe(3);
    expect($event->stepName)->toBe('embedding.ko');
    expect($event->status)->toBe('completed');
    expect($event->error)->toBeNull();
});

test('CategoryProgress error property defaults to null', function () {
    $event = new CategoryProgress(1, 1, 'translation.zh', 'running');

    expect($event->error)->toBeNull();
});

test('CategoryProgress error property can be set', function () {
    $event = new CategoryProgress(1, 2, 'translation.en', 'failed', 'Ollama timeout');

    expect($event->error)->toBe('Ollama timeout');
});
```

- [ ] **Step 3: 테스트 실행 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryProgressTest
```

Expected: 5 passes, 0 failures.

- [ ] **Step 4: Commit**

```bash
git add laravel/app/Events/CategoryProgress.php laravel/tests/Feature/Events/CategoryProgressTest.php
git commit -m "feat: CategoryProgress ShouldBroadcast 이벤트 추가"
```

---

### Task 2: CategoryPipelineCompleted 이벤트 + 테스트

**Files:**
- Create: `laravel/app/Events/CategoryPipelineCompleted.php`
- Create: `laravel/tests/Feature/Events/CategoryPipelineCompletedTest.php`

- [ ] **Step 1: CategoryPipelineCompleted 이벤트 클래스 작성**

```php
<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CategoryPipelineCompleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $categoryId,
        public bool $allSuccess,
        public int $failedStep,
    ) {}

    public function broadcastOn(): Channel
    {
        return new Channel("category.{$this->categoryId}");
    }

    public function broadcastAs(): string
    {
        return 'category.completed';
    }
}
```

- [ ] **Step 2: CategoryPipelineCompleted 이벤트 테스트 작성**

```php
<?php

use App\Events\CategoryPipelineCompleted;
use Illuminate\Broadcasting\Channel;

test('CategoryPipelineCompleted broadcasts on category.{categoryId} channel', function () {
    $event = new CategoryPipelineCompleted(1, true, 0);

    expect($event->broadcastOn())->toEqual(new Channel('category.1'));
});

test('CategoryPipelineCompleted broadcasts as category.completed', function () {
    $event = new CategoryPipelineCompleted(1, true, 0);

    expect($event->broadcastAs())->toBe('category.completed');
});

test('CategoryPipelineCompleted sets all properties when all success', function () {
    $event = new CategoryPipelineCompleted(42, true, 0);

    expect($event->categoryId)->toBe(42);
    expect($event->allSuccess)->toBeTrue();
    expect($event->failedStep)->toBe(0);
});

test('CategoryPipelineCompleted sets all properties when failed', function () {
    $event = new CategoryPipelineCompleted(42, false, 3);

    expect($event->categoryId)->toBe(42);
    expect($event->allSuccess)->toBeFalse();
    expect($event->failedStep)->toBe(3);
});
```

- [ ] **Step 3: 테스트 실행 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryPipelineCompletedTest
```

Expected: 4 passes, 0 failures.

- [ ] **Step 4: Commit**

```bash
git add laravel/app/Events/CategoryPipelineCompleted.php laravel/tests/Feature/Events/CategoryPipelineCompletedTest.php
git commit -m "feat: CategoryPipelineCompleted ShouldBroadcast 이벤트 추가"
```

---

### Task 3: CategoryTranslateEmbedPipeline Job + 테스트

**Files:**
- Create: `laravel/app/Jobs/CategoryTranslateEmbedPipeline.php`
- Create: `laravel/tests/Feature/Jobs/CategoryTranslateEmbedPipelineTest.php`

**Dependencies:** Task 1, Task 2

- [ ] **Step 1: Job 테스트 작성**

```php
<?php

use App\Events\CategoryPipelineCompleted;
use App\Events\CategoryProgress;
use App\Jobs\CategoryTranslateEmbedPipeline;
use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Services\EmbeddingGenerator;
use App\Services\OllamaTranslator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    config(['services.ollama.embedding_model' => 'bge-m3:latest']);
});

test('lock이 이미 점유되어 있으면 아무 이벤트도 dispatch하지 않는다', function () {
    Category::factory()->create();
    Cache::lock('category-translate:1', 600)->get();

    $job = new CategoryTranslateEmbedPipeline(1);
    $job->handle(app(OllamaTranslator::class), app(EmbeddingGenerator::class));

    Event::assertNothingDispatched();
});

test('카테고리가 없으면 ModelNotFoundException 발생', function () {
    $job = new CategoryTranslateEmbedPipeline(999);

    $job->handle(app(OllamaTranslator::class), app(EmbeddingGenerator::class));
})->throws(\Illuminate\Database\Eloquent\ModelNotFoundException::class);

test('5단계 순서대로 진행 이벤트를 broadcast 한다', function () {
    $category = Category::factory()->create();
    $translator = mock(OllamaTranslator::class);
    $embedder = mock(EmbeddingGenerator::class);

    $translator->shouldReceive('translate')
        ->times(2)
        ->andReturn('번역됨');
    $embedder->shouldReceive('generate')
        ->times(3)
        ->andReturn(array_fill(0, 1024, 0.01));

    $job = new CategoryTranslateEmbedPipeline($category->id);
    $job->handle($translator, $embedder);

    Event::assertDispatched(CategoryProgress::class, 10); // running + completed for 5 steps

    $expectedSteps = [
        ['stepName' => 'translation.zh', 'step' => 1],
        ['stepName' => 'translation.en', 'step' => 2],
        ['stepName' => 'embedding.ko', 'step' => 3],
        ['stepName' => 'embedding.zh', 'step' => 4],
        ['stepName' => 'embedding.en', 'step' => 5],
    ];

    foreach ($expectedSteps as $i => $expected) {
        Event::assertDispatched(CategoryProgress::class, function (CategoryProgress $event) use ($expected) {
            return $event->stepName === $expected['stepName']
                && $event->step === $expected['step']
                && $event->status === 'running';
        });
        Event::assertDispatched(CategoryProgress::class, function (CategoryProgress $event) use ($expected) {
            return $event->stepName === $expected['stepName']
                && $event->step === $expected['step']
                && $event->status === 'completed';
        });
    }
});

test('완료 후 CategoryPipelineCompleted 이벤트를 broadcast 한다', function () {
    $category = Category::factory()->create();
    $translator = mock(OllamaTranslator::class);
    $embedder = mock(EmbeddingGenerator::class);

    $translator->shouldReceive('translate')->andReturn('번역됨');
    $embedder->shouldReceive('generate')->andReturn(array_fill(0, 1024, 0.01));

    $job = new CategoryTranslateEmbedPipeline($category->id);
    $job->handle($translator, $embedder);

    Event::assertDispatched(CategoryPipelineCompleted::class, function (CategoryPipelineCompleted $event) use ($category) {
        return $event->categoryId === $category->id
            && $event->allSuccess === true
            && $event->failedStep === 0;
    });
});

test('단계 실패 시 이후 단계로 진행하지 않고 CategoryProgress failed 이벤트를 발생시킨다', function () {
    $category = Category::factory()->create();
    $translator = mock(OllamaTranslator::class);
    $embedder = mock(EmbeddingGenerator::class);

    $translator->shouldReceive('translate')
        ->once()
        ->andThrow(new \RuntimeException('Ollama rate limit exceeded'));

    $job = new CategoryTranslateEmbedPipeline($category->id);
    $job->handle($translator, $embedder);

    // translation.zh running + failed: 2회
    Event::assertDispatched(CategoryProgress::class, function (CategoryProgress $event) {
        return $event->step === 1 && $event->status === 'running';
    });
    Event::assertDispatched(CategoryProgress::class, function (CategoryProgress $event) {
        return $event->step === 1 && $event->status === 'failed'
            && $event->error === 'Ollama rate limit exceeded';
    });
    // 이후 단계는 dispatch되지 않음
    Event::assertNotDispatched(CategoryProgress::class, function (CategoryProgress $event) {
        return $event->step >= 2 && $event->status === 'running';
    });
    // 완료 이벤트는 실패 정보 포함
    Event::assertDispatched(CategoryPipelineCompleted::class, function (CategoryPipelineCompleted $event) {
        return $event->allSuccess === false && $event->failedStep === 1;
    });
});

test('cancel flag가 설정되어 있으면 다음 단계 전에 중단한다', function () {
    $category = Category::factory()->create();
    $translator = mock(OllamaTranslator::class);
    $embedder = mock(EmbeddingGenerator::class);

    $translator->shouldReceive('translate')
        ->once()
        ->andReturn('번역됨');

    // embedding 단계 전에 cancel flag 설정
    $embedder->shouldReceive('generate')
        ->once()
        ->andReturnUsing(function () use ($category) {
            Cache::put("category-translate-cancel:{$category->id}", true, 600);
            return array_fill(0, 1024, 0.01);
        });

    $job = new CategoryTranslateEmbedPipeline($category->id);
    $job->handle($translator, $embedder);

    // 첫 번째 임베딩은 실행되지만, 두 번째 임베딩 직전 cancel flag 확인 후 중단
    Event::assertDispatched(CategoryPipelineCompleted::class, function (CategoryPipelineCompleted $event) {
        return $event->allSuccess === false;
    });
});

test('이미 완료된 단계는 건너뛴다 (smart resume)', function () {
    $category = Category::factory()->create([
        'category_name_zh' => '이미 번역됨',
        'category_name_en' => 'already translated',
    ]);
    $translator = mock(OllamaTranslator::class);
    $embedder = mock(EmbeddingGenerator::class);

    // 번역은 이미 완료되었으므로 translate() 호출 없음
    $translator->shouldReceive('translate')->never();
    // 임베딩만 3회 실행
    $embedder->shouldReceive('generate')
        ->times(3)
        ->andReturn(array_fill(0, 1024, 0.01));

    $job = new CategoryTranslateEmbedPipeline($category->id);
    $job->handle($translator, $embedder);

    // translation.zh, translation.en은 completed로 즉시 broadcast
    Event::assertDispatched(CategoryProgress::class, function (CategoryProgress $event) {
        return $event->stepName === 'translation.zh' && $event->status === 'completed';
    });
    Event::assertDispatched(CategoryProgress::class, function (CategoryProgress $event) {
        return $event->stepName === 'translation.en' && $event->status === 'completed';
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryTranslateEmbedPipelineTest
```

Expected: FAIL (Job 클래스 미존재)

- [ ] **Step 3: Job 클래스 구현**

```php
<?php

namespace App\Jobs;

use App\Events\CategoryPipelineCompleted;
use App\Events\CategoryProgress;
use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Services\EmbeddingGenerator;
use App\Services\OllamaTranslator;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use RuntimeException;

class CategoryTranslateEmbedPipeline implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Ollama cold start 및 과부하를 감안한 넉넉한 타임아웃 */
    public int $timeout = 600;

    /** Rate Limit 재시도 포함 최대 5회 */
    public int $tries = 5;

    public function __construct(
        private int $categoryId,
    ) {}

    public function handle(
        OllamaTranslator $translator,
        EmbeddingGenerator $embedder
    ): void {
        $lockKey = "category-translate:{$this->categoryId}";

        $lock = Cache::lock($lockKey, 600);

        if (! $lock->get()) {
            return;
        }

        try {
            $category = Category::query()->findOrFail($this->categoryId);

            $categoryNameKo = $category->category_name_ko;
            $embedModelName = config('services.ollama.embedding_model');

            // 5단계 정의
            $steps = [
                ['step' => 1, 'name' => 'translation.zh', 'language' => 'zh', 'type' => 'translation'],
                ['step' => 2, 'name' => 'translation.en', 'language' => 'en', 'type' => 'translation'],
                ['step' => 3, 'name' => 'embedding.ko', 'language' => 'ko', 'type' => 'embedding'],
                ['step' => 4, 'name' => 'embedding.zh', 'language' => 'zh', 'type' => 'embedding'],
                ['step' => 5, 'name' => 'embedding.en', 'language' => 'en', 'type' => 'embedding'],
            ];

            $failedStep = 0;

            foreach ($steps as $stepDef) {
                // cancel flag 확인
                if (Cache::get("category-translate-cancel:{$this->categoryId}")) {
                    break;
                }

                // smart resume: 이미 완료된 단계 건너뛰기
                if ($this->isStepCompleted($category, $stepDef)) {
                    CategoryProgress::dispatch(
                        $this->categoryId,
                        $stepDef['step'],
                        $stepDef['name'],
                        'completed',
                    );
                    continue;
                }

                // 단계 시작 broadcast
                CategoryProgress::dispatch(
                    $this->categoryId,
                    $stepDef['step'],
                    $stepDef['name'],
                    'running',
                );

                try {
                    if ($stepDef['type'] === 'translation') {
                        $column = $stepDef['language'] === 'zh' ? 'category_name_zh' : 'category_name_en';
                        $translated = $translator->translate($categoryNameKo, $stepDef['language']);
                        $category->{$column} = $translated;
                        $category->save();
                    } else {
                        $textForEmbedding = match ($stepDef['language']) {
                            'ko' => $category->category_name_ko,
                            'zh' => $category->category_name_zh,
                            'en' => $category->category_name_en,
                        };

                        $vector = $embedder->generate($textForEmbedding);

                        CategoryEmbedding::updateOrCreate(
                            [
                                'category_id' => $this->categoryId,
                                'language' => $stepDef['language'],
                                'embed_model_name' => $embedModelName,
                            ],
                            [
                                'embedding' => $vector,
                            ]
                        );
                    }

                    // 단계 완료 broadcast
                    CategoryProgress::dispatch(
                        $this->categoryId,
                        $stepDef['step'],
                        $stepDef['name'],
                        'completed',
                    );
                } catch (RuntimeException $e) {
                    $failedStep = $stepDef['step'];
                    $errorMsg = $e->getMessage();

                    // 민감 정보 제거
                    if (str_contains($errorMsg, 'Ollama rate limit exceeded')) {
                        $errorMsg = 'Ollama rate limit exceeded';
                    }

                    CategoryProgress::dispatch(
                        $this->categoryId,
                        $stepDef['step'],
                        $stepDef['name'],
                        'failed',
                        $errorMsg,
                    );

                    break;
                }
            }

            CategoryPipelineCompleted::dispatch(
                $this->categoryId,
                $failedStep === 0,
                $failedStep,
            );
        } finally {
            Cache::forget("category-translate-cancel:{$this->categoryId}");
            $lock->release();
        }
    }

    /**
     * 해당 단계가 이미 완료되었는지 DB 상태로 확인한다.
     */
    private function isStepCompleted(Category $category, array $stepDef): bool
    {
        if ($stepDef['type'] === 'translation') {
            $column = $stepDef['language'] === 'zh' ? 'category_name_zh' : 'category_name_en';

            return $category->{$column} !== null;
        }

        // embedding
        return CategoryEmbedding::query()
            ->where('category_id', $this->categoryId)
            ->where('language', $stepDef['language'])
            ->exists();
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryTranslateEmbedPipelineTest
```

Expected: All tests pass, 0 failures.

- [ ] **Step 5: Pint 포맷팅**

```bash
docker exec cl_embed_laravel vendor/bin/pint --format agent
```

- [ ] **Step 6: Commit**

```bash
git add laravel/app/Jobs/CategoryTranslateEmbedPipeline.php laravel/tests/Feature/Jobs/CategoryTranslateEmbedPipelineTest.php
git commit -m "feat: CategoryTranslateEmbedPipeline Job 추가 (5단계 + smart resume + cancel)"
```

---

### Task 4: API 라우트 + 컨트롤러 메서드

**Files:**
- Modify: `laravel/routes/api.php`
- Modify: `laravel/app/Http/Controllers/Api/CategoryController.php`

**Dependencies:** Task 3

- [ ] **Step 1: 라우트 추가**

`laravel/routes/api.php`의 `// 일괄 번역/임베딩` 라인 아래에 추가:

```php
// 개별 카테고리 번역/임베딩
Route::post('categories/{category}/translate-embed', [CategoryController::class, 'translateEmbed'])->middleware('auth:sanctum');
Route::post('categories/{category}/translate-embed/cancel', [CategoryController::class, 'cancelTranslateEmbed'])->middleware('auth:sanctum');
```

- [ ] **Step 2: 라우트 등록 확인**

```bash
docker exec cl_embed_laravel php artisan route:list | grep translate-embed
```

Expected: 2개 라우트 (translate-embed, translate-embed/cancel)

- [ ] **Step 3: 컨트롤러 메서드 추가**

`laravel/app/Http/Controllers/Api/CategoryController.php`의 import 섹션에 추가:

```php
use App\Jobs\CategoryTranslateEmbedPipeline;
use Illuminate\Support\Facades\Cache;
```

클래스 끝 (`batchTranslate` 메서드 다음)에 추가:

```php
#[OA\Post(
    path: '/api/categories/{category}/translate-embed',
    summary: '카테고리별 번역·임베딩 실행',
    description: '특정 카테고리에 대해 번역과 임베딩 파이프라인을 실행합니다.',
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
    responses: [
        new OA\Response(
            response: 202,
            description: '파이프라인 실행 시작됨',
            content: new OA\JsonContent(
                type: 'object',
                properties: [
                    new OA\Property(property: 'message', type: 'string'),
                    new OA\Property(property: 'category_id', type: 'integer'),
                ]
            )
        ),
        new OA\Response(
            response: 401,
            description: '인증 필요',
        ),
        new OA\Response(
            response: 404,
            description: '카테고리를 찾을 수 없음',
        ),
    ]
)]
public function translateEmbed(Category $category): JsonResponse
{
    CategoryTranslateEmbedPipeline::dispatch($category->id);

    return response()->json([
        'message' => '카테고리 번역·임베딩이 시작되었습니다.',
        'category_id' => $category->id,
    ], 202);
}

#[OA\Post(
    path: '/api/categories/{category}/translate-embed/cancel',
    summary: '카테고리별 번역·임베딩 중단',
    description: '실행 중인 카테고리 번역·임베딩 파이프라인을 중단합니다.',
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
    responses: [
        new OA\Response(
            response: 200,
            description: '중단 요청 처리됨',
            content: new OA\JsonContent(
                type: 'object',
                properties: [
                    new OA\Property(property: 'message', type: 'string'),
                    new OA\Property(property: 'category_id', type: 'integer'),
                ]
            )
        ),
        new OA\Response(
            response: 401,
            description: '인증 필요',
        ),
    ]
)]
public function cancelTranslateEmbed(Category $category): JsonResponse
{
    Cache::put("category-translate-cancel:{$category->id}", true, 600);

    return response()->json([
        'message' => '카테고리 번역·임베딩 중단이 요청되었습니다.',
        'category_id' => $category->id,
    ]);
}
```

- [ ] **Step 4: 컨트롤러 테스트 추가**

`laravel/tests/Feature/Api/CategoryControllerTest.php`에 다음 테스트 추가:

```php
use App\Jobs\CategoryTranslateEmbedPipeline;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;

test('POST /api/categories/{category}/translate-embed — Job을 dispatch하고 202를 반환한다', function () {
    Queue::fake();
    $category = Category::factory()->create();
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user, 'sanctum')
        ->postJson("/api/categories/{$category->id}/translate-embed");

    $response->assertAccepted()
        ->assertJsonPath('category_id', $category->id)
        ->assertJsonPath('message', '카테고리 번역·임베딩이 시작되었습니다.');

    Queue::assertPushed(CategoryTranslateEmbedPipeline::class, fn ($job) =>
        $job->categoryId === $category->id
    );
});

test('POST /api/categories/{category}/translate-embed — 인증되지 않은 요청은 401', function () {
    $category = Category::factory()->create();

    $this
        ->postJson("/api/categories/{$category->id}/translate-embed")
        ->assertUnauthorized();
});

test('POST /api/categories/{category}/translate-embed/cancel — cancel flag를 설정하고 200을 반환한다', function () {
    $category = Category::factory()->create();
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user, 'sanctum')
        ->postJson("/api/categories/{$category->id}/translate-embed/cancel");

    $response->assertOk()
        ->assertJsonPath('category_id', $category->id)
        ->assertJsonPath('message', '카테고리 번역·임베딩 중단이 요청되었습니다.');

    expect(Cache::get("category-translate-cancel:{$category->id}"))->toBeTrue();
});
```

- [ ] **Step 5: 테스트 실행 확인**

```bash
docker exec cl_embed_laravel php artisan test --compact --filter=CategoryControllerTest
```

Expected: 모든 CategoryController 테스트 통과, 0 failures.

- [ ] **Step 6: Pint 포맷팅 + Swagger 문서 생성**

```bash
docker exec cl_embed_laravel vendor/bin/pint --format agent
docker exec cl_embed_laravel php artisan l5-swagger:generate
```

- [ ] **Step 7: Commit**

```bash
git add laravel/routes/api.php laravel/app/Http/Controllers/Api/CategoryController.php
git commit -m "feat: 카테고리별 번역·임베딩 API 엔드포인트 추가 (translate-embed + cancel)"
```

---

### Task 5: 프론트엔드 API 클라이언트 함수

**Files:**
- Modify: `nextjs/lib/api.ts`

- [ ] **Step 1: API 함수 + 타입 추가**

`nextjs/lib/api.ts`에 `Category` interface 다음에 추가:

```typescript
// --- 개별 카테고리 번역·임베딩 ---

export interface TranslateEmbedResponse {
  message: string;
  category_id: number;
}

export function translateEmbedCategory(
  categoryId: number,
  token?: string | null,
): Promise<TranslateEmbedResponse> {
  return request<TranslateEmbedResponse>(`/categories/${categoryId}/translate-embed`, {
    method: "POST",
    token,
  });
}

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

- [ ] **Step 2: 타입 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: 타입 오류 없음.

- [ ] **Step 3: Commit**

```bash
git add nextjs/lib/api.ts
git commit -m "feat: translateEmbedCategory + cancelTranslateEmbed API 클라이언트 함수 추가"
```

---

### Task 6: useCategoryProgress 훅 + 테스트

**Files:**
- Create: `nextjs/hooks/useCategoryProgress.ts`
- Create: `nextjs/hooks/__tests__/useCategoryProgress.test.ts`

**Dependencies:** Task 5

- [ ] **Step 1: 훅 테스트 작성**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCategoryProgress } from "@/hooks/useCategoryProgress";

// API mock
vi.mock("@/lib/api", () => ({
  translateEmbedCategory: vi.fn(),
  cancelTranslateEmbed: vi.fn(),
}));

// Echo mock
const mockListen = vi.fn();
const mockStopListening = vi.fn();
const mockLeaveChannel = vi.fn();
const mockChannel = vi.fn(() => ({
  listen: mockListen,
  stopListening: mockStopListening,
}));

const mockEcho = {
  channel: mockChannel,
  leaveChannel: mockLeaveChannel,
};

// useEcho mock
vi.mock("@/hooks/useEcho", () => ({
  useEcho: vi.fn(() => mockEcho),
}));

import { translateEmbedCategory, cancelTranslateEmbed } from "@/lib/api";
import { useEcho } from "@/hooks/useEcho";

const mockedTranslateEmbed = translateEmbedCategory as ReturnType<typeof vi.fn>;
const mockedCancelTranslateEmbed = cancelTranslateEmbed as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedTranslateEmbed.mockResolvedValue({
    message: "시작됨",
    category_id: 1,
  });
});

describe("useCategoryProgress", () => {
  it("초기 상태는 progress null, isRunning false", () => {
    const { result } = renderHook(() => useCategoryProgress());

    expect(result.current.progress).toBeNull();
    expect(result.current.isRunning).toBe(false);
  });

  it("startTranslation 호출 시 API를 호출하고 Echo 채널을 구독한다", async () => {
    const { result } = renderHook(() => useCategoryProgress());

    await act(async () => {
      await result.current.startTranslation(1, "test-token");
    });

    expect(mockedTranslateEmbed).toHaveBeenCalledWith(1, "test-token");
    expect(mockChannel).toHaveBeenCalledWith("category.1");
    expect(mockListen).toHaveBeenCalledTimes(2); // .category.progress + .category.completed
    expect(result.current.isRunning).toBe(true);
  });

  it("progress 이벤트 수신 시 progress 상태를 업데이트한다", async () => {
    const { result } = renderHook(() => useCategoryProgress());

    await act(async () => {
      await result.current.startTranslation(1);
    });

    // progress 리스너 추출해서 호출
    const progressCallback = mockListen.mock.calls.find(
      ([event]) => event === ".category.progress",
    )?.[1];

    act(() => {
      progressCallback({
        categoryId: 1,
        step: 1,
        stepName: "translation.zh",
        status: "running",
      });
    });

    expect(result.current.progress).toEqual({
      categoryId: 1,
      step: 1,
      stepName: "translation.zh",
      status: "running",
    });
  });

  it("completed 이벤트 수신 시 isRunning이 false가 된다", async () => {
    const { result } = renderHook(() => useCategoryProgress());

    await act(async () => {
      await result.current.startTranslation(1);
    });

    const completedCallback = mockListen.mock.calls.find(
      ([event]) => event === ".category.completed",
    )?.[1];

    act(() => {
      completedCallback({
        categoryId: 1,
        allSuccess: true,
        failedStep: 0,
      });
    });

    expect(result.current.isRunning).toBe(false);
  });

  it("cancel 호출 시 채널 leave + 상태 초기화, API cancel 호출", async () => {
    const { result } = renderHook(() => useCategoryProgress());

    await act(async () => {
      await result.current.startTranslation(1, "test-token");
    });

    await act(async () => {
      result.current.cancel();
    });

    expect(mockedCancelTranslateEmbed).toHaveBeenCalledWith(1, "test-token");
    expect(mockLeaveChannel).toHaveBeenCalledWith("category.1");
    expect(result.current.progress).toBeNull();
    expect(result.current.isRunning).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
docker exec cl_embed_nextjs npm test
```

Expected: FAIL (useCategoryProgress 훅 미존재)

- [ ] **Step 3: 훅 구현**

```typescript
"use client";

import { useState, useCallback, useRef } from "react";
import { useEcho } from "@/hooks/useEcho";
import {
  translateEmbedCategory as apiTranslateEmbed,
  cancelTranslateEmbed as apiCancelTranslateEmbed,
} from "@/lib/api";

export interface CategoryProgress {
  categoryId: number;
  step: number;
  stepName: StepName;
  status: StepStatus;
  error?: string;
}

export type StepName =
  | "translation.zh"
  | "translation.en"
  | "embedding.ko"
  | "embedding.zh"
  | "embedding.en";

export type StepStatus = "pending" | "running" | "completed" | "failed";

export interface CategoryPipelineCompleted {
  categoryId: number;
  allSuccess: boolean;
  failedStep: number;
}

export interface UseCategoryProgressReturn {
  progress: CategoryProgress | null;
  isRunning: boolean;
  startTranslation: (categoryId: number, token?: string | null) => Promise<void>;
  cancel: () => void;
}

export function useCategoryProgress(): UseCategoryProgressReturn {
  const echo = useEcho();
  const [progress, setProgress] = useState<CategoryProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const channelRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const categoryIdRef = useRef<number | null>(null);

  const startTranslation = useCallback(
    async (categoryId: number, token?: string | null) => {
      if (!echo) {
        console.warn("Echo 연결이 없습니다.");
        return;
      }

      setIsRunning(true);
      tokenRef.current = token ?? null;
      categoryIdRef.current = categoryId;

      try {
        await apiTranslateEmbed(categoryId, token);
      } catch (err) {
        console.error("API 호출 실패:", err);
        setIsRunning(false);
        return;
      }

      const channelName = `category.${categoryId}`;
      channelRef.current = channelName;

      const channel = echo.channel(channelName);
      channel.listen(".category.progress", (data: CategoryProgress) => {
        setProgress(data);
      });
      channel.listen(".category.completed", (_data: CategoryPipelineCompleted) => {
        setIsRunning(false);
      });
    },
    [echo],
  );

  const cancel = useCallback(() => {
    const channelName = channelRef.current;
    const categoryId = categoryIdRef.current;

    if (channelName && echo) {
      echo.leaveChannel(channelName);
    }

    if (categoryId !== null) {
      apiCancelTranslateEmbed(categoryId, tokenRef.current).catch((err) => {
        console.error("Cancel API 호출 실패:", err);
      });
    }

    channelRef.current = null;
    categoryIdRef.current = null;
    tokenRef.current = null;
    setProgress(null);
    setIsRunning(false);
  }, [echo]);

  return { progress, isRunning, startTranslation, cancel };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
docker exec cl_embed_nextjs npm test
```

Expected: 모든 테스트 통과, 0 failures.

- [ ] **Step 5: 타입 체크**

```bash
docker exec cl_embed_nextjs npx tsc --noEmit
```

Expected: 타입 오류 없음.

- [ ] **Step 6: Commit**

```bash
git add nextjs/hooks/useCategoryProgress.ts nextjs/hooks/__tests__/useCategoryProgress.test.ts
git commit -m "feat: useCategoryProgress 훅 추가 (WebSocket 구독 + 상태 관리)"
```

---

### Task 7: Admin 페이지 버튼 + 모달

**Files:**
- Modify: `nextjs/app/admin/page.tsx`

**Dependencies:** Task 6

- [ ] **Step 1: Dialog 컴포넌트 확인**

```bash
docker exec cl_embed_nextjs ls components/ui/dialog.tsx
```

Expected: `dialog.tsx` 존재 확인. 없으면 `npx shadcn@latest add dialog` 실행.

- [ ] **Step 2: 컴포넌트 테스트 작성**

`nextjs/app/admin/__tests__/` 디렉토리 생성 후 `page.test.tsx` 작성:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AdminPage from "../page";

// 모킹
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
  getToken: vi.fn(() => "test-token"),
}));

vi.mock("@/hooks/useCategories", () => ({
  useCategories: vi.fn(),
}));

vi.mock("@/hooks/useCategoryProgress", () => ({
  useCategoryProgress: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn(), back: vi.fn() })),
}));

import { useAuth, getToken } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryProgress } from "@/hooks/useCategoryProgress";

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockUseCategories = useCategories as ReturnType<typeof vi.fn>;
const mockUseCategoryProgress = useCategoryProgress as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    user: { id: 1, name: "Admin", email: "admin@test.com" },
    isLoading: false,
  });
  mockUseCategories.mockReturnValue({
    categories: [
      {
        id: 1,
        category_code: "A01",
        category_name_ko: "의류",
        category_name_zh: "服装",
        category_name_en: "Clothing",
      },
      {
        id: 2,
        category_code: "A02",
        category_name_ko: "식품",
        category_name_zh: null,
        category_name_en: null,
      },
    ],
    isLoading: false,
    isLoaded: true,
    error: null,
    loadCategories: vi.fn(),
    addCategory: vi.fn(),
  });
  mockUseCategoryProgress.mockReturnValue({
    progress: null,
    isRunning: false,
    startTranslation: vi.fn(),
    cancel: vi.fn(),
  });
});

describe("AdminPage 카테고리별 번역 실행", () => {
  it("각 카테고리 행에 번역 실행 버튼이 렌더링된다", async () => {
    render(<AdminPage />);
    // Play 아이콘 버튼 확인 (aria-label 또는 title)
    const buttons = screen.getAllByRole("button", { name: /번역 실행/ });
    expect(buttons).toHaveLength(2);
  });

  it("실행 중이 아닐 때 버튼이 활성화된다", () => {
    mockUseCategoryProgress.mockReturnValue({
      progress: null,
      isRunning: false,
      startTranslation: vi.fn(),
      cancel: vi.fn(),
    });

    render(<AdminPage />);
    const button = screen.getAllByRole("button", { name: /번역 실행/ })[0];
    expect(button).not.toBeDisabled();
  });

  it("실행 중일 때 다른 버튼은 disabled 된다", () => {
    mockUseCategoryProgress.mockReturnValue({
      progress: { categoryId: 1, step: 2, stepName: "translation.en", status: "running" },
      isRunning: true,
      startTranslation: vi.fn(),
      cancel: vi.fn(),
    });

    render(<AdminPage />);
    // 실행 중인 행의 버튼은 Loader2
    const runningButton = screen.getByRole("button", { name: /실행 중/ });
    expect(runningButton).toBeDisabled();
  });
});
```

- [ ] **Step 3: admin/page.tsx 수정**

전체 파일을 다음과 같이 수정:

```tsx
"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  RefreshCw,
  AlertCircle,
  Database,
  Play,
  Loader2,
  Circle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth, getToken } from "@/hooks/useAuth";
import { useCategories, type Category } from "@/hooks/useCategories";
import {
  useCategoryProgress,
  type CategoryProgress,
  type StepName,
} from "@/hooks/useCategoryProgress";
import { isAdmin } from "@/lib/utils";

const STEP_LABELS: Record<StepName, string> = {
  "translation.zh": "중국어 번역",
  "translation.en": "영어 번역",
  "embedding.ko": "한국어 임베딩",
  "embedding.zh": "중국어 임베딩",
  "embedding.en": "영어 임베딩",
};

const ALL_STEPS: { step: number; name: StepName }[] = [
  { step: 1, name: "translation.zh" },
  { step: 2, name: "translation.en" },
  { step: 3, name: "embedding.ko" },
  { step: 4, name: "embedding.zh" },
  { step: 5, name: "embedding.en" },
];

function progressForStep(progress: CategoryProgress | null, stepName: StepName): CategoryProgress | null {
  if (progress && progress.stepName === stepName) return progress;
  return null;
}

function StepIcon({ status }: { status: "pending" | "running" | "completed" | "failed" }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case "running":
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "pending":
    default:
      return <Circle className="h-5 w-5 text-muted-foreground" />;
  }
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const authorized = user ? isAdmin(user.id) : false;

  // 인증 가드
  useEffect(() => {
    if (!mounted || authLoading) return;

    if (!user) {
      router.replace("/login?redirect=/admin");
    } else if (!isAdmin(user.id)) {
      router.back();
    }
  }, [mounted, authLoading, user, router]);

  const token = mounted ? getToken() : null;
  const {
    categories,
    isLoading: catLoading,
    error: catError,
    loadCategories,
    addCategory,
  } = useCategories(token);

  const [newCategoryName, setNewCategoryName] = useState("");
  const { progress, isRunning, startTranslation, cancel } = useCategoryProgress();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);

  const handleAddCategory = useCallback(async () => {
    if (!newCategoryName.trim()) return;
    await addCategory(newCategoryName.trim());
    setNewCategoryName("");
  }, [newCategoryName, addCategory]);

  const handleStartTranslation = useCallback(
    async (category: Category) => {
      setActiveCategoryId(category.id);
      setModalOpen(true);
      await startTranslation(category.id, token);
    },
    [startTranslation, token],
  );

  const handleCancel = useCallback(() => {
    cancel();
    setModalOpen(false);
    setActiveCategoryId(null);
  }, [cancel]);

  // 단계별 상태 도출 (진행 정보가 없으면 pending)
  const stepStatuses = ALL_STEPS.map(({ name }) => {
    const p = progressForStep(progress, name);
    if (!p) return "pending" as const;
    return p.status;
  });

  // progress와 일치하는 step의 index (진행 중인 단계 하이라이트)
  const currentStepIndex = progress ? ALL_STEPS.findIndex((s) => s.name === progress.stepName) : -1;

  if (!mounted || !authorized) return null;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="noise-overlay" />
      <div className="absolute inset-0 bg-grid" />
      <div className="glow-orb -top-40 -right-40 h-96 w-96 bg-blue-500/15 dark:bg-blue-500/10" />
      <div className="glow-orb -bottom-40 -left-40 h-96 w-96 bg-purple-500/15 dark:bg-purple-500/10" />

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12 sm:px-8">
        <h1 className="mb-8 text-3xl font-bold tracking-tight sm:text-4xl">
          관리자
        </h1>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 카테고리 추가 (sidebar) */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">카테고리 추가</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
                <p className="text-xs text-muted-foreground">
                  카테고리 코드는 자동 생성됩니다
                </p>
                <Button
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim()}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  추가
                </Button>
                {catError && (
                  <p className="text-sm text-destructive">{catError}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 카테고리 목록 테이블 */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">카테고리 목록</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={loadCategories}
                disabled={catLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${catLoading ? "animate-spin" : ""}`}
                />
              </Button>
            </CardHeader>
            <CardContent>
              {/* 로딩 */}
              {catLoading && categories.length === 0 && (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              )}

              {/* 에러 */}
              {!catLoading && catError && (
                <div className="flex items-start gap-3 rounded-md border border-destructive/50 p-4">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">
                      오류가 발생했습니다
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {catError}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={loadCategories}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      재시도
                    </Button>
                  </div>
                </div>
              )}

              {/* 빈 상태 */}
              {!catLoading && !catError && categories.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-12">
                  <Database className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    등록된 카테고리가 없습니다
                  </p>
                </div>
              )}

              {/* 테이블 - 데스크톱 */}
              {categories.length > 0 && (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-mono text-xs">
                            코드
                          </TableHead>
                          <TableHead>한국어</TableHead>
                          <TableHead>중국어</TableHead>
                          <TableHead>영어</TableHead>
                          <TableHead className="w-[60px]">작업</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categories.map((cat) => {
                          const isActive = isRunning && activeCategoryId === cat.id;
                          const isOtherRunning = isRunning && activeCategoryId !== cat.id;

                          return (
                            <TableRow key={cat.id}>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {cat.category_code}
                              </TableCell>
                              <TableCell className="font-medium">
                                {cat.category_name_ko}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {cat.category_name_zh || "-"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {cat.category_name_en || "-"}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title={isActive ? "실행 중" : "번역 실행"}
                                  disabled={isOtherRunning}
                                  onClick={() => handleStartTranslation(cat)}
                                  aria-label={isActive ? "실행 중" : "번역 실행"}
                                >
                                  {isActive ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Play className="h-4 w-4" />
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 카드 레이아웃 - 모바일 */}
                  <div className="space-y-2 md:hidden">
                    {categories.map((cat) => {
                      const isActive = isRunning && activeCategoryId === cat.id;
                      const isOtherRunning = isRunning && activeCategoryId !== cat.id;

                      return (
                        <Card key={cat.id} className="p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-mono text-xs text-muted-foreground">
                                {cat.category_code}
                              </p>
                              <p className="font-medium">{cat.category_name_ko}</p>
                              <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                                <span>중: {cat.category_name_zh || "-"}</span>
                                <span>영: {cat.category_name_en || "-"}</span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={isActive ? "실행 중" : "번역 실행"}
                              disabled={isOtherRunning}
                              onClick={() => handleStartTranslation(cat)}
                              aria-label={isActive ? "실행 중" : "번역 실행"}
                            >
                              {isActive ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* 프로그레스 모달 */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) handleCancel(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>번역·임베딩 진행 상황</DialogTitle>
            <DialogDescription>
              5단계 파이프라인이 순차적으로 실행됩니다. 모달을 닫으면 중단됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {ALL_STEPS.map(({ name }, index) => {
              const status = stepStatuses[index];
              const isCurrentStep = index === currentStepIndex;
              const failedProgress = status === "failed" ? progressForStep(progress, name) : null;

              return (
                <div
                  key={name}
                  className={`flex items-center gap-3 rounded-md border p-3 ${
                    isCurrentStep ? "border-blue-500 bg-blue-500/5" : "border-border"
                  }`}
                >
                  <StepIcon status={status} />
                  <span className="flex-1 text-sm font-medium">
                    {STEP_LABELS[name]}
                  </span>
                  {status === "failed" && failedProgress?.error && (
                    <span className="text-xs text-destructive">
                      {failedProgress.error}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {!isRunning && stepStatuses.some((s) => s === "failed") && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (activeCategoryId !== null) {
                    handleStartTranslation({ id: activeCategoryId } as Category);
                  }
                }}
              >
                재시도
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: 빌드 + 테스트 + 린트 확인**

```bash
docker exec cl_embed_nextjs npm run build
docker exec cl_embed_nextjs npm test
docker exec cl_embed_nextjs npm run lint
```

Expected: build 성공, test 0 failure, lint 0 error.

- [ ] **Step 5: Commit**

```bash
git add nextjs/app/admin/page.tsx
git commit -m "feat: admin 페이지 카테고리별 번역 실행 버튼 + 프로그레스 모달 추가"
```

---

### Task 8: 전체 테스트 최종 확인

- [ ] **Step 1: Laravel 전체 테스트**

```bash
docker exec cl_embed_laravel php artisan test --compact
```

Expected: 0 failures.

- [ ] **Step 2: Next.js 전체 테스트**

```bash
docker exec cl_embed_nextjs npm test
```

Expected: 0 failures.

- [ ] **Step 3: Pint 포맷팅**

```bash
docker exec cl_embed_laravel vendor/bin/pint --format agent
```

- [ ] **Step 4: 최종 Commit (필요한 경우)**
