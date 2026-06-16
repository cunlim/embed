<?php

use App\Models\Category;
use App\Models\SearchLog;
use App\Models\User;
use App\Services\ApiKeyService;
use App\Services\ApiUsageService;
use App\Services\EmbeddingCacheService;
use App\Services\RecommendationService;
use Illuminate\Pagination\LengthAwarePaginator;

beforeEach(function () {
    $this->user = User::factory()->create([
        'api_quota_remaining' => 10,
        'api_quota_limit' => 10,
    ]);
    $this->apiKey = app(ApiKeyService::class)->create($this->user->id, '테스트 키');
});

/**
 * 공통 목업 설정 헬퍼
 */
function setupMocks($test, $paginator = null): void
{
    $category = new Category([
        'category_code' => '50000000',
        'category_name_ko' => '패션의류',
        'category_name_zh' => '时尚服装',
        'category_name_en' => 'Fashion Clothing',
        'translation_status' => 'completed',
    ]);
    $category->id = 1;
    $category->similarity_score = 0.95;
    $category->category_name = '패션의류';

    $paginator ??= new LengthAwarePaginator(
        items: collect([$category]),
        total: 1,
        perPage: 20,
        currentPage: 1,
    );

    $searchLog = new SearchLog([
        'search_keyword' => '청바지',
        'normalized_keyword' => '청바지',
        'embed_model_name' => 'bge-m3:latest',
    ]);
    $searchLog->embedding = array_fill(0, 1024, 0.05);

    $mockCache = Mockery::mock(EmbeddingCacheService::class);
    $mockCache->shouldReceive('getOrCreateEmbedding')
        ->once()
        ->andReturn($searchLog);
    app()->instance(EmbeddingCacheService::class, $mockCache);

    $mockRecommend = Mockery::mock(RecommendationService::class);
    $mockRecommend->shouldReceive('recommendPaginated')
        ->once()
        ->andReturn($paginator);
    app()->instance(RecommendationService::class, $mockRecommend);

    $mockUsage = Mockery::mock(ApiUsageService::class);
    $mockUsage->shouldReceive('log')->once();
    app()->instance(ApiUsageService::class, $mockUsage);
}

test('POST /api/v1/search — 유효한 검색은 결과를 반환한다', function () {
    setupMocks($this);

    $response = $this->withHeader('Authorization', "Bearer {$this->apiKey->plain_key}")
        ->postJson('/api/v1/search', [
            'text' => '청바지',
        ]);

    $response->assertOk()
        ->assertJsonStructure([
            'data' => [['category_code', 'category_name', 'similarity_score']],
        ])
        ->assertJsonPath('data.0.category_code', '50000000')
        ->assertJsonPath('data.0.similarity_score', 0.95);
});

test('POST /api/v1/search — 검색 후 사용 로그가 기록된다', function () {
    setupMocks($this);

    $response = $this->withHeader('Authorization', "Bearer {$this->apiKey->plain_key}")
        ->postJson('/api/v1/search', [
            'text' => '청바지',
        ]);

    $response->assertOk();
});

test('POST /api/v1/search — 검색 후 쿼터가 차감된다', function () {
    setupMocks($this);

    $response = $this->withHeader('Authorization', "Bearer {$this->apiKey->plain_key}")
        ->postJson('/api/v1/search', [
            'text' => '청바지',
        ]);

    $response->assertOk();

    $this->user->refresh();
    $this->assertEquals(9, $this->user->api_quota_remaining);
});

test('POST /api/v1/search — 기본 target_language는 ko이다', function () {
    $searchLog = new SearchLog([
        'search_keyword' => '청바지',
        'normalized_keyword' => '청바지',
        'embed_model_name' => 'bge-m3:latest',
    ]);
    $searchLog->embedding = array_fill(0, 1024, 0.05);

    $category = new Category([
        'category_code' => '50000000',
        'category_name_ko' => '패션의류',
        'translation_status' => 'completed',
    ]);
    $category->id = 1;
    $category->similarity_score = 0.95;
    $category->category_name = '패션의류';

    $paginator = new LengthAwarePaginator(
        items: collect([$category]),
        total: 1,
        perPage: 20,
        currentPage: 1,
    );

    $mockCache = Mockery::mock(EmbeddingCacheService::class);
    $mockCache->shouldReceive('getOrCreateEmbedding')
        ->once()
        ->andReturn($searchLog);
    app()->instance(EmbeddingCacheService::class, $mockCache);

    $mockRecommend = Mockery::mock(RecommendationService::class);
    $mockRecommend->shouldReceive('recommendPaginated')
        ->once()
        ->with(
            Mockery::type(SearchLog::class),
            'ko',
            20,
            1,
            $this->user->id,
            null,
            null,
            null
        )
        ->andReturn($paginator);
    app()->instance(RecommendationService::class, $mockRecommend);

    $mockUsage = Mockery::mock(ApiUsageService::class);
    $mockUsage->shouldReceive('log')->once();
    app()->instance(ApiUsageService::class, $mockUsage);

    $response = $this->withHeader('Authorization', "Bearer {$this->apiKey->plain_key}")
        ->postJson('/api/v1/search', [
            'text' => '청바지',
        ]);

    $response->assertOk();
});

