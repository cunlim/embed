<?php

use App\Models\ApiKey;
use App\Models\ApiUsageLog;
use App\Models\User;
use App\Services\ApiUsageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

uses(TestCase::class);
uses(RefreshDatabase::class);

beforeEach(function () {
    $this->service = new ApiUsageService;
    $this->user = User::factory()->create();
    $this->apiKey = ApiKey::factory()->create(['user_id' => $this->user->id]);
});

test('log — API 사용 로그를 기록한다', function () {
    $log = $this->service->log(
        apiKeyId: $this->apiKey->id,
        userId: $this->user->id,
        endpoint: '/api/v1/search',
        parameters: ['similarity_query' => '청바지'],
        responseStatus: 200,
        processingTimeMs: 150,
    );

    expect($log)->toBeInstanceOf(ApiUsageLog::class);
    expect($log->api_key_id)->toBe($this->apiKey->id);
    expect($log->user_id)->toBe($this->user->id);
    expect($log->endpoint)->toBe('/api/v1/search');
    expect($log->parameters)->toBe(['similarity_query' => '청바지']);
    expect($log->response_status)->toBe(200);
    expect($log->processing_time_ms)->toBe(150);
});

test('log — parameters가 null일 때도 기록된다', function () {
    $log = $this->service->log(
        apiKeyId: $this->apiKey->id,
        userId: $this->user->id,
        endpoint: '/api/v1/search',
        parameters: null,
        responseStatus: 200,
        processingTimeMs: 100,
    );

    expect($log->parameters)->toBeNull();
});

test('getTotalCalls — 사용자의 총 API 호출 횟수를 반환한다', function () {
    // 3개 로그 생성
    for ($i = 0; $i < 3; $i++) {
        $this->service->log($this->apiKey->id, $this->user->id, '/api/v1/search', null, 200, 100);
    }

    expect($this->service->getTotalCalls($this->user->id))->toBe(3);
});

test('getTotalCalls — 로그가 없으면 0을 반환한다', function () {
    expect($this->service->getTotalCalls($this->user->id))->toBe(0);
});

test('getTotalCalls — 다른 사용자의 로그는 포함되지 않는다', function () {
    $otherUser = User::factory()->create();
    $otherKey = ApiKey::factory()->create(['user_id' => $otherUser->id]);

    $this->service->log($this->apiKey->id, $this->user->id, '/api/v1/search', null, 200, 100);
    $this->service->log($otherKey->id, $otherUser->id, '/api/v1/search', null, 200, 100);

    expect($this->service->getTotalCalls($this->user->id))->toBe(1);
});

test('getTodayCalls — 오늘의 API 호출 횟수를 반환한다', function () {
    // 오늘 로그 2개
    $this->service->log($this->apiKey->id, $this->user->id, '/api/v1/search', null, 200, 100);
    $this->service->log($this->apiKey->id, $this->user->id, '/api/v1/search', null, 200, 100);

    expect($this->service->getTodayCalls($this->user->id))->toBe(2);
});

test('getTodayCalls — 어제 로그는 포함되지 않는다', function () {
    // 어제 로그를 DB에 직접 삽입하여 타임존 문제 방지
    DB::table('api_usage_logs')->insert([
        'api_key_id' => $this->apiKey->id,
        'user_id' => $this->user->id,
        'endpoint' => '/api/v1/search',
        'parameters' => null,
        'response_status' => 200,
        'processing_time_ms' => 100,
        'created_at' => Carbon::now()->subDay()->toDateTimeString(),
        'updated_at' => Carbon::now()->subDay()->toDateTimeString(),
    ]);

    expect($this->service->getTodayCalls($this->user->id))->toBe(0);
});

test('getActiveKeyCount — 활성 API 키 개수를 반환한다', function () {
    ApiKey::factory()->create(['user_id' => $this->user->id, 'status' => 'active']);
    ApiKey::factory()->create(['user_id' => $this->user->id, 'status' => 'active']);
    ApiKey::factory()->paused()->create(['user_id' => $this->user->id, 'status' => 'paused']);

    expect($this->service->getActiveKeyCount($this->user->id))->toBe(3); // beforeEach에서 생성한 1개 + 2개
});

test('getActiveKeyCount — 일시정지된 키는 포함되지 않는다', function () {
    ApiKey::factory()->paused()->create(['user_id' => $this->user->id, 'status' => 'paused']);

    expect($this->service->getActiveKeyCount($this->user->id))->toBe(1); // beforeEach의 1개만
});

