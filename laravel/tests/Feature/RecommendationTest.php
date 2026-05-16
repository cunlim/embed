<?php

use App\Models\SearchLog;
use App\Services\EmbeddingCacheService;
use App\Services\RecommendationService;

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

    $recommendations = [
        (object) [
            'category_code' => '50000000',
            'category_name' => '패션의류',
            'similarity_score' => 0.95,
        ],
        (object) [
            'category_code' => '50000001',
            'category_name' => '여성의류',
            'similarity_score' => 0.87,
        ],
    ];

    $mockRecommend = Mockery::mock(RecommendationService::class);
    $mockRecommend->shouldReceive('recommend')
        ->once()
        ->with(Mockery::type(SearchLog::class), 'ko')
        ->andReturn($recommendations);
    app()->instance(RecommendationService::class, $mockRecommend);

    $response = $this->postJson('/api/recommend', [
        'text' => '청바지',
        'target_language' => 'ko',
    ]);

    $response->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.category_code', '50000000')
        ->assertJsonPath('data.0.category_name', '패션의류')
        ->assertJsonPath('data.0.similarity_score', 0.95);

    $mockCache->shouldHaveReceived('getOrCreateEmbedding')->once();
    $mockRecommend->shouldHaveReceived('recommend')->once();
});

test('POST /api/recommend — 빈 검색어는 422 에러를 반환한다', function () {
    $response = $this->postJson('/api/recommend', [
        'text' => '',
        'target_language' => 'ko',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['text']);
});

test('POST /api/recommend — 지원하지 않는 언어는 422 에러를 반환한다', function () {
    $response = $this->postJson('/api/recommend', [
        'text' => '검색어',
        'target_language' => 'ja',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['target_language']);
});
