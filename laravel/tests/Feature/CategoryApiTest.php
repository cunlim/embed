<?php

use App\Models\Category;
use App\Models\User;

test('GET /api/categories — 카테고리 목록을 반환한다', function () {
    Category::factory()->count(3)->create();

    $response = $this->getJson('/api/categories');

    $response->assertOk()
        ->assertJsonCount(3, 'data');
});

test('POST /api/categories — 인증 없이 401을 반환한다', function () {
    $response = $this->postJson('/api/categories', [
        'category_name_ko' => '패션의류',
    ]);

    $response->assertUnauthorized();
});

test('POST /api/categories — 인증된 사용자는 201을 반환한다', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories', [
        'category_name_ko' => '패션의류',
    ]);

    $response->assertCreated()
        ->assertJsonStructure([
            'data' => [
                'id',
                'category_code',
                'category_name_ko',
            ],
        ]);
});

test('POST /api/categories — 중복된 category_code는 422를 반환한다', function () {
    $user = User::factory()->create();
    $existing = Category::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories', [
        'category_name_ko' => '새카테고리',
        'category_code' => $existing->category_code,
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['category_code']);
});

test('POST /api/categories — category_code를 명시하면 해당 코드로 생성된다', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories', [
        'category_name_ko' => '새카테고리',
        'category_code' => 'MY_CUSTOM_01',
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.category_code', 'MY_CUSTOM_01');
});

test('POST /api/categories — category_code 미입력 시 자동 생성된다', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/categories', [
        'category_name_ko' => '새카테고리',
    ]);

    $response->assertCreated();
    $code = $response->json('data.category_code');
    expect($code)->toMatch('/^CAT_[a-z0-9]{8}$/');
});
