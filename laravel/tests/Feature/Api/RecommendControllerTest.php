<?php

use App\Http\Resources\RecommendResource;
use App\Models\Category;
use App\Models\SearchLog;
use App\Models\User;
use App\Services\EmbeddingCacheService;
use App\Services\RecommendationService;
use Illuminate\Pagination\LengthAwarePaginator;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    RecommendResource::setQueryEmbedding(null);
});

test('POST /api/recommend — text가 없으면 일반 카테고리 목록을 반환한다', function () {
    $category = Category::factory()->create([
        'category_code' => '50000000',
        'category_name_ko' => '패션의류',
    ]);

    $response = $this->postJson('/api/recommend', [
        'target_language' => 'ko',
    ]);

    $response->assertOk();
    $response->assertJsonStructure([
        'data' => [['id', 'category_code', 'category_name_ko', 'category_name', 'translation_status', 'similarity_score']],
        'meta' => ['current_page', 'last_page', 'total', 'per_page'],
    ]);
    expect($response->json('data.0.similarity_score'))->toBeNull();
});

test('POST /api/recommend — text가 빈 문자열이면 일반 카테고리 목록을 반환한다', function () {
    $category = Category::factory()->create([
        'category_code' => '50000000',
        'category_name_ko' => '패션의류',
    ]);

    $response = $this->postJson('/api/recommend', [
        'text' => '', 'target_language' => 'ko',
    ]);

    $response->assertOk();
    expect($response->json('data.0.similarity_score'))->toBeNull();
});

test('POST /api/recommend — text가 500자를 초과하면 422를 반환한다', function () {
    $response = $this->postJson('/api/recommend', [
        'text' => str_repeat('a', 501), 'target_language' => 'ko',
    ]);
    $response->assertUnprocessable()->assertJsonValidationErrors(['text']);
});

test('POST /api/recommend — target_language가 없으면 422를 반환한다', function () {
    $response = $this->postJson('/api/recommend', [
        'text' => '검색어',
    ]);
    $response->assertUnprocessable()->assertJsonValidationErrors(['target_language']);
});

test('POST /api/recommend — 지원하지 않는 언어면 422를 반환한다', function () {
    $response = $this->postJson('/api/recommend', [
        'text' => '검색어', 'target_language' => 'ja',
    ]);
    $response->assertUnprocessable()->assertJsonValidationErrors(['target_language']);
});

test('POST /api/recommend — 유효성 검증 통과 후 EmbeddingCacheService.getOrCreateEmbedding을 호출한다', function () {
    $searchLog = new SearchLog([
        'search_keyword' => '검색어',
        'normalized_keyword' => '검색어',
        'embed_model_name' => 'bge-m3:latest',
    ]);
    $searchLog->embedding = array_fill(0, 1024, 0.1);

    $mockCache = Mockery::mock(EmbeddingCacheService::class);
    $mockCache->shouldReceive('getOrCreateEmbedding')
        ->once()
        ->andReturn($searchLog);
    app()->instance(EmbeddingCacheService::class, $mockCache);

    $response = $this->postJson('/api/recommend', [
        'text' => '검색어',
        'target_language' => 'ko',
    ]);

    expect($response->status())->not->toBe(422);
});

test('RecommendResource — toArray 응답 형식을 검증한다', function () {
    $category = Category::factory()->create([
        'category_code' => 'CAT_abc12345',
        'category_name_ko' => '패션의류',
        'category_name_zh' => '时尚服装',
        'category_name_en' => 'Fashion Clothing',
    ]);
    $category->similarity_score = 0.9532;

    RecommendResource::setQueryEmbedding([0.1, 0.2, 0.3]);

    $resource = new RecommendResource($category);
    $data = $resource->toArray(request()->merge(['target_language' => 'ko']));

    expect($data)->toHaveKeys([
        'id', 'category_code', 'category_name_ko', 'category_name_zh',
        'category_name_en', 'category_name', 'translation_status', 'similarity_score',
        'query_embedding', 'category_embedding',
    ]);
    expect($data['category_name'])->toBe('패션의류');
    expect($data['similarity_score'])->toBe(0.9532);
    expect($data['query_embedding'])->toEqual([0.1, 0.2, 0.3]);
    expect($data['category_embedding'])->toBeNull(); // raw 없음 → null
});

