<?php

use App\Models\SearchLog;
use App\Models\User;
use App\Services\EmbeddingCacheService;
use App\Services\EmbeddingGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Pgvector\Laravel\Vector;
use Tests\TestCase;

uses(TestCase::class);
uses(RefreshDatabase::class);

test('getOrCreateEmbedding — 캐시 히트 시 임베딩을 재생성하지 않는다', function () {
    $embedding = array_fill(0, 1024, 0.1);

    $user = User::factory()->create([
        'name' => 'Test User',
        'email' => 'test@example.com',
    ]);

    SearchLog::create([
        'user_id' => $user->id,
        'search_keyword' => 'NIKE Shoes',
        'normalized_keyword' => 'nike shoes',
        'embed_model_name' => 'bge-m3:latest',
        'embedding' => $embedding,
    ]);

    $mockGenerator = $this->mock(EmbeddingGenerator::class);
    $mockGenerator->shouldReceive('generate')->never();

    $service = app(EmbeddingCacheService::class);
    $result = $service->getOrCreateEmbedding('  NIKE   SHOES  ', 'bge-m3:latest', $user->id);

    expect($result)->toBeInstanceOf(SearchLog::class);
    expect($result->search_keyword)->toBe('NIKE Shoes');
    expect($result->normalized_keyword)->toBe('nike shoes');
});

test('getOrCreateEmbedding — 캐시 미스 시 새 임베딩을 생성하고 저장한다', function () {
    $embedding = array_fill(0, 1024, 0.05);

    $mockGenerator = $this->mock(EmbeddingGenerator::class);
    $mockGenerator->shouldReceive('generate')
        ->with('청바지')
        ->once()
        ->andReturn($embedding);

    $service = app(EmbeddingCacheService::class);
    $result = $service->getOrCreateEmbedding('청바지', 'bge-m3:latest');

    expect($result)->toBeInstanceOf(SearchLog::class);
    expect($result->search_keyword)->toBe('청바지');
    expect($result->normalized_keyword)->toBe('청바지');
    expect($result->embed_model_name)->toBe('bge-m3:latest');

    $saved = SearchLog::query()
        ->where('normalized_keyword', '청바지')
        ->first();

    expect($saved)->not->toBeNull();
});

test('getOrCreateEmbedding — 정규화를 통해 공백/대소문자 차이가 있는 키워드가 캐시 히트된다', function () {
    $embedding = array_fill(0, 1024, 0.2);

    SearchLog::create([
        'search_keyword' => '  NIKE   Air   Max  ',
        'normalized_keyword' => 'nike air max',
        'embed_model_name' => 'bge-m3:latest',
        'embedding' => $embedding,
    ]);

    $mockGenerator = $this->mock(EmbeddingGenerator::class);
    $mockGenerator->shouldReceive('generate')->never();

    $service = app(EmbeddingCacheService::class);
    $result = $service->getOrCreateEmbedding('NIKE air max', 'bge-m3:latest');

    expect($result->search_keyword)->toBe('  NIKE   Air   Max  ');
    expect($result->normalized_keyword)->toBe('nike air max');
});

test('getOrCreateEmbedding — 같은 키워드는 모든 사용자가 캐시를 공유한다', function () {
    $sharedEmbedding = array_fill(0, 1024, 0.1);

    $user1 = User::factory()->create([
        'name' => 'User 1',
        'email' => 'user1@example.com',
    ]);

    SearchLog::create([
        'user_id' => $user1->id,
        'search_keyword' => '운동화',
        'normalized_keyword' => '운동화',
        'embed_model_name' => 'bge-m3:latest',
        'embedding' => $sharedEmbedding,
    ]);

    $mockGenerator = $this->mock(EmbeddingGenerator::class);
    $mockGenerator->shouldReceive('generate')->never();

    $service = app(EmbeddingCacheService::class);
    $result = $service->getOrCreateEmbedding('운동화', 'bge-m3:latest', null);

    expect($result->user_id)->toBe($user1->id);
    expect($result->embedding)->toBeInstanceOf(Vector::class);
});
