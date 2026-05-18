<?php

use App\Http\Resources\RecommendResource;
use App\Models\Category;
use App\Models\SearchLog;
use App\Services\EmbeddingCacheService;

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
        'session_id' => 'test-session',
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

    $resource = new RecommendResource($category);
    $data = $resource->toArray(request()->merge(['target_language' => 'ko']));

    expect($data)->toHaveKeys([
        'id', 'category_code', 'category_name_ko', 'category_name_zh',
        'category_name_en', 'category_name', 'translation_status', 'similarity_score',
    ]);
    expect($data['category_name'])->toBe('패션의류');
    expect($data['similarity_score'])->toBe(0.9532);
});
