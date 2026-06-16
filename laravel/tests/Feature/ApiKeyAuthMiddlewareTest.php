<?php

use App\Http\Middleware\ApiKeyAuth;
use App\Models\User;
use App\Services\ApiKeyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    // 테스트용 라우트 등록 (같은 파일 내에서 중복 등록은 무시됨)
    Route::middleware(ApiKeyAuth::class)->get('/api/test-auth', fn () => response()->json(['ok' => true]));
    Route::middleware(ApiKeyAuth::class)->get('/api/test-auth-merge', function (Request $request) {
        return response()->json([
            'key_id' => $request->input('_api_key_id'),
            'user_id' => $request->input('_api_user_id'),
        ]);
    });

    $this->user = User::factory()->create([
        'api_quota_remaining' => 10,
        'api_quota_limit' => 10,
    ]);
    $this->apiKey = app(ApiKeyService::class)->create($this->user->id, '테스트 키');
});

test('API key 없이 요청하면 401을 반환한다', function () {
    $response = $this->getJson('/api/test-auth');

    $response->assertStatus(401)
        ->assertJson([
            'code' => 'unauthorized',
            'message' => 'API key가 필요합니다.',
        ]);
});

test('존재하지 않는 API key로 요청하면 401을 반환한다', function () {
    $response = $this->withHeader('Authorization', 'Bearer cl_nonexistent_key_12345')
        ->getJson('/api/test-auth');

    $response->assertStatus(401)
        ->assertJson([
            'code' => 'unauthorized',
            'message' => '유효하지 않은 API key입니다.',
        ]);
});

test('일시정지된 API key로 요청하면 403을 반환한다', function () {
    $this->apiKey->update(['status' => 'paused']);

    $response = $this->withHeader('Authorization', "Bearer {$this->apiKey->plain_key}")
        ->getJson('/api/test-auth');

    $response->assertStatus(403)
        ->assertJson([
            'code' => 'key_paused',
            'message' => '일시정지된 API key입니다.',
        ]);
});

test('quota가 초과된 사용자의 API key로 요청하면 429를 반환한다', function () {
    $this->user->update(['api_quota_remaining' => 0]);

    $response = $this->withHeader('Authorization', "Bearer {$this->apiKey->plain_key}")
        ->getJson('/api/test-auth');

    $response->assertStatus(429)
        ->assertJson([
            'code' => 'quota_exceeded',
            'message' => '무료 호출 회수를 초과했습니다.',
        ]);
});

test('유효한 API key로 요청하면 요청을 통과시킨다', function () {
    $response = $this->withHeader('Authorization', "Bearer {$this->apiKey->plain_key}")
        ->getJson('/api/test-auth');

    $response->assertStatus(200)
        ->assertJson(['ok' => true]);
});

test('유효한 API key로 요청하면 request에 _api_key_id와 _api_user_id가 주입된다', function () {
    $response = $this->withHeader('Authorization', "Bearer {$this->apiKey->plain_key}")
        ->getJson('/api/test-auth-merge');

    $response->assertStatus(200)
        ->assertJson([
            'key_id' => $this->apiKey->id,
            'user_id' => $this->user->id,
        ]);
});
