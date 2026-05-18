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
