<?php

use App\Models\ApiKey;
use App\Models\ApiUsageLog;
use App\Models\User;

test('GET /api/mypage/api-keys — 인증 없이 401을 반환한다', function () {
    $response = $this->getJson('/api/mypage/api-keys');

    $response->assertUnauthorized();
});

test('GET /api/mypage/api-keys — 사용자의 API 키 목록을 반환한다', function () {
    $user = User::factory()->create();
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id, 'name' => '테스트키']);

    $response = $this->actingAs($user, 'sanctum')->getJson('/api/mypage/api-keys');

    $response->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', '테스트키');
});

test('GET /api/mypage/api-keys — 다른 사용자의 키는 조회되지 않는다', function () {
    $user = User::factory()->create();
    ApiKey::factory()->create(['user_id' => $user->id]);
    ApiKey::factory()->create(); // 다른 사용자의 키

    $response = $this->actingAs($user, 'sanctum')->getJson('/api/mypage/api-keys');

    $response->assertOk()
        ->assertJsonCount(1, 'data');
});

test('POST /api/mypage/api-keys — API 키를 생성한다', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/mypage/api-keys', [
        'name' => '새로운 키',
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.name', '새로운 키')
        ->assertJsonStructure([
            'data' => ['id', 'name', 'status', 'created_at'],
        ]);

    $this->assertDatabaseHas('api_keys', [
        'user_id' => $user->id,
        'name' => '새로운 키',
    ]);
});

test('POST /api/mypage/api-keys — name 없이 422를 반환한다', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/mypage/api-keys', []);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['name']);
});

test('POST /api/mypage/api-keys — name이 100자를 초과하면 422를 반환한다', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/mypage/api-keys', [
        'name' => str_repeat('a', 101),
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['name']);
});

test('PATCH /api/mypage/api-keys/{id} — API 키 이름을 수정한다', function () {
    $user = User::factory()->create();
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id, 'name' => '기존 이름']);

    $response = $this->actingAs($user, 'sanctum')->patchJson("/api/mypage/api-keys/{$apiKey->id}", [
        'name' => '새 이름',
    ]);

    $response->assertOk()
        ->assertJsonPath('data.name', '새 이름');

    $this->assertDatabaseHas('api_keys', [
        'id' => $apiKey->id,
        'name' => '새 이름',
    ]);
});

test('PATCH /api/mypage/api-keys/{id} — API 키 상태를 수정한다', function () {
    $user = User::factory()->create();
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id, 'status' => 'active']);

    $response = $this->actingAs($user, 'sanctum')->patchJson("/api/mypage/api-keys/{$apiKey->id}", [
        'status' => 'paused',
    ]);

    $response->assertOk()
        ->assertJsonPath('data.status', 'paused');
});

test('PATCH /api/mypage/api-keys/{id} — 잘못된 상태 값으로 422를 반환한다', function () {
    $user = User::factory()->create();
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id]);

    $response = $this->actingAs($user, 'sanctum')->patchJson("/api/mypage/api-keys/{$apiKey->id}", [
        'status' => 'invalid_status',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['status']);
});

test('PATCH /api/mypage/api-keys/{id} — 존재하지 않는 키는 404를 반환한다', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->patchJson('/api/mypage/api-keys/99999', [
        'name' => '수정',
    ]);

    $response->assertStatus(404);
});

test('PATCH /api/mypage/api-keys/{id} — 다른 사용자의 키는 수정할 수 없다', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $apiKey = ApiKey::factory()->create(['user_id' => $otherUser->id]);

    $response = $this->actingAs($user, 'sanctum')->patchJson("/api/mypage/api-keys/{$apiKey->id}", [
        'name' => '해킹',
    ]);

    $response->assertStatus(404);
});

test('DELETE /api/mypage/api-keys/{id} — API 키를 삭제한다', function () {
    $user = User::factory()->create();
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id]);

    $response = $this->actingAs($user, 'sanctum')->deleteJson("/api/mypage/api-keys/{$apiKey->id}");

    $response->assertStatus(204);
    $this->assertDatabaseMissing('api_keys', ['id' => $apiKey->id]);
});

test('DELETE /api/mypage/api-keys/{id} — 다른 사용자의 키는 삭제할 수 없다', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $apiKey = ApiKey::factory()->create(['user_id' => $otherUser->id]);

    $response = $this->actingAs($user, 'sanctum')->deleteJson("/api/mypage/api-keys/{$apiKey->id}");

    $response->assertStatus(404);
    $this->assertDatabaseHas('api_keys', ['id' => $apiKey->id]);
});

test('GET /api/mypage/usage — 사용량 요약을 반환한다', function () {
    $user = User::factory()->create([
        'api_quota_remaining' => 50,
        'api_quota_limit' => 100,
    ]);
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id, 'status' => 'active']);
    ApiUsageLog::factory()->create(['user_id' => $user->id, 'api_key_id' => $apiKey->id]);

    $response = $this->actingAs($user, 'sanctum')->getJson('/api/mypage/usage');

    $response->assertOk()
        ->assertJsonPath('data.total_calls', 1)
        ->assertJsonPath('data.today_calls', 1)
        ->assertJsonPath('data.active_keys', 1)
        ->assertJsonPath('data.quota_remaining', 50)
        ->assertJsonPath('data.quota_limit', 100);
});

test('GET /api/mypage/usage — 사용량이 없으면 0을 반환한다', function () {
    $user = User::factory()->create([
        'api_quota_remaining' => 100,
        'api_quota_limit' => 100,
    ]);

    $response = $this->actingAs($user, 'sanctum')->getJson('/api/mypage/usage');

    $response->assertOk()
        ->assertJsonPath('data.total_calls', 0)
        ->assertJsonPath('data.today_calls', 0)
        ->assertJsonPath('data.active_keys', 0);
});

test('GET /api/mypage/usage/history — 최근 사용 내역을 반환한다', function () {
    $user = User::factory()->create();
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id]);
    ApiUsageLog::factory()->count(3)->create(['user_id' => $user->id, 'api_key_id' => $apiKey->id]);

    $response = $this->actingAs($user, 'sanctum')->getJson('/api/mypage/usage/history');

    $response->assertOk()
        ->assertJsonCount(3, 'data');
});

test('GET /api/mypage/usage/chart — 일별 차트 데이터를 반환한다', function () {
    $user = User::factory()->create();
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id]);
    ApiUsageLog::factory()->count(5)->create(['user_id' => $user->id, 'api_key_id' => $apiKey->id]);

    $response = $this->actingAs($user, 'sanctum')->getJson('/api/mypage/usage/chart');

    $response->assertOk()
        ->assertJsonStructure([
            'data' => [
                '*' => ['date', 'total'],
            ],
        ]);
});
