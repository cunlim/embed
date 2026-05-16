<?php

use App\Models\SearchLog;
use App\Models\User;
use App\Repositories\SearchLogRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

uses(TestCase::class);
uses(RefreshDatabase::class);

test('findByNormalizedKeyword — 정규화 키워드와 userId로 조회', function () {
    $repo = app(SearchLogRepository::class);
    $sid = Str::uuid()->toString();

    $user = User::factory()->create();

    $log = $repo->createSearchLog([
        'user_id' => $user->id,
        'session_id' => $sid,
        'search_keyword' => '청바지',
        'normalized_keyword' => '청바지',
        'embed_model_name' => 'bge-m3:latest',
    ]);

    $found = $repo->findByNormalizedKeyword('청바지', $user->id, $sid);

    expect($found)->not->toBeNull();
    expect($found->search_keyword)->toBe('청바지');
});

test('findByNormalizedKeyword — userId가 없으면 sessionId로 조회', function () {
    $repo = app(SearchLogRepository::class);
    $sid = Str::uuid()->toString();

    $repo->createSearchLog([
        'session_id' => $sid,
        'search_keyword' => 'NIKE SHOES',
        'normalized_keyword' => 'nike shoes',
        'embed_model_name' => 'bge-m3:latest',
    ]);

    $found = $repo->findByNormalizedKeyword('nike shoes', null, $sid);

    expect($found)->not->toBeNull();
    expect($found->normalized_keyword)->toBe('nike shoes');
});

test('findByNormalizedKeyword — 일치하는 결과가 없으면 null 반환', function () {
    $repo = app(SearchLogRepository::class);

    $found = $repo->findByNormalizedKeyword('없는키워드', null, Str::uuid()->toString());

    expect($found)->toBeNull();
});

test('createSearchLog — 검색 로그를 생성하고 SearchLog 인스턴스를 반환', function () {
    $repo = app(SearchLogRepository::class);

    $log = $repo->createSearchLog([
        'search_keyword' => '원피스',
        'normalized_keyword' => '원피스',
        'session_id' => Str::uuid()->toString(),
        'embed_model_name' => 'bge-m3:latest',
    ]);

    expect($log)->toBeInstanceOf(SearchLog::class);
    expect($log->search_keyword)->toBe('원피스');
    expect($log->normalized_keyword)->toBe('원피스');
});
