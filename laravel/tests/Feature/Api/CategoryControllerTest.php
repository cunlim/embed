<?php

use App\Models\Category;
use App\Models\CategoryEmbedding;
use App\Models\SearchLog;
use App\Models\User;
use App\Services\EmbeddingCacheService;
use App\Services\RecommendationService;
use Illuminate\Pagination\LengthAwarePaginator;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    // 마이그레이션으로 role 컬럼이 추가되어 있어야 함
});

describe('store', function () {
    test('카테고리 생성 시 번역 필드를 함께 저장할 수 있다', function () {
        $user = User::factory()->create(['role' => 'member']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/categories', [
            'category_name_ko' => '테스트 카테고리',
            'category_name_en' => 'Test Category',
            'category_name_zh' => '测试类别',
        ]);

        $response->assertStatus(201);
        expect($response->json('data.category_name_en'))->toBe('Test Category');
        expect($response->json('data.category_name_zh'))->toBe('测试类别');
        $this->assertDatabaseHas('categories', [
            'category_name_ko' => '테스트 카테고리',
            'category_name_en' => 'Test Category',
            'category_name_zh' => '测试类别',
        ]);
    });

    test('번역 필드 없이도 카테고리를 생성할 수 있다', function () {
        $user = User::factory()->create(['role' => 'member']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/categories', [
            'category_name_ko' => '한국어만 있는 카테고리',
        ]);

        $response->assertStatus(201);
        expect($response->json('data.category_name_en'))->toBeNull();
        expect($response->json('data.category_name_zh'))->toBeNull();
    });

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

describe('search', function () {
    test('search 파라미터로 카테고리명 LIKE 검색', function () {
        Category::factory()->create(['user_id' => 1, 'category_name_ko' => '화장품/미용>헤어케어>샴푸']);
        Category::factory()->create(['user_id' => 1, 'category_name_ko' => '화장품/미용>헤어케어>린스']);
        Category::factory()->create(['user_id' => 1, 'category_name_ko' => '식품>음료>탄산수']);

        $response = $this->getJson('/api/categories?search=샴푸');

        $response->assertOk();
        $names = collect($response->json('data'))->pluck('category_name_ko');
        expect($names)->toContain('화장품/미용>헤어케어>샴푸');
        expect($names)->not->toContain('화장품/미용>헤어케어>린스');
        expect($names)->not->toContain('식품>음료>탄산수');
    });

    test('search 불일치 시 빈 결과', function () {
        Category::factory()->create(['user_id' => 1, 'category_name_ko' => '화장품/미용>헤어케어>샴푸']);

        $response = $this->getJson('/api/categories?search=존재하지않는키워드');

        $response->assertOk();
        expect($response->json('data'))->toBeEmpty();
    });

    test('search + filter=my 조합', function () {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        Category::factory()->create(['user_id' => $user->id, 'category_name_ko' => '화장품/미용>헤어케어>샴푸']);
        Category::factory()->create(['user_id' => 1, 'category_name_ko' => '식품>음료>샴푸음료']);

        $response = $this->getJson('/api/categories?search=샴푸&filter=my');

        $response->assertOk();
        $names = collect($response->json('data'))->pluck('category_name_ko');
        expect($names)->toContain('화장품/미용>헤어케어>샴푸');
        expect($names)->not->toContain('식품>음료>샴푸음료');
    });

    test('빈 search 값은 무시된다', function () {
        Category::factory()->create(['user_id' => 1, 'category_name_ko' => '화장품/미용>헤어케어>샴푸']);

        $response = $this->getJson('/api/categories?search=');

        $response->assertOk();
        expect($response->json('data'))->not->toBeEmpty();
    });
});