test('POST /api/v1/search — mode=hierarchy+lang은 searchLang을 전달한다', function () {
    $searchLog = new SearchLog([
        'search_keyword' => '청바지',
        'normalized_keyword' => '청바지',
        'embed_model_name' => 'bge-m3:latest',
    ]);
    $searchLog->embedding = array_fill(0, 1024, 0.05);

    $category = new Category([
        'category_code' => '50000000',
        'category_name_ko' => '패션의류',
        'translation_status' => 'completed',
    ]);
    $category->id = 1;
    $category->similarity_score = 0.95;
    $category->category_name = '패션의류';

    $paginator = new LengthAwarePaginator(
        items: collect([$category]),
        total: 1,
        perPage: 20,
        currentPage: 1,
    );

    $mockCache = Mockery::mock(EmbeddingCacheService::class);
    $mockCache->shouldReceive('getOrCreateEmbedding')
        ->once()
        ->andReturn($searchLog);
    app()->instance(EmbeddingCacheService::class, $mockCache);

    $mockRecommend = Mockery::mock(RecommendationService::class);
    $mockRecommend->shouldReceive('recommendPaginated')
        ->once()
        ->with(
            Mockery::type(SearchLog::class),
            'ko',
            20,
            1,
            $this->user->id,
            null,
            null,
            'en'
        )
        ->andReturn($paginator);
    app()->instance(RecommendationService::class, $mockRecommend);

    $mockUsage = Mockery::mock(ApiUsageService::class);
    $mockUsage->shouldReceive('log')->once();
    app()->instance(ApiUsageService::class, $mockUsage);

    $response = $this->withHeader('Authorization', "Bearer {$this->apiKey->plain_key}")
        ->postJson('/api/v1/search', [
            'text' => '청바지',
            'mode' => 'hierarchy',
            'lang' => 'en',
        ]);

    $response->assertOk();
});

test('POST /api/v1/search — text 없으면 검증 실패', function () {
    $response = $this->withHeader('Authorization', "Bearer {$this->apiKey->plain_key}")
        ->postJson('/api/v1/search', []);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['text']);
});

test('POST /api/v1/search — 유효하지 않은 mode는 검증 실패', function () {
    $response = $this->withHeader('Authorization', "Bearer {$this->apiKey->plain_key}")
        ->postJson('/api/v1/search', [
            'text' => '청바지',
            'mode' => 'invalid',
        ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['mode']);
});

test('POST /api/v1/search — 유효하지 않은 target_language는 검증 실패', function () {
    $response = $this->withHeader('Authorization', "Bearer {$this->apiKey->plain_key}")
        ->postJson('/api/v1/search', [
            'text' => '청바지',
            'target_language' => 'ja',
        ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['target_language']);
});

test('POST /api/v1/search — API 키 없으면 401 반환', function () {
    $response = $this->postJson('/api/v1/search', [
        'text' => '청바지',
    ]);

    $response->assertStatus(401);
});

test('POST /api/v1/search — X-Processing-Time-Ms 헤더를 포함한다', function () {
    setupMocks($this);

    $response = $this->withHeader('Authorization', "Bearer {$this->apiKey->plain_key}")
        ->postJson('/api/v1/search', [
            'text' => '청바지',
        ]);

    $response->assertOk()
        ->assertHeader('X-Processing-Time-Ms');
});

test('POST /api/v1/search — 마지막 사용 시간이 갱신된다', function () {
    $this->assertNull($this->apiKey->last_used_at);

    setupMocks($this);

    $response = $this->withHeader('Authorization', "Bearer {$this->apiKey->plain_key}")
        ->postJson('/api/v1/search', [
            'text' => '청바지',
        ]);

    $response->assertOk();

    $this->apiKey->refresh();
    $this->assertNotNull($this->apiKey->last_used_at);
});
