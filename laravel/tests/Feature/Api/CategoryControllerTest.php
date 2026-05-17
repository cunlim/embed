<?php

use App\Jobs\BatchTranslatePipeline;
use App\Jobs\CategoryTranslateEmbedPipeline;
use App\Jobs\TranslateAndEmbedJob;
use App\Models\Category;
use App\Models\User;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;

test('GET /api/categories — 빈 목록을 반환한다', function () {
    $response = $this->getJson('/api/categories');

    $response->assertOk()
        ->assertJsonCount(0, 'data');
});

test('GET /api/categories — 카테고리 목록을 반환한다', function () {
    $categories = Category::factory()->count(3)->create();

    $response = $this->getJson('/api/categories');

    $response->assertOk()
        ->assertJsonCount(3, 'data')
        ->assertJsonPath('data.0.id', $categories[0]->id)
        ->assertJsonPath('data.0.category_code', $categories[0]->category_code)
        ->assertJsonPath('data.0.category_name_ko', $categories[0]->category_name_ko)
        ->assertJsonPath('data.0.translation_status', 'pending');
});

test('GET /api/categories — id 오름차순으로 정렬된 카테고리 목록을 반환한다', function () {
    $cat3 = Category::factory()->create(['id' => 3, 'category_name_ko' => 'C']);
    $cat2 = Category::factory()->create(['id' => 2, 'category_name_ko' => 'B']);
    $cat1 = Category::factory()->create(['id' => 1, 'category_name_ko' => 'A']);

    $response = $this->getJson('/api/categories');

    $response->assertOk()
        ->assertJsonPath('data.0.id', 1)
        ->assertJsonPath('data.1.id', 2)
        ->assertJsonPath('data.2.id', 3);
});

test('GET /api/categories — 페이지네이션 응답에 meta와 links가 포함된다', function () {
    Category::factory()->count(25)->create();

    $response = $this->getJson('/api/categories');

    $response->assertOk()
        ->assertJsonCount(20, 'data')
        ->assertJsonStructure([
            'data',
            'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            'links' => ['first', 'last', 'prev', 'next'],
        ])
        ->assertJsonPath('meta.per_page', 20)
        ->assertJsonPath('meta.total', 25);
});

test('GET /api/categories — page 파라미터로 다른 페이지 조회', function () {
    Category::factory()->count(25)->create();

    $response = $this->getJson('/api/categories?page=2');

    $response->assertOk()
        ->assertJsonCount(5, 'data')
        ->assertJsonPath('meta.current_page', 2)
        ->assertJsonPath('meta.last_page', 2);
});

test('POST /api/categories — 카테고리를 생성하고 Job을 dispatch한다', function () {
    Bus::fake();

    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories', [
        'category_name_ko' => '패션의류',
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.category_name_ko', '패션의류');

    $this->assertDatabaseHas('categories', ['category_name_ko' => '패션의류']);

    Bus::assertDispatched(TranslateAndEmbedJob::class, 2);
    Bus::assertDispatched(TranslateAndEmbedJob::class, function ($job) {
        $ref = new ReflectionProperty($job, 'targetLanguage');

        return $ref->getValue($job) === 'zh';
    });
    Bus::assertDispatched(TranslateAndEmbedJob::class, function ($job) {
        $ref = new ReflectionProperty($job, 'targetLanguage');

        return $ref->getValue($job) === 'en';
    });
});

test('POST /api/categories — category_name_ko가 없으면 422를 반환한다', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories', []);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['category_name_ko']);
});

test('POST /api/categories — category_name_ko가 255자를 초과하면 422를 반환한다', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories', [
        'category_name_ko' => str_repeat('가', 256),
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['category_name_ko']);
});

test('GET /api/categories/{category} — 단일 카테고리를 반환한다', function () {
    $category = Category::factory()->create();

    $response = $this->getJson("/api/categories/{$category->id}");

    $response->assertOk()
        ->assertJsonPath('data.id', $category->id)
        ->assertJsonPath('data.category_code', $category->category_code)
        ->assertJsonPath('data.category_name_ko', $category->category_name_ko);
});

test('GET /api/categories/{category} — 존재하지 않으면 404를 반환한다', function () {
    $response = $this->getJson('/api/categories/99999');

    $response->assertNotFound();
});

test('POST /api/categories/batch-translate — 일괄 번역을 dispatch하고 202를 반환한다', function () {
    Bus::fake();

    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories/batch-translate', [
        'target_language' => 'zh',
    ]);

    $response->assertAccepted()
        ->assertJsonPath('message', '일괄 번역이 시작되었습니다.')
        ->assertJsonPath('target_language', 'zh');

    Bus::assertDispatched(BatchTranslatePipeline::class, function ($job) {
        $ref = new ReflectionProperty($job, 'targetLanguage');

        return $ref->getValue($job) === 'zh';
    });
});

test('POST /api/categories/batch-translate — target_language가 없으면 422를 반환한다', function () {
    Bus::fake();

    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories/batch-translate', []);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['target_language']);

    Bus::assertNothingDispatched();
});

test('POST /api/categories/batch-translate — 지원하지 않는 언어면 422를 반환한다', function () {
    Bus::fake();

    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories/batch-translate', [
        'target_language' => 'ja',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['target_language']);

    Bus::assertNothingDispatched();
});

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

    Queue::assertPushed(CategoryTranslateEmbedPipeline::class, function ($job) use ($category) {
        $ref = new ReflectionProperty($job, 'categoryId');

        return $ref->getValue($job) === $category->id;
    });
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
