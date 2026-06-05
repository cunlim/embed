<?php

use App\Models\ApiKey;
use App\Models\ApiUsageLog;
use App\Models\User;

test('GET /api/admin/users — superadmin은 회원 목록을 조회할 수 있다', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    User::factory()->count(3)->create();

    $response = $this->actingAs($superadmin, 'sanctum')->getJson('/api/admin/users');

    $response->assertOk()
        ->assertJsonCount(4, 'data')
        ->assertJsonStructure([
            'data' => [
                '*' => ['id', 'name', 'email', 'role', 'created_at'],
            ],
        ]);
});

test('GET /api/admin/users — member는 회원 목록을 조회할 수 없다', function () {
    $member = User::factory()->create(['role' => 'member']);

    $response = $this->actingAs($member, 'sanctum')->getJson('/api/admin/users');

    $response->assertStatus(403);
});

test('GET /api/admin/users/{id} — superadmin은 회원 상세를 조회할 수 있다', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $user = User::factory()->create([
        'api_quota_remaining' => 50,
        'api_quota_limit' => 100,
    ]);
    $apiKey = ApiKey::factory()->create(['user_id' => $user->id, 'status' => 'active']);
    ApiUsageLog::factory()->count(3)->create(['user_id' => $user->id, 'api_key_id' => $apiKey->id]);

    $response = $this->actingAs($superadmin, 'sanctum')->getJson("/api/admin/users/{$user->id}");

    $response->assertOk()
        ->assertJsonPath('data.id', $user->id)
        ->assertJsonPath('data.total_calls', 3)
        ->assertJsonPath('data.today_calls', 3)
        ->assertJsonPath('data.active_keys', 1)
        ->assertJsonStructure([
            'data' => [
                'id', 'name', 'email', 'role', 'created_at', 'api_quota_remaining', 'api_quota_limit',
                'total_calls',
                'today_calls',
                'active_keys',
                'calls_by_key',
            ],
        ]);
});

test('GET /api/admin/users/{id} — 존재하지 않는 회원은 404를 반환한다', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);

    $response = $this->actingAs($superadmin, 'sanctum')->getJson('/api/admin/users/99999');

    $response->assertStatus(404);
});

test('GET /api/admin/users/{id} — member는 회원 상세를 조회할 수 없다', function () {
    $member = User::factory()->create(['role' => 'member']);
    $user = User::factory()->create();

    $response = $this->actingAs($member, 'sanctum')->getJson("/api/admin/users/{$user->id}");

    $response->assertStatus(403);
});

test('PATCH /api/admin/users/{id}/quota — absolute로 quota를 설정한다', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $user = User::factory()->create([
        'api_quota_remaining' => 50,
        'api_quota_limit' => 100,
    ]);

    $response = $this->actingAs($superadmin, 'sanctum')->patchJson("/api/admin/users/{$user->id}/quota", [
        'type' => 'absolute',
        'value' => 200,
    ]);

    $response->assertOk()
        ->assertJsonPath('data.api_quota_remaining', 200)
        ->assertJsonPath('data.api_quota_limit', 200);

    $user->refresh();
    expect($user->api_quota_remaining)->toBe(200);
    expect($user->api_quota_limit)->toBe(200);
});

test('PATCH /api/admin/users/{id}/quota — increment으로 quota를 증가시킨다', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $user = User::factory()->create([
        'api_quota_remaining' => 50,
        'api_quota_limit' => 100,
    ]);

    $response = $this->actingAs($superadmin, 'sanctum')->patchJson("/api/admin/users/{$user->id}/quota", [
        'type' => 'increment',
        'value' => 30,
    ]);

    $response->assertOk()
        ->assertJsonPath('data.api_quota_remaining', 80)
        ->assertJsonPath('data.api_quota_limit', 130);
});

test('PATCH /api/admin/users/{id}/quota — type 없이 422를 반환한다', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $user = User::factory()->create();

    $response = $this->actingAs($superadmin, 'sanctum')->patchJson("/api/admin/users/{$user->id}/quota", [
        'value' => 100,
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['type']);
});

test('PATCH /api/admin/users/{id}/quota — value 없이 422를 반환한다', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $user = User::factory()->create();

    $response = $this->actingAs($superadmin, 'sanctum')->patchJson("/api/admin/users/{$user->id}/quota", [
        'type' => 'absolute',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['value']);
});

test('PATCH /api/admin/users/{id}/quota — 음수 value는 422를 반환한다', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $user = User::factory()->create();

    $response = $this->actingAs($superadmin, 'sanctum')->patchJson("/api/admin/users/{$user->id}/quota", [
        'type' => 'absolute',
        'value' => -1,
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['value']);
});

test('PATCH /api/admin/users/{id}/quota — member는 quota를 조정할 수 없다', function () {
    $member = User::factory()->create(['role' => 'member']);
    $user = User::factory()->create();

    $response = $this->actingAs($member, 'sanctum')->patchJson("/api/admin/users/{$user->id}/quota", [
        'type' => 'absolute',
        'value' => 100,
    ]);

    $response->assertStatus(403);
});

test('PATCH /api/admin/users/{id}/quota — 존재하지 않는 회원은 404를 반환한다', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);

    $response = $this->actingAs($superadmin, 'sanctum')->patchJson('/api/admin/users/99999/quota', [
        'type' => 'absolute',
        'value' => 100,
    ]);

    $response->assertStatus(404);
});