test('RecommendResource — category_embedding_raw가 pgvector 문자열일 때 배열로 파싱한다', function () {
    $category = Category::factory()->create(['category_code' => 'CAT_test1', 'category_name_ko' => 'test']);
    $category->similarity_score = 0.5;
    $category->category_embedding_raw = '[0.1, 0.2, 0.3]';

    $resource = new RecommendResource($category);
    $data = $resource->toArray(request()->merge(['target_language' => 'ko']));

    expect($data['category_embedding'])->toEqual([0.1, 0.2, 0.3]);
});

// ──────────────────────────────────────────────
// 유사도 검색 quota 차감 테스트
// ──────────────────────────────────────────────

/**
 * 유사도 검색 요청에 사용할 공통 Mock 설정 헬퍼.
 * EmbeddingCacheService와 RecommendationService를 Mock하여
 * DB/pgvector 의존 없이 컨트롤러 로직만 검증한다.
 */
function setupRecommendMocks(): void
{
    $searchLog = new SearchLog([
        'search_keyword' => '검색어',
        'normalized_keyword' => '검색어',
        'embed_model_name' => 'bge-m3:latest',
    ]);
    $searchLog->embedding = array_fill(0, 1024, 0.05);

    $mockCache = Mockery::mock(EmbeddingCacheService::class);
    $mockCache->shouldReceive('getOrCreateEmbedding')->once()->andReturn($searchLog);
    app()->instance(EmbeddingCacheService::class, $mockCache);

    $paginator = new LengthAwarePaginator(
        items: collect([]),
        total: 0,
        perPage: 20,
        currentPage: 1,
    );

    $mockRecommend = Mockery::mock(RecommendationService::class);
    $mockRecommend->shouldReceive('recommendPaginated')->once()->andReturn($paginator);
    app()->instance(RecommendationService::class, $mockRecommend);
}

test('로그인 사용자 — 유사도 검색 시 api_quota_remaining이 1 차감된다', function () {
    $user = User::factory()->create([
        'api_quota_remaining' => 10,
        'api_quota_limit' => 100,
    ]);
    Sanctum::actingAs($user);

    setupRecommendMocks();

    $response = $this->postJson('/api/recommend', [
        'text' => '검색어',
        'target_language' => 'ko',
    ]);

    $response->assertOk();

    $user->refresh();
    expect($user->api_quota_remaining)->toBe(9);
});

test('로그인 사용자 — quota가 0이면 유사도 검색 시 429를 반환한다', function () {
    $user = User::factory()->create([
        'api_quota_remaining' => 0,
        'api_quota_limit' => 100,
    ]);
    Sanctum::actingAs($user);

    // quota 부족 시 서비스 호출 전 차단되므로 Mock 불필요
    $response = $this->postJson('/api/recommend', [
        'text' => '검색어',
        'target_language' => 'ko',
    ]);

    $response->assertStatus(429);
    $response->assertJsonPath('code', 'quota_exceeded');
});

test('비로그인 사용자 — 유사도 검색 시 quota 체크 없이 200을 반환한다', function () {
    setupRecommendMocks();

    $response = $this->postJson('/api/recommend', [
        'text' => '검색어',
        'target_language' => 'ko',
    ]);

    $response->assertOk();
});

test('관리자 — quota가 0이어도 유사도 검색 시 quota 체크를 우회한다', function () {
    $admin = User::factory()->create([
        'role' => 'admin',
        'api_quota_remaining' => 0,
        'api_quota_limit' => 100,
    ]);
    Sanctum::actingAs($admin);

    setupRecommendMocks();

    $response = $this->postJson('/api/recommend', [
        'text' => '검색어',
        'target_language' => 'ko',
    ]);

    $response->assertOk();
});

test('로그인 사용자 — text가 없으면 quota 차감 없이 200을 반환한다', function () {
    $category = Category::factory()->create([
        'category_code' => '50000000',
        'category_name_ko' => '패션의류',
    ]);

    $user = User::factory()->create([
        'api_quota_remaining' => 10,
        'api_quota_limit' => 100,
    ]);
    Sanctum::actingAs($user);

    $response = $this->postJson('/api/recommend', [
        'target_language' => 'ko',
    ]);

    $response->assertOk();

    $user->refresh();
    expect($user->api_quota_remaining)->toBe(10);
});
