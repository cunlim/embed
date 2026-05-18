<?php

use App\Models\Category;
use App\Models\SearchLog;
use App\Services\EmbeddingCacheService;
use App\Services\RecommendationService;
use Illuminate\Pagination\LengthAwarePaginator;

beforeEach(function () {
    // RecommendationService mock을 사용하므로 DB 테이블은 불필요
});

test('POST /api/recommend — 유효한 검색어는 RecommendationService를 호출하고 결과를 반환한다', function () {
    $searchLog = new SearchLog([
        'search_keyword' => '청바지',
        'normalized_keyword' => '청바지',
        'embed_model_name' => 'bge-m3:latest',
        'session_id' => 'test-session',
    ]);
    $searchLog->embedding = array_fill(0, 1024, 0.05);

    $mockCache = Mockery::mock(EmbeddingCacheService::class);
    $mockCache->shouldReceive('getOrCreateEmbedding')
        ->once()
        ->with('청바지', 'bge-m3:latest', null, Mockery::any())
        ->andReturn($searchLog);
    app()->instance(EmbeddingCacheService::class, $mockCache);

    $category = new Category([
        'category_code' => '50000000',
        'category_name_ko' => '패션의류',
        'category_name_zh' => '时尚服装',
        'category_name_en' => 'Fashion Clothing',
        'translation_status' => 'completed',
    ]);
    $category->id = 1;
    $category->similarity_score = 0.95;

    $items = collect([$category]);
    $paginator = new LengthAwarePaginator(
        items: $items,
        total: 1,
        perPage: 20,
        currentPage: 1,
    );

    $mockRecommend = Mockery::mock(RecommendationService::class);
    $mockRecommend->shouldReceive('recommendPaginated')
        ->once()
        ->with(Mockery::type(SearchLog::class), 'ko', 20, 1)
        ->andReturn($paginator);
    app()->instance(RecommendationService::class, $mockRecommend);

    $response = $this->postJson('/api/recommend', [
        'text' => '청바지',
        'target_language' => 'ko',
    ]);

    $response->assertOk()
        ->assertJsonStructure([
            'data' => [['id', 'category_code', 'category_name', 'similarity_score']],
            'meta' => ['current_page', 'last_page', 'total', 'per_page'],
        ])
        ->assertJsonPath('data.0.category_code', '50000000')
        ->assertJsonPath('data.0.category_name', '패션의류')
        ->assertJsonPath('data.0.similarity_score', 0.95);

    $mockCache->shouldHaveReceived('getOrCreateEmbedding')->once();
    $mockRecommend->shouldHaveReceived('recommendPaginated')->once();
});

test('POST /api/recommend — 빈 검색어는 일반 카테고리 목록을 반환한다', function () {
    $response = $this->postJson('/api/recommend', [
        'text' => '',
        'target_language' => 'ko',
    ]);

    $response->assertOk()
        ->assertJsonStructure([
            'data' => [],
            'meta' => ['current_page', 'last_page', 'total', 'per_page'],
        ]);
});

test('POST /api/recommend — 지원하지 않는 언어는 422 에러를 반환한다', function () {
    $response = $this->postJson('/api/recommend', [
        'text' => '검색어',
        'target_language' => 'ja',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['target_language']);
});
