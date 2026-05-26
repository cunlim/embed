<?php

use App\Models\Setting;
use App\Models\User;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\getJson;
use function Pest\Laravel\putJson;

beforeEach(function () {
    Setting::firstOrCreate(
        ['group' => 'pagination', 'key' => 'default_per_page'],
        ['value' => '20', 'type' => 'integer', 'description' => 'test']
    );
});

test('superadmin은 설정 목록을 조회할 수 있다', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    actingAs($superadmin, 'sanctum');

    $response = getJson('/api/admin/settings');

    $response->assertOk()
        ->assertJsonPath('data.pagination.default_per_page', 20);
});

test('admin은 설정 목록을 조회할 수 없다', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    actingAs($admin, 'sanctum');

    $response = getJson('/api/admin/settings');

    $response->assertStatus(403);
});

test('member는 설정 목록을 조회할 수 없다', function () {
    $member = User::factory()->create(['role' => 'member']);
    actingAs($member, 'sanctum');

    $response = getJson('/api/admin/settings');

    $response->assertStatus(403);
});

test('비로그인은 설정 목록을 조회할 수 없다', function () {
    $response = getJson('/api/admin/settings');

    $response->assertStatus(401);
});

test('superadmin은 설정 값을 업데이트할 수 있다', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    actingAs($superadmin, 'sanctum');

    $response = putJson('/api/admin/settings', [
        'group' => 'pagination',
        'key' => 'default_per_page',
        'value' => 30,
    ]);

    $response->assertOk()
        ->assertJsonPath('data.value', 30);

    $setting = Setting::where('group', 'pagination')
        ->where('key', 'default_per_page')
        ->first();
    expect($setting->value)->toBe('30');
});

test('admin은 설정 값을 업데이트할 수 없다', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    actingAs($admin, 'sanctum');

    $response = putJson('/api/admin/settings', [
        'group' => 'pagination',
        'key' => 'default_per_page',
        'value' => '30',
    ]);

    $response->assertStatus(403);
});
