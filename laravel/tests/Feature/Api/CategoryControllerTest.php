<?php

use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    // 마이그레이션으로 role 컬럼이 추가되어 있어야 함
});

describe('store', function () {
    test('카테고리 생성 시 로그인 사용자의 user_id가 자동 설정된다', function () {
        $user = User::factory()->create(['role' => 'member']);

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/categories', [
            'category_name_ko' => '테스트 카테고리',
        ]);

        $response->assertStatus(201);
        expect($response->json('data.user_id'))->toBe($user->id);
    });
});

describe('destroy', function () {
    test('본인 소유 카테고리는 삭제할 수 있다', function () {
        $user = User::factory()->create(['role' => 'member']);
        $category = Category::factory()->create(['user_id' => $user->id]);

        Sanctum::actingAs($user);

        $response = $this->deleteJson("/api/categories/{$category->id}");

        $response->assertStatus(200);
        $this->assertDatabaseMissing('categories', ['id' => $category->id]);
    });

    test('admin은 타인 카테고리를 삭제할 수 있다', function () {
        $admin = User::factory()->create(['role' => 'admin']);
        $otherUser = User::factory()->create(['role' => 'member']);
        $category = Category::factory()->create(['user_id' => $otherUser->id]);

        Sanctum::actingAs($admin);

        $response = $this->deleteJson("/api/categories/{$category->id}");

        $response->assertStatus(200);
        $this->assertDatabaseMissing('categories', ['id' => $category->id]);
    });

    test('superadmin은 타인 카테고리를 삭제할 수 있다', function () {
        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $otherUser = User::factory()->create(['role' => 'member']);
        $category = Category::factory()->create(['user_id' => $otherUser->id]);

        Sanctum::actingAs($superadmin);

        $response = $this->deleteJson("/api/categories/{$category->id}");

        $response->assertStatus(200);
        $this->assertDatabaseMissing('categories', ['id' => $category->id]);
    });

    test('일반회원은 타인 카테고리를 삭제할 수 없다', function () {
        $user = User::factory()->create(['role' => 'member']);
        $otherUser = User::factory()->create(['role' => 'member']);
        $category = Category::factory()->create(['user_id' => $otherUser->id]);

        Sanctum::actingAs($user);

        $response = $this->deleteJson("/api/categories/{$category->id}");

        $response->assertStatus(403);
        $this->assertDatabaseHas('categories', ['id' => $category->id]);
    });

    test('카테고리 삭제 시 관련 embedding도 함께 삭제된다', function () {
        $user = User::factory()->create(['role' => 'member']);
        $category = Category::factory()->create(['user_id' => $user->id]);
        CategoryEmbedding::factory()->create([
            'category_id' => $category->id,
            'language' => 'ko',
        ]);

        Sanctum::actingAs($user);

        $response = $this->deleteJson("/api/categories/{$category->id}");

        $response->assertStatus(200);
        $this->assertDatabaseMissing('category_embeddings', ['category_id' => $category->id]);
    });

    test('비인증 사용자는 카테고리를 삭제할 수 없다', function () {
        $category = Category::factory()->create(['user_id' => 1]);

        $response = $this->deleteJson("/api/categories/{$category->id}");

        $response->assertStatus(401);
    });
});

describe('updateText', function () {
    test('일반회원은 타인 카테고리 텍스트를 수정할 수 없다', function () {
        $user = User::factory()->create(['role' => 'member']);
        $otherUser = User::factory()->create(['role' => 'member']);
        $category = Category::factory()->create([
            'user_id' => $otherUser->id,
            'category_name_ko' => '원본',
        ]);

        Sanctum::actingAs($user);

        $response = $this->putJson("/api/categories/{$category->id}/update-text", [
            'field' => 'category_name_ko',
            'value' => '수정된 텍스트',
        ]);

        $response->assertStatus(403);
    });

    test('본인 소유 카테고리는 수정할 수 있다', function () {
        $user = User::factory()->create(['role' => 'member']);
        $category = Category::factory()->create([
            'user_id' => $user->id,
            'category_name_ko' => '원본',
        ]);

        Sanctum::actingAs($user);

        $response = $this->putJson("/api/categories/{$category->id}/update-text", [
            'field' => 'category_name_ko',
            'value' => '수정된 텍스트',
        ]);

        $response->assertStatus(200);
    });
});

test('GET /api/categories?filter=my — 인증된 사용자는 본인 소유 카테고리만 조회', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    Category::factory()->create(['user_id' => $user->id, 'category_name_ko' => '내 카테고리']);
    Category::factory()->create(['user_id' => $otherUser->id, 'category_name_ko' => '타인 카테고리']);
    Category::factory()->create(['user_id' => 1, 'category_name_ko' => '관리자 카테고리']);

    $token = $user->createToken('test')->plainTextToken;

    $response = $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/categories?filter=my');

    $response->assertOk();
    $names = collect($response->json('data'))->pluck('category_name_ko');
    expect($names)->toContain('내 카테고리');
    expect($names)->not->toContain('타인 카테고리');
    expect($names)->not->toContain('관리자 카테고리');
});

test('GET /api/categories — 인증된 사용자는 본인 + user_id=1 소유 카테고리 조회', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    Category::factory()->create(['user_id' => $user->id, 'category_name_ko' => '내 카테고리']);
    Category::factory()->create(['user_id' => $otherUser->id, 'category_name_ko' => '타인 카테고리']);
    Category::factory()->create(['user_id' => 1, 'category_name_ko' => '관리자 카테고리']);

    $token = $user->createToken('test')->plainTextToken;

    $response = $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/categories');

    $response->assertOk();
    $names = collect($response->json('data'))->pluck('category_name_ko');
    expect($names)->toContain('내 카테고리');
    expect($names)->not->toContain('타인 카테고리');
    expect($names)->toContain('관리자 카테고리');
});

test('GET /api/categories — 비회원은 user_id=1 소유 카테고리만 조회', function () {
    $user = User::factory()->create();

    Category::factory()->create(['user_id' => $user->id, 'category_name_ko' => '회원 카테고리']);
    Category::factory()->create(['user_id' => 1, 'category_name_ko' => '관리자 카테고리']);

    $response = $this->getJson('/api/categories');

    $response->assertOk();
    $names = collect($response->json('data'))->pluck('category_name_ko');
    expect($names)->not->toContain('회원 카테고리');
    expect($names)->toContain('관리자 카테고리');
});

test('GET /api/categories?filter=my — 비회원은 빈 결과', function () {
    $user = User::factory()->create();

    Category::factory()->create(['user_id' => $user->id, 'category_name_ko' => '회원 카테고리']);
    Category::factory()->create(['user_id' => 1, 'category_name_ko' => '관리자 카테고리']);

    $response = $this->getJson('/api/categories?filter=my');

    $response->assertOk();
    expect($response->json('data'))->toBeEmpty();
});
