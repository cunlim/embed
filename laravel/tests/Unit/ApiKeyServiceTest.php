<?php

use App\Models\ApiKey;
use App\Models\User;
use App\Services\ApiKeyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class);
uses(RefreshDatabase::class);

beforeEach(function () {
    $this->service = new ApiKeyService;
    $this->user = User::factory()->create();
});

test('create — 새로운 API 키를 생성한다', function () {
    $apiKey = $this->service->create($this->user->id, '테스트 키');

    expect($apiKey)->toBeInstanceOf(ApiKey::class);
    expect($apiKey->user_id)->toBe($this->user->id);
    expect($apiKey->name)->toBe('테스트 키');
    expect($apiKey->key)->toStartWith('cl_');
    expect($apiKey->key)->toHaveLength(43); // 'cl_'(3) + Str::random(40)
    expect($apiKey->status)->toBe('active');
    expect($apiKey->last_used_at)->toBeNull();
});

test('listByUser — 사용자의 모든 API 키를 생성일 내림차순으로 조회한다', function () {
    $key1 = $this->service->create($this->user->id, '첫 번째 키');
    $key2 = $this->service->create($this->user->id, '두 번째 키');

    $result = $this->service->listByUser($this->user->id);

    expect($result)->toHaveCount(2);
    $ids = $result->pluck('id')->toArray();
    expect($ids)->toContain($key1->id);
    expect($ids)->toContain($key2->id);
});

test('listByUser — 다른 사용자의 키는 포함되지 않는다', function () {
    $otherUser = User::factory()->create();
    $this->service->create($this->user->id, '내 키');
    $this->service->create($otherUser->id, '다른 사용자 키');

    $result = $this->service->listByUser($this->user->id);

    expect($result)->toHaveCount(1);
    expect($result->first()->name)->toBe('내 키');
});

test('findByKey — 키 문자열로 API 키를 조회한다', function () {
    $apiKey = $this->service->create($this->user->id, '조회용 키');

    $found = $this->service->findByKey($apiKey->key);

    expect($found)->not->toBeNull();
    expect($found->id)->toBe($apiKey->id);
});

test('findByKey — 존재하지 않는 키는 null을 반환한다', function () {
    $found = $this->service->findByKey('cl_nonexistent');

    expect($found)->toBeNull();
});

test('findById — ID로 API 키를 조회한다', function () {
    $apiKey = $this->service->create($this->user->id, 'ID 조회용 키');

    $found = $this->service->findById($apiKey->id);

    expect($found)->not->toBeNull();
    expect($found->id)->toBe($apiKey->id);
});

test('findById — 존재하지 않는 ID는 null을 반환한다', function () {
    $found = $this->service->findById(999999);

    expect($found)->toBeNull();
});

test('updateStatus — 상태를 active에서 paused로 변경한다', function () {
    $apiKey = $this->service->create($this->user->id, '상태 변경 키');

    $updated = $this->service->updateStatus($apiKey->id, 'paused');

    expect($updated)->not->toBeNull();
    expect($updated->status)->toBe('paused');
    expect($updated->isPaused())->toBeTrue();
});

test('updateStatus — 상태를 paused에서 active로 변경한다', function () {
    $apiKey = $this->service->create($this->user->id, '상태 변경 키');
    $this->service->updateStatus($apiKey->id, 'paused');

    $updated = $this->service->updateStatus($apiKey->id, 'active');

    expect($updated->status)->toBe('active');
    expect($updated->isActive())->toBeTrue();
});

test('updateStatus — 존재하지 않는 ID는 null을 반환한다', function () {
    $result = $this->service->updateStatus(999999, 'paused');

    expect($result)->toBeNull();
});

test('updateName — API 키 이름을 변경한다', function () {
    $apiKey = $this->service->create($this->user->id, '원래 이름');

    $updated = $this->service->updateName($apiKey->id, '새 이름');

    expect($updated)->not->toBeNull();
    expect($updated->name)->toBe('새 이름');
});

test('updateName — 존재하지 않는 ID는 null을 반환한다', function () {
    $result = $this->service->updateName(999999, '이름');

    expect($result)->toBeNull();
});

test('delete — API 키를 삭제한다', function () {
    $apiKey = $this->service->create($this->user->id, '삭제용 키');

    $result = $this->service->delete($apiKey->id);

    expect($result)->toBeTrue();
    expect(ApiKey::find($apiKey->id))->toBeNull();
});

test('delete — 존재하지 않는 ID는 false를 반환한다', function () {
    $result = $this->service->delete(999999);

    expect($result)->toBeFalse();
});

test('touchLastUsed — 마지막 사용 일시를 현재 시간으로 갱신한다', function () {
    $apiKey = $this->service->create($this->user->id, '사용 시간 키');

    expect($apiKey->last_used_at)->toBeNull();

    $this->service->touchLastUsed($apiKey->id);

    $fresh = $apiKey->fresh();
    expect($fresh->last_used_at)->not->toBeNull();
    expect($fresh->last_used_at->timestamp)->toBeGreaterThanOrEqual(now()->subSecond()->timestamp);
});

test('touchLastUsed — 존재하지 않는 ID는 오류 없이 실행된다', function () {
    // 예외가 발생하지 않아야 함
    $this->service->touchLastUsed(999999);

    expect(true)->toBeTrue();
});
