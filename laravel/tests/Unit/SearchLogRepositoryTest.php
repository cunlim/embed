<?php

use App\Models\SearchLog;
use App\Models\User;
use App\Repositories\SearchLogRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class);
uses(RefreshDatabase::class);

test('findByNormalizedKeyword — 정규화 키워드로 회원 검색 로그 조회', function () {
    $repo = app(SearchLogRepository::class);

    $user = User::factory()->create();

    $repo->createSearchLog([
        'user_id' => $user->id,
        'search_keyword' => '청바지',
        'normalized_keyword' => '청바지',
        'embed_model_name' => 'bge-m3:latest',
    ]);

    $found = $repo->findByNormalizedKeyword('청바지');

    expect($found)->not->toBeNull();
    expect($found->search_keyword)->toBe('청바지');
});

test('findByNormalizedKeyword — 정규화 키워드로 비회원 검색 로그도 조회된다', function () {
    $repo = app(SearchLogRepository::class);

    $repo->createSearchLog([
        'search_keyword' => 'NIKE SHOES',
        'normalized_keyword' => 'nike shoes',
        'embed_model_name' => 'bge-m3:latest',
    ]);

    $found = $repo->findByNormalizedKeyword('nike shoes');

    expect($found)->not->toBeNull();
    expect($found->normalized_keyword)->toBe('nike shoes');
});

test('findByNormalizedKeyword — 일치하는 결과가 없으면 null 반환', function () {
    $repo = app(SearchLogRepository::class);

    $found = $repo->findByNormalizedKeyword('없는키워드');

    expect($found)->toBeNull();
});

test('createSearchLog — 검색 로그를 생성하고 SearchLog 인스턴스를 반환', function () {
    $repo = app(SearchLogRepository::class);

    $log = $repo->createSearchLog([
        'search_keyword' => '원피스',
        'normalized_keyword' => '원피스',
        'embed_model_name' => 'bge-m3:latest',
    ]);

    expect($log)->toBeInstanceOf(SearchLog::class);
    expect($log->search_keyword)->toBe('원피스');
    expect($log->normalized_keyword)->toBe('원피스');
});