describe('유사도 검색 (text 파라미터)', function () {
    test('text 없이 호출하면 일반 카테고리 목록을 반환한다', function () {
        Category::factory()->create(['user_id' => 1, 'category_name_ko' => '테스트']);

        $response = $this->getJson('/api/categories');

        $response->assertOk();
        expect($response->json('data'))->toHaveCount(1);
        // 유사도 필드는 null 또는 포함되지 않음
        $firstItem = $response->json('data.0');
        expect($firstItem)->toHaveKey('similarity_score');
    });

    test('text가 비어있으면 일반 카테고리 목록을 반환한다', function () {
        Category::factory()->create(['user_id' => 1, 'category_name_ko' => '테스트']);

        $response = $this->getJson('/api/categories?text=');

        $response->assertOk();
        expect($response->json('data'))->toHaveCount(1);
    });

    test('text 500자 초과 시 422를 반환한다', function () {
        $longText = str_repeat('a', 501);

        $response = $this->getJson("/api/categories?text={$longText}&target_language=ko");

        $response->assertStatus(422);
    });

    test('text가 있으면 EmbeddingCacheService를 호출한다', function () {
        $mockCache = Mockery::mock(EmbeddingCacheService::class);
        $searchLog = new SearchLog;
        $searchLog->embedding = SearchLog::factory()->make()->embedding;
        $mockCache->shouldReceive('getOrCreateEmbedding')->once()->andReturn($searchLog);

        $this->app->instance(EmbeddingCacheService::class, $mockCache);

        $mockRecommendation = Mockery::mock(RecommendationService::class);
        $mockRecommendation->shouldReceive('recommendPaginated')->once()->andReturn(
            new LengthAwarePaginator([], 0, 20)
        );
        $this->app->instance(RecommendationService::class, $mockRecommendation);

        $response = $this->getJson('/api/categories?text=테스트&target_language=ko');

        $response->assertOk();
    });

    test('로그인 사용자: text 검색 시 quota가 차감된다', function () {
        $user = User::factory()->create(['role' => 'member', 'api_quota_remaining' => 10]);
        Sanctum::actingAs($user);

        $mockCache = Mockery::mock(EmbeddingCacheService::class);
        $searchLog = new SearchLog;
        $searchLog->embedding = SearchLog::factory()->make()->embedding;
        $mockCache->shouldReceive('getOrCreateEmbedding')->andReturn($searchLog);
        $this->app->instance(EmbeddingCacheService::class, $mockCache);

        $mockRecommendation = Mockery::mock(RecommendationService::class);
        $mockRecommendation->shouldReceive('recommendPaginated')->andReturn(
            new LengthAwarePaginator([], 0, 20)
        );
        $this->app->instance(RecommendationService::class, $mockRecommendation);

        $this->getJson('/api/categories?text=테스트&target_language=ko');

        expect($user->fresh()->api_quota_remaining)->toBe(9);
    });

    test('로그인 사용자: quota=0이면 429를 반환한다', function () {
        $user = User::factory()->create(['role' => 'member', 'api_quota_remaining' => 0]);
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/categories?text=테스트&target_language=ko');

        $response->assertStatus(429);
        $response->assertJsonPath('code', 'quota_exceeded');
    });

    test('비로그인 사용자: quota 체크 없이 200을 반환한다', function () {
        $mockCache = Mockery::mock(EmbeddingCacheService::class);
        $searchLog = new SearchLog;
        $searchLog->embedding = SearchLog::factory()->make()->embedding;
        $mockCache->shouldReceive('getOrCreateEmbedding')->andReturn($searchLog);
        $this->app->instance(EmbeddingCacheService::class, $mockCache);

        $mockRecommendation = Mockery::mock(RecommendationService::class);
        $mockRecommendation->shouldReceive('recommendPaginated')->andReturn(
            new LengthAwarePaginator([], 0, 20)
        );
        $this->app->instance(RecommendationService::class, $mockRecommendation);

        $response = $this->getJson('/api/categories?text=테스트&target_language=ko');

        $response->assertOk();
    });

    test('text 없이는 quota가 차감되지 않는다', function () {
        $user = User::factory()->create(['role' => 'member', 'api_quota_remaining' => 10]);
        Sanctum::actingAs($user);

        Category::factory()->create(['user_id' => $user->id]);

        $this->getJson('/api/categories');

        expect($user->fresh()->api_quota_remaining)->toBe(10);
    });
});