test('getCallsByKey — API 키별 호출 횟수를 그룹핑한다', function () {
    $key1 = ApiKey::factory()->create(['user_id' => $this->user->id, 'name' => '키1']);
    $key2 = ApiKey::factory()->create(['user_id' => $this->user->id, 'name' => '키2']);

    // key1: 3회, key2: 1회
    for ($i = 0; $i < 3; $i++) {
        $this->service->log($key1->id, $this->user->id, '/api/v1/search', null, 200, 100);
    }
    $this->service->log($key2->id, $this->user->id, '/api/v1/search', null, 200, 100);

    $result = $this->service->getCallsByKey($this->user->id);

    expect($result)->toHaveCount(2);

    $key1Data = $result->firstWhere('api_key_id', $key1->id);
    expect($key1Data->total)->toBe(3);
    // apiKey 관계가 로드되어야 함
    expect($key1Data->apiKey)->not->toBeNull();
    expect($key1Data->apiKey->name)->toBe('키1');

    $key2Data = $result->firstWhere('api_key_id', $key2->id);
    expect($key2Data->total)->toBe(1);
    expect($key2Data->apiKey)->not->toBeNull();
    expect($key2Data->apiKey->name)->toBe('키2');
});

test('getCallsByKey — 로그가 없으면 빈 컬렉션을 반환한다', function () {
    $result = $this->service->getCallsByKey($this->user->id);

    expect($result)->toHaveCount(0);
});

test('getRecentHistory — 최근 사용 내역을 apiKey 관계와 함께 반환한다', function () {
    $this->service->log($this->apiKey->id, $this->user->id, '/api/v1/search', null, 200, 100);
    $this->service->log($this->apiKey->id, $this->user->id, '/api/v1/search', null, 200, 150);

    $history = $this->service->getRecentHistory($this->user->id);

    expect($history)->toHaveCount(2);
    // 두 로그가 모두 포함되어야 함
    $endpoints = $history->pluck('endpoint')->toArray();
    expect($endpoints)->toContain('/api/v1/search');
    expect($endpoints)->toContain('/api/v1/search');
    // apiKey 관계가 로드되어야 함
    expect($history->first()->apiKey)->not->toBeNull();
    expect($history->first()->apiKey->id)->toBe($this->apiKey->id);
});

test('getRecentHistory — limit 파라미터가 적용된다', function () {
    for ($i = 0; $i < 5; $i++) {
        $this->service->log($this->apiKey->id, $this->user->id, '/api/v1/search', null, 200, 100);
    }

    $history = $this->service->getRecentHistory($this->user->id, 3);

    expect($history)->toHaveCount(3);
});

test('getRecentHistory — 기본 limit는 20이다', function () {
    for ($i = 0; $i < 25; $i++) {
        $this->service->log($this->apiKey->id, $this->user->id, '/api/v1/search', null, 200, 100);
    }

    $history = $this->service->getRecentHistory($this->user->id);

    expect($history)->toHaveCount(20);
});

test('getDailyChart — 최근 N일간의 일별 호출 횟수를 반환한다', function () {
    // 오늘 2건 기록
    $this->service->log($this->apiKey->id, $this->user->id, '/api/v1/search', null, 200, 100);
    $this->service->log($this->apiKey->id, $this->user->id, '/api/v1/search', null, 200, 100);

    // 어제 1건 기록 (DB 직접 삽입으로 타임존 문제 방지)
    DB::table('api_usage_logs')->insert([
        'api_key_id' => $this->apiKey->id,
        'user_id' => $this->user->id,
        'endpoint' => '/api/v1/search',
        'parameters' => null,
        'response_status' => 200,
        'processing_time_ms' => 100,
        'created_at' => Carbon::now()->subDay()->toDateTimeString(),
        'updated_at' => Carbon::now()->subDay()->toDateTimeString(),
    ]);

    $chart = $this->service->getDailyChart($this->user->id, 7);

    expect($chart)->toHaveCount(7);
    // 첫 번째 날(6일 전)은 0
    expect($chart[0]['total'])->toBe(0);
    // 어제(인덱스 5)는 1건
    expect($chart[5]['total'])->toBe(1);
    // 오늘 총 호출 수도 검증
    $todayTotal = $this->service->getTodayCalls($this->user->id);
    expect($todayTotal)->toBe(2);
});

test('getDailyChart — 기본 days는 7이다', function () {
    $chart = $this->service->getDailyChart($this->user->id);

    expect($chart)->toHaveCount(7);
});

test('getDailyChart — 로그가 없으면 모두 0을 반환한다', function () {
    $chart = $this->service->getDailyChart($this->user->id, 5);

    expect($chart)->toHaveCount(5);
    foreach ($chart as $day) {
        expect($day['total'])->toBe(0);
    }
});
