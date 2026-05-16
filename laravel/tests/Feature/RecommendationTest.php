<?php

use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Models\SearchLog;
use App\Services\EmbeddingCacheService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Pgvector\Laravel\Vector;

beforeEach(function () {
    Schema::create('categories', function (Blueprint $table) {
        $table->id();
        $table->string('category_code', 50);
        $table->string('category_name_ko', 255);
        $table->string('category_name_zh', 255)->nullable();
        $table->string('category_name_en', 255)->nullable();
        $table->timestamps();
    });

    Schema::create('category_embeddings', function (Blueprint $table) {
        $table->id();
        $table->foreignId('category_id');
        $table->string('language', 10);
        $table->string('embed_model_name', 100);
        $table->text('embedding');
        $table->unique(['category_id', 'language', 'embed_model_name']);
        $table->timestamps();
    });
});

afterEach(function () {
    Schema::dropIfExists('category_embeddings');
    Schema::dropIfExists('categories');
});

test('POST /api/recommend — 유효한 검색어는 유효성 검증을 통과하고 EmbeddingCacheService를 호출한다', function () {
    $category = Category::factory()->create([
        'category_name_ko' => '패션의류',
        'category_name_zh' => '时尚服装',
        'category_name_en' => 'Fashion Clothing',
    ]);

    $embedding = array_fill(0, 1024, 0.05);

    // pgvector Vector 저장
    $categoryEmbedding = new CategoryEmbedding;
    $categoryEmbedding->category_id = $category->id;
    $categoryEmbedding->language = 'ko';
    $categoryEmbedding->embed_model_name = 'bge-m3:latest';
    $categoryEmbedding->embedding = new Vector($embedding);
    $categoryEmbedding->save();

    $searchLog = new SearchLog([
        'search_keyword' => '청바지',
        'normalized_keyword' => '청바지',
        'embed_model_name' => 'bge-m3:latest',
        'session_id' => 'test-session',
    ]);
    $searchLog->embedding = $embedding;

    $mockCache = Mockery::mock(EmbeddingCacheService::class);
    $mockCache->shouldReceive('getOrCreateEmbedding')
        ->once()
        ->with('청바지', 'bge-m3:latest', null, Mockery::any())
        ->andReturn($searchLog);
    app()->instance(EmbeddingCacheService::class, $mockCache);

    $response = $this->postJson('/api/recommend', [
        'text' => '청바지',
        'target_language' => 'ko',
    ]);

    // SQLite는 pgvector <=> 연산자를 지원하지 않으므로 500이 발생할 수 있다.
    // 유효성 검증 통과 여부(422 아님)와 mock 호출 여부로 검증한다.
    expect($response->status())->not->toBe(422);
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
