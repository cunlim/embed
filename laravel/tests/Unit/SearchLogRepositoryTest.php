<?php

use App\Models\SearchLog;
use App\Repositories\SearchLogRepository;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function () {
    // search_logs 테이블 생성 — Unit 테스트이므로 user_id에 외래키 제약 없이 생성
    Schema::create('search_logs', function ($table) {
        $table->id();
        $table->unsignedBigInteger('user_id')->nullable();
        $table->string('session_id', 36)->nullable();
        $table->string('search_keyword', 500);
        $table->string('normalized_keyword', 500)->nullable();
        $table->string('embed_model_name', 100)->nullable();
        $table->text('embedding')->nullable();
        $table->timestamps();
        $table->index('normalized_keyword');
    });
});

afterEach(function () {
    Schema::dropIfExists('search_logs');
});

test('findByNormalizedKeyword — 정규화 키워드와 userId로 조회', function () {
    $repo = app(SearchLogRepository::class);

    $log = $repo->createSearchLog([
        'user_id' => 1,
        'session_id' => 'test-session',
        'search_keyword' => '청바지',
        'normalized_keyword' => '청바지',
        'embed_model_name' => 'bge-m3:latest',
    ]);

    $found = $repo->findByNormalizedKeyword('청바지', 1, 'test-session');

    expect($found)->not->toBeNull();
    expect($found->search_keyword)->toBe('청바지');
});

test('findByNormalizedKeyword — userId가 없으면 sessionId로 조회', function () {
    $repo = app(SearchLogRepository::class);

    $repo->createSearchLog([
        'session_id' => 'session-abc',
        'search_keyword' => 'NIKE SHOES',
        'normalized_keyword' => 'nike shoes',
        'embed_model_name' => 'bge-m3:latest',
    ]);

    $found = $repo->findByNormalizedKeyword('nike shoes', null, 'session-abc');

    expect($found)->not->toBeNull();
    expect($found->normalized_keyword)->toBe('nike shoes');
});

test('findByNormalizedKeyword — 일치하는 결과가 없으면 null 반환', function () {
    $repo = app(SearchLogRepository::class);

    $found = $repo->findByNormalizedKeyword('없는키워드', null, 'session-xyz');

    expect($found)->toBeNull();
});

test('createSearchLog — 검색 로그를 생성하고 SearchLog 인스턴스를 반환', function () {
    $repo = app(SearchLogRepository::class);

    $log = $repo->createSearchLog([
        'search_keyword' => '원피스',
        'normalized_keyword' => '원피스',
        'session_id' => 'session-def',
        'embed_model_name' => 'bge-m3:latest',
    ]);

    expect($log)->toBeInstanceOf(SearchLog::class);
    expect($log->search_keyword)->toBe('원피스');
    expect($log->normalized_keyword)->toBe('원피스');
});
